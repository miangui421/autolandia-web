# Meta Pixel + CAPI en web (tracking de eventos para anuncios)

## Problema

Hoy solo el bot de WhatsApp está integrado con Meta (CAPI server-side, eventos `Lead`/`InitiateCheckout`/`Purchase`). La web `autolandia.com.py` no tiene pixel ni CAPI — cero señal hacia Meta. Sin esto, no podemos pautar anuncios con destino a la web de forma efectiva: Meta no puede optimizar por conversiones reales, no se construyen audiencias de retargeting, y los anuncios salen en modo "ciego" (solo optimización por clicks).

Además, Meta revisa la landing page antes de aprobar anuncios con destino website (distinto a los anuncios de WhatsApp). Sin política de privacidad visible y con copy que pueda disparar la clasificación de "gambling", el riesgo de rechazo o ban es real — sobre todo para un sorteo pago.

El objetivo: que la web mande eventos a Meta con match quality alto y que el review de anuncios no tire flags.

## Decisiones tomadas

- **Pixel reusado del bot**: ID `2028015634434230`. Un solo dataset en Events Manager, misma audiencia para ambos canales.
- **CAPI access token**: reusado del bot (mismo `META_CAPI_ACCESS_TOKEN`). Si después Paul quiere rotar, se genera uno dedicado sin cambiar el pixel.
- **Eventos trackeados**: `PageView` (pixel auto), `ViewContent`, `InitiateCheckout`, `Lead`, `Purchase`. Todos menos `PageView` se disparan duplicados en pixel + CAPI con mismo `event_id`.
- **Event ID scheme**: UUID v4 generado client-side para `ViewContent`/`InitiateCheckout`/`Lead` (el cliente dispara pixel instantáneamente y pasa el UUID al server action, que lo reusa en CAPI). Para `Purchase` se usa `ventas.id` (UUID ya generado por Postgres, perfecto para dedup y consistente con el resto del código).
- **Lead timing**: solo cuando el usuario completa nombre + CI en el login (paso "profile"). Se extiende la server action existente `trackLeadCompleted` en `app/actions/auth-otp.ts`.
- **ViewContent sin `value`**: tanto en landing como en `/checkout`. Solo señal de engagement. Evita complejidad de calcular pack seleccionado en el momento de mount.
- **InitiateCheckout con `value` y `currency='PYG'`**: en el momento de reservar hay pack elegido, mandamos el valor para que Meta optimice por carritos de valor alto.
- **fbc cookie lifecycle**: middleware global nuevo (`middleware.ts` en raíz, no existe hoy) detecta `?fbclid=` en cualquier request pública y setea cookie first-party `_fbc` con convención Meta (`fb.1.{timestamp_ms}.{fbclid}`). Transparente al resto del código.
- **Privacy policy**: ruta nueva `/privacidad` con copy redactado estilo e-commerce estándar (menciona pixel Meta y Twilio para transparencia). Link visible **solo en footer del landing `/`** — resto de páginas sin footer.
- **Copy audit**: scan de landing + checkout + páginas públicas. Entregable es tabla markdown `| archivo:línea | texto actual | sugerencia |`. Cliente aprueba caso por caso. Sin cambios inline sin OK.
- **Warmup**: 48-72hs de eventos orgánicos antes de crear campaña (Meta necesita data para salir del learning phase con señal buena).

## Arquitectura

### Archivos nuevos

- `lib/meta-capi.ts` — servicio server-side. Función `sendMetaEvent()` similar a la del bot pero con `action_source: 'website'`, `event_source_url` real, y `user_data` enriquecido (fbp, fbc, IP, user-agent). Incluye el Test Event Code si `META_TEST_EVENT_CODE` está seteado.
- `lib/pixel.ts` — helpers client-side tipados (`trackViewContent`, `trackInitiateCheckout`, `trackLead`, `trackPurchase`). Envuelven `window.fbq()` con manejo de `eventID` para dedup.
- `lib/meta-cookies.ts` — helpers server-side: `getFbp(cookieStore)`, `getFbc(cookieStore)`. Leen `cookies()` de Next 16.
- `lib/meta-event-id.ts` — helper client-side `generateEventId(): string` que usa `crypto.randomUUID()`. Separado para poder reusar en todos los sitios de fire.
- `components/MetaPixel.tsx` — client component que inyecta el script del pixel via `next/script` (strategy `afterInteractive`). Se monta en el layout root.
- `components/landing/Footer.tsx` — server component con link a `/privacidad`. Se monta solo en landing.
- `app/privacidad/page.tsx` — página estática con política de privacidad (server component). Exporta `metadata.robots = 'noindex'` para que Google no la posicione sobre la landing.
- `middleware.ts` (raíz del repo, archivo nuevo) — matcher sobre todas las rutas públicas. Si el request trae `?fbclid=`, setea cookie first-party `_fbc` via `NextResponse.cookies.set` con valor `fb.1.{Date.now()}.{fbclid}` y `maxAge: 7776000` (90 días, convención Meta). Excluye rutas `/admin/*` y `/_next/*` del matcher para no agregar overhead. **Nota**: el admin NO usa middleware hoy (la auth admin corre via `lib/admin-auth.ts` con cookie TOTP), así que este archivo se crea desde cero.

### Archivos modificados

- `app/layout.tsx` — incluye `<MetaPixel />` antes del cierre del `<body>`.
- `app/page.tsx` (landing) — monta `<Footer />` al final + dispara `ViewContent` en client effect.
- `app/checkout/page.tsx` — dispara `ViewContent` al montar.
- `app/login/page.tsx` — en `handleSaveProfile` (línea ~110), después del `supabase.auth.updateUser` y antes de `trackLeadCompleted`, genera UUID client-side, dispara pixel `Lead`, y pasa el UUID a `trackLeadCompleted(phone, nombre, ci, eventId)`.
- `app/actions/auth-otp.ts` — extender `trackLeadCompleted` para aceptar `eventId` param opcional. La función existente ya tiene early-return por idempotencia cuando `user_metadata.sheet_registered === true` (línea 160-162). La llamada a `sendMetaEvent({ eventName: 'Lead', eventId, user_data })` se coloca **dentro de la rama "primera vez"**, después del `appendLeadToSheets` y antes de setear el flag `sheet_registered`. Esto garantiza que el Lead CAPI dispara una sola vez por usuario, misma semántica que el append a Sheets. Si el user edita su perfil después, NO re-dispara Lead (correcto — no es un nuevo lead, es un update).
- `app/actions/reserve-numbers.ts` — aceptar `eventId` param (del client), después de reservar exitosamente llamar `sendMetaEvent({ eventName: 'InitiateCheckout', eventId, value, currency: 'PYG', user_data })` vía `Promise.allSettled` (fire-and-forget).
- `app/actions/register-sale.ts` — después de `registrar_venta_web` exitoso, llamar `sendMetaEvent({ eventName: 'Purchase', eventId: ventaId, value: monto, currency: 'PYG', user_data })`. Retornar `eventId: ventaId` en la respuesta para que el client dispare pixel.

### Flujo de cada evento

Patrón general: **client genera UUID v4, dispara pixel inmediatamente (sincrónico), pasa UUID al server action que reusa el mismo ID en CAPI**. Excepción: `Purchase`, donde el server ya tiene un UUID perfecto (`ventas.id`) y se lo devuelve al client para disparar el pixel.

**PageView** (automático)

- Pixel dispara al cargar el script (`fbq('init')` + `fbq('track', 'PageView')` en `MetaPixel.tsx`). No se duplica en CAPI (evento de bajo valor, redundante).

**ViewContent** (client-triggered)

1. Component monta (landing o `/checkout`).
2. `useEffect` (una sola vez via flag) ejecuta:
   ```ts
   const eventId = generateEventId();
   trackViewContent({ eventId }); // dispara pixel con eventID
   viewContentServer(eventId).catch(console.error); // CAPI fire-and-forget
   ```
3. `viewContentServer` es una server action que llama `sendMetaEvent({ eventName: 'ViewContent', eventId, user_data })`. Sin `value`. Si falla, el pixel ya disparó → dedup = none → Meta cuenta solo el pixel. Aceptable para ViewContent.

**InitiateCheckout** (user-triggered)

1. Usuario toca "Reservar" en `/checkout`.
2. Component:
   ```ts
   const eventId = generateEventId();
   trackInitiateCheckout({ eventId, value, currency: 'PYG' });
   const result = await reserveNumbers({ ...existing_args, eventId });
   ```
3. `reserveNumbers` valida + hace el `INSERT` en `rifas` + llama `sendMetaEvent({ eventName: 'InitiateCheckout', eventId, value, currency: 'PYG', user_data })` vía `Promise.allSettled`.
4. Si `reserveNumbers` falla, el pixel ya disparó. Meta puede terminar con InitiateCheckout sin Purchase asociado — aceptable, refleja intent.

**Lead** (user-triggered)

1. Usuario completa nombre + CI en `app/login/page.tsx` (`handleSaveProfile`).
2. `supabase.auth.updateUser({ data: { nombre, ci } })` completa (client-side).
3. Inmediatamente después:
   ```ts
   const eventId = generateEventId();
   trackLead({ eventId });
   trackLeadCompleted(phone, nombre, ci, eventId).catch(console.error);
   router.push('/mis-boletos');
   ```
4. `trackLeadCompleted` (extendida) hace el append a Sheets + llama `sendMetaEvent({ eventName: 'Lead', eventId, user_data: { ph, fn: nombre, country, fbp, fbc, ip, ua } })` **solo si no estaba registrado antes** (check `sheet_registered`). Si ya estaba, early-return sin tocar Meta.
5. Si `fbq` no está cargado (bloqueado por adblock), el `trackLead` no-opea silenciosamente → Meta solo recibe el CAPI event. Match quality menor pero mejor que nada.
6. **Idempotencia**: `handleSaveProfile` solo se ejecuta cuando `!hasProfile` (user no tiene nombre o CI seteados). Una vez completado, `hasProfile=true` para siempre y el componente navega directo a `/mis-boletos` sin volver a montar el form. Esto garantiza que pixel + CAPI Lead disparan exactamente una vez por usuario, alineado con el flag `sheet_registered`.

**Purchase** (server-first, client dispara pixel con event_id retornado)

1. Flow actual de checkout sigue igual hasta que `registerSale` server action completa `registrar_venta_web`.
2. `registerSale` extiende su retorno: `{ ok: true, ticket_id, venta_id, event_id: venta_id, ...rest }`.
3. Antes de retornar, dispara `sendMetaEvent({ eventName: 'Purchase', eventId: venta_id, value: monto, currency: 'PYG', user_data })` vía `Promise.allSettled`.
4. Client recibe `result.event_id` y dispara `trackPurchase({ eventId, value, currency: 'PYG' })` antes de navegar al success state.
5. Si `fbq` está bloqueado, el pixel no dispara, el CAPI ya mandó el evento → Meta cuenta la compra igual.

### Orden y race conditions

- Pixel dispara **antes** del server action en los flows client-triggered (VC/IC/Lead). Si el user cierra la pestaña inmediatamente, el pixel ya mandó. El CAPI puede fallar por network, pero Meta quedó con un evento.
- En Purchase (server-first), si la página crashea entre la respuesta del server y el `trackPurchase`, el CAPI ya mandó el evento. Dedup no aplica (no hay pixel) pero Meta cuenta igual.
- `trackViewContent`/`trackLead`/`trackPurchase` usan `fbq('track', ...)` que es sincrónico (agrega al queue local del pixel). `router.push()` después no interrumpe — el pixel drena en background.

## User data para CAPI

Siguiendo [spec Meta CAPI](https://developers.facebook.com/docs/marketing-api/conversions-api/parameters/customer-information-parameters):

- `ph` — teléfono hasheado SHA-256 (solo dígitos, con código país 595)
- `fn` — nombre hasheado SHA-256 (lowercase, trimmed)
- `country` — `'py'` hasheado SHA-256
- `fbp` — cookie `_fbp` leída de `cookies()` del request (se setea sola por el pixel la primera vez que corre en el browser)
- `fbc` — cookie `_fbc` leída de `cookies()` (seteada por el middleware cuando detecta `?fbclid=`)
- `client_ip_address` — header `x-forwarded-for` (primer IP antes de la coma — Easypanel + Traefik agregan su propia IP al final)
- `client_user_agent` — header `user-agent`

**No mandamos `em`**: el login web usa email interno sintético (`user.{phone}@autolandia.internal`), no es un email real del usuario. Mandar este email hasheado no mejora match quality (Meta no va a tener ese hash en su base) y podría ensuciar el dataset.

### Match quality esperado

Con `ph` + `fn` + `country` + `fbp` + `fbc` + IP + UA, el match quality típico en Paraguay está entre 6-8/10 según benchmarks de Meta. El target del QA es **≥6**. Si consistentemente cae por debajo, plan B: agregar `ct` (city) y `st` (state) hasheados, que podemos inferir de la IP vía geoip. Queda como v2 si hace falta, no entra en este spec.

## Privacy policy

### Ruta

- `app/privacidad/page.tsx` — React server component, contenido estático renderizado en build.
- No `generateMetadata` custom: hereda del root layout.

### Contenido (stub)

Secciones:

1. **Qué datos recolectamos** — teléfono, nombre, CI, número de cuenta del comprobante, imágenes del comprobante, dirección IP, cookies de sesión, identificadores de navegador (pixel Meta).
2. **Para qué los usamos** — procesar la compra, contactar sobre el pedido, mejorar la experiencia de navegación.
3. **Con quién compartimos** — Meta (pixel de Facebook/Instagram), Twilio (verificación OTP), Google Sheets (registro interno). Sin venta a terceros.
4. **Cookies y tecnologías de seguimiento** — descripción breve del pixel Meta. Nota: las cookies se pueden borrar desde el navegador, pero **no se promete opt-out funcional** porque Meta ignora DNT y los eventos server-side (CAPI) no dependen de cookies. Frase: "Podés borrar las cookies desde tu navegador. Tené en cuenta que esto puede afectar la experiencia de navegación."
5. **Tus derechos** — acceso, rectificación, eliminación. Contacto para ejercerlos.
6. **Retención** — tiempo de guardado (mientras dure el sorteo + 6 meses post).
7. **Contacto** — email y teléfono del negocio (Paul completa los datos antes del deploy).

Copy redactado en español neutro, estilo e-commerce estándar. **Cero menciones** de: rifa, sorteo, lotería, juego de azar, apuesta.

### Footer

Componente `components/landing/Footer.tsx` — server component. Contenido:

- Texto corto: "© 2026 Autolandia"
- Link a `/privacidad`
- Link `mailto:` para contacto (opcional, Paul decide)

Se monta solo en `app/page.tsx`. Resto de páginas sin cambios.

## Copy audit

Scan de archivos:

- `app/page.tsx` (landing)
- `components/landing/*` (Hero, Packs, PromoBanner, etc.)
- `app/checkout/page.tsx` + componentes asociados
- `lib/constants.ts` (títulos, descripciones)
- `app/layout.tsx` (metadata SEO)

Palabras/frases a flagear:

- rifa, rifas, rifar
- lotería, loto
- apostar, apuesta, apuestas
- juego de azar, azar
- casino, jackpot
- "ganá dinero", "premio en efectivo"
- cualquier mención de porcentajes de probabilidad ("1 en X chance de ganar")

### Entregable del audit

Tabla markdown:

| Archivo:línea | Texto actual | Sugerencia de reemplazo |
|---|---|---|
| `app/page.tsx:42` | "Participá en la rifa..." | "Participá en el sorteo promocional..." |
| ... | ... | ... |

Se entrega al cliente **antes** de tocar cualquier línea. Cliente aprueba o rechaza caso por caso. Solo después de aprobación se hacen los edits y se commitean en un commit separado (`chore(web): copy audit cambios aprobados`).

## Env vars

### Web DEV (Dockerfile + Easypanel Environment)

**Dockerfile** (build arg, hardcoded porque `NEXT_PUBLIC_*` se bakea en el build):

```dockerfile
ENV NEXT_PUBLIC_META_PIXEL_ID=2028015634434230
```

**Easypanel Environment tab** (runtime secrets):

- `META_CAPI_ACCESS_TOKEN=<mismo valor que el bot>`
- `META_TEST_EVENT_CODE=<generado en Events Manager→Test Events>` — solo en DEV, se remueve cuando pasamos a PROD.

### Web PROD (Dockerfile + Easypanel Environment)

**Dockerfile** (ambas branches tienen Dockerfiles distintos — no merge entre develop/main, solo cherry-pick):

```dockerfile
ENV NEXT_PUBLIC_META_PIXEL_ID=2028015634434230
```

**Easypanel Environment tab**:

- `META_CAPI_ACCESS_TOKEN=<mismo valor que el bot>`
- **NO `META_TEST_EVENT_CODE`** — PROD manda eventos reales.

### Checklist de remoción del test code

Al pasar de QA a PROD, hay riesgo de olvidar remover `META_TEST_EVENT_CODE` de DEV o incluirlo accidentalmente en PROD. Mitigación:

1. El deploy a PROD incluye un step manual en el plan: "verificar en Easypanel Environment de `autolandia-web-prod` que NO existe `META_TEST_EVENT_CODE`".
2. El service `sendMetaEvent()` loguea en consola del container cuando incluye test_event_code: `console.log('[meta-capi] sending with test_event_code=XXX')`. Si aparece en los logs de PROD, sabemos que hay que removerlo.

### Config module

Extender `lib/config.ts` (si existe, sino crear) con un getter tipado:

```ts
export const metaConfig = {
  pixelId: process.env.NEXT_PUBLIC_META_PIXEL_ID,
  capiToken: process.env.META_CAPI_ACCESS_TOKEN,
  testEventCode: process.env.META_TEST_EVENT_CODE, // undefined en PROD
};
```

`sendMetaEvent()` es no-op silencioso si falta `pixelId` o `capiToken` (igual que el bot).

## Testing local

Durante desarrollo en `localhost:3000`, los eventos se pueden mandar al pixel real usando el `META_TEST_EVENT_CODE` del `.env.local`. Los eventos aparecen en Events Manager → Test Events (no cuentan para audiences ni optimización hasta que se remueva el code).

- Cada dev puede tener su propio `META_TEST_EVENT_CODE` único (Events Manager permite generar varios) para no pisarse entre colegas.
- Para probar sin internet o sin tocar Meta: setear `META_CAPI_ACCESS_TOKEN=` vacío → `sendMetaEvent()` no-opea. El pixel client-side sigue disparando pero sin CAPI, igual se ven los eventos en el Pixel Helper extension del navegador.

## Plan de deploy

1. **Merge en `develop`** → Easypanel DEV redeploya.
2. **QA en DEV**:
   - Abrir Meta Events Manager → pixel `2028015634434230` → Test Events tab → pegar `META_TEST_EVENT_CODE`.
   - Navegar landing → confirmar `PageView` + `ViewContent` en Test Events.
   - Entrar a `/checkout` → `ViewContent` segundo.
   - Reservar pack → `InitiateCheckout` con value.
   - Completar perfil → `Lead`.
   - Completar compra de prueba → `Purchase` con value + currency.
   - Para cada evento: verificar match quality ≥ 6/10, y que event_id dedup esté funcionando (CAPI + pixel mostrados como "matched").
   - **Verificar `x-forwarded-for`**: en un request cualquiera, loguear `headers().get('x-forwarded-for')` server-side y confirmar que devuelve una IP pública (no `172.x.x.x` interna del proxy). Si devuelve IP interna, ajustar `meta-capi.ts` para usar `headers().get('x-real-ip')` o el primer valor de la lista separada por comas.
3. **Remover `META_TEST_EVENT_CODE` de DEV** y verificar que eventos reales siguen llegando a Events Manager (ya no a Test Events).
4. **Cherry-pick commits a `main`** siguiendo el workflow estándar. Nunca merge de develop→main por el tema Dockerfile.
5. **Verificar en PROD** (autolandia.com.py): abrir la web, disparar los 4 eventos reales con un teléfono propio, confirmar en Events Manager.
6. **Verificar ausencia de `META_TEST_EVENT_CODE` en Easypanel PROD** (checklist de la sección anterior).
7. **Warmup 48-72hs**: dejar pasar tráfico orgánico del WhatsApp bot + quien entre por SEO. Meta necesita ~50 eventos `Purchase` para salir del learning phase con señal decente.
8. **Recién entonces crear campaña** en Ads Manager con optimización `Purchase`.

## Riesgos asumidos

- **Clasificación gambling por Meta**: mitigado con copy audit + privacy policy sin mencionar rifas. Pero el sitio es intrínsecamente un sorteo pago, hay riesgo residual. Si el primer anuncio se rechaza, evaluar estrategias alternativas (ads solo a Instagram con video, ads de marca sin CTA de compra, etc.).
- **fbp/fbc no presentes en primer hit**: si el user llega por primera vez a la landing desde un search orgánico (sin `fbclid`), `fbc` queda vacío. Es normal. El `fbp` se setea apenas el pixel carga, así que desde el segundo pageview en adelante está OK.
- **IP behind proxy incorrecta**: si Easypanel + Traefik no pasan bien `x-forwarded-for`, la IP que ve CAPI puede ser la interna (`172.x.x.x`) → tanquea match quality. Verificar en QA con un request real.
- **Warmup demasiado corto**: si se pauta el día 1, Meta optimiza mal. El plan incluye 48-72hs explícitas antes de crear campaña — Paul tiene que respetarlo.
- **ViewContent CAPI puede fallar sin pixel fallback**: si el server action de VC falla (network, timeout), el pixel ya disparó → evento contado solo client-side. Match quality baja para ese evento puntual, pero es aceptable (VC es low-value, sirve solo para audiencias de retargeting).
- **Match quality <6 sin `em`**: si el benchmark no se alcanza, plan B documentado arriba (agregar `ct`+`st` via geoip). No bloquea este spec.

## Fuera de alcance

- Meta Ads Manager / creación de campañas (lo hace Paul directo en UI).
- Tracking de eventos del bot (ya existe, no se modifica).
- Google Analytics / otros trackers.
- Consent banner / GDPR — no aplica en Paraguay y Meta no lo exige para LatAm.
- Conversion API Gateway / Meta Managed Setup — queda como v2 si queremos match quality aún más alta.
- Tests automatizados del CAPI (requieren mocking de fetch + Meta). Se queda en QA manual via Test Events.
- Custom events (`PhoneVerified`, etc.) — descartados en brainstorming, queda para v2 si Paul quiere tracking más granular.

## Referencias

- [Meta Conversions API overview](https://developers.facebook.com/docs/marketing-api/conversions-api)
- [Customer information parameters](https://developers.facebook.com/docs/marketing-api/conversions-api/parameters/customer-information-parameters)
- [Event deduplication (pixel + CAPI)](https://developers.facebook.com/docs/marketing-api/conversions-api/deduplicate-pixel-and-server-events)
- Spec del bot: `autolandia-bot/src/services/meta-capi.ts` (ya implementado)

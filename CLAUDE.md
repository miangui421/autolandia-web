@AGENTS.md

## Stack
Next.js 16 (App Router, standalone output) + Tailwind 4 + Supabase + Twilio Verify + OpenAI GPT-4o + recharts (admin dashboard) + otplib (2FA) + @supabase/ssr

## Deploy (Easypanel, mismo VPS que bot)
- IP VPS: `5.161.77.126`
- DEV: app `autolandia-web`, branch `develop`, DB `jyytukfcnembucompttu`, spreadsheet `1J5nXKM9PUpWSGp-Jo-TWNCSR_Vi05j1VF0y18DZl_uM`
- PROD: app `autolandia-web-prod`, branch `main`, DB `xtwrmcbvjgywwdpdwoxw`, dominio `autolandia.com.py`, spreadsheet `1Xpv82kqN3emLgZ7w5eEcbJCHNk7tRnU7rVEaU09gr6w`
- URL Easypanel default (DEV): `autolandiabot-fulll-autolandia-web.wrkyu1.easypanel.host`
- **PROD** está LIVE en `https://autolandia.com.py` con SSL Let's Encrypt

## Quirks Easypanel (CRÍTICOS — descubiertos a golpes)
- **Template "App" inyecta `PORT=80`** en runtime sobrescribiendo `ENV PORT=3000` del Dockerfile. Fix: `CMD ["sh", "-c", "PORT=3000 node server.js"]`
- **Proxy port del dominio es independiente del CMD**: el CMD controla dónde escucha el container; el campo **Port** en `Domains` → Edit del dominio controla a qué puerto apunta Traefik. Si los commits anteriores dejaron el container en 80 y después cambiaste el CMD a 3000, también tenés que cambiar el Port del dominio a 3000 o seguirás viendo 502.
- **Build args NO expuestos en UI**: hardcodear `NEXT_PUBLIC_*` con `ENV` en Dockerfile (anon key es publicable)
- **Runtime secrets van en Environment tab** (NO en Dockerfile): `SUPABASE_SERVICE_ROLE_KEY`, `ADMIN_ENCRYPTION_KEY`, `ADMIN_TOTP_COOKIE_SECRET`, `ADMIN_BOOTSTRAP_TOKEN`, `GOOGLE_SHEETS_PRIVATE_KEY`, `TWILIO_*`, etc.
- **Campo "File" del Build** debe decir `Dockerfile` explícito. Vacío = error `open code: no such file or directory`
- Cada rama tiene Dockerfile con valores distintos de `NEXT_PUBLIC_*` (DEV vs PROD)
- **Build OOM**: recharts + Next 16 + todo el proyecto supera el heap default de 2GB. Fix en ambos Dockerfiles: `ENV NODE_OPTIONS=--max-old-space-size=4096` antes del `RUN npm run build`

## Git workflow DEV/PROD
- Trabajar en `develop` → push → app DEV redeploya → probar
- `git cherry-pick <commit>` a `main` cuando aprobado (NUNCA merge directo, porque cambia Dockerfile)
- **NUNCA mergear Dockerfile entre branches** (valores hardcoded distintos)
- Migraciones SQL via Supabase MCP: primero DEV, después PROD

## Auth web (custom, NO Supabase Phone Auth)
- Supabase NO soporta Twilio Verify nativo → flow custom con server actions
- Flow: teléfono → `sendOtp` (Twilio Verify) → `verifyOtpAndGetToken` → crea/busca user con email interno `user.{phone}@autolandia.internal` → genera magic link → cliente lo consume con `supabase.auth.verifyOtp({ token_hash, type: 'magiclink' })`
- user_metadata: `{ telefono, nombre, ci, sheet_registered }`
- `hasProfile` = tiene nombre Y CI
- Twilio Verify Service SID: `VA9a0a03645ee1e3482000ca32983f1ef4` (compartido DEV/PROD)

## Panel admin (/admin/*)
- **Auth 2FA**: phone whitelist en tabla `admin_users` + TOTP (Google Authenticator compatible, otplib v13 API)
- **Cookie admin**: `admin_totp_ok` httpOnly firmada con `ADMIN_TOTP_COOKIE_SECRET`, expira 12h. NO depende de sesión Supabase (la sesión se guarda en localStorage que el servidor no ve).
- **requireAdmin()** en `lib/admin-auth.ts` — usa solo la cookie TOTP como auth (defense in depth: re-chequea `admin_users`). Si no hay cookie válida, redirige a `/admin/login`.
- **Enrollment**: `/admin/enroll?token=<ADMIN_BOOTSTRAP_TOKEN>` genera secret TOTP, lo cifra con AES-256-GCM (`ADMIN_ENCRYPTION_KEY`), muestra QR UNA VEZ. Re-enrollarse genera NUEVO secret en DB (viejo secret queda obsoleto → la app TOTP tiene que re-escanear).
- Post-enroll: cambiar `ADMIN_BOOTSTRAP_TOKEN=DEACTIVATED` en Easypanel para cerrar la puerta.
- **Stats**: RPC Postgres `get_admin_stats(p_range_days)` devuelve totales agregados + daily_sales. Evita el límite default 1000 rows de PostgREST. Usa `fecha AT TIME ZONE 'America/Asuncion'` para agrupar por día correctamente.
- **Sorteador visual**: animación cinemática (ticket dorado con nombres ciclando + partículas + flash + reveal). Confetti en loop hasta click "Finalizar". Fullscreen togglable para streaming. `crypto.randomInt` server-side para picks. Snapshot inmutable del pool.
- **Telegram on-click**: `announceSorteo` se dispara cuando el admin toca "Iniciar sorteo" en la pantalla en vivo (no al crear el sorteo en el form).
- **Eliminar sorteo**: botón en sidebar de `/admin/sorteos/[id]` — server action `deleteSorteo`. Hard navigation con `window.location.href='/admin'` porque `router.push` se traba (la página actual ya no existe).
- **Gestión tickets**: `/admin` sección inferior. Busca por ticket ID / teléfono / CI / nombre. Delete libera rifas → LIBRE + remueve fila del Sheets (lookup case-insensitive de sheet "Ventas", trim de whitespace).
- **Admins enrolados PROD**: `595992673304` (Miguel), `595983757010` (Paul). PulpoPaul tuvo issue de re-enroll: si enrollás dos veces, el secret de DB cambia y la app TOTP queda desincronizada → borrar fila de `admin_users` y re-enrollarse fresh.

## Promos actuales (2026-04-22)
- **3x1 DESACTIVADO** (pedido Paul 2026-04-21): `PROMO_3X1_END` movida a fecha pasada. Banner/CTA/página se auto-ocultan vía checks existentes. Código de `/promo-3x1`, `PACKS_3X1`, `ventas.is_promo_3x1` queda dormido — reactivable con solo mover la fecha.
- **Mini sorteos banner**: 3 sorteos de 500k Gs para compradores de 3+ boletos, draw el 30 de abril. Auto-oculta tras `MINI_SORTEO_DATE`. Fecha en display hardcoded en `MINI_SORTEO_FECHA_DISPLAY` (evita bugs ICU/TZ en Alpine).

## PACKS_NORMALES actuales (pedido Paul 2026-04-21)
1/20k · 2/40k · **3/50k (POPULAR)** · 10/100k · 20/150k · 30/200k · 80/500k

Descuentos mostrados a partir de pack 3 (17% OFF hasta 69% OFF en el de 80).

## Integración con bot (misma DB)
- Tabla `leads` PK = `phone` (upsert, NUNCA degradar stage). Flags: `promo_2x1_used`, `promo_3x1_used`, `sheet_bot_registered`, `sheet_bot_row`, `sheet_registered` (web).
- Hoja Sheets "Ventas": web pasa 13 valores (A:M), bot pasa 12 (A:L). Col M = "WEB" para distinguir.
- Hojas de leads: "Leads Web" (creada por el código web) y "Leads Bot" (creada por el bot). Ambas con 7 cols idénticas: Fecha, Telefono, Nombre Completo, CI, Canal, Stage, Mensaje Inicial.
- Fecha en sheets: `new Date().toLocaleString('sv-SE', { timeZone: 'America/Asuncion' })` (UTC-4 en abril 2026, DST end).

## Gotchas Next.js 16
- `output: 'standalone'` obligatorio en `next.config.ts` para Docker
- `useSearchParams()` debe estar dentro de un `<Suspense>` boundary
- Server actions con notificaciones externas (Telegram/Sheets): usar `await Promise.allSettled()` — fire-and-forget muere en serverless
- Google Sheets private key: parsear `\n` con `.replace(/\\n/g, '\n')` en Docker/Vercel
- Grammy/OpenAI/googleapis: lazy init con funciones `getBot()`/`getOpenAI()` (no a nivel de módulo)
- Server components NO pueden leer la sesión de Supabase si el cliente usa `localStorage` (que es el default de supabase-js). Para auth en server usar otra fuente (como nuestra cookie TOTP firmada).
- ICU limitada en Alpine Docker: `toLocaleDateString({timeZone:'...'})` a veces ignora el option. Para displays críticos: hardcodear el string en constants.

## DNS y dominio
- `autolandia.com.py` → DNS en DreamHost (panel.dreamhost.com), NS: ns1/ns2/ns3.dreamhost.com
- A records: `@` y `www` → `5.161.77.126`
- SSL: Easypanel emite Let's Encrypt automático al detectar DNS propagado
- La IP directa nunca tiene SSL válido

## Supabase limits / patterns
- **Default PostgREST limit 1000 rows** por `.select()`. Para agregados grandes usar RPC (ej: `get_admin_stats`).
- Para idempotencia de writes a Sheets: flag + row index en DB (ej: `sheet_bot_registered` + `sheet_bot_row`).
- **Migraciones SQL**: siempre DEV primero vía MCP `apply_migration`. Usar `IF NOT EXISTS` / `IF EXISTS` para idempotencia.
- `fecha` en tabla `ventas` es `timestamptz`. Para queries por día Paraguay: `(fecha AT TIME ZONE 'America/Asuncion')::date`.

## Debugging común
- 502 Bad Gateway en dominio custom → puerto del dominio ≠ puerto donde escucha el container
- "Service is not reachable" (pantalla Easypanel) → mismo problema de puertos
- Ver logs del container en Easypanel → Overview → icono terminal
- Verificar puerto real del container: en logs busca `- Local: http://localhost:XXX`
- Sheet appends "fallan silencioso": el código tiene try/catch + log. Chequear Sentry o logs del container. Guard defensivo en `register-sale.ts`: si `input.monto` es inválido, recupera de DB via ticket_id antes de escribir.

## Specs y plans
- `docs/superpowers/specs/2026-04-08-web-autolandia-design.md` (spec inicial web)
- `docs/superpowers/plans/2026-04-09-web-autolandia-mvp.md` (plan inicial)
- `docs/superpowers/specs/2026-04-17-promo-3x1-indicativa-design.md` (3x1 feature, ahora desactivada)
- `docs/superpowers/specs/2026-04-18-admin-panel-sorteos-design.md` (admin panel)
- `docs/superpowers/plans/2026-04-18-admin-panel-sorteos-plan.md` (admin plan)
- Spec 2x1 / desactivar 3x1 está en `autolandia-bot/docs/superpowers/specs/2026-04-21-2x1-postcompra-y-desactivar-3x1.md` (cambio atraviesa ambos repos, está centralizado en bot)

## Lecciones aprendidas (update 2026-04-21..22)
- **ICU/TZ en Alpine**: `toLocaleDateString` con `timeZone` option no es confiable. Para fechas fijas de display → hardcodear.
- **Monto vacío en sheets**: bug temporal en 7 ventas web del 16-18 abril (celda F="" en vez de valor). Causa probable: deploy inconsistente. Fix: guard en `register-sale.ts` que recupera de DB si `input.monto` es inválido.
- **3 tickets "huérfanos" en Sheets** (`TK-2079`, `TK-2147`, `TK-2214`): anulados en DB via SQL, quedaron en Sheets como registro histórico. No tocar.
- **Re-enroll TOTP rompe al usuario anterior**: el upsert sobrescribe el secret de DB. Si el user no re-escanea, su app queda desincronizada. Solución: `DELETE FROM admin_users WHERE phone=X` + re-enroll fresh.
- **Push SIEMPRE develop primero**, tras QA cherry-pick a main (incluido hotfixes de admin/banner/etc). Nunca directo a main.
- **UPDATE ... RETURNING ... LIMIT** no es SQL válido. `UPDATE` no soporta LIMIT en Postgres.
- **TIMESTAMPTZ grouping por día**: siempre convertir con `AT TIME ZONE 'America/Asuncion'` antes de `::date` o `DATE_TRUNC('day', ...)`.
- **7 días rolling ≠ 7 días calendario Paraguay**: el filtro `NOW() - 7 days` toma 168 horas atrás, NO 7 días calendario. Usar `(NOW() AT TIME ZONE 'America/Asuncion')::date - (N-1 || ' days')::INTERVAL` para alinearse a días completos.

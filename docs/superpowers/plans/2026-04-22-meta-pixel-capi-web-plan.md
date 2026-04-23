# Meta Pixel + CAPI + Privacy Policy — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Integrar Meta Pixel (cliente) + Conversions API (servidor) en `autolandia.com.py` con los eventos ViewContent/InitiateCheckout/Lead/Purchase deduplicados por event_id, agregar página de política de privacidad, y auditar copy riesgoso — todo para poder pautar anuncios con destino web sin riesgo de rechazo o ban por clasificación de gambling.

**Architecture:** Pixel client-side via `next/script` en layout root + servicio CAPI server-side en `lib/meta-capi.ts` (portado del bot pero con `action_source: 'website'`, fbp/fbc/IP/UA enriquecidos). Event ID = UUID v4 generado client-side (excepto Purchase que reusa `ventas.id`). Middleware nuevo setea cookie `_fbc` al primer `?fbclid=`. Sin tests automatizados — validación vía `npm run build` + QA manual en Events Manager Test Events.

**Tech Stack:** Next.js 16 App Router, TypeScript, Supabase, `crypto.randomUUID()`, Meta Graph API v21.0, ESLint + Next build como validación.

**Spec:** [2026-04-22-meta-pixel-capi-web-design.md](../specs/2026-04-22-meta-pixel-capi-web-design.md)

**Referencias obligatorias antes de tocar código:**
- `autolandia-web/AGENTS.md` — Next.js 16 tiene breaking changes; leer `node_modules/next/dist/docs/` antes de usar APIs dudosas (especialmente `cookies()`, `headers()`, middleware).
- `autolandia-web/CLAUDE.md` — quirks de Easypanel, workflow DEV/PROD, `NEXT_PUBLIC_*` en Dockerfile (no en Environment tab).
- `autolandia-bot/src/services/meta-capi.ts` — referencia del CAPI del bot (patrón a portar con adaptaciones para web).

---

## File Structure

**Crear:**
- `lib/meta-event-id.ts` — helper `generateEventId()` usando `crypto.randomUUID()`
- `lib/meta-cookies.ts` — `getFbp()` y `getFbc()` que leen `cookies()` server-side
- `lib/meta-capi.ts` — `sendMetaEvent()` principal + helpers de hashing
- `lib/pixel.ts` — helpers client-side tipados `trackViewContent`/`trackInitiateCheckout`/`trackLead`/`trackPurchase`
- `components/MetaPixel.tsx` — client component que inyecta el script del pixel
- `components/MetaPixelTracker.tsx` — client component reusable que dispara `ViewContent` (pixel + CAPI) en mount
- `components/landing/Footer.tsx` — server component con link a `/privacidad`
- `app/privacidad/page.tsx` — página estática con copy de privacidad
- `app/actions/view-content.ts` — server action `viewContentServer()` para fire-and-forget CAPI de ViewContent
- `middleware.ts` — setter de cookie `_fbc` al detectar `?fbclid=`

**Modificar:**
- `app/layout.tsx` — montar `<MetaPixel />`
- `app/page.tsx` — disparar ViewContent en mount + montar Footer
- `app/checkout/page.tsx` — disparar ViewContent en mount + InitiateCheckout en reserve + Purchase en success
- `app/login/page.tsx` — disparar Lead en `handleSaveProfile`
- `app/actions/auth-otp.ts` — extender `trackLeadCompleted` para aceptar `eventId` y disparar CAPI Lead
- `app/actions/reserve-numbers.ts` — aceptar `eventId` y disparar CAPI InitiateCheckout
- `app/actions/register-sale.ts` — disparar CAPI Purchase + retornar `event_id`
- `Dockerfile` (develop) + `Dockerfile` (main, vía cherry-pick) — agregar `ENV NEXT_PUBLIC_META_PIXEL_ID=...`

**Env vars (manual en Easypanel Environment tab):**
- DEV: `META_CAPI_ACCESS_TOKEN` (reusado del bot), `META_TEST_EVENT_CODE` (temporal para QA)
- PROD: `META_CAPI_ACCESS_TOKEN` (reusado del bot). SIN test_event_code.

---

## Chunk 1: Foundation (helpers + servicio CAPI)

Archivos nuevos de lib/ sin dependencias entre sí excepto meta-capi → meta-cookies. No tocan UI ni flow existente — low risk.

### Task 1.1: Helper de event_id

**Files:**
- Create: `lib/meta-event-id.ts`

- [ ] **Step 1: Crear el archivo**

```ts
// lib/meta-event-id.ts
/**
 * Genera un UUID v4 para dedup de eventos pixel + CAPI.
 * Se usa en el cliente para eventos VC/IC/Lead. Para Purchase, se reusa
 * `ventas.id` (también UUID) — este helper no se llama en ese caso.
 */
export function generateEventId(): string {
  if (typeof crypto === 'undefined' || !crypto.randomUUID) {
    throw new Error('crypto.randomUUID not available — check runtime');
  }
  return crypto.randomUUID();
}
```

- [ ] **Step 2: Verificar que compile**

Run: `npm run build 2>&1 | grep -E "(error|Error)" | head -20`
Expected: sin errores relacionados a `lib/meta-event-id.ts`.

### Task 1.2: Helpers de cookies server-side

**Files:**
- Create: `lib/meta-cookies.ts`

- [ ] **Step 1: Crear el archivo**

```ts
// lib/meta-cookies.ts
import { cookies } from 'next/headers';

/**
 * Lee la cookie _fbp (Meta Pixel browser cookie).
 * La setea el pixel automáticamente la primera vez que corre en el browser.
 * Devuelve undefined si no está presente.
 */
export async function getFbp(): Promise<string | undefined> {
  const store = await cookies();
  return store.get('_fbp')?.value;
}

/**
 * Lee la cookie _fbc (Meta Pixel click ID cookie).
 * La setea el middleware cuando detecta ?fbclid= en una request.
 * Formato: fb.1.{timestamp_ms}.{fbclid}.
 */
export async function getFbc(): Promise<string | undefined> {
  const store = await cookies();
  return store.get('_fbc')?.value;
}
```

- [ ] **Step 2: Verificar que compile**

Run: `npm run build 2>&1 | tail -20`
Expected: sin errores.

### Task 1.3: Servicio CAPI principal

**Files:**
- Create: `lib/meta-capi.ts`

- [ ] **Step 1: Crear el archivo**

```ts
// lib/meta-capi.ts
import { createHash } from 'node:crypto';
import { headers } from 'next/headers';
import { getFbp, getFbc } from '@/lib/meta-cookies';

const GRAPH_API_URL = 'https://graph.facebook.com/v21.0';

export type MetaEventName = 'ViewContent' | 'InitiateCheckout' | 'Lead' | 'Purchase';

export interface MetaEventInput {
  eventName: MetaEventName;
  eventId: string;
  eventSourceUrl: string;
  phone?: string;
  nombreCompleto?: string;
  value?: number;
  currency?: 'PYG';
}

function hashForMeta(value: string): string {
  return createHash('sha256').update(value.trim().toLowerCase()).digest('hex');
}

function formatPhoneForMeta(phone: string): string {
  return phone.replace(/\D/g, '');
}

async function buildUserData(input: MetaEventInput) {
  const hdrs = await headers();
  const [fbp, fbc] = await Promise.all([getFbp(), getFbc()]);

  // x-forwarded-for puede venir como "client, proxy1, proxy2" — tomar el primero
  const xff = hdrs.get('x-forwarded-for') || '';
  const clientIp = xff.split(',')[0].trim() || hdrs.get('x-real-ip') || undefined;
  const userAgent = hdrs.get('user-agent') || undefined;

  const userData: Record<string, unknown> = {
    country: [hashForMeta('py')],
  };

  if (input.phone) {
    userData.ph = [hashForMeta(formatPhoneForMeta(input.phone))];
  }
  if (input.nombreCompleto) {
    userData.fn = [hashForMeta(input.nombreCompleto)];
  }
  if (fbp) userData.fbp = fbp;
  if (fbc) userData.fbc = fbc;
  if (clientIp) userData.client_ip_address = clientIp;
  if (userAgent) userData.client_user_agent = userAgent;

  return userData;
}

/**
 * Envía un evento server-side a Meta Conversions API.
 * No-op silencioso si META_PIXEL_ID o META_CAPI_ACCESS_TOKEN no están seteados.
 * NO bloquea el flow del caller — envolver en Promise.allSettled si se llama
 * desde una server action.
 */
export async function sendMetaEvent(input: MetaEventInput): Promise<void> {
  const pixelId = process.env.NEXT_PUBLIC_META_PIXEL_ID;
  const capiToken = process.env.META_CAPI_ACCESS_TOKEN;
  const testEventCode = process.env.META_TEST_EVENT_CODE;

  if (!pixelId || !capiToken) return;

  const userData = await buildUserData(input);

  const eventData: Record<string, unknown> = {
    event_name: input.eventName,
    event_time: Math.floor(Date.now() / 1000),
    event_id: input.eventId,
    event_source_url: input.eventSourceUrl,
    action_source: 'website',
    user_data: userData,
  };

  if (input.value !== undefined) {
    eventData.custom_data = {
      value: input.value,
      currency: input.currency || 'PYG',
    };
  }

  const body: Record<string, unknown> = {
    data: [eventData],
    access_token: capiToken,
  };

  if (testEventCode) {
    body.test_event_code = testEventCode;
    console.log(`[meta-capi] sending ${input.eventName} with test_event_code=${testEventCode}`);
  }

  try {
    const response = await fetch(`${GRAPH_API_URL}/${pixelId}/events`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[meta-capi] ${input.eventName} HTTP ${response.status}: ${errorText}`);
      return;
    }

    const result = await response.json();
    if (result.events_received !== 1) {
      console.warn(`[meta-capi] ${input.eventName} unexpected response:`, result);
    }
  } catch (err) {
    console.error(`[meta-capi] ${input.eventName} network error:`, err);
  }
}
```

- [ ] **Step 2: Verificar que compile**

Run: `npm run build 2>&1 | tail -20`
Expected: sin errores de TypeScript. Puede fallar por env vars faltantes en build — ese caso es esperado, solo chequear que no haya errores de tipo en `lib/meta-capi.ts`.

### Task 1.4: Helpers client-side de pixel

**Files:**
- Create: `lib/pixel.ts`

- [ ] **Step 1: Crear el archivo**

```ts
// lib/pixel.ts
// Client-only helpers para disparar eventos al Meta Pixel.
// Todos los helpers son no-op silenciosos si fbq no está disponible
// (pixel bloqueado por adblock, todavía no cargado, SSR, etc.).

type FbqFn = (
  command: 'track' | 'init',
  eventName: string,
  params?: Record<string, unknown>,
  options?: { eventID?: string },
) => void;

declare global {
  interface Window {
    fbq?: FbqFn;
  }
}

function fire(
  eventName: string,
  params: Record<string, unknown>,
  eventId: string,
): void {
  if (typeof window === 'undefined' || !window.fbq) return;
  window.fbq('track', eventName, params, { eventID: eventId });
}

export function trackViewContent(opts: { eventId: string }): void {
  fire('ViewContent', {}, opts.eventId);
}

export function trackInitiateCheckout(opts: {
  eventId: string;
  value: number;
  currency?: 'PYG';
}): void {
  fire(
    'InitiateCheckout',
    { value: opts.value, currency: opts.currency || 'PYG' },
    opts.eventId,
  );
}

export function trackLead(opts: { eventId: string }): void {
  fire('Lead', {}, opts.eventId);
}

export function trackPurchase(opts: {
  eventId: string;
  value: number;
  currency?: 'PYG';
}): void {
  fire(
    'Purchase',
    { value: opts.value, currency: opts.currency || 'PYG' },
    opts.eventId,
  );
}
```

- [ ] **Step 2: Verificar que compile**

Run: `npm run build 2>&1 | tail -20`
Expected: sin errores.

### Task 1.5: Commit chunk 1

- [ ] **Step 1: Stage + commit**

```bash
cd autolandia-web
git add lib/meta-event-id.ts lib/meta-cookies.ts lib/meta-capi.ts lib/pixel.ts
git commit -m "$(cat <<'EOF'
feat(web): agregar servicios Meta CAPI + pixel helpers

Lib sin dependencias de UI: sendMetaEvent server-side portado del bot
con action_source='website' + enriquecimiento con fbp/fbc/ip/ua.
Helpers client-side tipados para disparar pixel con eventID de dedup.
Todavía sin uso — se cablean en chunks siguientes.
EOF
)"
```

---

## Chunk 2: Pixel injection + middleware + Dockerfile

Infraestructura que permite que el pixel cargue en el browser y que `_fbc` se setee cuando viene `?fbclid=`. Afecta el HTML de todas las páginas.

### Task 2.1: Componente MetaPixel

**Files:**
- Create: `components/MetaPixel.tsx`

- [ ] **Step 1: Crear el archivo**

```tsx
// components/MetaPixel.tsx
'use client';

import Script from 'next/script';

const PIXEL_ID = process.env.NEXT_PUBLIC_META_PIXEL_ID;

export function MetaPixel() {
  if (!PIXEL_ID) return null;

  return (
    <>
      <Script id="meta-pixel" strategy="afterInteractive">
        {`
          !function(f,b,e,v,n,t,s)
          {if(f.fbq)return;n=f.fbq=function(){n.callMethod?
          n.callMethod.apply(n,arguments):n.queue.push(arguments)};
          if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
          n.queue=[];t=b.createElement(e);t.async=!0;
          t.src=v;s=b.getElementsByTagName(e)[0];
          s.parentNode.insertBefore(t,s)}(window, document,'script',
          'https://connect.facebook.net/en_US/fbevents.js');
          fbq('init', '${PIXEL_ID}');
          fbq('track', 'PageView');
        `}
      </Script>
      <noscript>
        <img
          height="1"
          width="1"
          style={{ display: 'none' }}
          src={`https://www.facebook.com/tr?id=${PIXEL_ID}&ev=PageView&noscript=1`}
          alt=""
        />
      </noscript>
    </>
  );
}
```

- [ ] **Step 2: Verificar que compile**

Run: `npm run build 2>&1 | tail -20`
Expected: sin errores.

### Task 2.2: Montar MetaPixel en layout root

**Files:**
- Modify: `app/layout.tsx`

- [ ] **Step 1: Agregar import y montaje**

En `app/layout.tsx`:
1. Agregar `import { MetaPixel } from '@/components/MetaPixel';` junto a los imports.
2. Dentro del `<body>`, antes de `{children}`, agregar `<MetaPixel />`.

El `<body>` debe quedar:
```tsx
<body className={`${inter.className} bg-[#0a0a0f] text-white min-h-screen antialiased`}>
  <MetaPixel />
  {children}
</body>
```

- [ ] **Step 2: Verificar que compile**

Run: `npm run build 2>&1 | tail -20`
Expected: sin errores.

### Task 2.3: Middleware para cookie _fbc

**Files:**
- Create: `middleware.ts` (raíz del repo, NO dentro de app/)

- [ ] **Step 1: Crear el archivo**

```ts
// middleware.ts
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const FBC_MAX_AGE_SECONDS = 60 * 60 * 24 * 90; // 90 días (convención Meta)

export function middleware(request: NextRequest) {
  const response = NextResponse.next();

  const fbclid = request.nextUrl.searchParams.get('fbclid');
  if (fbclid) {
    const existing = request.cookies.get('_fbc')?.value;
    const expectedValue = `fb.1.${Date.now()}.${fbclid}`;
    // Solo setear si no existe o el fbclid cambió
    if (!existing || !existing.endsWith(`.${fbclid}`)) {
      response.cookies.set('_fbc', expectedValue, {
        maxAge: FBC_MAX_AGE_SECONDS,
        sameSite: 'lax',
        path: '/',
      });
    }
  }

  return response;
}

export const config = {
  // Matcher de middleware Next.js: corre en todas las rutas excepto las listadas.
  // Usamos negative lookahead (?!...) al inicio del primer segmento del path
  // para excluir /admin/* (auth admin usa cookie TOTP, no middleware), /api/*,
  // y assets estáticos de Next. Todo lo demás (landing, /checkout, /login, /mis-boletos)
  // pasa por el middleware y recibe la cookie _fbc si hay ?fbclid=.
  matcher: [
    '/((?!admin|api|_next/static|_next/image|favicon.ico|robots.txt).*)',
  ],
};
```

- [ ] **Step 2: Verificar que compile**

Run: `npm run build 2>&1 | tail -20`
Expected: sin errores. Next 16 reconoce `middleware.ts` en la raíz automáticamente.

### Task 2.4: Agregar NEXT_PUBLIC_META_PIXEL_ID al Dockerfile DEV

**Files:**
- Modify: `Dockerfile` (en develop)

- [ ] **Step 1: Agregar la línea**

En el bloque ENV del Stage 2 (builder), después de `ENV NEXT_PUBLIC_SUPABASE_ANON_KEY=...` y antes de `ENV NEXT_TELEMETRY_DISABLED=1`, agregar:

```dockerfile
ENV NEXT_PUBLIC_META_PIXEL_ID=2028015634434230
```

El bloque queda:
```dockerfile
ENV NEXT_PUBLIC_SUPABASE_URL=https://jyytukfcnembucompttu.supabase.co
ENV NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
ENV NEXT_PUBLIC_META_PIXEL_ID=2028015634434230
ENV NEXT_TELEMETRY_DISABLED=1
```

- [ ] **Step 2: Verificar build local**

Run: `NEXT_PUBLIC_META_PIXEL_ID=2028015634434230 npm run build 2>&1 | tail -20`
Expected: build exitoso.

### Task 2.5: Commit chunk 2

- [ ] **Step 1: Stage + commit**

```bash
git add components/MetaPixel.tsx app/layout.tsx middleware.ts Dockerfile
git commit -m "$(cat <<'EOF'
feat(web): montar Meta Pixel + middleware para cookie _fbc

Pixel carga via next/script strategy afterInteractive en el layout root,
dispara PageView automático. Middleware nuevo detecta ?fbclid= y setea
cookie first-party _fbc con formato Meta (fb.1.{ts}.{fbclid}, 90 días).
Dockerfile DEV baked con el Pixel ID.

Todavía sin eventos de conversión — se cablean en chunk 3.
EOF
)"
```

---

## Chunk 3: Server actions integrations (CAPI side)

Extender las 4 server actions existentes + crear una nueva (ViewContent) para disparar CAPI en cada punto del funnel. Cada una envuelve `sendMetaEvent` en `Promise.allSettled` para no bloquear el flow principal si Meta falla.

### Task 3.1: Server action nueva para ViewContent

**Files:**
- Create: `app/actions/view-content.ts`

- [ ] **Step 1: Crear el archivo**

```ts
// app/actions/view-content.ts
'use server';

import { sendMetaEvent } from '@/lib/meta-capi';

/**
 * Dispara ViewContent CAPI desde el cliente fire-and-forget.
 * Client fire pixel inmediatamente con el mismo eventId → dedup.
 * No retorna valor (fire-and-forget).
 */
export async function viewContentServer(
  eventId: string,
  pathname: string,
): Promise<void> {
  const eventSourceUrl = `https://autolandia.com.py${pathname}`;
  await Promise.allSettled([
    sendMetaEvent({
      eventName: 'ViewContent',
      eventId,
      eventSourceUrl,
    }),
  ]);
}
```

- [ ] **Step 2: Verificar que compile**

Run: `npm run build 2>&1 | tail -20`
Expected: sin errores.

### Task 3.2: Extender trackLeadCompleted para CAPI Lead

**Files:**
- Modify: `app/actions/auth-otp.ts`

- [ ] **Step 1: Agregar import al top del archivo**

Junto con los demás imports:
```ts
import { sendMetaEvent } from '@/lib/meta-capi';
```

- [ ] **Step 2: Modificar signature de trackLeadCompleted**

Cambiar la firma (línea ~142):
```ts
export async function trackLeadCompleted(
  telefono: string,
  nombre: string,
  ci: string,
  eventId?: string,
): Promise<{ success: boolean }> {
```

- [ ] **Step 3: Agregar CAPI call dentro de la rama "primera vez"**

En el bloque donde ya se hace `appendLeadToSheets` + set del flag `sheet_registered` (líneas ~164-179), agregar la llamada a `sendMetaEvent` **antes** de setear el flag.

La rama queda:
```ts
  // 3. Registrar en Google Sheets + notificar Telegram (ambos async, non-blocking)
  const leadRow = {
    fecha: new Date().toLocaleString('sv-SE', { timeZone: 'America/Asuncion' }),
    telefono: cleanPhone,
    nombreCompleto: nombre,
    ci,
    canal: 'WEB',
    stage: 'NUEVO',
  };

  await appendLeadToSheets(leadRow);

  // 3b. CAPI Lead (fire-and-forget, solo primera vez)
  if (eventId) {
    await Promise.allSettled([
      sendMetaEvent({
        eventName: 'Lead',
        eventId,
        eventSourceUrl: 'https://autolandia.com.py/login',
        phone: cleanPhone,
        nombreCompleto: nombre,
      }),
    ]);
  }

  // 4. Marcar el flag para no re-registrar
  await supabase.auth.admin.updateUserById(user.id, {
    user_metadata: { ...user.user_metadata, sheet_registered: true },
  });
```

- [ ] **Step 4: Verificar que compile**

Run: `npm run build 2>&1 | tail -20`
Expected: sin errores.

### Task 3.3: Extender reserveNumbers para CAPI InitiateCheckout

**Files:**
- Modify: `app/actions/reserve-numbers.ts`

**Contexto del código actual** (verificado al escribir el plan):

```ts
export async function reserveNumbers(numbers: number[]): Promise<{ success: boolean; failed: number[] }>
```

La función recibe un `number[]` plano — no sabe del pack ni del teléfono. Para CAPI necesitamos `phone` y `value`. Solución: segundo parámetro opcional `meta?` que mantiene backward compat con cualquier call site existente.

- [ ] **Step 1: Buscar todos los call sites del action**

Run: `grep -rn "reserveNumbers" app/ components/`
Expected: uno o más call sites (al menos en `components/checkout/StepNumbers.tsx` o similar). Anotar cada uno para adaptarlo si hace falta.

- [ ] **Step 2: Agregar import**

```ts
import { sendMetaEvent } from '@/lib/meta-capi';
```

- [ ] **Step 3: Cambiar signature a options object (backward compatible)**

```ts
export async function reserveNumbers(
  numbers: number[],
  meta?: { eventId: string; phone: string; value: number },
): Promise<{ success: boolean; failed: number[] }> {
```

- [ ] **Step 4: Disparar CAPI después de que el loop de reservas termine con éxito**

Inmediatamente antes del `return { success: failed.length === 0, failed }`:

```ts
if (meta && failed.length === 0) {
  await Promise.allSettled([
    sendMetaEvent({
      eventName: 'InitiateCheckout',
      eventId: meta.eventId,
      eventSourceUrl: 'https://autolandia.com.py/checkout',
      phone: meta.phone,
      value: meta.value,
      currency: 'PYG',
    }),
  ]);
}
```

**Decisión sobre `value`**: usar el **precio total del pack seleccionado** (`state.price` en `app/checkout/page.tsx:30`, que viene del query param `?price=20000` del landing). No calcular `cantidad * PRECIO_BASE` — los packs tienen precios fijos que NO son proporcionales (ej: pack 3 por 50k ≠ 3 × 20k). Ver `lib/constants.ts` > `PACKS_NORMALES` para los valores fijos.

- [ ] **Step 5: Verificar que compile**

Run: `npm run build 2>&1 | tail -20`
Expected: sin errores. Los call sites existentes siguen funcionando porque `meta` es opcional.

### Task 3.4: Extender registerSale para CAPI Purchase + retornar event_id

**Files:**
- Modify: `app/actions/register-sale.ts`

- [ ] **Step 1: Leer estructura actual del action**

Run: `head -100 app/actions/register-sale.ts`

Identificar:
- Cómo se llama al return final (probablemente `{ ok: true, ticket_id, ... }`)
- Dónde se obtiene el `venta_id` (UUID retornado por `registrar_venta_web` RPC)
- Dónde está el `monto` / `telefono` / `nombre`

- [ ] **Step 2: Agregar import**

```ts
import { sendMetaEvent } from '@/lib/meta-capi';
```

- [ ] **Step 3: Disparar CAPI Purchase después del registrar_venta_web exitoso**

Justo después de que `registrar_venta_web` haya retornado OK y antes del return final:

```ts
await Promise.allSettled([
  sendMetaEvent({
    eventName: 'Purchase',
    eventId: ventaId, // UUID retornado por registrar_venta_web
    eventSourceUrl: 'https://autolandia.com.py/checkout',
    phone: input.telefono,
    nombreCompleto: input.nombre,
    value: input.monto,
    currency: 'PYG',
  }),
]);
```

- [ ] **Step 4: Agregar event_id al return**

Modificar el return final para incluir `event_id: ventaId`:

```ts
return {
  ok: true,
  ticket_id,
  event_id: ventaId, // <- nuevo
  // ...resto de campos existentes
};
```

- [ ] **Step 5: Verificar que compile**

Run: `npm run build 2>&1 | tail -20`
Expected: sin errores.

### Task 3.5: Commit chunk 3

- [ ] **Step 1: Stage + commit**

```bash
git add app/actions/view-content.ts app/actions/auth-otp.ts app/actions/reserve-numbers.ts app/actions/register-sale.ts
git commit -m "$(cat <<'EOF'
feat(web): disparar eventos Meta CAPI desde server actions

- ViewContent: server action nueva fire-and-forget
- Lead: extendido trackLeadCompleted, dispara solo en la rama "primera vez"
  (respeta idempotencia de sheet_registered)
- InitiateCheckout: reserveNumbers acepta eventId y dispara con value+PYG
- Purchase: registerSale dispara con ventas.id como eventId y retorna event_id
  al cliente para que dispare el pixel con mismo ID

Todos envuelven sendMetaEvent en Promise.allSettled — no bloquean flow si
Meta falla. Client-side pixel fires se cablean en chunk 4.
EOF
)"
```

---

## Chunk 4: Client-side pixel fires

Disparar pixel client-side con el mismo event_id que va a CAPI. Patrón: client genera UUID (o recibe `event_id` del server para Purchase), fires pixel inmediatamente (sincrónico), llama server action con el mismo ID.

### Task 4.1: Fire ViewContent en landing

**Files:**
- Modify: `app/page.tsx`

- [ ] **Step 1: Leer la estructura actual**

Run: `head -30 app/page.tsx`

Identificar si es server component o client component. Si es server: crear un client component wrapper para el fire del pixel.

- [ ] **Step 2: Crear el tracker (genérico, reusable en landing + checkout)**

Create: `components/MetaPixelTracker.tsx` (no va en `landing/` porque se usa desde múltiples páginas).

```tsx
'use client';

import { useEffect, useRef } from 'react';
import { generateEventId } from '@/lib/meta-event-id';
import { trackViewContent } from '@/lib/pixel';
import { viewContentServer } from '@/app/actions/view-content';

export function MetaPixelTracker({ pathname }: { pathname: string }) {
  const firedRef = useRef(false);

  useEffect(() => {
    if (firedRef.current) return;
    firedRef.current = true;

    const eventId = generateEventId();
    trackViewContent({ eventId });
    viewContentServer(eventId, pathname).catch(console.error);
  }, [pathname]);

  return null;
}
```

- [ ] **Step 3: Montar en el landing**

En `app/page.tsx`, importar y montar `<MetaPixelTracker pathname="/" />` al inicio del JSX returned.

- [ ] **Step 4: Verificar que compile**

Run: `npm run build 2>&1 | tail -20`
Expected: sin errores.

### Task 4.2: Fire ViewContent en checkout

**Files:**
- Modify: `app/checkout/page.tsx`

- [ ] **Step 1: Montar el tracker genérico**

`app/checkout/page.tsx` ya es client component (`'use client'` en línea 1). Importar `MetaPixelTracker` y montarlo al inicio del JSX de `CheckoutContent`:

```tsx
import { MetaPixelTracker } from '@/components/MetaPixelTracker';

// dentro del return del componente, como primer hijo:
return (
  <main className="min-h-screen pb-12">
    <MetaPixelTracker pathname="/checkout" />
    {/* ...resto del JSX existente */}
  </main>
);
```

El `useRef` interno del tracker evita doble fire en React StrictMode dev.

- [ ] **Step 2: Verificar que compile**

Run: `npm run build 2>&1 | tail -20`
Expected: sin errores.

### Task 4.3: Fire InitiateCheckout en click "Reservar"

**Files:**
- Modify: `app/checkout/page.tsx` (o el componente client que maneja la reserva)

- [ ] **Step 1: Localizar el handler de reserva**

Run: `grep -n "reserveNumbers\|handleReserve\|handleSubmit" app/checkout/page.tsx`

- [ ] **Step 2: Envolver la llamada con fire del pixel**

Antes de `await reserveNumbers(...)`:

```ts
import { generateEventId } from '@/lib/meta-event-id';
import { trackInitiateCheckout } from '@/lib/pixel';

// dentro del handler:
const eventId = generateEventId();
const value = pack.monto; // o el valor real del pack seleccionado
trackInitiateCheckout({ eventId, value, currency: 'PYG' });

const result = await reserveNumbers({
  ...existingArgs,
  eventId,
});
```

- [ ] **Step 3: Verificar que compile**

Run: `npm run build 2>&1 | tail -20`
Expected: sin errores.

### Task 4.4: Fire Lead en login/handleSaveProfile

**Files:**
- Modify: `app/login/page.tsx`

- [ ] **Step 1: Agregar imports**

```ts
import { generateEventId } from '@/lib/meta-event-id';
import { trackLead } from '@/lib/pixel';
```

- [ ] **Step 2: Modificar handleSaveProfile**

En la función `handleSaveProfile`, entre el `updateUser` exitoso y la llamada a `trackLeadCompleted` (línea ~131), insertar el pixel fire:

```ts
    if (error) {
      setError('Error guardando tus datos: ' + error.message);
      setLoading(false);
      return;
    }

    // 2. Track lead en Google Sheets + Telegram + Meta CAPI (server action, non-blocking)
    const phone = normalizePhone(telefono).replace('+', '');
    const eventId = generateEventId();
    trackLead({ eventId }); // pixel client fire inmediato
    trackLeadCompleted(phone, nombre.trim(), ci.trim(), eventId).catch(console.error);

    router.push('/mis-boletos');
```

- [ ] **Step 3: Verificar que compile**

Run: `npm run build 2>&1 | tail -20`
Expected: sin errores.

### Task 4.5: Fire Purchase después de success

**Files:**
- Modify: `app/checkout/page.tsx`

**Contexto** (verificado): el handler `handlePaymentComplete` en líneas 82-112 llama `await registerSale({...})` en línea 87, recibe `result` con `{ticketId, numerosAsignados}`, y hace `setState({step: 4, ...})` en línea 100 para ir al success screen. Ahí es donde se dispara Purchase — entre el `await` y el `setState`.

- [ ] **Step 1: Agregar import**

```ts
import { trackPurchase } from '@/lib/pixel';
```

- [ ] **Step 2: Fire pixel entre el registerSale y el setState a step 4**

Modificar `handlePaymentComplete` (líneas 82-112) para que después del `const result = await registerSale({...})` y antes del `setState((prev) => ({...prev, step: 4, ...}))`, quede:

```ts
const result = await registerSale({
  cantidad: state.qty,
  // ...resto de campos existentes
});

// Fire Purchase pixel con event_id retornado por el server
if (result.event_id) {
  trackPurchase({
    eventId: result.event_id,
    value: state.price,
    currency: 'PYG',
  });
}

setState((prev) => ({
  ...prev,
  step: 4,
  ticketId: result.ticketId,
  numerosAsignados: result.numerosAsignados,
  receiptUrl,
}));
```

`fbq('track', ...)` es sincrónico (agrega al queue local del pixel y drena en background). No hay que hacer `await` — el `setState` inmediatamente después no interrumpe el drenaje.

- [ ] **Step 3: Asegurar que el tipo de `result` incluye `event_id`**

El return de `registerSale` se extendió en Task 3.4 para incluir `event_id: ventaId`. Si TypeScript se queja de "property 'event_id' does not exist", verificar que el archivo modificado en Task 3.4 también exporte el tipo actualizado (o usar `result.event_id` con non-null assertion si el tipo no es estricto).

- [ ] **Step 4: Verificar que compile**

Run: `npm run build 2>&1 | tail -20`
Expected: sin errores.

### Task 4.6: Commit chunk 4

- [ ] **Step 1: Stage + commit**

```bash
git add app/page.tsx app/checkout/page.tsx app/login/page.tsx components/MetaPixelTracker.tsx
git commit -m "$(cat <<'EOF'
feat(web): disparar Meta Pixel client-side con dedup event_id

- ViewContent: MetaPixelTracker component en landing + checkout (useEffect+ref)
- InitiateCheckout: fire pre-reserve con value + currency=PYG
- Lead: fire post-updateUser, antes del trackLeadCompleted server action
- Purchase: fire con event_id devuelto por registerSale (usa ventas.id)

Cada evento dispara pixel INMEDIATAMENTE (sincrónico en fbq queue) y
server action CAPI con mismo eventId — Meta dedupe automáticamente.
EOF
)"
```

---

## Chunk 5: Privacy policy + Footer

Página `/privacidad` linkeada desde el footer del landing solamente. Copy neutro sin mencionar rifas.

### Task 5.1: Crear componente Footer

**Files:**
- Create: `components/landing/Footer.tsx`

- [ ] **Step 1: Crear el archivo**

```tsx
// components/landing/Footer.tsx
import Link from 'next/link';

export function Footer() {
  return (
    <footer className="mt-16 border-t border-white/10 py-6 px-4">
      <div className="max-w-4xl mx-auto flex flex-col sm:flex-row justify-between items-center gap-2 text-xs text-white/40">
        <span>© 2026 Autolandia</span>
        <Link href="/privacidad" className="hover:text-white/70 transition-colors">
          Política de privacidad
        </Link>
      </div>
    </footer>
  );
}
```

- [ ] **Step 2: Verificar que compile**

Run: `npm run build 2>&1 | tail -20`
Expected: sin errores.

### Task 5.2: Crear página /privacidad

**Files:**
- Create: `app/privacidad/page.tsx`

- [ ] **Step 1: Crear el archivo**

```tsx
// app/privacidad/page.tsx
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Política de privacidad — Autolandia',
  description: 'Cómo tratamos tus datos en Autolandia.',
  robots: { index: false, follow: false },
};

export default function PrivacidadPage() {
  return (
    <main className="min-h-screen px-4 py-12">
      <article className="max-w-3xl mx-auto prose prose-invert">
        <h1>Política de privacidad</h1>

        <p className="text-white/60">
          Última actualización: 22 de abril de 2026
        </p>

        <h2>1. Datos que recolectamos</h2>
        <p>
          Al usar Autolandia, recolectamos los siguientes datos:
        </p>
        <ul>
          <li>Número de teléfono (para verificación por OTP y contacto sobre tu pedido).</li>
          <li>Nombre completo y número de Cédula de Identidad.</li>
          <li>Datos del comprobante de pago: número de cuenta de origen, imagen del comprobante.</li>
          <li>Dirección IP y datos del navegador (user agent).</li>
          <li>Cookies de sesión e identificadores de navegador para publicidad (pixel de Meta).</li>
        </ul>

        <h2>2. Para qué los usamos</h2>
        <ul>
          <li>Procesar y confirmar tu compra.</li>
          <li>Contactarte sobre el estado de tu pedido.</li>
          <li>Prevenir fraude y validar comprobantes.</li>
          <li>Mejorar la experiencia de navegación.</li>
          <li>Medir el rendimiento de nuestras campañas publicitarias.</li>
        </ul>

        <h2>3. Con quién compartimos</h2>
        <p>
          No vendemos tus datos. Compartimos información estrictamente necesaria con:
        </p>
        <ul>
          <li><strong>Meta Platforms Inc.</strong> (pixel de Facebook/Instagram) para medir el rendimiento de anuncios. Los datos se envían hasheados (SHA-256) cuando es posible.</li>
          <li><strong>Twilio Inc.</strong> para enviar códigos de verificación por SMS.</li>
          <li><strong>Google LLC</strong> (Google Sheets) como registro interno de operaciones.</li>
          <li><strong>Supabase</strong> como proveedor de base de datos.</li>
        </ul>

        <h2>4. Cookies y tecnologías de seguimiento</h2>
        <p>
          Usamos cookies para mantener tu sesión activa y para medir el rendimiento de nuestra publicidad (pixel de Meta). Podés borrar las cookies desde la configuración de tu navegador. Tené en cuenta que esto puede afectar tu experiencia en el sitio.
        </p>

        <h2>5. Tus derechos</h2>
        <p>
          Podés solicitar acceso, rectificación o eliminación de tus datos enviándonos un mensaje al contacto indicado abajo.
        </p>

        <h2>6. Retención</h2>
        <p>
          Mantenemos tus datos mientras dure el evento asociado a tu compra y hasta seis (6) meses posteriores, salvo que la ley nos exija conservarlos por más tiempo.
        </p>

        <h2>7. Contacto</h2>
        <p>
          Para ejercer tus derechos o consultas sobre privacidad:
        </p>
        <ul>
          <li>Email: <a href="mailto:CONTACTO_EMAIL@autolandia.com.py">CONTACTO_EMAIL@autolandia.com.py</a> (Paul completa antes del deploy)</li>
          <li>Teléfono: CONTACTO_TELEFONO (Paul completa antes del deploy)</li>
        </ul>
      </article>
    </main>
  );
}
```

**Nota**: los placeholders `CONTACTO_EMAIL` y `CONTACTO_TELEFONO` los reemplaza Paul con los datos reales antes del deploy a PROD. El deploy a DEV se puede hacer con los placeholders.

- [ ] **Step 2: Verificar que compile**

Run: `npm run build 2>&1 | tail -20`
Expected: sin errores.

### Task 5.3: Montar Footer en landing

**Files:**
- Modify: `app/page.tsx`

- [ ] **Step 1: Importar Footer**

```ts
import { Footer } from '@/components/landing/Footer';
```

- [ ] **Step 2: Montar al final del JSX del landing**

Agregar `<Footer />` como último elemento del layout (antes de cerrar el wrapper principal).

- [ ] **Step 3: Verificar que compile**

Run: `npm run build 2>&1 | tail -20`
Expected: sin errores.

### Task 5.4: Commit chunk 5

- [ ] **Step 1: Stage + commit**

```bash
git add components/landing/Footer.tsx app/privacidad/page.tsx app/page.tsx
git commit -m "$(cat <<'EOF'
feat(web): pagina /privacidad + footer en landing

Requerido por Meta para pautar anuncios con destino website. Copy neutro
estilo e-commerce, menciona pixel de Meta y Twilio para transparencia.
Cero menciones de "rifa", "sorteo", "juego de azar" — evita disparar
clasificación gambling en review de anuncios.

Link visible solo en footer del landing (no en el resto de paginas,
pedido del cliente). Contacto email/telefono placeholder — Paul completa
antes del deploy a PROD.

metadata.robots=noindex para evitar que Google la posicione sobre la home.
EOF
)"
```

---

## Chunk 6: Copy audit

Scan de palabras riesgosas + entrega de tabla al cliente + aplicación de cambios aprobados caso por caso.

### Task 6.1: Scan de palabras riesgosas

**Files:** read-only — grep en landing, componentes, checkout, constants, metadata.

- [ ] **Step 1: Buscar ocurrencias usando la herramienta Grep**

Ejecutar (con la tool Grep de Claude Code, o con `rg` / `grep -rn` si se corre manualmente):

Patrones a buscar (case-insensitive):
- `rifa|rifas|rifar|rifaste`
- `loteri|loto`
- `apuesta|apostar|apuest`
- `azar`
- `casino|jackpot`
- `ganar dinero|premio en efectivo`
- `probabilidad`

Scope de archivos (más amplio que el primer draft):
- `app/page.tsx`
- `app/checkout/page.tsx`
- `app/login/page.tsx`
- `app/layout.tsx`
- `app/mis-boletos/page.tsx` (por si tiene copy visible)
- `components/landing/**/*`
- `components/checkout/**/*`
- `lib/constants.ts`
- cualquier otro archivo `lib/*.ts` con strings de display

Agregar los hallazgos a un archivo temporal `docs/superpowers/specs/2026-04-22-copy-audit-resultado.md` (NO commitear todavía).

- [ ] **Step 2: Armar tabla markdown**

Estructurar hallazgos en `docs/superpowers/specs/2026-04-22-copy-audit-resultado.md`:

```markdown
# Copy audit — resultados

| Archivo:línea | Texto actual | Sugerencia de reemplazo |
|---|---|---|
| `app/page.tsx:XX` | "..." | "..." |
| ... | ... | ... |
```

Sugerencias de reemplazo:
- "rifa" → "sorteo promocional"
- "lotería" → eliminar la referencia completa
- "apostá" → "participá"
- "juego de azar" → "sorteo" o eliminar
- "ganá dinero" → "ganá un premio"

### Task 6.2: Presentar al cliente

- [ ] **Step 1: Mostrar la tabla al usuario y esperar aprobación caso por caso.**

El usuario debe marcar cuáles cambios aprueba y cuáles rechaza. Sin aprobación, NO se tocan líneas.

### Task 6.3: Aplicar cambios aprobados

- [ ] **Step 1: Aplicar solo los cambios aprobados.**

Editar solo las líneas aprobadas por el usuario. Dejar el resto intacto.

- [ ] **Step 2: Verificar que compile**

Run: `npm run build 2>&1 | tail -20`
Expected: sin errores.

### Task 6.4: Commit chunk 6

- [ ] **Step 1: Stage + commit en commit separado**

```bash
git add app/page.tsx components/landing/ app/checkout/ lib/constants.ts app/layout.tsx
git commit -m "$(cat <<'EOF'
chore(web): copy audit aprobado por cliente

Reemplazos de palabras riesgosas para evitar clasificación gambling de
Meta en review de anuncios con destino web. Cambios aprobados uno por uno
por Paul. Ver docs/superpowers/specs/2026-04-22-copy-audit-resultado.md
para lista completa.
EOF
)"
```

- [ ] **Step 2: Commitear también la tabla de resultados**

```bash
git add docs/superpowers/specs/2026-04-22-copy-audit-resultado.md
git commit -m "docs(web): resultado del copy audit previo a Meta ads"
```

---

## Chunk 7: Deploy + QA

Push a develop → Easypanel DEV redeploya → configurar env vars runtime → QA en Events Manager con test_event_code → remover test code → cherry-pick a main → configurar env vars PROD → verificar en vivo.

### Task 7.1: Push a develop

- [ ] **Step 1:**

```bash
git push origin develop
```

Expected: push exitoso. Easypanel DEV detecta el push y arranca rebuild automático.

### Task 7.2: Configurar env vars en Easypanel DEV (manual)

- [ ] **Step 1: Informar al usuario que debe hacer los siguientes pasos manualmente:**

1. Entrar a Easypanel DEV → app `autolandia-web` → pestaña **Environment**.
2. Agregar:
   - `META_CAPI_ACCESS_TOKEN` con el mismo valor que está configurado en el bot.
   - `META_TEST_EVENT_CODE` con el valor generado en Meta Events Manager → Test Events → "Set up event".
3. Clickear **Save** y después **Deploy** (para que el container tome las nuevas env vars en runtime).

### Task 7.3: Generar META_TEST_EVENT_CODE

- [ ] **Step 1: Informar al usuario:**

1. Entrar a Meta Events Manager (`business.facebook.com/events_manager2/list/dataset/2028015634434230`).
2. Tab **Test events** → sección **Set up** → copiar el `test_event_code` (ej: `TEST12345`).
3. Pegarlo en la env var del punto anterior.

### Task 7.4: QA end-to-end en DEV

- [ ] **Step 1: Abrir DEV URL**

URL: `https://autolandiabot-fulll-autolandia-web.wrkyu1.easypanel.host`

- [ ] **Step 2: Abrir Events Manager → Test Events tab en paralelo**

Los eventos deben aparecer ahí en tiempo real (~5-30 seg de latencia).

- [ ] **Step 3: Navegar landing**

Expected: eventos `PageView` + `ViewContent` en Test Events. Match quality debería aparecer ≥6.

- [ ] **Step 4: Ir a `/checkout`**

Expected: otro `ViewContent`.

- [ ] **Step 5: Seleccionar pack → "Reservar"**

Expected: `InitiateCheckout` con `value` del pack + `currency=PYG`.

- [ ] **Step 6: Completar OTP + perfil (si es primera vez)**

Expected: `Lead` con el nombre + CI.

- [ ] **Step 7: Completar compra de prueba**

Expected: `Purchase` con `value=monto` + `currency=PYG` + `event_id=ventas.id`.

- [ ] **Step 8: Verificar dedup**

En cada evento, Events Manager debe mostrar "Matched" o similar indicando que pixel + CAPI llegaron con mismo event_id. Si muestra "Not matched", chequear en Network tab del browser que el `eventID` en la llamada a `fbevents.js` es el mismo que el `event_id` que se mandó al server action.

- [ ] **Step 9: Verificar `x-forwarded-for`**

Correr `docker logs` en el container DEV buscando algún log del CAPI. Si el log muestra `client_ip_address=172.x.x.x`, significa que x-forwarded-for no viene correcto — ajustar el parse en `lib/meta-capi.ts` para priorizar `x-real-ip` en ese caso.

### Task 7.5: Remover META_TEST_EVENT_CODE de DEV

- [ ] **Step 1: En Easypanel DEV → Environment:**

1. Borrar la env var `META_TEST_EVENT_CODE`.
2. Save + Deploy.
3. Verificar que en Events Manager los eventos siguen llegando pero ahora a la vista principal (no a Test Events).

### Task 7.6: Cherry-pick a main + update Dockerfile PROD

- [ ] **Step 1: Listar commits de feature a llevar a main**

```bash
git log --oneline main..develop
```

Expected: lista de todos los commits de `develop` que no están en `main`. Visualmente identificar los commits de esta feature (chunks 1-6). Anotar sus SHAs en orden cronológico (más viejo primero) para el cherry-pick.

- [ ] **Step 2: Checkout main + cherry-pick**

```bash
git checkout main
git pull origin main
# Cherry-pick commit por commit en orden cronológico
git cherry-pick <hash-chunk1> <hash-chunk2> <hash-chunk3> <hash-chunk4> <hash-chunk5> <hash-chunk6>
```

- [ ] **Step 3: Resolver conflicto en Dockerfile**

El Dockerfile de `main` tiene valores distintos de DEV (supabase URL, anon key PROD). El cherry-pick del commit chunk 2 (Task 2.4) genera conflicto porque el contexto alrededor de la línea agregada difiere.

**Regla crítica**: NO pegar valores PROD desde memoria ni desde el Dockerfile DEV. Abrir el archivo en conflicto y:

1. Dejar todas las líneas `ENV NEXT_PUBLIC_SUPABASE_URL=...` y `ENV NEXT_PUBLIC_SUPABASE_ANON_KEY=...` **exactamente como estaban en main** (lado "HEAD" del conflict marker).
2. Agregar una sola línea nueva: `ENV NEXT_PUBLIC_META_PIXEL_ID=2028015634434230` (mismo valor en DEV y PROD, se reusa el pixel).
3. Borrar los markers de conflicto (`<<<<<<<`, `=======`, `>>>>>>>`).
4. Verificar con `git diff Dockerfile` que el diff sea solo la línea nueva.

```bash
# después de editar y verificar:
git add Dockerfile
git cherry-pick --continue
```

**Verificación defensiva**: antes de push a main, correr `grep NEXT_PUBLIC_SUPABASE Dockerfile` y confirmar que las URLs/keys son las de PROD (`xtwrmcbvjgywwdpdwoxw`), no las de DEV (`jyytukfcnembucompttu`). Si ves `jyytukfcnembucompttu` en el Dockerfile de main, **stop** — abortar el push y rehacer el cherry-pick.

- [ ] **Step 4: Push a main**

```bash
git push origin main
git checkout develop
```

Easypanel PROD detecta el push y rebuildea.

### Task 7.7: Configurar env vars en Easypanel PROD (manual)

- [ ] **Step 1: Informar al usuario:**

1. Easypanel PROD → app `autolandia-web-prod` → pestaña **Environment**.
2. Agregar solo:
   - `META_CAPI_ACCESS_TOKEN` con el mismo valor que DEV (y que bot).
3. **NO agregar `META_TEST_EVENT_CODE`** — PROD debe mandar eventos reales.
4. Save + Deploy.

### Task 7.8: Verificar en PROD

- [ ] **Step 1: Abrir `https://autolandia.com.py`**

- [ ] **Step 2: En Events Manager → Overview (NO Test Events)**

- [ ] **Step 3: Disparar los 4 eventos con teléfono real**

- [ ] **Step 4: Confirmar que llegan al pixel `2028015634434230`**

- [ ] **Step 5: Verificar en Easypanel PROD Environment tab que NO existe `META_TEST_EVENT_CODE`**

Checklist defensivo del spec. Si por error está seteada, borrarla ya.

### Task 7.9: Warmup

- [ ] **Step 1: Dejar pasar 48-72 horas** con tráfico orgánico del bot WhatsApp + SEO + quien entre directo.

Meta necesita ~50 eventos `Purchase` para optimizar campañas con señal decente.

- [ ] **Step 2: Recién entonces, Paul puede crear campañas** con optimización por `Purchase` en Ads Manager.

---

## Criterios de éxito

- [ ] Los 4 eventos llegan a Events Manager en PROD con match quality ≥6/10.
- [ ] Dedup pixel + CAPI funciona (Events Manager muestra "matched" o equivalente).
- [ ] Página `/privacidad` accesible desde footer del landing.
- [ ] Ninguna palabra riesgosa (rifa/lotería/azar/etc) en páginas públicas que Meta pueda scrapear.
- [ ] No hay `META_TEST_EVENT_CODE` seteado en Easypanel PROD.
- [ ] `autolandia.com.py` verified en Meta Business Suite (ya hecho antes de este plan).
- [ ] Primera campaña creada por Paul después del warmup de 48-72hs.

## Rollback plan

Si algo falla en PROD:

1. Easypanel PROD → Deployments → revertir al deploy anterior (1 click).
2. Alternativa: `git revert <hash-de-cada-chunk>` en main + push → redeploy automático.
3. Si el issue es solo en eventos Meta (no afecta web): borrar `META_CAPI_ACCESS_TOKEN` de Easypanel PROD → `sendMetaEvent` queda no-op silencioso → la web sigue funcionando.

La web funciona correctamente sin Meta (fire-and-forget pattern) — el único efecto de un rollback de esta feature es perder el tracking.

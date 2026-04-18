# Panel admin con sorteador visual — Implementation Plan

> **For agentic workers:** Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Construir panel admin con sorteador visual streamable para que el cliente corra sorteos laterales filtrados (ej: "500k Gs a quien compró 3+ boletos entre fecha X-Y") con transmisión en vivo por redes.

**Architecture:** Rutas Next.js App Router `/admin/*` protegidas por middleware (Supabase session + phone whitelist + cookie TOTP). Sorteos se ejecutan server-side con `crypto.randomInt()` y snapshot inmutable. Animación CSS (slot machine + confetti) sin librerías pesadas. Página pública `/sorteo/[id]` para auditoría.

**Tech Stack:** Next.js 16 (App Router), Supabase Postgres (service_role en server actions), `otplib` (TOTP), `iron-session` (cookie firmada), Tailwind 4, crypto nativo de Node.

**Spec:** [2026-04-18-admin-panel-sorteos-design.md](../specs/2026-04-18-admin-panel-sorteos-design.md)

**Referencias obligatorias antes de tocar código:**
- `autolandia-web/AGENTS.md` — Next.js 16 tiene breaking changes; leer `node_modules/next/dist/docs/` antes de usar APIs dudosas.
- `autolandia-web/CLAUDE.md` — quirks de Easypanel, workflow DEV/PROD, auth custom con Twilio.

---

## File Structure

**Crear:**
- `lib/admin-crypto.ts` — AES-256-GCM encrypt/decrypt de secretos TOTP
- `lib/admin-auth.ts` — helpers `requireAdmin()` / `verifyTotpCookie()` / `signTotpCookie()`
- `lib/sorteo-pool.ts` — query del pool con filtros + weighting
- `lib/sorteo-random.ts` — `crypto.randomInt()` + selección sin reemplazo
- `middleware.ts` — protección de `/admin/*`
- `app/admin/layout.tsx` — layout admin
- `app/admin/page.tsx` — dashboard (lista sorteos)
- `app/admin/login/page.tsx` — input TOTP
- `app/admin/enroll/page.tsx` — enrollment inicial con bootstrap token
- `app/admin/sorteos/nuevo/page.tsx` — form
- `app/admin/sorteos/[id]/page.tsx` — vista ejecución con animación
- `app/sorteo/[id]/page.tsx` — auditoría pública
- `app/actions/admin-totp.ts` — `verifyTotp`, `enrollAdmin`
- `app/actions/sorteo.ts` — `previewSorteoPool`, `createAndExecuteSorteo`, `markSorteoPaid`, `getSorteoPublic`
- `components/admin/SorteoForm.tsx` — form controlado
- `components/admin/Sorteador.tsx` — animación (client)
- `components/admin/Confetti.tsx` — efecto CSS puro

**Modificar:**
- `lib/notifications.ts` — agregar `notifyTelegramSorteo()`
- `package.json` — deps `otplib`, `iron-session`, `qrcode`
- `.env` example / docs CLAUDE.md — nuevas env vars

---

## Chunk 1: Foundation (DB + crypto + env)

### Task 1.1: Migración Supabase DEV

**Files:** Aplicar via MCP `apply_migration` a project `jyytukfcnembucompttu`.

- [ ] **Step 1:** Aplicar migración SQL:

```sql
CREATE TABLE public.admin_users (
  phone VARCHAR PRIMARY KEY,
  nombre VARCHAR NOT NULL,
  totp_secret_encrypted TEXT NOT NULL,
  failed_totp_attempts INT NOT NULL DEFAULT 0,
  locked_until TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE public.admin_users ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.sorteos (
  id SERIAL PRIMARY KEY,
  sorteo_id VARCHAR UNIQUE NOT NULL,
  titulo VARCHAR NOT NULL,
  premio_monto BIGINT NOT NULL,
  premio_descripcion TEXT,
  filtros JSONB NOT NULL,
  ponderar_por_boletos BOOLEAN NOT NULL DEFAULT false,
  cantidad_ganadores INT NOT NULL DEFAULT 1,
  pool_count INT NOT NULL,
  pool_snapshot JSONB NOT NULL,
  ganadores JSONB NOT NULL,
  estado VARCHAR NOT NULL DEFAULT 'completado',
  pagado_at TIMESTAMPTZ,
  pago_referencia TEXT,
  creado_por_phone VARCHAR NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_sorteos_sorteo_id ON public.sorteos(sorteo_id);
CREATE INDEX idx_sorteos_created_at ON public.sorteos(created_at DESC);
ALTER TABLE public.sorteos ENABLE ROW LEVEL SECURITY;
```

- [ ] **Step 2:** Verificar via `execute_sql`: `SELECT COUNT(*) FROM admin_users; SELECT COUNT(*) FROM sorteos;` → ambas 0 rows, sin error.

### Task 1.2: Env vars nuevas

**Files:** Modificar Dockerfile develop + actualizar CLAUDE.md.

- [ ] **Step 1:** Generar valores:
  - `ADMIN_ENCRYPTION_KEY`: `openssl rand -hex 32` (64 hex chars)
  - `ADMIN_TOTP_COOKIE_SECRET`: `openssl rand -hex 32`
  - `ADMIN_BOOTSTRAP_TOKEN`: `openssl rand -hex 24`

- [ ] **Step 2:** Agregar al Dockerfile DEV (develop branch):
```dockerfile
ENV ADMIN_ENCRYPTION_KEY=<valor_generado>
ENV ADMIN_TOTP_COOKIE_SECRET=<valor_generado>
ENV ADMIN_BOOTSTRAP_TOKEN=<valor_generado>
```

- [ ] **Step 3:** Guardar valores de PROD en un lado seguro (1Password / nota local). Se aplicarán al Dockerfile main cuando mergeemos. Los 3 valores deben ser distintos entre DEV y PROD.

- [ ] **Step 4:** Commit:
```bash
git add Dockerfile
git commit -m "chore: env vars para admin panel (DEV)"
```

### Task 1.3: `lib/admin-crypto.ts`

**Files:** Create `lib/admin-crypto.ts`.

- [ ] **Step 1:** Escribir:
```typescript
import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

const ALGO = 'aes-256-gcm';
const KEY_HEX = process.env.ADMIN_ENCRYPTION_KEY!;

function getKey(): Buffer {
  if (!KEY_HEX || KEY_HEX.length !== 64) {
    throw new Error('ADMIN_ENCRYPTION_KEY must be 64 hex chars (32 bytes)');
  }
  return Buffer.from(KEY_HEX, 'hex');
}

export function encryptSecret(plaintext: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGO, getKey(), iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString('base64')}:${tag.toString('base64')}:${encrypted.toString('base64')}`;
}

export function decryptSecret(payload: string): string {
  const [ivB64, tagB64, encB64] = payload.split(':');
  if (!ivB64 || !tagB64 || !encB64) throw new Error('Malformed ciphertext');
  const iv = Buffer.from(ivB64, 'base64');
  const tag = Buffer.from(tagB64, 'base64');
  const encrypted = Buffer.from(encB64, 'base64');
  const decipher = createDecipheriv(ALGO, getKey(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString('utf8');
}
```

- [ ] **Step 2:** Verificación manual: crear archivo temporal `/tmp/crypto-test.ts` con roundtrip, correr con `npx tsx /tmp/crypto-test.ts`, borrar.

- [ ] **Step 3:** Commit:
```bash
git add lib/admin-crypto.ts
git commit -m "feat: admin-crypto util para cifrar TOTP secrets"
```

### Task 1.4: Instalar deps

- [ ] **Step 1:** `cd autolandia-web && npm install --legacy-peer-deps otplib iron-session qrcode @types/qrcode`

- [ ] **Step 2:** Verificar que `node_modules/otplib/package.json` existe.

- [ ] **Step 3:** Commit `package.json` y `package-lock.json`:
```bash
git commit -m "chore: deps otplib, iron-session, qrcode"
```

---

## Chunk 2: Auth admin (TOTP + middleware)

### Task 2.1: `lib/admin-auth.ts`

**Files:** Create `lib/admin-auth.ts`.

- [ ] **Step 1:** Helpers para cookie firmada + check whitelist:

```typescript
import { cookies } from 'next/headers';
import { createHmac, timingSafeEqual } from 'crypto';
import { createServerClient } from './supabase-server';

const COOKIE_NAME = 'admin_totp_ok';
const COOKIE_MAX_AGE = 12 * 60 * 60; // 12h

function sign(value: string): string {
  const secret = process.env.ADMIN_TOTP_COOKIE_SECRET!;
  return createHmac('sha256', secret).update(value).digest('hex');
}

export async function setTotpCookie(phone: string) {
  const value = `${phone}.${Date.now()}`;
  const sig = sign(value);
  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, `${value}.${sig}`, {
    httpOnly: true,
    secure: true,
    sameSite: 'strict',
    maxAge: COOKIE_MAX_AGE,
    path: '/',
  });
}

export async function verifyTotpCookie(expectedPhone: string): Promise<boolean> {
  const cookieStore = await cookies();
  const raw = cookieStore.get(COOKIE_NAME)?.value;
  if (!raw) return false;
  const parts = raw.split('.');
  if (parts.length !== 3) return false;
  const [phone, ts, sig] = parts;
  const expected = sign(`${phone}.${ts}`);
  if (!timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return false;
  if (phone !== expectedPhone) return false;
  const age = (Date.now() - parseInt(ts, 10)) / 1000;
  if (age > COOKIE_MAX_AGE) return false;
  return true;
}

export async function clearTotpCookie() {
  const cookieStore = await cookies();
  cookieStore.delete(COOKIE_NAME);
}

export async function isWhitelistedAdmin(phone: string): Promise<boolean> {
  const supabase = createServerClient();
  const { data } = await supabase.from('admin_users').select('phone').eq('phone', phone).limit(1);
  return (data?.length ?? 0) > 0;
}
```

- [ ] **Step 2:** Commit:
```bash
git commit -m "feat: admin-auth helpers (cookie + whitelist check)"
```

### Task 2.2: `middleware.ts`

**Files:** Create `middleware.ts` en root de autolandia-web.

- [ ] **Step 1:** Implementar:

```typescript
import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';

const PUBLIC_ADMIN_PATHS = ['/admin/login', '/admin/enroll'];

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (!pathname.startsWith('/admin')) return NextResponse.next();
  if (PUBLIC_ADMIN_PATHS.some((p) => pathname.startsWith(p))) return NextResponse.next();

  // Check Supabase session via cookies
  const res = NextResponse.next();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => req.cookies.getAll(),
        setAll: (cs) => cs.forEach(({ name, value, options }) => res.cookies.set(name, value, options)),
      },
    }
  );
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.redirect(new URL('/login', req.url));

  // Extraer phone
  let phone = user.user_metadata?.telefono || user.phone || '';
  if (!phone && user.email?.endsWith('@autolandia.internal')) {
    const m = user.email.match(/user\.(\d+)@/);
    if (m) phone = m[1];
  }
  if (!phone) return NextResponse.redirect(new URL('/', req.url));

  // Middleware NO puede tocar DB con service_role (limitation Edge runtime).
  // El check de admin_users + totp cookie lo hace el layout server component de /admin.
  return res;
}

export const config = {
  matcher: ['/admin/:path*'],
};
```

Nota: `@supabase/ssr` puede requerir instalación (`npm i @supabase/ssr`). Verificar si ya está.

- [ ] **Step 2:** Si `@supabase/ssr` no está: `npm i @supabase/ssr --legacy-peer-deps` + commit.

- [ ] **Step 3:** Commit middleware.

### Task 2.3: `app/admin/layout.tsx` — enforce admin + TOTP

**Files:** Create `app/admin/layout.tsx`.

- [ ] **Step 1:** Layout server component que valida en cada request (middleware solo valida sesión):

```typescript
import { redirect } from 'next/navigation';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { isWhitelistedAdmin, verifyTotpCookie } from '@/lib/admin-auth';

const PUBLIC = ['/admin/login', '/admin/enroll'];

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  // Obtener pathname (workaround: headers x-pathname via middleware, o usar notación router)
  // NOTA: en Next 16 server components NO tienen acceso directo a pathname.
  // Solucion: middleware setea header 'x-pathname', o validar en cada page individualmente.
  // Aqui dejamos el layout simple y validamos en cada page de admin.
  return <>{children}</>;
}
```

**Alternativa simplificada**: en vez de layout, crear helper `requireAdmin()` en `lib/admin-auth.ts` que llame cada server component:

```typescript
export async function requireAdmin(): Promise<{ phone: string }> {
  // Obtener user de Supabase con SSR
  // Si no hay user → redirect('/login')
  // Si phone no esta en whitelist → redirect('/')
  // Si no tiene cookie TOTP valida → redirect('/admin/login')
  // Retornar { phone }
}
```

- [ ] **Step 2:** Implementar `requireAdmin()` y usarlo en cada page de admin (no en layout).

- [ ] **Step 3:** Commit.

### Task 2.4: `app/admin/enroll/page.tsx`

**Files:** Create page + action `app/actions/admin-totp.ts`.

- [ ] **Step 1:** Action `enrollAdmin`:

```typescript
'use server';
import { authenticator } from 'otplib';
import qrcode from 'qrcode';
import { encryptSecret } from '@/lib/admin-crypto';
import { createServerClient } from '@/lib/supabase-server';

export async function enrollAdmin(input: {
  phone: string;
  nombre: string;
  bootstrapToken: string;
}): Promise<{ success: boolean; error?: string; qrDataUrl?: string; secret?: string }> {
  if (input.bootstrapToken !== process.env.ADMIN_BOOTSTRAP_TOKEN) {
    return { success: false, error: 'Token invalido' };
  }
  if (!/^595\d{9}$/.test(input.phone)) {
    return { success: false, error: 'Telefono invalido (formato 595XXXXXXXXX)' };
  }
  const secret = authenticator.generateSecret();
  const encrypted = encryptSecret(secret);
  const supabase = createServerClient();
  const { error } = await supabase.from('admin_users').upsert({
    phone: input.phone,
    nombre: input.nombre,
    totp_secret_encrypted: encrypted,
  });
  if (error) return { success: false, error: error.message };
  const otpauth = authenticator.keyuri(input.phone, 'Autolandia Admin', secret);
  const qrDataUrl = await qrcode.toDataURL(otpauth);
  return { success: true, qrDataUrl, secret };
}
```

- [ ] **Step 2:** Page `/admin/enroll` con form que llama el action. Query param `?token=...` para pre-poblar. Muestra QR + secret UNA SOLA VEZ. Warning: "guardá esto ya o reiniciá".

- [ ] **Step 3:** Commit.

### Task 2.5: `app/admin/login/page.tsx` + `verifyTotp`

**Files:** Create.

- [ ] **Step 1:** Action `verifyTotp`:

```typescript
'use server';
import { authenticator } from 'otplib';
import { decryptSecret } from '@/lib/admin-crypto';
import { createServerClient } from '@/lib/supabase-server';
import { setTotpCookie } from '@/lib/admin-auth';

export async function verifyTotp(phone: string, code: string): Promise<{ ok: boolean; error?: string }> {
  const supabase = createServerClient();
  const { data } = await supabase
    .from('admin_users')
    .select('totp_secret_encrypted, failed_totp_attempts, locked_until')
    .eq('phone', phone)
    .single();
  if (!data) return { ok: false, error: 'No admin' };
  if (data.locked_until && new Date(data.locked_until) > new Date()) {
    return { ok: false, error: 'Cuenta bloqueada temporalmente' };
  }
  const secret = decryptSecret(data.totp_secret_encrypted);
  authenticator.options = { window: 1 }; // ±30s tolerance
  const isValid = authenticator.check(code, secret);
  if (!isValid) {
    const attempts = (data.failed_totp_attempts ?? 0) + 1;
    const update: { failed_totp_attempts: number; locked_until?: string } = { failed_totp_attempts: attempts };
    if (attempts >= 5) {
      update.locked_until = new Date(Date.now() + 15 * 60 * 1000).toISOString();
    }
    await supabase.from('admin_users').update(update).eq('phone', phone);
    return { ok: false, error: 'Codigo invalido' };
  }
  await supabase.from('admin_users').update({ failed_totp_attempts: 0, locked_until: null }).eq('phone', phone);
  await setTotpCookie(phone);
  return { ok: true };
}
```

- [ ] **Step 2:** Page `/admin/login`:
  - Obtiene user de Supabase client-side.
  - Si no hay user → redirige a `/login`.
  - Si phone no es admin → muestra "acceso denegado".
  - Muestra input 6 dígitos → llama `verifyTotp` → si OK, redirige a `/admin`.

- [ ] **Step 3:** Commit.

### Task 2.6: Enrollment inicial en DEV

- [ ] **Step 1:** Deployar develop y esperar redeploy de Easypanel DEV.

- [ ] **Step 2:** Desde el browser visitar `https://autolandiabot-fulll-autolandia-web.wrkyu1.easypanel.host/admin/enroll?token=<ADMIN_BOOTSTRAP_TOKEN>`.

- [ ] **Step 3:** Enroll admin 1: `phone=595992673304, nombre=<Nombre del usuario>`. Escanear QR con Google Authenticator y guardar.

- [ ] **Step 4:** Enroll admin 2: `phone=595983757010, nombre=<Nombre 2>`. Mismo proceso.

- [ ] **Step 5:** Verificar que podés entrar a `/admin` completando OTP (SMS) + TOTP.

- [ ] **Step 6:** Desactivar enroll: remover `ADMIN_BOOTSTRAP_TOKEN` del Dockerfile o cambiar el valor a uno placeholder (`DEACTIVATED`). Commit.

---

## Chunk 3: Sorteo logic (pool + random + persistencia)

### Task 3.1: `lib/sorteo-pool.ts`

**Files:** Create.

- [ ] **Step 1:** Función que retorna el pool aplicando filtros:

```typescript
import { createServerClient } from './supabase-server';

export interface SorteoFiltros {
  fecha_desde: string; // YYYY-MM-DD
  fecha_hasta: string;
  min_boletos?: number;
  canal?: 'web' | 'bot' | 'cualquiera';
  excluir_prev_ganadores?: boolean;
}

export interface PoolEntry {
  phone: string;
  nombre: string;
  ci: string;
  ticket_count: number;
}

function normalizePhone(raw: string): string {
  const clean = (raw || '').replace(/\D/g, '');
  let local = clean;
  if (local.startsWith('595')) local = local.slice(3);
  if (local.startsWith('0')) local = local.slice(1);
  return local ? '595' + local : '';
}

export async function queryPool(filtros: SorteoFiltros): Promise<PoolEntry[]> {
  const supabase = createServerClient();
  let q = supabase.from('ventas').select('telefono, telefono_registro, nombre_completo, ci, cantidad');
  q = q.gte('fecha', `${filtros.fecha_desde}T00:00:00`).lte('fecha', `${filtros.fecha_hasta}T23:59:59`);
  if (filtros.canal === 'web') q = q.eq('mensaje_inicial', 'WEB');
  else if (filtros.canal === 'bot') q = q.neq('mensaje_inicial', 'WEB');
  const { data, error } = await q;
  if (error) throw new Error(error.message);

  // Agrupar por telefono normalizado
  const map = new Map<string, PoolEntry>();
  for (const v of data ?? []) {
    const norm = normalizePhone(v.telefono || v.telefono_registro || '');
    if (!norm) continue;
    const existing = map.get(norm);
    if (existing) {
      existing.ticket_count += v.cantidad;
    } else {
      map.set(norm, {
        phone: norm,
        nombre: v.nombre_completo || '',
        ci: v.ci || '',
        ticket_count: v.cantidad,
      });
    }
  }
  let pool = Array.from(map.values());
  if (filtros.min_boletos) pool = pool.filter((p) => p.ticket_count >= filtros.min_boletos!);

  if (filtros.excluir_prev_ganadores) {
    const { data: sorteos } = await supabase.from('sorteos').select('ganadores');
    const prevWinnerPhones = new Set<string>();
    for (const s of sorteos ?? []) {
      for (const g of s.ganadores as { phone: string }[]) prevWinnerPhones.add(g.phone);
    }
    pool = pool.filter((p) => !prevWinnerPhones.has(p.phone));
  }
  return pool;
}
```

- [ ] **Step 2:** Commit.

### Task 3.2: `lib/sorteo-random.ts`

**Files:** Create.

- [ ] **Step 1:**

```typescript
import { randomInt } from 'crypto';
import type { PoolEntry } from './sorteo-pool';

/**
 * Selecciona N ganadores sin reemplazo.
 * Si ponderar=true: cada PoolEntry pesa por ticket_count.
 * Si ponderar=false: cada PoolEntry pesa 1.
 */
export function pickWinners(
  pool: PoolEntry[],
  cantidad: number,
  ponderar: boolean,
): PoolEntry[] {
  if (pool.length < cantidad) {
    throw new Error(`Pool insuficiente: ${pool.length} < ${cantidad}`);
  }
  const winners: PoolEntry[] = [];
  const remaining = [...pool];
  for (let i = 0; i < cantidad; i++) {
    let pickIdx: number;
    if (ponderar) {
      const totalWeight = remaining.reduce((s, p) => s + p.ticket_count, 0);
      let r = randomInt(totalWeight);
      pickIdx = 0;
      for (let j = 0; j < remaining.length; j++) {
        r -= remaining[j].ticket_count;
        if (r < 0) { pickIdx = j; break; }
      }
    } else {
      pickIdx = randomInt(remaining.length);
    }
    winners.push(remaining[pickIdx]);
    remaining.splice(pickIdx, 1);
  }
  return winners;
}
```

- [ ] **Step 2:** Test manual rápido (temp file `/tmp/test-random.ts`): pool de 10 con ticket_counts variables, correr 1000 veces, verificar distribución razonable. Borrar.

- [ ] **Step 3:** Commit.

### Task 3.3: Server actions de sorteo

**Files:** Create `app/actions/sorteo.ts`.

- [ ] **Step 1:** `previewSorteoPool(filtros)` — retorna solo `{ count, sample: nombres[5] }` para preview.

- [ ] **Step 2:** `createAndExecuteSorteo(config)`:
  - `requireAdmin()` → extrae `phone`.
  - Query pool.
  - Validar `pool.length >= cantidad_ganadores`.
  - `pickWinners()`.
  - Generar `sorteo_id` via `SELECT 'SORT-' || LPAD((COALESCE(MAX(id),0)+1)::text, 3, '0') FROM sorteos`.
  - `INSERT INTO sorteos (...)` con `pool_snapshot: pool.map(p => ({phone: p.phone, weight: p.ticket_count}))`.
  - `notifyTelegramSorteo(sorteo_id, ganadores, premio)`.
  - Return `{ sorteo_id }`.

- [ ] **Step 3:** `markSorteoPaid(sorteo_id, referencia)` — requireAdmin + UPDATE estado.

- [ ] **Step 4:** `getSorteoPublic(sorteo_id)` — sin auth, retorna:
```typescript
{ sorteo_id, titulo, premio_monto, premio_descripcion, filtros, pool_count, cantidad_ganadores, ganadores: [{ nombre, phone_masked, ticket_count }], created_at }
```

Helper: `maskPhone("595981234567") → "098****567"`.

- [ ] **Step 5:** Commit.

### Task 3.4: `notifyTelegramSorteo` en `lib/notifications.ts`

**Files:** Modify.

- [ ] **Step 1:** Agregar función que arma mensaje:
```
🎉 SORTEO EJECUTADO

📝 {titulo}
💰 {premio_monto} Gs
🎯 Ganador(es): {nombre 1} (0981***567)
🆔 {sorteo_id}
🔗 https://autolandia.com.py/sorteo/{sorteo_id}

Participantes: {pool_count}
```

Reusa el mismo bot Telegram que tenemos.

- [ ] **Step 2:** Commit.

---

## Chunk 4: Admin UI (form + dashboard + página pública)

### Task 4.1: `/admin` dashboard

**Files:** Create `app/admin/page.tsx`.

- [ ] **Step 1:** Server component: `requireAdmin()` → query `sorteos ORDER BY created_at DESC LIMIT 50` → lista.

- [ ] **Step 2:** Card por sorteo: título, premio, ganador(es), estado (pill colored), fecha. Click → `/admin/sorteos/[id]`. Botón destacado "Nuevo sorteo" → `/admin/sorteos/nuevo`.

- [ ] **Step 3:** Commit.

### Task 4.2: `/admin/sorteos/nuevo` form

**Files:** Create `app/admin/sorteos/nuevo/page.tsx` + `components/admin/SorteoForm.tsx`.

- [ ] **Step 1:** `SorteoForm.tsx` client component. Campos con estado controlado. `useEffect` con debounce 500ms sobre filtros → llama `previewSorteoPool` → muestra count + 5 nombres sample. Reusa los inputs estilo `glass-card` del resto de la web.

- [ ] **Step 2:** Validación client-side: fecha_hasta ≥ fecha_desde, fecha_desde no en futuro, premio > 0, título requerido, cantidad_ganadores ≥ 1, pool_count ≥ cantidad_ganadores (bloquea submit si no).

- [ ] **Step 3:** Submit → `createAndExecuteSorteo` → redirect a `/admin/sorteos/[id]`.

- [ ] **Step 4:** Commit.

### Task 4.3: `/sorteo/[id]` página pública

**Files:** Create `app/sorteo/[id]/page.tsx`.

- [ ] **Step 1:** Server component que llama `getSorteoPublic(params.id)`. Si no existe → `notFound()`.

- [ ] **Step 2:** Layout:
  - Header grande con `titulo` + `premio_monto` formateado + logo Autolandia.
  - Card de ganador(es): nombre grande, teléfono enmascarado, boletos comprados.
  - Sección "Criterios": filtros aplicados en formato humano ("Entre 2026-03-01 y 2026-04-15", "Min 3 boletos", etc.).
  - Sección "Verificación": `sorteo_id`, pool_count, fecha/hora exacta.
  - Footer: "Sorteo generado con crypto.randomInt() server-side. Snapshot inmutable."

- [ ] **Step 3:** Meta tags OG específicos para este sorteo (reusa opengraph-image global).

- [ ] **Step 4:** Commit.

---

## Chunk 5: Sorteador animation

### Task 5.1: `components/admin/Confetti.tsx`

**Files:** Create.

- [ ] **Step 1:** Componente sin librerías. Array de 40 partículas con `position:absolute`, colores dorados/blancos, `animation-delay` y `left` aleatorios (pero determinísticos vía props para hidration). CSS keyframe: cae de `-20px` a `110vh` con rotación.

- [ ] **Step 2:** Props: `active: boolean`, `duration: number`. Unmount tras duration.

- [ ] **Step 3:** Commit.

### Task 5.2: `components/admin/Sorteador.tsx`

**Files:** Create.

- [ ] **Step 1:** Client component con fases:

```typescript
type Phase = 'ready' | 'slot' | 'countdown' | 'reveal' | 'done';
```

Props:
```typescript
{
  ganadores: Winner[];
  poolSampleNames: string[]; // 20-30 nombres random del pool (privacidad: "Juan P.")
  premioMonto: number;
  premioDesc: string;
  sorteoId: string;
}
```

- [ ] **Step 2:** Fase `slot` (3s):
  - Lista vertical de 30+ nombres (repetidos del sample) con `transform: translateY(calc(-N * 60px))`.
  - `transition: transform 3s cubic-bezier(0.22, 1, 0.36, 1)`.
  - Al final, el nombre del ganador queda en la posición central (index pre-calculado para que frene ahí).
  - Ventana visual: border-top/bottom dorado, altura fija, overflow hidden.

- [ ] **Step 3:** Fase `countdown` (1s): "3 → 2 → 1" con `transform: scale(2.5)` + fade.

- [ ] **Step 4:** Fase `reveal`:
  - Overlay flash dorado 200ms.
  - `<Confetti active duration={3000} />`.
  - Nombre grande (responsive: `clamp(40px, 10vw, 96px)`) con `text-shadow: 0 0 40px #d4af37`.
  - Monto del premio en badge pulsante.
  - Teléfono enmascarado debajo.

- [ ] **Step 5:** Si hay N > 1 ganadores, repite slot→countdown→reveal por cada uno con 1s de transición.

- [ ] **Step 6:** Botones admin (ocultos en fullscreen):
  - "REPRODUCIR SORTEO" (solo visible en fase `ready`).
  - "Fullscreen" — llama `requestFullscreen()`.
  - "Ver recibo público" (solo en `done`) → link a `/sorteo/[id]`.

- [ ] **Step 7:** Commit.

### Task 5.3: `/admin/sorteos/[id]` integration

**Files:** Create `app/admin/sorteos/[id]/page.tsx`.

- [ ] **Step 1:** Server component: `requireAdmin()` → fetch sorteo → pasar data al Sorteador client component.

- [ ] **Step 2:** Sidebar admin (oculto en fullscreen): HUD con filtros, pool_count, sorteo_id, estado, botón "Marcar como pagado" (abre dialog con input referencia).

- [ ] **Step 3:** Background branded (`bg-[#0a0a0f]`, logo en esquina) para que el stream se vea coherente.

- [ ] **Step 4:** Commit.

---

## Chunk 6: QA + PROD rollout

### Task 6.1: QA en DEV

- [ ] **Step 1:** Insertar algunas ventas dummy en DEV (o usar las que ya hay). Verificar que `queryPool({fecha_desde: hace_30_dias, fecha_hasta: hoy, min_boletos: 1})` retorna algo.

- [ ] **Step 2:** Correr un sorteo dummy: título "Test", premio 1000 Gs, 1 ganador. Verificar:
  - El sorteo se guardó en DB con `pool_snapshot` no vacío.
  - Telegram llegó al admin.
  - Animación se ve bien en fullscreen (desktop + mobile).
  - Página pública `/sorteo/[id]` muestra todo correctamente.

- [ ] **Step 3:** Probar edge cases:
  - Pool vacío → error claro.
  - Pool < ganadores → error claro.
  - Código TOTP inválido → mensaje + contador de intentos.
  - Después de 5 intentos fallidos → lockout 15min.

- [ ] **Step 4:** Marcar dummy como pagado. Verificar estado.

### Task 6.2: Cherry-pick a main + PROD

- [ ] **Step 1:** Migración Supabase PROD via MCP (mismo SQL que DEV).

- [ ] **Step 2:** Agregar env vars de PROD al Dockerfile de `main` (valores distintos de DEV). `ADMIN_BOOTSTRAP_TOKEN` solo para enroll inicial.

- [ ] **Step 3:** Cherry-pick de commits de develop a main (sin Dockerfile de develop).

- [ ] **Step 4:** Push main → redeploy PROD.

- [ ] **Step 5:** Enroll inicial en PROD: `/admin/enroll?token=<PROD_TOKEN>` → admin 1 + admin 2.

- [ ] **Step 6:** Desactivar `ADMIN_BOOTSTRAP_TOKEN` en Dockerfile main. Commit + push.

- [ ] **Step 7:** Verificar login admin en PROD + hacer 1 sorteo test de 1 Gs para confirmar funcionamiento.

---

## Verificación final

Antes de dar el feature por cerrado:

- [ ] Admin no logueado no puede acceder a `/admin/*` (redirige a `/login`).
- [ ] User normal logueado (no en whitelist) no puede acceder a `/admin/*`.
- [ ] Admin logueado sin TOTP no puede acceder a `/admin` (redirige a `/admin/login`).
- [ ] 5 intentos TOTP fallidos bloquean la cuenta 15min.
- [ ] Enroll protegido por bootstrap token (sin token = error).
- [ ] `pool_snapshot` nunca se expone en la API pública.
- [ ] Teléfonos siempre enmascarados en UI pública.
- [ ] Telegram notification se dispara en cada sorteo.
- [ ] `crypto.randomInt()` usado (no `Math.random`) — verificar con grep.
- [ ] RLS activo en `admin_users` y `sorteos`.

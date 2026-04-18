# Panel admin con sorteador visual para transmisión en vivo

## Problema

El cliente de Autolandia necesita correr sorteos laterales (ej: "500 mil Gs para quien compró 3+ boletos entre fecha X y Y") y transmitirlos en vivo por redes sociales. Hoy no hay UI admin, no hay forma de correr sorteos filtrados, y no hay componente visual "streamable". Además, por lo sensible del flujo (plata real, credibilidad de la marca), la seguridad tiene que ser fuerte desde el día 1.

## Decisiones tomadas

- **Auth admin**: whitelist de teléfonos + TOTP 2FA (Google Authenticator). Reusa el OTP SMS existente como primer factor.
- **Mecánica**: configurable por sorteo — toggle "ponderar por boletos" (default off) + cantidad de ganadores N (default 1).
- **Filtros**: rango fecha (req), min boletos (opc), canal web/bot/cualquiera, excluir ganadores previos.
- **Visual**: combo slot machine (build-up) + flash reveal con confetti (climax).
- **Random**: `crypto.randomInt()` server-side. Snapshot del pool inmutable antes del pick.
- **Streaming**: fullscreen togglable en la misma URL. Sin Realtime por ahora (queda para v2).
- **Post-sorteo**: notify Telegram al admin (no al ganador). Admin contacta manual.
- **Admins iniciales**: `595992673304`, `595983757010`.

## Arquitectura

### Rutas

- `/admin` — dashboard con lista de sorteos + botón "Nuevo sorteo".
- `/admin/login` — solicita código TOTP tras tener sesión Supabase.
- `/admin/enroll` — setup de TOTP (protegida con `ADMIN_BOOTSTRAP_TOKEN`, single-use).
- `/admin/sorteos/nuevo` — form de configuración + preview en vivo del pool count.
- `/admin/sorteos/[id]` — ejecución del sorteo + animación, con toggle fullscreen.
- `/sorteo/[id]` — página pública de auditoría (sin auth, sin snapshot crudo).

### Middleware

Archivo nuevo `middleware.ts` protege `/admin/*` (excepto `/admin/login` y `/admin/enroll`):

1. Verifica sesión Supabase válida.
2. `user.phone` debe existir en tabla `admin_users`.
3. Cookie `admin_totp_ok` httpOnly firmada debe estar presente y < 12h.
4. Cualquier fallo → redirect a `/admin/login`.

### Server actions

- `previewSorteoPool(filtros)` — retorna solo el `pool_count`, con debounce client-side de 500ms.
- `verifyTotp(code)` — valida TOTP con tolerancia ±30s. Rate limit 5/15min. Setea cookie al pasar.
- `createAndExecuteSorteo(config)` — atómica (lock, snapshot, pick, insert, notify). Return `sorteo_id`.
- `markSorteoPaid(sorteo_id, referencia)` — actualiza estado.
- `enrollAdmin(phone, nombre, bootstrap_token)` — genera secret TOTP, lo cifra, retorna QR data URL + secret en texto (solo mostrado una vez).
- `getSorteoPublic(sorteo_id)` — versión sanitizada para `/sorteo/[id]` (sin `pool_snapshot`).

## Modelo de datos

Migración Supabase DEV (luego PROD tras OK):

```sql
CREATE TABLE admin_users (
  phone VARCHAR PRIMARY KEY,
  nombre VARCHAR NOT NULL,
  totp_secret_encrypted TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE sorteos (
  id SERIAL PRIMARY KEY,
  sorteo_id VARCHAR UNIQUE NOT NULL,
  titulo VARCHAR NOT NULL,
  premio_monto BIGINT NOT NULL,
  premio_descripcion TEXT,
  filtros JSONB NOT NULL,
  ponderar_por_boletos BOOLEAN DEFAULT false,
  cantidad_ganadores INT NOT NULL DEFAULT 1,
  pool_count INT NOT NULL,
  pool_snapshot JSONB NOT NULL,
  ganadores JSONB NOT NULL,
  estado VARCHAR NOT NULL DEFAULT 'completado',
  pagado_at TIMESTAMPTZ,
  pago_referencia TEXT,
  creado_por_phone VARCHAR NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_sorteos_sorteo_id ON sorteos(sorteo_id);

-- RLS: ambas tablas solo accesibles via service_role
ALTER TABLE admin_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE sorteos ENABLE ROW LEVEL SECURITY;
-- No policies => solo service_role (bypass RLS) puede leer/escribir
```

Formato `sorteos.filtros`:
```json
{
  "fecha_desde": "2026-03-01",
  "fecha_hasta": "2026-04-15",
  "min_boletos": 3,
  "canal": "cualquiera",
  "excluir_prev_ganadores": true
}
```

Formato `sorteos.pool_snapshot`:
```json
[{"phone": "595XXXXXXXXX", "weight": 3}, ...]
```

Formato `sorteos.ganadores`:
```json
[{"phone": "595...", "nombre": "...", "ci": "...", "ticket_count": 5, "pick_order": 1}]
```

## Flow de auth del admin

1. Admin visita `/admin` → middleware redirige a `/login` si no hay sesión Supabase.
2. Login OTP normal (sin cambios).
3. Post-login, middleware verifica `user.phone ∈ admin_users`. Si no → redirect a `/mis-boletos` (user normal).
4. Si sí pero no hay cookie TOTP válida → `/admin/login` muestra input de 6 dígitos.
5. `verifyTotp(code)` valida contra `totp_secret_encrypted` (desencriptado en memoria, nunca vuelve al cliente).
6. Éxito → cookie `admin_totp_ok` httpOnly, firmada con `ADMIN_TOTP_COOKIE_SECRET`, Max-Age 12h.
7. Middleware deja pasar.

Enrollment: página `/admin/enroll` acepta `?token=<ADMIN_BOOTSTRAP_TOKEN>` (env var), muestra form con `phone + nombre`, genera secret `otplib.authenticator.generateSecret()`, cifra con AES-256-GCM (clave `ADMIN_ENCRYPTION_KEY`), guarda, muestra QR (`otplib.authenticator.keyuri`) una única vez. Después del enroll inicial de los 2 admins, el env var `ADMIN_BOOTSTRAP_TOKEN` se remueve.

## Flow de ejecución del sorteo

1. Admin llena form en `/admin/sorteos/nuevo`. Preview en vivo del count con cada cambio.
2. Click "Iniciar sorteo" → POST a `createAndExecuteSorteo`.
3. Server action:
   - Query atómica al pool aplicando filtros (teléfonos deduplicados, ya normalizados).
   - Si `ponderar_por_boletos=true`: expande el array a entradas por boleto.
   - Si `excluir_prev_ganadores=true`: LEFT JOIN `sorteos.ganadores` para excluir.
   - Valida `pool_count >= cantidad_ganadores`.
   - Para cada ganador: `crypto.randomInt(0, remaining.length)`, remueve del pool, continúa hasta N.
   - Build `ganadores[]` con join a `ventas` para nombre/CI.
   - INSERT en `sorteos`.
   - `notifyTelegramSorteo(sorteo_id, ganadores, premio)` — fire-and-forget con await.
   - Return `sorteo_id`.
4. Client redirige a `/admin/sorteos/[id]`.
5. `/admin/sorteos/[id]` carga el sorteo pero NO dispara animación hasta click admin "REPRODUCIR SORTEO" (para control en vivo).
6. Fases: Ready → Slot (3s) → Countdown (1s) → Flash + Confetti (3s). Repite por cada ganador con 1s de transición.
7. Al terminar: CTA "Ver recibo público" → `/sorteo/[id]`.

## Componente de la animación

Ubicación: `components/admin/Sorteador.tsx` (client component).

Props:
- `ganadores: Winner[]` — array de ganadores (ya resuelto server-side)
- `poolNames: string[]` — 20-30 nombres random del pool para el slot (privacidad: primer nombre + inicial apellido)
- `premioMonto: number`
- `premioDesc: string`
- `sorteoId: string`

Fases controladas por `useState<'ready'|'slot'|'countdown'|'reveal'|'done'>`. Animaciones con CSS `@keyframes` + `transform: translateY()`. Easing `cubic-bezier(0.22, 1, 0.36, 1)` para la desaceleración del slot. Confetti con SVG + CSS keyframes (sin librería pesada) — array de 40 partículas con `animation-delay` aleatorio.

Fullscreen: botón que dispara `document.documentElement.requestFullscreen()`. HUD admin (controles) se oculta con `@media (fullscreen)`.

## Seguridad

- **2 factores independientes**: SMS OTP (posesión de SIM) + TOTP (posesión del dispositivo con Authenticator).
- **Cookie TOTP**: httpOnly, SameSite=Strict, firmada con HMAC-SHA256, expira 12h. Usa `iron-session` o equivalente liviano.
- **Rate limit TOTP**: 5 intentos / 15 min por `phone`. Lockout 1h tras 3 ciclos fallidos. Guardado en tabla efímera (o Redis, pero MVP: columna `failed_attempts + locked_until` en `admin_users`).
- **Snapshot inmutable**: el `pool_snapshot` y `ganadores` son INSERT-only. No hay UPDATE a esos campos. Solo `estado`/`pagado_at`/`pago_referencia` son mutables.
- **RNG**: `crypto.randomInt()` (Node crypto), nunca `Math.random()`.
- **RLS**: `admin_users` y `sorteos` sin policies = cerrado al anon. Todo acceso vía server actions con `service_role`.
- **Página pública `/sorteo/[id]`**: expone `titulo`, `premio`, `filtros`, `pool_count`, `ganadores` (nombre + teléfono enmascarado `098****567`), `created_at`. Nunca `pool_snapshot` completo.
- **Audit log**: cada acción admin (enroll, create_sorteo, mark_paid) dispara mensaje a Telegram admin group.
- **Env vars nuevas**: `ADMIN_ENCRYPTION_KEY` (32 bytes hex), `ADMIN_TOTP_COOKIE_SECRET` (32+ bytes), `ADMIN_BOOTSTRAP_TOKEN` (temporal, para enroll inicial).

## No incluye (YAGNI)

- Multi-role (admin/moderador/viewer). Binario por ahora.
- Edición/cancelación de sorteos post-ejecución.
- Programación de sorteos futuros (cron).
- Export CSV del pool.
- Realtime sync para vista dual (admin controla / OBS captura) — queda para v2.
- Auto-notificación al ganador (admin comunica manual).
- Commit-reveal seeds — (a) es suficiente para MVP.

## Git workflow

- Todo en `develop`. Migración Supabase DEV aplicada via MCP.
- Enroll inicial de los 2 admins en DEV con el `ADMIN_BOOTSTRAP_TOKEN`.
- QA del usuario con sorteo dummy.
- Tras OK: migración a PROD, cherry-pick de commits (sin Dockerfile), enroll en PROD.

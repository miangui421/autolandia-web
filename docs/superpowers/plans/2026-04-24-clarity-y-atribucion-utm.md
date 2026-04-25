# Microsoft Clarity + Atribución UTMs — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Agregar Microsoft Clarity (heatmaps/recordings) + atribución first-touch de ventas por medio publicitario (Meta/TikTok/WhatsApp/direct) con dashboard admin que muestra ventas por canal (web/bot) y por fuente+campaña.

**Architecture:** Cookie `al_utm` (180 días, first-touch) capturada client-side en `/` → leída server-side en signup (persiste en `leads`) y en checkout (snapshot en `ventas`). Función SQL `registrar_venta_web` actualizada con params UTM + `canal='web'`. Bot inserta con `canal='bot'`. Admin muestra 2 tarjetas nuevas: canal split (web/bot/histórico) vía `get_admin_stats` ampliada, y atribución source+campaign vía nueva RPC `get_attribution_stats`.

**Tech Stack:** Next.js 16 (App Router, server actions) + React 19 + Supabase Postgres + Drizzle ORM (bot) + TypeScript + Microsoft Clarity script + Tailwind 4.

**Spec:** `docs/superpowers/specs/2026-04-24-clarity-y-atribucion-utm-design.md`

**Repos afectados:** `autolandia-web` (branch `develop` → `main`) + `autolandia-bot` (branch `develop` → `main`).

---

## Convenciones

- **Paths absolutos de proyecto:** prefijo `autolandia-web/` para web, `autolandia-bot/` para bot, a partir de `/Users/miguelguillen/autolandia migracion typescrit/`.
- **Supabase DBs:** DEV = `jyytukfcnembucompttu`, PROD = `xtwrmcbvjgywwdpdwoxw`.
- **Cuentas Clarity (manualmente creadas antes de Task 18/24):** DEV y PROD proyectos separados en clarity.microsoft.com. Los IDs resultantes quedan documentados en el commit message del Dockerfile correspondiente.
- **Validación web:** el repo NO tiene test runner. En vez de tests unitarios, cada task termina con `npm run build` (TS + Next compilation) + `npm run lint`. Tests manuales en browser descritos en Task 22.
- **Validación bot:** vitest disponible. Agregamos test solo donde aplica sin mocks complejos.
- **Commits:** uno por task, mensaje descriptivo. NO skip hooks. Branch `develop` en ambos repos.

---

## Task 1: Backup de `registrar_venta_web` actual (mitigación crítica de riesgo)

**Files:**
- Create: `autolandia-web/sql/registrar_venta_web_v_pre_utm.sql`

**Contexto:** Antes de modificar la función SQL que ejecuta cada compra web, guardamos su definición actual. Si el UPDATE rompe ventas, rollback es re-aplicar este archivo.

- [ ] **Step 1: Dump de la definición actual de `registrar_venta_web` desde Supabase DEV via MCP**

Ejecutar via el MCP de Supabase (herramienta `execute_sql`) contra el proyecto DEV:
```sql
SELECT pg_get_functiondef(oid)
FROM pg_proc
WHERE proname = 'registrar_venta_web';
```

Copiar el resultado completo (empieza con `CREATE OR REPLACE FUNCTION public.registrar_venta_web(...)`).

- [ ] **Step 2: Escribir el backup al archivo**

Crear `autolandia-web/sql/registrar_venta_web_v_pre_utm.sql` con el contenido exacto devuelto por el paso anterior, agregando un header:

```sql
-- BACKUP: definición de registrar_venta_web ANTES de agregar UTMs + canal.
-- Fecha backup: 2026-04-24. Aplicar con `CREATE OR REPLACE FUNCTION ...` si hay que rollback.
-- NUNCA editar este archivo. Es histórico.

<contenido devuelto por pg_get_functiondef>
```

- [ ] **Step 3: Verificar que el backup se parsea sintácticamente**

Ejecutar localmente:
```bash
head -3 "autolandia-web/sql/registrar_venta_web_v_pre_utm.sql"
wc -l "autolandia-web/sql/registrar_venta_web_v_pre_utm.sql"
```
Expected: el header + primera línea `CREATE OR REPLACE FUNCTION`, y al menos 40 líneas de función.

- [ ] **Step 4: Commit**

```bash
cd "/Users/miguelguillen/autolandia migracion typescrit/autolandia-web"
git add sql/registrar_venta_web_v_pre_utm.sql
git commit -m "chore(sql): backup registrar_venta_web pre-UTMs (rollback reference)"
```

---

## Task 2: Migración SQL DEV — extender `leads` con columnas UTM

**Files:**
- Target DB: Supabase DEV (`jyytukfcnembucompttu`)
- Trace: Supabase migrations tracker (vía MCP)

- [ ] **Step 1: Aplicar migración en DEV via MCP**

Usar la herramienta MCP `apply_migration` con name `extend_leads_utms` y query:

```sql
ALTER TABLE leads ADD COLUMN IF NOT EXISTS utm_source         text;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS utm_medium         text;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS utm_campaign       text;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS utm_content        text;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS utm_term           text;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS utm_landing_page   text;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS utm_first_visit_at timestamptz;
```

- [ ] **Step 2: Verificar columnas creadas**

Ejecutar via MCP `execute_sql`:
```sql
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'leads'
  AND column_name LIKE 'utm_%';
```
Expected: 7 filas (las 7 columnas UTM).

- [ ] **Step 3: Verificar que la tabla sigue aceptando INSERTs existentes (no rompe nada)**

```sql
SELECT COUNT(*) FROM leads LIMIT 1;
```
Expected: devuelve un número sin error.

No se requiere commit (la migración es server-side, queda en Supabase migrations).

---

## Task 3: Migración SQL DEV — extender `ventas` con UTM + canal

**Files:**
- Target DB: Supabase DEV

- [ ] **Step 1: Aplicar migración via MCP**

`apply_migration` con name `extend_ventas_utms_canal`:

```sql
ALTER TABLE ventas ADD COLUMN IF NOT EXISTS utm_source   text;
ALTER TABLE ventas ADD COLUMN IF NOT EXISTS utm_medium   text;
ALTER TABLE ventas ADD COLUMN IF NOT EXISTS utm_campaign text;
ALTER TABLE ventas ADD COLUMN IF NOT EXISTS canal        text;

CREATE INDEX IF NOT EXISTS idx_ventas_utm_source_campaign
  ON ventas(utm_source, utm_campaign);

CREATE INDEX IF NOT EXISTS idx_ventas_canal ON ventas(canal);
```

- [ ] **Step 2: Verificar columnas + índices**

```sql
SELECT column_name FROM information_schema.columns
WHERE table_name='ventas' AND column_name IN ('utm_source','utm_medium','utm_campaign','canal');

SELECT indexname FROM pg_indexes
WHERE tablename='ventas' AND indexname IN ('idx_ventas_utm_source_campaign','idx_ventas_canal');
```
Expected: 4 columnas + 2 índices.

---

## Task 4: Migración SQL DEV — actualizar `registrar_venta_web` con UTMs + canal

**Files:**
- Target DB: Supabase DEV
- Reference: `autolandia-web/sql/registrar_venta_web_v_pre_utm.sql` (Task 1)

**Contexto:** Este es el paso más crítico. Modifica la función SQL que todas las compras web ejecutan. Params nuevos tienen `DEFAULT NULL` para que llamadas viejas (código pre-Task 12) sigan funcionando durante la ventana de deploy.

- [ ] **Step 1: Leer la definición actual del backup para basar el UPDATE**

```bash
cat "autolandia-web/sql/registrar_venta_web_v_pre_utm.sql"
```

Identificar la firma actual de la función. Probablemente algo como:
```sql
CREATE OR REPLACE FUNCTION public.registrar_venta_web(
  p_cantidad int,
  p_transaction_id text,
  p_nombre_completo text,
  p_ci text,
  p_telefono text,
  p_monto numeric,
  p_comprobante_url text,
  p_metodo_pago text,
  p_telefono_registro text,
  p_mensaje_inicial text,
  p_numeros_especificos int[],
  p_is_promo_3x1 boolean
) RETURNS jsonb ...
```

- [ ] **Step 2: Aplicar migración DEV via MCP**

`apply_migration` con name `update_registrar_venta_web_utms`. El query es el mismo `CREATE OR REPLACE FUNCTION` del backup, con estos cambios específicos:

1. Agregar 3 params al final (antes del `RETURNS`):
   ```
   p_utm_source text DEFAULT NULL,
   p_utm_medium text DEFAULT NULL,
   p_utm_campaign text DEFAULT NULL
   ```

2. En el `INSERT INTO ventas` del body de la función, agregar las columnas `utm_source, utm_medium, utm_campaign, canal` a la lista de columnas y los valores `p_utm_source, p_utm_medium, p_utm_campaign, 'web'` al VALUES.

Ejemplo del INSERT modificado (el resto del cuerpo no cambia):
```sql
INSERT INTO ventas (
  ticket_id, transaction_id, nombre_completo, ci, telefono,
  monto, cantidad, comprobante_url, metodo_pago, fecha,
  telefono_registro, mensaje_inicial, is_promo_3x1,
  utm_source, utm_medium, utm_campaign, canal          -- NUEVO
)
VALUES (
  v_ticket_id, p_transaction_id, p_nombre_completo, p_ci, p_telefono,
  p_monto, p_cantidad, p_comprobante_url, p_metodo_pago, NOW(),
  p_telefono_registro, p_mensaje_inicial, p_is_promo_3x1,
  p_utm_source, p_utm_medium, p_utm_campaign, 'web'    -- NUEVO
)
RETURNING id INTO v_venta_id;
```

(Los nombres exactos `v_ticket_id`, `v_venta_id` vienen del cuerpo original — no inventar, usar los del backup.)

- [ ] **Step 3: Verificar la signature actualizada**

```sql
SELECT pg_get_function_identity_arguments(oid)
FROM pg_proc
WHERE proname = 'registrar_venta_web';
```
Expected: la lista incluye los 3 nuevos `p_utm_*` al final.

- [ ] **Step 4: Test compatibilidad — llamada SIN UTMs (código viejo)**

Ejecutar una llamada de prueba via MCP que NO pasa UTMs (simula el código viejo pre-Task 12):
```sql
SELECT public.registrar_venta_web(
  1, 'TEST-NO-UTM', 'Test NoUtm', '1111111', '595900000001', 20000,
  'http://example.com/test.jpg', 'Transferencia', '595900000001', '', NULL, false
);
```

Expected: retorna `{"ticket_id": "TK-XXXX", ...}` sin error. La venta queda con `utm_* = NULL`, `canal = 'web'`.

- [ ] **Step 5: Test llamada CON UTMs**

```sql
SELECT public.registrar_venta_web(
  1, 'TEST-WITH-UTM', 'Test Utm', '2222222', '595900000002', 20000,
  'http://example.com/test.jpg', 'Transferencia', '595900000002', '', NULL, false,
  'meta', 'paid', 'test_campaign'
);
```

Expected: retorna `{"ticket_id": "TK-XXXX", ...}`. La venta queda con `utm_source='meta', utm_medium='paid', utm_campaign='test_campaign', canal='web'`.

- [ ] **Step 6: Verificar ambas ventas de prueba en DB**

```sql
SELECT ticket_id, utm_source, utm_campaign, canal
FROM ventas
WHERE transaction_id IN ('TEST-NO-UTM', 'TEST-WITH-UTM')
ORDER BY fecha DESC;
```
Expected: 2 filas, una con `utm_source=NULL canal='web'`, otra con `utm_source='meta' canal='web'`.

- [ ] **Step 7: Cleanup de las ventas de prueba**

```sql
-- Liberar los números asignados a las ventas test
UPDATE rifas SET estado='LIBRE', venta_id=NULL
WHERE venta_id IN (SELECT id FROM ventas WHERE transaction_id IN ('TEST-NO-UTM','TEST-WITH-UTM'));

-- Eliminar las ventas test
DELETE FROM ventas WHERE transaction_id IN ('TEST-NO-UTM', 'TEST-WITH-UTM');
```

Expected: ambas filas eliminadas.

No commit (migración server-side).

---

## Task 5: Migración SQL DEV — DROP+CREATE `get_admin_stats` con split por canal

**Files:**
- Target DB: Supabase DEV

**Contexto:** cambiamos el return type (agregamos campo `por_canal jsonb`). Postgres requiere DROP explícito para cambio de signature.

- [ ] **Step 1: Leer la definición actual de `get_admin_stats` para conocer el shape que preservamos**

```sql
SELECT pg_get_functiondef(oid)
FROM pg_proc
WHERE proname = 'get_admin_stats';
```

Copiar el resultado. Identificar el `RETURNS TABLE (...)` actual.

- [ ] **Step 2: Aplicar migración via MCP**

`apply_migration` con name `update_get_admin_stats_por_canal`. Query:

```sql
DROP FUNCTION IF EXISTS public.get_admin_stats(int);

CREATE OR REPLACE FUNCTION public.get_admin_stats(p_range_days int)
RETURNS TABLE (
  -- [MANTENER los campos existentes del backup — copiar textualmente del resultado de Step 1]
  total_ventas     bigint,
  total_monto      bigint,
  total_boletos    bigint,
  ventas_hoy       bigint,
  monto_hoy        bigint,
  daily_sales      jsonb,
  -- CAMPO NUEVO:
  por_canal        jsonb
)
LANGUAGE plpgsql STABLE AS $$
DECLARE
  v_fecha_inicio date;
BEGIN
  v_fecha_inicio := (NOW() AT TIME ZONE 'America/Asuncion')::date - (p_range_days - 1 || ' days')::INTERVAL;

  RETURN QUERY
  SELECT
    -- [MANTENER los cálculos originales del backup — no inventar]
    (SELECT COUNT(*) FROM ventas WHERE (fecha AT TIME ZONE 'America/Asuncion')::date >= v_fecha_inicio)::bigint,
    (SELECT COALESCE(SUM(monto), 0) FROM ventas WHERE (fecha AT TIME ZONE 'America/Asuncion')::date >= v_fecha_inicio)::bigint,
    (SELECT COALESCE(SUM(cantidad), 0) FROM ventas WHERE (fecha AT TIME ZONE 'America/Asuncion')::date >= v_fecha_inicio)::bigint,
    (SELECT COUNT(*) FROM ventas WHERE (fecha AT TIME ZONE 'America/Asuncion')::date = (NOW() AT TIME ZONE 'America/Asuncion')::date)::bigint,
    (SELECT COALESCE(SUM(monto), 0) FROM ventas WHERE (fecha AT TIME ZONE 'America/Asuncion')::date = (NOW() AT TIME ZONE 'America/Asuncion')::date)::bigint,
    -- [MANTENER el cálculo de daily_sales original]
    (SELECT jsonb_agg(row_to_json(t)) FROM (
      SELECT (fecha AT TIME ZONE 'America/Asuncion')::date::text AS fecha,
             COUNT(*) AS ventas,
             COALESCE(SUM(monto), 0) AS monto
      FROM ventas
      WHERE (fecha AT TIME ZONE 'America/Asuncion')::date >= v_fecha_inicio
      GROUP BY 1 ORDER BY 1
    ) t),
    -- CAMPO NUEVO por_canal:
    (SELECT jsonb_object_agg(
      COALESCE(canal, 'sin_canal'),
      jsonb_build_object('ventas', ventas_count, 'total_gs', total_gs)
    )
    FROM (
      SELECT canal, COUNT(*)::bigint AS ventas_count, COALESCE(SUM(monto), 0)::bigint AS total_gs
      FROM ventas
      WHERE (fecha AT TIME ZONE 'America/Asuncion')::date >= v_fecha_inicio
      GROUP BY canal
    ) canal_agg);
END;
$$;
```

**Nota importante:** el query real debe basarse textualmente en la definición devuelta en Step 1 para los campos existentes. El bloque de arriba es ilustrativo — adaptar al schema real. Si el backup tiene nombres distintos (ej `total` en vez de `total_monto`), usar los del backup.

- [ ] **Step 3: Verificar función recreada**

```sql
SELECT proname, pg_get_function_result(oid)
FROM pg_proc
WHERE proname = 'get_admin_stats';
```
Expected: `RETURNS TABLE(... , por_canal jsonb)`.

- [ ] **Step 4: Test de la función**

```sql
SELECT por_canal FROM get_admin_stats(30);
```
Expected: `{"sin_canal": {"ventas": N, "total_gs": N}}` (todas las ventas históricas son sin_canal hasta que se deploy el código).

---

## Task 6: Migración SQL DEV — crear `get_attribution_stats`

**Files:**
- Target DB: Supabase DEV

- [ ] **Step 1: Aplicar migración via MCP**

`apply_migration` con name `create_get_attribution_stats`:

```sql
CREATE OR REPLACE FUNCTION public.get_attribution_stats(p_range_days int)
RETURNS TABLE (
  source        text,
  campaign      text,
  ventas_count  bigint,
  total_gs      bigint,
  pct_total     numeric
)
LANGUAGE plpgsql STABLE AS $$
DECLARE
  v_total         bigint;
  v_fecha_inicio  date;
BEGIN
  IF p_range_days <= 0 THEN
    v_fecha_inicio := '1970-01-01'::date;
  ELSE
    v_fecha_inicio := (NOW() AT TIME ZONE 'America/Asuncion')::date - (p_range_days - 1 || ' days')::INTERVAL;
  END IF;

  SELECT COALESCE(SUM(monto), 0) INTO v_total
  FROM ventas
  WHERE (fecha AT TIME ZONE 'America/Asuncion')::date >= v_fecha_inicio;

  RETURN QUERY
  SELECT
    COALESCE(v.utm_source, 'direct')::text                AS source,
    COALESCE(v.utm_campaign, '-')::text                   AS campaign,
    COUNT(*)::bigint                                       AS ventas_count,
    COALESCE(SUM(v.monto), 0)::bigint                     AS total_gs,
    CASE WHEN v_total > 0
      THEN ROUND((SUM(v.monto)::numeric / v_total) * 100, 1)
      ELSE 0
    END                                                    AS pct_total
  FROM ventas v
  WHERE (v.fecha AT TIME ZONE 'America/Asuncion')::date >= v_fecha_inicio
  GROUP BY 1, 2
  ORDER BY total_gs DESC;
END;
$$;
```

- [ ] **Step 2: Test la función con rango de 30 días**

```sql
SELECT * FROM get_attribution_stats(30);
```
Expected: al menos 1 fila con `source='direct'` (todas las ventas históricas sin UTMs).

- [ ] **Step 3: Test la función con p_range_days=0 (lifetime)**

```sql
SELECT * FROM get_attribution_stats(0);
```
Expected: mismo resultado o mayor (todo el histórico).

- [ ] **Step 4: Test con rango que no tenga ventas (edge case)**

```sql
SELECT * FROM get_attribution_stats(-1);
```
Expected: interpretado como lifetime (ver Step 1 — `p_range_days <= 0`).

---

## Task 7: Crear `lib/utm-tracking.ts` (módulo core de UTMs)

**Files:**
- Create: `autolandia-web/lib/utm-tracking.ts`

**Contexto:** Helper que lee/escribe cookie `al_utm`. Usable desde cliente (document.cookie) y server (Next cookies()).

- [ ] **Step 1: Crear el archivo con la interface y constantes**

`autolandia-web/lib/utm-tracking.ts`:

```typescript
export interface UtmData {
  source?: string;
  medium?: string;
  campaign?: string;
  content?: string;
  term?: string;
  landing_page?: string;
  first_visit_at?: string;
}

export const UTM_COOKIE_NAME = 'al_utm';
export const UTM_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 180; // 180 días
export const UTM_PARAM_KEYS = ['source', 'medium', 'campaign', 'content', 'term'] as const;
const FIELD_MAX_LEN = 200;

/** Trunca un string a FIELD_MAX_LEN chars. Preserva undefined. */
function clip(s: string | undefined): string | undefined {
  if (!s) return undefined;
  return s.length > FIELD_MAX_LEN ? s.slice(0, FIELD_MAX_LEN) : s;
}

/** Parse seguro de la cookie (JSON URL-encoded). Devuelve undefined si inválida. */
export function parseUtmCookie(raw: string | undefined | null): UtmData | undefined {
  if (!raw) return undefined;
  try {
    const decoded = decodeURIComponent(raw);
    const parsed = JSON.parse(decoded);
    if (typeof parsed !== 'object' || parsed === null) return undefined;
    return parsed as UtmData;
  } catch {
    return undefined;
  }
}

/** Serializa UtmData a string URL-encoded listo para Set-Cookie. */
export function serializeUtmCookie(data: UtmData): string {
  return encodeURIComponent(JSON.stringify(data));
}

/**
 * Extrae UTMs de un URLSearchParams. Solo retorna si al menos uno de los 5
 * params estándar está presente. landing_page y first_visit_at se setean
 * por el caller (contexto específico).
 */
export function extractUtmsFromSearchParams(params: URLSearchParams): UtmData | undefined {
  const source = clip(params.get('utm_source') ?? undefined);
  const medium = clip(params.get('utm_medium') ?? undefined);
  const campaign = clip(params.get('utm_campaign') ?? undefined);
  const content = clip(params.get('utm_content') ?? undefined);
  const term = clip(params.get('utm_term') ?? undefined);

  if (!source && !medium && !campaign && !content && !term) return undefined;

  return { source, medium, campaign, content, term };
}
```

- [ ] **Step 2: Validar que el archivo compila con TypeScript**

```bash
cd "/Users/miguelguillen/autolandia migracion typescrit/autolandia-web"
npx tsc --noEmit
```

Expected: sin errores (puede haber warnings no relacionados con este archivo).

- [ ] **Step 3: Validación manual rápida del parse**

Crear un archivo temporal `/tmp/test-utm.mjs`:
```javascript
import { parseUtmCookie, serializeUtmCookie, extractUtmsFromSearchParams } from './autolandia-web/lib/utm-tracking.ts';
// Next.js no corre .ts desde node directo; este step se omite — la validación real viene en Task 10 vía browser.
```

En lugar de eso, correr lint:
```bash
npx eslint lib/utm-tracking.ts
```
Expected: clean.

- [ ] **Step 4: Commit**

```bash
cd "/Users/miguelguillen/autolandia migracion typescrit/autolandia-web"
git add lib/utm-tracking.ts
git commit -m "feat(utm): add utm-tracking module (cookie parse/serialize/extract)"
```

---

## Task 8: Crear `lib/clarity.ts` (helper para el script de Clarity)

**Files:**
- Create: `autolandia-web/lib/clarity.ts`

- [ ] **Step 1: Crear el módulo**

`autolandia-web/lib/clarity.ts`:

```typescript
/**
 * Devuelve el snippet JS oficial de Microsoft Clarity dado un projectId.
 * Llamado desde app/layout.tsx dentro de un <Script> de next/script.
 * Si projectId es undefined/empty, el caller NO debe renderizar el script.
 */
export function getClarityScript(projectId: string): string {
  return `
    (function(c,l,a,r,i,t,y){
      c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};
      t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/"+i;
      y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y);
    })(window, document, "clarity", "script", "${projectId}");
  `;
}
```

- [ ] **Step 2: Validar que compila**

```bash
cd "/Users/miguelguillen/autolandia migracion typescrit/autolandia-web"
npx tsc --noEmit
```
Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add lib/clarity.ts
git commit -m "feat(clarity): add clarity script helper"
```

---

## Task 9: Crear `components/UtmCapture.tsx` (Client Component)

**Files:**
- Create: `autolandia-web/components/UtmCapture.tsx`

**Contexto:** Componente sin UI que captura UTMs de la URL al montar y persiste la cookie si no existía. Dispara también custom tags a Clarity.

- [ ] **Step 1: Crear el componente**

`autolandia-web/components/UtmCapture.tsx`:

```typescript
'use client';

import { useEffect } from 'react';
import { useSearchParams, usePathname } from 'next/navigation';
import {
  UTM_COOKIE_NAME,
  UTM_COOKIE_MAX_AGE_SECONDS,
  parseUtmCookie,
  serializeUtmCookie,
  extractUtmsFromSearchParams,
  type UtmData,
} from '@/lib/utm-tracking';

declare global {
  interface Window {
    clarity?: (...args: unknown[]) => void;
  }
}

function readCookie(name: string): string | undefined {
  if (typeof document === 'undefined') return undefined;
  const match = document.cookie.split('; ').find((c) => c.startsWith(`${name}=`));
  return match ? match.slice(name.length + 1) : undefined;
}

function writeCookie(name: string, value: string, maxAgeSeconds: number): void {
  if (typeof document === 'undefined') return;
  const secure = window.location.protocol === 'https:' ? '; Secure' : '';
  document.cookie = `${name}=${value}; Max-Age=${maxAgeSeconds}; Path=/; SameSite=Lax${secure}`;
}

function pushClarityTags(utm: UtmData): void {
  if (typeof window === 'undefined' || !window.clarity) return;
  window.clarity('set', 'utm_source', utm.source ?? 'direct');
  window.clarity('set', 'utm_campaign', utm.campaign ?? '-');
  window.clarity('set', 'canal', 'web');
}

export function UtmCapture() {
  const searchParams = useSearchParams();
  const pathname = usePathname();

  useEffect(() => {
    const existing = parseUtmCookie(readCookie(UTM_COOKIE_NAME));
    if (existing) {
      pushClarityTags(existing);
      return;
    }

    const params = new URLSearchParams(searchParams?.toString() ?? '');
    const incoming = extractUtmsFromSearchParams(params);
    if (!incoming) return;

    const payload: UtmData = {
      ...incoming,
      landing_page: pathname ?? '/',
      first_visit_at: new Date().toISOString(),
    };

    try {
      writeCookie(UTM_COOKIE_NAME, serializeUtmCookie(payload), UTM_COOKIE_MAX_AGE_SECONDS);
      pushClarityTags(payload);
    } catch (err) {
      console.error('[UtmCapture] error writing cookie:', err);
    }
  }, [searchParams, pathname]);

  return null;
}
```

- [ ] **Step 2: Wrapper con Suspense (requisito Next.js 16 para `useSearchParams`)**

Next.js 16 requiere que `useSearchParams()` esté dentro de `<Suspense>` boundary. El mount del componente en `layout.tsx` (Task 10) lo envuelve así:
```tsx
<Suspense fallback={null}>
  <UtmCapture />
</Suspense>
```
(Este step es documental — el wrap real ocurre en Task 10. No código en este archivo.)

- [ ] **Step 3: Validar compilación**

```bash
cd "/Users/miguelguillen/autolandia migracion typescrit/autolandia-web"
npx tsc --noEmit
```
Expected: clean.

- [ ] **Step 4: Commit**

```bash
git add components/UtmCapture.tsx
git commit -m "feat(utm): add UtmCapture client component (first-touch + Clarity tags)"
```

---

## Task 10: Montar Clarity + UtmCapture en `app/layout.tsx`

**Files:**
- Modify: `autolandia-web/app/layout.tsx`

- [ ] **Step 1: Leer el layout actual para confirmar estructura**

```bash
cat "/Users/miguelguillen/autolandia migracion typescrit/autolandia-web/app/layout.tsx"
```

- [ ] **Step 2: Reemplazar el contenido completo**

Contenido final de `autolandia-web/app/layout.tsx`:

```typescript
import type { Metadata } from 'next';
import { Suspense } from 'react';
import Script from 'next/script';
import { Inter } from 'next/font/google';
import { MetaPixel } from '@/components/MetaPixel';
import { UtmCapture } from '@/components/UtmCapture';
import { getClarityScript } from '@/lib/clarity';
import './globals.css';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'Autolandia 3.0 — Gana un BMW Serie 5 2013',
  description:
    'Participa por un BMW Serie 5 2013 Diesel. Boletos desde Gs. 20.000. Sorteo: Sabado 6 de Junio, 16:00 hs.',
  openGraph: {
    title: 'Autolandia 3.0 — Gana un BMW Serie 5',
    description: 'Boletos desde Gs. 20.000. Sorteo: 6 de Junio.',
    type: 'website',
  },
  other: {
    'facebook-domain-verification': 'fenwtxcnh3fpnvbukjd962wljtngyn',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const clarityId = process.env.NEXT_PUBLIC_CLARITY_PROJECT_ID;

  return (
    <html lang="es" className="dark">
      <body className={`${inter.className} bg-[#0a0a0f] text-white min-h-screen antialiased`}>
        <MetaPixel />
        {clarityId && (
          <Script id="clarity-init" strategy="afterInteractive">
            {getClarityScript(clarityId)}
          </Script>
        )}
        <Suspense fallback={null}>
          <UtmCapture />
        </Suspense>
        {children}
      </body>
    </html>
  );
}
```

- [ ] **Step 3: Build + lint**

```bash
cd "/Users/miguelguillen/autolandia migracion typescrit/autolandia-web"
npm run lint && npm run build
```
Expected: build exitoso. Si hay error de "NEXT_PUBLIC_CLARITY_PROJECT_ID undefined", es esperado — el escape hatch funciona (no monta el script).

- [ ] **Step 4: Commit**

```bash
git add app/layout.tsx
git commit -m "feat(layout): mount Clarity script (conditional) + UtmCapture in root layout"
```

---

## Task 11: Extender `lib/sale-registrar.ts` con params UTM

**Files:**
- Modify: `autolandia-web/lib/sale-registrar.ts`

- [ ] **Step 1: Leer el archivo actual**

```bash
cat "/Users/miguelguillen/autolandia migracion typescrit/autolandia-web/lib/sale-registrar.ts"
```

Identificar la interface `RegisterSaleInput` y las dos funciones `registrarVentaRandom` + `registrarVentaManual`.

- [ ] **Step 2: Extender la interface `RegisterSaleInput`**

Agregar al final de los campos existentes (antes del `}` de la interface):

```typescript
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
```

- [ ] **Step 3: Pasar UTMs al RPC en `registrarVentaRandom`**

En la llamada `supabase.rpc('registrar_venta_web', { ... })` de `registrarVentaRandom`, agregar los 3 params al objeto:

```typescript
const { data, error } = await supabase.rpc('registrar_venta_web', {
  p_cantidad: input.cantidad,
  // ... resto de params existentes ...
  p_is_promo_3x1: input.isPromo3x1 === true,
  p_utm_source: input.utmSource ?? null,
  p_utm_medium: input.utmMedium ?? null,
  p_utm_campaign: input.utmCampaign ?? null,
});
```

- [ ] **Step 4: Pasar UTMs al RPC en `registrarVentaManual`**

Mismos 3 params en el segundo `.rpc(...)` call de la función `registrarVentaManual`.

- [ ] **Step 5: Build + lint**

```bash
cd "/Users/miguelguillen/autolandia migracion typescrit/autolandia-web"
npm run lint && npm run build
```
Expected: clean.

- [ ] **Step 6: Commit**

```bash
git add lib/sale-registrar.ts
git commit -m "feat(sale): accept optional UTMs in RegisterSaleInput + pass to RPC"
```

---

## Task 12: Leer cookie UTM en `app/actions/register-sale.ts` y pasar a `lib/sale-registrar`

**Files:**
- Modify: `autolandia-web/app/actions/register-sale.ts`

- [ ] **Step 1: Agregar import de cookies y utm-tracking**

Al principio del archivo, agregar imports:

```typescript
import { cookies } from 'next/headers';
import { UTM_COOKIE_NAME, parseUtmCookie } from '@/lib/utm-tracking';
```

- [ ] **Step 2: Reemplazar el bloque `const saleInput = { ... }` existente**

Leer la cookie antes de construir el input y extender el objeto con los 3 campos UTM:

```typescript
// Leer UTMs de la cookie (first-touch) para snapshot en la venta
const cookieStore = await cookies();
const utm = parseUtmCookie(cookieStore.get(UTM_COOKIE_NAME)?.value);

const saleInput = {
  cantidad: input.cantidad,
  transactionId: input.transactionId,
  nombreCompleto: input.nombreCompleto,
  ci: input.ci,
  telefono: input.telefono,
  monto: input.monto,
  comprobanteUrl: input.comprobanteUrl,
  metodoPago: input.metodoPago,
  telefonoRegistro: input.telefono,
  mensajeInicial: '',
  isPromo3x1: input.isPromo3x1 === true,
  utmSource: utm?.source,
  utmMedium: utm?.medium,
  utmCampaign: utm?.campaign,
};
```

Reemplaza el `const saleInput = ...` existente (líneas ~22-34) por este bloque.

- [ ] **Step 3: Build + lint**

```bash
cd "/Users/miguelguillen/autolandia migracion typescrit/autolandia-web"
npm run lint && npm run build
```
Expected: clean. El `await cookies()` es la API de Next.js 16 (`cookies()` retorna `Promise<ReadonlyRequestCookies>`).

- [ ] **Step 4: Commit**

```bash
git add app/actions/register-sale.ts
git commit -m "feat(sale): read al_utm cookie in register-sale and forward to registrar"
```

---

## Task 13: Persistir UTMs en `leads` al signup OTP

**Files:**
- Modify: `autolandia-web/app/actions/auth-otp.ts`

**Contexto:** El flow de OTP hace INSERT en `leads` la primera vez y UPDATE en las subsiguientes. Agregamos UTMs **solo en el INSERT inicial** (first-touch en DB).

- [ ] **Step 1: Agregar imports al tope del archivo**

```typescript
import { cookies } from 'next/headers';
import { UTM_COOKIE_NAME, parseUtmCookie } from '@/lib/utm-tracking';
```

- [ ] **Step 2: Modificar el bloque `if (!existingLead) { await supabase.from('leads').insert({...}) }`**

Ubicación actual en `auth-otp.ts` líneas ~92-100. Leer la cookie y agregar las 7 columnas UTM al INSERT:

```typescript
// Leer UTMs de cookie para snapshot en el lead (first-touch)
const cookieStore = await cookies();
const utm = parseUtmCookie(cookieStore.get(UTM_COOKIE_NAME)?.value);

if (!existingLead) {
  await supabase.from('leads').insert({
    phone: cleanPhone,
    stage: 'NUEVO',
    first_contact_at: new Date().toISOString(),
    last_contact_at: new Date().toISOString(),
    total_purchases: 0,
    total_spent: 0,
    utm_source: utm?.source,
    utm_medium: utm?.medium,
    utm_campaign: utm?.campaign,
    utm_content: utm?.content,
    utm_term: utm?.term,
    utm_landing_page: utm?.landing_page,
    utm_first_visit_at: utm?.first_visit_at,
  });
} else {
  await supabase
    .from('leads')
    .update({ last_contact_at: new Date().toISOString() })
    .eq('phone', cleanPhone);
}
```

**No se agrega UTM al UPDATE del else** — first-touch significa que el lead existente NO se sobreescribe. Si el lead originalmente se creó sin UTMs (pre-deploy) y vuelve con UTMs después, se mantiene como direct. Esto es intencional según el spec.

- [ ] **Step 3: Build + lint**

```bash
cd "/Users/miguelguillen/autolandia migracion typescrit/autolandia-web"
npm run lint && npm run build
```
Expected: clean.

- [ ] **Step 4: Commit**

```bash
git add app/actions/auth-otp.ts
git commit -m "feat(auth): capture UTM cookie at signup and persist in leads (first-touch)"
```

---

## Task 14: Crear `components/admin/CanalSection.tsx` (split web/bot)

**Files:**
- Create: `autolandia-web/components/admin/CanalSection.tsx`

- [ ] **Step 1: Identificar la forma actual de llamar a `get_admin_stats` desde componentes admin**

```bash
grep -rn "get_admin_stats" "/Users/miguelguillen/autolandia migracion typescrit/autolandia-web/" --include="*.ts" --include="*.tsx"
```

Leer el archivo que hace el RPC (probablemente `app/actions/admin-stats.ts`) para entender el patrón.

- [ ] **Step 2: Crear el componente**

`autolandia-web/components/admin/CanalSection.tsx`:

```typescript
import { formatGs } from '@/lib/calculator';
import { getAdminStats } from '@/app/actions/admin-stats';

type PorCanalEntry = { ventas: number; total_gs: number };
type PorCanal = Record<string, PorCanalEntry>;

const CANAL_LABELS: Record<string, string> = {
  web: 'Web',
  bot: 'Bot (WhatsApp)',
  sin_canal: 'Histórico (sin canal)',
};

function canalLabel(key: string): string {
  return CANAL_LABELS[key] ?? key;
}

export async function CanalSection({ rangeDays }: { rangeDays: number }) {
  const stats = await getAdminStats(rangeDays);
  const porCanal: PorCanal = (stats?.por_canal as PorCanal) ?? {};

  const rows = Object.entries(porCanal)
    .map(([canal, v]) => ({ canal, ventas: v.ventas, totalGs: v.total_gs }))
    .sort((a, b) => b.totalGs - a.totalGs);

  const totalVentas = rows.reduce((acc, r) => acc + r.ventas, 0);
  const totalGs = rows.reduce((acc, r) => acc + r.totalGs, 0);

  return (
    <section>
      <header className="mb-4">
        <h2 className="text-lg font-bold">Ventas por canal</h2>
        <p className="text-xs text-white/40 mt-0.5">
          Cuántas ventas vienen por la web vs por el bot de WhatsApp
        </p>
      </header>
      <div className="glass-card p-4">
        {rows.length === 0 ? (
          <p className="text-sm text-white/50">No hay ventas en el rango seleccionado.</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="text-xs text-white/50">
              <tr>
                <th className="text-left py-2">Canal</th>
                <th className="text-right py-2">Ventas</th>
                <th className="text-right py-2">Total Gs</th>
                <th className="text-right py-2">%</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const pct = totalGs > 0 ? Math.round((r.totalGs / totalGs) * 1000) / 10 : 0;
                return (
                  <tr key={r.canal} className="border-t border-white/5">
                    <td className="py-2 font-semibold">{canalLabel(r.canal)}</td>
                    <td className="text-right py-2">{r.ventas}</td>
                    <td className="text-right py-2">{formatGs(r.totalGs)}</td>
                    <td className="text-right py-2 text-white/60">{pct.toFixed(1)}%</td>
                  </tr>
                );
              })}
              <tr className="border-t border-white/20 font-bold">
                <td className="py-2">Total</td>
                <td className="text-right py-2">{totalVentas}</td>
                <td className="text-right py-2">{formatGs(totalGs)}</td>
                <td className="text-right py-2">100%</td>
              </tr>
            </tbody>
          </table>
        )}
      </div>
    </section>
  );
}
```

**Nota:** `getAdminStats` debe retornar un objeto que incluye `por_canal` (jsonb). Si el server action `app/actions/admin-stats.ts` ya existe y no devuelve este campo, extenderlo en el próximo step.

- [ ] **Step 3: Verificar / extender `app/actions/admin-stats.ts` para que devuelva `por_canal`**

Leer:
```bash
cat "/Users/miguelguillen/autolandia migracion typescrit/autolandia-web/app/actions/admin-stats.ts"
```

Si el tipo de retorno omite `por_canal`, agregarlo. Ejemplo mínimo (el archivo real puede diferir):

```typescript
export interface AdminStats {
  total_ventas: number;
  total_monto: number;
  total_boletos: number;
  ventas_hoy: number;
  monto_hoy: number;
  daily_sales: { fecha: string; ventas: number; monto: number }[] | null;
  por_canal: Record<string, { ventas: number; total_gs: number }> | null;
}

export async function getAdminStats(rangeDays: number): Promise<AdminStats | null> {
  const supabase = createServerClient();
  const { data, error } = await supabase.rpc('get_admin_stats', { p_range_days: rangeDays });
  if (error) {
    console.error('get_admin_stats error:', error.message);
    return null;
  }
  return Array.isArray(data) ? data[0] : data;
}
```

Usar el patrón existente — solo agregar el campo `por_canal` al tipo de retorno si falta.

- [ ] **Step 4: Build + lint**

```bash
cd "/Users/miguelguillen/autolandia migracion typescrit/autolandia-web"
npm run lint && npm run build
```
Expected: clean.

- [ ] **Step 5: Commit**

```bash
git add components/admin/CanalSection.tsx app/actions/admin-stats.ts
git commit -m "feat(admin): add CanalSection showing web/bot split from get_admin_stats"
```

---

## Task 15: Crear `components/admin/AttributionSection.tsx` (tabla source+campaign)

**Files:**
- Create: `autolandia-web/components/admin/AttributionSection.tsx`
- Create: `autolandia-web/app/actions/attribution-stats.ts`

- [ ] **Step 1: Crear el server action `attribution-stats.ts`**

`autolandia-web/app/actions/attribution-stats.ts`:

```typescript
'use server';
import { createServerClient } from '@/lib/supabase-server';
import { requireAdmin } from '@/lib/admin-auth';

export interface AttributionRow {
  source: string;
  campaign: string;
  ventas_count: number;
  total_gs: number;
  pct_total: number;
}

export async function getAttributionStats(rangeDays: number): Promise<AttributionRow[]> {
  await requireAdmin();
  const supabase = createServerClient();
  const { data, error } = await supabase.rpc('get_attribution_stats', { p_range_days: rangeDays });
  if (error) {
    console.error('get_attribution_stats error:', error.message);
    return [];
  }
  return (data as AttributionRow[]) ?? [];
}
```

- [ ] **Step 2: Crear el componente**

`autolandia-web/components/admin/AttributionSection.tsx`:

```typescript
import { formatGs } from '@/lib/calculator';
import { getAttributionStats } from '@/app/actions/attribution-stats';

const SOURCE_LABELS: Record<string, string> = {
  meta: 'Meta Ads',
  tiktok: 'TikTok Ads',
  whatsapp: 'WhatsApp',
  direct: 'Directo',
  influencer: 'Influencer',
  email: 'Email',
};

function sourceLabel(s: string): string {
  return SOURCE_LABELS[s] ?? s;
}

export async function AttributionSection({ rangeDays }: { rangeDays: number }) {
  const rows = await getAttributionStats(rangeDays);

  return (
    <section>
      <header className="mb-4">
        <h2 className="text-lg font-bold">Ventas por medio (atribución)</h2>
        <p className="text-xs text-white/40 mt-0.5">
          First-touch UTMs. Convención en <code className="text-white/60">docs/utm-conventions.md</code>.
        </p>
      </header>
      <div className="glass-card p-4 overflow-x-auto">
        {rows.length === 0 ? (
          <p className="text-sm text-white/50">No hay ventas en el rango seleccionado.</p>
        ) : (
          <table className="w-full text-sm min-w-[520px]">
            <thead className="text-xs text-white/50">
              <tr>
                <th className="text-left py-2">Source</th>
                <th className="text-left py-2">Campaña</th>
                <th className="text-right py-2">Ventas</th>
                <th className="text-right py-2">Total Gs</th>
                <th className="text-right py-2">%</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, idx) => (
                <tr key={`${r.source}-${r.campaign}-${idx}`} className="border-t border-white/5">
                  <td className="py-2 font-semibold">{sourceLabel(r.source)}</td>
                  <td className="py-2 text-white/70">{r.campaign}</td>
                  <td className="text-right py-2">{r.ventas_count}</td>
                  <td className="text-right py-2">{formatGs(r.total_gs)}</td>
                  <td className="text-right py-2 text-white/60">{r.pct_total.toFixed(1)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </section>
  );
}
```

- [ ] **Step 3: Build + lint**

```bash
cd "/Users/miguelguillen/autolandia migracion typescrit/autolandia-web"
npm run lint && npm run build
```
Expected: clean.

- [ ] **Step 4: Commit**

```bash
git add app/actions/attribution-stats.ts components/admin/AttributionSection.tsx
git commit -m "feat(admin): add AttributionSection + getAttributionStats server action"
```

---

## Task 16: Montar nuevas secciones en `app/admin/page.tsx`

**Files:**
- Modify: `autolandia-web/app/admin/page.tsx`

- [ ] **Step 1: Decidir el rango por default**

Usar `30` días como default (alineado con `DashboardStats`, chequear en el código si difiere). Si el dashboard ya tiene selector propio, los componentes nuevos reciben su mismo valor.

- [ ] **Step 2: Imports + render**

En `app/admin/page.tsx`, agregar imports al tope:

```typescript
import { CanalSection } from '@/components/admin/CanalSection';
import { AttributionSection } from '@/components/admin/AttributionSection';
```

Y agregar las dos secciones dentro del JSX, entre Section 1 (DashboardStats) y Section 2 (Sorteos laterales):

```tsx
{/* ─── Sección 1.5: Ventas por canal ─── */}
<CanalSection rangeDays={30} />

{/* ─── Sección 1.6: Ventas por medio (atribución) ─── */}
<AttributionSection rangeDays={30} />
```

- [ ] **Step 3: Build + lint**

```bash
cd "/Users/miguelguillen/autolandia migracion typescrit/autolandia-web"
npm run lint && npm run build
```
Expected: clean.

- [ ] **Step 4: Commit**

```bash
git add app/admin/page.tsx
git commit -m "feat(admin): mount CanalSection + AttributionSection in admin page"
```

---

## Task 17: Actualizar `app/privacidad/page.tsx` con mención de Clarity

**Files:**
- Modify: `autolandia-web/app/privacidad/page.tsx`

- [ ] **Step 1: Leer el archivo actual**

```bash
cat "/Users/miguelguillen/autolandia migracion typescrit/autolandia-web/app/privacidad/page.tsx"
```

- [ ] **Step 2: Agregar un bloque de sección "Analytics" o "Cookies y servicios de terceros"**

Insertar (sin borrar el resto) una sección nueva con este contenido en español:

```tsx
<section className="mb-6">
  <h2 className="text-lg font-bold mb-2">Cookies y analítica</h2>
  <p className="text-sm text-white/70">
    Utilizamos Microsoft Clarity para entender cómo los usuarios usan el sitio y mejorarlo.
    Clarity recolecta interacciones (clicks, scrolls, navegación) de forma anónima y enmascara
    el contenido de campos de formulario (teléfono, CI). No recolectamos información personal
    identificable a través de esta herramienta. Más info en{' '}
    <a
      href="https://privacy.microsoft.com/privacystatement"
      target="_blank"
      rel="noopener noreferrer"
      className="underline"
    >
      la política de privacidad de Microsoft
    </a>.
  </p>
  <p className="text-sm text-white/70 mt-2">
    También usamos cookies propias (como <code className="text-white/60">al_utm</code>) para
    recordar de qué anuncio llegaste. Esto nos ayuda a decidir qué campañas funcionan mejor
    y no se comparte con terceros.
  </p>
</section>
```

Elegir la ubicación que mejor encaje con el orden existente.

- [ ] **Step 3: Build + lint**

```bash
cd "/Users/miguelguillen/autolandia migracion typescrit/autolandia-web"
npm run lint && npm run build
```

- [ ] **Step 4: Commit**

```bash
git add app/privacidad/page.tsx
git commit -m "docs(privacidad): add section about Clarity + al_utm cookie"
```

---

## Task 18: Actualizar `Dockerfile` DEV con env var de Clarity DEV

**Files:**
- Modify: `autolandia-web/Dockerfile` (branch `develop` solamente — NUNCA merge a main)

**Contexto:** El ID del proyecto Clarity DEV debe estar creado en clarity.microsoft.com antes de este step. Anotarlo aquí como variable.

- [ ] **Step 1: Crear el proyecto Clarity DEV manualmente**

1. Ir a https://clarity.microsoft.com → signin
2. Create new project: name `autolandia-dev`, website URL `https://autolandiabot-fulll-autolandia-web.wrkyu1.easypanel.host`
3. Copiar el Project ID (string tipo `xxxxxxxxxx`)

- [ ] **Step 2: Agregar `ENV NEXT_PUBLIC_CLARITY_PROJECT_ID=...` al Dockerfile**

En `autolandia-web/Dockerfile`, en el stage `builder`, cerca de los otros `ENV NEXT_PUBLIC_*`, agregar:

```dockerfile
ENV NEXT_PUBLIC_CLARITY_PROJECT_ID=<DEV_CLARITY_ID>
```

- [ ] **Step 3: Build local para verificar que Next embebe la variable**

```bash
cd "/Users/miguelguillen/autolandia migracion typescrit/autolandia-web"
docker build -t autolandia-web-test . 2>&1 | tail -10
```

Si no hay docker local, saltar — se valida en el deploy DEV de Task 22.

- [ ] **Step 4: Commit**

```bash
git add Dockerfile
git commit -m "chore(deploy): add Clarity DEV project id to Dockerfile (develop)"
```

---

## Task 19: Crear `docs/utm-conventions.md`

**Files:**
- Create: `autolandia-web/docs/utm-conventions.md`

- [ ] **Step 1: Crear el documento**

`autolandia-web/docs/utm-conventions.md`:

````markdown
# Convenciones de UTMs — Autolandia

Este documento define cómo etiquetar los links que usamos en anuncios y canales
orgánicos para que el dashboard `/admin` muestre ventas atribuidas correctamente.

## Esquema

| Medio                         | `utm_source` | `utm_medium` | `utm_campaign` (ejemplos)                      |
|-------------------------------|--------------|--------------|------------------------------------------------|
| Meta Ads (Facebook/Instagram) | `meta`       | `paid`       | `lanzamiento_abril`, `retargeting`, `mini_sorteos` |
| TikTok Ads                    | `tiktok`     | `paid`       | `video_auto_a`, `creative_b_test`              |
| WhatsApp (link desde bot)     | `whatsapp`   | `organic`    | `bot_redirect`, `bot_promo_2x1`                |
| Influencer / colab paga       | `influencer` | `paid`       | nombre del colaborador, ej: `juan_perez`       |
| Email / newsletter            | `email`      | `email`      | nombre campaña                                  |
| Sin UTMs                      | (default `direct`) | —      | —                                              |

## Reglas

- Solo **lowercase**, **snake_case**, sin espacios ni acentos.
- `utm_campaign` libre, pero nombres legibles (`lanzamiento_abril` > `camp_001`).
- En Meta/TikTok Ads Manager, usar el campo "URL Parameters" para inyectar UTMs automáticamente en cada click.

## Ejemplo de link Meta

```
https://autolandia.com.py/?utm_source=meta&utm_medium=paid&utm_campaign=lanzamiento_abril
```

## Ejemplo de link TikTok

```
https://autolandia.com.py/?utm_source=tiktok&utm_medium=paid&utm_campaign=video_auto_a
```

## Modelo de atribución

**First-touch**, cookie `al_utm` 180 días. Si el usuario llega primero por Meta y después
por WhatsApp y compra, la venta se atribuye a **Meta**. Si la cookie expira o el usuario
borra cookies, el próximo touch con UTMs sobreescribe.

## Dónde se refleja

- `ventas.utm_source / utm_medium / utm_campaign` — snapshot al momento de la venta.
- `leads.utm_*` (7 cols) — first-touch al primer signup.
- `/admin` → sección "Ventas por medio" — tabla source+campaign con `%` del total.
- Dashboard Clarity → filtro por custom tag `utm_source`.

## Links estandarizados actualmente en uso

| Medio                     | URL                                                                                                |
|---------------------------|----------------------------------------------------------------------------------------------------|
| Bot WhatsApp post-2x1     | `https://www.autolandia.com.py/?utm_source=whatsapp&utm_medium=organic&utm_campaign=bot_redirect`  |
````

- [ ] **Step 2: Commit**

```bash
cd "/Users/miguelguillen/autolandia migracion typescrit/autolandia-web"
git add docs/utm-conventions.md
git commit -m "docs: add UTM conventions reference for ads and organic links"
```

---

## Task 20: Bot — agregar `canal='bot'` al INSERT de ventas

**Files:**
- Modify: `autolandia-bot/src/services/sale-registrar.ts:43-62`

- [ ] **Step 1: Leer archivo y confirmar estructura**

```bash
cat "/Users/miguelguillen/autolandia migracion typescrit/autolandia-bot/src/services/sale-registrar.ts"
```

Localizar el `INSERT INTO ventas (...)`. Verificar columnas actuales.

- [ ] **Step 2: Modificar el INSERT para incluir `canal`**

En el bloque `INSERT INTO ventas (...) VALUES (...)`:

- Agregar `canal` al final de la lista de columnas (después de `mensaje_inicial`).
- Agregar `'bot'` al final de los VALUES.

Resultado esperado:

```typescript
INSERT INTO ventas (
  ticket_id, transaction_id, nombre_completo, ci, telefono,
  monto, cantidad, comprobante_url, metodo_pago, fecha,
  telefono_registro, numeros_asignados, mensaje_inicial,
  canal
)
VALUES (
  (SELECT 'TK-' || (COALESCE(MAX(CAST(SUBSTRING(ticket_id FROM '[0-9]+') AS INTEGER)), 999) + 1) FROM ventas),
  ${input.transactionId},
  ${input.nombreCompleto},
  ${input.ci},
  ${input.telefono},
  ${input.monto},
  ${input.cantidad},
  ${input.comprobanteUrl},
  ${input.metodoPago},
  NOW(),
  ${input.telefonoRegistro},
  (SELECT array_numeros FROM formato_array),
  ${input.mensajeInicial},
  'bot'
)
```

- [ ] **Step 3: Verificar compilación TypeScript**

```bash
cd "/Users/miguelguillen/autolandia migracion typescrit/autolandia-bot"
npx tsc --noEmit
```
Expected: clean.

- [ ] **Step 4: Correr tests existentes del bot**

```bash
npm test
```
Expected: pasan (los tests de calculator/referral no dependen de este cambio).

- [ ] **Step 5: Commit**

```bash
cd "/Users/miguelguillen/autolandia migracion typescrit/autolandia-bot"
git add src/services/sale-registrar.ts
git commit -m "feat(sale): tag bot sales with canal='bot' in ventas INSERT"
```

---

## Task 21: Bot — actualizar links a la web con UTMs

**Files:**
- Modify: `autolandia-bot/src/conversation/handlers/promo-2x1.ts`
- (Posibles) Modify: cualquier otro archivo del bot que contenga `autolandia.com.py`

- [ ] **Step 1: Grep de todos los links a la web en el código del bot**

```bash
cd "/Users/miguelguillen/autolandia migracion typescrit/autolandia-bot"
grep -rn "autolandia.com.py" src/ --include="*.ts"
```

Listar los archivos y líneas encontradas.

- [ ] **Step 2: Reemplazar cada ocurrencia**

Para cada `https://www.autolandia.com.py` o `https://autolandia.com.py` (sin query string), reemplazar por:

```
https://www.autolandia.com.py/?utm_source=whatsapp&utm_medium=organic&utm_campaign=bot_redirect
```

Si algún link ya tiene query string (ej `?ref=xyz`), concatenar con `&` en vez de `?`:
```
https://www.autolandia.com.py/?ref=xyz&utm_source=whatsapp&utm_medium=organic&utm_campaign=bot_redirect
```

Para mantener consistencia, considerar crear una constante en `src/config.ts`:

```typescript
export const WEB_URL_WITH_UTMS = 'https://www.autolandia.com.py/?utm_source=whatsapp&utm_medium=organic&utm_campaign=bot_redirect';
```

E importarla donde se use. (Es optional refactor; si hay solo 1 o 2 usos, inline es OK.)

- [ ] **Step 3: Verificar que no quedó ningún link sin UTMs**

```bash
grep -rn "autolandia.com.py" src/ --include="*.ts" | grep -v "utm_source"
```
Expected: vacío (todos los links tienen UTMs).

- [ ] **Step 4: Compilación + tests**

```bash
cd "/Users/miguelguillen/autolandia migracion typescrit/autolandia-bot"
npx tsc --noEmit && npm test
```
Expected: clean.

- [ ] **Step 5: Commit**

```bash
git add src/
git commit -m "feat(bot): add UTMs to all autolandia.com.py links (whatsapp/organic/bot_redirect)"
```

---

## Task 22: Deploy DEV + QA manual end-to-end

**Files:** (ningún cambio de código — solo push y validación)

**Contexto:** Con todos los commits anteriores en `develop` de ambos repos, Easypanel redeploya automáticamente DEV al push.

- [ ] **Step 1: Push ambos repos**

```bash
cd "/Users/miguelguillen/autolandia migracion typescrit/autolandia-web"
git push origin develop

cd "/Users/miguelguillen/autolandia migracion typescrit/autolandia-bot"
git push origin develop
```

- [ ] **Step 2: Esperar redeploy de ambas apps en Easypanel**

Abrir Easypanel UI. Verificar que `autolandia-web` (DEV) y `autolandiabot-fulll-autolandia-bot-full` (DEV) terminaron el build en verde. Tiempo esperado: 3-5 min cada uno.

Verificar logs del container web buscando `- Local: http://localhost:3000` (server up).

- [ ] **Step 3: Test manual — visita con UTMs en web DEV**

Abrir en browser (preferiblemente incógnito para limpiar cookies previas):

```
https://autolandiabot-fulll-autolandia-web.wrkyu1.easypanel.host/?utm_source=meta&utm_medium=paid&utm_campaign=test_dev
```

Validaciones:
- DevTools → Application → Cookies → domain wrkyu1.easypanel.host → aparece cookie `al_utm` con valor URL-encoded que contiene `"source":"meta"`.
- DevTools → Network → filtrar por `clarity.ms` → debería haber al menos 1 request a `https://www.clarity.ms/tag/<DEV_CLARITY_ID>`.
- Console: no errors.

- [ ] **Step 4: Test manual — signup completa en DEV**

Completar OTP con un número válido de prueba (usar uno en whitelist Twilio).

En Supabase DEV, verificar:
```sql
SELECT phone, utm_source, utm_medium, utm_campaign, utm_landing_page, utm_first_visit_at
FROM leads
WHERE phone = '<phone_de_prueba>';
```
Expected: `utm_source='meta'`, `utm_campaign='test_dev'`, `utm_landing_page='/'`, `utm_first_visit_at` con timestamp reciente.

- [ ] **Step 5: Test manual — compra completa web DEV**

Completar flow de compra (1 boleto, subir comprobante de prueba).

En Supabase DEV:
```sql
SELECT ticket_id, canal, utm_source, utm_campaign
FROM ventas
ORDER BY fecha DESC
LIMIT 1;
```
Expected: `canal='web'`, `utm_source='meta'`, `utm_campaign='test_dev'`.

- [ ] **Step 6: Test manual — compra completa bot DEV**

Iniciar conversación con el bot DEV (WhatsApp test number registrado en Meta app `pruebasDev`). Completar compra de 1 boleto.

En Supabase DEV:
```sql
SELECT ticket_id, canal
FROM ventas
ORDER BY fecha DESC
LIMIT 1;
```
Expected: `canal='bot'`. Las columnas UTM pueden ser NULL (el bot no captura UTMs para sus ventas, es esperado — el tracking es web-only).

- [ ] **Step 7: Test manual — admin dashboard DEV**

Login admin DEV (`/admin/login`). Ver:
- Tarjeta "Ventas por canal": al menos 2 filas (web=1, bot=1).
- Tabla "Ventas por medio": fila `meta · test_dev : 1 venta` + fila `direct : N` (histórico).

- [ ] **Step 8: Test manual — Clarity dashboard**

Abrir clarity.microsoft.com proyecto `autolandia-dev`.
- Dashboard → Recordings → debería aparecer al menos 1 sesión con el tag `utm_source=meta`.
- Filter → Custom tags → `utm_source` = `meta`.

- [ ] **Step 9: Test manual — edge case first-touch**

En mismo browser, sin limpiar cookies, abrir:
```
https://autolandiabot-fulll-autolandia-web.wrkyu1.easypanel.host/?utm_source=tiktok&utm_campaign=test_override
```

DevTools → Application → Cookies → `al_utm` sigue siendo el mismo (meta). First-touch respetado.

- [ ] **Step 10: Test manual — edge case sin UTMs**

Nuevo browser incógnito, abrir raíz sin UTMs:
```
https://autolandiabot-fulll-autolandia-web.wrkyu1.easypanel.host/
```

DevTools → Cookies → NO existe `al_utm` (no se creó porque no había UTMs). Completar compra → `canal='web'`, `utm_source=NULL` en `ventas`. En admin se agrupa como `direct`.

- [ ] **Step 11: Si algo falla, debug + fix en develop → re-push → retry**

Si cualquier test falla:
1. Ver logs del container en Easypanel.
2. Reproducir el bug, fixear en develop.
3. Commit, push, esperar redeploy, retry desde el test que falló.

Si todos pasan → continuar a Task 23.

**No commit en este task** — solo QA.

---

## Task 23: Preparar PROD — Dockerfile main + backup función PROD

**Files:**
- Modify: `autolandia-web/Dockerfile` (en branch `main` — valor PROD)
- Create: actualización del backup con la versión PROD (puede ser igual a DEV si las funciones estaban sincronizadas, pero se verifica)

- [ ] **Step 1: Crear el proyecto Clarity PROD manualmente**

1. clarity.microsoft.com → new project: name `autolandia-prod`, URL `https://autolandia.com.py`.
2. Copiar Project ID.

- [ ] **Step 2: Switch a branch `main` en autolandia-web**

```bash
cd "/Users/miguelguillen/autolandia migracion typescrit/autolandia-web"
git checkout main
git pull origin main
```

- [ ] **Step 3: Editar `Dockerfile` (valores PROD) para agregar Clarity PROD ID**

En el `Dockerfile` de main, stage `builder`, agregar:
```dockerfile
ENV NEXT_PUBLIC_CLARITY_PROJECT_ID=<PROD_CLARITY_ID>
```

Cerca de los otros `ENV NEXT_PUBLIC_*` que ya existen en main (los valores de Supabase PROD, Meta Pixel PROD, etc.).

- [ ] **Step 4: Verificar que la función PROD tiene la misma signature que el backup DEV**

Via MCP Supabase contra proyecto PROD (`xtwrmcbvjgywwdpdwoxw`):
```sql
SELECT pg_get_functiondef(oid)
FROM pg_proc
WHERE proname = 'registrar_venta_web';
```

Comparar con `autolandia-web/sql/registrar_venta_web_v_pre_utm.sql`. Si son idénticas (esperado, mismo schema DEV/PROD), no hay nada más que hacer. Si difieren, **DETENER y sincronizar primero**.

- [ ] **Step 5: Commit en main (SOLO el Dockerfile; NO traer ningún otro cambio aún)**

```bash
git add Dockerfile
git commit -m "chore(deploy): add Clarity PROD project id to Dockerfile (main)"
```

**NO push todavía.** El push detonaría redeploy PROD con código viejo + Dockerfile nuevo, lo cual es seguro (Clarity script se monta pero no rompe nada). Pero preferimos deploys coordinados.

---

## Task 24: Aplicar migraciones SQL en PROD

**Files:** Target DB: Supabase PROD.

**Contexto:** Aplicamos migraciones idénticas a DEV, en el mismo orden. Después probamos que el código viejo sigue funcionando (defensivo antes de traer código nuevo).

- [ ] **Step 1: Aplicar migración 1 — ALTER leads (idéntica a Task 2)**

Via MCP, `apply_migration` con name `extend_leads_utms` contra proyecto PROD, misma query de Task 2.

- [ ] **Step 2: Aplicar migración 2 — ALTER ventas (idéntica a Task 3)**

`apply_migration` con name `extend_ventas_utms_canal`, misma query.

- [ ] **Step 3: Aplicar migración 3 — UPDATE registrar_venta_web (idéntica a Task 4)**

Antes: ya validada en DEV. Aplicar vía MCP.

Inmediatamente después, ejecutar las mismas verificaciones de Task 4 (Steps 4-7) contra PROD: llamada sin UTMs, llamada con UTMs, cleanup.

- [ ] **Step 4: Aplicar migración 4 — DROP+CREATE get_admin_stats (idéntica a Task 5)**

- [ ] **Step 5: Aplicar migración 5 — CREATE get_attribution_stats (idéntica a Task 6)**

- [ ] **Step 6: Smoke test — SELECT del admin stats PROD**

```sql
SELECT por_canal FROM get_admin_stats(7);
SELECT * FROM get_attribution_stats(7);
```
Expected: ambos devuelven sin error. `por_canal` tiene al menos `sin_canal` (histórico).

---

## Task 25: Test 1 PROD — compra de prueba real con código viejo

**Files:** (ningún cambio — solo test en vivo)

**Contexto:** En este punto, PROD tiene schema nuevo pero código viejo. El RPC `registrar_venta_web` ahora acepta 3 params UTM opcionales con `DEFAULT NULL`. El código viejo no los pasa → funciona igual. Lo validamos con una compra real.

- [ ] **Step 1: Comprar 1 boleto en autolandia.com.py**

Con tu número registrado. Completar el flow full.

Monto: 20.000 Gs (pack 1 boleto).

- [ ] **Step 2: Verificar la venta en Supabase PROD**

```sql
SELECT ticket_id, canal, utm_source, utm_campaign
FROM ventas
ORDER BY fecha DESC
LIMIT 1;
```
Expected: `canal='web'` (la función lo setea internamente), `utm_*=NULL` (código viejo no pasa UTMs).

- [ ] **Step 3: Verificar que la notificación Telegram llegó + la fila se creó en Sheets "Ventas"**

Verificar en el grupo Telegram "NUEVA VENTA (WEB)" con los datos correctos. En Sheets, última fila tiene todos los campos.

- [ ] **Step 4: Si algo falla, rollback inmediato**

Rollback steps:
```sql
-- Re-aplicar backup de registrar_venta_web
\i sql/registrar_venta_web_v_pre_utm.sql
-- (o via MCP: execute_sql con el contenido del archivo)
```

Después investigar la causa. El paso de rollback deja PROD igual que antes de Task 24 para la función. Las ALTER TABLE quedan aplicadas pero son idempotentes y no rompen nada.

Si rollback activo → detener el deploy, debuggear en DEV, iterar, volver a Task 24 cuando esté fixeado.

Si todo OK → continuar a Task 26.

**No commit.**

---

## Task 26: Cherry-pick bot a `main` + deploy + test 2

**Files:** Branch main de `autolandia-bot`.

- [ ] **Step 1: Listar commits pendientes en develop del bot**

```bash
cd "/Users/miguelguillen/autolandia migracion typescrit/autolandia-bot"
git log main..develop --oneline
```

Identificar los commits de Tasks 20 y 21 (y cualquier fix durante Task 22).

- [ ] **Step 2: Cherry-pick cada commit a main**

```bash
git checkout main
git pull origin main
git cherry-pick <hash_commit_task_20> <hash_commit_task_21> <hash_commits_fixes_si_aplica>
```

- [ ] **Step 3: Push a main**

```bash
git push origin main
```

- [ ] **Step 4: Esperar redeploy bot PROD**

Easypanel app `autolandiabot-fulll-production-bot-autolandia` redeploya. Ver logs hasta `Bot started successfully`.

- [ ] **Step 5: Test 2 — compra de prueba bot PROD**

En WhatsApp contactar al bot PROD, completar compra de 1 boleto.

Verificar en Supabase PROD:
```sql
SELECT ticket_id, canal FROM ventas ORDER BY fecha DESC LIMIT 1;
```
Expected: `canal='bot'`.

Si falla → revisar logs, no hay rollback automático (el cambio es 1 línea); si hace falta, revert del cherry-pick.

---

## Task 27: Cherry-pick web a `main` + deploy + test 3 final

**Files:** Branch main de `autolandia-web`.

- [ ] **Step 1: Listar commits pendientes en develop de web**

```bash
cd "/Users/miguelguillen/autolandia migracion typescrit/autolandia-web"
git log main..develop --oneline
```

Identificar commits de Tasks 1, 7-17, 19 (omitir Task 18 — el Dockerfile de develop NO se cherry-pickea; el de main ya está actualizado desde Task 23).

- [ ] **Step 2: Cherry-pick excluyendo el Dockerfile de develop**

```bash
git checkout main
git pull origin main

# Ejemplo: si el commit del Dockerfile (Task 18) es <hash_18>, skipearlo
git cherry-pick <hash_1> <hash_7> <hash_8> <hash_9> <hash_10> <hash_11> <hash_12> <hash_13> <hash_14> <hash_15> <hash_16> <hash_17> <hash_19>
```

Si algún cherry-pick tiene conflicto con el Dockerfile (porque Task 18 tocó una línea cercana al de main), resolver manteniendo los valores de main (que son los PROD). Continuar con `git cherry-pick --continue`.

- [ ] **Step 3: Push a main**

```bash
git push origin main
```

- [ ] **Step 4: Esperar redeploy web PROD**

App `autolandia-web-prod`. Verificar logs hasta server up en puerto 3000.

- [ ] **Step 5: Test 3 — verificación completa PROD**

1. Abrir (incógnito):
   ```
   https://autolandia.com.py/?utm_source=manual_check&utm_medium=paid&utm_campaign=final_test
   ```
2. DevTools → Cookies → `al_utm` con `source=manual_check`.
3. DevTools → Network → request a `clarity.ms/tag/<PROD_ID>`.
4. Completar compra de 1 boleto.
5. Verificar en Supabase PROD:
   ```sql
   SELECT ticket_id, canal, utm_source, utm_campaign
   FROM ventas
   ORDER BY fecha DESC
   LIMIT 1;
   ```
   Expected: `canal='web'`, `utm_source='manual_check'`, `utm_campaign='final_test'`.
6. Abrir `/admin` en PROD, login TOTP, verificar:
   - Tarjeta "Ventas por canal": aparece web (con la venta nueva).
   - Tabla "Ventas por medio": aparece `manual_check · final_test : 1 venta`.
7. Abrir clarity.microsoft.com proyecto `autolandia-prod`, filtrar por `utm_source=manual_check`, ver sesión grabada.

- [ ] **Step 6: Si Test 3 falla**

Rollback del cherry-pick web a main:
```bash
git revert <hash_del_merge_o_cherry_picks>
git push origin main
```

El bot sigue funcionando (Task 26 no tiene dependencia circular con web). Los datos en DB quedan consistentes (las cols UTM quedan NULL y el frontend admin las muestra como `direct` / `sin_canal`).

Debuggear en DEV, fixear, iterar.

- [ ] **Step 7: Cleanup del ticket de prueba (si hace falta)**

```sql
-- Opción A: dejar la venta de prueba en el histórico (no molesta)
-- Opción B: anular vía SQL (hay flujo existente en autolandia-bot para esto)
```

Preferencia: opción A. Es una venta real de 20k, queda en el histórico.

- [ ] **Step 8: Confirmar que el proyecto está live**

Mandar mensaje a Paul: "Tracking Clarity + UTMs live en PROD. Revisar `/admin` para ver la nueva sección de ventas por canal y por medio."

---

## Checklist final (verificación post-deploy)

- [ ] Cookie `al_utm` se setea al landing con UTMs.
- [ ] Clarity dashboard PROD recibe sesiones con tag `utm_source`.
- [ ] `leads.utm_*` se llena al signup (solo si cookie existe).
- [ ] `ventas.utm_*` snapshot al momento de compra.
- [ ] `ventas.canal` = 'web' en compras web, 'bot' en compras bot.
- [ ] `/admin` muestra 2 tarjetas nuevas (canal + atribución).
- [ ] `docs/utm-conventions.md` accesible en el repo.
- [ ] `sql/registrar_venta_web_v_pre_utm.sql` committeado como referencia.
- [ ] Política de privacidad actualizada.

## Out of scope (no incluido, por diseño)

- Cookie consent banner.
- Backfill de `canal` en ventas históricas.
- Multi-touch attribution.
- Tracking de `gclid`/`fbclid`/`utm_id`.
- UTMs en las ventas hechas desde el bot (bot solo setea `canal='bot'`, no UTMs).
- Gráficos de tendencia por medio — solo tabla.

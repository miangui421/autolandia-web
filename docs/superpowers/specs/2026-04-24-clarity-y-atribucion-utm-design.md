# Spec — Microsoft Clarity + Atribución de medios (UTMs)

**Fecha:** 2026-04-24
**Autor:** Miguel + Claude
**Estado:** Aprobado, listo para plan de implementación
**Repos afectados:** `autolandia-web` + `autolandia-bot`
**Branches:** `develop` → DEV → cherry-pick → `main` → PROD

---

## 1. Objetivo

Agregar dos capacidades complementarias al ecosistema Autolandia:

1. **Microsoft Clarity** en la web pública para visualizar comportamiento de usuarios (heatmaps, session recordings).
2. **Atribución de ventas a medios publicitarios** (UTMs first-touch) para saber qué canal — Meta Ads, TikTok Ads, WhatsApp orgánico, directo — está generando ventas y con qué campaña, permitiendo decidir presupuesto.

Como subproducto, se agrega también la **discriminación web vs bot** en `ventas` (que hoy solo existe en Google Sheets), para que el dashboard admin muestre cuántas ventas vienen por cada canal.

## 2. Decisiones de diseño cerradas

| Decisión | Valor | Razón |
|---|---|---|
| Alcance | Analytics + atribución completa de ventas | El usuario quiere decidir presupuesto de ads, no solo visibilidad |
| Modelo de atribución | **First-touch** (180 días en cookie) | Mide el medio que generó el descubrimiento; lo natural cuando se paga publicidad |
| Granularidad | source + campaign | Suficiente para decidir presupuesto por campaña sin overhead de etiquetar cada creativo |
| Medios trackeados | Meta Ads, TikTok Ads, WhatsApp orgánico, `direct` (fallback) | Lo que el usuario maneja hoy |
| Backfill de canal histórico | NO se backfillea — se deja `NULL` y el reporte lo muestra como "histórico (s/canal)" | Histórico ya es visible en stats agregados; no aporta valor el esfuerzo de mapear desde Sheets |
| Workflow | develop → DEV → QA → cherry-pick a main → PROD | Estándar del proyecto. Mitigación de riesgo en cambios SQL críticos |
| Cuentas Clarity | Una para DEV y otra para PROD (dos proyectos) | No mezclar datos de testing con producción |

## 3. Arquitectura general

### 3.1 Componentes nuevos en `autolandia-web`

| Componente | Tipo | Propósito |
|---|---|---|
| `lib/clarity.ts` | módulo | Helper que devuelve el script de Clarity dado un project ID. No se monta si la env var está vacía (escape hatch para localhost). |
| `lib/utm-tracking.ts` | módulo | Lee/escribe la cookie `al_utm`. Helper `readUtmsFromCookie()` server-side y `captureFromUrl()` client-side. Lógica first-touch (no sobreescribe). |
| `components/UtmCapture.tsx` | Client Component | Sin UI. Renderizado en `app/layout.tsx`. Lee `useSearchParams()`, llama a `captureFromUrl()` en `useEffect`, push de tags a Clarity vía `window.clarity('set', ...)`. |
| `components/admin/CanalSection.tsx` | Server Component | Tarjeta del dashboard admin con split web/bot/histórico. Consume el RPC ampliado `get_admin_stats`. |
| `components/admin/AttributionSection.tsx` | Server Component | Tabla de ventas por source+campaign. Consume `get_attribution_stats`. |
| `docs/utm-conventions.md` | doc | Convención fija de UTMs por medio. Referencia para Paul al crear campañas. |

### 3.2 Componentes modificados

**`autolandia-web`:**

- `app/layout.tsx` — montar script Clarity (server-side) + `<UtmCapture />` client component.
- `app/admin/page.tsx` — renderizar `CanalSection` y `AttributionSection`.
- `app/actions/register-sale.ts` — leer cookie `al_utm` vía `cookies()` de Next.js, agregar UTMs al `RegisterSaleInput` antes de llamar a `lib/sale-registrar.ts`.
- `lib/sale-registrar.ts` — extender la interface `RegisterSaleInput` con `utm_source/medium/campaign` opcionales; las funciones `registrarVentaRandom` y `registrarVentaManual` (ambas) pasan los nuevos params al RPC `registrar_venta_web`.
- `app/privacidad/page.tsx` — agregar párrafo sobre uso de Clarity.
- `Dockerfile` (DEV y PROD, valores distintos) — `ENV NEXT_PUBLIC_CLARITY_PROJECT_ID=<id>`.

**`autolandia-bot`:**

- `src/services/sale-registrar.ts:43-62` — agregar `canal` con valor `'bot'` al INSERT crudo.
- `src/conversation/handlers/promo-2x1.ts` — el link a la web post-2x1 cambia a `https://autolandia.com.py?utm_source=whatsapp&utm_medium=organic&utm_campaign=bot_redirect` (DEV apunta a la URL Easypanel default DEV con los mismos params).

### 3.3 Flujo end-to-end

```
[1] Usuario click anuncio Meta con UTMs
       https://autolandia.com.py?utm_source=meta&utm_medium=paid&utm_campaign=lanzamiento_abril
                ↓
[2] Landing /
    - Server: layout.tsx renderiza Clarity script
    - Cliente: <UtmCapture/> lee searchParams
    - Cliente: si cookie al_utm NO existe → escribe cookie con UTMs (first-touch)
    - Cliente: window.clarity('set', 'utm_source', 'meta'); ('set', 'utm_campaign', 'lanzamiento_abril')
                ↓
[3] Usuario navega varias páginas, eventualmente abre /checkout y completa OTP
    - Server action sendOtp/verifyOtp lee cookie al_utm del request
    - upsert leads: si leads.utm_source IS NULL → setea las 7 cols UTM; si ya tiene valor → NO toca
                ↓
[4] Usuario sube comprobante y completa la compra
    - Server action register-sale.ts lee cookie al_utm
    - Pasa utm_source/medium/campaign como params adicionales a registrar_venta_web()
    - Función SQL inserta en ventas con utm_source/medium/campaign + canal='web'
                ↓
[5] Admin abre /admin
    - Tarjeta Canales: web=42 / bot=28 / histórico=5
    - Tabla Atribución: meta·lanzamiento_abril=18 ventas, tiktok·video_a=7, etc.
    - Selector de rango (1d/7d/30d/lifetime) afecta ambas
                ↓
[6] Admin entra a Clarity (clarity.microsoft.com)
    - Filtra sesiones por custom tag utm_source=meta
    - Ve heatmaps y recordings de quienes vinieron de Meta
```

## 4. Schema de base de datos

### 4.1 Migración 1 — extender `leads`

```sql
ALTER TABLE leads ADD COLUMN IF NOT EXISTS utm_source         text;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS utm_medium         text;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS utm_campaign       text;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS utm_content        text;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS utm_term           text;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS utm_landing_page   text;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS utm_first_visit_at timestamptz;
```

**Política de escritura:** las 7 columnas se llenan UNA SOLA VEZ — al primer upsert del lead (signup OTP) si están NULL. Nunca se sobreescriben (first-touch en DB también, por consistencia con la cookie).

### 4.2 Migración 2 — extender `ventas`

```sql
ALTER TABLE ventas ADD COLUMN IF NOT EXISTS utm_source   text;
ALTER TABLE ventas ADD COLUMN IF NOT EXISTS utm_medium   text;
ALTER TABLE ventas ADD COLUMN IF NOT EXISTS utm_campaign text;
ALTER TABLE ventas ADD COLUMN IF NOT EXISTS canal        text;  -- 'web' | 'bot'

CREATE INDEX IF NOT EXISTS idx_ventas_utm_source_campaign
  ON ventas(utm_source, utm_campaign);

CREATE INDEX IF NOT EXISTS idx_ventas_canal ON ventas(canal);
```

**Política de escritura:**
- `utm_*`: snapshot al momento de la venta (denormalizado). Se copia desde la cookie / desde `leads.utm_*` cuando se inserta. Una vez escrito, no se modifica.
- `canal`: lo setea quien hace el INSERT. Web vía `registrar_venta_web` → `'web'`. Bot vía `INSERT INTO ventas` directo → `'bot'`.

### 4.3 Migración 3 — actualizar `registrar_venta_web`

La función SQL actual (`autolandia-web/lib/sale-registrar.ts` la invoca; definición en Supabase) recibe parámetros de la venta y hace el INSERT atómico con la actualización de rifas.

**Cambios:**
- Acepta 3 nuevos params opcionales: `p_utm_source text DEFAULT NULL`, `p_utm_medium text DEFAULT NULL`, `p_utm_campaign text DEFAULT NULL`. (`utm_content/term` quedan en `leads` pero NO en `ventas` — minimizamos columnas en la tabla más caliente).
- INSERT a `ventas` incluye los 3 utm + `canal = 'web'`.
- Params opcionales con `DEFAULT NULL` para no romper llamadas viejas si quedaran en flight durante el deploy.

**Mitigación de riesgo (CRÍTICO):**
- Antes de aplicar el `CREATE OR REPLACE FUNCTION` en cada DB (DEV y PROD), guardar la definición actual de la función en `autolandia-web/sql/registrar_venta_web_v_pre_utm.sql` committeado al repo. Si post-deploy se detecta cualquier anomalía en ventas, re-aplicar el backup vía MCP en <30 segundos.
- Compra de prueba real en DEV post-migración antes de cherry-pick a main.
- Compra de prueba real en PROD post-deploy (1 boleto, 20k Gs) antes de cerrar el ticket.

### 4.4 Migración 4 — actualizar `get_admin_stats`

La RPC actual (`get_admin_stats(p_range_days int)`) devuelve totales agregados + daily_sales. Se extiende su return type para incluir `por_canal jsonb` con shape:

```json
{
  "web":         { "ventas": 42, "total_gs": 8400000 },
  "bot":         { "ventas": 28, "total_gs": 5600000 },
  "sin_canal":   { "ventas": 5,  "total_gs": 1000000 }
}
```

**Estrategia para no romper consumidores existentes:** agregar campo nuevo al return, no cambiar los existentes. El frontend admin actual sigue funcionando; el `CanalSection` lee el campo nuevo.

**Nota técnica:** cambiar el `RETURNS` de una función Postgres requiere `DROP FUNCTION` previo (el `CREATE OR REPLACE` no permite cambio de signature). La migración debe ser:
```sql
DROP FUNCTION IF EXISTS get_admin_stats(int);
CREATE OR REPLACE FUNCTION get_admin_stats(p_range_days int) RETURNS TABLE (... + por_canal jsonb) ...
```
El `DROP` debe correr en una ventana donde no haya request en flight a `/admin` — riesgo bajo (solo afecta el dashboard, no las ventas).

### 4.5 Migración 5 — crear `get_attribution_stats`

Función nueva, no modifica nada existente:

```sql
CREATE OR REPLACE FUNCTION get_attribution_stats(p_range_days int)
RETURNS TABLE (
  source        text,
  campaign      text,
  ventas_count  bigint,
  total_gs      bigint,
  pct_total     numeric
)
LANGUAGE plpgsql STABLE AS $$
DECLARE
  v_total bigint;
BEGIN
  SELECT COALESCE(SUM(monto), 0) INTO v_total
  FROM ventas
  WHERE (fecha AT TIME ZONE 'America/Asuncion')::date
    >= ((NOW() AT TIME ZONE 'America/Asuncion')::date - (p_range_days - 1 || ' days')::INTERVAL);

  RETURN QUERY
  SELECT
    COALESCE(v.utm_source, 'direct')::text   AS source,
    COALESCE(v.utm_campaign, '-')::text      AS campaign,
    COUNT(*)::bigint                          AS ventas_count,
    COALESCE(SUM(v.monto), 0)::bigint        AS total_gs,
    CASE WHEN v_total > 0
      THEN ROUND((SUM(v.monto)::numeric / v_total) * 100, 1)
      ELSE 0
    END                                       AS pct_total
  FROM ventas v
  WHERE (v.fecha AT TIME ZONE 'America/Asuncion')::date
    >= ((NOW() AT TIME ZONE 'America/Asuncion')::date - (p_range_days - 1 || ' days')::INTERVAL)
  GROUP BY 1, 2
  ORDER BY total_gs DESC;
END;
$$;
```

Si `p_range_days = 0` o un valor especial agreed-on (ej `9999`), tratarlo como "lifetime" (sin filtro de fecha). Decisión: usar `p_range_days <= 0` como lifetime.

## 5. Cookie `al_utm`

| Atributo | Valor |
|---|---|
| Nombre | `al_utm` |
| Valor | JSON URL-encoded: `{"source":"meta","medium":"paid","campaign":"lanzamiento_abril","content":"video_a","term":"","landing_page":"/","first_visit_at":"2026-04-24T15:30:00.000Z"}` |
| Max-Age | 180 días (`60*60*24*180`) |
| SameSite | `Lax` |
| Secure | `true` en PROD, ignorable en DEV |
| HttpOnly | `false` — el cliente necesita leerla para pasar tags a Clarity. Las server actions pueden leerla igual vía `cookies()` de Next.js sea HttpOnly o no. La info no es sensible (no hay tokens, solo nombre de campaña). |
| Path | `/` |
| Domain | no setear (default = host actual) |

**First-touch logic:** la escritura ocurre solo si `document.cookie` NO contiene `al_utm` Y la URL trae al menos un `utm_*`. Si la cookie ya existe, se ignora la URL nueva (no se sobreescribe).

**Edge case — sin UTMs en URL Y sin cookie:** no se escribe nada. El lead/venta queda con UTMs en NULL → reporte lo muestra como `direct`.

## 6. Convención de UTMs (operativo)

Documento `autolandia-web/docs/utm-conventions.md`:

| Medio | utm_source | utm_medium | utm_campaign (ejemplos) |
|---|---|---|---|
| Meta Ads (Facebook + Instagram) | `meta` | `paid` | `lanzamiento_abril`, `retargeting`, `mini_sorteos` |
| TikTok Ads | `tiktok` | `paid` | `video_auto_a`, `creative_b_test` |
| WhatsApp orgánico (link bot → web) | `whatsapp` | `organic` | `bot_redirect`, `bot_promo_2x1` |
| Influencer / colab paga | `influencer` | `paid` | nombre del colaborador en lowercase, ej: `juan_perez` |
| Email / newsletter | `email` | `email` | nombre campaña |
| Sin UTMs | (default → `direct`) | — | — |

**Reglas:**
- Solo lowercase, snake_case, sin espacios ni acentos.
- `utm_campaign` libre pero prefiriendo nombres legibles (`lanzamiento_abril` mejor que `camp_001`).
- Para Meta/TikTok, usar las herramientas nativas de UTMs del propio Ads Manager. Hay un par de campos opcionales para inyectar `utm_*` automáticamente al click del anuncio.

## 7. Microsoft Clarity — configuración

### 7.1 Cuentas

- **DEV**: proyecto `autolandia-dev` en clarity.microsoft.com → da un `NEXT_PUBLIC_CLARITY_PROJECT_ID` (string corto tipo `lkj4klj234`).
- **PROD**: proyecto `autolandia-prod`.
- Manual setup en clarity.microsoft.com — fuera de la implementación del código.

### 7.2 Script

Inyectado en `app/layout.tsx` (server component, va dentro del `<head>` o al final del body):

```tsx
{process.env.NEXT_PUBLIC_CLARITY_PROJECT_ID && (
  <Script id="clarity-init" strategy="afterInteractive">
    {`
      (function(c,l,a,r,i,t,y){
        c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};
        t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/"+i;
        y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y);
      })(window, document, "clarity", "script", "${process.env.NEXT_PUBLIC_CLARITY_PROJECT_ID}");
    `}
  </Script>
)}
```

Si la env var no existe → script no se renderiza (escape hatch para localhost).

### 7.3 Custom tags

Desde `<UtmCapture/>`, tras leer la cookie / capturar UTMs:

```ts
if (typeof window !== 'undefined' && (window as any).clarity) {
  (window as any).clarity('set', 'utm_source', utm.source ?? 'direct');
  (window as any).clarity('set', 'utm_campaign', utm.campaign ?? '-');
  (window as any).clarity('set', 'canal', 'web');
}
```

Esto permite filtrar sesiones en el dashboard de Clarity por medio.

### 7.4 Privacidad

- Clarity por default enmascara contenido de `<input>`. Mantener el default (no cambiar a "no mask").
- Política de privacidad (`app/privacidad/page.tsx`) se actualiza con párrafo:
  > "Utilizamos Microsoft Clarity para entender cómo los usuarios usan el sitio y mejorarlo. Clarity recolecta interacciones (clicks, scrolls, navegación) de forma anónima y no recolecta datos de formularios. Más info en https://privacy.microsoft.com/privacystatement."

## 8. Cambios en `autolandia-bot`

### 8.1 `src/services/sale-registrar.ts:43-62`

Agregar `canal` al INSERT crudo:

```ts
INSERT INTO ventas (
  ticket_id, transaction_id, nombre_completo, ci, telefono,
  monto, cantidad, comprobante_url, metodo_pago, fecha,
  telefono_registro, numeros_asignados, mensaje_inicial,
  canal              -- NUEVO
)
VALUES (
  ...
  ${input.mensajeInicial},
  'bot'              -- NUEVO
)
```

Diff de 2 líneas. Riesgo bajo. Probar con compra real en DEV bot post-deploy.

### 8.2 `src/conversation/handlers/promo-2x1.ts`

El link actual a `https://www.autolandia.com.py` (post-2x1, mensaje al usuario para registrarse en la web) cambia a:

```
https://www.autolandia.com.py/?utm_source=whatsapp&utm_medium=organic&utm_campaign=bot_redirect
```

Si hay otros lugares en el bot donde se manda el link de la web, también se actualizan (grep `autolandia.com.py` en `autolandia-bot/src`).

DEV equivalent: usar la URL Easypanel default DEV con los mismos params si se manda link desde DEV bot.

## 9. Edge cases manejados

| # | Caso | Comportamiento |
|---|---|---|
| 1 | Sin UTMs en URL Y sin cookie | Nada se escribe. Venta queda con `utm_source = NULL` → reporte la cuenta como `direct`. |
| 2 | UTMs en URL Y cookie ya existe | Se respeta la cookie (first-touch). La URL se ignora para tracking. |
| 3 | Cookies deshabilitadas en el browser | Cliente intenta `document.cookie = ...`, falla silenciosa. Venta queda como `direct`. Aceptable. |
| 4 | UTMs extras (`gclid`, `fbclid`, `utm_id`) | Se ignoran. Solo persistimos los 5 estándar (source/medium/campaign/content/term). |
| 5 | Bot manda usuario al web pero usuario ya tenía cookie de otro medio | Se respeta cookie original (first-touch coherente). El usuario no pierde su atribución original al pasar por bot. |
| 6 | Mismo teléfono compra dos veces con cookies distintas | Ambas ventas snapshot del momento → segunda venta puede tener UTMs distintos en `ventas` aunque `leads.utm_*` esté congelado. Esto es deseado: cada venta refleja su contexto. |
| 7 | UTMs en mayúsculas / con acentos / espacios | Se persisten tal cual llegan. Reporte agrupa por valor exacto. La convención del doc lo evita pero el sistema no normaliza. |
| 8 | Cookie corrupta (JSON inválido) | `try/catch` en el lector → trata como inexistente, sigue el flow sin tracking. |
| 9 | Migración corre antes de que el código nuevo se deploye | OK: las cols son nullable, INSERTs viejos siguen funcionando con NULL. |
| 10 | Código nuevo se deploya antes que la migración | INSERT falla porque `canal` no existe. Mitigación: aplicar la migración SIEMPRE primero, ANTES del deploy de código. |

## 10. Plan de testing (DEV)

Antes de cherry-pick a main:

1. **Migraciones SQL en DEV via MCP** (`apply_migration`).
2. **Deploy bot DEV** con cambio de `canal='bot'` + link UTM.
3. **Deploy web DEV** con Clarity DEV ID + UtmCapture + admin sections.
4. **Tests manuales:**
   - Abrir `https://autolandiabot-fulll-autolandia-web.wrkyu1.easypanel.host/?utm_source=meta&utm_medium=paid&utm_campaign=test_dev` → verificar:
     - DevTools → Application → Cookies → existe `al_utm` con JSON correcto
     - DevTools → Network → request a `clarity.ms/tag/<DEV_ID>` exitosa
   - Completar signup OTP → verificar en Supabase DEV: `SELECT utm_* FROM leads WHERE phone = '<phone>'` → tiene los UTMs.
   - Completar compra de 1 boleto → verificar:
     - `SELECT utm_source, utm_campaign, canal FROM ventas WHERE ticket_id = 'TK-XXXX'` → `meta`, `test_dev`, `web`.
     - Compra desde el bot DEV → `canal = 'bot'`.
   - Abrir `/admin` (admin DEV) → ver tarjeta Canales (web=1, bot=1) y tabla Atribución (meta·test_dev=1).
   - Abrir clarity.microsoft.com proyecto DEV → ver session con tag `utm_source=meta`.
5. **Test edge case sin UTMs:** abrir el sitio en incógnito SIN UTMs → completar compra → venta debe quedar `utm_source=NULL`, en admin como `direct`.
6. **Test first-touch:** abrir con UTMs Meta, cerrar, abrir con UTMs TikTok → cookie sigue siendo Meta, venta atribuida a Meta.

Si todos pasan → cherry-pick a main.

## 11. Plan de deploy (PROD)

1. **Backup** de la función actual `registrar_venta_web` en `autolandia-web/sql/registrar_venta_web_v_pre_utm.sql`.
2. **Migraciones SQL en PROD** via MCP en este orden:
   1. ALTER `leads` (7 cols UTM) — idempotente, no rompe.
   2. ALTER `ventas` (4 cols + 2 índices) — idempotente, no rompe.
   3. CREATE OR REPLACE `registrar_venta_web` (con UTMs + canal='web', params con DEFAULT NULL) — **paso de mayor riesgo**.
   4. DROP + CREATE `get_admin_stats` (return type extendido).
   5. CREATE OR REPLACE `get_attribution_stats` — función nueva.
3. **Test 1 — compra de prueba con código viejo + SQL nuevo** (1 boleto, 20k Gs) en `autolandia.com.py`. Como los params nuevos tienen `DEFAULT NULL`, la llamada vieja sigue funcionando. La venta se registra con `canal='web'`, `utm_*=NULL`. Si esto falla → revertir migración 3 vía backup, abortar deploy.
4. **Cherry-pick** del bot a `main` → push → Easypanel redeploya bot PROD.
5. **Test 2 — compra de prueba bot PROD**: la venta debe quedar con `canal='bot'`.
6. **Cherry-pick** del web a `main` → push → Easypanel redeploya web PROD.
7. **Test 3 — verificación final con código nuevo:** abrir `autolandia.com.py?utm_source=test&utm_campaign=manual_check` → completar compra → verificar:
   - `SELECT canal, utm_source, utm_campaign FROM ventas WHERE ticket_id='TK-XXXX'` → `web`, `test`, `manual_check`.
   - `/admin` muestra la venta en tarjeta Canales y en tabla Atribución.
   - Clarity dashboard muestra la sesión con tag `utm_source=test`.

Ventana de deploy: horario de bajo tráfico (madrugada Paraguay).

## 12. Checklist de archivos

### Web — nuevos
- [ ] `lib/clarity.ts`
- [ ] `lib/utm-tracking.ts`
- [ ] `components/UtmCapture.tsx`
- [ ] `components/admin/CanalSection.tsx`
- [ ] `components/admin/AttributionSection.tsx`
- [ ] `docs/utm-conventions.md`
- [ ] `sql/registrar_venta_web_v_pre_utm.sql` (backup pre-cambio)

### Web — modificados
- [ ] `app/layout.tsx` — Clarity script + `<UtmCapture/>`
- [ ] `app/admin/page.tsx` — render `CanalSection` + `AttributionSection`
- [ ] `app/actions/register-sale.ts` — leer cookie `al_utm` vía `cookies()`, agregar al input
- [ ] `lib/sale-registrar.ts` — extender `RegisterSaleInput` + pasar `p_utm_*` en ambos `.rpc('registrar_venta_web', ...)` (random + manual)
- [ ] `app/privacidad/page.tsx` — párrafo Clarity
- [ ] `Dockerfile` (DEV branch develop) — `ENV NEXT_PUBLIC_CLARITY_PROJECT_ID=<DEV_ID>`
- [ ] `Dockerfile` (PROD branch main) — `ENV NEXT_PUBLIC_CLARITY_PROJECT_ID=<PROD_ID>` (cherry-pick excluyendo el Dockerfile, valores hardcoded distintos)

### Bot — modificados
- [ ] `src/services/sale-registrar.ts:43-62` — agregar `canal='bot'`
- [ ] `src/conversation/handlers/promo-2x1.ts` — UTMs en link a web
- [ ] (otros archivos del bot que linkean al web — grep `autolandia.com.py`)

### SQL migrations (DEV → PROD via MCP)
- [ ] `2026_04_24_extend_leads_utms.sql`
- [ ] `2026_04_24_extend_ventas_utms_canal.sql`
- [ ] `2026_04_24_update_registrar_venta_web.sql`
- [ ] `2026_04_24_update_get_admin_stats.sql`
- [ ] `2026_04_24_create_get_attribution_stats.sql`

## 13. Out of scope

- **Cookie consent banner** — no requerido por ahora; Paraguay sin GDPR fuerte y la política de privacidad existente cubre el uso. Se puede agregar después si Clarity / GDPR / CCPA lo requieren para algún mercado.
- **Backfill de canal histórico** — ver decisión en sección 2. NULL para ventas previas.
- **Multi-touch attribution** — first-touch es lo que se pidió.
- **`utm_id`, `gclid`, `fbclid`** — tracking nativo de Google/Meta. No se persisten. Si en el futuro se quiere atribución cross-device más fina, se agregan en una iteración futura.
- **Cookie secundaria `al_utm_last`** para debug del último touch — fuera de MVP.
- **Reporte por hora/día con gráfico de tendencia** — el MVP solo muestra tabla. Los charts ya existentes (`daily_sales`) no se modifican.

## 14. Riesgos identificados

| Riesgo | Probabilidad | Impacto | Mitigación |
|---|---|---|---|
| `registrar_venta_web` con bug post-update → ventas web caen | Baja | **Alto** (ventas) | Backup función pre-cambio + compra de prueba inmediata + revert plan documentado |
| `INSERT INTO ventas` del bot falla por columna `canal` faltante (orden de deploy) | Baja | **Alto** (ventas) | Migraciones SIEMPRE antes que código en cada entorno |
| Clarity script bloquea render del sitio | Muy baja | Medio | `strategy="afterInteractive"` + escape hatch si var vacía |
| Cookie excede tamaño máximo (4KB) por UTMs muy largos | Muy baja | Bajo | UTMs son strings cortos en práctica; truncar a 200 chars por campo en `captureFromUrl()` |
| UTMs malformados en URL crashean el cliente | Baja | Bajo | `try/catch` en parseo + fallback a `direct` |
| Clarity dashboard no aparece tags `utm_*` | Baja | Bajo (solo afecta filtros) | Verificación manual post-deploy |

# Promo 3x1 indicativa con login wall y check de unicidad

## Problema

El banner 3x1 actual (`PromoBanner.tsx`) manda directo a checkout con el pack más chico, sin autenticación ni control de uso único. Dos problemas:
1. La restriccion "solo una vez por usuario" no se enforced en ningun lado (anyone can comprar el 3x1 N veces).
2. El CTA es debil; el banner no comunica que es una promo exclusiva que hay que activar.

## Diseno

### Flow

1. Home → click PromoBanner → `/promo-3x1`
2. `/promo-3x1` (Server Component):
   - Sin sesion → `redirect('/login?next=/promo-3x1')`
   - Sin profile (nombre+CI) → `redirect('/login?next=/promo-3x1')` (el login ya tiene step `profile`)
   - Ya uso 3x1 (venta con `is_promo_3x1=true` para su telefono en variantes) → pantalla "Ya usaste tu 3x1"
   - Eligible → grid con los 6 `PACKS_3X1`. Click va a `/checkout?qty=X&price=Y&promo=3x1`.
3. Checkout con `promo=3x1`: setea `isPromo3x1=true` en state y lo propaga a `registerSale` → RPC.

### Backend

- Migracion Supabase DEV: `ALTER TABLE ventas ADD COLUMN is_promo_3x1 BOOLEAN NOT NULL DEFAULT false`.
- Recrear `registrar_venta_web` aceptando nuevo param `p_is_promo_3x1 BOOLEAN DEFAULT false`. Default false para retrocompat con el bot.
- Server action `checkPromo3x1Eligibility(telefono)` → reusa `phoneVariants()`, query `ventas` filtrando `is_promo_3x1=true`. Retorna `{eligible, reason}`.

### Frontend

- `PROMO_3X1_END` → `2026-04-30T23:59:59-04:00`.
- `PromoBanner.tsx` → copy neuromarketing (urgencia + beneficio + accion), link a `/promo-3x1`.
- Nueva `app/promo-3x1/page.tsx` (server component con checks) + componente cliente `PackGrid3x1` para el grid.
- `app/login/page.tsx` → leer `?next=` y redirigir ahi tras OTP verificado + profile completo (hoy va siempre a `/mis-boletos`).
- `app/checkout/page.tsx` → leer `promo=3x1` de query params, setear `isPromo3x1` en state.
- `app/actions/register-sale.ts` + `lib/sale-registrar.ts` → aceptar y propagar `isPromo3x1` al RPC.

### Validacion de unicidad

Match por **telefono** (E.164 normalizado + variantes). No por CI porque el auth va por telefono y es mas estable. La verificacion ocurre en el server component de `/promo-3x1` (antes de mostrar el grid). No hace falta re-verificar en checkout porque el unico entry-point con `promo=3x1` es ese grid.

## Git workflow

- Todo en `develop`. Migracion Supabase DEV aplicada via MCP.
- Tras QA del usuario → merge a `main` con cherry-pick (sin Dockerfile).
- Migracion en PROD (`xtwrmcbvjgywwdpdwoxw`) recien despues del OK del usuario.

## No incluye

- UI de "cuantos boletos 3x1 quedan por usuario" (es binario: puede o no puede).
- Historial de uso 3x1 en dashboard de usuario (YAGNI para este MVP).
- Limite por CI (solo por telefono).

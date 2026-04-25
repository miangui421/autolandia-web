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

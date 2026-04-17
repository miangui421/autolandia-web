@AGENTS.md

## Stack
Next.js 16 (App Router, standalone output) + Tailwind 4 + Supabase + Twilio Verify + OpenAI GPT-4o

## Deploy (Easypanel, mismo VPS que bot)
- IP VPS: `5.161.77.126`
- DEV: app `autolandia-web`, branch `develop`, DB `jyytukfcnembucompttu`
- PROD: app `autolandia-web-prod`, branch `main`, DB `xtwrmcbvjgywwdpdwoxw`, dominio `autolandia.com.py`
- URL Easypanel default (DEV): `autolandiabot-fulll-autolandia-web.wrkyu1.easypanel.host`

## Quirks Easypanel (CRÍTICOS — descubiertos a golpes)
- **Template "App" inyecta `PORT=80`** en runtime sobrescribiendo `ENV PORT=3000` del Dockerfile. Fix: `CMD ["sh", "-c", "PORT=3000 node server.js"]`
- **Build args NO expuestos en UI**: hardcodear `NEXT_PUBLIC_*` con `ENV` en Dockerfile (anon key es publicable)
- **Campo "File" del Build** debe decir `Dockerfile` explícito. Vacío = error `open code: no such file or directory`
- Cada rama tiene Dockerfile con valores distintos de `NEXT_PUBLIC_*` (DEV vs PROD)

## Git workflow DEV/PROD
- Trabajar en `develop` → push → app DEV redeploya → probar
- Merge `develop` → `main` SOLO cuando aprobado → app PROD redeploya
- **NUNCA mergear Dockerfile entre branches** (tienen valores hardcoded distintos)
- Usar `git cherry-pick <commit>` para traer fixes de lógica sin Dockerfile

## Auth (custom, NO Supabase Phone Auth)
- Supabase NO soporta Twilio Verify nativo → flow custom con server actions
- Flow: teléfono → `sendOtp` (Twilio Verify) → `verifyOtpAndGetToken` → crea/busca user con email interno `user.{phone}@autolandia.internal` → genera magic link → cliente lo consume con `supabase.auth.verifyOtp({ token_hash, type: 'magiclink' })`
- user_metadata: `{ telefono, nombre, ci, sheet_registered }`
- `hasProfile` = tiene nombre Y CI
- Twilio Verify Service SID: `VA9a0a03645ee1e3482000ca32983f1ef4` (compartido DEV/PROD)

## Integración con bot
- Misma DB, misma tabla `leads` (upsert por phone, NUNCA degradar stage)
- Hoja Sheets "Ventas": web pasa 13 valores (A:M), bot pasa 12 (A:L). Col M = "WEB" para distinguir
- Hoja "Leads Web": creada automáticamente por el código al completar primer perfil
- Fecha en sheets: `new Date().toLocaleString('sv-SE', { timeZone: 'America/Asuncion' })` (UTC-3)

## Gotchas Next.js 16
- `output: 'standalone'` obligatorio en `next.config.ts` para Docker
- `useSearchParams()` debe estar dentro de un `<Suspense>` boundary
- Server actions con notificaciones externas (Telegram/Sheets): usar `await Promise.allSettled()` — fire-and-forget muere en serverless
- Google Sheets private key: parsear `\n` con `.replace(/\\n/g, '\n')` en Docker/Vercel
- Grammy/OpenAI/googleapis: lazy init con funciones `getBot()`/`getOpenAI()` (no a nivel de módulo)

## DNS y dominio
- `autolandia.com.py` → DNS en DreamHost (panel.dreamhost.com), NS: ns1/ns2/ns3.dreamhost.com
- A records: `@` y `www` → `5.161.77.126`
- SSL: Easypanel emite Let's Encrypt automático al detectar DNS propagado
- La IP directa nunca tiene SSL válido (CA solo emite para dominios, no IPs)

## Debugging común
- 502 Bad Gateway en dominio custom → puerto del dominio ≠ puerto donde escucha el container
- "Service is not reachable" (pantalla Easypanel) → mismo problema de puertos
- Ver logs reales del container en Easypanel → Overview → icono terminal
- Verificar puerto real del container: en logs busca `- Local: http://localhost:XXX`

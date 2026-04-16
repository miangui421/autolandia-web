# syntax=docker/dockerfile:1.7
# ⚠️ Este Dockerfile es para DEVELOP → app DEV (Supabase jyytukfcnembucompttu)
# El branch main tiene su propio Dockerfile con valores de PROD

# ─── Stage 1: deps ────────────────────────────────────────────
FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --legacy-peer-deps

# ─── Stage 2: builder ─────────────────────────────────────────
FROM node:20-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# NEXT_PUBLIC_* se embeben en el bundle del cliente en build time.
# Son valores PUBLICOS (anon key publicable), por eso van hardcoded.
# DEV project: jyytukfcnembucompttu
ENV NEXT_PUBLIC_SUPABASE_URL=https://jyytukfcnembucompttu.supabase.co
ENV NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp5eXR1a2ZjbmVtYnVjb21wdHR1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIwNzIzMjksImV4cCI6MjA4NzY0ODMyOX0.3kPTa2SFAp5lGLbryWkL3_XrU8dyjbjwmIPIHlOzJP4
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

# ─── Stage 3: runner ──────────────────────────────────────────
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN addgroup --system --gid 1001 nodejs && adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs
EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

CMD ["node", "server.js"]

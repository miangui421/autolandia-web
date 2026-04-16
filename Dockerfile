# syntax=docker/dockerfile:1.7
# ⚠️ Este Dockerfile es para MAIN → PROD
# El branch develop tiene su propio Dockerfile con valores de DEV

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
# PROD project: xtwrmcbvjgywwdpdwoxw
ENV NEXT_PUBLIC_SUPABASE_URL=https://xtwrmcbvjgywwdpdwoxw.supabase.co
ENV NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh0d3JtY2J2amd5d3dkcGR3b3h3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIyNDg5MDEsImV4cCI6MjA4NzgyNDkwMX0.xA81ubTZtK66ipTJPQkdWm617QHtA8A0DmLAyVXn0fo
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

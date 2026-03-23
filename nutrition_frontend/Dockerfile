# ── NutriTrack Frontend (Next.js) ─────────────────────────────
# Etapa 1: Dependencias
FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --ignore-scripts

# Etapa 2: Build
FROM node:20-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# La API URL se inyecta en build-time para que Next.js la incluya en el bundle
ARG NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL}

# Habilitar standalone output para imagen mínima
RUN echo '/** @type {import("next").NextConfig} */\nconst nextConfig = {\n  output: "standalone",\n  typescript: { ignoreBuildErrors: true },\n  images: { unoptimized: true },\n}\nexport default nextConfig' > next.config.mjs

RUN npm run build

# Etapa 3: Runner (imagen final mínima)
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production

# Copiar artefactos standalone de Next.js
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public

EXPOSE 3000

CMD ["node", "server.js"]

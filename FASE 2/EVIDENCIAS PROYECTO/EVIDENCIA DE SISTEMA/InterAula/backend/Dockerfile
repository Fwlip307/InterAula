# ==============================================================================
# InterAula Backend - Multi-stage Dockerfile (Producción)
# Node.js 20 Alpine + Express + TypeScript
# ==============================================================================

# Stage 1: Build & Compile TypeScript
FROM node:22-alpine AS builder

WORKDIR /app

# Copiar manifiestos e instalar todas las dependencias para compilar
COPY package*.json ./
RUN npm ci

# Copiar configuración TypeScript y código fuente
COPY tsconfig.json ./
COPY src/ ./src/

# Compilar TypeScript a JavaScript en dist/
RUN npm run build

# Stage 2: Production Runner
FROM node:22-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3001

# Instalar wget para healthcheck
RUN apk add --no-cache wget

# Copiar manifiestos e instalar exclusivamente dependencias de producción
COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force

# Copiar artefactos JavaScript compilados desde el builder
COPY --from=builder /app/dist ./dist

# Crear directorio de persistencia para el usuario no privilegiado 'node'
RUN mkdir -p /app/data && chown -R node:node /app/data

# Ejecutar como usuario no privilegiado 'node' por seguridad
USER node

EXPOSE 3001

# Healthcheck contra el endpoint de salud de la API
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://localhost:3001/api/health || exit 1

CMD ["node", "dist/server.js"]

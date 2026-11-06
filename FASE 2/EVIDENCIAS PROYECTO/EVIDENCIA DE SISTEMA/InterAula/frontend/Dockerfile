# ==============================================================================
# InterAula Frontend - Multi-stage Dockerfile (Producción)
# React 19 + Vite 8 + Nginx 1.27 Alpine
# ==============================================================================

# Stage 1: Build de la aplicación con Vite
FROM node:22-alpine AS builder

WORKDIR /app

# Argumentos de compilación para variables públicas VITE_*
# Se incrustan en el bundle estático durante 'vite build'
ARG VITE_API_URL=/api
ARG VITE_SUPABASE_URL
ARG VITE_SUPABASE_PUBLISHABLE_KEY

ENV VITE_API_URL=$VITE_API_URL
ENV VITE_SUPABASE_URL=$VITE_SUPABASE_URL
ENV VITE_SUPABASE_PUBLISHABLE_KEY=$VITE_SUPABASE_PUBLISHABLE_KEY

# Copiar manifiestos e instalar dependencias con resolución nativa de plataforma
COPY package*.json ./
RUN npm install

# Copiar configuración y código fuente
COPY tsconfig*.json vite.config.ts index.html ./
COPY public/ ./public/
COPY src/ ./src/

# Compilar aplicación estática en dist/
RUN npm run build

# Stage 2: Servidor Web Nginx de Producción
FROM nginx:1.27-alpine AS runner

# Instalar wget para healthcheck
RUN apk add --no-cache wget

# Reemplazar configuración predeterminada con configuración SPA y proxy inverso
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copiar artefactos compilados desde el builder
COPY --from=builder /app/dist /usr/share/nginx/html

EXPOSE 80

# Healthcheck HTTP
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD wget -qO- http://localhost:80/ || exit 1

CMD ["nginx", "-g", "daemon off;"]

# PokéSurvivor: imagen para Coolify (o cualquier Docker).
#   docker build -t pokesurvivor .  &&  docker run --rm -p 8080:80 pokesurvivor
# 1) Construye dist/ (Node + Python para las páginas web).
FROM node:20-bookworm-slim AS build
RUN apt-get update && apt-get install -y --no-install-recommends python3 && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY . .
# BUILD_ARGS=--forzar en Coolify (Build Variable) para una actualización obligatoria.
ARG BUILD_ARGS=""
RUN node scripts/build.js $BUILD_ARGS && npm run build:pages

# 2) Sólo los archivos estáticos, servidos por nginx.
FROM nginx:1.27-alpine
COPY deploy/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
HEALTHCHECK --interval=30s --timeout=3s CMD wget -qO- http://127.0.0.1/version.json >/dev/null || exit 1

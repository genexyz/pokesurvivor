# PokéSurvivor: imagen para Coolify (o cualquier Docker).
#   docker build -t pokesurvivor .  &&  docker run --rm -p 8080:80 --env-file .env pokesurvivor
# 1) Construye dist/ (Node + Python para las páginas web).
FROM node:22-bookworm-slim AS build
RUN apt-get update && apt-get install -y --no-install-recommends python3 && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY . .
# BUILD_ARGS=--forzar en Coolify (Build Variable) para una actualización obligatoria.
ARG BUILD_ARGS=""
RUN node scripts/build.js $BUILD_ARGS && npm run build:pages

# 2) El servidor (server/): sirve dist/ y la nube (cuentas de Google, partidas,
#    amigos, ranking y salas del cooperativo) con Postgres (DATABASE_URL).
FROM node:22-bookworm-slim
ENV NODE_ENV=production PORT=80
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --no-audit --no-fund && npm cache clean --force
COPY server ./server
COPY src/js/core/save-merge.js ./src/js/core/save-merge.js
COPY --from=build /app/dist ./dist
EXPOSE 80
HEALTHCHECK --interval=30s --timeout=3s CMD node -e "fetch('http://127.0.0.1/version.json').then(r=>process.exit(r.ok?0:1),()=>process.exit(1))"
CMD ["node", "server/index.mjs"]

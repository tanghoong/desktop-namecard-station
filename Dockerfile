FROM node:20-alpine AS build
WORKDIR /app

COPY package*.json ./
COPY apps/server/package*.json apps/server/
COPY apps/web/package*.json    apps/web/
RUN npm ci

COPY . .
RUN npm run build

# ── Production image ──────────────────────────────────────
FROM node:20-alpine AS production
WORKDIR /app

COPY --from=build /app/apps/server/dist ./apps/server/dist
COPY --from=build /app/apps/web/dist    ./apps/web/dist
COPY package*.json              ./
COPY apps/server/package*.json  apps/server/

RUN npm ci --omit=dev --workspace=apps/server

RUN mkdir -p /app/data/cards

EXPOSE 3000
CMD ["node", "apps/server/dist/index.js"]

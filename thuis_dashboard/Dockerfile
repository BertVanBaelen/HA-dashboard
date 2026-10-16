ARG BUILD_FROM=ghcr.io/home-assistant/amd64-base:3.21

FROM node:22-alpine AS build
WORKDIR /app
COPY app/package.json app/package-lock.json* ./
RUN npm ci --no-audit --no-fund || npm install --no-audit --no-fund
COPY app/ ./
RUN npm run build && npm prune --omit=dev

FROM ${BUILD_FROM}
RUN apk add --no-cache nodejs
WORKDIR /app
COPY --from=build /app/package.json ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/server ./server
COPY --from=build /app/shared ./shared
COPY --from=build /app/dist ./dist
COPY run.sh /run.sh
RUN chmod a+x /run.sh

CMD ["/run.sh"]

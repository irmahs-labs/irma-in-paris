# syntax=docker/dockerfile:1
# One image: the built site, and the server that serves it beside /api.
FROM node:24-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN --mount=type=cache,target=/root/.npm npm ci
COPY index.html tsconfig.json vite.config.ts ./
COPY public ./public
COPY src ./src
COPY server ./server
RUN npm run build

# The server is bundled into one file with its dependencies, so the image
# needs no node_modules at all.
FROM node:24-alpine
WORKDIR /app
ENV NODE_ENV=production PORT=3000 STATIC_DIR=/app/public
COPY --from=build --chown=node:node /app/dist ./public
COPY --from=build --chown=node:node /app/dist-server/main.js ./main.js
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s \
  CMD ["wget", "-qO-", "http://127.0.0.1:3000/healthz"]
CMD ["node", "main.js"]

# syntax=docker/dockerfile:1
# Production image: builds the web app, then runs the API server, which also serves dist/.
#   docker build -t baktana-english .
#   docker run -p 3001:3001 -e JWT_SECRET=... -v baktana-data:/app/data baktana-english

ARG NODE_VERSION=22

# --- 1. Build the web app -------------------------------------------------------------
FROM node:${NODE_VERSION}-slim AS web
WORKDIR /app
# Server deps are installed in their own stage, not by the root postinstall.
ENV SKIP_SERVER_INSTALL=1
COPY package.json package-lock.json ./
COPY tools ./tools
RUN npm ci
COPY . .
RUN npm run build

# --- 2. Install server dependencies ---------------------------------------------------
FROM node:${NODE_VERSION}-slim AS server-deps
WORKDIR /app/server
COPY server/package*.json ./
# Full install: the server runs TypeScript directly with tsx.
RUN if [ -f package-lock.json ]; then npm ci; else npm install; fi

# --- 3. Runtime -----------------------------------------------------------------------
FROM node:${NODE_VERSION}-slim AS runtime
ENV NODE_ENV=production \
    PORT=3001 \
    DATABASE_PATH=/app/data/baktana.db
WORKDIR /app
# The server imports the pure modules in src/ (progress, course data) and shared/api.ts.
COPY --chown=node:node src ./src
COPY --chown=node:node shared ./shared
COPY --chown=node:node server ./server
COPY --from=server-deps --chown=node:node /app/server/node_modules ./server/node_modules
COPY --from=web --chown=node:node /app/dist ./dist
RUN mkdir -p /app/data && chown node:node /app/data
USER node
VOLUME ["/app/data"]
EXPOSE 3001
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:' + (process.env.PORT || 3001) + '/api/health').then((r) => process.exit(r.ok ? 0 : 1), () => process.exit(1))"
WORKDIR /app/server
CMD ["npm", "start"]

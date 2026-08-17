# ── Build-Stage ──────────────────────────────────────────────────────────────
FROM node:22-alpine AS builder
WORKDIR /app

# Corepack darf pnpm ohne Rückfrage herunterladen (nicht-interaktiver Build)
ENV COREPACK_ENABLE_DOWNLOAD_PROMPT=0 \
    CI=true
RUN corepack enable

COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

COPY . .

# Dummy-Werte nur für den Build — zur Laufzeit kommen die echten aus dem Stack
ENV PAYLOAD_SECRET=build-time-secret \
    DATABASE_URI=postgres://build:build@localhost:5432/build \
    NODE_ENV=production

RUN pnpm build && pnpm prune --prod

# ── Runtime-Stage ────────────────────────────────────────────────────────────
FROM node:22-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production \
    PORT=3000

COPY --from=builder --chown=node:node /app/package.json ./package.json
COPY --from=builder --chown=node:node /app/node_modules ./node_modules
COPY --from=builder --chown=node:node /app/.next ./.next
COPY --from=builder --chown=node:node /app/public ./public
COPY --from=builder --chown=node:node /app/next.config.mjs ./next.config.mjs
COPY --from=builder --chown=node:node /app/tsconfig.json ./tsconfig.json
COPY --from=builder --chown=node:node /app/src ./src
COPY --from=builder --chown=node:node /app/scripts ./scripts
COPY --from=builder --chown=node:node /app/docker-entrypoint.sh ./docker-entrypoint.sh

# Persistentes Upload-Verzeichnis (als Volume mounten!)
RUN mkdir -p /app/media && chown node:node /app/media && chmod +x /app/docker-entrypoint.sh

USER node
EXPOSE 3000

ENTRYPOINT ["/app/docker-entrypoint.sh"]

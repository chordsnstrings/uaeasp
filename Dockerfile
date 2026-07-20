# ---- deps ----
FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

# ---- build ----
FROM node:22-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
# The build prerenders pages from the database and bakes NEXT_PUBLIC_* values
# into the client bundle — DO App Platform exposes env vars with
# RUN_AND_BUILD_TIME scope during this step.
RUN npm run build

# ---- run ----
FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production \
    PORT=3000 \
    HOSTNAME=0.0.0.0 \
    NEXT_TELEMETRY_DISABLED=1

COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public
# Boot script: migrations + first-boot seed (applied on container start, idempotent)
COPY --from=builder /app/scripts/migrate-prod.mjs ./migrate-prod.mjs
COPY --from=builder /app/src/db/migrations ./migrations
COPY --from=builder /app/db-seed/providers.seed.json ./seed/providers.seed.json

RUN chown -R node:node /app
USER node
EXPOSE 3000
CMD ["sh", "-c", "node migrate-prod.mjs && node server.js"]

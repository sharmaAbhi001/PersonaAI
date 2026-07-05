# ---- Stage 1: install deps + generate Prisma client ----
FROM node:22-alpine AS builder

WORKDIR /app

RUN apk add --no-cache openssl libc6-compat

COPY package.json package-lock.json ./
COPY prisma ./prisma
COPY prisma.config.ts ./

RUN npm ci

# prisma generate only needs a valid-looking URL; no live DB required
ENV DATABASE_URL="postgresql://build:build@127.0.0.1:5432/build?schema=public"
RUN npx prisma generate

COPY src ./src
COPY ecosystem.config.cjs ./

RUN npm prune --omit=dev

# ---- Stage 2: lean production image ----
FROM node:22-alpine AS runner

WORKDIR /app

RUN apk add --no-cache openssl libc6-compat \
  && addgroup -S nodejs \
  && adduser -S nodejs -G nodejs

ENV NODE_ENV=production
ENV PORT=8000

COPY --from=builder --chown=nodejs:nodejs /app/package.json ./
COPY --from=builder --chown=nodejs:nodejs /app/package-lock.json ./
COPY --from=builder --chown=nodejs:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=nodejs:nodejs /app/prisma ./prisma
COPY --from=builder --chown=nodejs:nodejs /app/prisma.config.ts ./
COPY --from=builder --chown=nodejs:nodejs /app/src ./src
COPY --from=builder --chown=nodejs:nodejs /app/ecosystem.config.cjs ./

USER nodejs

EXPOSE 8000

CMD ["npx", "pm2-runtime", "start", "ecosystem.config.cjs"]

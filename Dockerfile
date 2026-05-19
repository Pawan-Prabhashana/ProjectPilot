# ── ProjectPilot Neuro — Production Dockerfile ────────────────────────────────
#
# Multi-stage build:
#   1. deps    — installs production + dev dependencies
#   2. builder — compiles the Next.js application
#   3. runner  — minimal production image (~250 MB)
#
# Build:
#   docker build -t projectpilot-neuro .
#
# Run (with environment variables):
#   docker run -p 3000:3000 \
#     -e DATABASE_URL="postgresql://..." \
#     -e NEXTAUTH_URL="https://your-domain.com" \
#     -e NEXTAUTH_SECRET="..." \
#     -e ENCRYPTION_SECRET="..." \
#     projectpilot-neuro
# ─────────────────────────────────────────────────────────────────────────────

FROM node:20-alpine AS deps
RUN apk add --no-cache libc6-compat openssl
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

# ─────────────────────────────────────────────────────────────────────────────

FROM node:20-alpine AS builder
RUN apk add --no-cache libc6-compat openssl
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Generate Prisma client for the target platform
RUN npx prisma generate

# Disable Next.js telemetry during build
ENV NEXT_TELEMETRY_DISABLED=1

# Build environment stubs — real values are injected at runtime
ENV DATABASE_URL="postgresql://build:build@localhost:5432/build"
ENV NEXTAUTH_URL="http://localhost:3000"
ENV NEXTAUTH_SECRET="build-time-placeholder-secret-32chars"
ENV ENCRYPTION_SECRET="build-time-placeholder-secret-32chars"

RUN npm run build

# ─────────────────────────────────────────────────────────────────────────────

FROM node:20-alpine AS runner
RUN apk add --no-cache libc6-compat openssl
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Create a non-root user for security
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
COPY --from=builder /app/prisma ./prisma

# Copy Next.js standalone output
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs

EXPOSE 3000

ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# Run Prisma migrations then start the application
CMD ["node", "server.js"]

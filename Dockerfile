# UNVERIFIED: written without Docker available in the authoring environment. Build and test before relying on it.
FROM node:22-slim AS base
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npx prisma generate && npm run build

# Run as an unprivileged user.
RUN useradd --system --uid 10001 app && chown -R app /app
USER app
ENV NODE_ENV=production
EXPOSE 3000
# Web app by default. The worker service overrides this with: npx tsx scripts/worker.ts
CMD ["npx", "next", "start", "-p", "3000"]

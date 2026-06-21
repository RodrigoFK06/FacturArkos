# FacturArkos API — imagen de producción (NestJS + Prisma)
FROM node:22-slim AS build
RUN apt-get update && apt-get install -y openssl ca-certificates && rm -rf /var/lib/apt/lists/*
RUN corepack enable && corepack prepare pnpm@10.30.1 --activate
WORKDIR /app
COPY pnpm-workspace.yaml package.json ./
COPY apps/api/package.json ./apps/api/
RUN pnpm install --filter @facturarkos/api...
COPY apps/api ./apps/api
RUN pnpm --filter @facturarkos/api exec prisma generate \
 && pnpm --filter @facturarkos/api build

FROM node:22-slim AS runtime
RUN apt-get update && apt-get install -y openssl ca-certificates && rm -rf /var/lib/apt/lists/*
RUN corepack enable && corepack prepare pnpm@10.30.1 --activate
WORKDIR /app
ENV NODE_ENV=production PORT=3001
# Copiamos el árbol ya instalado + compilado (incluye el Prisma Client generado).
COPY --from=build /app ./
WORKDIR /app/apps/api
EXPOSE 3001
# Aplica el esquema y arranca. En un pipeline maduro usar `prisma migrate deploy`.
CMD ["sh", "-c", "pnpm exec prisma db push --skip-generate && node dist/main.js"]

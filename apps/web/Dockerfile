# FacturArkos Web — imagen de producción (Next.js standalone)
FROM node:22-slim AS build
RUN corepack enable && corepack prepare pnpm@10.30.1 --activate
WORKDIR /app
# La URL del API se hornea en build (variable NEXT_PUBLIC_*). Ajustar al desplegar.
ARG NEXT_PUBLIC_API_URL=http://localhost:3001/api
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ENV NEXT_STANDALONE=1
COPY pnpm-workspace.yaml package.json ./
COPY apps/web/package.json ./apps/web/
RUN pnpm install --filter @facturarkos/web...
COPY apps/web ./apps/web
RUN pnpm --filter @facturarkos/web build

FROM node:22-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production PORT=3000
COPY --from=build /app/apps/web/.next/standalone ./
COPY --from=build /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=build /app/apps/web/public ./apps/web/public
EXPOSE 3000
CMD ["node", "apps/web/server.js"]

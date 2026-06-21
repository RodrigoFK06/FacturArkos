# FacturArkos — Guía de Despliegue

> Estado: backend (NestJS) + frontend (Next.js) + Postgres. **5 comprobantes SUNAT
> validados** en ambiente de pruebas. Esta guía cubre cómo llevarlo a un servidor.

## 1. Secretos (obligatorio)

```bash
openssl rand -hex 32   # úsalo para JWT_SECRET
openssl rand -hex 32   # úsalo para SECRETS_ENCRYPTION_KEY (32 bytes exactos)
```

`SECRETS_ENCRYPTION_KEY` cifra los tokens de terceros (SUNAT/pasarelas) en la BD.
**Si la rotas, debes re-cifrar los secretos existentes** (desencriptar con la vieja).

## 2. Opción A — VPS con Docker Compose (todo en una máquina)

```bash
cp .env.prod.example .env      # completa DB_PASSWORD, JWT_SECRET, SECRETS_ENCRYPTION_KEY, URLs
docker compose -f docker-compose.prod.yml up -d --build
```

Levanta `db` (Postgres con volumen persistente), `api` (:3001, aplica el esquema al
arrancar) y `web` (:3000). Pon un reverse proxy (Caddy/Nginx/Traefik) con HTTPS
delante, enrutando `app.tudominio.com → web:3000` y `api.tudominio.com → api:3001`.

⚠️ La URL del API se **hornea en build** del frontend (`NEXT_PUBLIC_API_URL`). Si
cambias el dominio del API, reconstruye `web` con el `API_PUBLIC_URL` correcto.

## 3. Opción B — Nube gestionada (recomendado para escalar)

- **Base de datos:** Postgres gestionado (Render/Railway/Neon/Supabase). Copia su `DATABASE_URL`.
- **API:** servicio web desde `apps/api/Dockerfile`. Variables: `DATABASE_URL`, `JWT_SECRET`,
  `SECRETS_ENCRYPTION_KEY`, `CORS_ORIGINS=https://app.tudominio.com`, `APISUNAT_*`, `PERU_API_TOKEN`.
  Healthcheck: `GET /api/health`.
- **Web:** servicio desde `apps/web/Dockerfile` con build-arg `NEXT_PUBLIC_API_URL=https://api.tudominio.com/api`.
- **Migración inicial:** `pnpm --filter @facturarkos/api exec prisma db push` (o `migrate deploy` con migraciones).

## 4. Datos iniciales

```bash
pnpm --filter @facturarkos/api seed   # crea org demo (quítalo en producción real)
```
En producción, cada negocio se registra vía `POST /api/auth/register` (RUC + owner) y
conecta su cuenta SUNAT desde el panel (**Configuración**).

## 5. Pasar a PRODUCCIÓN con SUNAT (lo que falta para validez tributaria)

Hoy todo corre contra el **ambiente DESARROLLO** de APISUNAT (sin valor tributario).
Para emitir comprobantes reales, cada empresa necesita en su cuenta APISUNAT:

1. **Certificado Digital Tributario** (.pfx) subido a APISUNAT.
2. **Usuario Secundario SOL** con permisos de emisión.
3. **Credenciales GRE** (para guías de remisión 2.0).
4. Cambiar su token a uno de **PRODUCCIÓN** (sin prefijo `DEV_`) y `testMode=false`
   en `/sunat-config`.

El código ya soporta esto: las credenciales son **per-tenant y cifradas** (`sunat_configs`).

## 6. Checklist de endurecimiento

Hecho: ✅ secretos cifrados AES-256-GCM · ✅ `/health` · ✅ helmet (CSP/HSTS) ·
✅ rate limiting · ✅ graceful shutdown · ✅ CORS por allowlist · ✅ aislamiento multi-tenant.

Pendiente recomendado: backups automáticos de Postgres · logs centralizados +
alertas (Sentry) · WAF/CDN · pruebas e2e en CI · rotación de secretos · y un
`prisma migrate` formal (hoy se usa `db push`).

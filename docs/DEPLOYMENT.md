# Production deployment (Docker Compose)

Stack: **MySQL 8** + **Express API** + **nginx SPA**. Users hit nginx on port 80; `/api/` is reverse-proxied to the backend so the SPA can use same-origin `VITE_API_BASE_URL=/api/v1`.

Prisma migrations under [`backend/prisma/`](../backend/prisma/) are the schema source of truth. Compose applies **`migrate deploy`** on backend start — it does **not** load [`database/database.sql`](../database/database.sql) dumps.

Keep [`release/fos-erp-host`](../release/fos-erp-host) as a separate host packaging path; this Compose stack is the repo-root deploy path.

## Prerequisites

- Docker Engine + Docker Compose v2 (Docker Desktop on Windows)
- Ports **80** (and optionally **5000**) free on the host

## Quick start

```bash
cp .env.production.example .env.production
# Edit secrets: MYSQL_*, JWT_*, FRONTEND_URL

docker compose --env-file .env.production up --build -d
# or:
./scripts/deploy-prod.sh          # Linux/macOS
.\scripts\deploy-prod.ps1         # Windows PowerShell
```

First boot: backend entrypoint runs `npx tsx scripts/prisma-cli.ts migrate deploy`, then starts `node dist/server.js`.

### Optional seed (once)

Do **not** seed automatically in production (avoids overwriting live data):

```bash
docker compose --env-file .env.production exec backend npm run db:seed
```

## Environment

Template: [`.env.production.example`](../.env.production.example) → copy to `.env.production` (gitignored).

| Variable | Purpose |
|----------|---------|
| `MYSQL_DATABASE` / `MYSQL_USER` / `MYSQL_PASSWORD` / `MYSQL_ROOT_PASSWORD` | MySQL init + backend `DB_*` |
| `JWT_ACCESS_SECRET` / `JWT_REFRESH_SECRET` | Min 32 characters each |
| `FRONTEND_URL` | CORS origin — public SPA URL (e.g. `http://localhost` or `https://erp.example.com`) |
| `HTTP_PORT` | Host port for nginx (default `80`) |
| `BACKEND_HOST_PORT` | Optional direct API publish (default `5000`) |
| `VITE_TENANT_SLUG` | Baked into SPA at build time |
| `CRM_MAX_UPLOAD_BYTES` | Attachment size cap (default 25MB) |

Frontend build args (fixed in Compose): `VITE_USE_API=true`, `VITE_API_BASE_URL=/api/v1`.

## Service map

| Service | Role | Notes |
|---------|------|--------|
| `mysql` | MySQL 8 | Volume `mysql_data`; healthcheck before API start |
| `backend` | Node API | Port 5000; uploads volume `crm_uploads` → `/data/uploads` |
| `frontend` | nginx | Port 80; SPA + `/api/` → `backend:5000` |

## Verification

```bash
docker compose --env-file .env.production config   # validate compose
curl -s http://localhost/api/v1/health             # database: connected
curl -sI http://localhost/                         # SPA
```

Swagger (if enabled for the build): `http://localhost/api/docs` or `http://localhost:5000/api/docs`.

Login only after optional seed (seeded tenant credentials are documented in project docs — rotate in production).

## Backups

```bash
# Logical dump
docker compose --env-file .env.production exec mysql \
  mysqldump -ufos -p"$MYSQL_PASSWORD" fos_erp > backup-$(date +%Y%m%d).sql

# Uploads volume
docker run --rm -v trailer-erp2_crm_uploads:/data -v "$(pwd)":/backup alpine \
  tar czf /backup/uploads-$(date +%Y%m%d).tgz -C /data .
```

Volume names may be prefixed by the Compose project directory name — check with `docker volume ls`.

## TLS

Compose publishes plain HTTP. For production HTTPS, terminate TLS at a host reverse proxy (Caddy, nginx, Traefik, or a cloud LB) and set `FRONTEND_URL` to the public `https://` origin. Point the proxy at `localhost:80` (or the host `HTTP_PORT`).

## Useful commands

```bash
docker compose --env-file .env.production logs -f backend
docker compose --env-file .env.production ps
docker compose --env-file .env.production down          # keep volumes
docker compose --env-file .env.production down -v       # DESTROYS DB + uploads
```

## Out of scope

- Kubernetes / cloud PaaS manifests  
- Automatic Let's Encrypt inside this Compose file  
- Rebuilding or deleting `release/fos-erp-host`  

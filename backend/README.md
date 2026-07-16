# FOS ERP Backend

Multi-tenant Node.js + Express + TypeScript + MySQL + Prisma backend for the Trailer ERP frontend.

## Prerequisites

- Node.js 20+
- MySQL 8+
- MySQL Workbench (optional)

## Setup

1. Copy environment file:

```bash
cp .env.example .env
```

2. Configure MySQL credentials in `.env`:

```env
DB_HOST=localhost
DB_PORT=3306
DB_NAME=fos_erp
DB_USER=root
DB_PASS=your_password
```

3. Create the database in MySQL:

```sql
CREATE DATABASE fos_erp CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

4. Install dependencies and set up database:

```bash
npm install
npm run db:setup
```

`db:setup` runs: Prisma generate → migrations → seed.

## Development

```bash
npm run dev
```

Server: `http://localhost:5000`  
Swagger (dev): `http://localhost:5000/api/docs`  
Health: `GET http://localhost:5000/api/v1/health`

## Seed credentials (development only)

| User | Email | Password | Tenant slug |
|------|-------|----------|-------------|
| Super Admin | super@fos-erp.com | Super@123 | vasant-trailers |
| Tenant Admin | admin@vasant-trailers.com | Admin@123 | vasant-trailers |

## API structure

```
/api/v1/auth/*
/api/v1/tenants
/api/v1/t/:tenantSlug/users
/api/v1/t/:tenantSlug/roles
/api/v1/t/:tenantSlug/crm/companies|contacts|leads|opportunities|activities|follow-ups
/api/v1/t/:tenantSlug/crm/quotations|quotation-templates|sales-orders
/api/v1/t/:tenantSlug/crm/dashboard|reports|search|exports|masters|entities
/api/v1/t/:tenantSlug/masters/{countries|states|cities|products|items|vendors|…}
/api/v1/t/:tenantSlug/lookups/:resource
```

Full OpenAPI: `http://localhost:5000/api/docs`  
Human maps: `docs/API_CONVENTIONS.md`, `docs/crm-page-api-map.md`, `backend/docs/api-requirement-matrix.md`

## Scripts

| Script | Description |
|--------|-------------|
| `npm run dev` | Development server with hot reload |
| `npm run build` | Compile TypeScript |
| `npm run start` | Run production build |
| `npm run typecheck` | TypeScript check |
| `npm run test` | Run tests |
| `npm run db:setup` | Generate + migrate + seed |
| `npm run db:studio` | Prisma Studio |

## Frontend integration

Set in frontend `.env`:

```env
VITE_API_BASE_URL=http://localhost:5000/api/v1
VITE_USE_API=true
VITE_TENANT_SLUG=vasant-trailers
```

## Security

- JWT access + refresh token rotation
- bcrypt password hashing
- Tenant isolation on every query
- Permission-based RBAC
- Rate limiting on auth endpoints

# Database folder

This directory holds a **reference SQL dump** for humans and tools that expect a `database.sql` file.

## Source of truth

**Prisma owns the live schema:**

- Schema: [`backend/prisma/schema.prisma`](../backend/prisma/schema.prisma)
- Migrations: [`backend/prisma/migrations/`](../backend/prisma/migrations/)
- Apply locally: from `backend/`, run `npm run db:setup` (or `npx tsx scripts/prisma-cli.ts migrate deploy`)

Do **not** apply `database.sql` to production or as a substitute for Prisma migrations. Tenant data is not included in this dump.

## Regenerating `database.sql`

From `backend/` (loads `.env` / `DATABASE_URL` the same way as other Prisma scripts):

```bash
npx prisma migrate diff --from-empty --to-schema-datamodel prisma/schema.prisma --script > ../database/database.sql
```

Or via the helper:

```bash
npx tsx scripts/prisma-cli.ts migrate diff --from-empty --to-schema-datamodel prisma/schema.prisma --script
```

(then redirect stdout to `../database/database.sql`).

Regenerate after meaningful schema/migration changes so the dump stays useful as a readable snapshot.

import { PrismaClient } from "@prisma/client";
const p = new PrismaClient();
async function main() {
  const rows = await p.$queryRawUnsafe(
    "SELECT migration_name, finished_at IS NOT NULL AS finished, rolled_back_at IS NOT NULL AS rolled_back, LEFT(COALESCE(logs,''), 500) AS logs FROM _prisma_migrations ORDER BY started_at DESC LIMIT 25"
  );
  console.log(JSON.stringify(rows, null, 2));
}
main().finally(() => p.$disconnect());

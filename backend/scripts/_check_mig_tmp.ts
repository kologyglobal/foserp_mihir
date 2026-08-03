import mariadb from "mariadb"
import { config as loadEnv } from "dotenv"
loadEnv()

const pool = mariadb.createPool({
  host: process.env.DB_HOST ?? "localhost",
  port: Number(process.env.DB_PORT ?? 3306),
  user: process.env.DB_USER ?? "root",
  password: process.env.DB_PASS ?? "",
  database: process.env.DB_NAME ?? "fos_erp",
  connectionLimit: 2,
})
const conn = await pool.getConnection()
try {
  const rows: any[] = await conn.query(
    "SELECT migration_name FROM _prisma_migrations WHERE migration_name LIKE '202608%' OR migration_name LIKE '2026073%' ORDER BY migration_name",
  )
  console.log("applied recent:\n" + rows.map((r) => r.migration_name).join("\n"))
  const cols: any[] = await conn.query(
    "SHOW COLUMNS FROM crm_quotation_documents WHERE Field LIKE 'orderDiscount%' OR Field LIKE 'freightCalc%'",
  )
  console.log("\nadjustment cols:", cols.map((c) => c.Field).join(", ") || "(none)")
  const tables: any[] = await conn.query("SHOW TABLES LIKE 'app_notifications'")
  console.log("app_notifications tables:", tables)
  const soCols: any[] = await conn.query(
    "SHOW COLUMNS FROM crm_sales_orders WHERE Field LIKE 'orderDiscount%' OR Field LIKE 'freightCalc%'",
  )
  console.log("SO adjustment cols:", soCols.map((c) => c.Field).join(", ") || "(none)")
} finally {
  await conn.release()
  await pool.end()
}

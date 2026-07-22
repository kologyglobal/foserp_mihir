import { prisma } from '../src/config/database.js'

async function main() {
  const rows = await prisma.$queryRawUnsafe(
    'SELECT migration_name, finished_at IS NOT NULL AS finished FROM _prisma_migrations ORDER BY started_at DESC LIMIT 60',
  )
  console.log('RECENT_MIGRATIONS')
  console.log(JSON.stringify(rows, null, 2))

  const tables = await prisma.$queryRawUnsafe('SHOW TABLES LIKE \'purchase_%\'')
  console.log('PURCHASE_TABLES')
  console.log(JSON.stringify(tables, null, 2))

  const target = [
    '20260721120000_purchase_setup_full_persistence',
    '20260722020000_purchase_invoice_ap_handoff',
    '20260720250000_purchase_phase3b_requisition',
    '20260720260000_manufacturing_phase3c_pr_link_fk',
    '20260722030000_dispatch_phase7c5_hardened_posting',
    '20260722031000_o2c_sales_invoice_source_links',
    '20260722032000_o2c_cost_of_goods_sold_mapping',
  ]
  const applied = await prisma.$queryRawUnsafe(
    `SELECT migration_name FROM _prisma_migrations WHERE migration_name IN (${target.map((t) => `'${t}'`).join(',')})`,
  )
  console.log('TARGET_APPLIED')
  console.log(JSON.stringify(applied, null, 2))
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })

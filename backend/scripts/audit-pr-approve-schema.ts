/**
 * Audit stage DB schema for POST /purchase/requisitions/:id/approve failures.
 * Read-only — prints missing tables/columns and suggested SQL fix files.
 *
 * Usage (set DB_HOST/DB_NAME/DB_USER/DB_PASS or DATABASE_URL first):
 *   npx tsx scripts/audit-pr-approve-schema.ts
 *   PR_ID=4df7a5be-... npx tsx scripts/audit-pr-approve-schema.ts
 */
import { prisma } from '../src/config/prisma.js'

const PR_ID = process.env.PR_ID ?? '4df7a5be-0ef5-4c85-86ec-8e8f51d5a4ba'

type MissingCol = { table: string; column: string }
type MissingTable = { table: string }

const REQUIRED_COLUMNS: MissingCol[] = [
  { table: 'purchase_requisition_lines', column: 'orderedQuantity' },
  { table: 'purchase_requisition_lines', column: 'hsnId' },
  { table: 'purchase_requisition_lines', column: 'gstGroupId' },
  { table: 'purchase_requisition_lines', column: 'hsnCodeSnapshot' },
  { table: 'purchase_requisition_lines', column: 'gstGroupCodeSnapshot' },
  { table: 'purchase_requisition_lines', column: 'gstRatePctSnapshot' },
  { table: 'purchase_requisition_lines', column: 'cgstRateSnapshot' },
  { table: 'purchase_requisition_lines', column: 'sgstRateSnapshot' },
  { table: 'purchase_requisition_lines', column: 'igstRateSnapshot' },
  { table: 'purchase_requisition_lines', column: 'gstSchemeSnapshot' },
  { table: 'purchase_planning_rows', column: 'allocatedQuantity' },
  { table: 'purchase_planning_rows', column: 'orderedQuantity' },
  { table: 'purchase_requisitions', column: 'revisionNo' },
  { table: 'purchase_requisitions', column: 'sourceType' },
  { table: 'purchase_requisitions', column: 'sourceId' },
  { table: 'purchase_requisitions', column: 'sourceDocumentNumber' },
]

const REQUIRED_TABLES = [
  'purchase_approver_limits',
  'purchase_approvals',
  'purchase_status_histories',
  'purchase_planning_rows',
] as const

async function tableExists(db: string, table: string): Promise<boolean> {
  const rows = await prisma.$queryRaw<Array<{ c: bigint }>>`
    SELECT COUNT(*) AS c FROM information_schema.TABLES
    WHERE TABLE_SCHEMA = ${db} AND TABLE_NAME = ${table}
  `
  return Number(rows[0]?.c ?? 0) > 0
}

async function columnExists(db: string, table: string, column: string): Promise<boolean> {
  const rows = await prisma.$queryRaw<Array<{ c: bigint }>>`
    SELECT COUNT(*) AS c FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = ${db} AND TABLE_NAME = ${table} AND COLUMN_NAME = ${column}
  `
  return Number(rows[0]?.c ?? 0) > 0
}

async function main() {
  const dbRows = await prisma.$queryRaw<Array<{ db: string | null }>>`SELECT DATABASE() AS db`
  const db = dbRows[0]?.db
  if (!db) {
    console.error('DATABASE() is NULL — set DB_NAME in env before running.')
    process.exit(1)
  }

  console.log('=== PR approve schema audit ===')
  console.log('Connected database:', db)
  console.log('PR_ID (context):', PR_ID)
  console.log('')

  const missingTables: MissingTable[] = []
  for (const table of REQUIRED_TABLES) {
    if (!(await tableExists(db, table))) missingTables.push({ table })
  }

  const missingColumns: MissingCol[] = []
  for (const { table, column } of REQUIRED_COLUMNS) {
    if (!(await tableExists(db, table))) continue
    if (!(await columnExists(db, table, column))) missingColumns.push({ table, column })
  }

  if (missingTables.length) {
    console.log('MISSING TABLES (run live-fix-pr-approve-500.sql in phpMyAdmin):')
    for (const { table } of missingTables) console.log(`  - ${table}`)
    console.log('')
  } else {
    console.log('Required tables: OK')
  }

  if (missingColumns.length) {
    console.log('MISSING COLUMNS:')
    for (const { table, column } of missingColumns) console.log(`  - ${table}.${column}`)
    console.log('')
    console.log('Fix scripts:')
    console.log('  - scripts/live-fix-pr-approve-500.sql')
    console.log('  - scripts/live-fix-purchase-upstream-tax-snapshots.sql (GST cols)')
  } else if (missingTables.every((t) => t.table !== 'purchase_planning_rows')) {
    console.log('Required columns: OK')
  }

  if (await tableExists(db, 'purchase_requisitions')) {
    const pr = await prisma.$queryRaw<
      Array<{
        id: string
        requisitionNumber: string
        status: string
        rfqRequired: number
        submittedAt: Date | null
        approvedAt: Date | null
      }>
    >`
      SELECT id, requisitionNumber, status, rfqRequired, submittedAt, approvedAt
      FROM purchase_requisitions
      WHERE id = ${PR_ID} AND deletedAt IS NULL
      LIMIT 1
    `
    console.log('')
    console.log('PR record:')
    if (!pr.length) {
      console.log(`  NOT FOUND id=${PR_ID}`)
    } else {
      const row = pr[0]!
      console.log(`  ${row.requisitionNumber} status=${row.status} rfqRequired=${row.rfqRequired}`)
      console.log(`  submittedAt=${row.submittedAt?.toISOString() ?? 'null'} approvedAt=${row.approvedAt?.toISOString() ?? 'null'}`)
    }
  }

  if (await tableExists(db, 'purchase_approvals')) {
    const approvals = await prisma.$queryRaw<
      Array<{ id: string; level: number; status: string; approverRole: string | null }>
    >`
      SELECT id, level, status, approverRole
      FROM purchase_approvals
      WHERE purchaseRequisitionId = ${PR_ID}
      ORDER BY level ASC, requestedAt ASC
    `
    console.log('')
    console.log(`purchase_approvals rows: ${approvals.length}`)
    for (const a of approvals) {
      console.log(`  level=${a.level} status=${a.status} role=${a.approverRole ?? '—'}`)
    }
  }

  const pendingMigrations = await prisma.$queryRaw<Array<{ migration_name: string }>>`
    SELECT migration_name FROM _prisma_migrations WHERE finished_at IS NULL ORDER BY migration_name
  `.catch(() => [] as Array<{ migration_name: string }>)

  console.log('')
  if (pendingMigrations.length) {
    console.log('Pending _prisma_migrations (run migrate deploy):')
    for (const m of pendingMigrations) console.log(`  - ${m.migration_name}`)
  } else {
    console.log('_prisma_migrations: no unfinished rows')
  }

  console.log('')
  if (missingTables.length || missingColumns.length) {
    console.log('RESULT: FAIL — apply SQL fixes above, then re-run probe-pr-approve-live.ts')
    process.exit(1)
  }
  console.log('RESULT: schema audit OK — run probe-pr-approve-live.ts next; if API still 500, restart Hostinger (stale Prisma client).')
  await prisma.$disconnect()
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})

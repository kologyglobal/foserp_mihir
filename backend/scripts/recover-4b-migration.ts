import { prisma } from '../src/config/database.js'

/** Clean partial Phase 4B migration after MySQL identifier-length failure. */
async function main() {
  await prisma.$executeRawUnsafe('DROP TABLE IF EXISTS quality_inspection_parameter_results')
  await prisma.$executeRawUnsafe('DROP TABLE IF EXISTS quality_inspection_plan_lines')

  for (const sql of [
    'ALTER TABLE quality_inspections DROP FOREIGN KEY qi_plan_fkey',
    'ALTER TABLE quality_inspections DROP INDEX qi_tenant_plan_idx',
    'ALTER TABLE quality_inspections DROP COLUMN inspectionPlanId',
    'ALTER TABLE quality_inspections DROP COLUMN parameterSnapshotJson',
    'ALTER TABLE quality_inspections DROP INDEX quality_inspections_tenantId_inspectionPlanId_idx',
  ]) {
    try {
      await prisma.$executeRawUnsafe(sql)
      console.log('ok', sql.slice(0, 60))
    } catch (e) {
      console.log('skip', (e as Error).message?.slice(0, 80))
    }
  }

  await prisma.$executeRawUnsafe('DROP TABLE IF EXISTS quality_inspection_plans')
  await prisma.$executeRawUnsafe('DROP TABLE IF EXISTS quality_parameters')
  await prisma.$executeRawUnsafe(
    "DELETE FROM _prisma_migrations WHERE migration_name = '20260720280000_quality_phase4b_plans_parameters'",
  )
  console.log('cleaned 4B partial migration')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())

import { prisma } from '../src/config/database.js'

/** Expand code_series.entityType to match Prisma CodeSeriesEntity (local catch-up). */
const ENUM_VALUES = [
  'USER',
  'LEAD',
  'CONTACT',
  'CRM_COMPANY',
  'OPPORTUNITY',
  'QUOTATION',
  'SALES_ORDER',
  'PRODUCTION_DEMAND',
  'PRODUCTION_ORDER',
  'DAILY_PRODUCTION_BATCH',
  'PRODUCTION_ISSUE',
  'STOCK_MOVEMENT',
  'STOCK_RESERVATION',
  'PURCHASE_REQUISITION',
  'PURCHASE_PLANNING',
  'REQUEST_FOR_QUOTATION',
  'VENDOR_QUOTATION',
  'VENDOR_COMPARISON',
  'PURCHASE_ORDER',
  'GOODS_RECEIPT',
  'QUALITY_INSPECTION',
  'QUALITY_NCR',
  'PURCHASE_INVOICE',
  'PURCHASE_RETURN',
  'JOB_WORK_ORDER',
  'PRODUCTION_RUNTIME_CHANGE',
  'PRODUCTION_WIP_MOVEMENT',
  'MANUFACTURING_CORRECTION',
  'PRODUCTION_PLAN',
  'DEMAND_CONSOLIDATION_PLAN',
  'OUTBOUND_DISPATCH',
  'PRODUCTION_FG_RECEIPT',
  'DISPATCH_REQUIREMENT',
  'DISPATCH_PICK_LIST',
  'DISPATCH_PACKING_SESSION',
  'DISPATCH_PACKAGE',
  'DELIVERY_CHALLAN',
  'PURCHASE_QUALITY_INSPECTION',
  'INVENTORY_TRANSFER',
  'INVENTORY_STOCK_COUNT',
  'INVENTORY_ADJUSTMENT',
]

async function main() {
  const enumSql = ENUM_VALUES.map((v) => `'${v}'`).join(',')
  await prisma.$executeRawUnsafe(
    `ALTER TABLE \`code_series\` MODIFY \`entityType\` ENUM(${enumSql}) NOT NULL`,
  )
  console.log('code_series.entityType enum expanded')

  const cols = await prisma.$queryRawUnsafe("SHOW COLUMNS FROM code_series LIKE 'entityType'")
  console.log(cols)
}

main()
  .catch((e) => {
    console.error(e)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())

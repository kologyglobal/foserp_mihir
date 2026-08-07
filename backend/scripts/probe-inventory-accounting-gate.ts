import { prisma } from '../src/config/prisma.js'

const TENANT_ID = '795be403-0588-4a81-b3ea-9f755f60c329'

async function main() {
  const events = await prisma.inventoryAccountingEvent.groupBy({
    by: ['eventType', 'status'],
    where: { tenantId: TENANT_ID },
    _count: { _all: true },
  })
  console.log('Inventory accounting events by type/status:')
  for (const e of events) console.log(' ', e.eventType, e.status, e._count._all)
  if (!events.length) console.log('  (none)')

  const failed = await prisma.inventoryAccountingEvent.findMany({
    where: { tenantId: TENANT_ID, status: 'FAILED' },
    select: { eventType: true, sourceDocumentType: true, failureReason: true },
    take: 10,
  })
  if (failed.length) console.log('\nFailed events (sample):', failed)

  const les = await prisma.legalEntity.findMany({
    where: { tenantId: TENANT_ID },
    select: { id: true, code: true, legalName: true, displayName: true, createdAt: true },
  })
  console.log('\nLegal entities:', les)

  const flags = await prisma.financeFeatureControl.findMany({
    where: { tenantId: TENANT_ID },
  })
  console.log('\nFinance feature controls:', flags.length ? flags : '(none)')

  const settings = await prisma.financeSettings.findMany({
    where: { tenantId: TENANT_ID },
  })
  console.log('\nFinance settings rows:', settings.length ? settings.map((s) => ({ id: s.id, legalEntityId: s.legalEntityId })) : '(none)')

  const vendorInvoices = await prisma.vendorInvoice.count({ where: { tenantId: TENANT_ID } })
  const vendorAdjustments = await prisma.vendorAdjustment
    .count({ where: { tenantId: TENANT_ID } })
    .catch(() => 'model-missing')
  console.log('\nAccounting VendorInvoices:', vendorInvoices, '| VendorAdjustments:', vendorAdjustments)

  const accounts = await prisma.account.count({ where: { tenantId: TENANT_ID } })
  console.log('Chart of accounts rows:', accounts)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())

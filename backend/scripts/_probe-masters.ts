import { prisma } from '../src/config/prisma.js'

const t = await prisma.tenant.findFirst({ where: { slug: 'vasant-trailers', deletedAt: null } })
if (!t) throw new Error('no tenant')
const vendors = await prisma.masterVendor.findMany({
  where: { tenantId: t.id, deletedAt: null, status: 'ACTIVE' },
  take: 10,
  select: { id: true, code: true, name: true },
})
const items = await prisma.masterItem.findMany({
  where: { tenantId: t.id, deletedAt: null, status: 'ACTIVE' },
  take: 20,
  select: { id: true, code: true, name: true, qcRequired: true, purchaseUomId: true, baseUomId: true },
})
const wh = await prisma.masterWarehouse.findFirst({
  where: { tenantId: t.id, deletedAt: null, code: { in: ['RM-MAIN', 'BO-MAIN', 'WH-RM-01'] } },
})
console.log(JSON.stringify({ vendors, items, wh }, null, 2))
await prisma.$disconnect()

import { prisma as p } from '../src/config/database.js'

async function main() {
  const tid = (await p.tenant.findFirst({ where: { slug: 'vasant-trailers' } }))!.id
  const soft = {
    companiesDel: await p.crmCompany.count({ where: { tenantId: tid, deletedAt: { not: null } } }),
    contactsDel: await p.crmContact.count({ where: { tenantId: tid, deletedAt: { not: null } } }),
    leadsDel: await p.crmLead.count({ where: { tenantId: tid, deletedAt: { not: null } } }),
    catsAll: await p.masterItemCategory.count({ where: { tenantId: tid } }),
    itemsAll: await p.masterItem.count({ where: { tenantId: tid } }),
    uomsAll: await p.masterUom.count({ where: { tenantId: tid } }),
    whAll: await p.masterWarehouse.count({ where: { tenantId: tid } }),
    gstAll: await p.masterGstGroup.count({ where: { tenantId: tid } }),
  }
  console.log('soft/all', JSON.stringify(soft, null, 2))
  const items = await p.masterItem.findMany({
    where: { tenantId: tid },
    select: { code: true, name: true, createdAt: true, deletedAt: true },
    orderBy: { createdAt: 'desc' },
    take: 20,
  })
  console.log('recent items', JSON.stringify(items, null, 2))
  const cats = await p.masterItemCategory.findMany({
    where: { tenantId: tid },
    select: { code: true, name: true, createdAt: true, deletedAt: true },
  })
  console.log('cats', JSON.stringify(cats, null, 2))
  const uoms = await p.masterUom.findMany({
    where: { tenantId: tid },
    select: { code: true, name: true, createdAt: true },
  })
  console.log('uoms', JSON.stringify(uoms, null, 2))
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await p.$disconnect()
  })

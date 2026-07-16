import { prisma as p } from '../src/config/database.js'

async function main() {
  try {
    await p.$connect()
    console.log('DB connected')
  } catch (e) {
    console.error('DB connect failed', e)
    process.exit(1)
  }

  const tenant = await p.tenant.findFirst({ where: { slug: 'vasant-trailers' } })
  console.log('tenant:', tenant ? `${tenant.slug} (${tenant.id})` : 'MISSING')
  if (!tenant) {
    const all = await p.tenant.findMany({ select: { slug: true, name: true, id: true } })
    console.log('all tenants:', JSON.stringify(all))
    return
  }
  const tid = tenant.id
  const counts = {
    companies: await p.crmCompany.count({ where: { tenantId: tid, deletedAt: null } }),
    contacts: await p.crmContact.count({ where: { tenantId: tid, deletedAt: null } }),
    leads: await p.crmLead.count({ where: { tenantId: tid, deletedAt: null } }),
    itemCategories: await p.masterItemCategory.count({ where: { tenantId: tid, deletedAt: null } }),
    items: await p.masterItem.count({ where: { tenantId: tid, deletedAt: null } }),
    uoms: await p.masterUom.count({ where: { tenantId: tid, deletedAt: null } }),
    warehouses: await p.masterWarehouse.count({ where: { tenantId: tid, deletedAt: null } }),
    gstGroups: await p.masterGstGroup.count({ where: { tenantId: tid, deletedAt: null } }),
  }
  console.log(JSON.stringify(counts, null, 2))
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await p.$disconnect()
  })

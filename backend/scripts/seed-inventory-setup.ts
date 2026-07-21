/**
 * Controlled inventory setup seed (Phase 2).
 * - Creates a plant per distinct warehouse plantCode for the tenant
 * - Links existing warehouses to their plant (plantId)
 * - Ensures every warehouse has at least one storage location
 * - Ensures every storage location has a default receiving bin
 *
 * Idempotent. Development/setup use only — never runs automatically.
 *
 * Run: npx tsx scripts/seed-inventory-setup.ts [tenantSlug]
 */
import { prisma } from '../src/config/database.js'

const TENANT_SLUG = process.argv[2] ?? 'vasant-trailers'

async function main() {
  const tenant = await prisma.tenant.findFirst({ where: { slug: TENANT_SLUG, deletedAt: null } })
  if (!tenant) throw new Error(`Tenant not found: ${TENANT_SLUG}`)
  const tenantId = tenant.id

  const warehouses = await prisma.masterWarehouse.findMany({
    where: { tenantId, deletedAt: null },
  })
  if (!warehouses.length) {
    console.log('No warehouses found — run the main seed first.')
    return
  }

  const plantCodes = [...new Set(warehouses.map((w) => w.plantCode || 'PUNE'))]
  const plantIdByCode = new Map<string, string>()
  for (const code of plantCodes) {
    const plant = await prisma.masterPlant.upsert({
      where: { tenantId_code: { tenantId, code } },
      create: { tenantId, code, name: `${code} Plant`, status: 'ACTIVE' },
      update: { deletedAt: null },
    })
    plantIdByCode.set(code, plant.id)
  }
  console.log(`Plants ensured: ${plantIdByCode.size} (${plantCodes.join(', ')})`)

  let linked = 0
  for (const wh of warehouses) {
    const plantId = plantIdByCode.get(wh.plantCode || 'PUNE')
    if (!plantId || wh.plantId === plantId) continue
    await prisma.masterWarehouse.update({ where: { id: wh.id }, data: { plantId } })
    linked += 1
  }
  console.log(`Warehouses linked to plants: ${linked}/${warehouses.length}`)

  let locationsCreated = 0
  let binsCreated = 0
  for (const wh of warehouses) {
    let locations = await prisma.masterLocation.findMany({
      where: { tenantId, warehouseId: wh.id, deletedAt: null },
    })
    if (!locations.length) {
      const loc = await prisma.masterLocation.create({
        data: {
          tenantId,
          warehouseId: wh.id,
          code: `${wh.code}-LOC1`,
          name: `${wh.name} — Default Zone`,
          status: 'ACTIVE',
        },
      })
      locations = [loc]
      locationsCreated += 1
    }
    for (const loc of locations) {
      const existingBin = await prisma.masterBin.findFirst({
        where: { tenantId, storageLocationId: loc.id, deletedAt: null },
      })
      if (existingBin) continue
      await prisma.masterBin.create({
        data: {
          tenantId,
          warehouseId: wh.id,
          storageLocationId: loc.id,
          code: `${loc.code}-B01`.slice(0, 32),
          name: `${loc.name} — Bin 01`,
          binType: 'general',
          status: 'ACTIVE',
        },
      })
      binsCreated += 1
    }
  }
  console.log(`Storage locations created: ${locationsCreated}`)
  console.log(`Bins created: ${binsCreated}`)

  const counts = {
    plants: await prisma.masterPlant.count({ where: { tenantId, deletedAt: null } }),
    warehouses: await prisma.masterWarehouse.count({ where: { tenantId, deletedAt: null } }),
    storageLocations: await prisma.masterLocation.count({ where: { tenantId, deletedAt: null } }),
    bins: await prisma.masterBin.count({ where: { tenantId, deletedAt: null } }),
  }
  console.log('Totals:', JSON.stringify(counts))
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })

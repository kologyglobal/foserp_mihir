/**
 * Seeds local purchase-ready masters for manual UAT (vasant-trailers).
 * Idempotent upserts — safe to re-run.
 *
 *   npx tsx scripts/seed-purchase-demo-data.ts
 */
import { prisma } from '../src/config/database.js'

const TENANT_SLUG = process.env.SEED_TENANT_SLUG ?? 'vasant-trailers'

const UOMS = [
  { code: 'Nos', name: 'Numbers', uomType: 'integer', decimalPlaces: 0, isBaseUnit: true },
  { code: 'KG', name: 'Kilogram', uomType: 'decimal', decimalPlaces: 3, isBaseUnit: false },
  { code: 'MTR', name: 'Meter', uomType: 'decimal', decimalPlaces: 2, isBaseUnit: false },
  { code: 'LTR', name: 'Litre', uomType: 'decimal', decimalPlaces: 2, isBaseUnit: false },
  { code: 'SET', name: 'Set', uomType: 'integer', decimalPlaces: 0, isBaseUnit: false },
] as const

const VENDORS = [
  {
    code: 'VND-STEEL-01',
    name: 'Gujarat Steel Traders',
    city: 'Ahmedabad',
    state: 'Gujarat',
    contactPerson: 'Ramesh Shah',
    contactPhone: '9876501001',
    email: 'sales@gujaratsteel.example',
    gstin: '24AABCG1234A1Z5',
    vendorType: 'trader',
    defaultLeadTimeDays: 5,
  },
  {
    code: 'VND-AXLE-02',
    name: 'Bharat Axle Components',
    city: 'Rajkot',
    state: 'Gujarat',
    contactPerson: 'Priya Mehta',
    contactPhone: '9876501002',
    email: 'orders@bharataxle.example',
    gstin: '24AABCB5678B1Z2',
    vendorType: 'manufacturer',
    defaultLeadTimeDays: 10,
  },
  {
    code: 'VND-HYD-03',
    name: 'Saurashtra Hydraulics',
    city: 'Vadodara',
    state: 'Gujarat',
    contactPerson: 'Amit Patel',
    contactPhone: '9876501003',
    email: 'info@saurashtrahyd.example',
    gstin: '24AABCS9012C1Z9',
    vendorType: 'manufacturer',
    defaultLeadTimeDays: 7,
  },
  {
    code: 'VND-FAST-04',
    name: 'Metro Fasteners Pvt Ltd',
    city: 'Mumbai',
    state: 'Maharashtra',
    contactPerson: 'Suresh Nair',
    contactPhone: '9876501004',
    email: 'sales@metrofast.example',
    gstin: '27AABCM3456D1Z1',
    vendorType: 'trader',
    defaultLeadTimeDays: 3,
  },
  {
    code: 'VND-PAINT-05',
    name: 'Western Coatings India',
    city: 'Pune',
    state: 'Maharashtra',
    contactPerson: 'Neha Kulkarni',
    contactPhone: '9876501005',
    email: 'support@westerncoat.example',
    gstin: '27AABCW7890E1Z3',
    vendorType: 'manufacturer',
    defaultLeadTimeDays: 4,
  },
] as const

const ITEMS: Array<{
  code: string
  name: string
  itemType: string
  categoryCode: string
  uomCode: string
  hsnCode: string
  standardRate: number
  reorderLevel: number
}> = [
  {
    code: 'RM-MS-PLATE-6MM',
    name: 'MS Plate 6mm',
    itemType: 'raw',
    categoryCode: 'CAT-RM',
    uomCode: 'KG',
    hsnCode: '7208',
    standardRate: 62,
    reorderLevel: 500,
  },
  {
    code: 'RM-MS-CHANNEL-100',
    name: 'MS Channel 100x50',
    itemType: 'raw',
    categoryCode: 'CAT-RM',
    uomCode: 'MTR',
    hsnCode: '7216',
    standardRate: 85,
    reorderLevel: 200,
  },
  {
    code: 'BO-AXLE-ASSY-13T',
    name: 'Axle Assembly 13T',
    itemType: 'bought_out',
    categoryCode: 'CAT-BO',
    uomCode: 'Nos',
    hsnCode: '8708',
    standardRate: 28500,
    reorderLevel: 4,
  },
  {
    code: 'BO-HYD-CYL-60',
    name: 'Hydraulic Cylinder 60T',
    itemType: 'bought_out',
    categoryCode: 'CAT-BO',
    uomCode: 'Nos',
    hsnCode: '8412',
    standardRate: 42000,
    reorderLevel: 2,
  },
  {
    code: 'BO-TYRE-385-65',
    name: 'Tyre 385/65 R22.5',
    itemType: 'bought_out',
    categoryCode: 'CAT-BO',
    uomCode: 'Nos',
    hsnCode: '4011',
    standardRate: 18500,
    reorderLevel: 12,
  },
  {
    code: 'CS-BOLT-M16',
    name: 'Hex Bolt M16x60',
    itemType: 'consumable',
    categoryCode: 'CAT-CS',
    uomCode: 'Nos',
    hsnCode: '7318',
    standardRate: 12,
    reorderLevel: 1000,
  },
  {
    code: 'CS-PAINT-EPOXY',
    name: 'Epoxy Primer Grey 20L',
    itemType: 'consumable',
    categoryCode: 'CAT-CS',
    uomCode: 'LTR',
    hsnCode: '3208',
    standardRate: 280,
    reorderLevel: 40,
  },
  {
    code: 'BO-BRAKE-CHAMBER',
    name: 'Brake Chamber Type 30',
    itemType: 'bought_out',
    categoryCode: 'CAT-BO',
    uomCode: 'SET',
    hsnCode: '8708',
    standardRate: 2450,
    reorderLevel: 10,
  },
]

const CATEGORIES = [
  { code: 'CAT-RM', name: 'Raw Materials' },
  { code: 'CAT-BO', name: 'Bought Out' },
  { code: 'CAT-CS', name: 'Consumables' },
] as const

async function main(): Promise<void> {
  const tenant = await prisma.tenant.findFirst({ where: { slug: TENANT_SLUG, deletedAt: null } })
  if (!tenant) {
    throw new Error(`Tenant not found: ${TENANT_SLUG}. Run npm run db:seed first.`)
  }
  const admin = await prisma.user.findFirst({
    where: { tenantId: tenant.id, email: 'admin@vasant-trailers.com', deletedAt: null },
  })
  const actorId = admin?.id ?? null
  const tid = tenant.id

  console.log(`Seeding purchase demo data for ${tenant.slug}...`)

  const uomIdByCode = new Map<string, string>()
  for (const u of UOMS) {
    const row = await prisma.masterUom.upsert({
      where: { tenantId_code: { tenantId: tid, code: u.code } },
      create: {
        tenantId: tid,
        code: u.code,
        name: u.name,
        description: u.name,
        uomType: u.uomType,
        decimalPlaces: u.decimalPlaces,
        isBaseUnit: u.isBaseUnit,
        status: 'ACTIVE',
        createdBy: actorId,
        updatedBy: actorId,
      },
      update: {
        name: u.name,
        status: 'ACTIVE',
        deletedAt: null,
        updatedBy: actorId,
      },
    })
    uomIdByCode.set(u.code, row.id)
  }

  const categoryIdByCode = new Map<string, string>()
  for (const c of CATEGORIES) {
    const row = await prisma.masterItemCategory.upsert({
      where: { tenantId_code: { tenantId: tid, code: c.code } },
      create: {
        tenantId: tid,
        code: c.code,
        name: c.name,
        level: 1,
        status: 'ACTIVE',
        createdBy: actorId,
        updatedBy: actorId,
      },
      update: { name: c.name, status: 'ACTIVE', deletedAt: null, updatedBy: actorId },
    })
    categoryIdByCode.set(c.code, row.id)
  }

  let itemCount = 0
  for (const item of ITEMS) {
    const categoryId = categoryIdByCode.get(item.categoryCode)
    const baseUomId = uomIdByCode.get(item.uomCode)
    if (!categoryId || !baseUomId) continue
    await prisma.masterItem.upsert({
      where: { tenantId_code: { tenantId: tid, code: item.code } },
      create: {
        tenantId: tid,
        code: item.code,
        name: item.name,
        itemDescription: item.name,
        categoryId,
        baseUomId,
        itemType: item.itemType,
        inventoryType: 'inventory',
        hsnCode: item.hsnCode,
        standardRate: item.standardRate,
        reorderLevel: item.reorderLevel,
        isPurchasable: true,
        isStockable: true,
        status: 'ACTIVE',
        createdBy: actorId,
        updatedBy: actorId,
      },
      update: {
        name: item.name,
        itemDescription: item.name,
        categoryId,
        baseUomId,
        itemType: item.itemType,
        hsnCode: item.hsnCode,
        standardRate: item.standardRate,
        reorderLevel: item.reorderLevel,
        isPurchasable: true,
        isStockable: true,
        status: 'ACTIVE',
        deletedAt: null,
        updatedBy: actorId,
      },
    })
    itemCount += 1
  }

  let vendorCount = 0
  for (const v of VENDORS) {
    await prisma.masterVendor.upsert({
      where: { tenantId_code: { tenantId: tid, code: v.code } },
      create: {
        tenantId: tid,
        code: v.code,
        name: v.name,
        searchName: v.name.slice(0, 50),
        city: v.city,
        state: v.state,
        country: 'India',
        email: v.email,
        gstin: v.gstin,
        vendorType: v.vendorType,
        contactPerson: v.contactPerson,
        contactPhone: v.contactPhone,
        paymentTermsDays: 30,
        defaultLeadTimeDays: v.defaultLeadTimeDays,
        suppliedCategories: [],
        rating: 4.2,
        status: 'ACTIVE',
        createdBy: actorId,
        updatedBy: actorId,
      },
      update: {
        name: v.name,
        city: v.city,
        state: v.state,
        email: v.email,
        gstin: v.gstin,
        contactPerson: v.contactPerson,
        contactPhone: v.contactPhone,
        defaultLeadTimeDays: v.defaultLeadTimeDays,
        status: 'ACTIVE',
        deletedAt: null,
        updatedBy: actorId,
      },
    })
    vendorCount += 1
  }

  const purchasable = await prisma.masterItem.count({
    where: { tenantId: tid, deletedAt: null, isPurchasable: true, status: 'ACTIVE' },
  })
  const vendors = await prisma.masterVendor.count({
    where: { tenantId: tid, deletedAt: null, status: 'ACTIVE' },
  })
  const warehouses = await prisma.masterWarehouse.count({
    where: { tenantId: tid, deletedAt: null, status: 'ACTIVE' },
  })

  console.log('=== Purchase demo seed complete ===')
  console.log(`UOMs upserted: ${UOMS.length}`)
  console.log(`Purchasable items upserted: ${itemCount}`)
  console.log(`Vendors upserted: ${vendorCount}`)
  console.log(`Active purchasable items: ${purchasable}`)
  console.log(`Active vendors: ${vendors}`)
  console.log(`Active warehouses: ${warehouses}`)
  console.log('Hard-refresh the UI (masters hydrate on login).')
}

main()
  .catch((err) => {
    console.error(err)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })

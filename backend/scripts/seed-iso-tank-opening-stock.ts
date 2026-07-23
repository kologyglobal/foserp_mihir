/**
 * Post opening stock for the 26 KL ISO tank pilot items.
 *
 * Uses the same posting engine as POST /inventory/movements/opening so
 * InventoryStockMovement (ledger) and InventoryStockBalance stay consistent.
 *
 * Example balances (user checklist):
 *   SA516 Plate      → RM-MAIN  5,000 KG
 *   Welding Wire     → RM-MAIN    500 KG
 *   Corner Casting   → BO-MAIN     20 NOS
 *   Primer           → RM-MAIN    200 LTR
 *
 * Safe to re-run (idempotency keys).
 *
 * Usage:
 *   npx tsx scripts/seed-iso-tank-opening-stock.ts
 *   npx tsx scripts/seed-iso-tank-opening-stock.ts vasant-trailers
 */
import { prisma } from '../src/config/database.js'
import { postStockMovement } from '../src/modules/inventory/shared/stock-posting.service.js'
import { ensureCodeSeries } from '../src/services/codeSeries.service.js'

const tenantSlug = process.argv[2] ?? process.env.TENANT_SLUG ?? 'vasant-trailers'

interface OpeningLine {
  itemCode: string
  warehouseCode: string
  quantity: number
  rate?: number
  batchNumber?: string
  remarks: string
}

const WAREHOUSES = [
  { code: 'RM-MAIN', name: 'Raw Material Main Store', warehouseType: 'raw_material' },
  { code: 'BO-MAIN', name: 'Bought Out Main Store', warehouseType: 'bought_out' },
] as const

const OPENING_LINES: OpeningLine[] = [
  {
    itemCode: 'RM-SA516-GR70',
    warehouseCode: 'RM-MAIN',
    quantity: 5000,
    rate: 85,
    batchNumber: 'OPN-SA516-2026',
    remarks: 'Opening stock — SA516 Gr70 Plate (pilot)',
  },
  {
    itemCode: 'RM-WELD-WIRE',
    warehouseCode: 'RM-MAIN',
    quantity: 500,
    rate: 180,
    batchNumber: 'OPN-WELD-2026',
    remarks: 'Opening stock — Welding Wire (pilot)',
  },
  {
    itemCode: 'BO-CORNER-CASTING',
    warehouseCode: 'BO-MAIN',
    quantity: 20,
    rate: 3500,
    remarks: 'Opening stock — Corner Casting (pilot)',
  },
  {
    itemCode: 'RM-PRIMER-PAINT',
    warehouseCode: 'RM-MAIN',
    quantity: 200,
    rate: 420,
    batchNumber: 'OPN-PRIMER-2026',
    remarks: 'Opening stock — Primer Paint (pilot)',
  },
]

async function main() {
  const tenant = await prisma.tenant.findFirst({
    where: { slug: tenantSlug, deletedAt: null },
  })
  if (!tenant) throw new Error(`Tenant not found: ${tenantSlug}`)

  const admin = await prisma.user.findFirst({
    where: { tenantId: tenant.id, deletedAt: null, status: 'ACTIVE' },
    orderBy: { createdAt: 'asc' },
  })
  const userId = admin?.id ?? undefined

  console.log(`Posting ISO tank pilot opening stock for "${tenant.name}" (${tenant.slug})…`)

  await ensureCodeSeries(tenant.id, 'STOCK_MOVEMENT')

  const plant = await prisma.masterPlant.upsert({
    where: { tenantId_code: { tenantId: tenant.id, code: 'AHMD' } },
    create: {
      tenantId: tenant.id,
      code: 'AHMD',
      name: 'Ahmedabad Plant',
      status: 'ACTIVE',
      createdBy: userId,
      updatedBy: userId,
    },
    update: { status: 'ACTIVE', deletedAt: null, name: 'Ahmedabad Plant' },
  })

  const warehouseIds = new Map<string, string>()
  for (const w of WAREHOUSES) {
    const row = await prisma.masterWarehouse.upsert({
      where: { tenantId_code: { tenantId: tenant.id, code: w.code } },
      create: {
        tenantId: tenant.id,
        plantId: plant.id,
        code: w.code,
        name: w.name,
        warehouseType: w.warehouseType,
        plantCode: 'AHMD',
        status: 'ACTIVE',
        createdBy: userId,
        updatedBy: userId,
      },
      update: {
        plantId: plant.id,
        name: w.name,
        warehouseType: w.warehouseType,
        plantCode: 'AHMD',
        status: 'ACTIVE',
        deletedAt: null,
        updatedBy: userId,
      },
    })
    warehouseIds.set(w.code, row.id)
  }
  console.log(`✓ Warehouses: ${[...warehouseIds.keys()].join(', ')}`)

  // Align pilot category defaults to RM-MAIN / BO-MAIN so issue defaults match opening stock.
  const catWh: Array<{ categoryCode: string; warehouseCode: string }> = [
    { categoryCode: 'CAT-RM', warehouseCode: 'RM-MAIN' },
    { categoryCode: 'CAT-RM-PLATE', warehouseCode: 'RM-MAIN' },
    { categoryCode: 'CAT-RM-STRUCT', warehouseCode: 'RM-MAIN' },
    { categoryCode: 'CAT-RM-CONS', warehouseCode: 'RM-MAIN' },
    { categoryCode: 'CAT-BO', warehouseCode: 'BO-MAIN' },
  ]
  for (const map of catWh) {
    const whId = warehouseIds.get(map.warehouseCode)
    if (!whId) continue
    await prisma.masterItemCategory.updateMany({
      where: { tenantId: tenant.id, code: map.categoryCode, deletedAt: null },
      data: { defaultWarehouseId: whId },
    })
  }

  const posted: Array<{
    itemCode: string
    warehouseCode: string
    quantity: number
    movementNumber: string
    onHandQty: string
  }> = []

  for (const line of OPENING_LINES) {
    const item = await prisma.masterItem.findFirst({
      where: { tenantId: tenant.id, code: line.itemCode, deletedAt: null },
    })
    if (!item) {
      throw new Error(
        `Item ${line.itemCode} not found. Run: npx tsx scripts/seed-iso-tank-pilot-items.ts`,
      )
    }
    const warehouseId = warehouseIds.get(line.warehouseCode)
    if (!warehouseId) throw new Error(`Warehouse missing: ${line.warehouseCode}`)

    const idempotencyKey = `opn-iso-pilot-${tenant.slug}-${line.itemCode}-${line.warehouseCode}-v1`

    const movement = await postStockMovement({
      tenantId: tenant.id,
      itemId: item.id,
      warehouseId,
      movementType: 'OPENING',
      referenceType: 'OPN',
      quantity: line.quantity,
      rate: line.rate ?? Number(item.standardRate ?? 0),
      referenceNo: `OPN-ISO-PILOT-${line.itemCode}`,
      remarks: line.remarks,
      idempotencyKey,
      batchNumber: item.batchTracked ? line.batchNumber ?? `OPN-${line.itemCode}-2026` : undefined,
      createdBy: userId,
      stockStatus: 'UNRESTRICTED',
    })

    const balance = await prisma.inventoryStockBalance.findUnique({
      where: {
        tenantId_itemId_warehouseId: {
          tenantId: tenant.id,
          itemId: item.id,
          warehouseId,
        },
      },
    })

    posted.push({
      itemCode: line.itemCode,
      warehouseCode: line.warehouseCode,
      quantity: line.quantity,
      movementNumber: movement.movementNumber,
      onHandQty: String(balance?.onHandQty ?? '0'),
    })

    console.log(
      `  · ${line.itemCode.padEnd(22)} ${line.warehouseCode.padEnd(8)} qty=${String(line.quantity).padStart(6)}  mov=${movement.movementNumber}  onHand=${balance?.onHandQty ?? 0}`,
    )
  }

  // ── Verification ──────────────────────────────────────────────────────
  console.log('\n── Verification ──')
  let ok = true

  for (const line of OPENING_LINES) {
    const item = await prisma.masterItem.findFirst({
      where: { tenantId: tenant.id, code: line.itemCode, deletedAt: null },
    })
    const warehouseId = warehouseIds.get(line.warehouseCode)!
    if (!item) {
      console.log(`  ✗ ${line.itemCode}: item missing`)
      ok = false
      continue
    }

    const balance = await prisma.inventoryStockBalance.findUnique({
      where: {
        tenantId_itemId_warehouseId: {
          tenantId: tenant.id,
          itemId: item.id,
          warehouseId,
        },
      },
    })
    const onHand = Number(balance?.onHandQty ?? 0)
    if (!balance || onHand <= 0) {
      console.log(`  ✗ ${line.itemCode} @ ${line.warehouseCode}: balance missing or zero (onHand=${onHand})`)
      ok = false
    } else if (onHand < line.quantity) {
      console.log(
        `  ✗ ${line.itemCode} @ ${line.warehouseCode}: onHand ${onHand} < expected ${line.quantity}`,
      )
      ok = false
    } else {
      console.log(`  ✓ Balance ${line.itemCode} @ ${line.warehouseCode}: onHand=${onHand}`)
    }

    const movements = await prisma.inventoryStockMovement.findMany({
      where: {
        tenantId: tenant.id,
        itemId: item.id,
        warehouseId,
        movementType: 'OPENING',
        referenceType: 'OPN',
      },
      orderBy: { createdAt: 'desc' },
      take: 3,
    })
    if (movements.length === 0) {
      console.log(`  ✗ ${line.itemCode}: no OPENING movement (item ledger)`)
      ok = false
    } else {
      console.log(
        `  ✓ Ledger ${line.itemCode}: ${movements.length} OPENING movement(s), latest=${movements[0]!.movementNumber} qty=${movements[0]!.quantity}`,
      )
    }
  }

  // Warehouse-level non-zero check
  for (const whCode of ['RM-MAIN', 'BO-MAIN'] as const) {
    const whId = warehouseIds.get(whCode)!
    const agg = await prisma.inventoryStockBalance.aggregate({
      where: { tenantId: tenant.id, warehouseId: whId },
      _sum: { onHandQty: true },
      _count: true,
    })
    const total = Number(agg._sum.onHandQty ?? 0)
    if (total <= 0 || agg._count === 0) {
      console.log(`  ✗ Warehouse ${whCode}: total onHand=${total} (rows=${agg._count})`)
      ok = false
    } else {
      console.log(`  ✓ Warehouse ${whCode}: total onHand=${total} across ${agg._count} balance row(s)`)
    }
  }

  console.log(`\n${ok ? '✓ Opening stock ready' : '✗ Verification failed'}`)
  console.log('UI: /inventory/opening-stock  ·  /inventory/stock  ·  /inventory/ledger')
  if (!ok) process.exit(1)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })

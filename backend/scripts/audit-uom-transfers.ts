/**
 * Audit item-master UOM conversions + existing PO/GRN lines for mismatches.
 * Usage: npx tsx scripts/audit-uom-transfers.ts
 */
import { prisma } from '../src/config/prisma.js'

async function main() {
  const items = await prisma.masterItem.findMany({
    where: { deletedAt: null },
    select: {
      id: true,
      code: true,
      name: true,
      baseUomId: true,
      purchaseUomId: true,
      uomConversionFactor: true,
      quantityPerUom: true,
      baseUom: { select: { code: true } },
      purchaseUom: { select: { code: true } },
      uomConversions: {
        select: {
          uomId: true,
          conversionFactor: true,
          isPurchaseAllowed: true,
          isDefaultPurchase: true,
          uom: { select: { code: true } },
        },
      },
    },
  })

  console.log(`Total active items: ${items.length}`)
  const problems: string[] = []
  let muomCount = 0

  for (const it of items) {
    const rows = it.uomConversions
    const hasMuomRow = rows.some((r) => Number(r.conversionFactor) !== 1)
    const legacyMuom = it.purchaseUomId && it.purchaseUomId !== it.baseUomId
    if (!hasMuomRow && !legacyMuom) continue
    muomCount++

    const defaultPurchaseRows = rows.filter((r) => r.isDefaultPurchase)
    const purchaseAllowedRows = rows.filter((r) => r.isPurchaseAllowed)
    const baseRow = rows.find((r) => r.uomId === it.baseUomId)

    if (defaultPurchaseRows.length === 0 && !it.purchaseUomId) {
      problems.push(`${it.code}: no default purchase UOM configured`)
    }
    if (defaultPurchaseRows.length > 1) {
      problems.push(
        `${it.code}: multiple default-purchase rows (${defaultPurchaseRows
          .map((r) => r.uom.code)
          .join(', ')})`,
      )
    }
    for (const dp of defaultPurchaseRows) {
      if (dp.uomId !== it.baseUomId && Number(dp.conversionFactor) <= 1) {
        problems.push(
          `${it.code}: default purchase UOM ${dp.uom.code} has factor ${dp.conversionFactor} (≤1) but differs from base ${it.baseUom.code}`,
        )
      }
    }
    if (baseRow && Number(baseRow.conversionFactor) !== 1) {
      problems.push(`${it.code}: base UOM row factor is ${baseRow.conversionFactor}, expected 1`)
    }
    // Nos/base allowed as purchase alongside a >1 factor alt UOM: risk of accidental 1:1 PO lines.
    const altHighFactorAllowed = purchaseAllowedRows.some(
      (r) => r.uomId !== it.baseUomId && Number(r.conversionFactor) > 1,
    )
    const baseAllowedAsPurchase = purchaseAllowedRows.some((r) => r.uomId === it.baseUomId)
    if (altHighFactorAllowed && baseAllowedAsPurchase) {
      problems.push(
        `${it.code}: base UOM (${it.baseUom.code}) is Allowed as a purchase UOM alongside a >1 factor alt UOM — risk of 1:1 mis-entry`,
      )
    }
    // quantityPerUom (General section) should match default purchase factor.
    if (defaultPurchaseRows.length === 1) {
      const dp = defaultPurchaseRows[0]
      const qpu = Number(it.quantityPerUom ?? 0)
      const factor = Number(dp.conversionFactor)
      if (dp.uomId !== it.baseUomId && qpu > 0 && Math.abs(qpu - factor) > 1e-6) {
        problems.push(
          `${it.code}: General Quantity (${qpu}) does not match default purchase factor (${factor})`,
        )
      }
    }
  }

  console.log(`\nMUOM items found: ${muomCount}`)
  console.log(`\n--- Item master problems (${problems.length}) ---`)
  for (const p of problems) console.log(' - ' + p)

  // Cross-check PO lines that reference MUOM items but were snapshotted with factor 1
  // (mismatched against the item master's current default purchase factor).
  console.log('\n--- PO line snapshot mismatches (existing orders) ---')
  const poLines = await prisma.purchaseOrderLine.findMany({
    where: { itemId: { not: null } },
    select: {
      id: true,
      itemId: true,
      itemCodeSnapshot: true,
      quantity: true,
      uomQuantity: true,
      uomConversionFactor: true,
      purchaseOrder: { select: { orderNumber: true } },
    },
  })
  const itemById = new Map(items.map((it) => [it.id, it]))
  let mismatchCount = 0
  for (const line of poLines) {
    const master = line.itemId ? itemById.get(line.itemId) : null
    if (!master) continue
    const defaultRow = master.uomConversions.find((r) => r.isDefaultPurchase)
    if (!defaultRow || defaultRow.uomId === master.baseUomId) continue
    const masterFactor = Number(defaultRow.conversionFactor)
    const lineFactor = Number(line.uomConversionFactor)
    if (masterFactor > 1 && lineFactor <= 1) {
      mismatchCount++
      console.log(
        ` - ${line.purchaseOrder.orderNumber} / ${line.itemCodeSnapshot}: line factor ${lineFactor} vs item master default-purchase factor ${masterFactor} (qty ${line.quantity}, uomQty ${line.uomQuantity})`,
      )
    }
  }
  console.log(`Total mismatched PO lines: ${mismatchCount}`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())

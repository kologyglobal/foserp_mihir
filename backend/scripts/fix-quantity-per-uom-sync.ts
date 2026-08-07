/**
 * Data-hygiene fix: `MasterItem.quantityPerUom` (General → Quantity display field) was left at 1
 * for items whose default-purchase UOM conversion factor is >1. This field is NOT read by any
 * backend business logic (only referenced in item.validation.ts as an input default) — it only
 * drives the "General" section display in the item master UI, which is supposed to mirror the
 * default purchase row's conversionFactor. Backfilling it here for items where the two clearly
 * disagree because the item was seeded/scripted rather than saved through the item master form.
 *
 * Usage: npx tsx scripts/fix-quantity-per-uom-sync.ts [--dry]
 */
import { prisma } from '../src/config/prisma.js'

const DRY = process.argv.includes('--dry')

async function main() {
  const items = await prisma.masterItem.findMany({
    where: { deletedAt: null },
    select: {
      id: true,
      code: true,
      baseUomId: true,
      quantityPerUom: true,
      uomConversions: {
        where: { isDefaultPurchase: true },
        select: { uomId: true, conversionFactor: true },
      },
    },
  })

  let fixed = 0
  for (const it of items) {
    const dp = it.uomConversions[0]
    if (!dp || dp.uomId === it.baseUomId) continue
    const factor = Number(dp.conversionFactor)
    const qpu = Number(it.quantityPerUom)
    if (factor <= 1 || Math.abs(qpu - factor) < 1e-9) continue

    console.log(`${it.code}: quantityPerUom ${qpu} -> ${factor}`)
    if (!DRY) {
      await prisma.masterItem.update({
        where: { id: it.id },
        data: { quantityPerUom: factor },
      })
    }
    fixed++
  }
  console.log(`\n${DRY ? '[dry-run] Would fix' : 'Fixed'} ${fixed} item(s).`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())

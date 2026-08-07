/**
 * RM-MS-PIPE-DN25 had default purchase UOM = MTR with factor 1 (implies 1 Nos = 1 MTR),
 * inconsistent with its near-duplicate MS-PIPE-LEN-MTR (factor 6). Correcting to factor 6
 * across the conversion row + legacy scalar fields.
 *
 * Usage: npx tsx scripts/fix-rm-ms-pipe-dn25-factor.ts
 */
import { prisma } from '../src/config/prisma.js'

const CODE = 'RM-MS-PIPE-DN25'
const NEW_FACTOR = 6

async function main() {
  const item = await prisma.masterItem.findFirst({
    where: { code: CODE },
    select: {
      id: true,
      baseUomId: true,
      uomConversions: { select: { id: true, uomId: true, isDefaultPurchase: true } },
    },
  })
  if (!item) throw new Error(`${CODE} not found`)

  const defaultRow = item.uomConversions.find((r) => r.isDefaultPurchase)
  if (!defaultRow) throw new Error(`${CODE}: no default purchase row found`)

  await prisma.$transaction([
    prisma.masterItemUomConversion.update({
      where: { id: defaultRow.id },
      data: { conversionFactor: NEW_FACTOR },
    }),
    prisma.masterItem.update({
      where: { id: item.id },
      data: { uomConversionFactor: NEW_FACTOR, purchaseQtyPerUom: NEW_FACTOR, quantityPerUom: NEW_FACTOR },
    }),
  ])

  console.log(`${CODE}: MTR factor set to ${NEW_FACTOR} (conversion row + legacy fields).`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())

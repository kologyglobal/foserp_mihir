/**
 * Count soft-deleted rows with null itemId (blocks ALTER NOT NULL).
 */
import { prisma } from '../src/config/database.js'

async function main() {
  const [quotes, sos, opp] = await Promise.all([
    prisma.crmQuotation.count({
      where: { deletedAt: { not: null }, OR: [{ itemId: null }, { itemId: '' }] },
    }),
    prisma.crmSalesOrder.count({
      where: { deletedAt: { not: null }, OR: [{ itemId: null }, { itemId: '' }] },
    }),
    prisma.crmOpportunityLine.count({
      where: { OR: [{ itemId: null }, { itemId: '' }] },
    }),
  ])
  console.log({ softDeletedQuotesNullItemId: quotes, softDeletedSosNullItemId: sos, oppLinesNullItemId: opp })
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })

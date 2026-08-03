import { createPrismaClient } from '../src/config/prisma.js'

const prisma = createPrismaClient()

async function main() {
  try {
    const items = await prisma.purchaseOrder.findMany({
      take: 1,
      include: {
        lines: {
          include: {
            bin: { select: { id: true, code: true, name: true } },
            uom: { select: { id: true, code: true, name: true } },
            gstGroup: { select: { id: true, code: true } },
            hsn: { select: { id: true, code: true } },
          },
        },
        vendor: true,
        deliveryWarehouse: true,
        revisions: { take: 1 },
      },
    })
    console.log('OK purchaseOrder query, count:', items.length)
  } catch (e) {
    console.error('FAIL', e)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

void main()

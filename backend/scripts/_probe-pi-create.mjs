import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  const tenant = await prisma.tenant.findFirst({
    where: { slug: 'vasant-trailers' },
    select: { id: true },
  })
  if (!tenant) {
    console.log('no tenant')
    return
  }
  const vendor = await prisma.masterVendor.findFirst({
    where: { tenantId: tenant.id, deletedAt: null, status: 'ACTIVE' },
    select: { id: true },
  })
  if (!vendor) {
    console.log('no vendor')
    return
  }
  console.log('tenant', tenant.id, 'vendor', vendor.id)
  try {
    const row = await prisma.purchaseInvoice.create({
      data: {
        tenantId: tenant.id,
        invoiceNumber: `TEST-PI-DEBUG-${Date.now()}`,
        invoiceDate: new Date(),
        vendorId: vendor.id,
        status: 'DRAFT',
        subtotalAmount: 100,
        taxAmount: 18,
        roundOffAmount: 0,
        totalAmount: 118,
        lines: {
          create: [
            {
              tenantId: tenant.id,
              lineNumber: 1,
              itemCodeSnapshot: 'X',
              itemNameSnapshot: 'Test',
              quantity: 1,
              uomCodeSnapshot: 'NOS',
              uomQuantitySnapshot: 1,
              uomConversionFactorSnapshot: 1,
              purchaseUomCodeSnapshot: 'NOS',
              rate: 100,
              amount: 100,
              taxRatePct: 18,
              taxAmount: 18,
              lineTotal: 118,
            },
          ],
        },
      },
    })
    console.log('created', row.id)
    await prisma.purchaseInvoiceLine.deleteMany({ where: { purchaseInvoiceId: row.id } })
    await prisma.purchaseInvoice.delete({ where: { id: row.id } })
  } catch (e) {
    console.error('ERROR NAME', e.name)
    console.error('ERROR MSG', e.message)
  } finally {
    await prisma.$disconnect()
  }
}

main()

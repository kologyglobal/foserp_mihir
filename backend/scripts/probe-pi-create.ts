import { prisma } from '../src/config/prisma.js'

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

  const po = await prisma.purchaseOrder.findFirst({
    where: { tenantId: tenant.id, deletedAt: null, vendorId: vendor.id },
    include: {
      lines: {
        include: {
          uom: { select: { code: true } },
          item: { include: { baseUom: { select: { code: true } }, purchaseUom: { select: { code: true } } } },
        },
      },
    },
  })
  console.log('po', po?.id, 'lines', po?.lines?.length ?? 0)

  try {
    const { createPurchaseInvoice } = await import('../src/modules/purchase/invoices/purchase-invoice.service.js')
    const user = await prisma.user.findFirst({ where: { tenantId: tenant.id }, select: { id: true } })
    const actorId = user?.id ?? '00000000-0000-4000-8000-000000000001'
    const result = await createPurchaseInvoice(tenant.id, actorId, {
      vendorId: vendor.id,
      purchaseOrderId: po?.id ?? null,
      goodsReceiptId: null,
      lines: po?.lines?.length
        ? [
            {
              purchaseOrderLineId: po.lines[0].id,
              quantity: Number(po.lines[0].quantity) || 1,
              rate: Number(po.lines[0].rate) || 100,
              taxRatePct: 18,
            },
          ]
        : [{ quantity: 1, rate: 100, taxRatePct: 18 }],
    })
    console.log('OK', result.id, result.invoiceNumber)
    await prisma.purchaseInvoiceLine.deleteMany({ where: { purchaseInvoiceId: result.id } })
    await prisma.purchaseStatusHistory.deleteMany({ where: { documentId: result.id } }).catch(() => undefined)
    await prisma.purchaseInvoice.delete({ where: { id: result.id } })
  } catch (e: unknown) {
    const err = e as Error
    console.error('ERROR', err.name, err.message)
    if ('code' in (e as object)) console.error('code', (e as { code?: string }).code)
  } finally {
    await prisma.$disconnect()
  }
}

main()

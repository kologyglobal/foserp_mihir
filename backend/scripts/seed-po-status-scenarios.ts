/**
 * Seed PO status scenarios for UI testing (Open / Pending / Approved / Released / …).
 *
 *   npx tsx scripts/seed-po-status-scenarios.ts
 *
 * Uses SEED_TENANT_SLUG (default: first active tenant with vendors+items).
 * Idempotent: removes prior PO-TEST-* docs then recreates.
 */
import { randomUUID } from 'node:crypto'
import { prisma } from '../src/config/prisma.js'
import type { PurchaseOrderStatus } from '@prisma/client'

const TENANT_SLUG = process.env.SEED_TENANT_SLUG
const PREFIX = 'PO-TEST'

type Scenario = {
  suffix: string
  status: PurchaseOrderStatus
  label: string
  qty?: number
  receivedQty?: number
}

const SCENARIOS: Scenario[] = [
  { suffix: 'OPEN-01', status: 'DRAFT', label: 'Open #1' },
  { suffix: 'OPEN-02', status: 'DRAFT', label: 'Open #2' },
  { suffix: 'OPEN-03', status: 'DRAFT', label: 'Open #3' },
  { suffix: 'PEND-01', status: 'PENDING_APPROVAL', label: 'Pending Approved #1' },
  { suffix: 'PEND-02', status: 'PENDING_APPROVAL', label: 'Pending Approved #2' },
  { suffix: 'PEND-03', status: 'PENDING_APPROVAL', label: 'Pending Approved #3' },
  { suffix: 'APPR-01', status: 'APPROVED', label: 'Approved #1' },
  { suffix: 'APPR-02', status: 'APPROVED', label: 'Approved #2' },
  { suffix: 'REL-01', status: 'SENT_TO_VENDOR', label: 'Released #1' },
  { suffix: 'REL-02', status: 'SENT_TO_VENDOR', label: 'Released #2' },
  { suffix: 'REL-03', status: 'SENT_TO_VENDOR', label: 'Released #3' },
  {
    suffix: 'PART-01',
    status: 'PARTIALLY_RECEIVED',
    label: 'Partially Received #1',
    qty: 10,
    receivedQty: 4,
  },
  {
    suffix: 'PART-02',
    status: 'PARTIALLY_RECEIVED',
    label: 'Partially Received #2',
    qty: 20,
    receivedQty: 8,
  },
  {
    suffix: 'FULL-01',
    status: 'FULLY_RECEIVED',
    label: 'Fully Received #1',
    qty: 5,
    receivedQty: 5,
  },
  { suffix: 'REJ-01', status: 'REJECTED', label: 'Rejected #1' },
  { suffix: 'BACK-01', status: 'SENT_BACK', label: 'Sent Back #1' },
  { suffix: 'CANC-01', status: 'CANCELLED', label: 'Cancelled #1' },
  { suffix: 'CLSD-01', status: 'CLOSED', label: 'Closed #1' },
]

function today(): Date {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  return d
}

function plusDays(n: number): Date {
  const d = today()
  d.setDate(d.getDate() + n)
  return d
}

async function main() {
  const tenant = TENANT_SLUG
    ? await prisma.tenant.findFirst({ where: { slug: TENANT_SLUG, deletedAt: null } })
    : await prisma.tenant.findFirst({
        where: { deletedAt: null },
        orderBy: { createdAt: 'asc' },
      })
  if (!tenant) throw new Error('No tenant found. Restore/seed DB first.')

  const tid = tenant.id
  console.log(`Tenant: ${tenant.slug} (${tid})`)

  const vendor = await prisma.masterVendor.findFirst({
    where: { tenantId: tid, deletedAt: null, status: 'ACTIVE' },
    orderBy: { code: 'asc' },
  })
  if (!vendor) throw new Error(`No active vendor for ${tenant.slug}`)

  const warehouse = await prisma.masterWarehouse.findFirst({
    where: { tenantId: tid, deletedAt: null, status: 'ACTIVE' },
    orderBy: { code: 'asc' },
  })

  const item = await prisma.masterItem.findFirst({
    where: {
      tenantId: tid,
      deletedAt: null,
      status: 'ACTIVE',
      isPurchasable: true,
    },
    include: { baseUom: true },
    orderBy: { code: 'asc' },
  })
  if (!item) throw new Error(`No purchasable item for ${tenant.slug}`)

  const user = await prisma.user.findFirst({
    where: { tenantId: tid },
    orderBy: { createdAt: 'asc' },
  })
  const actorId = user?.id ?? null

  console.log(`Vendor: ${vendor.code} · Item: ${item.code} · WH: ${warehouse?.code ?? '—'}`)

  const existing = await prisma.purchaseOrder.findMany({
    where: { tenantId: tid, orderNumber: { startsWith: `${PREFIX}-` } },
    select: { id: true, orderNumber: true },
  })
  if (existing.length) {
    const ids = existing.map((r) => r.id)
    console.log(`Removing ${existing.length} prior ${PREFIX}-* POs…`)
    await prisma.purchaseOrderLineArchived.deleteMany({
      where: { tenantId: tid, purchaseOrderId: { in: ids } },
    }).catch(() => undefined)
    await prisma.purchaseOrderArchived.deleteMany({
      where: { tenantId: tid, purchaseOrderId: { in: ids } },
    }).catch(() => undefined)
    await prisma.purchaseOrderLine.deleteMany({
      where: { tenantId: tid, purchaseOrderId: { in: ids } },
    })
    await prisma.purchaseApproval.deleteMany({
      where: { tenantId: tid, purchaseOrderId: { in: ids } },
    })
    await prisma.purchaseStatusHistory.deleteMany({
      where: { tenantId: tid, documentType: 'PURCHASE_ORDER', documentId: { in: ids } },
    })
    await prisma.purchaseOrderRevision.deleteMany({
      where: { tenantId: tid, purchaseOrderId: { in: ids } },
    })
    await prisma.purchaseOrder.deleteMany({ where: { tenantId: tid, id: { in: ids } } })
  }

  let created = 0
  for (const scenario of SCENARIOS) {
    const orderNumber = `${PREFIX}-${scenario.suffix}`
    const qty = scenario.qty ?? 10
    const receivedQty = scenario.receivedQty ?? 0
    const rate = Number(item.standardRate ?? 100)
    const amount = Number((qty * rate).toFixed(2))
    const tax = Number((amount * 0.18).toFixed(2))
    const total = Number((amount + tax).toFixed(2))
    const id = randomUUID()
    const now = new Date()

    await prisma.purchaseOrder.create({
      data: {
        id,
        tenantId: tid,
        orderNumber,
        orderDate: today(),
        vendorId: vendor.id,
        origin: 'MANUAL',
        status: scenario.status,
        currencyCode: 'INR',
        expectedDeliveryDate: plusDays(14),
        paymentTerms: 'Net 30',
        deliveryTerms: 'Ex-Works',
        deliveryWarehouseId: warehouse?.id ?? null,
        subtotalAmount: amount,
        taxAmount: tax,
        freightAmount: 0,
        totalAmount: total,
        remarks: `UI test seed — ${scenario.label}`,
        revisionNo: 0,
        submittedAt:
          scenario.status === 'PENDING_APPROVAL' ||
          scenario.status === 'APPROVED' ||
          scenario.status === 'REJECTED' ||
          scenario.status === 'SENT_BACK' ||
          scenario.status === 'SENT_TO_VENDOR' ||
          scenario.status === 'PARTIALLY_RECEIVED' ||
          scenario.status === 'FULLY_RECEIVED' ||
          scenario.status === 'CLOSED'
            ? now
            : null,
        approvedAt:
          scenario.status === 'APPROVED' ||
          scenario.status === 'SENT_TO_VENDOR' ||
          scenario.status === 'PARTIALLY_RECEIVED' ||
          scenario.status === 'FULLY_RECEIVED' ||
          scenario.status === 'CLOSED'
            ? now
            : null,
        rejectedAt: scenario.status === 'REJECTED' ? now : null,
        rejectionReason: scenario.status === 'REJECTED' ? 'Seed rejection for UI test' : null,
        sentBackAt: scenario.status === 'SENT_BACK' ? now : null,
        sendBackReason: scenario.status === 'SENT_BACK' ? 'Seed send-back for UI test' : null,
        sentAt:
          scenario.status === 'SENT_TO_VENDOR' ||
          scenario.status === 'PARTIALLY_RECEIVED' ||
          scenario.status === 'FULLY_RECEIVED' ||
          scenario.status === 'CLOSED'
            ? now
            : null,
        closedAt: scenario.status === 'CLOSED' ? now : null,
        cancelledAt: scenario.status === 'CANCELLED' ? now : null,
        createdById: actorId,
        updatedById: actorId,
        lines: {
          create: [
            {
              id: randomUUID(),
              tenantId: tid,
              lineNumber: 1,
              itemId: item.id,
              itemCodeSnapshot: item.code,
              itemNameSnapshot: item.name,
              description: item.name,
              quantity: qty,
              uomQuantity: qty,
              uomConversionFactor: 1,
              unitCostPrimary: rate,
              uomId: item.baseUomId,
              rate,
              amount,
              receivedQuantity: receivedQty,
              acceptedQuantity: receivedQty,
              rejectedQuantity: 0,
              returnedQuantity: 0,
              invoicedQuantity: 0,
              requiredDate: plusDays(14),
              requisitionNumber: null,
              remarks: null,
            },
          ],
        },
      },
    })

    await prisma.purchaseStatusHistory.create({
      data: {
        id: randomUUID(),
        tenantId: tid,
        documentType: 'PURCHASE_ORDER',
        documentId: id,
        action: scenario.status,
        fromStatus: 'DRAFT',
        toStatus: scenario.status,
        actorId,
        actorName: user ? `${user.firstName} ${user.lastName}`.trim() : 'Seed',
        remarks: `Seeded as ${scenario.label}`,
        actedAt: now,
      },
    })

    created += 1
    console.log(`  ✓ ${orderNumber} → ${scenario.status}`)
  }

  console.log(`\nCreated ${created} test POs. Refresh /purchase/orders to test.`)
}

main()
  .catch((err) => {
    console.error(err)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })

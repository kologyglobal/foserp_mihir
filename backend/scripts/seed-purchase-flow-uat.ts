/**
 * Seeds interconnected purchase UAT documents for vasant-trailers (API mode).
 * Idempotent: removes prior UAT-* docs then recreates (≥5 PR / RFQ / PO, mixed statuses).
 *
 * Warehouses / items / vendors must already exist — run first:
 *   npx tsx scripts/seed-purchase-demo-data.ts
 *   npm run db:seed   # warehouses from main seed
 *
 * Then:
 *   npx tsx scripts/seed-purchase-flow-uat.ts
 *
 * Note: GRN has no backend table yet (demo FE only) — cannot seed GRNs to MySQL.
 */
import { prisma } from '../src/config/database.js'

const TENANT_SLUG = process.env.SEED_TENANT_SLUG ?? 'vasant-trailers'
const PREFIX = 'UAT'

function d(iso: string): Date {
  return new Date(`${iso}T00:00:00.000Z`)
}

function amt(qty: number, rate: number): number {
  return Number((qty * rate).toFixed(2))
}

async function main(): Promise<void> {
  const tenant = await prisma.tenant.findFirst({ where: { slug: TENANT_SLUG, deletedAt: null } })
  if (!tenant) throw new Error(`Tenant not found: ${TENANT_SLUG}. Run npm run db:seed first.`)
  const tid = tenant.id

  const admin = await prisma.user.findFirst({
    where: { tenantId: tid, email: 'admin@vasant-trailers.com', deletedAt: null },
  })
  const actorId = admin?.id ?? null

  const warehouses = await prisma.masterWarehouse.findMany({
    where: { tenantId: tid, deletedAt: null, status: 'ACTIVE' },
  })
  const wh = (code: string) => {
    const row = warehouses.find((w) => w.code === code)
    if (!row) throw new Error(`Warehouse missing: ${code}. Run npm run db:seed.`)
    return row
  }

  const items = await prisma.masterItem.findMany({
    where: { tenantId: tid, deletedAt: null, isPurchasable: true, status: 'ACTIVE' },
    include: { baseUom: true },
  })
  const item = (code: string) => {
    const row = items.find((i) => i.code === code)
    if (!row) throw new Error(`Item missing: ${code}. Run seed-purchase-demo-data.ts.`)
    return row
  }

  const vendors = await prisma.masterVendor.findMany({
    where: { tenantId: tid, deletedAt: null, status: 'ACTIVE' },
  })
  const vendor = (code: string) => {
    const row = vendors.find((v) => v.code === code)
    if (!row) throw new Error(`Vendor missing: ${code}. Run seed-purchase-demo-data.ts.`)
    return row
  }

  if (warehouses.length < 5) throw new Error(`Need ≥5 warehouses, found ${warehouses.length}`)
  if (items.length < 5) throw new Error(`Need ≥5 purchasable items, found ${items.length}`)
  if (vendors.length < 5) throw new Error(`Need ≥5 vendors, found ${vendors.length}`)

  console.log(`Clearing prior ${PREFIX}-* purchase UAT docs for ${tenant.slug}...`)
  await clearUatDocuments(tid)

  const steel = vendor('VND-STEEL-01')
  const axle = vendor('VND-AXLE-02')
  const hyd = vendor('VND-HYD-03')
  const fast = vendor('VND-FAST-04')
  const paint = vendor('VND-PAINT-05')

  const plate = item('RM-MS-PLATE-6MM')
  const channel = item('RM-MS-CHANNEL-100')
  const axleAssy = item('BO-AXLE-ASSY-13T')
  const hydCyl = item('BO-HYD-CYL-60')
  const tyre = item('BO-TYRE-385-65')
  const bolt = item('CS-BOLT-M16')
  const epoxy = item('CS-PAINT-EPOXY')
  const brake = item('BO-BRAKE-CHAMBER')

  const rmStore = wh('RM_STORE')
  const boStore = wh('BO_STORE')
  const ahmdMain = wh('AHMD_MAIN')
  const hoStore = wh('HO_STORE')
  const fgYard = wh('FG_YARD')

  console.log('Creating interconnected UAT purchase flow...')

  // ─── 1) Draft PR ─────────────────────────────────────────────
  const prDraft = await createPr({
    tid,
    actorId,
    number: `${PREFIX}-PR-0001`,
    date: '2026-07-01',
    warehouseId: rmStore.id,
    status: 'DRAFT',
    rfqRequired: false,
    purpose: 'UAT draft — edit / submit',
    priority: 'NORMAL',
    lines: [
      line(1, plate, 120, 62, rmStore.id, steel.id, '2026-07-25'),
      line(2, bolt, 500, 12, rmStore.id, fast.id, '2026-07-25'),
    ],
  })

  // ─── 2) Pending approval PR ──────────────────────────────────
  const prPending = await createPr({
    tid,
    actorId,
    number: `${PREFIX}-PR-0002`,
    date: '2026-07-02',
    warehouseId: boStore.id,
    status: 'PENDING_APPROVAL',
    rfqRequired: false,
    purpose: 'UAT pending approval — approve / reject',
    priority: 'HIGH',
    submittedAt: new Date('2026-07-02T10:00:00.000Z'),
    lines: [
      line(1, axleAssy, 2, 28500, boStore.id, axle.id, '2026-08-01'),
      line(2, tyre, 8, 18500, boStore.id, axle.id, '2026-08-01'),
    ],
  })

  // ─── 3) Rejected PR ──────────────────────────────────────────
  await createPr({
    tid,
    actorId,
    number: `${PREFIX}-PR-0003`,
    date: '2026-07-03',
    warehouseId: hoStore.id,
    status: 'REJECTED',
    rfqRequired: true,
    purpose: 'UAT rejected — revise / resubmit',
    priority: 'LOW',
    submittedAt: new Date('2026-07-03T09:00:00.000Z'),
    rejectedAt: new Date('2026-07-03T14:00:00.000Z'),
    rejectionReason: 'Budget not approved for this quarter',
    lines: [line(1, epoxy, 40, 280, hoStore.id, paint.id, '2026-07-20')],
  })

  // ─── 4) Approved + planning pending (direct path) ────────────
  const prPlanPending = await createPr({
    tid,
    actorId,
    number: `${PREFIX}-PR-0004`,
    date: '2026-07-04',
    warehouseId: rmStore.id,
    status: 'APPROVED',
    rfqRequired: false,
    purpose: 'UAT approved — planning sheet pending vendor',
    priority: 'NORMAL',
    submittedAt: new Date('2026-07-04T08:00:00.000Z'),
    approvedAt: new Date('2026-07-04T11:00:00.000Z'),
    lines: [
      line(1, channel, 80, 85, rmStore.id, steel.id, '2026-07-28'),
      line(2, plate, 200, 62, rmStore.id, steel.id, '2026-07-28'),
    ],
  })
  await createPlanningRow({
    tid,
    actorId,
    pr: prPlanPending,
    prLine: prPlanPending.lines[0],
    planningNumber: `${PREFIX}-PPS-0001`,
    warehouseHint: rmStore.id,
    vendorId: null,
    status: 'PENDING_PLANNING',
    purchaseType: 'DIRECT_PURCHASE',
  })
  await createPlanningRow({
    tid,
    actorId,
    pr: prPlanPending,
    prLine: prPlanPending.lines[1],
    planningNumber: `${PREFIX}-PPS-0002`,
    warehouseHint: rmStore.id,
    vendorId: steel.id,
    status: 'UNDER_REVIEW',
    purchaseType: 'DIRECT_PURCHASE',
  })

  // ─── 5) Approved + planning ready for PO ─────────────────────
  const prPoReady = await createPr({
    tid,
    actorId,
    number: `${PREFIX}-PR-0005`,
    date: '2026-07-05',
    warehouseId: boStore.id,
    status: 'APPROVED',
    rfqRequired: false,
    purpose: 'UAT approved — planning ready to Create PO',
    priority: 'URGENT',
    submittedAt: new Date('2026-07-05T08:00:00.000Z'),
    approvedAt: new Date('2026-07-05T10:00:00.000Z'),
    lines: [
      line(1, hydCyl, 1, 42000, boStore.id, hyd.id, '2026-08-05'),
      line(2, brake, 4, 2450, boStore.id, axle.id, '2026-08-05'),
    ],
  })
  await createPlanningRow({
    tid,
    actorId,
    pr: prPoReady,
    prLine: prPoReady.lines[0],
    planningNumber: `${PREFIX}-PPS-0003`,
    warehouseHint: boStore.id,
    vendorId: hyd.id,
    status: 'APPROVED',
    purchaseType: 'DIRECT_PURCHASE',
    actionMessage: true,
  })
  await createPlanningRow({
    tid,
    actorId,
    pr: prPoReady,
    prLine: prPoReady.lines[1],
    planningNumber: `${PREFIX}-PPS-0004`,
    warehouseHint: boStore.id,
    vendorId: axle.id,
    status: 'VENDOR_SELECTED',
    purchaseType: 'DIRECT_PURCHASE',
    actionMessage: true,
  })

  // ─── 6) Converted via Planning → draft PO ────────────────────
  const prConvDraft = await createPr({
    tid,
    actorId,
    number: `${PREFIX}-PR-0006`,
    date: '2026-07-06',
    warehouseId: ahmdMain.id,
    status: 'CONVERTED_TO_PO',
    rfqRequired: false,
    purpose: 'UAT converted (planning) — linked draft PO',
    priority: 'NORMAL',
    submittedAt: new Date('2026-07-06T08:00:00.000Z'),
    approvedAt: new Date('2026-07-06T09:00:00.000Z'),
    lines: [line(1, plate, 150, 60, ahmdMain.id, steel.id, '2026-07-30')],
  })
  const planConv1 = await createPlanningRow({
    tid,
    actorId,
    pr: prConvDraft,
    prLine: prConvDraft.lines[0],
    planningNumber: `${PREFIX}-PPS-0005`,
    warehouseHint: ahmdMain.id,
    vendorId: steel.id,
    status: 'PO_CREATED',
    purchaseType: 'DIRECT_PURCHASE',
  })
  const poDraft = await createPo({
    tid,
    actorId,
    number: `${PREFIX}-PO-0001`,
    date: '2026-07-07',
    vendorId: steel.id,
    status: 'DRAFT',
    origin: 'PLANNING_SHEET',
    prId: prConvDraft.id,
    lines: [
      {
        lineNumber: 1,
        prLineId: prConvDraft.lines[0].id,
        planningRowId: planConv1.id,
        item: plate,
        qty: 150,
        rate: 60,
        requiredDate: '2026-07-30',
      },
    ],
  })
  await stampPrLine(prConvDraft.lines[0].id, poDraft.id, poDraft.orderNumber)
  await prisma.purchasePlanningRow.update({
    where: { id: planConv1.id },
    data: {
      purchaseOrderId: poDraft.id,
      purchaseOrderNumberSnapshot: poDraft.orderNumber,
      convertedAt: new Date('2026-07-07T12:00:00.000Z'),
    },
  })

  // ─── 7) Converted → approved PO ──────────────────────────────
  const prConvApproved = await createPr({
    tid,
    actorId,
    number: `${PREFIX}-PR-0007`,
    date: '2026-07-08',
    warehouseId: boStore.id,
    status: 'CONVERTED_TO_PO',
    rfqRequired: false,
    purpose: 'UAT converted — approved PO',
    priority: 'HIGH',
    submittedAt: new Date('2026-07-08T08:00:00.000Z'),
    approvedAt: new Date('2026-07-08T09:30:00.000Z'),
    lines: [line(1, axleAssy, 3, 28000, boStore.id, axle.id, '2026-08-10')],
  })
  const planConv2 = await createPlanningRow({
    tid,
    actorId,
    pr: prConvApproved,
    prLine: prConvApproved.lines[0],
    planningNumber: `${PREFIX}-PPS-0006`,
    warehouseHint: boStore.id,
    vendorId: axle.id,
    status: 'PO_CREATED',
    purchaseType: 'DIRECT_PURCHASE',
  })
  const poApproved = await createPo({
    tid,
    actorId,
    number: `${PREFIX}-PO-0002`,
    date: '2026-07-09',
    vendorId: axle.id,
    status: 'APPROVED',
    origin: 'PLANNING_SHEET',
    prId: prConvApproved.id,
    approvedAt: new Date('2026-07-09T15:00:00.000Z'),
    submittedAt: new Date('2026-07-09T11:00:00.000Z'),
    lines: [
      {
        lineNumber: 1,
        prLineId: prConvApproved.lines[0].id,
        planningRowId: planConv2.id,
        item: axleAssy,
        qty: 3,
        rate: 28000,
        requiredDate: '2026-08-10',
      },
    ],
  })
  await stampPrLine(prConvApproved.lines[0].id, poApproved.id, poApproved.orderNumber)
  await prisma.purchasePlanningRow.update({
    where: { id: planConv2.id },
    data: {
      purchaseOrderId: poApproved.id,
      purchaseOrderNumberSnapshot: poApproved.orderNumber,
      convertedAt: new Date('2026-07-09T12:00:00.000Z'),
    },
  })

  // ─── 8) Converted → sent / partially received PO ─────────────
  const prConvSent = await createPr({
    tid,
    actorId,
    number: `${PREFIX}-PR-0008`,
    date: '2026-07-10',
    warehouseId: fgYard.id,
    status: 'CONVERTED_TO_PO',
    rfqRequired: false,
    purpose: 'UAT converted — PO sent / partial receive (GRN UI later)',
    priority: 'NORMAL',
    submittedAt: new Date('2026-07-10T08:00:00.000Z'),
    approvedAt: new Date('2026-07-10T09:00:00.000Z'),
    lines: [
      line(1, tyre, 12, 18000, fgYard.id, axle.id, '2026-08-15'),
      line(2, bolt, 2000, 11, fgYard.id, fast.id, '2026-08-15'),
    ],
  })
  // Split vendors → two POs
  const planTyre = await createPlanningRow({
    tid,
    actorId,
    pr: prConvSent,
    prLine: prConvSent.lines[0],
    planningNumber: `${PREFIX}-PPS-0007`,
    warehouseHint: fgYard.id,
    vendorId: axle.id,
    status: 'PO_CREATED',
    purchaseType: 'DIRECT_PURCHASE',
  })
  const planBolt = await createPlanningRow({
    tid,
    actorId,
    pr: prConvSent,
    prLine: prConvSent.lines[1],
    planningNumber: `${PREFIX}-PPS-0008`,
    warehouseHint: fgYard.id,
    vendorId: fast.id,
    status: 'PO_CREATED',
    purchaseType: 'DIRECT_PURCHASE',
  })
  const poSent = await createPo({
    tid,
    actorId,
    number: `${PREFIX}-PO-0003`,
    date: '2026-07-11',
    vendorId: axle.id,
    status: 'SENT_TO_VENDOR',
    origin: 'PLANNING_SHEET',
    prId: prConvSent.id,
    submittedAt: new Date('2026-07-11T10:00:00.000Z'),
    approvedAt: new Date('2026-07-11T12:00:00.000Z'),
    sentAt: new Date('2026-07-12T09:00:00.000Z'),
    lines: [
      {
        lineNumber: 1,
        prLineId: prConvSent.lines[0].id,
        planningRowId: planTyre.id,
        item: tyre,
        qty: 12,
        rate: 18000,
        requiredDate: '2026-08-15',
        receivedQty: 4,
      },
    ],
  })
  const poPartial = await createPo({
    tid,
    actorId,
    number: `${PREFIX}-PO-0004`,
    date: '2026-07-11',
    vendorId: fast.id,
    status: 'PARTIALLY_RECEIVED',
    origin: 'PLANNING_SHEET',
    prId: prConvSent.id,
    submittedAt: new Date('2026-07-11T10:00:00.000Z'),
    approvedAt: new Date('2026-07-11T12:00:00.000Z'),
    sentAt: new Date('2026-07-12T09:00:00.000Z'),
    lines: [
      {
        lineNumber: 1,
        prLineId: prConvSent.lines[1].id,
        planningRowId: planBolt.id,
        item: bolt,
        qty: 2000,
        rate: 11,
        requiredDate: '2026-08-15',
        receivedQty: 800,
      },
    ],
  })
  await stampPrLine(prConvSent.lines[0].id, poSent.id, poSent.orderNumber)
  await stampPrLine(prConvSent.lines[1].id, poPartial.id, poPartial.orderNumber)
  await prisma.purchasePlanningRow.update({
    where: { id: planTyre.id },
    data: {
      purchaseOrderId: poSent.id,
      purchaseOrderNumberSnapshot: poSent.orderNumber,
      convertedAt: new Date('2026-07-11T12:00:00.000Z'),
    },
  })
  await prisma.purchasePlanningRow.update({
    where: { id: planBolt.id },
    data: {
      purchaseOrderId: poPartial.id,
      purchaseOrderNumberSnapshot: poPartial.orderNumber,
      convertedAt: new Date('2026-07-11T12:00:00.000Z'),
    },
  })

  // ─── RFQ path: 5 RFQs at different stages ────────────────────

  // RFQ 1 — Draft
  const prRfq1 = await createPr({
    tid,
    actorId,
    number: `${PREFIX}-PR-0009`,
    date: '2026-07-12',
    warehouseId: rmStore.id,
    status: 'APPROVED',
    rfqRequired: true,
    purpose: 'UAT RFQ draft path',
    priority: 'NORMAL',
    submittedAt: new Date('2026-07-12T08:00:00.000Z'),
    approvedAt: new Date('2026-07-12T10:00:00.000Z'),
    lines: [
      line(1, channel, 50, 90, rmStore.id, steel.id, '2026-08-20'),
      line(2, plate, 100, 65, rmStore.id, steel.id, '2026-08-20'),
    ],
  })
  await createRfqBundle({
    tid,
    actorId,
    number: `${PREFIX}-RFQ-0001`,
    date: '2026-07-12',
    pr: prRfq1,
    status: 'DRAFT',
    vendorIds: [steel.id, paint.id],
    title: 'UAT RFQ draft — edit / send',
  })

  // RFQ 2 — Sent
  const prRfq2 = await createPr({
    tid,
    actorId,
    number: `${PREFIX}-PR-0010`,
    date: '2026-07-13',
    warehouseId: boStore.id,
    status: 'APPROVED',
    rfqRequired: true,
    purpose: 'UAT RFQ sent — await quotations',
    priority: 'HIGH',
    submittedAt: new Date('2026-07-13T08:00:00.000Z'),
    approvedAt: new Date('2026-07-13T09:00:00.000Z'),
    lines: [line(1, hydCyl, 2, 41000, boStore.id, hyd.id, '2026-08-25')],
  })
  await createRfqBundle({
    tid,
    actorId,
    number: `${PREFIX}-RFQ-0002`,
    date: '2026-07-13',
    pr: prRfq2,
    status: 'SENT',
    vendorIds: [hyd.id, axle.id],
    title: 'UAT RFQ sent to hydraulics vendors',
    sentAt: new Date('2026-07-13T14:00:00.000Z'),
  })

  // RFQ 3 — Quotation received (2 VQs submitted)
  const prRfq3 = await createPr({
    tid,
    actorId,
    number: `${PREFIX}-PR-0011`,
    date: '2026-07-14',
    warehouseId: ahmdMain.id,
    status: 'APPROVED',
    rfqRequired: true,
    purpose: 'UAT quotations received — ready to compare',
    priority: 'NORMAL',
    submittedAt: new Date('2026-07-14T08:00:00.000Z'),
    approvedAt: new Date('2026-07-14T09:00:00.000Z'),
    lines: [line(1, brake, 6, 2500, ahmdMain.id, axle.id, '2026-08-28')],
  })
  const rfq3 = await createRfqBundle({
    tid,
    actorId,
    number: `${PREFIX}-RFQ-0003`,
    date: '2026-07-14',
    pr: prRfq3,
    status: 'QUOTATION_RECEIVED',
    vendorIds: [axle.id, fast.id],
    title: 'UAT brake chamber RFQ',
    sentAt: new Date('2026-07-14T12:00:00.000Z'),
  })
  await createVendorQuotation({
    tid,
    actorId,
    number: `${PREFIX}-VQ-0001`,
    rfq: rfq3,
    vendorId: axle.id,
    status: 'SUBMITTED',
    rate: 2400,
  })
  await createVendorQuotation({
    tid,
    actorId,
    number: `${PREFIX}-VQ-0002`,
    rfq: rfq3,
    vendorId: fast.id,
    status: 'SUBMITTED',
    rate: 2550,
  })

  // RFQ 4 — Under comparison / vendor selected
  const prRfq4 = await createPr({
    tid,
    actorId,
    number: `${PREFIX}-PR-0012`,
    date: '2026-07-15',
    warehouseId: boStore.id,
    status: 'APPROVED',
    rfqRequired: true,
    purpose: 'UAT comparison — vendor selected, create PO next',
    priority: 'URGENT',
    submittedAt: new Date('2026-07-15T08:00:00.000Z'),
    approvedAt: new Date('2026-07-15T09:00:00.000Z'),
    lines: [line(1, epoxy, 60, 275, boStore.id, paint.id, '2026-08-30')],
  })
  const rfq4 = await createRfqBundle({
    tid,
    actorId,
    number: `${PREFIX}-RFQ-0004`,
    date: '2026-07-15',
    pr: prRfq4,
    status: 'VENDOR_SELECTED',
    vendorIds: [paint.id, steel.id],
    title: 'UAT epoxy primer RFQ',
    sentAt: new Date('2026-07-15T11:00:00.000Z'),
  })
  const vq4Win = await createVendorQuotation({
    tid,
    actorId,
    number: `${PREFIX}-VQ-0003`,
    rfq: rfq4,
    vendorId: paint.id,
    status: 'SELECTED',
    rate: 270,
  })
  await createVendorQuotation({
    tid,
    actorId,
    number: `${PREFIX}-VQ-0004`,
    rfq: rfq4,
    vendorId: steel.id,
    status: 'REJECTED',
    rate: 295,
  })
  await createComparison({
    tid,
    actorId,
    number: `${PREFIX}-CMP-0001`,
    rfq: rfq4,
    status: 'VENDOR_SELECTED',
    awardedVendorId: paint.id,
    awardedVendorQuotationId: vq4Win.id,
    selectionReason: 'Lowest landed cost + lead time',
  })

  // RFQ 5 — Fully converted to PO
  const prRfq5 = await createPr({
    tid,
    actorId,
    number: `${PREFIX}-PR-0013`,
    date: '2026-07-16',
    warehouseId: rmStore.id,
    status: 'CONVERTED_TO_PO',
    rfqRequired: true,
    purpose: 'UAT RFQ→award→PO complete chain',
    priority: 'NORMAL',
    submittedAt: new Date('2026-07-16T08:00:00.000Z'),
    approvedAt: new Date('2026-07-16T09:00:00.000Z'),
    lines: [line(1, plate, 300, 58, rmStore.id, steel.id, '2026-09-01')],
  })
  const rfq5 = await createRfqBundle({
    tid,
    actorId,
    number: `${PREFIX}-RFQ-0005`,
    date: '2026-07-16',
    pr: prRfq5,
    status: 'CONVERTED_TO_PO',
    vendorIds: [steel.id, paint.id],
    title: 'UAT MS plate RFQ — converted to PO',
    sentAt: new Date('2026-07-16T10:00:00.000Z'),
  })
  const vq5Win = await createVendorQuotation({
    tid,
    actorId,
    number: `${PREFIX}-VQ-0005`,
    rfq: rfq5,
    vendorId: steel.id,
    status: 'SELECTED',
    rate: 57,
  })
  await createVendorQuotation({
    tid,
    actorId,
    number: `${PREFIX}-VQ-0006`,
    rfq: rfq5,
    vendorId: paint.id,
    status: 'REJECTED',
    rate: 61,
  })
  const cmp5 = await createComparison({
    tid,
    actorId,
    number: `${PREFIX}-CMP-0002`,
    rfq: rfq5,
    status: 'CONVERTED_TO_PO',
    awardedVendorId: steel.id,
    awardedVendorQuotationId: vq5Win.id,
    selectionReason: 'Best rate from Gujarat Steel',
  })
  const poFromRfq = await createPo({
    tid,
    actorId,
    number: `${PREFIX}-PO-0005`,
    date: '2026-07-17',
    vendorId: steel.id,
    status: 'PENDING_APPROVAL',
    origin: 'RFQ_COMPARISON',
    prId: prRfq5.id,
    rfqId: rfq5.id,
    vendorQuotationId: vq5Win.id,
    vendorComparisonId: cmp5.id,
    submittedAt: new Date('2026-07-17T11:00:00.000Z'),
    lines: [
      {
        lineNumber: 1,
        prLineId: prRfq5.lines[0].id,
        item: plate,
        qty: 300,
        rate: 57,
        requiredDate: '2026-09-01',
      },
    ],
  })
  await stampPrLine(prRfq5.lines[0].id, poFromRfq.id, poFromRfq.orderNumber)

  // Extra PO: cancelled (for filter testing)
  await createPo({
    tid,
    actorId,
    number: `${PREFIX}-PO-0006`,
    date: '2026-07-18',
    vendorId: hyd.id,
    status: 'CANCELLED',
    origin: 'MANUAL',
    cancelledAt: new Date('2026-07-18T16:00:00.000Z'),
    remarks: 'UAT cancelled PO — filter / archive testing',
    lines: [
      {
        lineNumber: 1,
        item: hydCyl,
        qty: 1,
        rate: 40000,
        requiredDate: '2026-09-10',
      },
    ],
  })

  const summary = {
    warehouses: warehouses.length,
    items: items.length,
    vendors: vendors.length,
    pr: await prisma.purchaseRequisition.count({
      where: { tenantId: tid, deletedAt: null, requisitionNumber: { startsWith: `${PREFIX}-PR-` } },
    }),
    planning: await prisma.purchasePlanningRow.count({
      where: { tenantId: tid, deletedAt: null, planningNumber: { startsWith: `${PREFIX}-PPS-` } },
    }),
    rfq: await prisma.requestForQuotation.count({
      where: { tenantId: tid, deletedAt: null, rfqNumber: { startsWith: `${PREFIX}-RFQ-` } },
    }),
    vq: await prisma.vendorQuotation.count({
      where: { tenantId: tid, deletedAt: null, quotationNumber: { startsWith: `${PREFIX}-VQ-` } },
    }),
    comparison: await prisma.vendorComparison.count({
      where: { tenantId: tid, deletedAt: null, comparisonNumber: { startsWith: `${PREFIX}-CMP-` } },
    }),
    po: await prisma.purchaseOrder.count({
      where: { tenantId: tid, deletedAt: null, orderNumber: { startsWith: `${PREFIX}-PO-` } },
    }),
  }

  console.log('=== Purchase flow UAT seed complete ===')
  console.log(JSON.stringify(summary, null, 2))
  console.log('')
  console.log('Suggested UI checks (API mode, login as admin@vasant-trailers.com):')
  console.log('  /purchase/requisitions  — UAT-PR-0001..0013 (draft / pending / rejected / approved / converted)')
  console.log('  /purchase/planning      — UAT-PPS-* rows (pending → ready → PO created)')
  console.log('  /purchase/rfqs          — UAT-RFQ-0001..0005 (draft → sent → quotes → awarded → converted)')
  console.log('  /purchase/orders        — UAT-PO-0001..0006 (draft / approved / sent / partial / pending / cancelled)')
  console.log('  Warehouses              — HO_STORE, AHMD_MAIN, RM_STORE, BO_STORE, FG_YARD, …')
  console.log('')
  console.log('GRN: no DB table yet — use demo mode (VITE_USE_API=false) for GRN screens, or wait for GRN backend.')
}

// ─── helpers ───────────────────────────────────────────────────

type ItemRow = Awaited<ReturnType<typeof prisma.masterItem.findMany>>[number] & {
  baseUom?: { id: string } | null
}

function line(
  lineNumber: number,
  it: ItemRow,
  qty: number,
  rate: number,
  warehouseId: string,
  preferredVendorId: string | null,
  requiredDate: string,
) {
  return {
    lineNumber,
    itemId: it.id,
    itemCodeSnapshot: it.code,
    itemNameSnapshot: it.name,
    description: it.name,
    requiredQuantity: qty,
    uomId: it.baseUomId,
    estimatedRate: rate,
    estimatedAmount: amt(qty, rate),
    warehouseId,
    preferredVendorId,
    requiredDate: d(requiredDate),
  }
}

async function clearUatDocuments(tenantId: string): Promise<void> {
  const pos = await prisma.purchaseOrder.findMany({
    where: { tenantId, orderNumber: { startsWith: `${PREFIX}-PO-` } },
    select: { id: true },
  })
  const poIds = pos.map((p) => p.id)
  if (poIds.length) {
    await prisma.purchaseOrderLine.deleteMany({ where: { tenantId, purchaseOrderId: { in: poIds } } })
    await prisma.purchaseApproval.deleteMany({ where: { tenantId, purchaseOrderId: { in: poIds } } })
    await prisma.purchasePlanningRow.updateMany({
      where: { tenantId, purchaseOrderId: { in: poIds } },
      data: { purchaseOrderId: null, purchaseOrderNumberSnapshot: null },
    })
    await prisma.purchaseRequisitionLine.updateMany({
      where: { tenantId, purchaseOrderId: { in: poIds } },
      data: { purchaseOrderId: null, purchaseOrderNumberSnapshot: null, status: 'OPEN' },
    })
    await prisma.purchaseOrder.deleteMany({ where: { tenantId, id: { in: poIds } } })
  }

  const cmps = await prisma.vendorComparison.findMany({
    where: { tenantId, comparisonNumber: { startsWith: `${PREFIX}-CMP-` } },
    select: { id: true },
  })
  const cmpIds = cmps.map((c) => c.id)
  if (cmpIds.length) {
    await prisma.vendorComparisonLine.deleteMany({
      where: { tenantId, vendorComparisonId: { in: cmpIds } },
    })
    await prisma.vendorComparison.deleteMany({ where: { tenantId, id: { in: cmpIds } } })
  }

  const vqs = await prisma.vendorQuotation.findMany({
    where: { tenantId, quotationNumber: { startsWith: `${PREFIX}-VQ-` } },
    select: { id: true },
  })
  const vqIds = vqs.map((v) => v.id)
  if (vqIds.length) {
    await prisma.vendorQuotationLine.deleteMany({
      where: { tenantId, vendorQuotationId: { in: vqIds } },
    })
    await prisma.vendorQuotation.deleteMany({ where: { tenantId, id: { in: vqIds } } })
  }

  const rfqs = await prisma.requestForQuotation.findMany({
    where: { tenantId, rfqNumber: { startsWith: `${PREFIX}-RFQ-` } },
    select: { id: true },
  })
  const rfqIds = rfqs.map((r) => r.id)
  if (rfqIds.length) {
    await prisma.rfqVendor.deleteMany({ where: { tenantId, requestForQuotationId: { in: rfqIds } } })
    await prisma.requestForQuotationLine.deleteMany({
      where: { tenantId, requestForQuotationId: { in: rfqIds } },
    })
    await prisma.requestForQuotation.deleteMany({ where: { tenantId, id: { in: rfqIds } } })
  }

  await prisma.purchasePlanningRow.deleteMany({
    where: { tenantId, planningNumber: { startsWith: `${PREFIX}-PPS-` } },
  })

  const prs = await prisma.purchaseRequisition.findMany({
    where: { tenantId, requisitionNumber: { startsWith: `${PREFIX}-PR-` } },
    select: { id: true },
  })
  const prIds = prs.map((p) => p.id)
  if (prIds.length) {
    await prisma.purchaseApproval.deleteMany({
      where: { tenantId, purchaseRequisitionId: { in: prIds } },
    })
    await prisma.purchaseRequisitionLine.deleteMany({
      where: { tenantId, purchaseRequisitionId: { in: prIds } },
    })
    await prisma.purchaseRequisition.deleteMany({ where: { tenantId, id: { in: prIds } } })
  }

  await prisma.purchaseStatusHistory.deleteMany({
    where: {
      tenantId,
      OR: [
        { documentNumber: { startsWith: `${PREFIX}-` } },
        { documentNumber: { startsWith: `${PREFIX}-PR-` } },
      ],
    },
  })
}

async function createPr(opts: {
  tid: string
  actorId: string | null
  number: string
  date: string
  warehouseId: string
  status: 'DRAFT' | 'PENDING_APPROVAL' | 'APPROVED' | 'REJECTED' | 'CONVERTED_TO_PO' | 'PARTIALLY_CONVERTED'
  rfqRequired: boolean
  purpose: string
  priority: 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT' | 'CRITICAL'
  submittedAt?: Date
  approvedAt?: Date
  rejectedAt?: Date
  rejectionReason?: string
  lines: ReturnType<typeof line>[]
}) {
  return prisma.purchaseRequisition.create({
    data: {
      tenantId: opts.tid,
      requisitionNumber: opts.number,
      requisitionDate: d(opts.date),
      departmentId: 'dept-ops',
      requestedById: opts.actorId,
      warehouseId: opts.warehouseId,
      requiredDate: opts.lines[0]?.requiredDate ?? d('2026-08-01'),
      priority: opts.priority,
      purchasePurpose: opts.purpose,
      rfqRequired: opts.rfqRequired,
      status: opts.status,
      submittedAt: opts.submittedAt ?? null,
      approvedAt: opts.approvedAt ?? null,
      rejectedAt: opts.rejectedAt ?? null,
      rejectionReason: opts.rejectionReason ?? null,
      remarks: opts.purpose,
      createdById: opts.actorId,
      updatedById: opts.actorId,
      lines: {
        create: opts.lines.map((l) => ({
          tenantId: opts.tid,
          ...l,
          status: opts.status === 'CONVERTED_TO_PO' ? 'OPEN' : 'OPEN',
        })),
      },
    },
    include: { lines: { orderBy: { lineNumber: 'asc' } } },
  })
}

async function createPlanningRow(opts: {
  tid: string
  actorId: string | null
  pr: { id: string; requisitionNumber: string; departmentId: string | null; requestedById: string | null; priority: string }
  prLine: {
    id: string
    itemId: string | null
    itemCodeSnapshot: string
    itemNameSnapshot: string
    description: string | null
    requiredQuantity: unknown
    uomId: string | null
    estimatedRate: unknown
    preferredVendorId: string | null
    requiredDate: Date | null
  }
  planningNumber: string
  warehouseHint: string
  vendorId: string | null
  status:
    | 'PENDING_PLANNING'
    | 'UNDER_REVIEW'
    | 'VENDOR_SELECTED'
    | 'APPROVED'
    | 'PO_PENDING'
    | 'PO_CREATED'
    | 'ON_HOLD'
  purchaseType: 'DIRECT_PURCHASE' | 'RFQ_BASED'
  actionMessage?: boolean
}) {
  void opts.warehouseHint
  const qty = Number(opts.prLine.requiredQuantity)
  const rate = Number(opts.prLine.estimatedRate)
  return prisma.purchasePlanningRow.create({
    data: {
      tenantId: opts.tid,
      planningNumber: opts.planningNumber,
      planningDate: d('2026-07-06'),
      purchaseRequisitionId: opts.pr.id,
      purchaseRequisitionLineId: opts.prLine.id,
      purchaseRequisitionNumberSnapshot: opts.pr.requisitionNumber,
      departmentId: opts.pr.departmentId,
      requestedById: opts.pr.requestedById,
      itemId: opts.prLine.itemId,
      itemCodeSnapshot: opts.prLine.itemCodeSnapshot,
      itemNameSnapshot: opts.prLine.itemNameSnapshot,
      itemDescriptionSnapshot: opts.prLine.description,
      requiredQuantity: qty,
      uomId: opts.prLine.uomId,
      currentStockQuantity: 0,
      openPurchaseOrderQuantity: 0,
      netPurchaseQuantity: qty,
      preferredVendorId: opts.vendorId ?? opts.prLine.preferredVendorId,
      selectedVendorId: opts.vendorId,
      expectedRate: rate,
      negotiatedRate: rate,
      estimatedAmount: amt(qty, rate),
      requiredDate: opts.prLine.requiredDate,
      purchaseType: opts.purchaseType,
      priority: (opts.pr.priority as 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT' | 'CRITICAL') ?? 'NORMAL',
      buyerId: opts.actorId,
      status: opts.status,
      actionMessage: opts.actionMessage ?? false,
      createdById: opts.actorId,
      updatedById: opts.actorId,
    },
  })
}

async function createPo(opts: {
  tid: string
  actorId: string | null
  number: string
  date: string
  vendorId: string
  status:
    | 'DRAFT'
    | 'PENDING_APPROVAL'
    | 'APPROVED'
    | 'SENT_TO_VENDOR'
    | 'PARTIALLY_RECEIVED'
    | 'FULLY_RECEIVED'
    | 'CANCELLED'
    | 'CLOSED'
  origin: 'MANUAL' | 'PURCHASE_REQUISITION' | 'PLANNING_SHEET' | 'RFQ_COMPARISON'
  prId?: string
  rfqId?: string
  vendorQuotationId?: string
  vendorComparisonId?: string
  submittedAt?: Date
  approvedAt?: Date
  sentAt?: Date
  cancelledAt?: Date
  remarks?: string
  lines: Array<{
    lineNumber: number
    prLineId?: string
    planningRowId?: string
    item: ItemRow
    qty: number
    rate: number
    requiredDate: string
    receivedQty?: number
  }>
}) {
  const subtotal = opts.lines.reduce((s, l) => s + amt(l.qty, l.rate), 0)
  return prisma.purchaseOrder.create({
    data: {
      tenantId: opts.tid,
      orderNumber: opts.number,
      orderDate: d(opts.date),
      vendorId: opts.vendorId,
      origin: opts.origin,
      status: opts.status,
      purchaseRequisitionId: opts.prId ?? null,
      requestForQuotationId: opts.rfqId ?? null,
      vendorQuotationId: opts.vendorQuotationId ?? null,
      vendorComparisonId: opts.vendorComparisonId ?? null,
      currencyCode: 'INR',
      expectedDeliveryDate: d(opts.lines[0]?.requiredDate ?? '2026-08-30'),
      paymentTerms: 'Net 30',
      deliveryTerms: 'FOR destination',
      subtotalAmount: subtotal,
      taxAmount: 0,
      freightAmount: 0,
      totalAmount: subtotal,
      remarks: opts.remarks ?? `UAT seed ${opts.number}`,
      submittedAt: opts.submittedAt ?? null,
      approvedAt: opts.approvedAt ?? null,
      sentAt: opts.sentAt ?? null,
      cancelledAt: opts.cancelledAt ?? null,
      createdById: opts.actorId,
      updatedById: opts.actorId,
      lines: {
        create: opts.lines.map((l) => ({
          tenantId: opts.tid,
          lineNumber: l.lineNumber,
          purchaseRequisitionLineId: l.prLineId ?? null,
          purchasePlanningRowId: l.planningRowId ?? null,
          itemId: l.item.id,
          itemCodeSnapshot: l.item.code,
          itemNameSnapshot: l.item.name,
          description: l.item.name,
          quantity: l.qty,
          uomId: l.item.baseUomId,
          rate: l.rate,
          amount: amt(l.qty, l.rate),
          receivedQuantity: l.receivedQty ?? 0,
          requiredDate: d(l.requiredDate),
        })),
      },
    },
  })
}

async function stampPrLine(prLineId: string, poId: string, poNumber: string) {
  await prisma.purchaseRequisitionLine.update({
    where: { id: prLineId },
    data: {
      status: 'CONVERTED',
      purchaseOrderId: poId,
      purchaseOrderNumberSnapshot: poNumber,
    },
  })
}

async function createRfqBundle(opts: {
  tid: string
  actorId: string | null
  number: string
  date: string
  pr: { id: string; lines: Array<{
    id: string
    lineNumber: number
    itemId: string | null
    itemCodeSnapshot: string
    itemNameSnapshot: string
    description: string | null
    requiredQuantity: unknown
    uomId: string | null
    estimatedRate: unknown
    requiredDate: Date | null
    remarks: string | null
  }> }
  status:
    | 'DRAFT'
    | 'SENT'
    | 'QUOTATION_RECEIVED'
    | 'UNDER_COMPARISON'
    | 'VENDOR_SELECTED'
    | 'CONVERTED_TO_PO'
  vendorIds: string[]
  title: string
  sentAt?: Date
}) {
  return prisma.requestForQuotation.create({
    data: {
      tenantId: opts.tid,
      rfqNumber: opts.number,
      rfqDate: d(opts.date),
      purchaseRequisitionId: opts.pr.id,
      title: opts.title,
      responseDueDate: d('2026-07-25'),
      status: opts.status,
      remarks: opts.title,
      sentAt: opts.sentAt ?? null,
      createdById: opts.actorId,
      updatedById: opts.actorId,
      lines: {
        create: opts.pr.lines.map((l) => ({
          tenantId: opts.tid,
          lineNumber: l.lineNumber,
          purchaseRequisitionLineId: l.id,
          itemId: l.itemId,
          itemCodeSnapshot: l.itemCodeSnapshot,
          itemNameSnapshot: l.itemNameSnapshot,
          description: l.description,
          requiredQuantity: Number(l.requiredQuantity),
          uomId: l.uomId,
          targetRate: Number(l.estimatedRate),
          requiredDate: l.requiredDate,
          remarks: l.remarks,
        })),
      },
      vendors: {
        create: opts.vendorIds.map((vendorId) => ({
          tenantId: opts.tid,
          vendorId,
          inviteStatus: opts.status === 'DRAFT' ? 'INVITED' : 'SENT',
          invitedAt: new Date(),
          respondedAt: ['QUOTATION_RECEIVED', 'VENDOR_SELECTED', 'CONVERTED_TO_PO'].includes(opts.status)
            ? new Date()
            : null,
        })),
      },
    },
    include: { lines: { orderBy: { lineNumber: 'asc' } } },
  })
}

async function createVendorQuotation(opts: {
  tid: string
  actorId: string | null
  number: string
  rfq: { id: string; lines: Array<{
    id: string
    lineNumber: number
    itemId: string | null
    itemCodeSnapshot: string
    itemNameSnapshot: string
    description: string | null
    requiredQuantity: unknown
    uomId: string | null
  }> }
  vendorId: string
  status: 'DRAFT' | 'SUBMITTED' | 'SELECTED' | 'REJECTED'
  rate: number
}) {
  const lines = opts.rfq.lines.map((l) => {
    const qty = Number(l.requiredQuantity)
    const amount = amt(qty, opts.rate)
    return {
      tenantId: opts.tid,
      lineNumber: l.lineNumber,
      requestForQuotationLineId: l.id,
      itemId: l.itemId,
      itemCodeSnapshot: l.itemCodeSnapshot,
      itemNameSnapshot: l.itemNameSnapshot,
      description: l.description,
      quantity: qty,
      uomId: l.uomId,
      rate: opts.rate,
      amount,
      leadTimeDays: 7,
    }
  })
  const total = lines.reduce((s, l) => s + Number(l.amount), 0)
  return prisma.vendorQuotation.create({
    data: {
      tenantId: opts.tid,
      quotationNumber: opts.number,
      quotationDate: d('2026-07-16'),
      requestForQuotationId: opts.rfq.id,
      vendorId: opts.vendorId,
      status: opts.status,
      currencyCode: 'INR',
      validUntil: d('2026-08-16'),
      paymentTerms: 'Net 30',
      deliveryTerms: 'Ex-works',
      freightAmount: 0,
      discountAmount: 0,
      otherCharges: 0,
      taxAmount: 0,
      landedCost: total,
      totalAmount: total,
      remarks: `UAT seed ${opts.number}`,
      createdById: opts.actorId,
      updatedById: opts.actorId,
      lines: { create: lines },
    },
  })
}

async function createComparison(opts: {
  tid: string
  actorId: string | null
  number: string
  rfq: { id: string }
  status: 'DRAFT' | 'UNDER_COMPARISON' | 'VENDOR_SELECTED' | 'CONVERTED_TO_PO'
  awardedVendorId: string
  awardedVendorQuotationId: string
  selectionReason: string
}) {
  return prisma.vendorComparison.create({
    data: {
      tenantId: opts.tid,
      comparisonNumber: opts.number,
      comparisonDate: d('2026-07-17'),
      requestForQuotationId: opts.rfq.id,
      status: opts.status,
      awardedVendorId: opts.awardedVendorId,
      awardedVendorQuotationId: opts.awardedVendorQuotationId,
      selectionReason: opts.selectionReason,
      awardedById: opts.actorId,
      selectedAt: new Date('2026-07-17T14:00:00.000Z'),
      remarks: opts.selectionReason,
      createdById: opts.actorId,
      updatedById: opts.actorId,
    },
  })
}

main()
  .catch((err) => {
    console.error(err)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })

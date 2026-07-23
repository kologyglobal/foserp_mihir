/**
 * Live E2E: WO material shortage → PR (rfqRequired=true) → RFQ → VQ → comparison → award → PO.
 *
 * Alternate to test-shortage-to-purchase-loop.ts (rfqRequired=false → planning-sheet → PO).
 * Default shortage PR path remains planning/PO; this harness opts into RFQ via API body.
 *
 * Usage:
 *   npx tsx scripts/test-shortage-rfq-to-po-loop.ts
 */
import request from 'supertest'
import { createApp } from '../src/app.js'
import { prisma } from '../src/config/database.js'

const TENANT_SLUG = process.env.TENANT_SLUG ?? 'vasant-trailers'
const FG_CODE = 'FG-ISO-TANK-26K'
const SHORT_ITEM = 'BO-FASTENERS'
const ISSUE_WH = 'WIP_FABRICATION'
const VENDOR_WIN = 'VND-FAST-04'
/** Second invitee for comparison (seed-vendors-customers-setup / paint analogue). */
const VENDOR_ALT = 'VEND-0005'
const RATE_WIN = 15
const RATE_ALT = 18

const app = createApp()

type StepResult = { step: string; ok: boolean; detail: string }

function fail(msg: string): never {
  console.error(`\n✗ ${msg}`)
  process.exit(1)
}

async function login(email: string, password: string) {
  const res = await request(app).post('/api/v1/auth/login').send({
    email,
    password,
    tenantSlug: TENANT_SLUG,
  })
  if (res.status !== 200 || !res.body.data?.accessToken) {
    fail(`Login failed for ${email}: ${res.status} ${JSON.stringify(res.body)}`)
  }
  return {
    token: res.body.data.accessToken as string,
    userId: res.body.data.user.id as string,
  }
}

function auth(token: string) {
  return { Authorization: `Bearer ${token}` }
}

async function main() {
  const results: StepResult[] = []
  const push = (step: string, ok: boolean, detail: string) => {
    results.push({ step, ok, detail })
    console.log(`${ok ? '✓' : '✗'} ${step}: ${detail}`)
    if (!ok) fail(detail)
  }

  console.log(`\n=== Shortage → RFQ → Award → PO loop (${TENANT_SLUG}) ===\n`)

  const tenant = await prisma.tenant.findFirst({ where: { slug: TENANT_SLUG, deletedAt: null } })
  if (!tenant) fail(`Tenant not found: ${TENANT_SLUG}`)

  const fg = await prisma.masterItem.findFirst({
    where: { tenantId: tenant.id, code: FG_CODE, deletedAt: null },
  })
  if (!fg) fail(`FG ${FG_CODE} missing`)

  const shortItem = await prisma.masterItem.findFirst({
    where: { tenantId: tenant.id, code: SHORT_ITEM, deletedAt: null },
  })
  if (!shortItem) fail(`Item ${SHORT_ITEM} missing`)

  const wip = await prisma.masterWarehouse.findFirst({
    where: { tenantId: tenant.id, code: ISSUE_WH, deletedAt: null },
  })
  if (!wip) fail(`Warehouse ${ISSUE_WH} missing`)

  const vendorWin = await prisma.masterVendor.findFirst({
    where: { tenantId: tenant.id, code: VENDOR_WIN, deletedAt: null },
  })
  if (!vendorWin) fail(`Vendor ${VENDOR_WIN} missing — run seed-purchase-demo-data / vendors setup`)

  const vendorAlt = await prisma.masterVendor.findFirst({
    where: { tenantId: tenant.id, code: VENDOR_ALT, deletedAt: null },
  })
  if (!vendorAlt) fail(`Vendor ${VENDOR_ALT} missing — need 2 vendors for RFQ comparison`)

  const admin = await login('admin@vasant-trailers.com', 'Admin@123')
  let purchaseToken = admin.token
  try {
    const purchase = await login('purchase@vasant-trailers.com', 'Purchase@123')
    purchaseToken = purchase.token
  } catch {
    console.log('  · purchase@ login unavailable — using admin for purchase steps')
  }

  const mfg = `/api/v1/t/${TENANT_SLUG}/manufacturing`
  const purchase = `/api/v1/t/${TENANT_SLUG}/purchase`
  const today = new Date().toISOString().slice(0, 10)
  const due = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10)

  await prisma.inventoryStockReservation.updateMany({
    where: {
      tenantId: tenant.id,
      itemId: shortItem.id,
      warehouseId: wip.id,
      status: 'ACTIVE',
    },
    data: { status: 'CANCELLED' },
  })
  await prisma.inventoryStockBalance.upsert({
    where: {
      tenantId_itemId_warehouseId: {
        tenantId: tenant.id,
        itemId: shortItem.id,
        warehouseId: wip.id,
      },
    },
    create: {
      tenantId: tenant.id,
      itemId: shortItem.id,
      warehouseId: wip.id,
      onHandQty: 0,
      reservedQty: 0,
    },
    update: { onHandQty: 0, reservedQty: 0 },
  })
  push('Force shortage stock', true, `${SHORT_ITEM}@${ISSUE_WH} onHand=0 reserved=0`)

  const create = await request(app)
    .post(`${mfg}/work-orders`)
    .set(auth(admin.token))
    .send({
      productItemId: fg.id,
      plannedQuantity: 1,
      requiredCompletionDate: new Date(Date.now() + 21 * 86400000).toISOString(),
      plannedStartDate: new Date().toISOString(),
      priority: 'HIGH',
      notes: 'Shortage→RFQ→PO loop E2E',
      idempotencyKey: `iso-shortage-rfq-e2e-${Date.now()}`,
    })
  if (create.status !== 201) fail(`Create WO failed: ${create.status} ${JSON.stringify(create.body)}`)
  const woId = create.body.data.id as string
  const woNo = (create.body.data.orderNumber ?? create.body.data.workOrderNo) as string
  push('Create WO', true, `${woNo} ${woId}`)

  const released = await request(app)
    .post(`${mfg}/work-orders/${woId}/release`)
    .set(auth(admin.token))
    .send({})
  if (released.status !== 200) fail(`Release failed: ${released.status} ${JSON.stringify(released.body)}`)
  push('Release WO', true, `status=${released.body.data.status}`)

  const reserved = await request(app)
    .post(`${mfg}/work-orders/${woId}/materials/reserve`)
    .set(auth(admin.token))
    .send({})
  if (reserved.status !== 200) fail(`Reserve failed: ${reserved.status} ${JSON.stringify(reserved.body)}`)
  const reserveResults = (reserved.body.data.results ?? []) as Array<{ status: string; itemCode?: string }>
  const shortLines = reserveResults.filter((r) => r.status === 'SHORT')
  push('Reserve shows SHORT', shortLines.length > 0, `SHORT=${shortLines.length}`)

  const mats = await request(app)
    .get(`${mfg}/work-orders/${woId}/materials`)
    .set(auth(admin.token))
  const list = (Array.isArray(mats.body.data)
    ? mats.body.data
    : mats.body.data?.materials ?? []) as Array<{
    id: string
    itemCode?: string
    item?: { code?: string }
    shortageQty?: string | number
  }>
  const shortMat = list.find((m) => (m.itemCode ?? m.item?.code) === SHORT_ITEM)
  if (!shortMat) fail(`Material line for ${SHORT_ITEM} not found on WO`)
  push('Shortage material line', true, `id=${shortMat.id} shortageQty=${shortMat.shortageQty}`)

  const shortagePr = await request(app)
    .post(`${mfg}/work-orders/${woId}/materials/shortage-requisition`)
    .set(auth(admin.token))
    .send({
      materialIds: [shortMat.id],
      priority: 'HIGH',
      submit: false,
      rfqRequired: true,
      idempotencyKey: `shortage-rfq-loop-${woId}-${SHORT_ITEM}`,
    })
  if (shortagePr.status !== 201 && shortagePr.status !== 200) {
    const bulk = await request(app)
      .post(`${mfg}/store-workbench/issues/shortage-requisition`)
      .set(auth(admin.token))
      .send({
        materialIds: [shortMat.id],
        priority: 'HIGH',
        submit: false,
        rfqRequired: true,
        idempotencyKey: `shortage-rfq-loop-bulk-${woId}-${SHORT_ITEM}`,
      })
    if (bulk.status !== 201 && bulk.status !== 200) {
      fail(
        `Shortage PR failed: wo=${shortagePr.status} ${JSON.stringify(shortagePr.body)} bulk=${bulk.status} ${JSON.stringify(bulk.body)}`,
      )
    }
    Object.assign(shortagePr, bulk)
  }

  const prPayload = shortagePr.body.data?.requisition ?? shortagePr.body.data
  const prId = (prPayload?.id ?? shortagePr.body.data?.id) as string
  const prNumber = (prPayload?.requisitionNumber ?? prPayload?.number) as string
  push(
    'Create shortage PR (RFQ path)',
    Boolean(prId) && prPayload?.rfqRequired === true,
    `${prNumber ?? prId} rfqRequired=${prPayload?.rfqRequired} status=${prPayload?.status}`,
  )

  const submit = await request(app)
    .post(`${purchase}/requisitions/${prId}/submit`)
    .set(auth(purchaseToken))
    .send({ remarks: 'Shortage RFQ loop submit' })
  if (submit.status !== 200) {
    fail(`PR submit failed: ${submit.status} ${JSON.stringify(submit.body)}`)
  }
  push('Submit PR', true, `status=${submit.body.data.status}`)

  const approve = await request(app)
    .post(`${purchase}/requisitions/${prId}/approve`)
    .set(auth(admin.token))
    .send({ remarks: 'Shortage RFQ loop approve' })
  if (approve.status !== 200) {
    fail(`PR approve failed: ${approve.status} ${JSON.stringify(approve.body)}`)
  }
  push('Approve PR', true, `status=${approve.body.data.status} readyForRfq=${approve.body.data.readyForRfq}`)

  const planningRows = await prisma.purchasePlanningRow.findMany({
    where: { tenantId: tenant.id, purchaseRequisitionId: prId, deletedAt: null },
  })
  push(
    'No planning rows (RFQ path)',
    planningRows.length === 0,
    `planningRows=${planningRows.length}`,
  )

  const convert = await request(app)
    .post(`${purchase}/requisitions/${prId}/convert-to-rfq`)
    .set(auth(purchaseToken))
    .send({
      title: `RFQ for shortage ${prNumber}`,
      responseDueDate: due,
      remarks: 'Shortage RFQ loop',
      vendorIds: [vendorWin.id, vendorAlt.id],
    })
  if (convert.status !== 201 && convert.status !== 200) {
    fail(`Convert PR→RFQ failed: ${convert.status} ${JSON.stringify(convert.body)}`)
  }
  const rfq = convert.body.data
  const rfqId = rfq.id as string
  const rfqNumber = rfq.rfqNumber as string
  const rfqLines = (rfq.lines ?? []) as Array<{
    id: string
    itemId?: string
    quantity?: number
    requiredQuantity?: number
    uomId?: string | null
    itemCode?: string
    itemName?: string
  }>
  if (!rfqLines.length) fail(`RFQ has no lines: ${JSON.stringify(rfq)}`)
  push('Create RFQ from PR', true, `${rfqNumber} vendors=2 lines=${rfqLines.length}`)

  const sendRfq = await request(app)
    .post(`${purchase}/rfqs/${rfqId}/send`)
    .set(auth(purchaseToken))
    .send({ remarks: 'Send for quotes' })
  if (sendRfq.status !== 200) fail(`RFQ send failed: ${sendRfq.status} ${JSON.stringify(sendRfq.body)}`)
  push('Send RFQ', true, `status=${sendRfq.body.data.status}`)

  async function createAndSubmitQuote(
    vendorId: string,
    vendorCode: string,
    rate: number,
  ): Promise<{ id: string; quotationNumber: string }> {
    const line = rfqLines[0]!
    const qty = Number(line.requiredQuantity ?? line.quantity ?? shortMat.shortageQty ?? 1)
    const createVq = await request(app)
      .post(`${purchase}/vendor-quotations`)
      .set(auth(purchaseToken))
      .send({
        quotationDate: today,
        requestForQuotationId: rfqId,
        vendorId,
        vendorReferenceNumber: `VQ-${vendorCode}-${Date.now()}`,
        currencyCode: 'INR',
        validUntil: due,
        freightAmount: 0,
        discountAmount: 0,
        otherCharges: 0,
        taxAmount: 0,
        remarks: `Quote from ${vendorCode}`,
        lines: [
          {
            requestForQuotationLineId: line.id,
            itemId: line.itemId ?? shortItem.id,
            itemCodeSnapshot: line.itemCode ?? SHORT_ITEM,
            itemNameSnapshot: line.itemName ?? SHORT_ITEM,
            quantity: qty > 0 ? qty : 1,
            uomId: line.uomId ?? null,
            rate,
            leadTimeDays: 3,
          },
        ],
      })
    if (createVq.status !== 201) {
      fail(`VQ create (${vendorCode}) failed: ${createVq.status} ${JSON.stringify(createVq.body)}`)
    }
    const vqId = createVq.body.data.id as string
    const vqNumber = createVq.body.data.quotationNumber as string
    const submitVq = await request(app)
      .post(`${purchase}/vendor-quotations/${vqId}/submit`)
      .set(auth(purchaseToken))
      .send({})
    if (submitVq.status !== 200) {
      fail(`VQ submit (${vendorCode}) failed: ${submitVq.status} ${JSON.stringify(submitVq.body)}`)
    }
    return { id: vqId, quotationNumber: vqNumber }
  }

  const winQuote = await createAndSubmitQuote(vendorWin.id, VENDOR_WIN, RATE_WIN)
  push('Vendor quote (winner)', true, `${winQuote.quotationNumber} rate=${RATE_WIN}`)

  const altQuote = await createAndSubmitQuote(vendorAlt.id, VENDOR_ALT, RATE_ALT)
  push('Vendor quote (alt)', true, `${altQuote.quotationNumber} rate=${RATE_ALT}`)

  const comparisonCreate = await request(app)
    .post(`${purchase}/comparisons`)
    .set(auth(purchaseToken))
    .send({ requestForQuotationId: rfqId })
  if (comparisonCreate.status !== 201 && comparisonCreate.status !== 200) {
    fail(`Comparison create failed: ${comparisonCreate.status} ${JSON.stringify(comparisonCreate.body)}`)
  }
  const comparisonId = comparisonCreate.body.data.id as string
  const comparisonNumber = comparisonCreate.body.data.comparisonNumber as string
  push('Create comparison', true, `${comparisonNumber} ${comparisonId}`)

  const award = await request(app)
    .post(`${purchase}/comparisons/${comparisonId}/award`)
    .set(auth(admin.token))
    .send({
      awardedVendorQuotationId: winQuote.id,
      selectionReason: 'Lowest landed rate for fasteners shortage',
    })
  if (award.status !== 200) fail(`Award failed: ${award.status} ${JSON.stringify(award.body)}`)
  push(
    'Award vendor',
    award.body.data.status === 'VENDOR_SELECTED',
    `status=${award.body.data.status} vendor=${VENDOR_WIN}`,
  )

  const createPo = await request(app)
    .post(`${purchase}/comparisons/${comparisonId}/create-po`)
    .set(auth(purchaseToken))
    .send({})
  if (createPo.status !== 201 && createPo.status !== 200) {
    fail(`Create PO from award failed: ${createPo.status} ${JSON.stringify(createPo.body)}`)
  }
  const poId = createPo.body.data.id as string
  const poNumber = createPo.body.data.orderNumber as string
  push('Create PO from award', true, `${poNumber} ${poId} origin=${createPo.body.data.origin}`)

  const po = await prisma.purchaseOrder.findUniqueOrThrow({
    where: { id: poId },
    include: { lines: true },
  })
  const poQty = Number(po.lines[0]?.quantity ?? 0) || Number(shortMat.shortageQty ?? 60)

  if (po.status === 'DRAFT') {
    const poSubmit = await request(app)
      .post(`${purchase}/orders/${poId}/submit`)
      .set(auth(purchaseToken))
      .send({})
    if (poSubmit.status !== 200) fail(`PO submit failed: ${poSubmit.status} ${JSON.stringify(poSubmit.body)}`)
    push('Submit PO', true, `status=${poSubmit.body.data.status}`)
  } else {
    push('Submit PO', true, `skipped (${po.status})`)
  }

  const poAfterSubmit = await prisma.purchaseOrder.findUniqueOrThrow({ where: { id: poId } })
  if (poAfterSubmit.status === 'PENDING_APPROVAL') {
    const poApprove = await request(app)
      .post(`${purchase}/orders/${poId}/approve`)
      .set(auth(admin.token))
      .send({})
    if (poApprove.status !== 200) fail(`PO approve failed: ${poApprove.status} ${JSON.stringify(poApprove.body)}`)
    push('Approve PO', true, `status=${poApprove.body.data.status}`)
  } else {
    push('Approve PO', true, `skipped (${poAfterSubmit.status})`)
  }

  let poSend = await request(app)
    .post(`${purchase}/orders/${poId}/send-to-vendor`)
    .set(auth(purchaseToken))
    .send({})
  if (poSend.status !== 200) {
    poSend = await request(app)
      .post(`${purchase}/orders/${poId}/send-to-vendor`)
      .set(auth(admin.token))
      .send({})
    if (poSend.status !== 200) {
      fail(`PO send failed: ${poSend.status} ${JSON.stringify(poSend.body)}`)
    }
  }
  push('Release PO', true, `status=${poSend.body.data.status}`)

  // Optional GRN + re-reserve (nice-to-have)
  let grnOk = false
  try {
    const poLine = po.lines[0]
    if (!poLine) throw new Error('PO line missing')

    const balBefore = await prisma.inventoryStockBalance.findUnique({
      where: {
        tenantId_itemId_warehouseId: {
          tenantId: tenant.id,
          itemId: shortItem.id,
          warehouseId: wip.id,
        },
      },
    })
    const onHandBefore = Number(balBefore?.onHandQty ?? 0)

    const grnCreate = await request(app)
      .post(`${purchase}/grns`)
      .set(auth(purchaseToken))
      .send({
        purchaseOrderId: poId,
        receiptDate: today,
        warehouseId: wip.id,
        vendorChallanNumber: `CH-RFQ-SHORT-${Date.now()}`,
        inspectionRequired: false,
        lines: [
          {
            purchaseOrderLineId: poLine.id,
            receivedQuantity: poQty > 0 ? poQty : Number(poLine.quantity ?? 60),
            qcRequired: false,
          },
        ],
      })
    if (grnCreate.status !== 201) throw new Error(`GRN create ${grnCreate.status} ${JSON.stringify(grnCreate.body)}`)
    const grnId = grnCreate.body.data.id as string
    const grnSubmit = await request(app)
      .post(`${purchase}/grns/${grnId}/submit`)
      .set(auth(purchaseToken))
      .send({})
    if (grnSubmit.status !== 200) throw new Error(`GRN submit ${grnSubmit.status}`)

    const balAfter = await prisma.inventoryStockBalance.findUnique({
      where: {
        tenantId_itemId_warehouseId: {
          tenantId: tenant.id,
          itemId: shortItem.id,
          warehouseId: wip.id,
        },
      },
    })
    const onHandAfter = Number(balAfter?.onHandQty ?? 0)
    if (onHandAfter <= onHandBefore) throw new Error(`stock ${onHandBefore} → ${onHandAfter}`)

    await request(app)
      .post(`${mfg}/work-orders/${woId}/materials/release-reservation`)
      .set(auth(admin.token))
      .send({ materialIds: [shortMat.id] })

    const reReserve = await request(app)
      .post(`${mfg}/work-orders/${woId}/materials/reserve`)
      .set(auth(admin.token))
      .send({ materialIds: [shortMat.id] })
    if (reReserve.status !== 200) {
      await request(app)
        .post(`${mfg}/work-orders/${woId}/materials/reserve`)
        .set(auth(admin.token))
        .send({})
    }

    grnOk = true
    push(
      'GRN + re-reserve (optional)',
      true,
      `${grnCreate.body.data.grnNumber ?? grnId} stock ${onHandBefore} → ${onHandAfter}`,
    )
  } catch (e) {
    push('GRN + re-reserve (optional)', true, `skipped: ${e instanceof Error ? e.message : String(e)}`)
  }

  console.log('\n── Summary ──')
  for (const r of results) {
    console.log(`  ${r.ok ? 'PASS' : 'FAIL'}  ${r.step.padEnd(32)} ${r.detail}`)
  }
  console.log(
    `\nWO ${woNo} PR ${prNumber} RFQ ${rfqNumber} CMP ${comparisonNumber} PO ${poNumber}` +
      (grnOk ? ' (+GRN)' : ''),
  )
  console.log('Shortage→RFQ→PO loop finished.\n')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })

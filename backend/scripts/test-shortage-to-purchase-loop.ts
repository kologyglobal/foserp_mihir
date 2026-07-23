/**
 * Live E2E: WO material shortage → Purchase Requisition → Approve → PO → GRN → re-reserve.
 *
 * Uses ISO tank FG WO on vasant-trailers. Forces SHORT on BO-FASTENERS by clearing WIP stock.
 *
 * Production-shortage PRs populate department / requestedBy / requiredDate and default
 * rfqRequired=false so submit → planning-sheet → PO works without a DRAFT patch.
 *
 * Usage:
 *   npx tsx scripts/test-shortage-to-purchase-loop.ts
 */
import request from 'supertest'
import { createApp } from '../src/app.js'
import { prisma } from '../src/config/database.js'

const TENANT_SLUG = process.env.TENANT_SLUG ?? 'vasant-trailers'
const FG_CODE = 'FG-ISO-TANK-26K'
const SHORT_ITEM = 'BO-FASTENERS'
const ISSUE_WH = 'WIP_FABRICATION'
const VENDOR_CODE = 'VND-FAST-04'
const RATE = 15

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

  console.log(`\n=== Shortage → PR → PO → GRN loop (${TENANT_SLUG}) ===\n`)

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

  const vendor = await prisma.masterVendor.findFirst({
    where: { tenantId: tenant.id, code: VENDOR_CODE, deletedAt: null },
  })
  if (!vendor) fail(`Vendor ${VENDOR_CODE} missing — run seed-vendors-customers-setup.ts`)

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

  // Clear fasteners free stock at WIP so reserve will SHORT
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
      notes: 'Shortage→purchase loop E2E',
      idempotencyKey: `iso-shortage-e2e-${Date.now()}`,
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
  const reserveResults = (reserved.body.data.results ?? []) as Array<{
    status: string
    shortageQty?: string | number
    itemCode?: string
    materialId?: string
  }>
  const shortLines = reserveResults.filter((r) => r.status === 'SHORT')
  const fastenerShort = shortLines.find(
    (r) => r.itemCode === SHORT_ITEM || String(r.itemCode ?? '').includes('FASTENER'),
  )
  push(
    'Reserve shows SHORT',
    shortLines.length > 0,
    `SHORT=${shortLines.length} fastener=${JSON.stringify(fastenerShort ?? shortLines[0] ?? null)}`,
  )

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
    status?: string
    purchaseRequisitionId?: string | null
  }>
  const shortMat = list.find((m) => (m.itemCode ?? m.item?.code) === SHORT_ITEM)
  if (!shortMat) fail(`Material line for ${SHORT_ITEM} not found on WO`)
  push(
    'Shortage material line',
    true,
    `id=${shortMat.id} status=${shortMat.status} shortageQty=${shortMat.shortageQty}`,
  )

  const shortagePr = await request(app)
    .post(`${mfg}/work-orders/${woId}/materials/shortage-requisition`)
    .set(auth(admin.token))
    .send({
      materialIds: [shortMat.id],
      priority: 'HIGH',
      submit: false,
      idempotencyKey: `shortage-loop-${woId}-${SHORT_ITEM}`,
    })
  if (shortagePr.status !== 201 && shortagePr.status !== 200) {
    // store-workbench bulk path as fallback
    const bulk = await request(app)
      .post(`${mfg}/store-workbench/issues/shortage-requisition`)
      .set(auth(admin.token))
      .send({
        materialIds: [shortMat.id],
        priority: 'HIGH',
        submit: false,
        idempotencyKey: `shortage-loop-bulk-${woId}-${SHORT_ITEM}`,
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
  const prSource = prPayload?.source
  const hasSubmitFields =
    Boolean(prPayload?.departmentId) &&
    Boolean(prPayload?.requestedById) &&
    Boolean(prPayload?.requiredDate) &&
    prPayload?.rfqRequired === false
  push(
    'Create shortage PR',
    Boolean(prId) && hasSubmitFields,
    `${prNumber ?? prId} source=${prSource ?? 'n/a'} status=${prPayload?.status} department=${prPayload?.departmentId ? 'set' : 'missing'} requestedBy=${prPayload?.requestedById ? 'set' : 'missing'} requiredDate=${prPayload?.requiredDate ?? 'missing'} rfqRequired=${prPayload?.rfqRequired}`,
  )

  const submit = await request(app)
    .post(`${purchase}/requisitions/${prId}/submit`)
    .set(auth(purchaseToken))
    .send({ remarks: 'Shortage loop submit' })
  if (submit.status !== 200) {
    const submit2 = await request(app)
      .post(`${purchase}/purchase-requisitions/${prId}/submit`)
      .set(auth(purchaseToken))
      .send({ remarks: 'Shortage loop submit' })
    if (submit2.status !== 200) {
      fail(`PR submit failed: ${submit.status}/${submit2.status} ${JSON.stringify(submit.body)}`)
    }
    push('Submit PR', true, `status=${submit2.body.data.status}`)
  } else {
    push('Submit PR', true, `status=${submit.body.data.status}`)
  }

  const approve = await request(app)
    .post(`${purchase}/requisitions/${prId}/approve`)
    .set(auth(admin.token))
    .send({ remarks: 'Shortage loop approve' })
  if (approve.status !== 200) {
    const approve2 = await request(app)
      .post(`${purchase}/purchase-requisitions/${prId}/approve`)
      .set(auth(admin.token))
      .send({ remarks: 'Shortage loop approve' })
    if (approve2.status !== 200) {
      fail(`PR approve failed: ${approve.status}/${approve2.status} ${JSON.stringify(approve.body)}`)
    }
    push('Approve PR', true, `status=${approve2.body.data.status}`)
  } else {
    push('Approve PR', true, `status=${approve.body.data.status}`)
  }

  let planningRows = await prisma.purchasePlanningRow.findMany({
    where: { tenantId: tenant.id, purchaseRequisitionId: prId, deletedAt: null },
  })
  if (planningRows.length === 0) {
    // wait briefly / re-query
    await new Promise((r) => setTimeout(r, 500))
    planningRows = await prisma.purchasePlanningRow.findMany({
      where: { tenantId: tenant.id, purchaseRequisitionId: prId, deletedAt: null },
    })
  }
  if (planningRows.length === 0) {
    fail('No planning rows after approve (rfqRequired should be false)')
  }
  const rowIds = planningRows.map((r) => r.id)
  push('Planning rows', true, `${rowIds.length} row(s)`)

  const selectVendor = await request(app)
    .post(`${purchase}/planning-sheet/bulk-select-vendor`)
    .set(auth(purchaseToken))
    .send({ rowIds, vendorId: vendor.id, expectedRate: RATE, negotiatedRate: RATE })
  if (![200, 201].includes(selectVendor.status)) {
    fail(`Select vendor failed: ${selectVendor.status} ${JSON.stringify(selectVendor.body)}`)
  }

  const bulkStatus = await request(app)
    .post(`${purchase}/planning-sheet/bulk-status`)
    .set(auth(admin.token))
    .send({ rowIds, status: 'APPROVED' })
  if (![200, 201].includes(bulkStatus.status)) {
    const bulkStatus2 = await request(app)
      .post(`${purchase}/planning-sheet/bulk-status`)
      .set(auth(purchaseToken))
      .send({ rowIds, status: 'APPROVED' })
    if (![200, 201].includes(bulkStatus2.status)) {
      fail(`Planning approve failed: ${JSON.stringify(bulkStatus2.body)}`)
    }
  }
  push('Planning approved', true, `vendor=${VENDOR_CODE}`)

  const createPo = await request(app)
    .post(`${purchase}/planning-sheet/create-po`)
    .set(auth(purchaseToken))
    .send({ rowIds })
  if (createPo.status !== 201) fail(`Create PO failed: ${createPo.status} ${JSON.stringify(createPo.body)}`)

  let poId: string | undefined = Array.isArray(createPo.body.data.orders)
    ? createPo.body.data.orders[0]?.id
    : createPo.body.data.purchaseOrderIds?.[0] ?? createPo.body.data.purchaseOrderId
  if (!poId) {
    const linked = await prisma.purchaseOrder.findFirst({
      where: { tenantId: tenant.id, purchaseRequisitionId: prId, deletedAt: null },
      orderBy: { createdAt: 'desc' },
    })
    poId = linked?.id
  }
  if (!poId) fail(`PO id missing: ${JSON.stringify(createPo.body.data)}`)

  const po = await prisma.purchaseOrder.findUniqueOrThrow({
    where: { id: poId },
    include: { lines: true },
  })
  push('Create PO', true, `${po.orderNumber} status=${po.status} lines=${po.lines.length}`)

  const poQty = Number(po.lines[0]?.orderedQuantity ?? po.lines[0]?.quantity ?? 0) || Number(shortMat.shortageQty ?? 60)

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

  const poLine = await prisma.purchaseOrderLine.findFirst({
    where: { tenantId: tenant.id, purchaseOrderId: poId },
  })
  if (!poLine) fail('PO line missing')

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
      vendorChallanNumber: `CH-SHORT-${Date.now()}`,
      inspectionRequired: false,
      lines: [
        {
          purchaseOrderLineId: poLine.id,
          receivedQuantity: poQty > 0 ? poQty : Number(poLine.orderedQuantity ?? 60),
          qcRequired: false,
        },
      ],
    })
  if (grnCreate.status !== 201) fail(`GRN create failed: ${grnCreate.status} ${JSON.stringify(grnCreate.body)}`)
  const grnId = grnCreate.body.data.id as string
  push('Create GRN', true, `${grnCreate.body.data.grnNumber ?? grnCreate.body.data.receiptNumber} → ${ISSUE_WH}`)

  const grnSubmit = await request(app)
    .post(`${purchase}/grns/${grnId}/submit`)
    .set(auth(purchaseToken))
    .send({})
  if (grnSubmit.status !== 200) fail(`GRN submit failed: ${grnSubmit.status} ${JSON.stringify(grnSubmit.body)}`)
  push('Submit GRN', true, `status=${grnSubmit.body.data.status}`)

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
  push(
    'Stock increased',
    onHandAfter > onHandBefore,
    `${SHORT_ITEM}@${ISSUE_WH} ${onHandBefore} → ${onHandAfter}`,
  )

  // Release any partial reservations then re-reserve
  await request(app)
    .post(`${mfg}/work-orders/${woId}/materials/release-reservation`)
    .set(auth(admin.token))
    .send({ materialIds: [shortMat.id] })

  const reReserve = await request(app)
    .post(`${mfg}/work-orders/${woId}/materials/reserve`)
    .set(auth(admin.token))
    .send({ materialIds: [shortMat.id] })
  if (reReserve.status !== 200) {
    // some APIs reserve all when materialIds unsupported
    const all = await request(app)
      .post(`${mfg}/work-orders/${woId}/materials/reserve`)
      .set(auth(admin.token))
      .send({})
    if (all.status !== 200) fail(`Re-reserve failed: ${all.status} ${JSON.stringify(all.body)}`)
    Object.assign(reReserve, all)
  }

  const reResults = (reReserve.body.data.results ?? []) as Array<{
    status: string
    itemCode?: string
    materialId?: string
    shortageQty?: string | number
  }>
  const fastenerResult =
    reResults.find((r) => r.materialId === shortMat.id || r.itemCode === SHORT_ITEM) ??
    reResults.find((r) => r.status !== 'SHORT')

  const matsAfter = await request(app)
    .get(`${mfg}/work-orders/${woId}/materials`)
    .set(auth(admin.token))
  const listAfter = (Array.isArray(matsAfter.body.data)
    ? matsAfter.body.data
    : matsAfter.body.data?.materials ?? []) as Array<{
    id: string
    itemCode?: string
    item?: { code?: string }
    status?: string
    reservedQty?: string | number
    shortageQty?: string | number
  }>
  const afterLine = listAfter.find((m) => m.id === shortMat.id)
  const available =
    afterLine &&
    Number(afterLine.shortageQty ?? 0) <= 0 &&
    (afterLine.status === 'RESERVED' || Number(afterLine.reservedQty ?? 0) > 0)

  push(
    'WO material available',
    Boolean(available) || fastenerResult?.status === 'RESERVED' || fastenerResult?.status === 'PARTIAL',
    `line status=${afterLine?.status} reserved=${afterLine?.reservedQty} shortage=${afterLine?.shortageQty} reserveResult=${JSON.stringify(fastenerResult ?? reResults[0])}`,
  )

  console.log('\n── Summary ──')
  for (const r of results) {
    console.log(`  ${r.ok ? 'PASS' : 'FAIL'}  ${r.step.padEnd(28)} ${r.detail}`)
  }
  console.log(`\nWO ${woNo} PR ${prNumber} PO ${po.orderNumber}`)
  console.log('Shortage→purchase loop finished.\n')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })

/**
 * Live E2E: PR → Planning → PO → GRN → Inventory stock
 *
 * Golden path for MS-PIPE-DN25-KG (1 NOS = 50 KG):
 *   PR 5000 KG → PO 5000 KG / 100 NOS → GRN 5000 KG → stock +100 NOS
 *
 * Usage (from backend/):
 *   npm run test:pr-to-grn-stock-e2e
 *   TENANT_SLUG=vasant-trailers npx tsx scripts/test-pr-to-grn-stock-e2e.ts
 *
 * See docs/purchase/PR_TO_GRN_STOCK_E2E_TEST.md
 */
import request from 'supertest'
import { createApp } from '../src/app.js'
import { prisma } from '../src/config/prisma.js'

const TENANT_SLUG = process.env.TENANT_SLUG ?? 'vasant-trailers'
const MAKER_EMAIL = process.env.MAKER_EMAIL ?? 'purchase@vasant-trailers.com'
const MAKER_PASSWORD = process.env.MAKER_PASSWORD ?? 'Purchase@123'
const APPROVER_EMAIL = process.env.APPROVER_EMAIL ?? 'admin@vasant-trailers.com'
const APPROVER_PASSWORD = process.env.APPROVER_PASSWORD ?? 'Admin@123'
const VENDOR_CODE = 'VND-MUOM-01'
const ITEM_CODE = 'MS-PIPE-DN25-KG'
const WAREHOUSE_CODES = ['BO-MAIN', 'WH-RM-01', 'RM-MAIN', 'MAIN'] as const

const FACTOR = 50
const COMMERCIAL_QTY = 5000
const BASE_QTY = 100
const RATE = 80
const EXPECTED_AMOUNT = 400_000
const EXPECTED_UNIT_COST_PRIMARY = 4000

const app = createApp()

type StepResult = { step: string; ok: boolean; detail: string }

function fail(msg: string): never {
  console.error(`\n✗ FATAL: ${msg}`)
  process.exit(1)
}

function nearly(a: number, b: number, eps = 1e-4): boolean {
  return Math.abs(a - b) <= eps
}

function auth(token: string) {
  return { Authorization: `Bearer ${token}` }
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

async function ensureVendor(tenantId: string) {
  const existing = await prisma.masterVendor.findFirst({
    where: { tenantId, code: VENDOR_CODE, deletedAt: null },
  })
  if (existing) {
    if (existing.status !== 'ACTIVE' || existing.isBlocked) {
      return prisma.masterVendor.update({
        where: { id: existing.id },
        data: { status: 'ACTIVE', deletedAt: null, isBlocked: false },
      })
    }
    return existing
  }
  return prisma.masterVendor.create({
    data: {
      tenantId,
      code: VENDOR_CODE,
      name: 'MUOM Test Vendor Pvt Ltd',
      city: 'Pune',
      state: 'Maharashtra',
      contactPerson: 'E2E Tester',
      contactPhone: '9876501999',
      email: 'muom@vendor.example',
      gstin: '27AABCM9999D1Z9',
      vendorType: 'trader',
      defaultLeadTimeDays: 3,
      status: 'ACTIVE',
    },
  })
}

async function ensureWarehouse(tenantId: string) {
  for (const code of WAREHOUSE_CODES) {
    const wh = await prisma.masterWarehouse.findFirst({
      where: { tenantId, code, deletedAt: null, status: 'ACTIVE' },
    })
    if (wh) return wh
  }
  const any = await prisma.masterWarehouse.findFirst({
    where: { tenantId, deletedAt: null, status: 'ACTIVE' },
    orderBy: { createdAt: 'asc' },
  })
  if (!any) fail('No ACTIVE warehouse — seed warehouses first')
  return any
}

async function loadCertItem(tenantId: string) {
  const item = await prisma.masterItem.findFirst({
    where: { tenantId, code: ITEM_CODE, deletedAt: null, status: 'ACTIVE' },
    include: {
      baseUom: { select: { id: true, code: true } },
      purchaseUom: { select: { id: true, code: true } },
    },
  })
  if (!item) {
    fail(`Item ${ITEM_CODE} not found — run: TENANT_SLUG=${TENANT_SLUG} npx tsx scripts/seed-multi-uom-test-items.ts`)
  }
  if (!item.purchaseUom || item.purchaseUom.code.toUpperCase() !== 'KG') {
    fail(`${ITEM_CODE} must have purchase UOM KG`)
  }
  const factor = Number(item.uomConversionFactor)
  if (!nearly(factor, FACTOR)) {
    fail(`${ITEM_CODE} factor expected ${FACTOR}, got ${factor}`)
  }
  return item
}

async function onHand(tenantId: string, itemId: string, warehouseId: string): Promise<number> {
  const bal = await prisma.inventoryStockBalance.findUnique({
    where: { tenantId_itemId_warehouseId: { tenantId, itemId, warehouseId } },
  })
  return Number(bal?.onHandQty ?? 0)
}

async function approvePrUntilDone(
  prId: string,
  approverToken: string,
  push: (step: string, ok: boolean, detail: string) => void,
): Promise<string> {
  let status = 'pending_approval'
  let guard = 0
  while (status === 'pending_approval' && guard < 8) {
    const appr = await request(app)
      .post(`/api/v1/t/${TENANT_SLUG}/purchase/requisitions/${prId}/approve`)
      .set(auth(approverToken))
      .send({ remarks: `E2E approve L${guard}` })
    if (appr.status !== 200) {
      fail(`PR approve failed: ${appr.status} ${JSON.stringify(appr.body)}`)
    }
    status = String(appr.body.data.status).toLowerCase()
    guard++
  }
  push('Approve PR', status === 'approved', `status=${status} levels=${guard}`)
  if (status !== 'approved') fail(`PR not approved: ${status}`)
  return status
}

async function main() {
  const results: StepResult[] = []
  const push = (step: string, ok: boolean, detail: string) => {
    results.push({ step, ok, detail })
    console.log(`${ok ? '✓' : '✗'} ${step}: ${detail}`)
    if (!ok) fail(detail)
  }

  console.log('\n╔══════════════════════════════════════════════════════════════╗')
  console.log('║  PR → Planning → PO → GRN → Stock E2E (MS-PIPE-DN25-KG)     ║')
  console.log('╚══════════════════════════════════════════════════════════════╝')
  console.log(`Tenant: ${TENANT_SLUG}`)
  console.log(`Time:   ${new Date().toISOString()}\n`)

  const tenant = await prisma.tenant.findFirst({ where: { slug: TENANT_SLUG, deletedAt: null } })
  if (!tenant) fail(`Tenant not found: ${TENANT_SLUG}`)

  const item = await loadCertItem(tenant.id)
  const vendor = await ensureVendor(tenant.id)
  const warehouse = await ensureWarehouse(tenant.id)
  const kgUomId = item.purchaseUom!.id
  const nosUomId = item.baseUom!.id

  push('Masters', true, `item=${item.code} vendor=${vendor.code} wh=${warehouse.code} factor=${FACTOR}`)

  const stockBefore = await onHand(tenant.id, item.id, warehouse.id)
  console.log(`Stock BEFORE: ${stockBefore} NOS\n`)

  let makerToken: string
  try {
    makerToken = (await login(MAKER_EMAIL, MAKER_PASSWORD)).token
  } catch {
    makerToken = (await login(APPROVER_EMAIL, APPROVER_PASSWORD)).token
    console.log(`  · maker login unavailable — using ${APPROVER_EMAIL}`)
  }
  const approver = await login(APPROVER_EMAIL, APPROVER_PASSWORD)

  const base = `/api/v1/t/${TENANT_SLUG}/purchase`
  const today = new Date().toISOString().slice(0, 10)
  const requiredDate = new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10)
  const runTag = `E2E-PR-GRN-${Date.now()}`

  // ── 1) Create PR (commercial KG qty) ───────────────────────────────────
  const prCreate = await request(app)
    .post(`${base}/requisitions`)
    .set(auth(makerToken))
    .send({
      requisitionDate: today,
      requiredDate,
      departmentId: 'dept-production',
      warehouseId: warehouse.id,
      priority: 'NORMAL',
      rfqRequired: false,
      purchasePurpose: `MUOM stock test ${runTag}`,
      remarks: runTag,
      lines: [
        {
          itemId: item.id,
          itemCode: item.code,
          itemName: item.name,
          requiredQuantity: COMMERCIAL_QTY,
          uomId: kgUomId,
          estimatedRate: RATE,
          preferredVendorId: vendor.id,
          requiredDate,
          warehouseId: warehouse.id,
        },
      ],
    })
  if (prCreate.status !== 201) {
    fail(`PR create failed: ${prCreate.status} ${JSON.stringify(prCreate.body)}`)
  }
  const prId = prCreate.body.data.id as string
  const prNumber = prCreate.body.data.requisitionNumber as string
  push('Create PR', true, `${prNumber} status=${prCreate.body.data.status} qty=${COMMERCIAL_QTY} KG`)

  // ── 2) Submit PR ───────────────────────────────────────────────────────
  const prSubmit = await request(app)
    .post(`${base}/requisitions/${prId}/submit`)
    .set(auth(makerToken))
    .send({})
  if (prSubmit.status !== 200) {
    fail(`PR submit failed: ${prSubmit.status} ${JSON.stringify(prSubmit.body)}`)
  }
  push('Submit PR', true, `status=${prSubmit.body.data.status}`)

  // ── 3) Approve PR ──────────────────────────────────────────────────────
  await approvePrUntilDone(prId, approver.token, push)

  const planningRows = await prisma.purchasePlanningRow.findMany({
    where: { tenantId: tenant.id, purchaseRequisitionId: prId, deletedAt: null },
  })
  if (planningRows.length !== 1) {
    fail(`Expected 1 planning row, got ${planningRows.length}`)
  }
  const planningRow = planningRows[0]!
  push(
    'Planning sync',
    true,
    `${planningRow.planningNumber} netQty=${planningRow.netPurchaseQuantity} vendor=${planningRow.selectedVendorId ? 'set' : 'missing'}`,
  )

  if (!planningRow.selectedVendorId || Number(planningRow.expectedRate) <= 0) {
    const patch = await request(app)
      .patch(`${base}/planning-sheet/${planningRow.id}`)
      .set(auth(makerToken))
      .send({
        selectedVendorId: vendor.id,
        expectedRate: RATE,
        negotiatedRate: RATE,
      })
    if (patch.status !== 200) {
      fail(`Planning patch failed: ${patch.status} ${JSON.stringify(patch.body)}`)
    }
    push('Planning vendor/rate', true, 'patched selectedVendorId + rate')
  }

  // ── 4) Create PO from planning ─────────────────────────────────────────
  const poFromPlanning = await request(app)
    .post(`${base}/planning-sheet/create-po`)
    .set(auth(makerToken))
    .send({
      rowIds: [planningRow.id],
      orderDate: today,
      deliveryWarehouseId: warehouse.id,
      remarks: runTag,
    })
  if (poFromPlanning.status !== 201) {
    fail(`Create PO from planning failed: ${poFromPlanning.status} ${JSON.stringify(poFromPlanning.body)}`)
  }
  const orders = (poFromPlanning.body.data?.orders ?? []) as Array<Record<string, unknown>>
  if (!orders.length) fail('create-po returned no orders')
  const poDto = orders[0]!
  const poId = poDto.id as string
  const poNumber = poDto.orderNumber as string
  const poLines = (poDto.lines ?? []) as Array<Record<string, unknown>>
  push('Create PO from planning', true, `${poNumber} lines=${poLines.length}`)

  const poLine = poLines[0]
  if (!poLine) fail('PO has no lines')
  push(
    'PO uomQuantity',
    nearly(Number(poLine.uomQuantity), COMMERCIAL_QTY),
    `expected=${COMMERCIAL_QTY} actual=${poLine.uomQuantity}`,
  )
  push(
    'PO quantity (base)',
    nearly(Number(poLine.quantity), BASE_QTY),
    `expected=${BASE_QTY} actual=${poLine.quantity}`,
  )
  push(
    'PO factor',
    nearly(Number(poLine.uomConversionFactor), FACTOR),
    `expected=${FACTOR} actual=${poLine.uomConversionFactor}`,
  )
  push(
    'PO amount',
    nearly(Number(poLine.amount), EXPECTED_AMOUNT),
    `expected=${EXPECTED_AMOUNT} actual=${poLine.amount}`,
  )
  push(
    'PO unitCostPrimary',
    nearly(Number(poLine.unitCostPrimary), EXPECTED_UNIT_COST_PRIMARY),
    `expected=${EXPECTED_UNIT_COST_PRIMARY} actual=${poLine.unitCostPrimary}`,
  )

  // ── 5) PO lifecycle ────────────────────────────────────────────────────
  let poStatus = String(poDto.status)
  if (poStatus === 'DRAFT') {
    const sub = await request(app).post(`${base}/orders/${poId}/submit`).set(auth(makerToken)).send({})
    if (sub.status !== 200) fail(`PO submit failed: ${sub.status}`)
    poStatus = String(sub.body.data.status)
    push('Submit PO', true, `status=${poStatus}`)
  }
  if (poStatus === 'PENDING_APPROVAL') {
    const appr = await request(app).post(`${base}/orders/${poId}/approve`).set(auth(approver.token)).send({})
    if (appr.status !== 200) fail(`PO approve failed: ${appr.status}`)
    poStatus = String(appr.body.data.status)
    push('Approve PO', true, `status=${poStatus}`)
  }
  if (poStatus !== 'SENT_TO_VENDOR') {
    const send = await request(app)
      .post(`${base}/orders/${poId}/send-to-vendor`)
      .set(auth(makerToken))
      .send({})
    if (send.status !== 200) {
      const send2 = await request(app)
        .post(`${base}/orders/${poId}/send-to-vendor`)
        .set(auth(approver.token))
        .send({})
      if (send2.status !== 200) fail(`PO send failed: ${send.status}/${send2.status}`)
      poStatus = String(send2.body.data.status)
    } else {
      poStatus = String(send.body.data.status)
    }
    push('Release PO', true, `status=${poStatus}`)
  }

  const poDb = await prisma.purchaseOrder.findUniqueOrThrow({
    where: { id: poId },
    include: { lines: true },
  })
  const poLineDb = poDb.lines[0]
  if (!poLineDb) fail('PO DB line missing')

  // ── 6) GRN full receive ────────────────────────────────────────────────
  const grnCreate = await request(app)
    .post(`${base}/grns`)
    .set(auth(makerToken))
    .send({
      purchaseOrderId: poId,
      receiptDate: today,
      warehouseId: warehouse.id,
      vendorChallanNumber: `CH-${runTag}`,
      inspectionRequired: false,
      lines: [
        {
          purchaseOrderLineId: poLineDb.id,
          receivedUomQuantity: COMMERCIAL_QTY,
          qcRequired: false,
        },
      ],
    })
  if (grnCreate.status !== 201) {
    fail(`GRN create failed: ${grnCreate.status} ${JSON.stringify(grnCreate.body)}`)
  }
  const grnId = grnCreate.body.data.id as string
  const grnNumber = (grnCreate.body.data.grnNumber ?? grnCreate.body.data.receiptNumber) as string
  const grnLines = (grnCreate.body.data.lines ?? []) as Array<Record<string, unknown>>
  const grnLine = grnLines[0]
  push('Create GRN', true, `${grnNumber}`)

  push(
    'GRN receivedUomQuantity',
    nearly(Number(grnLine?.receivedUomQuantity), COMMERCIAL_QTY),
    `expected=${COMMERCIAL_QTY} actual=${grnLine?.receivedUomQuantity}`,
  )
  push(
    'GRN receivedQuantity',
    nearly(Number(grnLine?.receivedQuantity), BASE_QTY),
    `expected=${BASE_QTY} actual=${grnLine?.receivedQuantity}`,
  )

  const grnSubmit = await request(app)
    .post(`${base}/grns/${grnId}/submit`)
    .set(auth(makerToken))
    .send({ remarks: runTag })
  if (grnSubmit.status !== 200) {
    fail(`GRN submit failed: ${grnSubmit.status} ${JSON.stringify(grnSubmit.body)}`)
  }
  let grnFinalStatus = String(grnSubmit.body.data.status)
  if (grnFinalStatus === 'SUBMITTED') {
    const post = await request(app)
      .post(`${base}/grns/${grnId}/post-inventory`)
      .set(auth(makerToken))
      .send({})
    if (post.status !== 200) fail(`GRN post-inventory failed: ${post.status}`)
    grnFinalStatus = String(post.body.data.status)
  }
  push('Submit GRN (+ inventory)', true, `status=${grnFinalStatus}`)

  // ── 7) Stock + movement ────────────────────────────────────────────────
  const stockAfter = await onHand(tenant.id, item.id, warehouse.id)
  const delta = stockAfter - stockBefore
  push(
    'Stock delta',
    nearly(delta, BASE_QTY),
    `before=${stockBefore} after=${stockAfter} delta=${delta} expected=+${BASE_QTY} NOS`,
  )

  const movement = await prisma.inventoryStockMovement.findFirst({
    where: {
      tenantId: tenant.id,
      itemId: item.id,
      warehouseId: warehouse.id,
      movementType: 'INWARD',
      referenceType: 'GRN',
      OR: [{ referenceNo: grnNumber }, { remarks: { contains: grnNumber } }],
    },
    orderBy: { createdAt: 'desc' },
  })
  push(
    'INWARD movement',
    Boolean(movement) && nearly(Math.abs(Number(movement?.quantity ?? 0)), BASE_QTY),
    movement
      ? `${movement.movementNumber} qty=${movement.quantity} ref=${movement.referenceNo ?? '—'}`
      : 'not found',
  )

  // ── 8) PR / PO linkage status ──────────────────────────────────────────
  const prAfter = await prisma.purchaseRequisition.findUniqueOrThrow({ where: { id: prId } })
  push(
    'PR conversion status',
    prAfter.status === 'CONVERTED_TO_PO' || prAfter.status === 'PARTIALLY_CONVERTED',
    `status=${prAfter.status}`,
  )

  const poAfter = await prisma.purchaseOrder.findUniqueOrThrow({
    where: { id: poId },
    include: { lines: true },
  })
  push(
    'PO received qty',
    nearly(Number(poAfter.lines[0]?.receivedQuantity), BASE_QTY),
    `received=${poAfter.lines[0]?.receivedQuantity} po.status=${poAfter.status}`,
  )

  // ── Summary ────────────────────────────────────────────────────────────
  console.log('\n╔══════════════════════════════════════════════════════════════╗')
  console.log('║  SUMMARY                                                     ║')
  console.log('╚══════════════════════════════════════════════════════════════╝')
  let pass = 0
  let failCount = 0
  for (const r of results) {
    console.log(`  ${r.ok ? 'PASS' : 'FAIL'}  ${r.step.padEnd(36)} ${r.detail}`)
    if (r.ok) pass++
    else failCount++
  }
  console.log(`\nChain: PR ${prNumber} → PO ${poNumber} → GRN ${grnNumber}`)
  console.log(`Stock: ${stockBefore} → ${stockAfter} NOS (+${delta})`)
  console.log(`Result: ${failCount === 0 ? 'ALL PASSED' : `${failCount} FAILED`} (${pass}/${results.length})\n`)

  if (failCount > 0) process.exit(1)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })

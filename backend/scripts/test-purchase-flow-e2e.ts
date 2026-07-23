/**
 * Live E2E: Purchase PR → PO → GRN → Inventory on tenant vasant-trailers.
 *
 * Item:  BO-FASTENERS (qcRequired=false — clean first pass)
 * Vendor: VND-FAST-04 (Metro Fasteners) — created if missing
 * WH:    BO-MAIN
 *
 * Maker-checker: purchase@ creates/submits; admin@ approves.
 *
 * Usage:
 *   npx tsx scripts/test-purchase-flow-e2e.ts
 */
import request from 'supertest'
import { createApp } from '../src/app.js'
import { prisma } from '../src/config/database.js'

const TENANT_SLUG = process.env.TENANT_SLUG ?? 'vasant-trailers'
const ITEM_CODE = 'BO-FASTENERS'
const VENDOR_CODE = 'VND-FAST-04'
const WAREHOUSE_CODE = 'BO-MAIN'
const QTY = 50
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

async function ensureVendor(tenantId: string) {
  const existing = await prisma.masterVendor.findFirst({
    where: { tenantId, code: VENDOR_CODE, deletedAt: null },
  })
  if (existing) {
    if (existing.status !== 'ACTIVE') {
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
      name: 'Metro Fasteners Pvt Ltd',
      city: 'Mumbai',
      state: 'Maharashtra',
      contactPerson: 'Suresh Nair',
      contactPhone: '9876501004',
      email: 'sales@metrofast.example',
      gstin: '27AABCM3456D1Z1',
      vendorType: 'trader',
      defaultLeadTimeDays: 3,
      status: 'ACTIVE',
    },
  })
}

async function main() {
  const results: StepResult[] = []
  const push = (step: string, ok: boolean, detail: string) => {
    results.push({ step, ok, detail })
    console.log(`${ok ? '✓' : '✗'} ${step}: ${detail}`)
    if (!ok) fail(detail)
  }

  console.log(`\n=== Purchase flow E2E (${TENANT_SLUG}) ===\n`)

  const tenant = await prisma.tenant.findFirst({
    where: { slug: TENANT_SLUG, deletedAt: null },
  })
  if (!tenant) fail(`Tenant not found: ${TENANT_SLUG}`)

  const item = await prisma.masterItem.findFirst({
    where: { tenantId: tenant.id, code: ITEM_CODE, deletedAt: null },
  })
  if (!item) fail(`Item ${ITEM_CODE} missing — run seed-iso-tank-pilot-items.ts`)

  const warehouse = await prisma.masterWarehouse.findFirst({
    where: { tenantId: tenant.id, code: WAREHOUSE_CODE, deletedAt: null, status: 'ACTIVE' },
  })
  if (!warehouse) fail(`Warehouse ${WAREHOUSE_CODE} missing`)

  const department = await prisma.crmMaster.findFirst({
    where: { tenantId: tenant.id, kind: 'departments', code: 'purchase', deletedAt: null },
  })
  if (!department) fail('CRM department "purchase" missing')

  const vendor = await ensureVendor(tenant.id)
  push(
    'Masters',
    true,
    `item=${item.code} vendor=${vendor.code} wh=${warehouse.code} dept=${department.code}`,
  )

  const balanceBefore = await prisma.inventoryStockBalance.findUnique({
    where: {
      tenantId_itemId_warehouseId: {
        tenantId: tenant.id,
        itemId: item.id,
        warehouseId: warehouse.id,
      },
    },
  })
  const onHandBefore = Number(balanceBefore?.onHandQty ?? 0)

  const maker = await login('purchase@vasant-trailers.com', 'Purchase@123')
  const approver = await login('admin@vasant-trailers.com', 'Admin@123')
  push('Auth', true, `maker=${maker.userId.slice(0, 8)}… approver=${approver.userId.slice(0, 8)}…`)

  const base = `/api/v1/t/${TENANT_SLUG}/purchase`
  const today = new Date().toISOString().slice(0, 10)
  const requiredDate = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10)

  // ── 1. Create PR ──────────────────────────────────────────────────────
  const prCreate = await request(app)
    .post(`${base}/requisitions`)
    .set(auth(maker.token))
    .send({
      requisitionDate: today,
      requiredDate,
      rfqRequired: false,
      priority: 'NORMAL',
      warehouseId: warehouse.id,
      departmentId: department.id,
      remarks: 'E2E purchase flow — BO-FASTENERS pilot',
      lines: [
        {
          itemId: item.id,
          itemCode: item.code,
          itemName: item.name,
          requiredQuantity: QTY,
          uomId: item.baseUomId,
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
  push('Create PR', true, `${prNumber} status=${prCreate.body.data.status}`)

  // ── 2. Submit PR ──────────────────────────────────────────────────────
  const prSubmit = await request(app)
    .post(`${base}/requisitions/${prId}/submit`)
    .set(auth(maker.token))
    .send({ remarks: 'Submit for approval' })
  if (prSubmit.status !== 200) {
    fail(`PR submit failed: ${prSubmit.status} ${JSON.stringify(prSubmit.body)}`)
  }
  push('Submit PR', true, `status=${prSubmit.body.data.status}`)

  // ── 3. Approve PR ─────────────────────────────────────────────────────
  const prApprove = await request(app)
    .post(`${base}/requisitions/${prId}/approve`)
    .set(auth(approver.token))
    .send({ remarks: 'Approved for pilot PO' })
  if (prApprove.status !== 200) {
    fail(`PR approve failed: ${prApprove.status} ${JSON.stringify(prApprove.body)}`)
  }
  push('Approve PR', true, `status=${prApprove.body.data.status}`)

  // ── 4. Planning → select vendor → approve → create PO ─────────────────
  const planningRows = await prisma.purchasePlanningRow.findMany({
    where: { tenantId: tenant.id, purchaseRequisitionId: prId, deletedAt: null },
  })
  if (planningRows.length === 0) {
    fail('No planning rows after PR approve (expected rfqRequired=false sync)')
  }
  const rowIds = planningRows.map((r) => r.id)

  const selectVendor = await request(app)
    .post(`${base}/planning-sheet/bulk-select-vendor`)
    .set(auth(maker.token))
    .send({ rowIds, vendorId: vendor.id, expectedRate: RATE, negotiatedRate: RATE })
  if (![200, 201].includes(selectVendor.status)) {
    fail(`Select vendor failed: ${selectVendor.status} ${JSON.stringify(selectVendor.body)}`)
  }

  const bulkStatus = await request(app)
    .post(`${base}/planning-sheet/bulk-status`)
    .set(auth(approver.token))
    .send({ rowIds, status: 'APPROVED' })
  if (![200, 201].includes(bulkStatus.status)) {
    // maker may also approve planning rows
    const bulkStatus2 = await request(app)
      .post(`${base}/planning-sheet/bulk-status`)
      .set(auth(maker.token))
      .send({ rowIds, status: 'APPROVED' })
    if (![200, 201].includes(bulkStatus2.status)) {
      fail(`Planning approve failed: ${bulkStatus.status}/${bulkStatus2.status} ${JSON.stringify(bulkStatus2.body)}`)
    }
  }
  push('Planning ready', true, `${rowIds.length} row(s) vendor=${VENDOR_CODE}`)

  const createPo = await request(app)
    .post(`${base}/planning-sheet/create-po`)
    .set(auth(maker.token))
    .send({ rowIds })
  if (createPo.status !== 201) {
    fail(`Create PO failed: ${createPo.status} ${JSON.stringify(createPo.body)}`)
  }
  const poIds: string[] = Array.isArray(createPo.body.data.orders)
    ? createPo.body.data.orders.map((o: { id: string }) => o.id)
    : createPo.body.data.purchaseOrderIds ??
      (createPo.body.data.purchaseOrderId ? [createPo.body.data.purchaseOrderId] : [])

  let poId = poIds[0]
  if (!poId) {
    const linked = await prisma.purchaseOrder.findFirst({
      where: { tenantId: tenant.id, purchaseRequisitionId: prId, deletedAt: null },
      orderBy: { createdAt: 'desc' },
    })
    poId = linked?.id
  }
  if (!poId) fail(`PO id missing from create-po response: ${JSON.stringify(createPo.body.data)}`)

  const po = await prisma.purchaseOrder.findUniqueOrThrow({
    where: { id: poId },
    include: { lines: true },
  })
  push('Create PO', true, `${po.orderNumber} status=${po.status} lines=${po.lines.length}`)

  // ── 5. Submit / Approve / Send PO ─────────────────────────────────────
  if (po.status === 'DRAFT') {
    const poSubmit = await request(app)
      .post(`${base}/orders/${poId}/submit`)
      .set(auth(maker.token))
      .send({})
    if (poSubmit.status !== 200) {
      fail(`PO submit failed: ${poSubmit.status} ${JSON.stringify(poSubmit.body)}`)
    }
    push('Submit PO', true, `status=${poSubmit.body.data.status}`)
  } else {
    push('Submit PO', true, `skipped (already ${po.status})`)
  }

  const poAfterSubmit = await prisma.purchaseOrder.findUniqueOrThrow({ where: { id: poId } })
  if (poAfterSubmit.status === 'PENDING_APPROVAL') {
    const poApprove = await request(app)
      .post(`${base}/orders/${poId}/approve`)
      .set(auth(approver.token))
      .send({})
    if (poApprove.status !== 200) {
      fail(`PO approve failed: ${poApprove.status} ${JSON.stringify(poApprove.body)}`)
    }
    push('Approve PO', true, `status=${poApprove.body.data.status}`)
  } else {
    push('Approve PO', true, `skipped (status=${poAfterSubmit.status})`)
  }

  const poSend = await request(app)
    .post(`${base}/orders/${poId}/send-to-vendor`)
    .set(auth(maker.token))
    .send({})
  if (poSend.status !== 200) {
    // admin may send
    const poSend2 = await request(app)
      .post(`${base}/orders/${poId}/send-to-vendor`)
      .set(auth(approver.token))
      .send({})
    if (poSend2.status !== 200) {
      fail(`PO send-to-vendor failed: ${poSend.status}/${poSend2.status} ${JSON.stringify(poSend2.body)}`)
    }
    push('Release PO', true, `status=${poSend2.body.data.status}`)
  } else {
    push('Release PO', true, `status=${poSend.body.data.status}`)
  }

  const poLine = await prisma.purchaseOrderLine.findFirst({
    where: { tenantId: tenant.id, purchaseOrderId: poId },
  })
  if (!poLine) fail('PO line missing')

  // ── 6. GRN full receive (no QC) ────────────────────────────────────────
  const grnCreate = await request(app)
    .post(`${base}/grns`)
    .set(auth(maker.token))
    .send({
      purchaseOrderId: poId,
      receiptDate: today,
      warehouseId: warehouse.id,
      vendorChallanNumber: `CH-E2E-${Date.now()}`,
      inspectionRequired: false,
      lines: [
        {
          purchaseOrderLineId: poLine.id,
          receivedQuantity: QTY,
          qcRequired: false,
        },
      ],
    })
  if (grnCreate.status !== 201) {
    fail(`GRN create failed: ${grnCreate.status} ${JSON.stringify(grnCreate.body)}`)
  }
  const grnId = grnCreate.body.data.id as string
  const grnNumber = grnCreate.body.data.grnNumber ?? grnCreate.body.data.receiptNumber
  push('Create GRN', true, `${grnNumber} status=${grnCreate.body.data.status}`)

  const grnSubmit = await request(app)
    .post(`${base}/grns/${grnId}/submit`)
    .set(auth(maker.token))
    .send({})
  if (grnSubmit.status !== 200) {
    fail(`GRN submit failed: ${grnSubmit.status} ${JSON.stringify(grnSubmit.body)}`)
  }
  push(
    'Submit GRN',
    true,
    `status=${grnSubmit.body.data.status} received=${grnSubmit.body.data.lines?.[0]?.receivedQuantity ?? QTY}`,
  )

  // ── 7. Verify PO received qty + stock ─────────────────────────────────
  const poLineAfter = await prisma.purchaseOrderLine.findUniqueOrThrow({ where: { id: poLine.id } })
  const poAfter = await prisma.purchaseOrder.findUniqueOrThrow({ where: { id: poId } })
  const receivedQty = Number(poLineAfter.receivedQuantity)
  const receivedOk = receivedQty >= QTY
  push(
    'PO received qty',
    receivedOk,
    `line.receivedQuantity=${receivedQty} expected>=${QTY} po.status=${poAfter.status}`,
  )

  const balanceAfter = await prisma.inventoryStockBalance.findUnique({
    where: {
      tenantId_itemId_warehouseId: {
        tenantId: tenant.id,
        itemId: item.id,
        warehouseId: warehouse.id,
      },
    },
  })
  const onHandAfter = Number(balanceAfter?.onHandQty ?? 0)
  const stockOk = onHandAfter >= onHandBefore + QTY
  push(
    'Accepted stock',
    stockOk,
    `onHand ${onHandBefore} → ${onHandAfter} (delta=${onHandAfter - onHandBefore}, expected +${QTY})`,
  )

  const inward = await prisma.inventoryStockMovement.findFirst({
    where: {
      tenantId: tenant.id,
      itemId: item.id,
      warehouseId: warehouse.id,
      movementType: 'INWARD',
    },
    orderBy: { createdAt: 'desc' },
  })
  push(
    'Inventory movement',
    Boolean(inward),
    inward
      ? `${inward.movementNumber} type=${inward.movementType} qty=${inward.quantity}`
      : 'no INWARD movement found',
  )

  console.log('\n── Summary ──')
  for (const r of results) {
    console.log(`  ${r.ok ? 'PASS' : 'FAIL'}  ${r.step.padEnd(22)} ${r.detail}`)
  }
  console.log(`\nPR ${prNumber} → PO ${po.orderNumber} → GRN ${grnNumber}`)
  console.log('All purchase flow checks passed.\n')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })

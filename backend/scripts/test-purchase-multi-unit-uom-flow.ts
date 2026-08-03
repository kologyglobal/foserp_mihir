/**
 * Live E2E: Purchase multi-unit UOM — multi-item PO → GRN → Inventory
 *
 * Creates / reuses items with Meter and Kilogram purchase UOMs, places ONE PO
 * with multiple lines, receives a GRN, posts inventory (auto on submit when
 * QC is off), then asserts dual-qty math + stock deltas in primary UOM.
 *
 * Scenarios covered (see docs/PURCHASE_MULTI_UNIT_UOM_TEST_PLAN.md):
 *   #1 Exact match — Meter → NOS (factor 3)
 *   #6 KG → NOS (factor 50)
 *   #5 Same UOM NOS → NOS (factor 1)
 *   #9 Multi-item one GRN
 *
 * Usage (from backend/):
 *   npx tsx scripts/test-purchase-multi-unit-uom-flow.ts
 *   npm run test:purchase-multi-unit-uom-live
 *
 * Env:
 *   TENANT_SLUG   default vasant-trailers
 *   MAKER_EMAIL / MAKER_PASSWORD     default purchase@…
 *   APPROVER_EMAIL / APPROVER_PASSWORD  default admin@…
 */
import request from 'supertest'
import { createApp } from '../src/app.js'
import { prisma } from '../src/config/prisma.js'
import {
  lineAmountFromVendor,
  toPrimaryQty,
  toPrimaryUnitCost,
} from '../src/modules/purchase/shared/uom-conversion.js'

const TENANT_SLUG = process.env.TENANT_SLUG ?? 'vasant-trailers'
const MAKER_EMAIL = process.env.MAKER_EMAIL ?? 'purchase@vasant-trailers.com'
const MAKER_PASSWORD = process.env.MAKER_PASSWORD ?? 'Purchase@123'
const APPROVER_EMAIL = process.env.APPROVER_EMAIL ?? 'admin@vasant-trailers.com'
const APPROVER_PASSWORD = process.env.APPROVER_PASSWORD ?? 'Admin@123'
const VENDOR_CODE = 'VND-MUOM-01'
const WAREHOUSE_CODES = ['BO-MAIN', 'WH-RM-01', 'RM-MAIN', 'MAIN'] as const

const app = createApp()

type StepResult = { step: string; ok: boolean; detail: string }

type LinePlan = {
  code: string
  name: string
  /** Purchase / vendor UOM code on master */
  purchaseUomCode: string
  /** Primary / stock UOM code */
  baseUomCode: string
  factor: number
  /** Vendor qty entered on PO / GRN */
  uomQuantity: number
  /** Vendor unit rate */
  rate: number
  /** Derived expectations */
  expectedPrimary: number
  expectedUnitCostPrimary: number
  expectedAmount: number
}

const LINES: LinePlan[] = [
  {
    code: 'PIPE-MUOM-MTR',
    name: 'MUOM Test Pipe (Meter)',
    purchaseUomCode: 'MTR',
    baseUomCode: 'NOS',
    factor: 3,
    uomQuantity: 30,
    rate: 30,
    expectedPrimary: 10,
    expectedUnitCostPrimary: 90,
    expectedAmount: 900,
  },
  {
    code: 'ROD-MUOM-KG',
    name: 'MUOM Test Rod (Kilogram)',
    purchaseUomCode: 'KG',
    baseUomCode: 'NOS',
    factor: 50,
    uomQuantity: 1000,
    rate: 2,
    expectedPrimary: 20,
    expectedUnitCostPrimary: 100,
    expectedAmount: 2000,
  },
  {
    code: 'BOLT-MUOM-NOS',
    name: 'MUOM Test Bolt (NOS 1:1)',
    purchaseUomCode: 'NOS',
    baseUomCode: 'NOS',
    factor: 1,
    uomQuantity: 25,
    rate: 4,
    expectedPrimary: 25,
    expectedUnitCostPrimary: 4,
    expectedAmount: 100,
  },
]

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
    email,
  }
}

async function ensureUom(
  tenantId: string,
  code: string,
  name: string,
  opts: { uomType?: string; decimalPlaces?: number } = {},
) {
  const existing = await prisma.masterUom.findFirst({
    where: { tenantId, code, deletedAt: null },
  })
  if (existing) {
    if (existing.status !== 'ACTIVE') {
      return prisma.masterUom.update({
        where: { id: existing.id },
        data: { status: 'ACTIVE', deletedAt: null },
      })
    }
    return existing
  }
  // Alias: METER → prefer create as MTR; also accept existing METER
  if (code === 'MTR') {
    const meter = await prisma.masterUom.findFirst({
      where: { tenantId, code: { in: ['METER', 'M', 'MTRS'] }, deletedAt: null },
    })
    if (meter) return meter
  }
  return prisma.masterUom.create({
    data: {
      tenantId,
      code,
      name,
      uomType: opts.uomType ?? (code === 'NOS' ? 'integer' : 'decimal'),
      decimalPlaces: opts.decimalPlaces ?? (code === 'NOS' ? 0 : 4),
      status: 'ACTIVE',
    },
  })
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
      contactPerson: 'UOM Tester',
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
  if (!any) fail('No ACTIVE warehouse found — seed warehouses first')
  return any
}

async function ensureCategory(tenantId: string) {
  const existing = await prisma.masterItemCategory.findFirst({
    where: { tenantId, deletedAt: null, status: 'ACTIVE' },
    orderBy: { createdAt: 'asc' },
  })
  if (existing) return existing
  return prisma.masterItemCategory.create({
    data: {
      tenantId,
      code: 'MUOM-RM',
      name: 'MUOM Raw Material',
      stockPolicy: 'REQUIRED',
      defaultIsStockable: true,
      defaultInventoryType: 'inventory',
      status: 'ACTIVE',
    },
  })
}

async function ensureItem(
  tenantId: string,
  plan: LinePlan,
  baseUomId: string,
  purchaseUomId: string,
  categoryId: string,
) {
  const existing = await prisma.masterItem.findFirst({
    where: { tenantId, code: plan.code, deletedAt: null },
  })
  const data = {
    name: plan.name,
    itemDescription: plan.name,
    categoryId,
    baseUomId,
    purchaseUomId: plan.factor === 1 ? baseUomId : purchaseUomId,
    uomConversionFactor: plan.factor,
    purchaseQtyPerUom: plan.factor,
    itemType: 'RM',
    inventoryType: 'inventory',
    isPurchasable: true,
    isStockable: true,
    qcRequired: false,
    status: 'ACTIVE' as const,
    deletedAt: null,
    isBlocked: false,
  }
  if (existing) {
    return prisma.masterItem.update({ where: { id: existing.id }, data })
  }
  return prisma.masterItem.create({
    data: {
      tenantId,
      code: plan.code,
      ...data,
    },
  })
}

async function onHand(tenantId: string, itemId: string, warehouseId: string): Promise<number> {
  const bal = await prisma.inventoryStockBalance.findUnique({
    where: {
      tenantId_itemId_warehouseId: { tenantId, itemId, warehouseId },
    },
  })
  return Number(bal?.onHandQty ?? 0)
}

async function main() {
  const results: StepResult[] = []
  const push = (step: string, ok: boolean, detail: string) => {
    results.push({ step, ok, detail })
    console.log(`${ok ? '✓' : '✗'} ${step}: ${detail}`)
    if (!ok) fail(detail)
  }

  console.log('\n╔══════════════════════════════════════════════════════════════╗')
  console.log('║  Purchase Multi-Unit UOM — PO → GRN → Inventory E2E         ║')
  console.log('╚══════════════════════════════════════════════════════════════╝')
  console.log(`Tenant: ${TENANT_SLUG}`)
  console.log(`Time:   ${new Date().toISOString()}\n`)

  // ── Print expected matrix ─────────────────────────────────────────────
  console.log('── Expected line matrix ──')
  console.log(
    'Code'.padEnd(18),
    'Vendor qty'.padEnd(14),
    'Factor'.padEnd(8),
    'Primary'.padEnd(10),
    'Rate'.padEnd(8),
    'UnitCostP'.padEnd(10),
    'Amount',
  )
  for (const l of LINES) {
    // Sanity: formulas must match plan constants
    const p = toPrimaryQty(l.uomQuantity, l.factor)
    const uc = toPrimaryUnitCost(l.rate, l.factor)
    const amt = lineAmountFromVendor(l.rate, l.uomQuantity)
    if (!nearly(p, l.expectedPrimary) || !nearly(uc, l.expectedUnitCostPrimary) || !nearly(amt, l.expectedAmount)) {
      fail(`Plan constants inconsistent for ${l.code}: computed p=${p} uc=${uc} amt=${amt}`)
    }
    console.log(
      l.code.padEnd(18),
      `${l.uomQuantity} ${l.purchaseUomCode}`.padEnd(14),
      String(l.factor).padEnd(8),
      `${l.expectedPrimary} ${l.baseUomCode}`.padEnd(10),
      String(l.rate).padEnd(8),
      String(l.expectedUnitCostPrimary).padEnd(10),
      String(l.expectedAmount),
    )
  }
  console.log('')

  const tenant = await prisma.tenant.findFirst({ where: { slug: TENANT_SLUG, deletedAt: null } })
  if (!tenant) fail(`Tenant not found: ${TENANT_SLUG}`)

  const nos = await ensureUom(tenant.id, 'NOS', 'Numbers', { uomType: 'integer', decimalPlaces: 0 })
  const mtr = await ensureUom(tenant.id, 'MTR', 'Meter', { uomType: 'decimal', decimalPlaces: 4 })
  const kg = await ensureUom(tenant.id, 'KG', 'Kilogram', { uomType: 'decimal', decimalPlaces: 4 })
  const uomByCode: Record<string, { id: string; code: string }> = {
    NOS: nos,
    MTR: mtr,
    KG: kg,
  }
  push('UOMs', true, `NOS=${nos.code} MTR=${mtr.code} KG=${kg.code}`)

  const category = await ensureCategory(tenant.id)
  const warehouse = await ensureWarehouse(tenant.id)
  const vendor = await ensureVendor(tenant.id)
  push('Masters', true, `category=${category.code} wh=${warehouse.code} vendor=${vendor.code}`)

  const items: Array<{ plan: LinePlan; item: { id: string; code: string } }> = []
  for (const plan of LINES) {
    const base = uomByCode[plan.baseUomCode]
    const purchase = uomByCode[plan.purchaseUomCode]
    if (!base || !purchase) fail(`UOM missing for ${plan.code}`)
    const item = await ensureItem(tenant.id, plan, base.id, purchase.id, category.id)
    items.push({ plan, item })
  }
  push(
    'Items ready',
    true,
    items.map((i) => `${i.item.code}(f=${i.plan.factor})`).join(', '),
  )

  const stockBefore = new Map<string, number>()
  for (const { item } of items) {
    const q = await onHand(tenant.id, item.id, warehouse.id)
    stockBefore.set(item.id, q)
  }
  console.log('\n── Stock BEFORE ──')
  for (const { item, plan } of items) {
    console.log(`  ${item.code.padEnd(18)} onHand=${stockBefore.get(item.id)} ${plan.baseUomCode}`)
  }
  console.log('')

  let makerToken: string
  let makerId: string
  try {
    const maker = await login(MAKER_EMAIL, MAKER_PASSWORD)
    makerToken = maker.token
    makerId = maker.userId
  } catch {
    const admin = await login(APPROVER_EMAIL, APPROVER_PASSWORD)
    makerToken = admin.token
    makerId = admin.userId
    console.log(`  · maker login unavailable — using ${APPROVER_EMAIL}`)
  }
  const approver = await login(APPROVER_EMAIL, APPROVER_PASSWORD)
  push('Auth', true, `maker=${makerId.slice(0, 8)}… approver=${approver.userId.slice(0, 8)}…`)

  const base = `/api/v1/t/${TENANT_SLUG}/purchase`
  const today = new Date().toISOString().slice(0, 10)
  const requiredDate = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10)

  // ── Create multi-line PO ──────────────────────────────────────────────
  const poCreate = await request(app)
    .post(`${base}/orders`)
    .set(auth(makerToken))
    .send({
      orderDate: today,
      vendorId: vendor.id,
      expectedDeliveryDate: requiredDate,
      deliveryWarehouseId: warehouse.id,
      currencyCode: 'INR',
      remarks: 'E2E multi-unit UOM — meter + kilo + NOS',
      lines: items.map(({ item, plan }) => ({
        itemId: item.id,
        itemCode: item.code,
        itemName: plan.name,
        uomQuantity: plan.uomQuantity,
        uomConversionFactor: plan.factor,
        uomId: uomByCode[plan.purchaseUomCode]!.id,
        rate: plan.rate,
        requiredDate,
      })),
    })
  if (poCreate.status !== 201) {
    fail(`PO create failed: ${poCreate.status} ${JSON.stringify(poCreate.body)}`)
  }
  const poId = poCreate.body.data.id as string
  const poNumber = poCreate.body.data.orderNumber as string
  const poLinesDto = (poCreate.body.data.lines ?? []) as Array<Record<string, unknown>>
  push('Create PO', true, `${poNumber} lines=${poLinesDto.length} status=${poCreate.body.data.status}`)

  console.log('\n── PO lines: expected vs actual ──')
  for (const { item, plan } of items) {
    const line = poLinesDto.find((l) => l.itemId === item.id || l.itemCode === item.code)
    if (!line) fail(`PO response missing line for ${item.code}`)
    const checks: Array<[string, number, number]> = [
      ['uomQuantity', plan.uomQuantity, Number(line.uomQuantity)],
      ['quantity (primary)', plan.expectedPrimary, Number(line.quantity)],
      ['uomConversionFactor', plan.factor, Number(line.uomConversionFactor)],
      ['unitCostPrimary', plan.expectedUnitCostPrimary, Number(line.unitCostPrimary)],
      ['amount', plan.expectedAmount, Number(line.amount)],
    ]
    for (const [label, exp, act] of checks) {
      const ok = nearly(exp, act)
      push(
        `PO ${item.code} ${label}`,
        ok,
        `expected=${exp} actual=${act}${ok ? '' : '  ← MISMATCH'}`,
      )
    }
  }

  // ── Lifecycle: submit → approve → send ────────────────────────────────
  let poStatus = String(poCreate.body.data.status)
  if (poStatus === 'DRAFT') {
    const sub = await request(app).post(`${base}/orders/${poId}/submit`).set(auth(makerToken)).send({})
    if (sub.status !== 200) fail(`PO submit failed: ${sub.status} ${JSON.stringify(sub.body)}`)
    poStatus = String(sub.body.data.status)
    push('Submit PO', true, `status=${poStatus}`)
  } else {
    push('Submit PO', true, `skipped (already ${poStatus})`)
  }

  if (poStatus === 'PENDING_APPROVAL') {
    const appr = await request(app)
      .post(`${base}/orders/${poId}/approve`)
      .set(auth(approver.token))
      .send({})
    if (appr.status !== 200) fail(`PO approve failed: ${appr.status} ${JSON.stringify(appr.body)}`)
    poStatus = String(appr.body.data.status)
    push('Approve PO', true, `status=${poStatus}`)
  } else {
    push('Approve PO', true, `skipped (status=${poStatus})`)
  }

  const send = await request(app)
    .post(`${base}/orders/${poId}/send-to-vendor`)
    .set(auth(makerToken))
    .send({})
  if (send.status !== 200) {
    const send2 = await request(app)
      .post(`${base}/orders/${poId}/send-to-vendor`)
      .set(auth(approver.token))
      .send({})
    if (send2.status !== 200) {
      fail(`PO send-to-vendor failed: ${send.status}/${send2.status} ${JSON.stringify(send2.body)}`)
    }
    push('Release PO', true, `status=${send2.body.data.status}`)
  } else {
    push('Release PO', true, `status=${send.body.data.status}`)
  }

  const poDb = await prisma.purchaseOrder.findUniqueOrThrow({
    where: { id: poId },
    include: { lines: true },
  })
  const poLineByItem = new Map(poDb.lines.map((l) => [l.itemId!, l]))

  // ── GRN full receive (vendor UOM qty) ─────────────────────────────────
  const grnCreate = await request(app)
    .post(`${base}/grns`)
    .set(auth(makerToken))
    .send({
      purchaseOrderId: poId,
      receiptDate: today,
      warehouseId: warehouse.id,
      vendorChallanNumber: `CH-MUOM-${Date.now()}`,
      inspectionRequired: false,
      lines: items.map(({ item, plan }) => {
        const poLine = poLineByItem.get(item.id)
        if (!poLine) fail(`PO DB line missing for ${item.code}`)
        return {
          purchaseOrderLineId: poLine.id,
          receivedUomQuantity: plan.uomQuantity,
          qcRequired: false,
        }
      }),
    })
  if (grnCreate.status !== 201) {
    fail(`GRN create failed: ${grnCreate.status} ${JSON.stringify(grnCreate.body)}`)
  }
  const grnId = grnCreate.body.data.id as string
  const grnNumber = (grnCreate.body.data.grnNumber ?? grnCreate.body.data.receiptNumber) as string
  push('Create GRN', true, `${grnNumber} status=${grnCreate.body.data.status}`)

  const grnLinesDto = (grnCreate.body.data.lines ?? []) as Array<Record<string, unknown>>
  console.log('\n── GRN lines: expected vs actual ──')
  for (const { item, plan } of items) {
    const poLine = poLineByItem.get(item.id)!
    const gl = grnLinesDto.find((l) => l.purchaseOrderLineId === poLine.id)
    if (!gl) fail(`GRN response missing line for ${item.code}`)
    const uomOk = nearly(plan.uomQuantity, Number(gl.receivedUomQuantity))
    const priOk = nearly(plan.expectedPrimary, Number(gl.receivedQuantity))
    push(
      `GRN ${item.code} receivedUomQuantity`,
      uomOk,
      `expected=${plan.uomQuantity} actual=${gl.receivedUomQuantity}`,
    )
    push(
      `GRN ${item.code} receivedQuantity (primary)`,
      priOk,
      `expected=${plan.expectedPrimary} actual=${gl.receivedQuantity}`,
    )
  }

  const grnSubmit = await request(app)
    .post(`${base}/grns/${grnId}/submit`)
    .set(auth(makerToken))
    .send({ remarks: 'MUOM E2E submit + auto inventory post' })
  if (grnSubmit.status !== 200) {
    fail(`GRN submit failed: ${grnSubmit.status} ${JSON.stringify(grnSubmit.body)}`)
  }
  const grnFinalStatus = String(grnSubmit.body.data.status)
  push('Submit GRN (+ inventory)', true, `status=${grnFinalStatus}`)
  if (grnFinalStatus !== 'INVENTORY_POSTED' && grnFinalStatus !== 'SUBMITTED') {
    // Try explicit post if still waiting
    const post = await request(app)
      .post(`${base}/grns/${grnId}/post-inventory`)
      .set(auth(makerToken))
      .send({})
    if (post.status !== 200) {
      fail(`GRN post-inventory failed: ${post.status} ${JSON.stringify(post.body)}`)
    }
    push('Post inventory', true, `status=${post.body.data.status}`)
  } else if (grnFinalStatus === 'SUBMITTED') {
    const post = await request(app)
      .post(`${base}/grns/${grnId}/post-inventory`)
      .set(auth(makerToken))
      .send({})
    if (post.status !== 200) {
      fail(`GRN post-inventory failed: ${post.status} ${JSON.stringify(post.body)}`)
    }
    push('Post inventory', true, `status=${post.body.data.status}`)
  }

  // ── Inventory stock + movements ───────────────────────────────────────
  console.log('\n── Stock AFTER (primary UOM only) ──')
  for (const { item, plan } of items) {
    const before = stockBefore.get(item.id) ?? 0
    const after = await onHand(tenant.id, item.id, warehouse.id)
    const delta = after - before
    const ok = nearly(delta, plan.expectedPrimary)
    console.log(
      `  ${item.code.padEnd(18)} ${before} → ${after}  Δ=${delta}  expected Δ=+${plan.expectedPrimary} ${plan.baseUomCode}  ${ok ? 'PASS' : 'FAIL'}`,
    )
    push(
      `Stock ${item.code}`,
      ok,
      `before=${before} after=${after} delta=${delta} expected=+${plan.expectedPrimary}`,
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
    // Fallback: latest GRN INWARD for item/wh
    const mov =
      movement ??
      (await prisma.inventoryStockMovement.findFirst({
        where: {
          tenantId: tenant.id,
          itemId: item.id,
          warehouseId: warehouse.id,
          movementType: 'INWARD',
          referenceType: 'GRN',
        },
        orderBy: { createdAt: 'desc' },
      }))
    const movQty = Number(mov?.quantity ?? 0)
    const movOk = Boolean(mov) && nearly(Math.abs(movQty), plan.expectedPrimary)
    const snapOk =
      !mov ||
      mov.uomQuantity == null ||
      nearly(Number(mov.uomQuantity), plan.uomQuantity)
    push(
      `Movement ${item.code}`,
      movOk,
      mov
        ? `${mov.movementNumber} qty=${movQty} uomQty=${mov.uomQuantity ?? '—'} factor=${mov.uomConversionFactor ?? '—'} ref=${mov.referenceNo ?? '—'}`
        : 'no INWARD movement found',
    )
    if (mov && mov.uomQuantity != null) {
      push(
        `Movement snapshot ${item.code} uomQuantity`,
        snapOk,
        `expected=${plan.uomQuantity} actual=${mov.uomQuantity}`,
      )
    }
  }

  // ── PO received qty ───────────────────────────────────────────────────
  const poAfter = await prisma.purchaseOrder.findUniqueOrThrow({
    where: { id: poId },
    include: { lines: true },
  })
  for (const { item, plan } of items) {
    const line = poAfter.lines.find((l) => l.itemId === item.id)
    if (!line) fail(`PO line gone for ${item.code}`)
    const recv = Number(line.receivedQuantity)
    const ok = nearly(recv, plan.expectedPrimary)
    push(
      `PO received ${item.code}`,
      ok,
      `receivedQuantity=${recv} expected=${plan.expectedPrimary} po.status=${poAfter.status}`,
    )
  }
  push(
    'PO fully received',
    poAfter.status === 'FULLY_RECEIVED' || poAfter.status === 'PARTIALLY_RECEIVED',
    `status=${poAfter.status} (FULLY_RECEIVED preferred)`,
  )

  // ── Summary table ─────────────────────────────────────────────────────
  console.log('\n╔══════════════════════════════════════════════════════════════╗')
  console.log('║  SUMMARY                                                     ║')
  console.log('╚══════════════════════════════════════════════════════════════╝')
  let pass = 0
  let failCount = 0
  for (const r of results) {
    console.log(`  ${r.ok ? 'PASS' : 'FAIL'}  ${r.step.padEnd(42)} ${r.detail}`)
    if (r.ok) pass++
    else failCount++
  }
  console.log(`\nDocuments: PO ${poNumber} → GRN ${grnNumber}`)
  console.log(`Warehouse: ${warehouse.code}`)
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

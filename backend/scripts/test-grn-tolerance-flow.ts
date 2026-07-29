/**
 * Live E2E: GRN receiving tolerance
 *
 * 1) Seeds Item Master rows with 0% / 2% / 10% receivingTolerancePercentage
 * 2) Runs PO → GRN scenarios (exact, excess within/outside, zero, approve/reject)
 *
 * Usage (from backend/):
 *   npx tsx scripts/test-grn-tolerance-flow.ts
 *   npx tsx scripts/test-grn-tolerance-flow.ts --seed-only
 *   npm run test:grn-tolerance-live
 *
 * Env: TENANT_SLUG, MAKER_EMAIL/PASSWORD, APPROVER_EMAIL/PASSWORD
 * See docs/PURCHASE_GRN_TOLERANCE_TEST_PLAN.md
 */
import request from 'supertest'
import { createApp } from '../src/app.js'
import { prisma } from '../src/config/prisma.js'
import {
  evaluateGrnLineTolerance,
  resolveReceivingTolerancePct,
} from '../src/modules/purchase/shared/grn-tolerance.js'

const TENANT_SLUG = process.env.TENANT_SLUG ?? 'vasant-trailers'
const MAKER_EMAIL = process.env.MAKER_EMAIL ?? 'purchase@vasant-trailers.com'
const MAKER_PASSWORD = process.env.MAKER_PASSWORD ?? 'Purchase@123'
const APPROVER_EMAIL = process.env.APPROVER_EMAIL ?? 'admin@vasant-trailers.com'
const APPROVER_PASSWORD = process.env.APPROVER_PASSWORD ?? 'Admin@123'
const VENDOR_CODE = 'VND-TOL-01'
const WAREHOUSE_CODES = ['BO-MAIN', 'WH-RM-01', 'RM-MAIN', 'MAIN'] as const
const SEED_ONLY = process.argv.includes('--seed-only')

const app = createApp()

type StepResult = { step: string; ok: boolean; detail: string }

type TolItemPlan = {
  code: string
  name: string
  receivingTolerancePercentage: number
}

const TOL_ITEMS: TolItemPlan[] = [
  {
    code: 'TOL-ITEM-0PCT',
    name: 'Tolerance Test Item — 0% (exact)',
    receivingTolerancePercentage: 0,
  },
  {
    code: 'TOL-ITEM-2PCT',
    name: 'Tolerance Test Item — 2%',
    receivingTolerancePercentage: 2,
  },
  {
    code: 'TOL-ITEM-10PCT',
    name: 'Tolerance Test Item — 10%',
    receivingTolerancePercentage: 10,
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

async function ensureUom(tenantId: string, code: string, name: string) {
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
  return prisma.masterUom.create({
    data: {
      tenantId,
      code,
      name,
      uomType: 'integer',
      decimalPlaces: 0,
      status: 'ACTIVE',
    },
  })
}

async function ensureVendor(tenantId: string) {
  const existing = await prisma.masterVendor.findFirst({
    where: { tenantId, code: VENDOR_CODE, deletedAt: null },
  })
  if (existing) {
    return prisma.masterVendor.update({
      where: { id: existing.id },
      data: { status: 'ACTIVE', deletedAt: null, isBlocked: false },
    })
  }
  return prisma.masterVendor.create({
    data: {
      tenantId,
      code: VENDOR_CODE,
      name: 'Tolerance Test Vendor Pvt Ltd',
      city: 'Pune',
      state: 'Maharashtra',
      contactPerson: 'Tol Tester',
      contactPhone: '9876501888',
      email: 'tol@vendor.example',
      gstin: '27AABCT8888D1Z8',
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
      code: 'TOL-RM',
      name: 'Tolerance Raw Material',
      stockPolicy: 'REQUIRED',
      defaultIsStockable: true,
      defaultInventoryType: 'inventory',
      status: 'ACTIVE',
    },
  })
}

async function ensureTolItem(
  tenantId: string,
  plan: TolItemPlan,
  baseUomId: string,
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
    purchaseUomId: baseUomId,
    uomConversionFactor: 1,
    purchaseQtyPerUom: 1,
    receivingTolerancePercentage: plan.receivingTolerancePercentage,
    productType: 'raw_material',
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
    data: { tenantId, code: plan.code, ...data },
  })
}

async function releasePo(
  base: string,
  poId: string,
  makerToken: string,
  approverToken: string,
  push: (s: string, ok: boolean, d: string) => void,
) {
  let status = 'DRAFT'
  const get = await request(app).get(`${base}/orders/${poId}`).set(auth(makerToken))
  status = String(get.body.data?.status ?? 'DRAFT')

  if (status === 'DRAFT') {
    const sub = await request(app).post(`${base}/orders/${poId}/submit`).set(auth(makerToken)).send({})
    if (sub.status !== 200) fail(`PO submit failed: ${sub.status} ${JSON.stringify(sub.body)}`)
    status = String(sub.body.data.status)
  }
  if (status === 'PENDING_APPROVAL') {
    const appr = await request(app)
      .post(`${base}/orders/${poId}/approve`)
      .set(auth(approverToken))
      .send({})
    if (appr.status !== 200) fail(`PO approve failed: ${appr.status} ${JSON.stringify(appr.body)}`)
    status = String(appr.body.data.status)
  }
  const send = await request(app)
    .post(`${base}/orders/${poId}/send-to-vendor`)
    .set(auth(makerToken))
    .send({})
  if (send.status !== 200) {
    const send2 = await request(app)
      .post(`${base}/orders/${poId}/send-to-vendor`)
      .set(auth(approverToken))
      .send({})
    if (send2.status !== 200) {
      fail(`PO send-to-vendor failed: ${JSON.stringify(send2.body)}`)
    }
    status = String(send2.body.data.status)
  } else {
    status = String(send.body.data.status)
  }
  push('Release PO', true, `po=${poId.slice(0, 8)}… status=${status}`)
  return status
}

async function createReleasedPo(opts: {
  base: string
  makerToken: string
  approverToken: string
  vendorId: string
  warehouseId: string
  itemId: string
  itemCode: string
  itemName: string
  uomId: string
  qty: number
  push: (s: string, ok: boolean, d: string) => void
}) {
  const multi = await createReleasedMultiLinePo({
    ...opts,
    lines: [
      {
        itemId: opts.itemId,
        itemCode: opts.itemCode,
        itemName: opts.itemName,
        qty: opts.qty,
      },
    ],
  })
  return { poId: multi.poId, lineId: multi.lines[0]!.lineId, orderNumber: multi.orderNumber }
}

async function createReleasedMultiLinePo(opts: {
  base: string
  makerToken: string
  approverToken: string
  vendorId: string
  warehouseId: string
  uomId: string
  lines: Array<{ itemId: string; itemCode: string; itemName: string; qty: number }>
  push: (s: string, ok: boolean, d: string) => void
}) {
  const today = new Date().toISOString().slice(0, 10)
  const requiredDate = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10)
  const create = await request(app)
    .post(`${opts.base}/orders`)
    .set(auth(opts.makerToken))
    .send({
      orderDate: today,
      vendorId: opts.vendorId,
      expectedDeliveryDate: requiredDate,
      deliveryWarehouseId: opts.warehouseId,
      currencyCode: 'INR',
      remarks: `GRN tolerance multi-line E2E — ${opts.lines.map((l) => l.itemCode).join('+')}`,
      lines: opts.lines.map((l) => ({
        itemId: l.itemId,
        itemCode: l.itemCode,
        itemName: l.itemName,
        uomQuantity: l.qty,
        uomConversionFactor: 1,
        uomId: opts.uomId,
        rate: 10,
        requiredDate,
      })),
    })
  if (create.status !== 201) {
    fail(`PO create failed: ${create.status} ${JSON.stringify(create.body)}`)
  }
  const poId = create.body.data.id as string
  const apiLines = create.body.data.lines as Array<{ id: string; itemCodeSnapshot?: string; itemCode?: string }>
  await releasePo(opts.base, poId, opts.makerToken, opts.approverToken, opts.push)
  return {
    poId,
    orderNumber: create.body.data.orderNumber as string,
    lines: apiLines.map((l) => ({
      lineId: l.id,
      itemCode: String(l.itemCodeSnapshot ?? l.itemCode ?? ''),
    })),
  }
}

async function createGrn(opts: {
  base: string
  token: string
  poId: string
  warehouseId: string
  lineId: string
  receivedQty: number
  closeOpenQuantity?: boolean
}) {
  return createMultiLineGrn({
    base: opts.base,
    token: opts.token,
    poId: opts.poId,
    warehouseId: opts.warehouseId,
    lines: [
      {
        lineId: opts.lineId,
        receivedQty: opts.receivedQty,
        closeOpenQuantity: opts.closeOpenQuantity,
      },
    ],
  })
}

async function createMultiLineGrn(opts: {
  base: string
  token: string
  poId: string
  warehouseId: string
  lines: Array<{ lineId: string; receivedQty: number; closeOpenQuantity?: boolean }>
}) {
  const today = new Date().toISOString().slice(0, 10)
  return request(app)
    .post(`${opts.base}/grns`)
    .set(auth(opts.token))
    .send({
      purchaseOrderId: opts.poId,
      receiptDate: today,
      warehouseId: opts.warehouseId,
      vendorChallanNumber: `CH-TOL-${Date.now()}-${Math.floor(Math.random() * 9999)}`,
      inspectionRequired: false,
      lines: opts.lines.map((l) => ({
        purchaseOrderLineId: l.lineId,
        receivedQuantity: l.receivedQty,
        closeOpenQuantity: Boolean(l.closeOpenQuantity),
        qcRequired: false,
      })),
    })
}

function runCalculatorSelfCheck(push: (s: string, ok: boolean, d: string) => void) {
  console.log('\n── Calculator self-check (open=100) ──')
  const cases: Array<{
    label: string
    input: Parameters<typeof evaluateGrnLineTolerance>[0]
    expectStatus: string
    expectApproval: boolean
  }> = [
    {
      label: '0% exact',
      input: { openQuantity: 100, receivedQuantity: 100, itemTolerancePct: 0 },
      expectStatus: 'OK',
      expectApproval: false,
    },
    {
      label: '0% +1 excess',
      input: { openQuantity: 100, receivedQuantity: 101, itemTolerancePct: 0 },
      expectStatus: 'EXCESS_OUTSIDE',
      expectApproval: true,
    },
    {
      label: '0% short partial',
      input: { openQuantity: 100, receivedQuantity: 90, itemTolerancePct: 0 },
      expectStatus: 'PARTIAL',
      expectApproval: false,
    },
    {
      label: '0% short close',
      input: {
        openQuantity: 100,
        receivedQuantity: 90,
        itemTolerancePct: 0,
        closeOpenQuantity: true,
      },
      expectStatus: 'SHORT_OUTSIDE',
      expectApproval: true,
    },
    {
      label: '0% zero',
      input: { openQuantity: 100, receivedQuantity: 0, itemTolerancePct: 0 },
      expectStatus: 'NOT_RECEIVED',
      expectApproval: false,
    },
    {
      label: '2% within',
      input: { openQuantity: 100, receivedQuantity: 101.5, itemTolerancePct: 2 },
      expectStatus: 'EXCESS_WITHIN',
      expectApproval: false,
    },
    {
      label: '2% outside',
      input: { openQuantity: 100, receivedQuantity: 105, itemTolerancePct: 2 },
      expectStatus: 'EXCESS_OUTSIDE',
      expectApproval: true,
    },
    {
      label: '10% within',
      input: { openQuantity: 100, receivedQuantity: 105, itemTolerancePct: 10 },
      expectStatus: 'EXCESS_WITHIN',
      expectApproval: false,
    },
    {
      label: '10% outside',
      input: { openQuantity: 100, receivedQuantity: 111, itemTolerancePct: 10 },
      expectStatus: 'EXCESS_OUTSIDE',
      expectApproval: true,
    },
    {
      label: 'setup fallback 5%',
      input: {
        openQuantity: 100,
        receivedQuantity: 103,
        itemTolerancePct: 0,
        setupTolerancePct: 5,
        allowOverReceipt: true,
      },
      expectStatus: 'EXCESS_WITHIN',
      expectApproval: false,
    },
  ]

  for (const c of cases) {
    const r = evaluateGrnLineTolerance(c.input)
    const ok = r.toleranceStatus === c.expectStatus && r.requiresApproval === c.expectApproval
    push(
      `Calc ${c.label}`,
      ok,
      `status=${r.toleranceStatus} approval=${r.requiresApproval} tol%=${r.tolerancePercentage} var%=${r.variancePercentage}`,
    )
  }

  const resolved = resolveReceivingTolerancePct({
    itemTolerancePct: 10,
    setupTolerancePct: 5,
    allowOverReceipt: true,
  })
  push('Resolve item beats setup', resolved === 10, `got=${resolved}`)
}

async function main() {
  const results: StepResult[] = []
  const push = (step: string, ok: boolean, detail: string) => {
    results.push({ step, ok, detail })
    console.log(`${ok ? '✓' : '✗'} ${step}: ${detail}`)
    if (!ok) fail(detail)
  }

  console.log('\n╔══════════════════════════════════════════════════════════════╗')
  console.log('║  GRN Receiving Tolerance — Seed + Scenario E2E              ║')
  console.log('╚══════════════════════════════════════════════════════════════╝')
  console.log(`Tenant: ${TENANT_SLUG}`)
  console.log(`Mode:   ${SEED_ONLY ? 'SEED ONLY' : 'FULL FLOW'}`)
  console.log(`Time:   ${new Date().toISOString()}\n`)

  runCalculatorSelfCheck(push)

  const tenant = await prisma.tenant.findFirst({ where: { slug: TENANT_SLUG, deletedAt: null } })
  if (!tenant) fail(`Tenant not found: ${TENANT_SLUG}`)

  const nos = await ensureUom(tenant.id, 'NOS', 'Numbers')
  const category = await ensureCategory(tenant.id)
  const warehouse = await ensureWarehouse(tenant.id)
  const vendor = await ensureVendor(tenant.id)
  push('Masters', true, `wh=${warehouse.code} vendor=${vendor.code}`)

  const items: Array<{ plan: TolItemPlan; item: { id: string; code: string } }> = []
  for (const plan of TOL_ITEMS) {
    const item = await ensureTolItem(tenant.id, plan, nos.id, category.id)
    const pct = Number(item.receivingTolerancePercentage ?? 0)
    push(
      `Item ${plan.code}`,
      nearly(pct, plan.receivingTolerancePercentage),
      `id=${item.id.slice(0, 8)}… receivingTolerancePercentage=${pct}`,
    )
    items.push({ plan, item })
  }

  console.log('\n── Seeded items (open Item Master UI to verify) ──')
  for (const plan of TOL_ITEMS) {
    console.log(`  ${plan.code.padEnd(16)} tol=${plan.receivingTolerancePercentage}%  — ${plan.name}`)
  }
  console.log('')

  if (SEED_ONLY) {
    console.log('Seed-only complete. Create a PO with these items and receive GRN in the UI.\n')
    await prisma.$disconnect()
    process.exit(0)
  }

  let makerToken: string
  try {
    const maker = await login(MAKER_EMAIL, MAKER_PASSWORD)
    makerToken = maker.token
  } catch {
    const admin = await login(APPROVER_EMAIL, APPROVER_PASSWORD)
    makerToken = admin.token
    console.log(`  · maker login unavailable — using ${APPROVER_EMAIL}`)
  }
  const approver = await login(APPROVER_EMAIL, APPROVER_PASSWORD)
  push('Auth', true, `approver=${approver.email}`)

  const base = `/api/v1/t/${TENANT_SLUG}/purchase`
  const byCode = Object.fromEntries(items.map((i) => [i.plan.code, i]))

  // ── Scenario: 0% exact → no approval ─────────────────────────────────
  {
    const item = byCode['TOL-ITEM-0PCT']!
    const po = await createReleasedPo({
      base,
      makerToken,
      approverToken: approver.token,
      vendorId: vendor.id,
      warehouseId: warehouse.id,
      itemId: item.item.id,
      itemCode: item.plan.code,
      itemName: item.plan.name,
      uomId: nos.id,
      qty: 100,
      push,
    })
    const grn = await createGrn({
      base,
      token: makerToken,
      poId: po.poId,
      warehouseId: warehouse.id,
      lineId: po.lineId,
      receivedQty: 100,
    })
    if (grn.status !== 201) fail(`0% exact GRN create: ${grn.status} ${JSON.stringify(grn.body)}`)
    push(
      '0% exact create',
      grn.body.data.lines[0].toleranceStatus === 'OK',
      `status=${grn.body.data.lines[0].toleranceStatus} tol%=${grn.body.data.lines[0].tolerancePercentage}`,
    )
    const sub = await request(app)
      .post(`${base}/grns/${grn.body.data.id}/submit`)
      .set(auth(makerToken))
      .send({})
    if (sub.status !== 200) fail(`0% exact submit: ${sub.status} ${JSON.stringify(sub.body)}`)
    push(
      '0% exact submit',
      sub.body.data.status !== 'PENDING_TOLERANCE_APPROVAL',
      `grnStatus=${sub.body.data.status}`,
    )
  }

  // ── Scenario: 0% excess → pending → approve ──────────────────────────
  {
    const item = byCode['TOL-ITEM-0PCT']!
    const po = await createReleasedPo({
      base,
      makerToken,
      approverToken: approver.token,
      vendorId: vendor.id,
      warehouseId: warehouse.id,
      itemId: item.item.id,
      itemCode: item.plan.code,
      itemName: item.plan.name,
      uomId: nos.id,
      qty: 100,
      push,
    })
    const grn = await createGrn({
      base,
      token: makerToken,
      poId: po.poId,
      warehouseId: warehouse.id,
      lineId: po.lineId,
      receivedQty: 110,
    })
    if (grn.status !== 201) fail(`0% excess create: ${JSON.stringify(grn.body)}`)
    push(
      '0% excess create',
      grn.body.data.lines[0].toleranceStatus === 'EXCESS_OUTSIDE',
      `line=${grn.body.data.lines[0].toleranceStatus}`,
    )
    const sub = await request(app)
      .post(`${base}/grns/${grn.body.data.id}/submit`)
      .set(auth(makerToken))
      .send({})
    if (sub.status !== 200) fail(`0% excess submit: ${JSON.stringify(sub.body)}`)
    push(
      '0% excess → pending',
      sub.body.data.status === 'PENDING_TOLERANCE_APPROVAL',
      `grnStatus=${sub.body.data.status}`,
    )
    const appr = await request(app)
      .post(`${base}/grns/${grn.body.data.id}/approve-tolerance`)
      .set(auth(approver.token))
      .send({ remarks: 'E2E approve excess' })
    if (appr.status !== 200) fail(`approve-tolerance: ${JSON.stringify(appr.body)}`)
    push(
      '0% excess approve',
      appr.body.data.status !== 'PENDING_TOLERANCE_APPROVAL',
      `grnStatus=${appr.body.data.status}`,
    )
  }

  // ── Scenario: 10% within band (105) — no approval ────────────────────
  {
    const item = byCode['TOL-ITEM-10PCT']!
    const po = await createReleasedPo({
      base,
      makerToken,
      approverToken: approver.token,
      vendorId: vendor.id,
      warehouseId: warehouse.id,
      itemId: item.item.id,
      itemCode: item.plan.code,
      itemName: item.plan.name,
      uomId: nos.id,
      qty: 100,
      push,
    })
    const grn = await createGrn({
      base,
      token: makerToken,
      poId: po.poId,
      warehouseId: warehouse.id,
      lineId: po.lineId,
      receivedQty: 105,
    })
    if (grn.status !== 201) fail(`10% within create: ${JSON.stringify(grn.body)}`)
    push(
      '10% within create',
      grn.body.data.lines[0].toleranceStatus === 'EXCESS_WITHIN' ||
        grn.body.data.lines[0].toleranceStatus === 'OK',
      `line=${grn.body.data.lines[0].toleranceStatus} tol%=${grn.body.data.lines[0].tolerancePercentage}`,
    )
    const sub = await request(app)
      .post(`${base}/grns/${grn.body.data.id}/submit`)
      .set(auth(makerToken))
      .send({})
    if (sub.status !== 200) fail(`10% within submit: ${JSON.stringify(sub.body)}`)
    push(
      '10% within submit',
      sub.body.data.status !== 'PENDING_TOLERANCE_APPROVAL',
      `grnStatus=${sub.body.data.status}`,
    )
  }

  // ── Scenario: 10% outside (120) → reject → DRAFT ─────────────────────
  {
    const item = byCode['TOL-ITEM-10PCT']!
    const po = await createReleasedPo({
      base,
      makerToken,
      approverToken: approver.token,
      vendorId: vendor.id,
      warehouseId: warehouse.id,
      itemId: item.item.id,
      itemCode: item.plan.code,
      itemName: item.plan.name,
      uomId: nos.id,
      qty: 100,
      push,
    })
    const grn = await createGrn({
      base,
      token: makerToken,
      poId: po.poId,
      warehouseId: warehouse.id,
      lineId: po.lineId,
      receivedQty: 120,
    })
    if (grn.status !== 201) fail(`10% outside create: ${JSON.stringify(grn.body)}`)
    push(
      '10% outside create',
      grn.body.data.lines[0].toleranceStatus === 'EXCESS_OUTSIDE',
      `line=${grn.body.data.lines[0].toleranceStatus}`,
    )
    const sub = await request(app)
      .post(`${base}/grns/${grn.body.data.id}/submit`)
      .set(auth(makerToken))
      .send({})
    push(
      '10% outside → pending',
      sub.status === 200 && sub.body.data.status === 'PENDING_TOLERANCE_APPROVAL',
      `grnStatus=${sub.body.data?.status}`,
    )
    const rej = await request(app)
      .post(`${base}/grns/${grn.body.data.id}/reject-tolerance`)
      .set(auth(approver.token))
      .send({ remarks: 'E2E reject — correct qty' })
    if (rej.status !== 200) fail(`reject-tolerance: ${JSON.stringify(rej.body)}`)
    push('10% outside reject → DRAFT', rej.body.data.status === 'DRAFT', `grnStatus=${rej.body.data.status}`)
  }

  // ── Scenario: zero receive → NOT_RECEIVED ────────────────────────────
  {
    const item = byCode['TOL-ITEM-2PCT']!
    const po = await createReleasedPo({
      base,
      makerToken,
      approverToken: approver.token,
      vendorId: vendor.id,
      warehouseId: warehouse.id,
      itemId: item.item.id,
      itemCode: item.plan.code,
      itemName: item.plan.name,
      uomId: nos.id,
      qty: 100,
      push,
    })
    const grn = await createGrn({
      base,
      token: makerToken,
      poId: po.poId,
      warehouseId: warehouse.id,
      lineId: po.lineId,
      receivedQty: 0,
    })
    if (grn.status !== 201) fail(`zero receive create: ${JSON.stringify(grn.body)}`)
    push(
      'Zero receive NOT_RECEIVED',
      grn.body.data.lines[0].toleranceStatus === 'NOT_RECEIVED',
      `line=${grn.body.data.lines[0].toleranceStatus}`,
    )
    const poAfter = await prisma.purchaseOrderLine.findUnique({ where: { id: po.lineId } })
    push(
      'Zero receive PO open unchanged',
      nearly(Number(poAfter?.receivedQuantity ?? -1), 0),
      `poReceived=${poAfter?.receivedQuantity}`,
    )
  }

  // ── Scenario: 3-line PO, receive ONLY middle item (1 of 3) ───────────
  {
    const i0 = byCode['TOL-ITEM-0PCT']!
    const i2 = byCode['TOL-ITEM-2PCT']!
    const i10 = byCode['TOL-ITEM-10PCT']!
    const po = await createReleasedMultiLinePo({
      base,
      makerToken,
      approverToken: approver.token,
      vendorId: vendor.id,
      warehouseId: warehouse.id,
      uomId: nos.id,
      lines: [
        { itemId: i0.item.id, itemCode: i0.plan.code, itemName: i0.plan.name, qty: 100 },
        { itemId: i2.item.id, itemCode: i2.plan.code, itemName: i2.plan.name, qty: 100 },
        { itemId: i10.item.id, itemCode: i10.plan.code, itemName: i10.plan.name, qty: 100 },
      ],
      push,
    })
    push('3-line PO created', po.lines.length === 3, `lines=${po.lines.length}`)

    // Prefer create response order (0 / 2 / 10 pct items in that order).
    const line0 = po.lines[0]?.lineId
    const line2 = po.lines[1]?.lineId
    const line10 = po.lines[2]?.lineId
    if (!line0 || !line2 || !line10) fail(`Could not map 3 PO lines: ${JSON.stringify(po.lines)}`)

    const grn = await createMultiLineGrn({
      base,
      token: makerToken,
      poId: po.poId,
      warehouseId: warehouse.id,
      lines: [
        { lineId: line0, receivedQty: 0 },
        { lineId: line2, receivedQty: 100 },
        { lineId: line10, receivedQty: 0 },
      ],
    })
    if (grn.status !== 201) fail(`1-of-3 create: ${JSON.stringify(grn.body)}`)
    const gLines = grn.body.data.lines as Array<{
      toleranceStatus: string
      receivedQuantity: number
      purchaseOrderLineId: string
    }>
    const byPoLine = new Map(gLines.map((l) => [l.purchaseOrderLineId, l]))
    push(
      '1-of-3 statuses',
      byPoLine.get(line0)?.toleranceStatus === 'NOT_RECEIVED' &&
        byPoLine.get(line2)?.toleranceStatus === 'OK' &&
        byPoLine.get(line10)?.toleranceStatus === 'NOT_RECEIVED',
      `0=${byPoLine.get(line0)?.toleranceStatus} 2=${byPoLine.get(line2)?.toleranceStatus} 10=${byPoLine.get(line10)?.toleranceStatus}`,
    )
    const sub = await request(app)
      .post(`${base}/grns/${grn.body.data.id}/submit`)
      .set(auth(makerToken))
      .send({})
    push(
      '1-of-3 submit (no pending tol)',
      sub.status === 200 && sub.body.data.status !== 'PENDING_TOLERANCE_APPROVAL',
      `grnStatus=${sub.body.data?.status}`,
    )

    const poLine0 = await prisma.purchaseOrderLine.findUnique({ where: { id: line0 } })
    const poLine2 = await prisma.purchaseOrderLine.findUnique({ where: { id: line2 } })
    const poLine10 = await prisma.purchaseOrderLine.findUnique({ where: { id: line10 } })
    push(
      '1-of-3 PO open: only middle received',
      nearly(Number(poLine0?.receivedQuantity ?? -1), 0) &&
        nearly(Number(poLine2?.receivedQuantity ?? -1), 100) &&
        nearly(Number(poLine10?.receivedQuantity ?? -1), 0),
      `recv=[${poLine0?.receivedQuantity},${poLine2?.receivedQuantity},${poLine10?.receivedQuantity}]`,
    )
  }

  // ── Scenario: 3-line PO, receive only 0% item OUTSIDE → pending ──────
  {
    const i0 = byCode['TOL-ITEM-0PCT']!
    const i2 = byCode['TOL-ITEM-2PCT']!
    const i10 = byCode['TOL-ITEM-10PCT']!
    const po = await createReleasedMultiLinePo({
      base,
      makerToken,
      approverToken: approver.token,
      vendorId: vendor.id,
      warehouseId: warehouse.id,
      uomId: nos.id,
      lines: [
        { itemId: i0.item.id, itemCode: i0.plan.code, itemName: i0.plan.name, qty: 100 },
        { itemId: i2.item.id, itemCode: i2.plan.code, itemName: i2.plan.name, qty: 100 },
        { itemId: i10.item.id, itemCode: i10.plan.code, itemName: i10.plan.name, qty: 100 },
      ],
      push,
    })
    // Prefer create response order (stable); GET may omit code snapshot fields.
    const line0 = po.lines[0]?.lineId
    const line2 = po.lines[1]?.lineId
    const line10 = po.lines[2]?.lineId
    if (!line0 || !line2 || !line10) fail(`1-of-3 outside: missing line ids ${JSON.stringify(po.lines)}`)

    const grn = await createMultiLineGrn({
      base,
      token: makerToken,
      poId: po.poId,
      warehouseId: warehouse.id,
      lines: [
        { lineId: line0, receivedQty: 110 },
        { lineId: line2, receivedQty: 0 },
        { lineId: line10, receivedQty: 0 },
      ],
    })
    if (grn.status !== 201) fail(`1-of-3 outside create: ${JSON.stringify(grn.body)}`)
    const statuses = (grn.body.data.lines as Array<{ toleranceStatus: string }>).map(
      (l) => l.toleranceStatus,
    )
    push(
      '1-of-3 outside line',
      statuses.includes('EXCESS_OUTSIDE') &&
        statuses.filter((s) => s === 'NOT_RECEIVED').length === 2,
      `statuses=[${statuses.join(',')}]`,
    )
    const sub = await request(app)
      .post(`${base}/grns/${grn.body.data.id}/submit`)
      .set(auth(makerToken))
      .send({})
    push(
      '1-of-3 outside → pending',
      sub.status === 200 && sub.body.data.status === 'PENDING_TOLERANCE_APPROVAL',
      `grnStatus=${sub.body.data?.status}`,
    )
  }

  const failed = results.filter((r) => !r.ok)
  console.log('\n── Summary ──')
  console.log(`Passed: ${results.length - failed.length} / ${results.length}`)
  if (failed.length) {
    console.log('Failed steps:')
    for (const f of failed) console.log(`  ✗ ${f.step}: ${f.detail}`)
    process.exit(1)
  }
  console.log('\nAll GRN tolerance scenarios passed.\n')
  await prisma.$disconnect()
}

main().catch(async (err) => {
  console.error(err)
  await prisma.$disconnect().catch(() => {})
  process.exit(1)
})

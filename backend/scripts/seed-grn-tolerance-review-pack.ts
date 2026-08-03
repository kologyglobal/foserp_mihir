/**
 * Evening review pack — GRN receiving tolerance demo data.
 *
 * Seeds Item Master rows (0/1/2/5/10/15%), vendor, released POs, and GRNs
 * in demo-ready states so you can walk the UI without creating docs by hand.
 *
 * Usage (from backend/):
 *   npx tsx scripts/seed-grn-tolerance-review-pack.ts
 *   npm run seed:grn-tolerance-review
 *
 * Env: TENANT_SLUG, MAKER_EMAIL/PASSWORD, APPROVER_EMAIL/PASSWORD
 * Cheat sheet printed at end + docs/PURCHASE_GRN_TOLERANCE_REVIEW_DEMO.md
 */
import request from 'supertest'
import { createApp } from '../src/app.js'
import { prisma } from '../src/config/prisma.js'

const TENANT_SLUG = process.env.TENANT_SLUG ?? 'vasant-trailers'
const MAKER_EMAIL = process.env.MAKER_EMAIL ?? 'purchase@vasant-trailers.com'
const MAKER_PASSWORD = process.env.MAKER_PASSWORD ?? 'Purchase@123'
const APPROVER_EMAIL = process.env.APPROVER_EMAIL ?? 'admin@vasant-trailers.com'
const APPROVER_PASSWORD = process.env.APPROVER_PASSWORD ?? 'Admin@123'
const VENDOR_CODE = 'VND-TOL-01'
const WAREHOUSE_CODES = ['BO-MAIN', 'WH-RM-01', 'RM-MAIN', 'MAIN'] as const

const app = createApp()

type TolItemPlan = {
  code: string
  name: string
  receivingTolerancePercentage: number
  note: string
}

/** Rich set for Item Master filter / demo. */
const TOL_ITEMS: TolItemPlan[] = [
  {
    code: 'TOL-ITEM-0PCT',
    name: 'Tol Steel Plate — 0% (exact only)',
    receivingTolerancePercentage: 0,
    note: 'Any excess needs approval',
  },
  {
    code: 'TOL-ITEM-1PCT',
    name: 'Tol Precision Pin — 1%',
    receivingTolerancePercentage: 1,
    note: 'Tight count',
  },
  {
    code: 'TOL-ITEM-2PCT',
    name: 'Tol Channel Section — 2%',
    receivingTolerancePercentage: 2,
    note: 'Typical metals',
  },
  {
    code: 'TOL-ITEM-5PCT',
    name: 'Tol Fastener Kit — 5%',
    receivingTolerancePercentage: 5,
    note: 'Mid band',
  },
  {
    code: 'TOL-ITEM-10PCT',
    name: 'Tol Bulk Aggregate — 10%',
    receivingTolerancePercentage: 10,
    note: 'Loose / bulk',
  },
  {
    code: 'TOL-ITEM-15PCT',
    name: 'Tol Scrap Bundle — 15%',
    receivingTolerancePercentage: 15,
    note: 'Wide band',
  },
]

type CheatRow = { kind: string; ref: string; tip: string }

function fail(msg: string): never {
  console.error(`\n✗ FATAL: ${msg}`)
  process.exit(1)
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
  return { token: res.body.data.accessToken as string, email }
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
      data: {
        status: 'ACTIVE',
        deletedAt: null,
        isBlocked: false,
        name: 'Tolerance Review Vendor Pvt Ltd',
      },
    })
  }
  return prisma.masterVendor.create({
    data: {
      tenantId,
      code: VENDOR_CODE,
      name: 'Tolerance Review Vendor Pvt Ltd',
      city: 'Pune',
      state: 'Maharashtra',
      contactPerson: 'Review Demo',
      contactPhone: '9876501888',
      email: 'tol-review@vendor.example',
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
  if (!any) fail('No ACTIVE warehouse — seed warehouses first')
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
    itemDescription: `${plan.name} — ${plan.note}`,
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
) {
  let status = 'DRAFT'
  const get = await request(app).get(`${base}/orders/${poId}`).set(auth(makerToken))
  status = String(get.body.data?.status ?? 'DRAFT')

  if (status === 'DRAFT') {
    const sub = await request(app).post(`${base}/orders/${poId}/submit`).set(auth(makerToken)).send({})
    if (sub.status !== 200) fail(`PO submit: ${JSON.stringify(sub.body)}`)
    status = String(sub.body.data.status)
  }
  if (status === 'PENDING_APPROVAL') {
    const appr = await request(app)
      .post(`${base}/orders/${poId}/approve`)
      .set(auth(approverToken))
      .send({})
    if (appr.status !== 200) fail(`PO approve: ${JSON.stringify(appr.body)}`)
    status = String(appr.body.data.status)
  }
  // Approve already releases PO (status SENT_TO_VENDOR) — skip redundant send-to-vendor.
  if (['SENT_TO_VENDOR', 'PARTIALLY_RECEIVED', 'FULLY_RECEIVED'].includes(status)) {
    return status
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
    if (send2.status !== 200) fail(`PO send: ${JSON.stringify(send2.body)}`)
    return String(send2.body.data.status)
  }
  return String(send.body.data.status)
}

async function createReleasedPo(opts: {
  base: string
  makerToken: string
  approverToken: string
  vendorId: string
  warehouseId: string
  uomId: string
  tag: string
  lines: Array<{ itemId: string; itemCode: string; itemName: string; qty: number }>
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
      remarks: `REVIEW-PACK ${opts.tag}`,
      lines: opts.lines.map((l) => ({
        itemId: l.itemId,
        itemCode: l.itemCode,
        itemName: l.itemName,
        uomQuantity: l.qty,
        uomConversionFactor: 1,
        uomId: opts.uomId,
        rate: 25,
        requiredDate,
      })),
    })
  if (create.status !== 201) fail(`PO create [${opts.tag}]: ${JSON.stringify(create.body)}`)
  const poId = create.body.data.id as string
  const orderNumber = String(create.body.data.orderNumber ?? poId)
  const lines = (create.body.data.lines as Array<{ id: string }>).map((l, i) => ({
    lineId: l.id,
    itemCode: opts.lines[i]!.itemCode,
    qty: opts.lines[i]!.qty,
  }))
  await releasePo(opts.base, poId, opts.makerToken, opts.approverToken)
  return { poId, orderNumber, lines }
}

async function createGrn(opts: {
  base: string
  token: string
  poId: string
  warehouseId: string
  tag: string
  lines: Array<{ lineId: string; receivedQty: number; closeOpenQuantity?: boolean }>
}) {
  const today = new Date().toISOString().slice(0, 10)
  const res = await request(app)
    .post(`${opts.base}/grns`)
    .set(auth(opts.token))
    .send({
      purchaseOrderId: opts.poId,
      receiptDate: today,
      warehouseId: opts.warehouseId,
      vendorChallanNumber: `REV-${opts.tag}-${Date.now().toString().slice(-6)}`,
      remarks: `REVIEW-PACK ${opts.tag}`,
      inspectionRequired: false,
      lines: opts.lines.map((l) => ({
        purchaseOrderLineId: l.lineId,
        receivedQuantity: l.receivedQty,
        closeOpenQuantity: Boolean(l.closeOpenQuantity),
        qcRequired: false,
      })),
    })
  if (res.status !== 201) fail(`GRN create [${opts.tag}]: ${JSON.stringify(res.body)}`)
  return {
    id: res.body.data.id as string,
    number: String(res.body.data.grnNumber ?? res.body.data.documentNumber ?? res.body.data.id),
    status: String(res.body.data.status),
    lines: res.body.data.lines as Array<{
      toleranceStatus: string
      receivedQuantity: number
      purchaseOrderLineId: string
    }>,
  }
}

async function main() {
  const cheat: CheatRow[] = []

  console.log('\n╔══════════════════════════════════════════════════════════════╗')
  console.log('║  GRN Tolerance — Evening Review Pack                        ║')
  console.log('╚══════════════════════════════════════════════════════════════╝')
  console.log(`Tenant: ${TENANT_SLUG}`)
  console.log(`Time:   ${new Date().toISOString()}\n`)

  const tenant = await prisma.tenant.findFirst({ where: { slug: TENANT_SLUG, deletedAt: null } })
  if (!tenant) fail(`Tenant not found: ${TENANT_SLUG}`)

  const nos = await ensureUom(tenant.id, 'NOS', 'Numbers')
  const category = await ensureCategory(tenant.id)
  const warehouse = await ensureWarehouse(tenant.id)
  const vendor = await ensureVendor(tenant.id)

  console.log(`✓ Masters  vendor=${vendor.code}  wh=${warehouse.code}`)

  const byCode: Record<string, { plan: TolItemPlan; item: { id: string; code: string; name: string } }> =
    {}
  console.log('\n── Item Master (open /masters/items, filter TOL-ITEM) ──')
  for (const plan of TOL_ITEMS) {
    const item = await ensureTolItem(tenant.id, plan, nos.id, category.id)
    byCode[plan.code] = { plan, item: { id: item.id, code: item.code, name: item.name } }
    console.log(
      `  ${plan.code.padEnd(16)} tol=${String(plan.receivingTolerancePercentage).padStart(2)}%  ${plan.note}`,
    )
    cheat.push({
      kind: 'Item',
      ref: plan.code,
      tip: `${plan.receivingTolerancePercentage}% — ${plan.note}`,
    })
  }

  let makerToken: string
  try {
    makerToken = (await login(MAKER_EMAIL, MAKER_PASSWORD)).token
  } catch {
    makerToken = (await login(APPROVER_EMAIL, APPROVER_PASSWORD)).token
    console.log(`  · using ${APPROVER_EMAIL} as maker`)
  }
  const approver = await login(APPROVER_EMAIL, APPROVER_PASSWORD)
  const base = `/api/v1/t/${TENANT_SLUG}/purchase`

  const lineOf = (code: string, qty: number) => {
    const row = byCode[code]
    if (!row) fail(`Missing item ${code}`)
    return {
      itemId: row.item.id,
      itemCode: row.item.code,
      itemName: row.item.name,
      qty,
    }
  }

  console.log('\n── Released POs (ready for New GRN) ──')

  // PO-A: 3 mixed tol items — ideal for "receive 1 of 3" live demo
  const poA = await createReleasedPo({
    base,
    makerToken,
    approverToken: approver.token,
    vendorId: vendor.id,
    warehouseId: warehouse.id,
    uomId: nos.id,
    tag: 'PO-A 3-line open (demo 1-of-3)',
    lines: [
      lineOf('TOL-ITEM-0PCT', 100),
      lineOf('TOL-ITEM-2PCT', 100),
      lineOf('TOL-ITEM-10PCT', 100),
    ],
  })
  console.log(`  ✓ ${poA.orderNumber}  3 lines open (0% / 2% / 10%) — receive only one in UI`)
  cheat.push({
    kind: 'PO open',
    ref: poA.orderNumber,
    tip: 'New GRN → set 100 on one line, 0 on others (1-of-3)',
  })

  // PO-B: single 0% — for exact vs excess live
  const poB = await createReleasedPo({
    base,
    makerToken,
    approverToken: approver.token,
    vendorId: vendor.id,
    warehouseId: warehouse.id,
    uomId: nos.id,
    tag: 'PO-B 0% single open',
    lines: [lineOf('TOL-ITEM-0PCT', 50)],
  })
  console.log(`  ✓ ${poB.orderNumber}  single 0% qty 50 — try receive 50 vs 55`)
  cheat.push({
    kind: 'PO open',
    ref: poB.orderNumber,
    tip: 'Receive 50 = OK; receive 55 = Pending Tolerance Approval',
  })

  // PO-C: 10% + 5% + 1% — more variety
  const poC = await createReleasedPo({
    base,
    makerToken,
    approverToken: approver.token,
    vendorId: vendor.id,
    warehouseId: warehouse.id,
    uomId: nos.id,
    tag: 'PO-C wide mix open',
    lines: [
      lineOf('TOL-ITEM-1PCT', 200),
      lineOf('TOL-ITEM-5PCT', 80),
      lineOf('TOL-ITEM-15PCT', 40),
    ],
  })
  console.log(`  ✓ ${poC.orderNumber}  1% / 5% / 15% mix still open`)
  cheat.push({
    kind: 'PO open',
    ref: poC.orderNumber,
    tip: 'Show different Tol % columns side by side',
  })

  console.log('\n── Pre-built GRNs (list / detail / approvals) ──')

  // GRN-1: posted exact on 2% item only (1-of-3 already done)
  {
    const po = await createReleasedPo({
      base,
      makerToken,
      approverToken: approver.token,
      vendorId: vendor.id,
      warehouseId: warehouse.id,
      uomId: nos.id,
      tag: 'PO for GRN posted 1-of-3',
      lines: [
        lineOf('TOL-ITEM-0PCT', 100),
        lineOf('TOL-ITEM-2PCT', 100),
        lineOf('TOL-ITEM-10PCT', 100),
      ],
    })
    const grn = await createGrn({
      base,
      token: makerToken,
      poId: po.poId,
      warehouseId: warehouse.id,
      tag: 'POSTED-1OF3',
      lines: [
        { lineId: po.lines[0]!.lineId, receivedQty: 0 },
        { lineId: po.lines[1]!.lineId, receivedQty: 100 },
        { lineId: po.lines[2]!.lineId, receivedQty: 0 },
      ],
    })
    const sub = await request(app)
      .post(`${base}/grns/${grn.id}/submit`)
      .set(auth(makerToken))
      .send({})
    if (sub.status !== 200) fail(`Submit posted 1-of-3: ${JSON.stringify(sub.body)}`)
    const status = String(sub.body.data.status)
    console.log(`  ✓ GRN ${grn.number}  ${status}  (1-of-3 middle only; PO ${po.orderNumber})`)
    cheat.push({
      kind: 'GRN posted',
      ref: grn.number,
      tip: `1-of-3 done — PO ${po.orderNumber} still open on 0% & 10% lines`,
    })
  }

  // GRN-2: pending tolerance (0% excess) — approvals queue
  {
    const po = await createReleasedPo({
      base,
      makerToken,
      approverToken: approver.token,
      vendorId: vendor.id,
      warehouseId: warehouse.id,
      uomId: nos.id,
      tag: 'PO for pending tol',
      lines: [lineOf('TOL-ITEM-0PCT', 100)],
    })
    const grn = await createGrn({
      base,
      token: makerToken,
      poId: po.poId,
      warehouseId: warehouse.id,
      tag: 'PENDING-TOL',
      lines: [{ lineId: po.lines[0]!.lineId, receivedQty: 112 }],
    })
    const sub = await request(app)
      .post(`${base}/grns/${grn.id}/submit`)
      .set(auth(makerToken))
      .send({})
    if (sub.status !== 200) fail(`Submit pending: ${JSON.stringify(sub.body)}`)
    const status = String(sub.body.data.status)
    console.log(`  ✓ GRN ${grn.number}  ${status}  (0% +12% — Approve/Reject in UI)`)
    cheat.push({
      kind: 'GRN pending',
      ref: grn.number,
      tip: 'Approvals queue OR GRN detail → Approve / Reject Tolerance',
    })
  }

  // GRN-3: draft with mixed lines ready to edit
  {
    const po = await createReleasedPo({
      base,
      makerToken,
      approverToken: approver.token,
      vendorId: vendor.id,
      warehouseId: warehouse.id,
      uomId: nos.id,
      tag: 'PO for draft GRN',
      lines: [
        lineOf('TOL-ITEM-5PCT', 100),
        lineOf('TOL-ITEM-10PCT', 100),
      ],
    })
    const grn = await createGrn({
      base,
      token: makerToken,
      poId: po.poId,
      warehouseId: warehouse.id,
      tag: 'DRAFT-MIX',
      lines: [
        { lineId: po.lines[0]!.lineId, receivedQty: 103 },
        { lineId: po.lines[1]!.lineId, receivedQty: 0 },
      ],
    })
    console.log(
      `  ✓ GRN ${grn.number}  ${grn.status}  (5% within + 10% not received — edit before submit)`,
    )
    cheat.push({
      kind: 'GRN draft',
      ref: grn.number,
      tip: 'Open editor — show Tol%/Var%/Status; change qty then submit',
    })
  }

  // GRN-4: posted within 10% excess
  {
    const po = await createReleasedPo({
      base,
      makerToken,
      approverToken: approver.token,
      vendorId: vendor.id,
      warehouseId: warehouse.id,
      uomId: nos.id,
      tag: 'PO for within band',
      lines: [lineOf('TOL-ITEM-10PCT', 100)],
    })
    const grn = await createGrn({
      base,
      token: makerToken,
      poId: po.poId,
      warehouseId: warehouse.id,
      tag: 'POSTED-WITHIN',
      lines: [{ lineId: po.lines[0]!.lineId, receivedQty: 105 }],
    })
    const sub = await request(app)
      .post(`${base}/grns/${grn.id}/submit`)
      .set(auth(makerToken))
      .send({})
    if (sub.status !== 200) fail(`Submit within: ${JSON.stringify(sub.body)}`)
    console.log(`  ✓ GRN ${grn.number}  ${sub.body.data.status}  (10% item +5% EXCESS_WITHIN, no approval)`)
    cheat.push({
      kind: 'GRN posted',
      ref: grn.number,
      tip: 'Excess within band — posted without tolerance approval',
    })
  }

  // GRN-5: pending from 1-of-3 where the one received is outside
  {
    const po = await createReleasedPo({
      base,
      makerToken,
      approverToken: approver.token,
      vendorId: vendor.id,
      warehouseId: warehouse.id,
      uomId: nos.id,
      tag: 'PO for 1-of-3 pending',
      lines: [
        lineOf('TOL-ITEM-0PCT', 100),
        lineOf('TOL-ITEM-2PCT', 100),
        lineOf('TOL-ITEM-15PCT', 100),
      ],
    })
    const grn = await createGrn({
      base,
      token: makerToken,
      poId: po.poId,
      warehouseId: warehouse.id,
      tag: 'PENDING-1OF3',
      lines: [
        { lineId: po.lines[0]!.lineId, receivedQty: 0 },
        { lineId: po.lines[1]!.lineId, receivedQty: 108 },
        { lineId: po.lines[2]!.lineId, receivedQty: 0 },
      ],
    })
    const sub = await request(app)
      .post(`${base}/grns/${grn.id}/submit`)
      .set(auth(makerToken))
      .send({})
    if (sub.status !== 200) fail(`Submit 1-of-3 pending: ${JSON.stringify(sub.body)}`)
    console.log(
      `  ✓ GRN ${grn.number}  ${sub.body.data.status}  (only 2% line +8% outside; others not received)`,
    )
    cheat.push({
      kind: 'GRN pending',
      ref: grn.number,
      tip: '1-of-3 + outside — prove header pending even if other lines are zero',
    })
  }

  console.log('\n══════════════════════════════════════════════════════════════')
  console.log('  EVENING REVIEW CHEAT SHEET — filter remarks REVIEW-PACK')
  console.log('══════════════════════════════════════════════════════════════')
  console.log(`  Vendor: ${VENDOR_CODE}  (${vendor.name})`)
  console.log(`  Warehouse: ${warehouse.code}`)
  console.log('')
  for (const row of cheat) {
    console.log(`  [${row.kind.padEnd(11)}]  ${row.ref.padEnd(18)}  ${row.tip}`)
  }
  console.log('')
  console.log('  Suggested 8-min walkthrough:')
  console.log('  1. Item Master → TOL-ITEM-* → Receiving tolerance %')
  console.log(`  2. PO ${poA.orderNumber} → New GRN → receive 1 of 3 live`)
  console.log('  3. Open a Pending GRN → Approve / Reject Tolerance')
  console.log('  4. Approvals queue → GOODS_RECEIPT rows')
  console.log('  5. Posted 1-of-3 GRN → Print PDF (dual UOM / A4)')
  console.log('  6. Re-open PO after 1-of-3 → remaining lines still pending')
  console.log('══════════════════════════════════════════════════════════════\n')

  await prisma.$disconnect()
}

main().catch(async (err) => {
  console.error(err)
  await prisma.$disconnect().catch(() => {})
  process.exit(1)
})

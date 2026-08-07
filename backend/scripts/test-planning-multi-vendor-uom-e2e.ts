/**
 * E2E: PR (8 lines, single + multi-UOM) → planning (no RFQ) → 3 POs (3 vendors) →
 * GRN (partial) → QC (partial accept/reject) → purchase return.
 *
 * Prints UI links for manual verification.
 *
 * Usage (backend/):
 *   npx tsx scripts/test-planning-multi-vendor-uom-e2e.ts
 *
 * Env:
 *   TENANT_SLUG          default vasant-trailers
 *   UI_BASE              default http://localhost:5173
 *   MAKER_EMAIL / MAKER_PASSWORD
 *   APPROVER_EMAIL / APPROVER_PASSWORD
 */
import request from 'supertest'
import { createApp } from '../src/app.js'
import { prisma } from '../src/config/prisma.js'

const TENANT_SLUG = process.env.TENANT_SLUG ?? 'vasant-trailers'
const UI_BASE = (process.env.UI_BASE ?? 'http://localhost:5173').replace(/\/$/, '')
const MAKER_EMAIL = process.env.MAKER_EMAIL ?? 'purchase@vasant-trailers.com'
const MAKER_PASSWORD = process.env.MAKER_PASSWORD ?? 'Purchase@123'
const APPROVER_EMAIL = process.env.APPROVER_EMAIL ?? 'admin@vasant-trailers.com'
const APPROVER_PASSWORD = process.env.APPROVER_PASSWORD ?? 'Admin@123'

const VENDOR_CODES = ['VEND-0001', 'VEND-0004', 'VND-MUOM-01'] as const
const WAREHOUSE_CODES = ['BO-MAIN', 'WH-RM-01', 'RM-MAIN'] as const

const app = createApp()

type DocLink = {
  kind: string
  number: string
  id: string
  url: string
  note?: string
}

type PrLineSpec = {
  itemCode: string
  requiredQty: number
  rate: number
  vendorCode: (typeof VENDOR_CODES)[number]
  /** Primary qty label for logs */
  label?: string
}

const PR_LINES: PrLineSpec[] = [
  { itemCode: 'TOL-ITEM-2PCT', requiredQty: 100, rate: 15, vendorCode: 'VEND-0001' },
  { itemCode: 'RM-BRACKET-TEST', requiredQty: 40, rate: 25, vendorCode: 'VEND-0001' },
  { itemCode: 'PIPE-MUOM-MTR', requiredQty: 10, rate: 30, vendorCode: 'VEND-0001', label: '10 NOS (30 MTR)' },
  { itemCode: 'BO-DRAIN-VALVE-DN25', requiredQty: 25, rate: 120, vendorCode: 'VEND-0004' },
  { itemCode: 'TOL-ITEM-5PCT', requiredQty: 50, rate: 10, vendorCode: 'VEND-0004' },
  { itemCode: 'MS-PIPE-DN25-KG', requiredQty: 8, rate: 55, vendorCode: 'VEND-0004', label: '8 NOS (KG purchase)' },
  { itemCode: 'BOLT-MUOM-NOS', requiredQty: 25, rate: 4, vendorCode: 'VND-MUOM-01' },
  { itemCode: 'ROD-MUOM-KG', requiredQty: 20, rate: 2, vendorCode: 'VND-MUOM-01', label: '20 NOS (1000 KG)' },
]

function fail(msg: string): never {
  console.error(`\n✗ ${msg}`)
  process.exit(1)
}

function auth(token: string) {
  return { Authorization: `Bearer ${token}` }
}

function link(path: string) {
  return `${UI_BASE}${path}`
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
  if (!any) fail('No ACTIVE warehouse found')
  return any
}

async function ensureMuomItems(tenantId: string) {
  const nos = await prisma.masterUom.findFirst({ where: { tenantId, code: 'NOS', deletedAt: null } })
  const mtr = await prisma.masterUom.findFirst({
    where: { tenantId, code: { in: ['MTR', 'METER', 'M'] }, deletedAt: null },
  })
  const kg = await prisma.masterUom.findFirst({ where: { tenantId, code: 'KG', deletedAt: null } })
  if (!nos || !mtr || !kg) fail('NOS/MTR/KG UOM masters missing')

  const category =
    (await prisma.masterItemCategory.findFirst({
      where: { tenantId, deletedAt: null, status: 'ACTIVE' },
      orderBy: { createdAt: 'asc' },
    })) ??
    (await prisma.masterItemCategory.create({
      data: {
        tenantId,
        code: 'MUOM-RM',
        name: 'MUOM Raw Material',
        stockPolicy: 'REQUIRED',
        defaultIsStockable: true,
        defaultInventoryType: 'inventory',
        status: 'ACTIVE',
      },
    }))

  const specs = [
    { code: 'PIPE-MUOM-MTR', name: 'MUOM Test Pipe (Meter)', purchaseUomId: mtr.id, factor: 3 },
    { code: 'ROD-MUOM-KG', name: 'MUOM Test Rod (Kilogram)', purchaseUomId: kg.id, factor: 50 },
    { code: 'BOLT-MUOM-NOS', name: 'MUOM Test Bolt (NOS 1:1)', purchaseUomId: nos.id, factor: 1 },
  ] as const

  for (const spec of specs) {
    const existing = await prisma.masterItem.findFirst({
      where: { tenantId, code: spec.code, deletedAt: null },
    })
    const data = {
      name: spec.name,
      itemDescription: spec.name,
      categoryId: category.id,
      baseUomId: nos.id,
      purchaseUomId: spec.purchaseUomId,
      uomConversionFactor: spec.factor,
      purchaseQtyPerUom: spec.factor,
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
      await prisma.masterItem.update({ where: { id: existing.id }, data })
    } else {
      await prisma.masterItem.create({ data: { tenantId, code: spec.code, ...data } })
    }
  }
}

async function releasePo(
  base: string,
  poId: string,
  makerToken: string,
  approverToken: string,
) {
  let po = await prisma.purchaseOrder.findUniqueOrThrow({ where: { id: poId } })
  if (po.status === 'DRAFT') {
    const sub = await request(app).post(`${base}/orders/${poId}/submit`).set(auth(makerToken)).send({})
    if (sub.status !== 200) fail(`PO submit failed: ${sub.status} ${JSON.stringify(sub.body)}`)
    po = await prisma.purchaseOrder.findUniqueOrThrow({ where: { id: poId } })
  }
  if (po.status === 'PENDING_APPROVAL') {
    const appr = await request(app).post(`${base}/orders/${poId}/approve`).set(auth(approverToken)).send({})
    if (appr.status !== 200) fail(`PO approve failed: ${appr.status} ${JSON.stringify(appr.body)}`)
    po = await prisma.purchaseOrder.findUniqueOrThrow({ where: { id: poId } })
  }
  if (po.status !== 'SENT_TO_VENDOR' && po.status !== 'RELEASED') {
    let send = await request(app).post(`${base}/orders/${poId}/send-to-vendor`).set(auth(makerToken)).send({})
    if (send.status !== 200) {
      send = await request(app)
        .post(`${base}/orders/${poId}/send-to-vendor`)
        .set(auth(approverToken))
        .send({})
    }
    if (send.status !== 200) {
      fail(`PO send-to-vendor failed: ${send.status} ${JSON.stringify(send.body)}`)
    }
  }
}

async function main() {
  const links: DocLink[] = []
  const stamp = Date.now()

  console.log(`\n=== Planning → 3 PO → GRN → QC → Return E2E (${TENANT_SLUG}) ===\n`)

  const tenant = await prisma.tenant.findFirst({ where: { slug: TENANT_SLUG, deletedAt: null } })
  if (!tenant) fail(`Tenant not found: ${TENANT_SLUG}`)

  await ensureMuomItems(tenant.id)
  const warehouse = await ensureWarehouse(tenant.id)

  const department = await prisma.crmMaster.findFirst({
    where: { tenantId: tenant.id, kind: 'departments', code: 'purchase', deletedAt: null },
  })
  if (!department) fail('CRM department "purchase" missing')

  const vendors = new Map<string, { id: string; code: string; name: string }>()
  for (const code of VENDOR_CODES) {
    const v = await prisma.masterVendor.findFirst({
      where: { tenantId: tenant.id, code, deletedAt: null, status: 'ACTIVE' },
    })
    if (!v) fail(`Vendor ${code} missing`)
    vendors.set(code, { id: v.id, code: v.code, name: v.name })
  }

  const itemByCode = new Map<string, Awaited<ReturnType<typeof prisma.masterItem.findFirst>> & object>()
  for (const spec of PR_LINES) {
    const item = await prisma.masterItem.findFirst({
      where: { tenantId: tenant.id, code: spec.itemCode, deletedAt: null, status: 'ACTIVE' },
      include: { baseUom: true, purchaseUom: true },
    })
    if (!item) fail(`Item ${spec.itemCode} missing — seed masters first`)
    itemByCode.set(spec.itemCode, item)
  }

  const maker = await login(MAKER_EMAIL, MAKER_PASSWORD)
  const approver = await login(APPROVER_EMAIL, APPROVER_PASSWORD)
  const base = `/api/v1/t/${TENANT_SLUG}/purchase`
  const today = new Date().toISOString().slice(0, 10)
  const requiredDate = new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10)

  // ── 1. Create PR (8 lines, rfqRequired=false) ───────────────────────────
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
      remarks: `Multi-vendor UOM E2E ${stamp}`,
      lines: PR_LINES.map((spec) => {
        const item = itemByCode.get(spec.itemCode)!
        return {
          itemId: item.id,
          itemCode: item.code,
          itemName: item.name,
          requiredQuantity: spec.requiredQty,
          uomId: item.baseUomId,
          estimatedRate: spec.rate,
          requiredDate,
          warehouseId: warehouse.id,
        }
      }),
    })
  if (prCreate.status !== 201) {
    fail(`PR create failed: ${prCreate.status} ${JSON.stringify(prCreate.body)}`)
  }
  const prId = prCreate.body.data.id as string
  const prNumber = prCreate.body.data.requisitionNumber as string
  links.push({
    kind: 'Purchase Requisition',
    number: prNumber,
    id: prId,
    url: link(`/purchase/requisitions/${prId}`),
  })
  console.log(`✓ PR ${prNumber}`)

  // ── 2. Submit + approve PR ──────────────────────────────────────────────
  const prSubmit = await request(app)
    .post(`${base}/requisitions/${prId}/submit`)
    .set(auth(maker.token))
    .send({ remarks: 'Submit for planning' })
  if (prSubmit.status !== 200) fail(`PR submit failed: ${prSubmit.status}`)

  const prApprove = await request(app)
    .post(`${base}/requisitions/${prId}/approve`)
    .set(auth(approver.token))
    .send({ remarks: 'Approved — no RFQ' })
  if (prApprove.status !== 200) fail(`PR approve failed: ${prApprove.status}`)

  links.push({
    kind: 'Planning Sheet',
    number: '(register)',
    id: prId,
    url: link('/purchase/planning-sheet'),
    note: `Filter PR ${prNumber}`,
  })

  // ── 3. Planning: assign 3 vendors + approve ─────────────────────────────
  const planningRows = await prisma.purchasePlanningRow.findMany({
    where: { tenantId: tenant.id, purchaseRequisitionId: prId, deletedAt: null },
    orderBy: { planningNumber: 'asc' },
  })
  if (planningRows.length !== PR_LINES.length) {
    fail(`Expected ${PR_LINES.length} planning rows, got ${planningRows.length}`)
  }

  const rowByItemCode = new Map<string, (typeof planningRows)[0]>()
  for (const row of planningRows) {
    const spec = PR_LINES.find((s) => s.itemCode === row.itemCodeSnapshot)
    if (spec) rowByItemCode.set(spec.itemCode, row)
  }

  for (const vendorCode of VENDOR_CODES) {
    const rowIds = PR_LINES.filter((l) => l.vendorCode === vendorCode)
      .map((l) => rowByItemCode.get(l.itemCode)?.id)
      .filter(Boolean) as string[]
    const vendor = vendors.get(vendorCode)!
    const avgRate =
      PR_LINES.filter((l) => l.vendorCode === vendorCode).reduce((s, l) => s + l.rate, 0) /
      rowIds.length
    const sel = await request(app)
      .post(`${base}/planning-sheet/bulk-select-vendor`)
      .set(auth(maker.token))
      .send({ rowIds, vendorId: vendor.id, expectedRate: avgRate, negotiatedRate: avgRate })
    if (![200, 201].includes(sel.status)) {
      fail(`Select vendor ${vendorCode} failed: ${sel.status} ${JSON.stringify(sel.body)}`)
    }
  }

  const allRowIds = planningRows.map((r) => r.id)
  let bulkStatus = await request(app)
    .post(`${base}/planning-sheet/bulk-status`)
    .set(auth(approver.token))
    .send({ rowIds: allRowIds, status: 'APPROVED' })
  if (![200, 201].includes(bulkStatus.status)) {
    bulkStatus = await request(app)
      .post(`${base}/planning-sheet/bulk-status`)
      .set(auth(maker.token))
      .send({ rowIds: allRowIds, status: 'APPROVED' })
  }
  if (![200, 201].includes(bulkStatus.status)) {
    fail(`Planning approve failed: ${bulkStatus.status}`)
  }

  // Different PO qty per line (partial vs PR)
  const orderQuantities: Record<string, number> = {}
  const orderPct: Record<string, number> = {
    'TOL-ITEM-2PCT': 0.8,
    'RM-BRACKET-TEST': 0.75,
    'PIPE-MUOM-MTR': 0.9,
    'BO-DRAIN-VALVE-DN25': 1,
    'TOL-ITEM-5PCT': 0.6,
    'MS-PIPE-DN25-KG': 0.5,
    'BOLT-MUOM-NOS': 1,
    'ROD-MUOM-KG': 0.8,
  }
  for (const spec of PR_LINES) {
    const row = rowByItemCode.get(spec.itemCode)!
    orderQuantities[row.id] = Math.max(1, Math.floor(spec.requiredQty * (orderPct[spec.itemCode] ?? 1)))
  }

  const createPo = await request(app)
    .post(`${base}/planning-sheet/create-po`)
    .set(auth(maker.token))
    .send({ rowIds: allRowIds, deliveryWarehouseId: warehouse.id, orderQuantities })
  if (createPo.status !== 201) {
    fail(`Create PO failed: ${createPo.status} ${JSON.stringify(createPo.body)}`)
  }

  const ordersDto = (createPo.body.data.orders ?? []) as Array<{
    id: string
    orderNumber: string
    vendorId: string
  }>
  if (ordersDto.length !== 3) {
    fail(`Expected 3 POs, got ${ordersDto.length}: ${JSON.stringify(ordersDto.map((o) => o.orderNumber))}`)
  }

  for (const o of ordersDto) {
    const vendor = [...vendors.values()].find((v) => v.id === o.vendorId)
    links.push({
      kind: 'Purchase Order',
      number: o.orderNumber,
      id: o.id,
      url: link(`/purchase/orders/${o.id}`),
      note: vendor?.name,
    })
    await releasePo(base, o.id, maker.token, approver.token)
    console.log(`✓ PO ${o.orderNumber} released (${vendor?.code})`)
  }

  // ── 4. GRNs (partial receipts, QC on drain valve PO) ────────────────────
  type GrnPlan = {
    poId: string
    poNumber: string
    vendorCode: string
    inspectionRequired?: boolean
    lineReceipts: Array<{
      itemCode: string
      /** Fraction of PO open qty to receive (primary or uom depending on item) */
      receivePct: number
      qcRequired?: boolean
    }>
  }

  const poByVendor = new Map<string, { id: string; orderNumber: string }>()
  for (const o of ordersDto) {
    const vendor = [...vendors.entries()].find(([, v]) => v.id === o.vendorId)?.[0]
    if (vendor) poByVendor.set(vendor, { id: o.id, orderNumber: o.orderNumber })
  }

  const grnPlans: GrnPlan[] = [
    {
      poId: poByVendor.get('VEND-0001')!.id,
      poNumber: poByVendor.get('VEND-0001')!.orderNumber,
      vendorCode: 'VEND-0001',
      lineReceipts: [
        { itemCode: 'TOL-ITEM-2PCT', receivePct: 0.5 },
        { itemCode: 'RM-BRACKET-TEST', receivePct: 1 },
        { itemCode: 'PIPE-MUOM-MTR', receivePct: 0.8 },
      ],
    },
    {
      poId: poByVendor.get('VEND-0004')!.id,
      poNumber: poByVendor.get('VEND-0004')!.orderNumber,
      vendorCode: 'VEND-0004',
      inspectionRequired: true,
      lineReceipts: [
        { itemCode: 'BO-DRAIN-VALVE-DN25', receivePct: 1, qcRequired: true },
        { itemCode: 'TOL-ITEM-5PCT', receivePct: 0.5, qcRequired: false },
        { itemCode: 'MS-PIPE-DN25-KG', receivePct: 1, qcRequired: false },
      ],
    },
    {
      poId: poByVendor.get('VND-MUOM-01')!.id,
      poNumber: poByVendor.get('VND-MUOM-01')!.orderNumber,
      vendorCode: 'VND-MUOM-01',
      lineReceipts: [
        { itemCode: 'BOLT-MUOM-NOS', receivePct: 1 },
        { itemCode: 'ROD-MUOM-KG', receivePct: 0.6 },
      ],
    },
  ]

  let qcGrnId: string | null = null
  let qcGrnLineId: string | null = null
  let qcPoId: string | null = null
  let qcPoLineId: string | null = null
  let qcVendorId: string | null = null

  for (const plan of grnPlans) {
    const poDb = await prisma.purchaseOrder.findUniqueOrThrow({
      where: { id: plan.poId },
      include: { lines: true },
    })

    const grnLines: Array<Record<string, unknown>> = []
    for (const lr of plan.lineReceipts) {
      const item = itemByCode.get(lr.itemCode)!
      const poLine = poDb.lines.find((l) => l.itemId === item.id)
      if (!poLine) fail(`PO line missing for ${lr.itemCode} on ${plan.poNumber}`)

      const orderedPrimary = Number(poLine.quantity)
      const receivePrimary = Math.max(0.0001, orderedPrimary * lr.receivePct)
      const factor = Number(poLine.uomConversionFactor) || Number(item.uomConversionFactor) || 1
      const isMuom = item.purchaseUomId && item.purchaseUomId !== item.baseUomId

      if (isMuom && factor > 0) {
        const receiveUom = receivePrimary * factor
        grnLines.push({
          purchaseOrderLineId: poLine.id,
          receivedUomQuantity: Math.round(receiveUom * 10000) / 10000,
          qcRequired: lr.qcRequired ?? false,
        })
      } else {
        grnLines.push({
          purchaseOrderLineId: poLine.id,
          receivedQuantity: Math.round(receivePrimary * 10000) / 10000,
          qcRequired: lr.qcRequired ?? plan.inspectionRequired ?? false,
        })
      }
    }

    const grnCreate = await request(app)
      .post(`${base}/grns`)
      .set(auth(maker.token))
      .send({
        purchaseOrderId: plan.poId,
        receiptDate: today,
        warehouseId: warehouse.id,
        vendorChallanNumber: `CH-E2E-${plan.vendorCode}-${stamp}`,
        inspectionRequired: plan.inspectionRequired ?? false,
        lines: grnLines,
      })
    if (grnCreate.status !== 201) {
      fail(`GRN create failed for ${plan.poNumber}: ${grnCreate.status} ${JSON.stringify(grnCreate.body)}`)
    }

    const grnId = grnCreate.body.data.id as string
    const grnNumber = (grnCreate.body.data.grnNumber ?? grnCreate.body.data.receiptNumber) as string
    links.push({
      kind: 'GRN',
      number: grnNumber,
      id: grnId,
      url: link(`/purchase/grn/${grnId}`),
      note: `PO ${plan.poNumber} · ${plan.vendorCode}`,
    })

    const grnSubmit = await request(app)
      .post(`${base}/grns/${grnId}/submit`)
      .set(auth(maker.token))
      .send({ remarks: 'E2E partial receive' })
    if (grnSubmit.status !== 200) {
      fail(`GRN submit failed: ${grnSubmit.status} ${JSON.stringify(grnSubmit.body)}`)
    }

    const status = String(grnSubmit.body.data.status)
    console.log(`✓ GRN ${grnNumber} → ${status}`)

    if (status === 'SUBMITTED' || status === 'RECEIVING_COMPLETED') {
      const post = await request(app)
        .post(`${base}/grns/${grnId}/post-inventory`)
        .set(auth(maker.token))
        .send({})
      if (post.status === 200) {
        console.log(`  posted inventory → ${post.body.data.status}`)
      }
    }

    if (plan.inspectionRequired && status === 'QC_PENDING') {
      qcGrnId = grnId
      qcPoId = plan.poId
      qcVendorId = poDb.vendorId
      const valveItem = itemByCode.get('BO-DRAIN-VALVE-DN25')!
      const valvePoLine = poDb.lines.find((l) => l.itemId === valveItem.id)!
      const grnLine = await prisma.goodsReceiptLine.findFirst({
        where: { tenantId: tenant.id, goodsReceiptId: grnId, purchaseOrderLineId: valvePoLine.id },
      })
      qcGrnLineId = grnLine?.id ?? null
      qcPoLineId = valvePoLine.id
    }
  }

  // ── 5. QC on drain-valve GRN (partial accept / reject) ──────────────────
  if (qcGrnId) {
    const qiCreate = await request(app)
      .post(`${base}/quality-inspections`)
      .set(auth(maker.token))
      .send({ goodsReceiptId: qcGrnId })
    if (qiCreate.status !== 201) {
      fail(`QI create failed: ${qiCreate.status} ${JSON.stringify(qiCreate.body)}`)
    }
    const qiId = qiCreate.body.data.id as string
    const qiNumber = qiCreate.body.data.inspectionNumber as string

    const qiDetail = await request(app).get(`${base}/quality-inspections/${qiId}`).set(auth(maker.token))
    const qiLines = (qiDetail.body.data.lines ?? []) as Array<{
      id: string
      goodsReceiptLineId: string
      inspectedQuantity: number
    }>
    const valveLine = qiLines.find((l) => l.goodsReceiptLineId === qcGrnLineId) ?? qiLines[0]
    const inspected = Number(valveLine.inspectedQuantity)
    const accepted = Math.floor(inspected * 0.72)
    const rejected = inspected - accepted

    await request(app).post(`${base}/quality-inspections/${qiId}/start`).set(auth(maker.token)).send({})

    const qiPatch = await request(app)
      .patch(`${base}/quality-inspections/${qiId}`)
      .set(auth(maker.token))
      .send({
        lines: qiLines.map((l) =>
          l.id === valveLine.id
            ? {
                goodsReceiptLineId: l.goodsReceiptLineId,
                inspectedQuantity: inspected,
                acceptedQuantity: accepted,
                rejectedQuantity: rejected,
              }
            : {
                goodsReceiptLineId: l.goodsReceiptLineId,
                inspectedQuantity: Number(l.inspectedQuantity),
                acceptedQuantity: Number(l.inspectedQuantity),
                rejectedQuantity: 0,
              },
        ),
      })
    if (qiPatch.status !== 200) {
      fail(`QI patch failed: ${qiPatch.status} ${JSON.stringify(qiPatch.body)}`)
    }

    const qiComplete = await request(app)
      .post(`${base}/quality-inspections/${qiId}/complete`)
      .set(auth(maker.token))
      .send({
        outcome: 'AUTO',
        decisionCode: 'PARTIAL',
        decisionReason: `E2E partial QC — accept ${accepted}, reject ${rejected}`,
      })
    if (qiComplete.status !== 200) {
      fail(`QI complete failed: ${qiComplete.status} ${JSON.stringify(qiComplete.body)}`)
    }

    links.push({
      kind: 'Quality Inspection',
      number: qiNumber,
      id: qiId,
      url: link(`/purchase/quality-inspections/${qiId}`),
      note: `Accepted ${accepted} / rejected ${rejected}`,
    })
    console.log(`✓ QI ${qiNumber} PARTIALLY_ACCEPTED`)

    // ── 6. Purchase return (rejected qty subset) ───────────────────────────
    const returnQty = Math.min(rejected, Math.max(1, Math.floor(rejected * 0.6)))
    if (qcGrnLineId && qcPoLineId && qcVendorId && returnQty > 0) {
      const retCreate = await request(app)
        .post(`${base}/returns`)
        .set(auth(maker.token))
        .send({
          vendorId: qcVendorId,
          purchaseOrderId: qcPoId,
          goodsReceiptId: qcGrnId,
          warehouseId: warehouse.id,
          reason: 'E2E return of QC-rejected drain valves',
          lines: [
            {
              goodsReceiptLineId: qcGrnLineId,
              purchaseOrderLineId: qcPoLineId,
              returnQuantity: returnQty,
            },
          ],
        })
      if (retCreate.status !== 201) {
        fail(`Return create failed: ${retCreate.status} ${JSON.stringify(retCreate.body)}`)
      }
      const returnId = retCreate.body.data.id as string
      const returnNumber = retCreate.body.data.returnNumber as string

      await request(app).post(`${base}/returns/${returnId}/submit`).set(auth(maker.token)).send({})
      await request(app).post(`${base}/returns/${returnId}/approve`).set(auth(approver.token)).send({})
      const retComplete = await request(app)
        .post(`${base}/returns/${returnId}/complete`)
        .set(auth(maker.token))
        .send({ remarks: 'Return rejected QC qty to vendor' })
      if (retComplete.status !== 200) {
        console.warn(`Return complete: ${retComplete.status}`, retComplete.body)
      }

      links.push({
        kind: 'Purchase Return',
        number: returnNumber,
        id: returnId,
        url: link(`/purchase/returns/${returnId}`),
        note: `Qty ${returnQty} (from QC reject ${rejected})`,
      })
      console.log(`✓ Return ${returnNumber} qty=${returnQty}`)
    }
  } else {
    console.warn('⚠ No QC_PENDING GRN — skipped QI + return')
  }

  // ── Output link table ───────────────────────────────────────────────────
  console.log('\n══════════════════════════════════════════════════════════')
  console.log('  DOCUMENT LINKS (open in browser while logged in)')
  console.log(`  UI base: ${UI_BASE}  ·  tenant: ${TENANT_SLUG}`)
  console.log('══════════════════════════════════════════════════════════\n')

  console.log('| Doc | Number | Link | Notes |')
  console.log('|-----|--------|------|-------|')
  for (const row of links) {
    console.log(`| ${row.kind} | ${row.number} | ${row.url} | ${row.note ?? ''} |`)
  }

  console.log('\nDone.\n')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })

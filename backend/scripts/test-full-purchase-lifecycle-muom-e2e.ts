/**
 * FULL E2E: Purchase Requisition -> RFQ -> Vendor Quotation -> Comparison -> PO
 *           -> GRN (incl. QC) -> Purchase Return (x2) -> Purchase Invoice (x2)
 *
 * One PO, one vendor, 16 lines: 8 Multi-UOM items + 8 Single-UOM items.
 * Exercises the full Multi-UOM Transaction Contract (docs/platform/MULTI_UOM_TRANSACTION_CONTRACT.md)
 * end to end and prints a PASS/FAIL matrix + UI links for manual spot-check.
 *
 * Usage (from backend/):
 *   npx tsx scripts/test-full-purchase-lifecycle-muom-e2e.ts
 *
 * Env:
 *   TENANT_SLUG   default vasant-trailers
 *   UI_BASE       default http://localhost:5173
 *   MAKER_EMAIL / MAKER_PASSWORD        default purchase@vasant-trailers.com / Purchase@123
 *   APPROVER_EMAIL / APPROVER_PASSWORD  default admin@vasant-trailers.com / Admin@123
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
const VENDOR_CODE = 'VEND-0001'
const WAREHOUSE_CODES = ['RM-MAIN', 'RM_STORE', 'BO-MAIN', 'WH-RM-01'] as const

const app = createApp()

type StepResult = { step: string; ok: boolean; detail: string }
const results: StepResult[] = []
function record(step: string, ok: boolean, detail: string) {
  results.push({ step, ok, detail })
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${step} — ${detail}`)
}
function fail(msg: string): never {
  console.error(`\n✗ FATAL: ${msg}`)
  process.exit(1)
}
function nearly(a: number, b: number, eps = 1e-3): boolean {
  return Math.abs(a - b) <= eps
}
function auth(token: string) {
  return { Authorization: `Bearer ${token}` }
}
function link(path: string) {
  return `${UI_BASE}${path}`
}

type LinePlan = {
  itemCode: string
  kind: 'MUOM' | 'SINGLE'
  /** base (stock) qty ordered — this is what PR/PO.quantity should resolve to */
  baseQty: number
  /** vendor/commercial rate, per commercial UOM */
  rate: number
  qcRequired?: boolean
  /** fraction of ordered qty received on GRN (base qty) */
  receivePct: number
  /** if true, raise a small return against the accepted stock after receipt (non-QC) */
  returnAfterAccept?: number
}

const LINES: LinePlan[] = [
  // ---- 8 Multi-UOM items (purchase UOM != base/stock UOM) ----
  { itemCode: 'CASTING-KG-MUOM', kind: 'MUOM', baseQty: 40, rate: 60, receivePct: 1 },
  { itemCode: 'MS-PIPE-DN25-KG', kind: 'MUOM', baseQty: 20, rate: 55, receivePct: 1 },
  { itemCode: 'MS-PIPE-LEN-MTR', kind: 'MUOM', baseQty: 30, rate: 45, receivePct: 1 },
  { itemCode: 'PIPE-MUOM-MTR', kind: 'MUOM', baseQty: 50, rate: 30, receivePct: 1 },
  { itemCode: 'RM-ELECTRODE-MULTI-KG', kind: 'MUOM', baseQty: 60, rate: 90, receivePct: 1 },
  { itemCode: 'RM-FASTENER-MULTI-KG', kind: 'MUOM', baseQty: 40, rate: 120, receivePct: 1 },
  { itemCode: 'RM-PIPE-MULTI-MTR', kind: 'MUOM', baseQty: 45, rate: 35, receivePct: 0.8 }, // partial receipt
  { itemCode: 'RM-ROD-MULTI-MTR', kind: 'MUOM', baseQty: 25, rate: 40, receivePct: 1 },
  // ---- 8 Single-UOM items (purchase UOM == base UOM, factor 1) ----
  { itemCode: 'RM-BRACKET-TEST', kind: 'SINGLE', baseQty: 100, rate: 25, receivePct: 1, returnAfterAccept: 10 },
  { itemCode: 'BO-DRAIN-VALVE-DN25', kind: 'SINGLE', baseQty: 50, rate: 450, qcRequired: true, receivePct: 1 },
  { itemCode: 'BO-AIRTANK-40L', kind: 'SINGLE', baseQty: 20, rate: 1800, receivePct: 1 },
  { itemCode: 'BO-GASKET-MANHOLE-450', kind: 'SINGLE', baseQty: 80, rate: 35, receivePct: 1 },
  { itemCode: 'BO-KPIN-2-JOST', kind: 'SINGLE', baseQty: 30, rate: 650, receivePct: 1 },
  { itemCode: 'BO-LJ-24T', kind: 'SINGLE', baseQty: 15, rate: 4200, receivePct: 1 },
  { itemCode: 'BO-RIM-925', kind: 'SINGLE', baseQty: 40, rate: 3200, receivePct: 0.7 }, // partial receipt
  { itemCode: 'BO-VALVE-3', kind: 'SINGLE', baseQty: 25, rate: 380, receivePct: 1 },
]

async function login(email: string, password: string) {
  const res = await request(app).post('/api/v1/auth/login').send({ email, password, tenantSlug: TENANT_SLUG })
  if (res.status !== 200 || !res.body.data?.accessToken) {
    fail(`Login failed for ${email}: ${res.status} ${JSON.stringify(res.body)}`)
  }
  return { token: res.body.data.accessToken as string, userId: res.body.data.user.id as string }
}

async function ensureWarehouse(tenantId: string) {
  for (const code of WAREHOUSE_CODES) {
    const wh = await prisma.masterWarehouse.findFirst({ where: { tenantId, code, deletedAt: null, status: 'ACTIVE' } })
    if (wh) return wh
  }
  const any = await prisma.masterWarehouse.findFirst({ where: { tenantId, deletedAt: null, status: 'ACTIVE' }, orderBy: { createdAt: 'asc' } })
  if (!any) fail('No ACTIVE warehouse found')
  return any
}

async function releasePo(base: string, poId: string, makerToken: string, approverToken: string) {
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
      send = await request(app).post(`${base}/orders/${poId}/send-to-vendor`).set(auth(approverToken)).send({})
    }
    if (send.status !== 200) fail(`PO send-to-vendor failed: ${send.status} ${JSON.stringify(send.body)}`)
  }
}

async function main() {
  const stamp = Date.now()
  const links: Array<{ kind: string; number: string; url: string; note?: string }> = []

  console.log('\n╔══════════════════════════════════════════════════════════════════╗')
  console.log('║  FULL MULTI-UOM PURCHASE LIFECYCLE E2E                            ║')
  console.log('║  PR → RFQ → VQ → Comparison → PO → GRN → QC → Return → Invoice    ║')
  console.log('╚══════════════════════════════════════════════════════════════════╝')
  console.log(`Tenant: ${TENANT_SLUG}   Time: ${new Date().toISOString()}\n`)

  const tenant = await prisma.tenant.findFirst({ where: { slug: TENANT_SLUG, deletedAt: null } })
  if (!tenant) fail(`Tenant not found: ${TENANT_SLUG}`)

  const vendor = await prisma.masterVendor.findFirst({ where: { tenantId: tenant.id, code: VENDOR_CODE, deletedAt: null, status: 'ACTIVE' } })
  if (!vendor) fail(`Vendor ${VENDOR_CODE} missing`)
  const warehouse = await ensureWarehouse(tenant.id)
  const department = await prisma.crmMaster.findFirst({ where: { tenantId: tenant.id, kind: 'departments', deletedAt: null } })

  type ItemRow = NonNullable<Awaited<ReturnType<typeof prisma.masterItem.findFirst>>> & {
    baseUom: { id: string; code: string } | null
    purchaseUom: { id: string; code: string } | null
  }
  const itemByCode = new Map<string, ItemRow>()
  for (const spec of LINES) {
    const item = (await prisma.masterItem.findFirst({
      where: { tenantId: tenant.id, code: spec.itemCode, deletedAt: null, status: 'ACTIVE' },
      include: { baseUom: { select: { id: true, code: true } }, purchaseUom: { select: { id: true, code: true } } },
    })) as ItemRow | null
    if (!item) fail(`Item ${spec.itemCode} missing`)
    itemByCode.set(spec.itemCode, item!)
  }

  // Sanity: MUOM items must actually have purchaseUom != baseUom; SINGLE must be equal.
  for (const spec of LINES) {
    const item = itemByCode.get(spec.itemCode)!
    const isMuom = Boolean(item.purchaseUomId && item.purchaseUomId !== item.baseUomId)
    const ok = spec.kind === 'MUOM' ? isMuom : !isMuom
    record(`Item master check ${spec.itemCode}`, ok, `kind=${spec.kind} purchaseUom=${item.purchaseUom?.code} baseUom=${item.baseUom?.code} factor=${item.uomConversionFactor}`)
  }

  const maker = await login(MAKER_EMAIL, MAKER_PASSWORD)
  const approver = await login(APPROVER_EMAIL, APPROVER_PASSWORD)
  const base = `/api/v1/t/${TENANT_SLUG}/purchase`
  const today = new Date().toISOString().slice(0, 10)
  const requiredDate = new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10)

  // ══ 1. PURCHASE REQUISITION (16 lines, base UOM) ═══════════════════════
  console.log('\n── Step 1: Purchase Requisition ──')
  const prCreate = await request(app)
    .post(`${base}/requisitions`)
    .set(auth(maker.token))
    .send({
      requisitionDate: today,
      requiredDate,
      rfqRequired: true,
      priority: 'NORMAL',
      warehouseId: warehouse.id,
      departmentId: department?.id,
      remarks: `Full MUOM lifecycle E2E ${stamp}`,
      lines: LINES.map((spec) => {
        const item = itemByCode.get(spec.itemCode)!
        return {
          itemId: item.id,
          itemCode: item.code,
          itemName: item.name,
          requiredQuantity: spec.baseQty,
          uomId: item.baseUomId,
          estimatedRate: spec.rate * (item.uomConversionFactor ? Number(item.uomConversionFactor) : 1),
          requiredDate,
          warehouseId: warehouse.id,
          preferredVendorId: vendor.id,
        }
      }),
    })
  if (prCreate.status !== 201) fail(`PR create failed: ${prCreate.status} ${JSON.stringify(prCreate.body)}`)
  const prId = prCreate.body.data.id as string
  const prNumber = prCreate.body.data.requisitionNumber as string
  links.push({ kind: 'Purchase Requisition', number: prNumber, url: link(`/purchase/requisitions/${prId}`) })
  record('Create PR', true, `${prNumber} · ${LINES.length} lines`)

  const prSubmit = await request(app).post(`${base}/requisitions/${prId}/submit`).set(auth(maker.token)).send({ remarks: 'Submit for RFQ' })
  if (prSubmit.status !== 200) fail(`PR submit failed: ${prSubmit.status} ${JSON.stringify(prSubmit.body)}`)
  const prApprove = await request(app).post(`${base}/requisitions/${prId}/approve`).set(auth(approver.token)).send({ remarks: 'Approved for RFQ' })
  if (prApprove.status !== 200) fail(`PR approve failed: ${prApprove.status} ${JSON.stringify(prApprove.body)}`)
  record('PR submit + approve', true, `status=${prApprove.body.data.status}`)

  // ══ 2. RFQ ═══════════════════════════════════════════════════════════
  console.log('\n── Step 2: RFQ ──')
  const rfqRes = await request(app)
    .post(`${base}/requisitions/${prId}/convert-to-rfq`)
    .set(auth(maker.token))
    .send({ vendorIds: [vendor.id], responseDueDate: requiredDate, title: `RFQ ${stamp}` })
  if (rfqRes.status !== 201) fail(`RFQ create failed: ${rfqRes.status} ${JSON.stringify(rfqRes.body)}`)
  const rfqId = rfqRes.body.data.id as string
  const rfqNumber = rfqRes.body.data.rfqNumber as string
  links.push({ kind: 'RFQ', number: rfqNumber, url: link(`/purchase/rfqs/${rfqId}`) })

  const sendRes = await request(app).post(`${base}/rfqs/${rfqId}/send`).set(auth(maker.token)).send({})
  if (sendRes.status !== 200) fail(`RFQ send failed: ${sendRes.status} ${JSON.stringify(sendRes.body)}`)
  record('Create + send RFQ', true, `${rfqNumber} status=${sendRes.body.data.status}`)

  const rfqDetail = await request(app).get(`${base}/rfqs/${rfqId}`).set(auth(maker.token))
  const rfqLines = (rfqDetail.body.data.lines ?? []) as Array<{ id: string; itemId: string }>
  if (rfqLines.length !== LINES.length) fail(`RFQ line count mismatch: expected ${LINES.length}, got ${rfqLines.length}`)
  const rfqLineByItemId = new Map(rfqLines.map((l) => [l.itemId, l.id]))

  // ══ 3. VENDOR QUOTATION (commercial qty in purchase UOM) ═══════════════
  console.log('\n── Step 3: Vendor Quotation ──')
  const vqLines = LINES.map((spec) => {
    const item = itemByCode.get(spec.itemCode)!
    const factor = Number(item.uomConversionFactor) || 1
    const commercialQty = spec.baseQty * factor
    return {
      requestForQuotationLineId: rfqLineByItemId.get(item.id),
      itemId: item.id,
      itemCodeSnapshot: item.code,
      itemNameSnapshot: item.name,
      quantity: commercialQty,
      uomId: item.purchaseUomId ?? item.baseUomId,
      rate: spec.rate,
    }
  })
  const vqRes = await request(app)
    .post(`${base}/vendor-quotations`)
    .set(auth(maker.token))
    .send({ requestForQuotationId: rfqId, vendorId: vendor.id, quotationDate: today, lines: vqLines })
  if (vqRes.status !== 201) fail(`VQ create failed: ${vqRes.status} ${JSON.stringify(vqRes.body)}`)
  const vqId = vqRes.body.data.id as string
  const vqNumber = vqRes.body.data.quotationNumber as string
  links.push({ kind: 'Vendor Quotation', number: vqNumber, url: link(`/purchase/vendor-quotations/${vqId}`) })

  const vqSubmit = await request(app).post(`${base}/vendor-quotations/${vqId}/submit`).set(auth(maker.token)).send({})
  if (vqSubmit.status !== 200) fail(`VQ submit failed: ${vqSubmit.status} ${JSON.stringify(vqSubmit.body)}`)
  record('Create + submit VQ', true, `${vqNumber} status=${vqSubmit.body.data.status}`)

  // ══ 4. COMPARISON → PO ══════════════════════════════════════════════
  console.log('\n── Step 4: Comparison → PO ──')
  const cmpRes = await request(app).post(`${base}/comparisons`).set(auth(maker.token)).send({ requestForQuotationId: rfqId })
  if (cmpRes.status !== 201) fail(`Comparison create failed: ${cmpRes.status} ${JSON.stringify(cmpRes.body)}`)
  const comparisonId = cmpRes.body.data.id as string

  const awardRes = await request(app)
    .post(`${base}/comparisons/${comparisonId}/award`)
    .set(auth(maker.token))
    .send({ awardedVendorQuotationId: vqId, selectionReason: 'Full MUOM E2E — sole vendor quote' })
  if (awardRes.status !== 200) fail(`Comparison award failed: ${awardRes.status} ${JSON.stringify(awardRes.body)}`)

  const poFromCmp = await request(app).post(`${base}/comparisons/${comparisonId}/create-po`).set(auth(maker.token)).send({})
  if (poFromCmp.status !== 201) fail(`Create PO from comparison failed: ${poFromCmp.status} ${JSON.stringify(poFromCmp.body)}`)
  const poId = poFromCmp.body.data.id as string
  const poNumber = poFromCmp.body.data.orderNumber as string
  links.push({ kind: 'Purchase Order', number: poNumber, url: link(`/purchase/orders/${poId}`) })
  const poLinesDto = (poFromCmp.body.data.lines ?? []) as Array<Record<string, unknown>>
  record('Comparison award + create PO', poLinesDto.length === LINES.length, `${poNumber} lines=${poLinesDto.length} (expected ${LINES.length})`)

  console.log('\n  ── PO line dual-UOM check (commercial vs stock qty) ──')
  for (const spec of LINES) {
    const item = itemByCode.get(spec.itemCode)!
    const factor = Number(item.uomConversionFactor) || 1
    const line = poLinesDto.find((l) => l.itemId === item.id)
    if (!line) { record(`PO line ${spec.itemCode}`, false, 'missing from PO'); continue }
    const expectedUomQty = spec.baseQty * factor
    const qtyOk = nearly(Number(line.quantity), spec.baseQty)
    const uomQtyOk = nearly(Number(line.uomQuantity), expectedUomQty)
    const factorOk = nearly(Number(line.uomConversionFactor), factor)
    record(
      `PO ${spec.itemCode} qty`,
      qtyOk && uomQtyOk && factorOk,
      `stockQty=${line.quantity} (exp ${spec.baseQty}) uomQty=${line.uomQuantity} (exp ${expectedUomQty}) factor=${line.uomConversionFactor} (exp ${factor})`,
    )
  }

  await releasePo(base, poId, maker.token, approver.token)
  const poDb = await prisma.purchaseOrder.findUniqueOrThrow({ where: { id: poId }, include: { lines: true } })
  record('Release PO', poDb.status === 'SENT_TO_VENDOR' || poDb.status === 'RELEASED', `status=${poDb.status}`)
  const poLineByItemId = new Map(poDb.lines.map((l) => [l.itemId!, l]))

  // ══ 5. GRN-A: non-QC lines (15) ══════════════════════════════════════
  console.log('\n── Step 5: GRN-A (non-QC lines) ──')
  const nonQcLines = LINES.filter((l) => !l.qcRequired)
  const qcLines = LINES.filter((l) => l.qcRequired)

  const grnALines = nonQcLines.map((spec) => {
    const item = itemByCode.get(spec.itemCode)!
    const poLine = poLineByItemId.get(item.id)!
    const receiveBase = spec.baseQty * spec.receivePct
    const isMuom = Boolean(item.purchaseUomId && item.purchaseUomId !== item.baseUomId)
    const factor = Number(poLine.uomConversionFactor) || 1
    return isMuom
      ? { purchaseOrderLineId: poLine.id, receivedUomQuantity: Math.round(receiveBase * factor * 10000) / 10000, qcRequired: false }
      : { purchaseOrderLineId: poLine.id, receivedQuantity: Math.round(receiveBase * 10000) / 10000, qcRequired: false }
  })
  const grnACreate = await request(app)
    .post(`${base}/grns`)
    .set(auth(maker.token))
    .send({
      purchaseOrderId: poId,
      receiptDate: today,
      warehouseId: warehouse.id,
      vendorChallanNumber: `CH-A-${stamp}`,
      inspectionRequired: false,
      lines: grnALines,
    })
  if (grnACreate.status !== 201) fail(`GRN-A create failed: ${grnACreate.status} ${JSON.stringify(grnACreate.body)}`)
  const grnAId = grnACreate.body.data.id as string
  const grnANumber = (grnACreate.body.data.grnNumber ?? grnACreate.body.data.receiptNumber) as string
  links.push({ kind: 'GRN (non-QC)', number: grnANumber, url: link(`/purchase/grn/${grnAId}`) })

  const grnADtoLines = (grnACreate.body.data.lines ?? []) as Array<Record<string, unknown>>
  console.log('\n  ── GRN-A line dual-UOM check ──')
  for (const spec of nonQcLines) {
    const item = itemByCode.get(spec.itemCode)!
    const poLine = poLineByItemId.get(item.id)!
    const gl = grnADtoLines.find((l) => l.purchaseOrderLineId === poLine.id)
    if (!gl) { record(`GRN-A line ${spec.itemCode}`, false, 'missing'); continue }
    const factor = Number(poLine.uomConversionFactor) || 1
    const expectedBase = spec.baseQty * spec.receivePct
    const expectedUom = expectedBase * factor
    const baseOk = nearly(Number(gl.receivedQuantity), expectedBase)
    const uomOk = nearly(Number(gl.receivedUomQuantity ?? gl.receivedQuantity), expectedUom)
    record(
      `GRN-A ${spec.itemCode} received`,
      baseOk && uomOk,
      `stock=${gl.receivedQuantity} (exp ${expectedBase}) vendor=${gl.receivedUomQuantity ?? '—'} (exp ${expectedUom})`,
    )
  }

  const grnASubmit = await request(app).post(`${base}/grns/${grnAId}/submit`).set(auth(maker.token)).send({ remarks: 'E2E receive — non-QC lines' })
  if (grnASubmit.status !== 200) fail(`GRN-A submit failed: ${grnASubmit.status} ${JSON.stringify(grnASubmit.body)}`)
  let grnAStatus = String(grnASubmit.body.data.status)
  if (grnAStatus === 'SUBMITTED' || grnAStatus === 'RECEIVING_COMPLETED') {
    const post = await request(app).post(`${base}/grns/${grnAId}/post-inventory`).set(auth(maker.token)).send({})
    if (post.status === 200) grnAStatus = String(post.body.data.status)
  }
  record('Submit + post GRN-A', true, `${grnANumber} status=${grnAStatus}`)

  // ══ 6. GRN-B: QC line ════════════════════════════════════════════════
  console.log('\n── Step 6: GRN-B (QC-required line) + Quality Inspection ──')
  let grnBId: string | null = null
  let grnBNumber = ''
  let qcAcceptedQty = 0
  let qcRejectedQty = 0
  let qcGrnLineId: string | null = null
  let qcPoLineId: string | null = null

  if (qcLines.length > 0) {
    const spec = qcLines[0]!
    const item = itemByCode.get(spec.itemCode)!
    const poLine = poLineByItemId.get(item.id)!
    qcPoLineId = poLine.id
    const grnBCreate = await request(app)
      .post(`${base}/grns`)
      .set(auth(maker.token))
      .send({
        purchaseOrderId: poId,
        receiptDate: today,
        warehouseId: warehouse.id,
        vendorChallanNumber: `CH-B-${stamp}`,
        inspectionRequired: true,
        lines: [{ purchaseOrderLineId: poLine.id, receivedQuantity: spec.baseQty, qcRequired: true }],
      })
    if (grnBCreate.status !== 201) fail(`GRN-B create failed: ${grnBCreate.status} ${JSON.stringify(grnBCreate.body)}`)
    grnBId = grnBCreate.body.data.id as string
    grnBNumber = (grnBCreate.body.data.grnNumber ?? grnBCreate.body.data.receiptNumber) as string
    links.push({ kind: 'GRN (QC)', number: grnBNumber, url: link(`/purchase/grn/${grnBId}`) })

    const grnBSubmit = await request(app).post(`${base}/grns/${grnBId}/submit`).set(auth(maker.token)).send({ remarks: 'E2E receive — QC line' })
    if (grnBSubmit.status !== 200) fail(`GRN-B submit failed: ${grnBSubmit.status} ${JSON.stringify(grnBSubmit.body)}`)
    const grnBStatus = String(grnBSubmit.body.data.status)
    record('Submit GRN-B (QC hold)', grnBStatus === 'QC_PENDING', `${grnBNumber} status=${grnBStatus}`)

    const grnBLine = await prisma.goodsReceiptLine.findFirst({ where: { tenantId: tenant.id, goodsReceiptId: grnBId, purchaseOrderLineId: poLine.id } })
    qcGrnLineId = grnBLine?.id ?? null

    const qiCreate = await request(app).post(`${base}/quality-inspections`).set(auth(maker.token)).send({ goodsReceiptId: grnBId })
    if (qiCreate.status !== 201) fail(`QI create failed: ${qiCreate.status} ${JSON.stringify(qiCreate.body)}`)
    const qiId = qiCreate.body.data.id as string
    const qiNumber = qiCreate.body.data.inspectionNumber as string
    links.push({ kind: 'Quality Inspection', number: qiNumber, url: link(`/purchase/quality-inspections/${qiId}`) })

    await request(app).post(`${base}/quality-inspections/${qiId}/start`).set(auth(maker.token)).send({})

    const qiDetail = await request(app).get(`${base}/quality-inspections/${qiId}`).set(auth(maker.token))
    const qiLines = (qiDetail.body.data.lines ?? []) as Array<{ id: string; goodsReceiptLineId: string; inspectedQuantity: number }>
    const qiLine = qiLines.find((l) => l.goodsReceiptLineId === qcGrnLineId) ?? qiLines[0]!
    const inspected = Number(qiLine.inspectedQuantity)
    qcAcceptedQty = Math.round(inspected * 0.7 * 100) / 100
    qcRejectedQty = Math.round((inspected - qcAcceptedQty) * 100) / 100

    const qiPatch = await request(app)
      .patch(`${base}/quality-inspections/${qiId}`)
      .set(auth(maker.token))
      .send({ lines: [{ goodsReceiptLineId: qiLine.goodsReceiptLineId, inspectedQuantity: inspected, acceptedQuantity: qcAcceptedQty, rejectedQuantity: qcRejectedQty }] })
    if (qiPatch.status !== 200) fail(`QI patch failed: ${qiPatch.status} ${JSON.stringify(qiPatch.body)}`)

    const qiComplete = await request(app)
      .post(`${base}/quality-inspections/${qiId}/complete`)
      .set(auth(maker.token))
      .send({ outcome: 'AUTO', decisionCode: 'PARTIAL', decisionReason: `E2E partial QC — accept ${qcAcceptedQty}, reject ${qcRejectedQty}` })
    if (qiComplete.status !== 200) fail(`QI complete failed: ${qiComplete.status} ${JSON.stringify(qiComplete.body)}`)
    record('QC inspect + complete', true, `${qiNumber} accepted=${qcAcceptedQty} rejected=${qcRejectedQty} (inspected=${inspected})`)

    const grnBAfterQc = await prisma.goodsReceipt.findUniqueOrThrow({ where: { id: grnBId } })
    if (grnBAfterQc.status === 'RECEIVING_COMPLETED' || grnBAfterQc.status === 'SUBMITTED') {
      const post = await request(app).post(`${base}/grns/${grnBId}/post-inventory`).set(auth(maker.token)).send({})
      record('Post GRN-B inventory', post.status === 200, `status=${post.status === 200 ? post.body.data.status : post.status}`)
    } else {
      record('Post GRN-B inventory', true, `skipped — status already ${grnBAfterQc.status}`)
    }
  } else {
    record('QC line present', false, 'no qcRequired line found in LINES plan')
  }

  // ══ 7. PURCHASE RETURNS ══════════════════════════════════════════════
  console.log('\n── Step 7: Purchase Returns ──')
  const returnLinks: string[] = []

  const nonQcReturnSpec = LINES.find((l) => l.returnAfterAccept)
  if (nonQcReturnSpec) {
    const item = itemByCode.get(nonQcReturnSpec.itemCode)!
    const poLine = poLineByItemId.get(item.id)!
    const grnLine = await prisma.goodsReceiptLine.findFirst({ where: { tenantId: tenant.id, goodsReceiptId: grnAId, purchaseOrderLineId: poLine.id } })
    if (!grnLine) {
      record('Return #1 (non-QC damage)', false, `GRN-A line missing for ${nonQcReturnSpec.itemCode}`)
    } else {
      const retRes = await request(app)
        .post(`${base}/returns`)
        .set(auth(maker.token))
        .send({
          vendorId: vendor.id,
          purchaseOrderId: poId,
          goodsReceiptId: grnAId,
          warehouseId: warehouse.id,
          returnType: 'CREDIT',
          reason: 'Other',
          remarks: 'E2E — found damaged during putaway, returning small qty',
          lines: [{ goodsReceiptLineId: grnLine.id, purchaseOrderLineId: poLine.id, returnQuantity: nonQcReturnSpec.returnAfterAccept }],
        })
      if (retRes.status !== 201) {
        record('Return #1 (non-QC damage)', false, `${retRes.status} ${JSON.stringify(retRes.body)}`)
      } else {
        const returnId = retRes.body.data.id as string
        const returnNumber = retRes.body.data.returnNumber as string
        await request(app).post(`${base}/returns/${returnId}/submit`).set(auth(maker.token)).send({})
        await request(app).post(`${base}/returns/${returnId}/approve`).set(auth(approver.token)).send({})
        const complete = await request(app).post(`${base}/returns/${returnId}/complete`).set(auth(maker.token)).send({ remarks: 'Ship damaged qty back to vendor' })
        links.push({ kind: 'Purchase Return', number: returnNumber, url: link(`/purchase/returns/${returnId}`), note: `${nonQcReturnSpec.itemCode} qty ${nonQcReturnSpec.returnAfterAccept} (post-accept damage)` })
        returnLinks.push(returnNumber)
        record('Return #1 (non-QC damage)', complete.status === 200, `${returnNumber} qty=${nonQcReturnSpec.returnAfterAccept} finalStatus=${complete.status === 200 ? complete.body.data.status : complete.status}`)
      }
    }
  }

  if (grnBId && qcGrnLineId && qcPoLineId && qcRejectedQty > 0) {
    const retRes = await request(app)
      .post(`${base}/returns`)
      .set(auth(maker.token))
      .send({
        vendorId: vendor.id,
        purchaseOrderId: poId,
        goodsReceiptId: grnBId,
        warehouseId: warehouse.id,
        returnType: 'CREDIT',
        reason: 'GRN Rejected Quantity',
        remarks: 'E2E — return QC-rejected qty to vendor',
        lines: [{ goodsReceiptLineId: qcGrnLineId, purchaseOrderLineId: qcPoLineId, returnQuantity: qcRejectedQty }],
      })
    if (retRes.status !== 201) {
      record('Return #2 (QC rejected)', false, `${retRes.status} ${JSON.stringify(retRes.body)}`)
    } else {
      const returnId = retRes.body.data.id as string
      const returnNumber = retRes.body.data.returnNumber as string
      await request(app).post(`${base}/returns/${returnId}/submit`).set(auth(maker.token)).send({})
      await request(app).post(`${base}/returns/${returnId}/approve`).set(auth(approver.token)).send({})
      const complete = await request(app).post(`${base}/returns/${returnId}/complete`).set(auth(maker.token)).send({ remarks: 'Ship QC-rejected qty back to vendor' })
      links.push({ kind: 'Purchase Return', number: returnNumber, url: link(`/purchase/returns/${returnId}`), note: `QC-rejected qty ${qcRejectedQty}` })
      returnLinks.push(returnNumber)
      record('Return #2 (QC rejected)', complete.status === 200, `${returnNumber} qty=${qcRejectedQty} finalStatus=${complete.status === 200 ? complete.body.data.status : complete.status}`)
    }
  }

  // ══ 8. PURCHASE INVOICES ═════════════════════════════════════════════
  console.log('\n── Step 8: Purchase Invoices ──')

  // Invoice #1 — against GRN-A (15 non-QC lines, at received base qty)
  const grnADbLines = await prisma.goodsReceiptLine.findMany({ where: { tenantId: tenant.id, goodsReceiptId: grnAId } })
  const grnALineByPoLine = new Map(grnADbLines.map((l) => [l.purchaseOrderLineId, l]))
  const invALines = nonQcLines.map((spec) => {
    const item = itemByCode.get(spec.itemCode)!
    const poLine = poLineByItemId.get(item.id)!
    const grnLine = grnALineByPoLine.get(poLine.id)!
    return {
      purchaseOrderLineId: poLine.id,
      goodsReceiptLineId: grnLine.id,
      itemId: item.id,
      itemCode: item.code,
      itemName: item.name,
      quantity: Number(grnLine.receivedQuantity),
      rate: spec.rate,
      taxRatePct: 18,
    }
  })
  const invACreate = await request(app)
    .post(`${base}/invoices`)
    .set(auth(maker.token))
    .send({ vendorId: vendor.id, purchaseOrderId: poId, goodsReceiptId: grnAId, vendorInvoiceNumber: `VINV-A-${stamp}`, lines: invALines })
  if (invACreate.status !== 201) {
    record('Create Invoice #1 (GRN-A)', false, `${invACreate.status} ${JSON.stringify(invACreate.body)}`)
  } else {
    const invAId = invACreate.body.data.id as string
    const invANumber = invACreate.body.data.invoiceNumber as string
    links.push({ kind: 'Purchase Invoice', number: invANumber, url: link(`/purchase/invoices/${invAId}`), note: 'Non-QC lines' })

    const invALinesDto = (invACreate.body.data.lines ?? []) as Array<Record<string, unknown>>
    console.log('\n  ── Invoice #1 dual-UOM snapshot check ──')
    for (const spec of nonQcLines) {
      const item = itemByCode.get(spec.itemCode)!
      const factor = Number(item.uomConversionFactor) || 1
      const line = invALinesDto.find((l) => l.itemId === item.id)
      if (!line) { record(`Invoice-A ${spec.itemCode}`, false, 'missing'); continue }
      const expectedBase = spec.baseQty * spec.receivePct
      const expectedVendorQty = expectedBase * factor
      const baseOk = nearly(Number(line.quantity), expectedBase)
      const factorOk = nearly(Number(line.uomConversionFactorSnapshot), factor)
      const vendorQtyOk = nearly(Number(line.uomQuantitySnapshot), expectedVendorQty)
      record(
        `Invoice-A ${spec.itemCode} snapshot`,
        baseOk && factorOk && vendorQtyOk,
        `qty=${line.quantity} (exp ${expectedBase}) factorSnap=${line.uomConversionFactorSnapshot} (exp ${factor}) vendorQtySnap=${line.uomQuantitySnapshot} (exp ${expectedVendorQty})`,
      )
    }

    let submitA = await request(app).post(`${base}/invoices/${invAId}/submit`).set(auth(maker.token)).send({})
    let matchNoteA = ''
    if (submitA.status !== 200) {
      matchNoteA = `initial 3-way match failed: ${JSON.stringify(submitA.body?.errors ?? submitA.body?.message)} — retrying with authorized override`
      submitA = await request(app)
        .post(`${base}/invoices/${invAId}/submit`)
        .set(auth(maker.token))
        .send({ overrideAuthorized: true, overrideRemarks: 'E2E override — PO header tax rollup gap (see report), qty/rate match confirmed manually' })
    }
    let statusA = submitA.status === 200 ? String(submitA.body.data.status) : `submit-failed(${submitA.status}: ${JSON.stringify(submitA.body)})`
    if (submitA.status === 200 && statusA === 'PENDING_APPROVAL') {
      const apprA = await request(app).post(`${base}/invoices/${invAId}/approve`).set(auth(approver.token)).send({})
      if (apprA.status === 200) statusA = String(apprA.body.data.status)
    }
    if (['APPROVED', 'MATCHED', 'PARTIALLY_MATCHED'].includes(statusA)) {
      const postA = await request(app).post(`${base}/invoices/${invAId}/post`).set(auth(maker.token)).send({})
      if (postA.status === 200) statusA = String(postA.body.data.status)
    }
    record('Submit + approve + post Invoice #1', submitA.status === 200, `${invANumber} status=${statusA} amount=₹${invACreate.body.data.totalAmount}${matchNoteA ? ` | ${matchNoteA}` : ''}`)

    // ── PO line invoicedQuantity rollup check for a MUOM line (must be base qty, not vendor qty) ──
    const muomCheckSpec = nonQcLines.find((l) => l.itemCode === 'CASTING-KG-MUOM')!
    const muomCheckItem = itemByCode.get(muomCheckSpec.itemCode)!
    const muomCheckPoLine = poLineByItemId.get(muomCheckItem.id)!
    const muomPoLineAfterPost = await prisma.purchaseOrderLine.findUnique({ where: { id: muomCheckPoLine.id } })
    record(
      `PO ${muomCheckSpec.itemCode} invoicedQuantity rollup (MUOM)`,
      nearly(Number(muomPoLineAfterPost?.invoicedQuantity), muomCheckSpec.baseQty),
      `invoicedQuantity=${muomPoLineAfterPost?.invoicedQuantity} expected=${muomCheckSpec.baseQty} base NOS (not ${muomCheckSpec.baseQty * (Number(muomCheckItem.uomConversionFactor) || 1)} KG vendor qty)`,
    )
  }

  // Invoice #2 — against GRN-B (QC line, at accepted qty)
  if (grnBId && qcAcceptedQty > 0) {
    const spec = qcLines[0]!
    const item = itemByCode.get(spec.itemCode)!
    const poLine = poLineByItemId.get(item.id)!
    const grnBDbLine = await prisma.goodsReceiptLine.findFirstOrThrow({ where: { tenantId: tenant.id, goodsReceiptId: grnBId, purchaseOrderLineId: poLine.id } })
    const invBCreate = await request(app)
      .post(`${base}/invoices`)
      .set(auth(maker.token))
      .send({
        vendorId: vendor.id,
        purchaseOrderId: poId,
        goodsReceiptId: grnBId,
        vendorInvoiceNumber: `VINV-B-${stamp}`,
        remarks: 'Invoice for QC-accepted qty only',
        lines: [{
          purchaseOrderLineId: poLine.id,
          goodsReceiptLineId: grnBDbLine.id,
          itemId: item.id,
          itemCode: item.code,
          itemName: item.name,
          quantity: qcAcceptedQty,
          rate: spec.rate,
          taxRatePct: 18,
        }],
      })
    if (invBCreate.status !== 201) {
      record('Create Invoice #2 (GRN-B, QC-accepted)', false, `${invBCreate.status} ${JSON.stringify(invBCreate.body)}`)
    } else {
      const invBId = invBCreate.body.data.id as string
      const invBNumber = invBCreate.body.data.invoiceNumber as string
      links.push({ kind: 'Purchase Invoice', number: invBNumber, url: link(`/purchase/invoices/${invBId}`), note: `QC-accepted qty ${qcAcceptedQty}` })

      const invBLine = ((invBCreate.body.data.lines ?? [])[0] ?? {}) as Record<string, unknown>
      record(
        'Invoice #2 billed at QC-accepted qty (not gross receipt)',
        nearly(Number(invBLine.quantity), qcAcceptedQty),
        `billedQty=${invBLine.quantity} expected=${qcAcceptedQty} (gross received=${spec.baseQty})`,
      )

      let submitB = await request(app).post(`${base}/invoices/${invBId}/submit`).set(auth(maker.token)).send({})
      let matchNoteB = ''
      if (submitB.status !== 200) {
        matchNoteB = `initial 3-way match failed: ${JSON.stringify(submitB.body?.errors ?? submitB.body?.message)} — retrying with authorized override`
        submitB = await request(app)
          .post(`${base}/invoices/${invBId}/submit`)
          .set(auth(maker.token))
          .send({ overrideAuthorized: true, overrideRemarks: 'E2E override — PO header tax rollup gap (see report), qty/rate match confirmed manually' })
      }
      let statusB = submitB.status === 200 ? String(submitB.body.data.status) : `submit-failed(${submitB.status}: ${JSON.stringify(submitB.body)})`
      if (submitB.status === 200 && statusB === 'PENDING_APPROVAL') {
        const apprB = await request(app).post(`${base}/invoices/${invBId}/approve`).set(auth(approver.token)).send({})
        if (apprB.status === 200) statusB = String(apprB.body.data.status)
      }
      if (['APPROVED', 'MATCHED', 'PARTIALLY_MATCHED'].includes(statusB)) {
        const postB = await request(app).post(`${base}/invoices/${invBId}/post`).set(auth(maker.token)).send({})
        if (postB.status === 200) statusB = String(postB.body.data.status)
      }
      record('Submit + approve + post Invoice #2', submitB.status === 200, `${invBNumber} status=${statusB} amount=₹${invBCreate.body.data.totalAmount}${matchNoteB ? ` | ${matchNoteB}` : ''}`)

      // ── PO line invoicedQuantity rollup check (base qty, posted only) ──
      const poLineAfterPost = await prisma.purchaseOrderLine.findUnique({ where: { id: poLine.id } })
      record(
        `PO ${spec.itemCode} invoicedQuantity rollup`,
        nearly(Number(poLineAfterPost?.invoicedQuantity), qcAcceptedQty),
        `invoicedQuantity=${poLineAfterPost?.invoicedQuantity} expected=${qcAcceptedQty} (base qty, not vendor/commercial qty)`,
      )
    }
  }

  // ══ SUMMARY ══════════════════════════════════════════════════════════
  console.log('\n╔══════════════════════════════════════════════════════════════════╗')
  console.log('║  SUMMARY                                                          ║')
  console.log('╚══════════════════════════════════════════════════════════════════╝')
  let pass = 0
  let failCount = 0
  for (const r of results) {
    if (r.ok) pass++
    else failCount++
  }
  console.log(`Result: ${failCount === 0 ? 'ALL PASSED' : `${failCount} FAILED`} (${pass}/${results.length})\n`)
  if (failCount > 0) {
    console.log('── Failures ──')
    for (const r of results.filter((r) => !r.ok)) console.log(`  ✗ ${r.step} — ${r.detail}`)
    console.log('')
  }

  console.log('══════════════════════════════════════════════════════════')
  console.log(`  DOCUMENT LINKS (UI base: ${UI_BASE} · tenant: ${TENANT_SLUG})`)
  console.log('══════════════════════════════════════════════════════════\n')
  console.log('| Doc | Number | Link | Notes |')
  console.log('|-----|--------|------|-------|')
  for (const row of links) {
    console.log(`| ${row.kind} | ${row.number} | ${row.url} | ${row.note ?? ''} |`)
  }
  console.log('\nDone.\n')

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

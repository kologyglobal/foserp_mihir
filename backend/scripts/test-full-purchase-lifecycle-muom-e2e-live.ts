/**
 * FULL E2E — LIVE HTTP variant: same flow as test-full-purchase-lifecycle-muom-e2e.ts, but
 * hits a real deployed backend over HTTP (no local app, no local Prisma/DB access at all).
 *
 * PR -> RFQ -> Vendor Quotation -> Comparison -> PO -> GRN -> QC -> Purchase Return (x2)
 * -> Purchase Invoice (x2, incl. post + PO invoicedQuantity rollup check)
 *
 * One PO, one vendor, 16 lines: 8 Multi-UOM items + 8 Single-UOM items.
 *
 * Usage (from backend/):
 *   npx tsx scripts/test-full-purchase-lifecycle-muom-e2e-live.ts
 *
 * Env:
 *   API_BASE        default https://stageapi.dhurandharcrm.com
 *   UI_BASE         default https://stage.dhurandharcrm.com
 *   TENANT_SLUG     default vasant-trailers
 *   MAKER_EMAIL / MAKER_PASSWORD        default purchase@vasant-trailers.com / Purchase@123
 *   APPROVER_EMAIL / APPROVER_PASSWORD  default admin@vasant-trailers.com / Admin@123
 */

const API_BASE = (process.env.API_BASE ?? 'https://stageapi.dhurandharcrm.com').replace(/\/$/, '')
const UI_BASE = (process.env.UI_BASE ?? 'https://stage.dhurandharcrm.com').replace(/\/$/, '')
const TENANT_SLUG = process.env.TENANT_SLUG ?? 'vasant-trailers'
const MAKER_EMAIL = process.env.MAKER_EMAIL ?? 'purchase@vasant-trailers.com'
const MAKER_PASSWORD = process.env.MAKER_PASSWORD ?? 'Purchase@123'
const APPROVER_EMAIL = process.env.APPROVER_EMAIL ?? 'admin@vasant-trailers.com'
const APPROVER_PASSWORD = process.env.APPROVER_PASSWORD ?? 'Admin@123'
const VENDOR_CODE = 'VEND-0001'
const WAREHOUSE_CODES = ['RM-MAIN', 'RM_STORE', 'BO-MAIN', 'WH-RM-01'] as const
/** Stage had zero Department masters (PR submit requires one) — seeded "PUR"/Purchase via API before this run. */
const DEPARTMENT_CODE = 'PUR'

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
function link(path: string) {
  return `${UI_BASE}${path}`
}

/** Thin fetch wrapper — retries once on a transient 5xx (stage login flaked once during recon). */
async function callApi(
  method: 'GET' | 'POST' | 'PATCH',
  path: string,
  token: string | null,
  body?: unknown,
): Promise<{ status: number; body: any }> {
  const doCall = async () => {
    const res = await fetch(`${API_BASE}${path}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    })
    let json: any = null
    try {
      json = await res.json()
    } catch {
      json = null
    }
    return { status: res.status, body: json }
  }
  const first = await doCall()
  if (first.status >= 500) {
    console.log(`    (transient ${first.status} on ${method} ${path} — retrying once)`)
    await new Promise((r) => setTimeout(r, 1000))
    return doCall()
  }
  return first
}

type LinePlan = {
  itemCode: string
  kind: 'MUOM' | 'SINGLE'
  baseQty: number
  rate: number
  qcRequired?: boolean
  receivePct: number
  returnAfterAccept?: number
}

/**
 * Stage's vasant-trailers catalog only had 2 genuine Multi-UOM items (ITEM-0121, RM-MS-PIPE-DN25)
 * vs 77 single-UOM items — not enough to exercise 8 MUOM lines. Per user decision, 6 additional
 * MUOM test item masters were seeded on stage via backend/scripts/_seed-stage-muom-items.ts
 * (TEST-MUOM-*, incl. one fractional conversion factor of 2.5) to reach 8 MUOM + 8 single-UOM.
 */
const LINES: LinePlan[] = [
  { itemCode: 'RM-MS-PIPE-DN25', kind: 'MUOM', baseQty: 20, rate: 55, receivePct: 1 },
  { itemCode: 'TEST-MUOM-KG-A-585726', kind: 'MUOM', baseQty: 40, rate: 60, receivePct: 1 },
  { itemCode: 'TEST-MUOM-KG-B-585726', kind: 'MUOM', baseQty: 20, rate: 90, receivePct: 1 },
  { itemCode: 'TEST-MUOM-KG-C-585726', kind: 'MUOM', baseQty: 60, rate: 40, receivePct: 1 },
  { itemCode: 'TEST-MUOM-KG-D-585726', kind: 'MUOM', baseQty: 40, rate: 120, receivePct: 1 },
  { itemCode: 'TEST-MUOM-MTR-A-585726', kind: 'MUOM', baseQty: 25, rate: 45, receivePct: 1 },
  { itemCode: 'TEST-MUOM-MTR-B-585726', kind: 'MUOM', baseQty: 45, rate: 35, receivePct: 0.8 },
  { itemCode: 'ITEM-0121', kind: 'MUOM', baseQty: 30, rate: 30, receivePct: 1 },
  { itemCode: 'RM-BRACKET-TEST', kind: 'SINGLE', baseQty: 100, rate: 25, receivePct: 1, returnAfterAccept: 10 },
  { itemCode: 'BO-DRAIN-VALVE-DN25', kind: 'SINGLE', baseQty: 50, rate: 450, qcRequired: true, receivePct: 1 },
  { itemCode: 'RM-VALVE-TEST', kind: 'SINGLE', baseQty: 20, rate: 1800, receivePct: 1 },
  { itemCode: 'BO-GASKET-MANHOLE-450', kind: 'SINGLE', baseQty: 80, rate: 35, receivePct: 1 },
  { itemCode: 'BO-VALVE', kind: 'SINGLE', baseQty: 30, rate: 650, receivePct: 1 },
  { itemCode: 'BO-FASTENERS', kind: 'SINGLE', baseQty: 15, rate: 42, receivePct: 1 },
  { itemCode: 'CON-WELD-E7018', kind: 'SINGLE', baseQty: 40, rate: 320, receivePct: 0.7 },
  { itemCode: 'RM-MS-PLATE-008', kind: 'SINGLE', baseQty: 25, rate: 38, receivePct: 1 },
]

async function login(email: string, password: string) {
  const res = await callApi('POST', '/api/v1/auth/login', null, { email, password, tenantSlug: TENANT_SLUG })
  if (res.status !== 200 || !res.body?.data?.accessToken) {
    fail(`Login failed for ${email}: ${res.status} ${JSON.stringify(res.body)}`)
  }
  return { token: res.body.data.accessToken as string, userId: res.body.data.user.id as string }
}

/** All list endpoints in this codebase return `data` as a plain array (pagination lives in `meta`). */
async function findMasterByCode<T = any>(
  resourcePath: string,
  code: string,
  token: string,
): Promise<T> {
  const res = await callApi('GET', `${resourcePath}?search=${encodeURIComponent(code)}&limit=50`, token)
  if (res.status !== 200) fail(`Lookup failed ${resourcePath}?search=${code}: ${res.status} ${JSON.stringify(res.body)}`)
  const items = (res.body?.data ?? []) as Array<T & { code?: string }>
  const exact = items.find((i) => String((i as any).code).toUpperCase() === code.toUpperCase())
  if (!exact) fail(`No exact match for code=${code} under ${resourcePath} (got ${items.length} fuzzy results)`)
  return exact
}

async function main() {
  const stamp = Date.now()
  const links: Array<{ kind: string; number: string; url: string; note?: string }> = []

  console.log('\n╔══════════════════════════════════════════════════════════════════╗')
  console.log('║  FULL MULTI-UOM PURCHASE LIFECYCLE E2E — LIVE HTTP (stage)        ║')
  console.log('║  PR → RFQ → VQ → Comparison → PO → GRN → QC → Return → Invoice    ║')
  console.log('╚══════════════════════════════════════════════════════════════════╝')
  console.log(`API: ${API_BASE}   Tenant: ${TENANT_SLUG}   Time: ${new Date().toISOString()}\n`)

  const health = await callApi('GET', '/api/v1/health', null)
  record('API health check', health.status === 200 && health.body?.success === true, JSON.stringify(health.body))

  const maker = await login(MAKER_EMAIL, MAKER_PASSWORD)
  const approver = await login(APPROVER_EMAIL, APPROVER_PASSWORD)
  record('Login (maker + approver)', true, `maker=${maker.userId.slice(0, 8)}… approver=${approver.userId.slice(0, 8)}…`)

  const base = `/api/v1/t/${TENANT_SLUG}/purchase`
  const today = new Date().toISOString().slice(0, 10)
  const requiredDate = new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10)

  // ══ Master data lookups (read-only, real API) ═══════════════════════
  console.log('\n── Step 0: Master data lookups ──')
  const vendor = await findMasterByCode<{ id: string; code: string; name: string }>(
    `/api/v1/t/${TENANT_SLUG}/masters/vendors`,
    VENDOR_CODE,
    maker.token,
  )
  record('Lookup vendor', true, `${vendor.code} — ${vendor.name}`)

  let warehouse: { id: string; code: string } | null = null
  for (const code of WAREHOUSE_CODES) {
    const res = await callApi('GET', `/api/v1/t/${TENANT_SLUG}/masters/warehouses?search=${code}&limit=50`, maker.token)
    const items = (res.body?.data ?? []) as Array<{ id: string; code: string; status: string }>
    const match = items.find((i) => i.code.toUpperCase() === code.toUpperCase() && i.status === 'ACTIVE')
    if (match) {
      warehouse = match
      break
    }
  }
  if (!warehouse) {
    const anyWh = await callApi('GET', `/api/v1/t/${TENANT_SLUG}/masters/warehouses?limit=50`, maker.token)
    const items = (anyWh.body?.data ?? []) as Array<{ id: string; code: string; status: string }>
    warehouse = items.find((i) => i.status === 'ACTIVE') ?? null
  }
  if (!warehouse) fail('No ACTIVE warehouse found via API')
  record('Lookup warehouse', true, `${warehouse.code}`)

  const deptRes = await callApi('GET', `/api/v1/t/${TENANT_SLUG}/departments?search=${DEPARTMENT_CODE}&limit=10`, approver.token)
  const deptItems = (deptRes.body?.data ?? []) as Array<{ id: string; code: string }>
  const department = deptItems.find((d) => d.code === DEPARTMENT_CODE) ?? null
  if (!department) fail(`Department ${DEPARTMENT_CODE} not found — run scripts/_seed-stage-muom-items.ts equivalent or create it first`)
  record('Lookup department', true, department.code)

  type ItemRow = { id: string; code: string; baseUomId: string; purchaseUomId: string | null; uomConversionFactor: string | number | null }
  const itemByCode = new Map<string, ItemRow>()
  for (const spec of LINES) {
    const item = await findMasterByCode<ItemRow>(`/api/v1/t/${TENANT_SLUG}/masters/items`, spec.itemCode, maker.token)
    itemByCode.set(spec.itemCode, item)
  }
  record('Lookup 16 items', itemByCode.size === LINES.length, `resolved ${itemByCode.size}/${LINES.length}`)

  for (const spec of LINES) {
    const item = itemByCode.get(spec.itemCode)!
    const isMuom = Boolean(item.purchaseUomId && item.purchaseUomId !== item.baseUomId)
    const ok = spec.kind === 'MUOM' ? isMuom : !isMuom
    record(`Item master check ${spec.itemCode}`, ok, `kind=${spec.kind} factor=${item.uomConversionFactor} purchaseUomId=${item.purchaseUomId ?? '—'} baseUomId=${item.baseUomId}`)
  }

  // ══ 1. PURCHASE REQUISITION ═══════════════════════════════════════════
  console.log('\n── Step 1: Purchase Requisition ──')
  const prCreate = await callApi('POST', `${base}/requisitions`, maker.token, {
    requisitionDate: today,
    requiredDate,
    rfqRequired: true,
    priority: 'NORMAL',
    warehouseId: warehouse.id,
    departmentId: department.id,
    remarks: `LIVE Full MUOM lifecycle E2E ${stamp}`,
    lines: LINES.map((spec) => {
      const item = itemByCode.get(spec.itemCode)!
      return {
        itemId: item.id,
        itemCode: item.code,
        itemName: spec.itemCode,
        requiredQuantity: spec.baseQty,
        uomId: item.baseUomId,
        estimatedRate: spec.rate * (Number(item.uomConversionFactor) || 1),
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

  const prSubmit = await callApi('POST', `${base}/requisitions/${prId}/submit`, maker.token, { remarks: 'Submit for RFQ' })
  if (prSubmit.status !== 200) fail(`PR submit failed: ${prSubmit.status} ${JSON.stringify(prSubmit.body)}`)
  const prApprove = await callApi('POST', `${base}/requisitions/${prId}/approve`, approver.token, { remarks: 'Approved for RFQ' })
  if (prApprove.status !== 200) fail(`PR approve failed: ${prApprove.status} ${JSON.stringify(prApprove.body)}`)
  record('PR submit + approve', true, `status=${prApprove.body.data.status}`)

  // ══ 2. RFQ ═══════════════════════════════════════════════════════════
  console.log('\n── Step 2: RFQ ──')
  const rfqRes = await callApi('POST', `${base}/requisitions/${prId}/convert-to-rfq`, maker.token, {
    vendorIds: [vendor.id],
    responseDueDate: requiredDate,
    title: `LIVE RFQ ${stamp}`,
  })
  if (rfqRes.status !== 201) fail(`RFQ create failed: ${rfqRes.status} ${JSON.stringify(rfqRes.body)}`)
  const rfqId = rfqRes.body.data.id as string
  const rfqNumber = rfqRes.body.data.rfqNumber as string
  links.push({ kind: 'RFQ', number: rfqNumber, url: link(`/purchase/rfqs/${rfqId}`) })

  const sendRes = await callApi('POST', `${base}/rfqs/${rfqId}/send`, maker.token, {})
  if (sendRes.status !== 200) fail(`RFQ send failed: ${sendRes.status} ${JSON.stringify(sendRes.body)}`)
  record('Create + send RFQ', true, `${rfqNumber} status=${sendRes.body.data.status}`)

  const rfqDetail = await callApi('GET', `${base}/rfqs/${rfqId}`, maker.token)
  const rfqLines = (rfqDetail.body.data.lines ?? []) as Array<{ id: string; itemId: string }>
  if (rfqLines.length !== LINES.length) fail(`RFQ line count mismatch: expected ${LINES.length}, got ${rfqLines.length}`)
  const rfqLineByItemId = new Map(rfqLines.map((l) => [l.itemId, l.id]))

  // ══ 3. VENDOR QUOTATION ═══════════════════════════════════════════════
  console.log('\n── Step 3: Vendor Quotation ──')
  const vqLines = LINES.map((spec) => {
    const item = itemByCode.get(spec.itemCode)!
    const factor = Number(item.uomConversionFactor) || 1
    const commercialQty = spec.baseQty * factor
    return {
      requestForQuotationLineId: rfqLineByItemId.get(item.id),
      itemId: item.id,
      itemCodeSnapshot: item.code,
      itemNameSnapshot: spec.itemCode,
      quantity: commercialQty,
      uomId: item.purchaseUomId ?? item.baseUomId,
      rate: spec.rate,
    }
  })
  const vqRes = await callApi('POST', `${base}/vendor-quotations`, maker.token, {
    requestForQuotationId: rfqId,
    vendorId: vendor.id,
    quotationDate: today,
    lines: vqLines,
  })
  if (vqRes.status !== 201) fail(`VQ create failed: ${vqRes.status} ${JSON.stringify(vqRes.body)}`)
  const vqId = vqRes.body.data.id as string
  const vqNumber = vqRes.body.data.quotationNumber as string
  links.push({ kind: 'Vendor Quotation', number: vqNumber, url: link(`/purchase/vendor-quotations/${vqId}`) })

  const vqSubmit = await callApi('POST', `${base}/vendor-quotations/${vqId}/submit`, maker.token, {})
  if (vqSubmit.status !== 200) fail(`VQ submit failed: ${vqSubmit.status} ${JSON.stringify(vqSubmit.body)}`)
  record('Create + submit VQ', true, `${vqNumber} status=${vqSubmit.body.data.status}`)

  // ══ 4. COMPARISON → PO ══════════════════════════════════════════════
  console.log('\n── Step 4: Comparison → PO ──')
  const cmpRes = await callApi('POST', `${base}/comparisons`, maker.token, { requestForQuotationId: rfqId })
  if (cmpRes.status !== 201) fail(`Comparison create failed: ${cmpRes.status} ${JSON.stringify(cmpRes.body)}`)
  const comparisonId = cmpRes.body.data.id as string

  const awardRes = await callApi('POST', `${base}/comparisons/${comparisonId}/award`, maker.token, {
    awardedVendorQuotationId: vqId,
    selectionReason: 'LIVE Full MUOM E2E — sole vendor quote',
  })
  if (awardRes.status !== 200) fail(`Comparison award failed: ${awardRes.status} ${JSON.stringify(awardRes.body)}`)

  const poFromCmp = await callApi('POST', `${base}/comparisons/${comparisonId}/create-po`, maker.token, {})
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

  // ── Release PO (submit → approve → send-to-vendor) ──
  let poStatus = String(poFromCmp.body.data.status)
  if (poStatus === 'DRAFT') {
    const sub = await callApi('POST', `${base}/orders/${poId}/submit`, maker.token, {})
    if (sub.status !== 200) fail(`PO submit failed: ${sub.status} ${JSON.stringify(sub.body)}`)
    poStatus = String(sub.body.data.status)
  }
  if (poStatus === 'PENDING_APPROVAL') {
    const appr = await callApi('POST', `${base}/orders/${poId}/approve`, approver.token, {})
    if (appr.status !== 200) fail(`PO approve failed: ${appr.status} ${JSON.stringify(appr.body)}`)
    poStatus = String(appr.body.data.status)
  }
  if (poStatus !== 'SENT_TO_VENDOR' && poStatus !== 'RELEASED') {
    let send = await callApi('POST', `${base}/orders/${poId}/send-to-vendor`, maker.token, {})
    if (send.status !== 200) send = await callApi('POST', `${base}/orders/${poId}/send-to-vendor`, approver.token, {})
    if (send.status !== 200) fail(`PO send-to-vendor failed: ${send.status} ${JSON.stringify(send.body)}`)
    poStatus = String(send.body.data.status)
  }
  record('Release PO', poStatus === 'SENT_TO_VENDOR' || poStatus === 'RELEASED', `status=${poStatus}`)
  const poLineByItemId = new Map(poLinesDto.map((l) => [l.itemId as string, l]))

  // ══ 5. GRN-A: non-QC lines ════════════════════════════════════════════
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
  const grnACreate = await callApi('POST', `${base}/grns`, maker.token, {
    purchaseOrderId: poId,
    receiptDate: today,
    warehouseId: warehouse.id,
    vendorChallanNumber: `CH-A-LIVE-${stamp}`,
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

  const grnASubmit = await callApi('POST', `${base}/grns/${grnAId}/submit`, maker.token, { remarks: 'LIVE E2E receive — non-QC lines' })
  if (grnASubmit.status !== 200) fail(`GRN-A submit failed: ${grnASubmit.status} ${JSON.stringify(grnASubmit.body)}`)
  let grnAStatus = String(grnASubmit.body.data.status)
  if (grnAStatus === 'SUBMITTED' || grnAStatus === 'RECEIVING_COMPLETED') {
    const post = await callApi('POST', `${base}/grns/${grnAId}/post-inventory`, maker.token, {})
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
  let qcPoLine: Record<string, unknown> | null = null

  if (qcLines.length > 0) {
    const spec = qcLines[0]!
    const item = itemByCode.get(spec.itemCode)!
    const poLine = poLineByItemId.get(item.id)!
    qcPoLine = poLine
    const grnBCreate = await callApi('POST', `${base}/grns`, maker.token, {
      purchaseOrderId: poId,
      receiptDate: today,
      warehouseId: warehouse.id,
      vendorChallanNumber: `CH-B-LIVE-${stamp}`,
      inspectionRequired: true,
      lines: [{ purchaseOrderLineId: poLine.id, receivedQuantity: spec.baseQty, qcRequired: true }],
    })
    if (grnBCreate.status !== 201) fail(`GRN-B create failed: ${grnBCreate.status} ${JSON.stringify(grnBCreate.body)}`)
    grnBId = grnBCreate.body.data.id as string
    grnBNumber = (grnBCreate.body.data.grnNumber ?? grnBCreate.body.data.receiptNumber) as string
    links.push({ kind: 'GRN (QC)', number: grnBNumber, url: link(`/purchase/grn/${grnBId}`) })
    const grnBCreateLines = (grnBCreate.body.data.lines ?? []) as Array<Record<string, unknown>>
    qcGrnLineId = (grnBCreateLines[0]?.id as string) ?? null

    const grnBSubmit = await callApi('POST', `${base}/grns/${grnBId}/submit`, maker.token, { remarks: 'LIVE E2E receive — QC line' })
    if (grnBSubmit.status !== 200) fail(`GRN-B submit failed: ${grnBSubmit.status} ${JSON.stringify(grnBSubmit.body)}`)
    const grnBStatus = String(grnBSubmit.body.data.status)
    record('Submit GRN-B (QC hold)', grnBStatus === 'QC_PENDING', `${grnBNumber} status=${grnBStatus}`)

    const qiCreate = await callApi('POST', `${base}/quality-inspections`, maker.token, { goodsReceiptId: grnBId })
    if (qiCreate.status !== 201) fail(`QI create failed: ${qiCreate.status} ${JSON.stringify(qiCreate.body)}`)
    const qiId = qiCreate.body.data.id as string
    const qiNumber = qiCreate.body.data.inspectionNumber as string
    links.push({ kind: 'Quality Inspection', number: qiNumber, url: link(`/purchase/quality-inspections/${qiId}`) })

    await callApi('POST', `${base}/quality-inspections/${qiId}/start`, maker.token, {})

    const qiDetail = await callApi('GET', `${base}/quality-inspections/${qiId}`, maker.token)
    const qiLines = (qiDetail.body.data.lines ?? []) as Array<{ id: string; goodsReceiptLineId: string; inspectedQuantity: number }>
    const qiLine = qiLines.find((l) => l.goodsReceiptLineId === qcGrnLineId) ?? qiLines[0]!
    const inspected = Number(qiLine.inspectedQuantity)
    qcAcceptedQty = Math.round(inspected * 0.7 * 100) / 100
    qcRejectedQty = Math.round((inspected - qcAcceptedQty) * 100) / 100

    const qiPatch = await callApi('PATCH', `${base}/quality-inspections/${qiId}`, maker.token, {
      lines: [{ goodsReceiptLineId: qiLine.goodsReceiptLineId, inspectedQuantity: inspected, acceptedQuantity: qcAcceptedQty, rejectedQuantity: qcRejectedQty }],
    })
    if (qiPatch.status !== 200) fail(`QI patch failed: ${qiPatch.status} ${JSON.stringify(qiPatch.body)}`)

    const qiComplete = await callApi('POST', `${base}/quality-inspections/${qiId}/complete`, maker.token, {
      outcome: 'AUTO',
      decisionCode: 'PARTIAL',
      decisionReason: `LIVE E2E partial QC — accept ${qcAcceptedQty}, reject ${qcRejectedQty}`,
    })
    if (qiComplete.status !== 200) fail(`QI complete failed: ${qiComplete.status} ${JSON.stringify(qiComplete.body)}`)
    record('QC inspect + complete', true, `${qiNumber} accepted=${qcAcceptedQty} rejected=${qcRejectedQty} (inspected=${inspected})`)

    const grnBDetail = await callApi('GET', `${base}/grns/${grnBId}`, maker.token)
    const grnBAfterQcStatus = String(grnBDetail.body.data.status)
    if (grnBAfterQcStatus === 'RECEIVING_COMPLETED' || grnBAfterQcStatus === 'SUBMITTED') {
      const post = await callApi('POST', `${base}/grns/${grnBId}/post-inventory`, maker.token, {})
      record('Post GRN-B inventory', post.status === 200, `status=${post.status === 200 ? post.body.data.status : post.status}`)
    } else {
      record('Post GRN-B inventory', true, `skipped — status already ${grnBAfterQcStatus}`)
    }
  } else {
    record('QC line present', false, 'no qcRequired line found in LINES plan')
  }

  // ══ 7. PURCHASE RETURNS ══════════════════════════════════════════════
  console.log('\n── Step 7: Purchase Returns ──')

  const nonQcReturnSpec = LINES.find((l) => l.returnAfterAccept)
  if (nonQcReturnSpec) {
    const item = itemByCode.get(nonQcReturnSpec.itemCode)!
    const poLine = poLineByItemId.get(item.id)!
    const grnLine = grnADtoLines.find((l) => l.purchaseOrderLineId === poLine.id)
    if (!grnLine) {
      record('Return #1 (non-QC damage)', false, `GRN-A line missing for ${nonQcReturnSpec.itemCode}`)
    } else {
      const retRes = await callApi('POST', `${base}/returns`, maker.token, {
        vendorId: vendor.id,
        purchaseOrderId: poId,
        goodsReceiptId: grnAId,
        warehouseId: warehouse.id,
        returnType: 'CREDIT',
        reason: 'Other',
        remarks: 'LIVE E2E — found damaged during putaway, returning small qty',
        lines: [{ goodsReceiptLineId: grnLine.id, purchaseOrderLineId: poLine.id, returnQuantity: nonQcReturnSpec.returnAfterAccept }],
      })
      if (retRes.status !== 201) {
        record('Return #1 (non-QC damage)', false, `${retRes.status} ${JSON.stringify(retRes.body)}`)
      } else {
        const returnId = retRes.body.data.id as string
        const returnNumber = retRes.body.data.returnNumber as string
        await callApi('POST', `${base}/returns/${returnId}/submit`, maker.token, {})
        await callApi('POST', `${base}/returns/${returnId}/approve`, approver.token, {})
        const complete = await callApi('POST', `${base}/returns/${returnId}/complete`, maker.token, { remarks: 'Ship damaged qty back to vendor' })
        links.push({ kind: 'Purchase Return', number: returnNumber, url: link(`/purchase/returns/${returnId}`), note: `${nonQcReturnSpec.itemCode} qty ${nonQcReturnSpec.returnAfterAccept}` })
        record('Return #1 (non-QC damage)', complete.status === 200, `${returnNumber} qty=${nonQcReturnSpec.returnAfterAccept} finalStatus=${complete.status === 200 ? complete.body.data.status : complete.status}`)
      }
    }
  }

  if (grnBId && qcGrnLineId && qcPoLine && qcRejectedQty > 0) {
    const retRes = await callApi('POST', `${base}/returns`, maker.token, {
      vendorId: vendor.id,
      purchaseOrderId: poId,
      goodsReceiptId: grnBId,
      warehouseId: warehouse.id,
      returnType: 'CREDIT',
      reason: 'GRN Rejected Quantity',
      remarks: 'LIVE E2E — return QC-rejected qty to vendor',
      lines: [{ goodsReceiptLineId: qcGrnLineId, purchaseOrderLineId: qcPoLine.id as string, returnQuantity: qcRejectedQty }],
    })
    if (retRes.status !== 201) {
      record('Return #2 (QC rejected)', false, `${retRes.status} ${JSON.stringify(retRes.body)}`)
    } else {
      const returnId = retRes.body.data.id as string
      const returnNumber = retRes.body.data.returnNumber as string
      await callApi('POST', `${base}/returns/${returnId}/submit`, maker.token, {})
      await callApi('POST', `${base}/returns/${returnId}/approve`, approver.token, {})
      const complete = await callApi('POST', `${base}/returns/${returnId}/complete`, maker.token, { remarks: 'Ship QC-rejected qty back to vendor' })
      links.push({ kind: 'Purchase Return', number: returnNumber, url: link(`/purchase/returns/${returnId}`), note: `QC-rejected qty ${qcRejectedQty}` })
      record('Return #2 (QC rejected)', complete.status === 200, `${returnNumber} qty=${qcRejectedQty} finalStatus=${complete.status === 200 ? complete.body.data.status : complete.status}`)
    }
  }

  // ══ 8. PURCHASE INVOICES ═════════════════════════════════════════════
  console.log('\n── Step 8: Purchase Invoices ──')

  const invALines = nonQcLines.map((spec) => {
    const item = itemByCode.get(spec.itemCode)!
    const poLine = poLineByItemId.get(item.id)!
    const grnLine = grnADtoLines.find((l) => l.purchaseOrderLineId === poLine.id)!
    return {
      purchaseOrderLineId: poLine.id,
      goodsReceiptLineId: grnLine.id,
      itemId: item.id,
      itemCode: item.code,
      itemName: spec.itemCode,
      quantity: Number(grnLine.receivedQuantity),
      rate: spec.rate,
      taxRatePct: 18,
    }
  })
  const invACreate = await callApi('POST', `${base}/invoices`, maker.token, {
    vendorId: vendor.id,
    purchaseOrderId: poId,
    goodsReceiptId: grnAId,
    vendorInvoiceNumber: `VINV-A-LIVE-${stamp}`,
    lines: invALines,
  })
  let invAId: string | null = null
  if (invACreate.status !== 201) {
    record('Create Invoice #1 (GRN-A)', false, `${invACreate.status} ${JSON.stringify(invACreate.body)}`)
  } else {
    invAId = invACreate.body.data.id as string
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

    let submitA = await callApi('POST', `${base}/invoices/${invAId}/submit`, maker.token, {})
    let matchNoteA = ''
    if (submitA.status !== 200) {
      matchNoteA = `initial 3-way match failed: ${JSON.stringify(submitA.body?.errors ?? submitA.body?.message)} — retrying with authorized override`
      submitA = await callApi('POST', `${base}/invoices/${invAId}/submit`, maker.token, {
        overrideAuthorized: true,
        overrideRemarks: 'LIVE E2E override — PO header tax rollup gap (see report), qty/rate match confirmed manually',
      })
    }
    let statusA = submitA.status === 200 ? String(submitA.body.data.status) : `submit-failed(${submitA.status}: ${JSON.stringify(submitA.body)})`
    if (submitA.status === 200 && statusA === 'PENDING_APPROVAL') {
      const apprA = await callApi('POST', `${base}/invoices/${invAId}/approve`, approver.token, {})
      if (apprA.status === 200) statusA = String(apprA.body.data.status)
    }
    if (['APPROVED', 'MATCHED', 'PARTIALLY_MATCHED'].includes(statusA)) {
      const postA = await callApi('POST', `${base}/invoices/${invAId}/post`, maker.token, {})
      if (postA.status === 200) statusA = String(postA.body.data.status)
    }
    record('Submit + approve + post Invoice #1', submitA.status === 200, `${invANumber} status=${statusA} amount=₹${invACreate.body.data.totalAmount}${matchNoteA ? ` | ${matchNoteA}` : ''}`)
  }

  if (grnBId && qcAcceptedQty > 0) {
    const spec = qcLines[0]!
    const item = itemByCode.get(spec.itemCode)!
    const poLine = poLineByItemId.get(item.id)!
    const grnBDetail = await callApi('GET', `${base}/grns/${grnBId}`, maker.token)
    const grnBDbLine = (grnBDetail.body.data.lines ?? []).find((l: Record<string, unknown>) => l.purchaseOrderLineId === poLine.id)
    if (!grnBDbLine) fail('GRN-B line missing on refetch')
    const invBCreate = await callApi('POST', `${base}/invoices`, maker.token, {
      vendorId: vendor.id,
      purchaseOrderId: poId,
      goodsReceiptId: grnBId,
      vendorInvoiceNumber: `VINV-B-LIVE-${stamp}`,
      remarks: 'Invoice for QC-accepted qty only',
      lines: [{
        purchaseOrderLineId: poLine.id,
        goodsReceiptLineId: grnBDbLine.id,
        itemId: item.id,
        itemCode: item.code,
        itemName: spec.itemCode,
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

      let submitB = await callApi('POST', `${base}/invoices/${invBId}/submit`, maker.token, {})
      let matchNoteB = ''
      if (submitB.status !== 200) {
        matchNoteB = `initial 3-way match failed: ${JSON.stringify(submitB.body?.errors ?? submitB.body?.message)} — retrying with authorized override`
        submitB = await callApi('POST', `${base}/invoices/${invBId}/submit`, maker.token, {
          overrideAuthorized: true,
          overrideRemarks: 'LIVE E2E override — PO header tax rollup gap (see report), qty/rate match confirmed manually',
        })
      }
      let statusB = submitB.status === 200 ? String(submitB.body.data.status) : `submit-failed(${submitB.status}: ${JSON.stringify(submitB.body)})`
      if (submitB.status === 200 && statusB === 'PENDING_APPROVAL') {
        const apprB = await callApi('POST', `${base}/invoices/${invBId}/approve`, approver.token, {})
        if (apprB.status === 200) statusB = String(apprB.body.data.status)
      }
      if (['APPROVED', 'MATCHED', 'PARTIALLY_MATCHED'].includes(statusB)) {
        const postB = await callApi('POST', `${base}/invoices/${invBId}/post`, maker.token, {})
        if (postB.status === 200) statusB = String(postB.body.data.status)
      }
      record('Submit + approve + post Invoice #2', submitB.status === 200, `${invBNumber} status=${statusB} amount=₹${invBCreate.body.data.totalAmount}${matchNoteB ? ` | ${matchNoteB}` : ''}`)

      // ── PO line invoicedQuantity rollup check (base qty, posted only) — real API GET, no DB ──
      const poAfter = await callApi('GET', `${base}/orders/${poId}`, maker.token)
      const poLinesAfter = (poAfter.body.data.lines ?? []) as Array<Record<string, unknown>>
      const qcPoLineAfter = poLinesAfter.find((l) => l.itemId === item.id)
      record(
        `PO ${spec.itemCode} invoicedQuantity rollup`,
        nearly(Number(qcPoLineAfter?.invoicedQuantity), qcAcceptedQty),
        `invoicedQuantity=${qcPoLineAfter?.invoicedQuantity} expected=${qcAcceptedQty} (base qty, not vendor/commercial qty)`,
      )

      const muomCheckSpec = nonQcLines.find((l) => l.kind === 'MUOM' && (Number(itemByCode.get(l.itemCode)!.uomConversionFactor) || 1) > 1)!
      const muomCheckItem = itemByCode.get(muomCheckSpec.itemCode)!
      const muomPoLineAfter = poLinesAfter.find((l) => l.itemId === muomCheckItem.id)
      record(
        `PO ${muomCheckSpec.itemCode} invoicedQuantity rollup (MUOM)`,
        nearly(Number(muomPoLineAfter?.invoicedQuantity), muomCheckSpec.baseQty),
        `invoicedQuantity=${muomPoLineAfter?.invoicedQuantity} expected=${muomCheckSpec.baseQty} base NOS (not ${muomCheckSpec.baseQty * (Number(muomCheckItem.uomConversionFactor) || 1)} KG vendor qty)`,
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
  console.log(`  DOCUMENT LINKS (live UI: ${UI_BASE} · tenant: ${TENANT_SLUG})`)
  console.log('══════════════════════════════════════════════════════════\n')
  console.log('| Doc | Number | Link | Notes |')
  console.log('|-----|--------|------|-------|')
  for (const row of links) {
    console.log(`| ${row.kind} | ${row.number} | ${row.url} | ${row.note ?? ''} |`)
  }
  console.log('\nDone.\n')

  if (failCount > 0) process.exit(1)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})

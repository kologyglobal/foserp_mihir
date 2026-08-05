/**
 * CERT-02 live: Comparison → PO on MS-PIPE-DN25-KG (5000 KG @ ₹80/KG).
 * Asserts PO preserves commercial qty (5000 KG) and stock qty (100 NOS), not 5000 NOS.
 *
 * Usage (from backend/):
 *   npx tsx scripts/test-cert-02-comparison-po-muom.ts
 */
import request from 'supertest'
import { createApp } from '../src/app.js'
import { prisma } from '../src/config/prisma.js'

const TENANT_SLUG = process.env.TENANT_SLUG ?? 'vasant-trailers'
const MAKER_EMAIL = process.env.MAKER_EMAIL ?? 'purchase@vasant-trailers.com'
const MAKER_PASSWORD = process.env.MAKER_PASSWORD ?? 'Purchase@123'
const APPROVER_EMAIL = process.env.APPROVER_EMAIL ?? 'admin@vasant-trailers.com'
const APPROVER_PASSWORD = process.env.APPROVER_PASSWORD ?? 'Admin@123'

const ITEM_CODE = 'MS-PIPE-DN25-KG'
const COMMERCIAL_QTY = 5000
const FACTOR = 50
const RATE = 80
const EXPECTED_STOCK = 100
const EXPECTED_AMOUNT = 400_000

const app = createApp()

function isoToday(): string {
  return new Date().toISOString().slice(0, 10)
}

function auth(token: string) {
  return { Authorization: `Bearer ${token}` }
}

function nearly(a: number, b: number, eps = 1e-4): boolean {
  return Math.abs(a - b) <= eps
}

async function login(email: string, password: string) {
  const res = await request(app).post('/api/v1/auth/login').send({
    email,
    password,
    tenantSlug: TENANT_SLUG,
  })
  if (res.status !== 200 || !res.body.data?.accessToken) {
    throw new Error(`Login failed for ${email}: ${res.status} ${JSON.stringify(res.body)}`)
  }
  return res.body.data.accessToken as string
}

async function main() {
  console.log('\n╔══════════════════════════════════════════════════════════════╗')
  console.log('║  CERT-02: Comparison → PO (MS-PIPE-DN25-KG, 5000 KG)        ║')
  console.log('╚══════════════════════════════════════════════════════════════╝')
  console.log(`Tenant: ${TENANT_SLUG}`)
  console.log(`Time:   ${new Date().toISOString()}\n`)

  const tenant = await prisma.tenant.findFirst({ where: { slug: TENANT_SLUG, deletedAt: null } })
  if (!tenant) throw new Error(`Tenant not found: ${TENANT_SLUG}`)

  const item = await prisma.masterItem.findFirst({
    where: { tenantId: tenant.id, code: ITEM_CODE, deletedAt: null },
  })
  if (!item) {
    throw new Error(`Item ${ITEM_CODE} not found — run: npx tsx scripts/seed-multi-uom-test-items.ts`)
  }

  const kgUom = await prisma.masterUom.findFirst({
    where: { tenantId: tenant.id, code: { in: ['KG', 'Kg'] }, deletedAt: null },
  })
  const nosUom = await prisma.masterUom.findFirst({
    where: { tenantId: tenant.id, code: { in: ['NOS', 'Nos'] }, deletedAt: null },
  })
  if (!kgUom || !nosUom) throw new Error('KG and NOS UOMs required')

  const vendor = await prisma.masterVendor.findFirst({
    where: { tenantId: tenant.id, deletedAt: null, status: 'ACTIVE', isBlocked: false },
    orderBy: { code: 'asc' },
  })
  if (!vendor) throw new Error('No active vendor found')

  const warehouse = await prisma.masterWarehouse.findFirst({
    where: { tenantId: tenant.id, deletedAt: null, status: 'ACTIVE' },
    orderBy: { code: 'asc' },
  })
  if (!warehouse) throw new Error('No active warehouse found')

  const makerToken = await login(MAKER_EMAIL, MAKER_PASSWORD)
  const approverToken = await login(APPROVER_EMAIL, APPROVER_PASSWORD)
  const base = `/api/v1/t/${TENANT_SLUG}/purchase`
  const today = isoToday()
  const requiredDate = new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10)

  console.log(`Item: ${item.code} (factor ${FACTOR})`)
  console.log(`Vendor: ${vendor.code}`)
  console.log(`Commercial: ${COMMERCIAL_QTY} KG @ ₹${RATE}/KG → expect ${EXPECTED_STOCK} NOS\n`)

  // ── PR ──────────────────────────────────────────────────────────────────
  const prRes = await request(app)
    .post(`${base}/requisitions`)
    .set(auth(makerToken))
    .send({
      requisitionDate: today,
      requiredDate,
      departmentId: 'dept-ops',
      rfqRequired: true,
      priority: 'NORMAL',
      lines: [
        {
          itemId: item.id,
          itemCode: item.code,
          itemName: item.name,
          requiredQuantity: EXPECTED_STOCK,
          estimatedRate: RATE,
          uomId: kgUom.id,
          preferredVendorId: vendor.id,
          requiredDate,
        },
      ],
    })
  if (prRes.status !== 201) {
    throw new Error(`PR create failed: ${prRes.status} ${JSON.stringify(prRes.body)}`)
  }
  const prId = prRes.body.data.id as string
  console.log(`✓ PR created: ${prRes.body.data.requisitionNumber ?? prId}`)

  await request(app).post(`${base}/requisitions/${prId}/submit`).set(auth(makerToken)).send({})
  await request(app).post(`${base}/requisitions/${prId}/approve`).set(auth(approverToken)).send({})

  // ── RFQ ─────────────────────────────────────────────────────────────────
  const rfqRes = await request(app)
    .post(`${base}/requisitions/${prId}/convert-to-rfq`)
    .set(auth(makerToken))
    .send({ vendorIds: [vendor.id] })
  if (rfqRes.status !== 201) {
    throw new Error(`RFQ create failed: ${rfqRes.status} ${JSON.stringify(rfqRes.body)}`)
  }
  const rfqId = rfqRes.body.data.id as string
  console.log(`✓ RFQ created: ${rfqRes.body.data.rfqNumber ?? rfqId}`)

  await request(app).post(`${base}/rfqs/${rfqId}/send`).set(auth(makerToken)).send({})

  const rfqDetail = await request(app).get(`${base}/rfqs/${rfqId}`).set(auth(makerToken))
  const rfqLineId = rfqDetail.body.data.lines[0].id as string

  // ── VQ (commercial qty = 5000 KG) ───────────────────────────────────────
  const vqRes = await request(app)
    .post(`${base}/vendor-quotations`)
    .set(auth(makerToken))
    .send({
      requestForQuotationId: rfqId,
      vendorId: vendor.id,
      quotationDate: today,
      lines: [
        {
          requestForQuotationLineId: rfqLineId,
          itemId: item.id,
          itemCodeSnapshot: item.code,
          itemNameSnapshot: item.name,
          quantity: COMMERCIAL_QTY,
          uomId: kgUom.id,
          rate: RATE,
        },
      ],
    })
  if (vqRes.status !== 201) {
    throw new Error(`VQ create failed: ${vqRes.status} ${JSON.stringify(vqRes.body)}`)
  }
  const vqId = vqRes.body.data.id as string
  console.log(`✓ VQ created: ${vqRes.body.data.quotationNumber ?? vqId} qty=${COMMERCIAL_QTY} KG`)

  await request(app).post(`${base}/vendor-quotations/${vqId}/submit`).set(auth(makerToken)).send({})

  // ── Comparison → PO ───────────────────────────────────────────────────
  const cmpRes = await request(app)
    .post(`${base}/comparisons`)
    .set(auth(makerToken))
    .send({ requestForQuotationId: rfqId })
  if (cmpRes.status !== 201) {
    throw new Error(`Comparison create failed: ${cmpRes.status} ${JSON.stringify(cmpRes.body)}`)
  }
  const comparisonId = cmpRes.body.data.id as string

  await request(app)
    .post(`${base}/comparisons/${comparisonId}/award`)
    .set(auth(makerToken))
    .send({ awardedVendorQuotationId: vqId, selectionReason: 'CERT-02 MUOM lowest rate' })

  const poRes = await request(app)
    .post(`${base}/comparisons/${comparisonId}/create-po`)
    .set(auth(makerToken))
    .send({})
  if (poRes.status !== 201) {
    throw new Error(`Create PO failed: ${poRes.status} ${JSON.stringify(poRes.body)}`)
  }

  const po = poRes.body.data
  const poLine = (po.lines ?? [])[0] as Record<string, unknown>
  const poNumber = po.orderNumber as string
  console.log(`✓ PO from comparison: ${poNumber} origin=${po.origin}`)

  const poDb = await prisma.purchaseOrder.findFirst({
    where: { id: po.id as string, tenantId: tenant.id },
    include: { lines: true },
  })
  const dbLine = poDb?.lines[0]
  if (!dbLine) throw new Error('PO line missing in DB')

  const checks: Array<[string, number, number]> = [
    ['DB uomQuantity (KG)', COMMERCIAL_QTY, Number(dbLine.uomQuantity)],
    ['DB quantity (NOS stock)', EXPECTED_STOCK, Number(dbLine.quantity)],
    ['DB uomConversionFactor', FACTOR, Number(dbLine.uomConversionFactor)],
    ['DB amount', EXPECTED_AMOUNT, Number(dbLine.amount)],
    ['API quantity (NOS)', EXPECTED_STOCK, Number(poLine.quantity)],
    ['API amount', EXPECTED_AMOUNT, Number(poLine.amount)],
  ]

  let pass = 0
  let fail = 0
  console.log('\n── CERT-02 assertions (DB = source of truth) ──')
  for (const [label, expected, actual] of checks) {
    const ok = nearly(expected, actual)
    console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${label}: expected=${expected} actual=${actual}`)
    if (ok) pass++
    else fail++
  }

  const not5000Nos = Number(dbLine.quantity) !== COMMERCIAL_QTY
  console.log(`  ${not5000Nos ? 'PASS' : 'FAIL'}  NOT 5000 NOS bug: DB quantity=${dbLine.quantity}`)
  if (not5000Nos) pass++
  else fail++

  const apiUomQty = Number(poLine.uomQuantity)
  if (Number.isNaN(apiUomQty) || apiUomQty === 0) {
    console.log(`  WARN  API response missing uomQuantity (DB has ${dbLine.uomQuantity}) — DTO gap only`)
  }

  console.log(`\nResult: ${fail === 0 ? 'CERT-02 PASS' : 'CERT-02 FAIL'} (${pass}/${pass + fail})\n`)
  if (fail > 0) process.exit(1)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })

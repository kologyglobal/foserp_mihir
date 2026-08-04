/**
 * UAT: Purchase backdated PO policy (create, limit, approval gate on send-to-vendor).
 *
 * Usage (stage DB from PC):
 *   Remove-Item Env:DATABASE_URL -ErrorAction SilentlyContinue
 *   $env:DB_HOST="srv1491.hstgr.io"
 *   $env:DB_PORT="3306"
 *   $env:DB_NAME="u233611619_foserp"
 *   $env:DB_USER="u233611619_erpuser_jul"
 *   $env:DB_PASS='...'
 *   npx tsx scripts/test-purchase-backdate-po-uat.ts
 */
import request from 'supertest'
import { createApp } from '../src/app.js'
import { prisma } from '../src/config/prisma.js'

const TENANT_SLUG = process.env.TENANT_SLUG ?? 'vasant-trailers'
const ITEM_CODE = 'BO-FASTENERS'
const VENDOR_CODE = 'VND-FAST-04'
const WAREHOUSE_CODE = 'BO-MAIN'

const app = createApp()

type Step = { step: string; ok: boolean; detail: string }

function fail(msg: string): never {
  console.error(`\n✗ ${msg}`)
  process.exit(1)
}

function isoDaysAgo(days: number): string {
  const d = new Date()
  d.setUTCDate(d.getUTCDate() - days)
  return d.toISOString().slice(0, 10)
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
  return res.body.data.accessToken as string
}

function auth(token: string) {
  return { Authorization: `Bearer ${token}` }
}

function errorCode(res: request.Response): string | undefined {
  return res.body?.error?.code ?? res.body?.code
}

async function ensureVendor(tenantId: string) {
  const existing = await prisma.masterVendor.findFirst({
    where: { tenantId, code: VENDOR_CODE, deletedAt: null },
  })
  if (existing) return existing
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

async function createDraftPo(
  token: string,
  base: string,
  vendorId: string,
  itemId: string,
  warehouseId: string,
  orderDate: string,
) {
  return request(app)
    .post(`${base}/orders`)
    .set(auth(token))
    .send({
      orderDate,
      vendorId,
      deliveryWarehouseId: warehouseId,
      expectedDeliveryDate: isoDaysAgo(-7),
      lines: [{ itemId, uomQuantity: 10, rate: 15 }],
      remarks: `Backdate UAT ${orderDate}`,
    })
}

async function main() {
  const results: Step[] = []
  const push = (step: string, ok: boolean, detail: string) => {
    results.push({ step, ok, detail })
    console.log(`${ok ? '✓' : '✗'} ${step}: ${detail}`)
    if (!ok) fail(detail)
  }

  console.log(`\n=== Backdated PO UAT (${TENANT_SLUG}) ===\n`)

  const cols = await prisma.$queryRaw<Array<{ cnt: bigint }>>`
    SELECT COUNT(*) AS cnt FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'purchase_settings'
      AND COLUMN_NAME IN ('allowBackdatedPo', 'backdatedPoDaysLimit', 'requireApprovalForBackdatedPo')
  `
  const colCount = Number(cols[0]?.cnt ?? 0)
  push('Schema columns', colCount === 3, `purchase_settings backdate columns=${colCount}/3`)

  const tenant = await prisma.tenant.findFirst({
    where: { slug: TENANT_SLUG, deletedAt: null },
  })
  if (!tenant) fail(`Tenant not found: ${TENANT_SLUG}`)

  const item = await prisma.masterItem.findFirst({
    where: { tenantId: tenant.id, code: ITEM_CODE, deletedAt: null },
  })
  if (!item) fail(`Item ${ITEM_CODE} missing`)

  const warehouse = await prisma.masterWarehouse.findFirst({
    where: { tenantId: tenant.id, code: WAREHOUSE_CODE, deletedAt: null, status: 'ACTIVE' },
  })
  if (!warehouse) fail(`Warehouse ${WAREHOUSE_CODE} missing`)

  const vendor = await ensureVendor(tenant.id)

  const settingsRow = await prisma.purchaseSettings.findFirst({
    where: { tenantId: tenant.id, plantId: null, deletedAt: null },
  })
  if (!settingsRow) fail('purchase_settings row missing for tenant')

  const savedPolicy = {
    allowBackdatedPo: Boolean((settingsRow as { allowBackdatedPo?: boolean }).allowBackdatedPo),
    backdatedPoDaysLimit: Number(
      (settingsRow as { backdatedPoDaysLimit?: number }).backdatedPoDaysLimit ?? 0,
    ),
    requireApprovalForBackdatedPo:
      (settingsRow as { requireApprovalForBackdatedPo?: boolean }).requireApprovalForBackdatedPo !==
      false,
  }

  const makerToken = await login('purchase@vasant-trailers.com', 'Purchase@123')
  const approverToken = await login('admin@vasant-trailers.com', 'Admin@123')
  const adminSetupToken = await login('admin@vasant-trailers.com', 'Admin@123')
  push('Auth', true, 'purchase@ + admin@ logged in')

  const base = `/api/v1/t/${TENANT_SLUG}/purchase`
  const setupBase = `${base}/setup`

  const patchPolicy = async (patch: Record<string, unknown>) => {
    const res = await request(app)
      .patch(setupBase)
      .set(auth(adminSetupToken))
      .send({ general: patch })
    if (res.status !== 200) {
      fail(`Setup patch failed: ${res.status} ${JSON.stringify(res.body)}`)
    }
  }

  await patchPolicy({
    allowBackdatedPo: true,
    backdatedPoDaysLimit: 7,
    requireApprovalForBackdatedPo: true,
  })
  push('Enable policy', true, 'allow=7d, approval required')

  const yesterday = isoDaysAgo(1)
  const createOk = await createDraftPo(
    makerToken,
    base,
    vendor.id,
    item.id,
    warehouse.id,
    yesterday,
  )
  push(
    'Create backdated PO',
    createOk.status === 201,
    `orderDate=${yesterday} status=${createOk.status} code=${createOk.body?.data?.orderNumber ?? '—'}`,
  )
  const poId = createOk.body.data.id as string

  const sendBlocked = await request(app)
    .post(`${base}/orders/${poId}/send-to-vendor`)
    .set(auth(makerToken))
    .send({})
  push(
    'Send blocked (draft)',
    sendBlocked.status === 400 && errorCode(sendBlocked) === 'PO_BACKDATE_APPROVAL_REQUIRED',
    `status=${sendBlocked.status} code=${errorCode(sendBlocked)}`,
  )

  const submit = await request(app)
    .post(`${base}/orders/${poId}/submit`)
    .set(auth(makerToken))
    .send({})
  push('Submit backdated PO', submit.status === 200, `status=${submit.body?.data?.status}`)

  const approve = await request(app)
    .post(`${base}/orders/${poId}/approve`)
    .set(auth(approverToken))
    .send({})
  push('Approve backdated PO', approve.status === 200, `status=${approve.body?.data?.status}`)

  const sendOk = await request(app)
    .post(`${base}/orders/${poId}/send-to-vendor`)
    .set(auth(makerToken))
    .send({})
  push(
    'Send after approval',
    sendOk.status === 200 && sendOk.body?.data?.status === 'SENT_TO_VENDOR',
    `status=${sendOk.body?.data?.status}`,
  )

  const tooOld = isoDaysAgo(30)
  const exceed = await createDraftPo(
    makerToken,
    base,
    vendor.id,
    item.id,
    warehouse.id,
    tooOld,
  )
  push(
    'Reject beyond limit',
    exceed.status === 400 && errorCode(exceed) === 'PO_BACKDATE_EXCEEDS_LIMIT',
    `orderDate=${tooOld} status=${exceed.status} code=${errorCode(exceed)}`,
  )

  await patchPolicy({ allowBackdatedPo: false })
  const blocked = await createDraftPo(
    makerToken,
    base,
    vendor.id,
    item.id,
    warehouse.id,
    yesterday,
  )
  push(
    'Reject when disabled',
    blocked.status === 400 && errorCode(blocked) === 'PO_BACKDATE_NOT_ALLOWED',
    `status=${blocked.status} code=${errorCode(blocked)}`,
  )

  await patchPolicy(savedPolicy)
  push('Restore policy', true, JSON.stringify(savedPolicy))

  console.log('\n── Summary ──')
  for (const r of results) {
    console.log(`  ${r.ok ? 'PASS' : 'FAIL'}  ${r.step.padEnd(24)} ${r.detail}`)
  }
  console.log('\nAll backdated PO UAT checks passed.\n')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })

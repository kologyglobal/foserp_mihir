/**
 * UAT against live stage API (no direct DB credentials in shell).
 *
 * Usage:
 *   $env:STAGE_API_BASE="https://stageapi.dhurandharcrm.com"
 *   npx tsx scripts/test-purchase-backdate-po-uat-api.ts
 */
const BASE = (process.env.STAGE_API_BASE ?? 'https://stageapi.dhurandharcrm.com').replace(/\/$/, '')
const TENANT_SLUG = process.env.TENANT_SLUG ?? 'vasant-trailers'
const ITEM_CODE = process.env.UAT_ITEM_CODE ?? 'BO-FASTENERS'
const VENDOR_CODE = process.env.UAT_VENDOR_CODE ?? 'VND-FAST-04'
const WAREHOUSE_CODE = process.env.UAT_WAREHOUSE_CODE ?? 'BO-MAIN'

type Json = Record<string, unknown>

function fail(msg: string): never {
  console.error(`\n✗ ${msg}`)
  process.exit(1)
}

function isoDaysAgo(days: number): string {
  const d = new Date()
  d.setUTCDate(d.getUTCDate() - days)
  return d.toISOString().slice(0, 10)
}

async function api(
  path: string,
  opts: { method?: string; token?: string; body?: unknown } = {},
): Promise<{ status: number; body: Json }> {
  const headers: Record<string, string> = { Accept: 'application/json' }
  if (opts.token) headers.Authorization = `Bearer ${opts.token}`
  if (opts.body !== undefined) headers['Content-Type'] = 'application/json'
  const res = await fetch(`${BASE}${path}`, {
    method: opts.method ?? (opts.body !== undefined ? 'POST' : 'GET'),
    headers,
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
  })
  const text = await res.text()
  let body: Json = {}
  try {
    body = text ? (JSON.parse(text) as Json) : {}
  } catch {
    body = { raw: text }
  }
  return { status: res.status, body }
}

async function login(email: string, password: string) {
  const res = await api('/api/v1/auth/login', {
    method: 'POST',
    body: { email, password, tenantSlug: TENANT_SLUG },
  })
  const token = (res.body.data as Json | undefined)?.accessToken
  if (res.status !== 200 || typeof token !== 'string') {
    fail(`Login ${email}: ${res.status} ${JSON.stringify(res.body)}`)
  }
  return token
}

function errorCode(body: Json): string | undefined {
  const err = body.error as Json | undefined
  return (err?.code as string | undefined) ?? (body.code as string | undefined)
}

async function findMasterId(
  token: string,
  resource: 'items' | 'vendors' | 'warehouses',
  code: string,
): Promise<string> {
  const res = await api(
    `/api/v1/t/${TENANT_SLUG}/masters/${resource}?search=${encodeURIComponent(code)}&limit=20`,
    { token },
  )
  if (res.status !== 200) fail(`List ${resource}: ${res.status} ${JSON.stringify(res.body)}`)
  const data = res.body.data as Json | Array<{ id: string; code?: string }> | undefined
  const rows = (Array.isArray(data)
    ? data
    : ((data?.items ?? data?.vendors ?? data?.warehouses ?? data?.rows) as
        | Array<{ id: string; code?: string }>
        | undefined)) as Array<{ id: string; code?: string }> | undefined
  const hit = rows?.find((r) => r.code === code)
  if (!hit?.id) fail(`${resource} ${code} not found`)
  return hit.id
}

async function main() {
  console.log(`\n=== Backdated PO API UAT (${BASE}, tenant=${TENANT_SLUG}) ===\n`)

  const health = await api('/api/v1/health')
  console.log(`${health.status === 200 ? '✓' : '✗'} Health: ${health.status}`)

  const makerToken = await login('purchase@vasant-trailers.com', 'Purchase@123')
  const approverToken = await login('admin@vasant-trailers.com', 'Admin@123')
  console.log('✓ Auth: purchase@ + admin@')

  const itemId = await findMasterId(makerToken, 'items', ITEM_CODE)
  const vendorId = await findMasterId(makerToken, 'vendors', VENDOR_CODE)
  const warehouseId = await findMasterId(makerToken, 'warehouses', WAREHOUSE_CODE)
  console.log(`✓ Masters: item=${ITEM_CODE} vendor=${VENDOR_CODE} wh=${WAREHOUSE_CODE}`)

  const base = `/api/v1/t/${TENANT_SLUG}/purchase`
  const setupPath = `${base}/setup`

  const setupGet = await api(setupPath, { token: approverToken })
  if (setupGet.status !== 200) fail(`GET setup: ${setupGet.status}`)
  const general = ((setupGet.body.data as Json)?.general ?? {}) as Json
  const savedPolicy = {
    allowBackdatedPo: Boolean(general.allowBackdatedPo),
    backdatedPoDaysLimit: Number(general.backdatedPoDaysLimit ?? 0),
    requireApprovalForBackdatedPo: general.requireApprovalForBackdatedPo !== false,
  }

  const patchSetup = async (patch: Json) => {
    const res = await api(setupPath, {
      method: 'PATCH',
      token: approverToken,
      body: { general: patch },
    })
    if (res.status !== 200) fail(`PATCH setup: ${res.status} ${JSON.stringify(res.body)}`)
  }

  await patchSetup({
    allowBackdatedPo: true,
    backdatedPoDaysLimit: 7,
    requireApprovalForBackdatedPo: true,
  })
  console.log('✓ Policy enabled: allow 7 days, approval required')

  const yesterday = isoDaysAgo(1)
  const createOk = await api(`${base}/orders`, {
    method: 'POST',
    token: makerToken,
    body: {
      orderDate: yesterday,
      vendorId,
      deliveryWarehouseId: warehouseId,
      expectedDeliveryDate: isoDaysAgo(-7),
      lines: [{ itemId, uomQuantity: 10, rate: 15 }],
      remarks: `Backdate API UAT ${yesterday}`,
    },
  })
  const poId = (createOk.body.data as Json | undefined)?.id as string | undefined
  const poNo = (createOk.body.data as Json | undefined)?.orderNumber
  if (createOk.status !== 201 || !poId) {
    fail(`Create backdated PO: ${createOk.status} ${JSON.stringify(createOk.body)}`)
  }
  console.log(`✓ Create backdated PO: ${poNo} orderDate=${yesterday}`)

  const sendBlocked = await api(`${base}/orders/${poId}/send-to-vendor`, {
    method: 'POST',
    token: makerToken,
    body: {},
  })
  if (sendBlocked.status !== 400 || errorCode(sendBlocked.body) !== 'PO_BACKDATE_APPROVAL_REQUIRED') {
    fail(`Expected send blocked: ${sendBlocked.status} ${JSON.stringify(sendBlocked.body)}`)
  }
  console.log('✓ Send blocked on draft: PO_BACKDATE_APPROVAL_REQUIRED')

  const submit = await api(`${base}/orders/${poId}/submit`, { method: 'POST', token: makerToken, body: {} })
  if (submit.status !== 200) fail(`Submit: ${submit.status} ${JSON.stringify(submit.body)}`)
  console.log(`✓ Submit: ${(submit.body.data as Json)?.status}`)

  const approve = await api(`${base}/orders/${poId}/approve`, {
    method: 'POST',
    token: approverToken,
    body: {},
  })
  if (approve.status !== 200) fail(`Approve: ${approve.status} ${JSON.stringify(approve.body)}`)
  console.log(`✓ Approve: ${(approve.body.data as Json)?.status}`)

  const sendOk = await api(`${base}/orders/${poId}/send-to-vendor`, {
    method: 'POST',
    token: makerToken,
    body: {},
  })
  if (sendOk.status !== 200 || (sendOk.body.data as Json)?.status !== 'SENT_TO_VENDOR') {
    fail(`Send after approval: ${sendOk.status} ${JSON.stringify(sendOk.body)}`)
  }
  console.log('✓ Send after approval: SENT_TO_VENDOR')

  const tooOld = isoDaysAgo(30)
  const exceed = await api(`${base}/orders`, {
    method: 'POST',
    token: makerToken,
    body: {
      orderDate: tooOld,
      vendorId,
      deliveryWarehouseId: warehouseId,
      lines: [{ itemId, uomQuantity: 5, rate: 15 }],
    },
  })
  if (exceed.status !== 400 || errorCode(exceed.body) !== 'PO_BACKDATE_EXCEEDS_LIMIT') {
    fail(`Expected exceed limit: ${exceed.status} ${JSON.stringify(exceed.body)}`)
  }
  console.log(`✓ Beyond 7-day limit rejected: PO_BACKDATE_EXCEEDS_LIMIT`)

  await patchSetup({ allowBackdatedPo: false })
  const blocked = await api(`${base}/orders`, {
    method: 'POST',
    token: makerToken,
    body: {
      orderDate: yesterday,
      vendorId,
      deliveryWarehouseId: warehouseId,
      lines: [{ itemId, uomQuantity: 5, rate: 15 }],
    },
  })
  if (blocked.status !== 400 || errorCode(blocked.body) !== 'PO_BACKDATE_NOT_ALLOWED') {
    fail(`Expected not allowed: ${blocked.status} ${JSON.stringify(blocked.body)}`)
  }
  console.log('✓ Disabled policy rejects backdate: PO_BACKDATE_NOT_ALLOWED')

  await patchSetup(savedPolicy)
  console.log(`✓ Restored original policy: ${JSON.stringify(savedPolicy)}`)

  console.log('\nAll backdated PO API UAT checks passed.\n')
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})

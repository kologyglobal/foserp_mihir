/**
 * Upsert sample payment-terms CRM masters via API.
 * Usage: npx tsx scripts/seed-payment-terms.ts
 */
const BASE = process.env.VITE_API_BASE_URL ?? 'http://127.0.0.1:5000/api/v1'
const TENANT = process.env.VITE_TENANT_SLUG ?? 'vasant-trailers'
const EMAIL = process.env.SEED_EMAIL ?? 'admin@vasant-trailers.com'
const PASSWORD = process.env.SEED_PASSWORD ?? 'Admin@123'

const PAYMENT_TERMS = [
  { code: '100_advance', name: '100% Advance', sortOrder: 1, attributes: { advancePct: 100, creditDays: 0, approvalRequired: false } },
  { code: '30_pi', name: '30% Advance, Balance Against PI', sortOrder: 2, attributes: { advancePct: 30, creditDays: 0, approvalRequired: false } },
  { code: '50_50', name: '50% Advance, 50% Before Dispatch', sortOrder: 3, attributes: { advancePct: 50, creditDays: 0, approvalRequired: false } },
  { code: 'credit_30', name: 'Credit 30 Days', sortOrder: 4, attributes: { advancePct: 0, creditDays: 30, approvalRequired: true } },
  { code: 'milestone', name: 'Milestone Payment', sortOrder: 5, attributes: { advancePct: 25, creditDays: 0, approvalRequired: true } },
  { code: 'adv_20', name: '20% Advance, Balance Before Dispatch', sortOrder: 6, attributes: { advancePct: 20, creditDays: 0, approvalRequired: false } },
  { code: 'adv_40', name: '40% Advance, 60% Before Dispatch', sortOrder: 7, attributes: { advancePct: 40, creditDays: 0, approvalRequired: false } },
  { code: 'credit_45', name: 'Credit 45 Days', sortOrder: 8, attributes: { advancePct: 0, creditDays: 45, approvalRequired: true } },
  { code: 'credit_60', name: 'Credit 60 Days', sortOrder: 9, attributes: { advancePct: 0, creditDays: 60, approvalRequired: true } },
  { code: 'credit_90', name: 'Credit 90 Days', sortOrder: 10, attributes: { advancePct: 0, creditDays: 90, approvalRequired: true } },
  { code: 'lc_sight', name: 'LC at Sight', sortOrder: 11, attributes: { advancePct: 0, creditDays: 0, approvalRequired: false } },
  { code: 'lc_30', name: 'LC 30 Days', sortOrder: 12, attributes: { advancePct: 0, creditDays: 30, approvalRequired: false } },
  { code: 'against_delivery', name: 'Payment Against Delivery', sortOrder: 13, attributes: { advancePct: 0, creditDays: 0, approvalRequired: false } },
  { code: 'against_proforma', name: 'Against Proforma Invoice', sortOrder: 14, attributes: { advancePct: 30, creditDays: 0, approvalRequired: false } },
  { code: 'retention_10', name: '10% Retention for 12 Months', sortOrder: 15, attributes: { advancePct: 90, creditDays: 0, approvalRequired: true } },
] as const

async function main() {
  const loginRes = await fetch(`${BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: EMAIL, password: PASSWORD, tenantSlug: TENANT }),
  })
  const login = (await loginRes.json()) as { data?: { accessToken?: string }; message?: string }
  const token = login.data?.accessToken
  if (!token) throw new Error(`Login failed: ${login.message ?? loginRes.status}`)

  const headers = {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  }

  // Trigger sync ensureSeedRows path (payment terms) after backend reload
  await fetch(`${BASE}/t/${TENANT}/crm/masters/sync`, { headers })

  const listRes = await fetch(`${BASE}/t/${TENANT}/crm/masters/payment-terms?limit=100`, { headers })
  const listJson = (await listRes.json()) as {
    data?: Array<{ id: string; code: string }> | { items?: Array<{ id: string; code: string }> }
  }
  const existing = Array.isArray(listJson.data) ? listJson.data : (listJson.data?.items ?? [])
  const byCode = new Map(existing.map((e) => [e.code, e.id]))

  let created = 0
  let skipped = 0
  let failed = 0

  for (const row of PAYMENT_TERMS) {
    if (byCode.has(row.code)) {
      skipped++
      continue
    }
    const res = await fetch(`${BASE}/t/${TENANT}/crm/masters/payment-terms`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        code: row.code,
        name: row.name,
        sortOrder: row.sortOrder,
        status: 'active',
        attributes: row.attributes,
      }),
    })
    if (!res.ok) {
      failed++
      console.error(`  ✗ ${row.code}: ${res.status} ${await res.text()}`)
      continue
    }
    created++
    console.log(`  ✓ ${row.code} — ${row.name}`)
  }

  console.log(`\nDone. Created: ${created}, Already present: ${skipped}, Failed: ${failed}`)
  if (failed > 0) process.exitCode = 1
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})

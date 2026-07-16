/**
 * Upsert commercial-terms CRM masters via API (+ sync ensure).
 * Usage: npx tsx scripts/seed-commercial-terms.ts
 */
const BASE = process.env.VITE_API_BASE_URL ?? 'http://127.0.0.1:5000/api/v1'
const TENANT = process.env.VITE_TENANT_SLUG ?? 'vasant-trailers'
const EMAIL = process.env.SEED_EMAIL ?? 'admin@vasant-trailers.com'
const PASSWORD = process.env.SEED_PASSWORD ?? 'Admin@123'

const COMMERCIAL_TERMS = [
  { code: 'payment', name: 'Payment Terms', sortOrder: 1, attributes: { termType: 'Payment', appliesTo: 'quotation', approvalRequired: true } },
  { code: 'delivery', name: 'Delivery Terms', sortOrder: 2, attributes: { termType: 'Delivery', appliesTo: 'quotation', approvalRequired: true } },
  { code: 'warranty', name: 'Warranty Terms', sortOrder: 3, attributes: { termType: 'Warranty', appliesTo: 'quotation', approvalRequired: true } },
  { code: 'validity', name: 'Quotation Validity', sortOrder: 4, attributes: { termType: 'Validity', appliesTo: 'quotation', approvalRequired: false } },
  { code: 'jurisdiction', name: 'Jurisdiction', sortOrder: 5, attributes: { termType: 'Jurisdiction', appliesTo: 'quotation,sales_order', approvalRequired: false } },
  { code: 'exclusions', name: 'Exclusions', sortOrder: 6, attributes: { termType: 'Exclusions', appliesTo: 'quotation,sales_order', approvalRequired: false } },
  { code: 'maintenance', name: 'Maintenance', sortOrder: 7, attributes: { termType: 'Maintenance', appliesTo: 'sales_order', approvalRequired: true } },
  { code: 'change_conditions', name: 'Change Conditions', sortOrder: 8, attributes: { termType: 'Change Conditions', appliesTo: 'quotation,sales_order', approvalRequired: true } },
  { code: 'packing', name: 'Packing & Forwarding', sortOrder: 9, attributes: { termType: 'Packing', appliesTo: 'quotation,sales_order', approvalRequired: false } },
  { code: 'insurance', name: 'Insurance', sortOrder: 10, attributes: { termType: 'Insurance', appliesTo: 'quotation,sales_order', approvalRequired: false } },
  { code: 'penalty', name: 'Penalty / LD Clause', sortOrder: 11, attributes: { termType: 'Penalty', appliesTo: 'sales_order', approvalRequired: true } },
  { code: 'force_majeure', name: 'Force Majeure', sortOrder: 12, attributes: { termType: 'Legal', appliesTo: 'quotation,sales_order', approvalRequired: false } },
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

  await fetch(`${BASE}/t/${TENANT}/crm/masters/sync`, { headers })

  const listRes = await fetch(`${BASE}/t/${TENANT}/crm/masters/commercial-terms?limit=100`, { headers })
  const listJson = (await listRes.json()) as {
    data?: Array<{ id: string; code: string }> | { items?: Array<{ id: string; code: string }> }
  }
  const existing = Array.isArray(listJson.data) ? listJson.data : (listJson.data?.items ?? [])
  const byCode = new Map(existing.map((e) => [e.code, e.id]))

  let created = 0
  let skipped = 0
  let failed = 0

  for (const row of COMMERCIAL_TERMS) {
    if (byCode.has(row.code)) {
      skipped++
      continue
    }
    const res = await fetch(`${BASE}/t/${TENANT}/crm/masters/commercial-terms`, {
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

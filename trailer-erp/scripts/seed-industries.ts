/**
 * Upsert standard industries CRM masters via API (+ sync ensure).
 * Usage: npx tsx scripts/seed-industries.ts
 */
const BASE = process.env.VITE_API_BASE_URL ?? 'http://127.0.0.1:5000/api/v1'
const TENANT = process.env.VITE_TENANT_SLUG ?? 'vasant-trailers'
const EMAIL = process.env.SEED_EMAIL ?? 'admin@vasant-trailers.com'
const PASSWORD = process.env.SEED_PASSWORD ?? 'Admin@123'

const INDUSTRIES = [
  { code: 'cement', name: 'Cement', sortOrder: 1, attributes: { category: 'Core', defaultSalesProcess: 'B2B Enterprise' } },
  { code: 'logistics', name: 'Logistics', sortOrder: 2, attributes: { category: 'Core', defaultSalesProcess: 'B2B Enterprise' } },
  { code: 'chemical', name: 'Chemical', sortOrder: 3, attributes: { category: 'Core', defaultSalesProcess: 'B2B Enterprise' } },
  { code: 'construction', name: 'Construction', sortOrder: 4, attributes: { category: 'Core', defaultSalesProcess: 'B2B Enterprise' } },
  { code: 'mining', name: 'Mining', sortOrder: 5, attributes: { category: 'Core', defaultSalesProcess: 'B2B Enterprise' } },
  { code: 'agro', name: 'Agro', sortOrder: 6, attributes: { category: 'Core', defaultSalesProcess: 'B2B Enterprise' } },
  { code: 'oil_gas', name: 'Oil and Gas', sortOrder: 7, attributes: { category: 'Core', defaultSalesProcess: 'B2B Enterprise' } },
  { code: 'transport_fleet', name: 'Transport Fleet', sortOrder: 8, attributes: { category: 'Core', defaultSalesProcess: 'B2B Enterprise' } },
  { code: 'infrastructure', name: 'Infrastructure', sortOrder: 9, attributes: { category: 'Core', defaultSalesProcess: 'B2B Enterprise' } },
  { code: 'container_transport', name: 'Container Transport', sortOrder: 10, attributes: { category: 'Core', defaultSalesProcess: 'B2B Enterprise' } },
  { code: 'manufacturing', name: 'Manufacturing', sortOrder: 11, attributes: { category: 'Core', defaultSalesProcess: 'B2B Enterprise' } },
  { code: 'steel', name: 'Steel & Metals', sortOrder: 12, attributes: { category: 'Manufacturing', defaultSalesProcess: 'B2B Enterprise' } },
  { code: 'automotive_oem', name: 'Automotive OEM', sortOrder: 13, attributes: { category: 'Manufacturing', defaultSalesProcess: 'B2B Enterprise' } },
  { code: 'fertilizer', name: 'Fertilizer & Agrochemicals', sortOrder: 14, attributes: { category: 'Manufacturing', defaultSalesProcess: 'B2B Enterprise' } },
  { code: 'power', name: 'Power & Energy', sortOrder: 15, attributes: { category: 'Manufacturing', defaultSalesProcess: 'B2B Enterprise' } },
  { code: 'ports', name: 'Ports & Maritime', sortOrder: 16, attributes: { category: 'Manufacturing', defaultSalesProcess: 'B2B Enterprise' } },
  { code: 'railways', name: 'Railways & Metro', sortOrder: 17, attributes: { category: 'Manufacturing', defaultSalesProcess: 'B2B Enterprise' } },
  { code: 'defence', name: 'Defence & Aerospace', sortOrder: 18, attributes: { category: 'Manufacturing', defaultSalesProcess: 'B2B Enterprise' } },
  { code: 'food_beverage', name: 'Food & Beverage', sortOrder: 19, attributes: { category: 'Manufacturing', defaultSalesProcess: 'B2B Enterprise' } },
  { code: 'pharma', name: 'Pharmaceuticals', sortOrder: 20, attributes: { category: 'Manufacturing', defaultSalesProcess: 'B2B Enterprise' } },
  { code: 'paper', name: 'Paper & Pulp', sortOrder: 21, attributes: { category: 'Manufacturing', defaultSalesProcess: 'B2B Enterprise' } },
  { code: 'textiles', name: 'Textiles', sortOrder: 22, attributes: { category: 'Manufacturing', defaultSalesProcess: 'B2B Enterprise' } },
  { code: 'plastic', name: 'Plastics & Polymers', sortOrder: 23, attributes: { category: 'Manufacturing', defaultSalesProcess: 'B2B Enterprise' } },
  { code: 'waste_mgmt', name: 'Waste Management', sortOrder: 24, attributes: { category: 'Manufacturing', defaultSalesProcess: 'B2B Enterprise' } },
  { code: 'renewable', name: 'Renewable Energy', sortOrder: 25, attributes: { category: 'Manufacturing', defaultSalesProcess: 'B2B Enterprise' } },
  { code: 'fmcg', name: 'FMCG', sortOrder: 26, attributes: { category: 'Core', defaultSalesProcess: 'B2B Enterprise' } },
  { code: 'government_psu', name: 'Government / PSU', sortOrder: 27, attributes: { category: 'Core', defaultSalesProcess: 'B2B Enterprise' } },
  { code: 'other', name: 'Other', sortOrder: 99, attributes: { category: 'Core', defaultSalesProcess: 'B2B Enterprise' } },
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

  const listRes = await fetch(`${BASE}/t/${TENANT}/crm/masters/industries?limit=100`, { headers })
  const listJson = (await listRes.json()) as {
    data?: Array<{ id: string; code: string }> | { items?: Array<{ id: string; code: string }> }
  }
  const existing = Array.isArray(listJson.data) ? listJson.data : (listJson.data?.items ?? [])
  const byCode = new Map(existing.map((e) => [e.code, e.id]))

  let created = 0
  let skipped = 0
  let failed = 0

  for (const row of INDUSTRIES) {
    if (byCode.has(row.code)) {
      skipped++
      continue
    }
    const res = await fetch(`${BASE}/t/${TENANT}/crm/masters/industries`, {
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

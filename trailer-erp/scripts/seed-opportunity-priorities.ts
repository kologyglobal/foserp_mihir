/**
 * Upsert opportunity-priorities CRM masters via API (+ sync ensure).
 * Usage: npx tsx scripts/seed-opportunity-priorities.ts
 */
const BASE = process.env.VITE_API_BASE_URL ?? 'http://127.0.0.1:5000/api/v1'
const TENANT = process.env.VITE_TENANT_SLUG ?? 'vasant-trailers'
const EMAIL = process.env.SEED_EMAIL ?? 'admin@vasant-trailers.com'
const PASSWORD = process.env.SEED_PASSWORD ?? 'Admin@123'

const PRIORITIES = [
  { code: 'low', name: 'Low', sortOrder: 1, attributes: { valueThreshold: 0, color: '#8A94A6', isDefault: false } },
  { code: 'normal', name: 'Normal', sortOrder: 2, attributes: { valueThreshold: 0, color: '#8A94A6', isDefault: true } },
  { code: 'medium', name: 'Medium', sortOrder: 3, attributes: { valueThreshold: 2500000, color: '#0078D4' } },
  { code: 'high', name: 'High', sortOrder: 4, attributes: { valueThreshold: 5000000, color: '#CA5010' } },
  { code: 'strategic', name: 'Strategic', sortOrder: 5, attributes: { valueThreshold: 15000000, color: '#8764B8' } },
  { code: 'critical', name: 'Critical', sortOrder: 6, attributes: { valueThreshold: 30000000, color: '#D13438' } },
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

  const listRes = await fetch(`${BASE}/t/${TENANT}/crm/masters/opportunity-priorities?limit=100`, { headers })
  const listJson = (await listRes.json()) as {
    data?: Array<{ id: string; code: string }> | { items?: Array<{ id: string; code: string }> }
  }
  const existing = Array.isArray(listJson.data) ? listJson.data : (listJson.data?.items ?? [])
  const byCode = new Map(existing.map((e) => [e.code, e.id]))

  let created = 0
  let skipped = 0
  let failed = 0

  for (const row of PRIORITIES) {
    if (byCode.has(row.code)) {
      skipped++
      continue
    }
    const res = await fetch(`${BASE}/t/${TENANT}/crm/masters/opportunity-priorities`, {
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

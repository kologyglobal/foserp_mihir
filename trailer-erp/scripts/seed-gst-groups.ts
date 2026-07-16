/**
 * Seed GST groups via masters API. Idempotent by code (409 = skip).
 * Usage: npx tsx scripts/seed-gst-groups.ts
 */
const BASE = process.env.VITE_API_BASE_URL ?? 'http://127.0.0.1:5000/api/v1'
const TENANT = process.env.VITE_TENANT_SLUG ?? 'vasant-trailers'
const EMAIL = process.env.SEED_EMAIL ?? 'admin@vasant-trailers.com'
const PASSWORD = process.env.SEED_PASSWORD ?? 'Admin@123'

type GstGroupSeed = {
  code: string
  goodsType: 'goods' | 'service'
  description: string
}

const GROUPS: GstGroupSeed[] = [
  {
    code: 'GST18-GOODS',
    goodsType: 'goods',
    description: 'Standard 18% GST on goods — trailers, assemblies, components',
  },
  {
    code: 'GST12-GOODS',
    goodsType: 'goods',
    description: 'Reduced 12% GST on selected steel & structural goods',
  },
  {
    code: 'GST5-GOODS',
    goodsType: 'goods',
    description: 'Concessional 5% GST on essential inputs',
  },
  {
    code: 'GST28-GOODS',
    goodsType: 'goods',
    description: '28% GST on luxury / high-rate goods (if applicable)',
  },
  {
    code: 'GST0-GOODS',
    goodsType: 'goods',
    description: 'Nil-rated / exempt goods',
  },
  {
    code: 'GST18-SERVICE',
    goodsType: 'service',
    description: '18% GST on fabrication, painting & service charges',
  },
  {
    code: 'GST12-SERVICE',
    goodsType: 'service',
    description: '12% GST on selected services',
  },
  {
    code: 'GST5-SERVICE',
    goodsType: 'service',
    description: '5% GST on concessional services',
  },
]

type Listed = { id: string; code: string }

function asList(data: unknown): Listed[] {
  if (Array.isArray(data)) return data as Listed[]
  if (data && typeof data === 'object' && Array.isArray((data as { items?: Listed[] }).items)) {
    return (data as { items: Listed[] }).items
  }
  return []
}

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

  const listRes = await fetch(`${BASE}/t/${TENANT}/masters/gst-groups?limit=200`, { headers })
  const listJson = (await listRes.json()) as { data?: unknown }
  const known = new Set(asList(listJson.data).map((r) => r.code))

  let created = 0
  let skipped = 0
  let failed = 0

  for (const row of GROUPS) {
    if (known.has(row.code)) {
      skipped++
      continue
    }
    const res = await fetch(`${BASE}/t/${TENANT}/masters/gst-groups`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        code: row.code,
        goodsType: row.goodsType,
        description: row.description,
        status: 'ACTIVE',
      }),
    })
    if (!res.ok) {
      const text = await res.text()
      if (res.status === 409) {
        skipped++
        console.log(`  · ${row.code} — already present`)
        continue
      }
      failed++
      console.error(`  ✗ ${row.code}: ${res.status} ${text}`)
      continue
    }
    created++
    console.log(`  ✓ ${row.code} — ${row.goodsType}`)
  }

  console.log(`\nDone. Created: ${created}, Already present: ${skipped}, Failed: ${failed}`)
  if (failed > 0) process.exitCode = 1
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})

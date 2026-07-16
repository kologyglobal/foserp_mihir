/**
 * Upsert trailer-manufacturing item category tree via masters API.
 * Usage: npx tsx scripts/seed-item-categories.ts
 */
const BASE = process.env.VITE_API_BASE_URL ?? 'http://127.0.0.1:5000/api/v1'
const TENANT = process.env.VITE_TENANT_SLUG ?? 'vasant-trailers'
const EMAIL = process.env.SEED_EMAIL ?? 'admin@vasant-trailers.com'
const PASSWORD = process.env.SEED_PASSWORD ?? 'Admin@123'

type CatSeed = {
  code: string
  name: string
  level: number
  parentCode?: string
}

/** Standard inventory tree for trailer / tank manufacturing */
const CATEGORIES: CatSeed[] = [
  { code: 'CAT-RM', name: 'Raw Material', level: 1 },
  { code: 'CAT-RM-STRUCT', name: 'Structural Steel', level: 2, parentCode: 'CAT-RM' },
  { code: 'CAT-RM-PLATE', name: 'Plate', level: 2, parentCode: 'CAT-RM' },
  { code: 'CAT-RM-CONS', name: 'Consumable', level: 2, parentCode: 'CAT-RM' },
  { code: 'CAT-RM-PIPE', name: 'Pipe & Tube', level: 2, parentCode: 'CAT-RM' },
  { code: 'CAT-BO', name: 'Bought Out', level: 1 },
  { code: 'CAT-BO-RUN', name: 'Running Gear', level: 2, parentCode: 'CAT-BO' },
  { code: 'CAT-BO-WHEEL', name: 'Wheel & Tyre', level: 2, parentCode: 'CAT-BO' },
  { code: 'CAT-BO-PNEU', name: 'Pneumatic', level: 2, parentCode: 'CAT-BO' },
  { code: 'CAT-BO-ELEC', name: 'Electrical', level: 2, parentCode: 'CAT-BO' },
  { code: 'CAT-BO-HYD', name: 'Hydraulic', level: 2, parentCode: 'CAT-BO' },
  { code: 'CAT-SA', name: 'Sub Assembly', level: 1 },
  { code: 'CAT-SA-CHASSIS', name: 'Chassis Assembly', level: 2, parentCode: 'CAT-SA' },
  { code: 'CAT-SA-TANK', name: 'Tank Assembly', level: 2, parentCode: 'CAT-SA' },
  { code: 'CAT-SA-RUN', name: 'Running Gear Assembly', level: 2, parentCode: 'CAT-SA' },
  { code: 'CAT-FG', name: 'Finished Good', level: 1 },
  { code: 'CAT-FG-BULKER', name: 'Bulker Trailer', level: 2, parentCode: 'CAT-FG' },
  { code: 'CAT-FG-ISO', name: 'ISO Tank', level: 2, parentCode: 'CAT-FG' },
  { code: 'CAT-FG-TRAILER', name: 'General Trailer', level: 2, parentCode: 'CAT-FG' },
  { code: 'CAT-SPARE', name: 'Spare Parts', level: 1 },
  { code: 'CAT-TOOL', name: 'Tools & Fixtures', level: 1 },
]

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

  const listRes = await fetch(`${BASE}/t/${TENANT}/masters/item-categories?limit=200`, { headers })
  const listJson = (await listRes.json()) as {
    data?: Array<{ id: string; code: string }> | { items?: Array<{ id: string; code: string }> }
  }
  const existing = Array.isArray(listJson.data) ? listJson.data : (listJson.data?.items ?? [])
  const idByCode = new Map(existing.map((e) => [e.code, e.id]))

  let created = 0
  let skipped = 0
  let failed = 0

  // Parents (level 1) first, then children
  const ordered = [...CATEGORIES].sort((a, b) => a.level - b.level)

  for (const row of ordered) {
    if (idByCode.has(row.code)) {
      skipped++
      continue
    }
    const parentId = row.parentCode ? idByCode.get(row.parentCode) ?? null : null
    if (row.parentCode && !parentId) {
      failed++
      console.error(`  ✗ ${row.code}: parent ${row.parentCode} missing`)
      continue
    }
    const res = await fetch(`${BASE}/t/${TENANT}/masters/item-categories`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        code: row.code,
        name: row.name,
        level: row.level,
        parentId,
        defaultWarehouseId: null,
        status: 'ACTIVE',
      }),
    })
    if (!res.ok) {
      failed++
      console.error(`  ✗ ${row.code}: ${res.status} ${await res.text()}`)
      continue
    }
    const body = (await res.json()) as { data?: { id?: string; code?: string } }
    const id = body.data?.id
    if (id) idByCode.set(row.code, id)
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

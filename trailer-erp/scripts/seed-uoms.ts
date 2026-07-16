/**
 * Seed sample UOMs via masters API. Idempotent by code (case-insensitive).
 * Usage: npx tsx scripts/seed-uoms.ts
 */
const BASE = process.env.VITE_API_BASE_URL ?? 'http://127.0.0.1:5000/api/v1'
const TENANT = process.env.VITE_TENANT_SLUG ?? 'vasant-trailers'
const EMAIL = process.env.SEED_EMAIL ?? 'admin@vasant-trailers.com'
const PASSWORD = process.env.SEED_PASSWORD ?? 'Admin@123'

type UomSeed = {
  code: string
  name: string
  description: string
  uomType: 'integer' | 'weight' | 'length' | 'volume'
  decimalPlaces: number
  isBaseUnit: boolean
}

const UOMS: UomSeed[] = [
  { code: 'NOS', name: 'Numbers', description: 'Numbers / each', uomType: 'integer', decimalPlaces: 0, isBaseUnit: true },
  { code: 'KG', name: 'Kilogram', description: 'Kilogram', uomType: 'weight', decimalPlaces: 3, isBaseUnit: true },
  { code: 'SET', name: 'Set', description: 'Set / kit', uomType: 'integer', decimalPlaces: 0, isBaseUnit: false },
  { code: 'LTR', name: 'Litre', description: 'Litre', uomType: 'volume', decimalPlaces: 2, isBaseUnit: true },
  { code: 'MTR', name: 'Metre', description: 'Metre', uomType: 'length', decimalPlaces: 3, isBaseUnit: true },
  { code: 'TON', name: 'Metric Ton', description: 'Metric ton', uomType: 'weight', decimalPlaces: 3, isBaseUnit: false },
  { code: 'PCS', name: 'Pieces', description: 'Pieces', uomType: 'integer', decimalPlaces: 0, isBaseUnit: false },
  { code: 'SQM', name: 'Square Metre', description: 'Square metre', uomType: 'length', decimalPlaces: 2, isBaseUnit: false },
  { code: 'BOX', name: 'Box', description: 'Box / carton', uomType: 'integer', decimalPlaces: 0, isBaseUnit: false },
  { code: 'ROLL', name: 'Roll', description: 'Roll / coil', uomType: 'integer', decimalPlaces: 0, isBaseUnit: false },
  { code: 'MM', name: 'Millimetre', description: 'Millimetre', uomType: 'length', decimalPlaces: 0, isBaseUnit: false },
  { code: 'FT', name: 'Feet', description: 'Feet', uomType: 'length', decimalPlaces: 2, isBaseUnit: false },
  { code: 'IN', name: 'Inch', description: 'Inch', uomType: 'length', decimalPlaces: 2, isBaseUnit: false },
  { code: 'HR', name: 'Hour', description: 'Labour / machine hour', uomType: 'integer', decimalPlaces: 1, isBaseUnit: false },
  { code: 'PAIR', name: 'Pair', description: 'Pair', uomType: 'integer', decimalPlaces: 0, isBaseUnit: false },
]

type Listed = { id: string; code: string }

function asList(data: unknown): Listed[] {
  if (Array.isArray(data)) return data as Listed[]
  if (data && typeof data === 'object' && Array.isArray((data as { items?: Listed[] }).items)) {
    return (data as { items: Listed[] }).items
  }
  return []
}

function uomKey(code: string) {
  return code.trim().toUpperCase()
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

  const listRes = await fetch(`${BASE}/t/${TENANT}/masters/uom?limit=200`, { headers })
  const listJson = (await listRes.json()) as { data?: unknown }
  const existing = asList(listJson.data)
  const idByCode = new Map(existing.map((u) => [uomKey(u.code), u.id]))

  let created = 0
  let skipped = 0
  let failed = 0

  for (const uom of UOMS) {
    if (idByCode.has(uomKey(uom.code))) {
      skipped++
      continue
    }
    const res = await fetch(`${BASE}/t/${TENANT}/masters/uom`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        code: uom.code,
        name: uom.name,
        description: uom.description,
        uomType: uom.uomType,
        decimalPlaces: uom.decimalPlaces,
        isBaseUnit: uom.isBaseUnit,
        status: 'ACTIVE',
      }),
    })
    if (!res.ok) {
      const text = await res.text()
      if (res.status === 409) {
        skipped++
        console.log(`  · ${uom.code} — already present`)
        continue
      }
      failed++
      console.error(`  ✗ ${uom.code}: ${res.status} ${text}`)
      continue
    }
    const body = (await res.json()) as { data?: { id?: string } }
    if (body.data?.id) idByCode.set(uomKey(uom.code), body.data.id)
    created++
    console.log(`  ✓ ${uom.code} — ${uom.name}`)
  }

  console.log(`\nDone. Created: ${created}, Already present: ${skipped}, Failed: ${failed}`)
  if (failed > 0) process.exitCode = 1
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})

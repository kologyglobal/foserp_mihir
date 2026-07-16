/**
 * Seed plant warehouses via masters API. Idempotent by code (409 = skip).
 * Usage: npx tsx scripts/seed-warehouses.ts
 */
const BASE = process.env.VITE_API_BASE_URL ?? 'http://127.0.0.1:5000/api/v1'
const TENANT = process.env.VITE_TENANT_SLUG ?? 'vasant-trailers'
const EMAIL = process.env.SEED_EMAIL ?? 'admin@vasant-trailers.com'
const PASSWORD = process.env.SEED_PASSWORD ?? 'Admin@123'

type WhSeed = {
  code: string
  name: string
  warehouseType: 'main' | 'sub' | 'wip' | 'fg' | 'quarantine'
  plantCode: string
  address: string
}

const WAREHOUSES: WhSeed[] = [
  { code: 'RM_STORE', name: 'RM Store', warehouseType: 'main', plantCode: 'PUNE', address: 'Plant 1, Store Block A — Raw Material' },
  { code: 'BO_STORE', name: 'Bought Out Store', warehouseType: 'main', plantCode: 'PUNE', address: 'Plant 1, Store Block B — Running Gear & BO' },
  { code: 'PAINT_STORE', name: 'Paint Store', warehouseType: 'sub', plantCode: 'PUNE', address: 'Plant 1, Store Block C — Consumables & Paint' },
  { code: 'WIP_CUTTING', name: 'WIP Cutting', warehouseType: 'wip', plantCode: 'PUNE', address: 'Cutting Bay — plate & profile WIP' },
  { code: 'WIP_FABRICATION', name: 'WIP Fabrication', warehouseType: 'wip', plantCode: 'PUNE', address: 'Fabrication — rolled & formed WIP' },
  { code: 'WIP_WELDING', name: 'WIP Welding', warehouseType: 'wip', plantCode: 'PUNE', address: 'Welding Bay — structural & tank weld WIP' },
  { code: 'WIP_ASSEMBLY', name: 'WIP Assembly', warehouseType: 'wip', plantCode: 'PUNE', address: 'Assembly bays — chassis & fitment WIP' },
  { code: 'WIP_TANK_ASM', name: 'WIP Tank Assembly', warehouseType: 'wip', plantCode: 'PUNE', address: 'Fabrication Bay-1 — Tank shell & assembly WIP' },
  { code: 'WIP_PAINT', name: 'WIP Paint', warehouseType: 'wip', plantCode: 'PUNE', address: 'Paint Shop Bay — surface treatment WIP' },
  { code: 'WIP_FINAL', name: 'WIP Final', warehouseType: 'wip', plantCode: 'PUNE', address: 'Pre-dispatch final assembly WIP' },
  { code: 'FG_YARD', name: 'FG Yard', warehouseType: 'fg', plantCode: 'PUNE', address: 'Dispatch Yard — Finished Goods' },
  { code: 'QUARANTINE', name: 'Quarantine', warehouseType: 'quarantine', plantCode: 'PUNE', address: 'QC Quarantine Zone' },
  // Legacy aliases kept for BOM / routing compatibility demos
  { code: 'WIP_CUT', name: 'WIP Cutting (Legacy)', warehouseType: 'wip', plantCode: 'PUNE', address: 'Legacy alias — use WIP_CUTTING' },
  { code: 'WIP_WELD', name: 'WIP Welding (Legacy)', warehouseType: 'wip', plantCode: 'PUNE', address: 'Legacy alias — use WIP_WELDING' },
  { code: 'WIP_ASSY', name: 'WIP Assembly (Legacy)', warehouseType: 'wip', plantCode: 'PUNE', address: 'Legacy alias — use WIP_ASSEMBLY' },
  { code: 'WIP_PAINTING', name: 'WIP Painting (Legacy)', warehouseType: 'wip', plantCode: 'PUNE', address: 'Paint Shop — legacy alias' },
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

  const listRes = await fetch(`${BASE}/t/${TENANT}/masters/warehouses?limit=200`, { headers })
  const listJson = (await listRes.json()) as { data?: unknown }
  const existing = asList(listJson.data)
  const known = new Set(existing.map((w) => w.code))

  let created = 0
  let skipped = 0
  let failed = 0

  for (const wh of WAREHOUSES) {
    if (known.has(wh.code)) {
      skipped++
      continue
    }
    const res = await fetch(`${BASE}/t/${TENANT}/masters/warehouses`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        code: wh.code,
        name: wh.name,
        warehouseType: wh.warehouseType,
        plantCode: wh.plantCode,
        address: wh.address,
        status: 'ACTIVE',
      }),
    })
    if (!res.ok) {
      const text = await res.text()
      if (res.status === 409) {
        skipped++
        console.log(`  · ${wh.code} — already present`)
        continue
      }
      failed++
      console.error(`  ✗ ${wh.code}: ${res.status} ${text}`)
      continue
    }
    created++
    console.log(`  ✓ ${wh.code} — ${wh.name}`)
  }

  console.log(`\nDone. Created: ${created}, Already present: ${skipped}, Failed: ${failed}`)
  if (failed > 0) process.exitCode = 1
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})

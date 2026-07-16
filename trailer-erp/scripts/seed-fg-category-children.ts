/**
 * Ensure FG child categories exist under CAT-FG (idempotent).
 */
const BASE = process.env.VITE_API_BASE_URL ?? 'http://127.0.0.1:5000/api/v1'
const TENANT = process.env.VITE_TENANT_SLUG ?? 'vasant-trailers'
const EMAIL = process.env.SEED_EMAIL ?? 'admin@vasant-trailers.com'
const PASSWORD = process.env.SEED_PASSWORD ?? 'Admin@123'

async function main() {
  const login = (await (
    await fetch(`${BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: EMAIL, password: PASSWORD, tenantSlug: TENANT }),
    })
  ).json()) as { data?: { accessToken?: string } }
  const token = login.data?.accessToken
  if (!token) throw new Error('login failed')
  const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }

  const all: Array<{ id: string; code: string }> = []
  for (let page = 1; page <= 20; page++) {
    const res = await fetch(`${BASE}/t/${TENANT}/masters/item-categories?page=${page}&limit=50`, { headers })
    const json = (await res.json()) as {
      data?: Array<{ id: string; code: string }>
      meta?: { totalPages?: number }
    }
    const rows = Array.isArray(json.data) ? json.data : []
    all.push(...rows)
    if (page >= (json.meta?.totalPages ?? 1)) break
  }
  const byCode = new Map(all.map((r) => [r.code, r.id]))
  console.log('listed', all.length, 'codes:', [...byCode.keys()].sort().join(', '))

  const parentId = byCode.get('CAT-FG')
  if (!parentId) throw new Error('CAT-FG missing')

  for (const row of [
    { code: 'CAT-FG-BULKER', name: 'Bulker Trailer' },
    { code: 'CAT-FG-ISO', name: 'ISO Tank' },
    { code: 'CAT-FG-TRAILER', name: 'General Trailer' },
  ]) {
    if (byCode.has(row.code)) {
      console.log(' ·', row.code)
      continue
    }
    const res = await fetch(`${BASE}/t/${TENANT}/masters/item-categories`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        code: row.code,
        name: row.name,
        level: 2,
        parentId,
        defaultWarehouseId: null,
        status: 'ACTIVE',
      }),
    })
    if (!res.ok) {
      console.error(' ✗', row.code, await res.text())
      continue
    }
    console.log(' ✓', row.code)
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})

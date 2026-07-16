/**
 * Assign tenant admin as owner on all CRM companies missing ownerId.
 * Usage: npx tsx scripts/assign-company-owners.ts
 */
const BASE = process.env.VITE_API_BASE_URL ?? 'http://127.0.0.1:5000/api/v1'
const TENANT = process.env.VITE_TENANT_SLUG ?? 'vasant-trailers'
const EMAIL = process.env.SEED_EMAIL ?? 'admin@vasant-trailers.com'
const PASSWORD = process.env.SEED_PASSWORD ?? 'Admin@123'

async function main() {
  const loginRes = await fetch(`${BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: EMAIL, password: PASSWORD, tenantSlug: TENANT }),
  })
  const login = (await loginRes.json()) as {
    data?: { accessToken?: string; user?: { id?: string; name?: string } }
    message?: string
  }
  const token = login.data?.accessToken
  const ownerId = login.data?.user?.id
  const ownerName = login.data?.user?.name ?? 'Admin'
  if (!token || !ownerId) throw new Error(`Login failed: ${login.message ?? loginRes.status}`)

  console.log(`Assigning owner ${ownerName} (${ownerId}) on unassigned companies…`)

  const headers = {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  }

  let page = 1
  let updated = 0
  let skipped = 0
  let failed = 0

  for (;;) {
    const listRes = await fetch(`${BASE}/t/${TENANT}/crm/companies?page=${page}&limit=100`, { headers })
    const list = (await listRes.json()) as {
      data?: Array<{ id: string; customerName: string; ownerId?: string | null }> | {
        items?: Array<{ id: string; customerName: string; ownerId?: string | null }>
      }
    }
    const items = Array.isArray(list.data) ? list.data : (list.data?.items ?? [])
    if (items.length === 0) break

    for (const company of items) {
      if (company.ownerId) {
        skipped++
        continue
      }
      const patchRes = await fetch(`${BASE}/t/${TENANT}/crm/companies/${company.id}`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({ ownerId }),
      })
      if (!patchRes.ok) {
        failed++
        const body = await patchRes.text()
        console.error(`  ✗ ${company.customerName}: ${patchRes.status} ${body}`)
        continue
      }
      updated++
    }

    if (items.length < 100) break
    page++
  }

  console.log(`Done. Updated: ${updated}, Already owned: ${skipped}, Failed: ${failed}`)
  if (failed > 0) process.exitCode = 1
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})

/**
 * Seed sample CRM leads linked to existing companies.
 * Usage: npx tsx scripts/seed-leads.ts
 * Optional: SEED_LEAD_COUNT=30
 */
const BASE = process.env.VITE_API_BASE_URL ?? 'http://127.0.0.1:5000/api/v1'
const TENANT = process.env.VITE_TENANT_SLUG ?? 'vasant-trailers'
const EMAIL = process.env.SEED_EMAIL ?? 'admin@vasant-trailers.com'
const PASSWORD = process.env.SEED_PASSWORD ?? 'Admin@123'
const COUNT = Number(process.env.SEED_LEAD_COUNT ?? 30)

const SOURCES = [
  'existing_customer',
  'referral',
  'trade_show',
  'website',
  'indiamart',
  'cold_call',
  'field_visit',
] as const

const STAGES = [
  { stage: 'new', lifecycleStatus: 'open', probability: 20 },
  { stage: 'new', lifecycleStatus: 'open', probability: 30 },
  { stage: 'contacted', lifecycleStatus: 'open', probability: 35 },
  { stage: 'contacted', lifecycleStatus: 'open', probability: 40 },
  { stage: 'requirement_collected', lifecycleStatus: 'open', probability: 50 },
  { stage: 'requirement_collected', lifecycleStatus: 'open', probability: 55 },
  { stage: 'qualified', lifecycleStatus: 'qualified', probability: 70 },
  { stage: 'qualified', lifecycleStatus: 'qualified', probability: 80 },
] as const

const PRIORITIES = ['low', 'medium', 'high', 'critical'] as const

const PRODUCTS = [
  { name: '45 M3 Bulker Trailer', value: 2_850_000, qty: 2 },
  { name: '26 KL ISO Tank', value: 4_200_000, qty: 1 },
  { name: '32 FT Side Wall Trailer', value: 1_950_000, qty: 3 },
  { name: '28 KL Fuel Tank', value: 2_400_000, qty: 2 },
  { name: '20 KL Fuel Tank', value: 1_850_000, qty: 4 },
  { name: 'Tanker Trailer', value: 2_100_000, qty: 2 },
  { name: 'Liquid Tank Trailer', value: 2_600_000, qty: 1 },
]

type Company = {
  id: string
  customerName?: string
  companyName?: string
  industry?: string
  contactPerson?: string
  contactPhone?: string
  contactEmail?: string
  city?: string
}

function isoDaysFromNow(days: number): string {
  const d = new Date()
  d.setUTCDate(d.getUTCDate() + days)
  d.setUTCHours(0, 0, 0, 0)
  return d.toISOString()
}

async function login(): Promise<{ token: string; userId: string; userName: string }> {
  const res = await fetch(`${BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: EMAIL, password: PASSWORD, tenantSlug: TENANT }),
  })
  const json = (await res.json()) as {
    message?: string
    data?: { accessToken?: string; user?: { id?: string; name?: string; firstName?: string; lastName?: string } }
  }
  if (!res.ok || !json.data?.accessToken) throw new Error(`Login failed: ${json.message ?? res.status}`)
  const u = json.data.user
  const userName = u?.name || [u?.firstName, u?.lastName].filter(Boolean).join(' ') || 'Admin'
  return { token: json.data.accessToken, userId: u?.id ?? '', userName }
}

async function listCompanies(token: string): Promise<Company[]> {
  const headers = { Authorization: `Bearer ${token}` }
  const all: Company[] = []
  for (let page = 1; page <= 20; page++) {
    const res = await fetch(`${BASE}/t/${TENANT}/crm/companies?page=${page}&limit=50`, { headers })
    const json = (await res.json()) as {
      data?: Company[] | { items?: Company[] }
      meta?: { totalPages?: number }
    }
    const rows = Array.isArray(json.data) ? json.data : (json.data?.items ?? [])
    all.push(...rows)
    if (page >= (json.meta?.totalPages ?? 1)) break
  }
  return all
}

async function main() {
  console.log(`Seeding ${COUNT} leads on ${BASE} (tenant=${TENANT})…`)
  const { token, userId, userName } = await login()
  console.log(`Logged in as ${EMAIL} (${userName})`)

  const companies = await listCompanies(token)
  if (companies.length === 0) {
    throw new Error('No companies found. Run scripts/seed-50-customers.ts first.')
  }
  console.log(`Using ${companies.length} companies`)

  const headers = {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  }

  let created = 0
  let failed = 0

  for (let i = 0; i < COUNT; i++) {
    const company = companies[i % companies.length]
    const prospectName = (company.customerName || company.companyName || `Prospect ${i + 1}`).trim()
    const product = PRODUCTS[i % PRODUCTS.length]
    const stageCfg = STAGES[i % STAGES.length]
    const source = SOURCES[i % SOURCES.length]
    const priority = PRIORITIES[i % PRIORITIES.length]
    const units = product.qty + (i % 2)
    const expectedValue = product.value * units

    const body = {
      prospectName,
      customerId: company.id,
      companyName: prospectName,
      contactPerson: company.contactPerson || `${prospectName.split(' ')[0]} Contact`,
      mobile: (company.contactPhone || `98${String(30000000 + i).slice(-8)}`).replace(/\D/g, '').slice(-10),
      email: company.contactEmail || `lead${i + 1}@${prospectName.toLowerCase().replace(/[^a-z0-9]+/g, '').slice(0, 20)}.demo.in`,
      source,
      industry: company.industry || 'Transport & Logistics',
      productRequirement: `${units} × ${product.name} — plant demo enquiry`,
      expectedQty: units,
      expectedValue,
      probability: stageCfg.probability,
      stage: stageCfg.stage,
      priority,
      lifecycleStatus: stageCfg.lifecycleStatus,
      activityStatus: 'active',
      leadOwnerId: userId || undefined,
      expectedCloseDate: isoDaysFromNow(30 + (i % 60)),
      nextFollowUpDate: isoDaysFromNow(3 + (i % 14)),
      followUpType: i % 3 === 0 ? 'call' : i % 3 === 1 ? 'visit' : 'email',
      followUpNotes: `Follow up on ${product.name} quotation readiness`,
      remarks: `Seed lead #${i + 1} for ${prospectName} (${company.city || 'India'})`,
      temperature: stageCfg.probability >= 70 ? 'hot' : stageCfg.probability >= 40 ? 'warm' : 'cold',
    }

    const res = await fetch(`${BASE}/t/${TENANT}/crm/leads`, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    })
    if (!res.ok) {
      failed++
      console.error(`  ✗ ${prospectName}: ${res.status} ${await res.text()}`)
      continue
    }
    created++
    if ((i + 1) % 10 === 0 || i === COUNT - 1) {
      console.log(`  … ${i + 1}/${COUNT}`)
    }
  }

  console.log(`\nDone. Created: ${created}, Failed: ${failed}`)
  if (failed > 0) process.exitCode = 1
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})

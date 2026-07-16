/**
 * One-off: create 50 CRM companies (+ primary contact each) via live API.
 * Usage: npx tsx scripts/seed-50-customers.ts
 */
const BASE = process.env.VITE_API_BASE_URL ?? 'http://127.0.0.1:5000/api/v1'
const TENANT = process.env.VITE_TENANT_SLUG ?? 'vasant-trailers'
const EMAIL = process.env.SEED_EMAIL ?? 'admin@vasant-trailers.com'
const PASSWORD = process.env.SEED_PASSWORD ?? 'Admin@123'
const COUNT = Number(process.env.SEED_COUNT ?? 50)

const CITIES: Array<{ city: string; state: string; pincode: string; territory: string }> = [
  { city: 'Pune', state: 'Maharashtra', pincode: '411001', territory: 'West' },
  { city: 'Ahmedabad', state: 'Gujarat', pincode: '380001', territory: 'West' },
  { city: 'Nashik', state: 'Maharashtra', pincode: '422001', territory: 'West' },
  { city: 'Indore', state: 'Madhya Pradesh', pincode: '452001', territory: 'Central' },
  { city: 'Jaipur', state: 'Rajasthan', pincode: '302001', territory: 'North' },
  { city: 'Chennai', state: 'Tamil Nadu', pincode: '600001', territory: 'South' },
  { city: 'Hyderabad', state: 'Telangana', pincode: '500001', territory: 'South' },
  { city: 'Delhi', state: 'Delhi', pincode: '110001', territory: 'North' },
]

const NAME_PREFIXES = [
  'ABC', 'Ultra', 'Shree', 'Patel', 'Metro', 'National', 'Western', 'Ambuja', 'Sunrise', 'Raj',
  'Bharat', 'Apex', 'Maruti', 'Narmada', 'Supreme', 'Galaxy', 'Prime', 'Shakti', 'Unity', 'Dev',
  'Om Sai', 'Delta', 'Krishna', 'BlueLine', 'Ashapura', 'Jalaram', 'Rapid', 'Mehta', 'Zenith', 'Royal',
  'Sai', 'Lakshmi', 'Ganesh', 'Vishnu', 'Agni', 'Indra', 'Varun', 'Surya', 'Chandra', 'Kiran',
  'Anand', 'Vijay', 'Hindustan', 'Deccan', 'Coastal', 'Highland', 'Valley', 'Pearl', 'Diamond', 'Star',
]

const NAME_SUFFIXES = [
  'Cement Logistics', 'Bulk Carriers', 'Transport Co', 'Tankers', 'Roadways',
  'Infra Logistics', 'Minerals Movers', 'Freight Bulk', 'Industrial Carriers', 'Bulk Solutions',
]

const TYPES = ['corporate', 'dealer', 'government'] as const
const INDUSTRIES = ['Transport & Logistics', 'Cement', 'Mining', 'Construction', 'Oil & Gas'] as const

function gstinFor(i: number, stateCode = '27'): string {
  const mid = String(1000 + i).padStart(4, '0')
  const letter = String.fromCharCode(65 + (i % 26))
  return `${stateCode}AABCS${mid}${letter}1Z${i % 10}`
}

function phoneFor(i: number): string {
  return `98${String(20000000 + i).slice(-8)}`
}

async function login(): Promise<{ token: string; userId: string }> {
  const res = await fetch(`${BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: EMAIL, password: PASSWORD, tenantSlug: TENANT }),
  })
  const json = (await res.json()) as {
    success?: boolean
    message?: string
    data?: { accessToken?: string; user?: { id?: string } }
  }
  if (!res.ok || !json.data?.accessToken) {
    throw new Error(`Login failed: ${json.message ?? res.status}`)
  }
  return { token: json.data.accessToken, userId: json.data.user?.id ?? '' }
}

async function api<T>(
  token: string,
  method: string,
  path: string,
  body?: unknown,
): Promise<{ ok: boolean; status: number; data?: T; message?: string }> {
  const res = await fetch(`${BASE}/t/${TENANT}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })
  const json = (await res.json()) as { success?: boolean; data?: T; message?: string }
  return { ok: res.ok, status: res.status, data: json.data, message: json.message }
}

async function main() {
  console.log(`Seeding ${COUNT} customers on ${BASE} (tenant=${TENANT})…`)
  const { token, userId } = await login()
  console.log(`Logged in as ${EMAIL}`)

  let createdCompanies = 0
  let createdContacts = 0
  let failed = 0

  for (let i = 1; i <= COUNT; i++) {
    const loc = CITIES[(i - 1) % CITIES.length]
    const prefix = NAME_PREFIXES[(i - 1) % NAME_PREFIXES.length]
    const suffix = NAME_SUFFIXES[(i - 1) % NAME_SUFFIXES.length]
    const customerName = `${prefix} ${suffix} ${String(i).padStart(2, '0')}`
    const contactPerson = `${prefix} Manager`
    const emailSlug = customerName.toLowerCase().replace(/[^a-z0-9]+/g, '.').replace(/^\.|\.$/g, '')

    const companyBody = {
      customerName,
      customerType: TYPES[(i - 1) % TYPES.length],
      industry: INDUSTRIES[(i - 1) % INDUSTRIES.length],
      email: `sales@${emailSlug.slice(0, 40)}.demo.in`,
      phone: phoneFor(i),
      addressLine1: `Plot ${i}, Industrial Area Phase ${(i % 3) + 1}`,
      city: loc.city,
      state: loc.state,
      pincode: loc.pincode,
      country: 'India',
      gstin: gstinFor(i, loc.state === 'Gujarat' ? '24' : loc.state === 'Maharashtra' ? '27' : '09'),
      contactPerson,
      contactPhone: phoneFor(i + 100),
      contactEmail: `contact@${emailSlug.slice(0, 40)}.demo.in`,
      creditDays: 15 + (i % 4) * 15,
      salesTerritory: loc.territory,
      source: 'seed-script',
      status: 'active',
      isActive: true,
      ownerId: userId || undefined,
    }

    const companyRes = await api<{ id: string; customerName: string }>(token, 'POST', '/crm/companies', companyBody)
    if (!companyRes.ok || !companyRes.data?.id) {
      failed++
      console.error(`  ✗ Company ${i}: ${companyRes.message ?? companyRes.status}`)
      continue
    }
    createdCompanies++

    const contactRes = await api<{ id: string }>(token, 'POST', '/crm/contacts', {
      customerId: companyRes.data.id,
      name: contactPerson,
      designation: i % 2 === 0 ? 'Purchase Manager' : 'Operations Head',
      department: 'Procurement',
      email: `pm@${emailSlug.slice(0, 40)}.demo.in`,
      phone: phoneFor(i + 200),
      isPrimary: true,
      isActive: true,
      ownerId: userId || undefined,
    })
    if (!contactRes.ok) {
      console.error(`  ✗ Contact for ${customerName}: ${contactRes.message ?? contactRes.status}`)
    } else {
      createdContacts++
    }

    if (i % 10 === 0) console.log(`  … ${i}/${COUNT}`)
  }

  console.log(`\nDone. Companies: ${createdCompanies}, Contacts: ${createdContacts}, Failed: ${failed}`)
  if (failed > 0) process.exitCode = 1
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})

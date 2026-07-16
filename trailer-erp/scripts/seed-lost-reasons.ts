/**
 * Upsert lost-reasons CRM masters via API (+ sync ensure).
 * Usage: npx tsx scripts/seed-lost-reasons.ts
 */
const BASE = process.env.VITE_API_BASE_URL ?? 'http://127.0.0.1:5000/api/v1'
const TENANT = process.env.VITE_TENANT_SLUG ?? 'vasant-trailers'
const EMAIL = process.env.SEED_EMAIL ?? 'admin@vasant-trailers.com'
const PASSWORD = process.env.SEED_PASSWORD ?? 'Admin@123'

const LOST_REASONS = [
  { code: 'price_high', name: 'Price High', sortOrder: 1, attributes: { category: 'Commercial', closePipeline: true } },
  { code: 'competitor_selected', name: 'Competitor Selected', sortOrder: 2, attributes: { category: 'Competitive', closePipeline: true } },
  { code: 'delivery_timeline', name: 'Delivery Timeline Issue', sortOrder: 3, attributes: { category: 'Operations', closePipeline: true } },
  { code: 'payment_terms', name: 'Payment Terms Issue', sortOrder: 4, attributes: { category: 'Commercial', closePipeline: true } },
  { code: 'technical_mismatch', name: 'Technical Mismatch', sortOrder: 5, attributes: { category: 'Technical', closePipeline: true } },
  { code: 'no_response', name: 'No Response', sortOrder: 6, attributes: { category: 'Engagement', closePipeline: true } },
  { code: 'budget_hold', name: 'Budget Hold', sortOrder: 7, attributes: { category: 'Commercial', closePipeline: true } },
  { code: 'requirement_changed', name: 'Requirement Changed', sortOrder: 8, attributes: { category: 'Technical', closePipeline: true } },
  { code: 'relationship_issue', name: 'Relationship Issue', sortOrder: 9, attributes: { category: 'Relationship', closePipeline: true } },
  { code: 'spec_mismatch', name: 'Specification Mismatch', sortOrder: 10, attributes: { category: 'Technical', closePipeline: true } },
  { code: 'warranty_terms', name: 'Warranty Terms Unacceptable', sortOrder: 11, attributes: { category: 'Commercial', closePipeline: true } },
  { code: 'after_sales', name: 'After-Sales Concern', sortOrder: 12, attributes: { category: 'Service', closePipeline: true } },
  { code: 'incumbent_vendor', name: 'Incumbent Vendor Retained', sortOrder: 13, attributes: { category: 'Competitive', closePipeline: true } },
  { code: 'tender_cancelled', name: 'Tender Cancelled', sortOrder: 14, attributes: { category: 'Engagement', closePipeline: true } },
  { code: 'project_delayed', name: 'Project Delayed', sortOrder: 15, attributes: { category: 'Commercial', closePipeline: true } },
  { code: 'management_change', name: 'Management Change', sortOrder: 16, attributes: { category: 'Relationship', closePipeline: true } },
  { code: 'credit_limit', name: 'Credit Limit Issue', sortOrder: 17, attributes: { category: 'Commercial', closePipeline: true } },
  { code: 'gst_compliance', name: 'GST / Compliance Issue', sortOrder: 18, attributes: { category: 'Commercial', closePipeline: true } },
  { code: 'freight_cost', name: 'Freight Cost Too High', sortOrder: 19, attributes: { category: 'Operations', closePipeline: true } },
  { code: 'lead_time', name: 'Lead Time Too Long', sortOrder: 20, attributes: { category: 'Operations', closePipeline: true } },
  { code: 'quality_concern', name: 'Quality Concern Raised', sortOrder: 21, attributes: { category: 'Technical', closePipeline: true } },
  { code: 'reference_failed', name: 'Reference Check Failed', sortOrder: 22, attributes: { category: 'Relationship', closePipeline: true } },
  { code: 'demo_unsatisfactory', name: 'Demo Unsatisfactory', sortOrder: 23, attributes: { category: 'Technical', closePipeline: true } },
  { code: 'financing_issue', name: 'Customer Financing Issue', sortOrder: 24, attributes: { category: 'Commercial', closePipeline: true } },
  { code: 'scope_reduction', name: 'Scope Reduction', sortOrder: 25, attributes: { category: 'Technical', closePipeline: true } },
  { code: 'vendor_consolidation', name: 'Vendor Consolidation', sortOrder: 26, attributes: { category: 'Competitive', closePipeline: true } },
  { code: 'price_match_failed', name: 'Could Not Match Price', sortOrder: 27, attributes: { category: 'Commercial', closePipeline: true } },
  { code: 'regulatory_block', name: 'Regulatory Block', sortOrder: 28, attributes: { category: 'Commercial', closePipeline: true } },
  { code: 'internal_priority_shift', name: 'Internal Priority Shift', sortOrder: 29, attributes: { category: 'Engagement', closePipeline: true } },
  { code: 'competitor_bundle', name: 'Competitor Bundle Offer', sortOrder: 30, attributes: { category: 'Competitive', closePipeline: true } },
  { code: 'other', name: 'Other', sortOrder: 99, attributes: { category: 'Other', closePipeline: true } },
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

  const listRes = await fetch(`${BASE}/t/${TENANT}/crm/masters/lost-reasons?limit=100`, { headers })
  const listJson = (await listRes.json()) as {
    data?: Array<{ id: string; code: string }> | { items?: Array<{ id: string; code: string }> }
  }
  const existing = Array.isArray(listJson.data) ? listJson.data : (listJson.data?.items ?? [])
  const byCode = new Map(existing.map((e) => [e.code, e.id]))

  let created = 0
  let skipped = 0
  let failed = 0

  for (const row of LOST_REASONS) {
    if (byCode.has(row.code)) {
      skipped++
      continue
    }
    const res = await fetch(`${BASE}/t/${TENANT}/crm/masters/lost-reasons`, {
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

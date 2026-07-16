/**
 * Upsert document-types CRM masters via API (+ sync ensure).
 * Usage: npx tsx scripts/seed-document-types.ts
 */
const BASE = process.env.VITE_API_BASE_URL ?? 'http://127.0.0.1:5000/api/v1'
const TENANT = process.env.VITE_TENANT_SLUG ?? 'vasant-trailers'
const EMAIL = process.env.SEED_EMAIL ?? 'admin@vasant-trailers.com'
const PASSWORD = process.env.SEED_PASSWORD ?? 'Admin@123'

const DOCUMENT_TYPES = [
  { code: 'general', name: 'General Document', sortOrder: 1, attributes: { requiredFor: 'Any', fileTypes: 'pdf,jpg,png,doc,docx', maxSizeMb: 10 } },
  { code: 'customer_po', name: 'Customer PO', sortOrder: 2, attributes: { requiredFor: 'Sales Order', fileTypes: 'pdf,jpg,png', maxSizeMb: 10 } },
  { code: 'customer_requirement', name: 'Customer Requirement', sortOrder: 3, attributes: { requiredFor: 'Quotation', fileTypes: 'pdf,doc,docx', maxSizeMb: 15 } },
  { code: 'drawing', name: 'Drawing', sortOrder: 4, attributes: { requiredFor: 'Quotation', fileTypes: 'pdf,dwg', maxSizeMb: 25 } },
  { code: 'technical_spec', name: 'Technical Specification', sortOrder: 5, attributes: { requiredFor: 'Quotation', fileTypes: 'pdf,doc,docx', maxSizeMb: 15 } },
  { code: 'quotation_pdf', name: 'Quotation PDF', sortOrder: 6, attributes: { requiredFor: 'Quotation', fileTypes: 'pdf', maxSizeMb: 10 } },
  { code: 'approval_note', name: 'Approval Note', sortOrder: 7, attributes: { requiredFor: 'Quotation Approval', fileTypes: 'pdf', maxSizeMb: 5 } },
  { code: 'email_copy', name: 'Email Copy', sortOrder: 8, attributes: { requiredFor: 'Communication', fileTypes: 'pdf,eml', maxSizeMb: 5 } },
  { code: 'signed_quotation', name: 'Signed Quotation', sortOrder: 9, attributes: { requiredFor: 'Sales Order', fileTypes: 'pdf,jpg,png', maxSizeMb: 10 } },
  { code: 'tender_document', name: 'Tender Document', sortOrder: 10, attributes: { requiredFor: 'Opportunity', fileTypes: 'pdf,zip', maxSizeMb: 50 } },
  { code: 'customer_communication', name: 'Customer Communication', sortOrder: 11, attributes: { requiredFor: 'Lead', fileTypes: 'pdf,eml,jpg', maxSizeMb: 10 } },
  { code: 'gst_certificate', name: 'GST Certificate', sortOrder: 12, attributes: { requiredFor: 'Company', fileTypes: 'pdf,jpg,png', maxSizeMb: 5 } },
  { code: 'pan_card', name: 'PAN Card', sortOrder: 13, attributes: { requiredFor: 'Company', fileTypes: 'pdf,jpg,png', maxSizeMb: 5 } },
  { code: 'company_profile', name: 'Company Profile', sortOrder: 14, attributes: { requiredFor: 'Lead', fileTypes: 'pdf,ppt,pptx', maxSizeMb: 20 } },
  { code: 'site_photo', name: 'Site Photo', sortOrder: 15, attributes: { requiredFor: 'Opportunity', fileTypes: 'jpg,png,jpeg', maxSizeMb: 10 } },
  { code: 'inspection_report', name: 'Inspection Report', sortOrder: 16, attributes: { requiredFor: 'Sales Order', fileTypes: 'pdf', maxSizeMb: 15 } },
  { code: 'delivery_challan', name: 'Delivery Challan', sortOrder: 17, attributes: { requiredFor: 'Dispatch', fileTypes: 'pdf,jpg,png', maxSizeMb: 10 } },
  { code: 'invoice_copy', name: 'Invoice Copy', sortOrder: 18, attributes: { requiredFor: 'Finance', fileTypes: 'pdf', maxSizeMb: 10 } },
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

  const listRes = await fetch(`${BASE}/t/${TENANT}/crm/masters/document-types?limit=100`, { headers })
  const listJson = (await listRes.json()) as {
    data?: Array<{ id: string; code: string }> | { items?: Array<{ id: string; code: string }> }
  }
  const existing = Array.isArray(listJson.data) ? listJson.data : (listJson.data?.items ?? [])
  const byCode = new Map(existing.map((e) => [e.code, e.id]))

  let created = 0
  let skipped = 0
  let failed = 0

  for (const row of DOCUMENT_TYPES) {
    if (byCode.has(row.code)) {
      skipped++
      continue
    }
    const res = await fetch(`${BASE}/t/${TENANT}/crm/masters/document-types`, {
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

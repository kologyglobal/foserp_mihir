/**
 * Import / update the Kology customer (CRM company) master from a CSV export.
 *
 * The customer master used by CRM quotations, sales orders, proforma / tax
 * invoices, and payment receipts is `CrmCompany` (see
 * backend/src/modules/crm/companies) — this script upserts into that table,
 * scoped to a single tenant (default: kology). Idempotent — safe to re-run
 * whenever the source CSV is refreshed.
 *
 * Usage:
 *   cd backend && npx tsx scripts/seed-kology-customers-from-csv.ts [csvPath]
 *   Optional env: TENANT_SLUG=kology  CSV_PATH="C:\...\file.csv"
 *   Defaults to: C:\Users\Admin\Downloads\client_master_enriched_25.csv
 *
 * Match key: GSTIN (if the CSV supplies one) else normalized company name.
 * Existing customers not present in the CSV are left untouched. Matched
 * customers are updated (CSV values win when non-empty); unmatched rows
 * create a new CrmCompany (+ a primary CrmContact when the row's "Customer
 * Name" is a distinct person from the "Company Name").
 *
 * Column mapping (CSV header -> CrmCompany field):
 *   Company Name (falls back to Customer Name when blank) -> name
 *   Customer Name (kept only when it differs from Company Name)
 *                                                    -> contactPerson (+ CrmContact)
 *   Email                                             -> email, contactEmail
 *   Work Phone                                        -> phone, contactPhone (digits only)
 *   GSTIN (if the CSV has a real GSTIN column)        -> gstin
 *   Website                                           -> website
 *   Industry                                          -> industry
 *   Address                                           -> addressLine1
 *   City / State / Province / Postal Code / Country   -> city / state / pincode / country
 *   GST Treatment, Receivable (INR), Research Status,
 *   Match Confidence, Source URL, Research Notes      -> notes ([csv-import] block;
 *                                                          any pre-existing hand-written
 *                                                          notes outside that block are kept)
 *
 * Placeholders such as "", "-", "—", "N/A", "None", "000000" are treated as
 * empty and never overwrite existing data.
 */
import { readFileSync } from 'node:fs'
import { parse } from 'csv-parse/sync'
import { prisma } from '../src/config/database.js'
import { nextCode } from '../src/services/codeSeries.service.js'
import { normalizeCompanyName } from '../src/modules/crm/integrations/indiamart/indiamart.normalizer.js'
import { validateEmail } from '../src/utils/emailValidation.js'
import type { CrmCompany } from '@prisma/client'

const TENANT_SLUG = process.env.TENANT_SLUG ?? 'kology'
const DEFAULT_CSV_PATH = 'C:\\Users\\Admin\\Downloads\\client_master_enriched_25.csv'
const CSV_PATH = process.argv[2] ?? process.env.CSV_PATH ?? DEFAULT_CSV_PATH

const PLACEHOLDER_VALUES = new Set([
  '', '-', '—', '–', 'na', 'n/a', 'none', 'nil', 'null', '000000', '0000000',
])

function clean(value: unknown): string {
  const s = String(value ?? '').trim()
  return PLACEHOLDER_VALUES.has(s.toLowerCase()) ? '' : s
}

/** Maps our internal field names to accepted CSV header variants (case-insensitive). */
const HEADER_ALIASES: Record<string, string[]> = {
  customerName: ['customer name', 'client name', 'name', 'contact name'],
  companyName: ['company name', 'organisation', 'organization', 'account name'],
  email: ['email', 'email address'],
  phone: ['work phone', 'phone', 'mobile', 'contact number', 'phone number'],
  gstin: ['gstin', 'gst number', 'gst no', 'gst no.'],
  gstTreatment: ['gst treatment', 'gst type'],
  receivable: ['receivable (inr)', 'receivable', 'outstanding', 'balance'],
  website: ['website', 'web site'],
  industry: ['industry'],
  address: ['address', 'address line 1', 'billing address'],
  city: ['city'],
  state: ['state / province', 'state', 'province'],
  postalCode: ['postal code', 'pincode', 'pin code', 'zip', 'zip code'],
  country: ['country'],
  researchStatus: ['research status'],
  matchConfidence: ['match confidence'],
  sourceUrl: ['source url'],
  researchNotes: ['research notes'],
}

function buildHeaderMap(headers: string[]): Record<string, string> {
  const normalized = headers.map((h) => [h, h.trim().toLowerCase()] as const)
  const map: Record<string, string> = {}
  for (const [field, aliases] of Object.entries(HEADER_ALIASES)) {
    const found = normalized.find(([, norm]) => aliases.includes(norm))
    if (found) map[field] = found[0]
  }
  return map
}

function pick(record: Record<string, string>, headerMap: Record<string, string>, field: string): string {
  const key = headerMap[field]
  if (!key) return ''
  return clean(record[key])
}

function normalizePhone(value: string): string {
  return value.replace(/\D/g, '').slice(0, 15)
}

function normalizeEmailOrEmpty(value: string): string {
  if (!value) return ''
  const trimmed = value.trim().toLowerCase()
  return validateEmail(trimmed) === null ? trimmed.slice(0, 255) : ''
}

/** True when the two names share a meaningful word (len > 2) — treat as the same
 * organization (e.g. "Vasant Febrication" vs "Vasant Fabricators Pvt. Ltd."),
 * not a distinct contact person. */
function sharesSignificantWord(a: string, b: string): boolean {
  const wordsA = new Set((normalizeCompanyName(a) ?? '').split(' ').filter((w) => w.length > 2))
  const wordsB = new Set((normalizeCompanyName(b) ?? '').split(' ').filter((w) => w.length > 2))
  for (const w of wordsA) if (wordsB.has(w)) return true
  return false
}

const IMPORT_BLOCK_RE = /\[csv-import\][\s\S]*?\[\/csv-import\]/

function buildImportNotesBlock(row: {
  gstTreatment: string
  receivable: string
  researchStatus: string
  matchConfidence: string
  sourceUrl: string
  researchNotes: string
}): string {
  const lines: string[] = []
  if (row.gstTreatment) lines.push(`gstTreatment: ${row.gstTreatment}`)
  if (row.receivable && Number(row.receivable) !== 0 && !Number.isNaN(Number(row.receivable))) {
    lines.push(`openingReceivableINR: ${row.receivable}`)
  }
  if (row.researchStatus) lines.push(`researchStatus: ${row.researchStatus}`)
  if (row.matchConfidence) lines.push(`matchConfidence: ${row.matchConfidence}`)
  if (row.sourceUrl) lines.push(`sourceUrl: ${row.sourceUrl}`)
  if (row.researchNotes) lines.push(`researchNotes: ${row.researchNotes}`)
  if (lines.length === 0) return ''
  return ['[csv-import]', ...lines, '[/csv-import]'].join('\n')
}

/** Replaces any prior auto-generated block, preserving hand-written notes around it. */
function mergeNotes(existing: string | null | undefined, importBlock: string): string {
  const prior = (existing ?? '').replace(IMPORT_BLOCK_RE, '').trim()
  return [prior, importBlock].filter(Boolean).join('\n\n')
}

type ImportRow = {
  rowNumber: number
  name: string
  contactPerson: string
  email: string
  phone: string
  gstin: string
  website: string
  industry: string
  address: string
  city: string
  state: string
  pincode: string
  country: string
  importNotes: string
}

async function main() {
  console.log(`Importing Kology customer master from: ${CSV_PATH}`)
  console.log(`Target tenant slug: ${TENANT_SLUG}`)

  const tenant = await prisma.tenant.findFirst({ where: { slug: TENANT_SLUG, deletedAt: null } })
  if (!tenant) throw new Error(`Tenant not found: ${TENANT_SLUG}. Run db:setup / seed first.`)
  const tid = tenant.id

  const admin = await prisma.user.findFirst({
    where: { tenantId: tid, deletedAt: null, status: 'ACTIVE' },
    orderBy: { createdAt: 'asc' },
  })
  const actorId = admin?.id ?? null

  const csvText = readFileSync(CSV_PATH, 'utf8').replace(/^\uFEFF/, '')
  const records = parse(csvText, { columns: true, skip_empty_lines: true, trim: true }) as Record<string, string>[]
  if (records.length === 0) {
    console.log('CSV has no data rows. Nothing to do.')
    return
  }

  const headerMap = buildHeaderMap(Object.keys(records[0]))
  for (const h of ['customerName', 'companyName']) {
    if (!headerMap[h]) console.warn(`! Could not find a column for "${h}" — check CSV headers`)
  }

  const seenKeys = new Set<string>()
  const rows: ImportRow[] = []
  let skippedNoName = 0
  let skippedDuplicateInCsv = 0

  for (let i = 0; i < records.length; i++) {
    const record = records[i]
    const customerNameRaw = pick(record, headerMap, 'customerName')
    const companyNameRaw = pick(record, headerMap, 'companyName')
    const name = (companyNameRaw || customerNameRaw).slice(0, 300)
    if (!name) {
      skippedNoName += 1
      console.log(`  - skip row ${i + 2}: no usable customer/company name`)
      continue
    }

    const key = normalizeCompanyName(name) ?? name.toLowerCase()
    if (seenKeys.has(key)) {
      skippedDuplicateInCsv += 1
      console.log(`  - skip row ${i + 2}: duplicate of an earlier row ("${name}")`)
      continue
    }
    seenKeys.add(key)

    const isDistinctContact =
      !!companyNameRaw &&
      !!customerNameRaw &&
      normalizeCompanyName(companyNameRaw) !== normalizeCompanyName(customerNameRaw) &&
      !sharesSignificantWord(companyNameRaw, customerNameRaw)

    rows.push({
      rowNumber: i + 2,
      name,
      contactPerson: isDistinctContact ? customerNameRaw.slice(0, 200) : '',
      email: normalizeEmailOrEmpty(pick(record, headerMap, 'email')),
      phone: normalizePhone(pick(record, headerMap, 'phone')),
      gstin: pick(record, headerMap, 'gstin').slice(0, 20),
      website: pick(record, headerMap, 'website').slice(0, 255),
      industry: pick(record, headerMap, 'industry').slice(0, 100),
      address: pick(record, headerMap, 'address').slice(0, 500),
      city: pick(record, headerMap, 'city').slice(0, 100),
      state: pick(record, headerMap, 'state').slice(0, 100),
      pincode: pick(record, headerMap, 'postalCode').slice(0, 20),
      country: pick(record, headerMap, 'country').slice(0, 100),
      importNotes: buildImportNotesBlock({
        gstTreatment: pick(record, headerMap, 'gstTreatment'),
        receivable: pick(record, headerMap, 'receivable'),
        researchStatus: pick(record, headerMap, 'researchStatus'),
        matchConfidence: pick(record, headerMap, 'matchConfidence'),
        sourceUrl: pick(record, headerMap, 'sourceUrl'),
        researchNotes: pick(record, headerMap, 'researchNotes'),
      }),
    })
  }

  const existing = await prisma.crmCompany.findMany({ where: { tenantId: tid, deletedAt: null } })
  const byGstin = new Map<string, CrmCompany>(
    existing.filter((c) => c.gstin).map((c) => [c.gstin!.trim().toUpperCase(), c]),
  )
  const byName = new Map<string, CrmCompany>(
    existing.map((c) => [normalizeCompanyName(c.name) ?? c.name.toLowerCase(), c]),
  )

  let created = 0
  let updated = 0
  let contactsUpserted = 0

  for (const row of rows) {
    const gstinKey = row.gstin ? row.gstin.trim().toUpperCase() : ''
    const nameKey = normalizeCompanyName(row.name) ?? row.name.toLowerCase()
    const match = (gstinKey && byGstin.get(gstinKey)) || byName.get(nameKey)

    let companyId: string
    if (match) {
      const updatedCompany = await prisma.crmCompany.update({
        where: { id: match.id },
        data: {
          name: row.name,
          industry: row.industry || match.industry,
          website: row.website || match.website,
          email: row.email || match.email,
          phone: row.phone || match.phone,
          addressLine1: row.address || match.addressLine1,
          city: row.city || match.city,
          state: row.state || match.state,
          pincode: row.pincode || match.pincode,
          country: row.country || match.country,
          gstin: gstinKey || match.gstin,
          // Authoritative from this run's CSV-derived logic (not merged) so a
          // corrected heuristic / refreshed CSV can clear a stale contact person.
          contactPerson: row.contactPerson || null,
          contactPhone: row.phone || match.contactPhone,
          contactEmail: row.email || match.contactEmail,
          notes: mergeNotes(match.notes, row.importNotes),
          isActive: true,
          deletedAt: null,
          updatedBy: actorId,
        },
      })
      companyId = updatedCompany.id
      byName.set(nameKey, updatedCompany)
      if (gstinKey) byGstin.set(gstinKey, updatedCompany)
      updated += 1
      console.log(`  ~ updated: ${row.name} (row ${row.rowNumber})`)
    } else {
      const companyCode = await nextCode(tid, 'CRM_COMPANY')
      const createdCompany = await prisma.crmCompany.create({
        data: {
          tenantId: tid,
          companyCode,
          name: row.name,
          customerType: 'corporate',
          industry: row.industry || null,
          website: row.website || null,
          email: row.email || null,
          phone: row.phone || null,
          addressLine1: row.address || null,
          city: row.city || null,
          state: row.state || null,
          pincode: row.pincode || null,
          country: row.country || 'India',
          gstin: gstinKey || null,
          contactPerson: row.contactPerson || null,
          contactPhone: row.phone || null,
          contactEmail: row.email || null,
          status: 'active',
          isActive: true,
          notes: mergeNotes(null, row.importNotes),
          ownerId: actorId,
          createdBy: actorId,
          updatedBy: actorId,
        },
      })
      companyId = createdCompany.id
      byName.set(nameKey, createdCompany)
      if (gstinKey) byGstin.set(gstinKey, createdCompany)
      created += 1
      console.log(`  + created: ${row.name} (${companyCode}, row ${row.rowNumber})`)
    }

    if (row.contactPerson) {
      const [firstName, ...rest] = row.contactPerson.trim().split(/\s+/)
      const lastName = rest.join(' ')
      const existingPrimary = await prisma.crmContact.findFirst({
        where: { tenantId: tid, companyId, isPrimary: true, deletedAt: null },
      })
      if (existingPrimary) {
        await prisma.crmContact.update({
          where: { id: existingPrimary.id },
          data: {
            firstName: firstName || row.contactPerson,
            lastName,
            email: row.email || existingPrimary.email,
            mobile: row.phone || existingPrimary.mobile,
            isActive: true,
            status: 'active',
            deletedAt: null,
            updatedBy: actorId,
          },
        })
      } else {
        const contactCode = await nextCode(tid, 'CONTACT')
        await prisma.crmContact.create({
          data: {
            tenantId: tid,
            contactCode,
            companyId,
            firstName: firstName || row.contactPerson,
            lastName,
            email: row.email || null,
            mobile: row.phone || null,
            isPrimary: true,
            isActive: true,
            status: 'active',
            ownerId: actorId,
            createdBy: actorId,
            updatedBy: actorId,
          },
        })
      }
      contactsUpserted += 1
    }
  }

  const totalActive = await prisma.crmCompany.count({ where: { tenantId: tid, deletedAt: null } })

  console.log('\n=== Kology customer master CSV import complete ===')
  console.log(`CSV data rows read:            ${records.length}`)
  console.log(`Skipped (no usable name):      ${skippedNoName}`)
  console.log(`Skipped (duplicate in CSV):    ${skippedDuplicateInCsv}`)
  console.log(`Created:                       ${created}`)
  console.log(`Updated:                       ${updated}`)
  console.log(`Primary contacts upserted:     ${contactsUpserted}`)
  console.log(`Active CrmCompany rows now in tenant "${TENANT_SLUG}": ${totalActive}`)
  console.log('\nRe-run any time the CSV is refreshed — matches on GSTIN (if present) else normalized company name.')
  console.log('Verify in UI: CRM > Companies list, quotation/sales-order customer picker.')
}

main()
  .catch((err) => {
    console.error(err)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })

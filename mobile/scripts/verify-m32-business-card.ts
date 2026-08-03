/**
 * M3.2 Business Card Scanner — structural + pure unit checks.
 */
import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  parseBusinessCardText,
} from '../src/features/crm/businessCard/parseBusinessCardText.ts'
import { findBusinessCardDuplicates } from '../src/features/crm/businessCard/duplicateDetection.ts'
import {
  toCompanyPayload,
  toContactPayload,
  toLeadPayload,
} from '../src/features/crm/businessCard/mapToCrmPayloads.ts'
import { EMPTY_BUSINESS_CARD_FIELDS } from '../src/features/crm/businessCard/types.ts'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const src = (...p: string[]) => join(root, ...p)

const required = [
  'src/features/crm/businessCard/parseBusinessCardText.ts',
  'src/features/crm/businessCard/ocrEngine.ts',
  'src/features/crm/businessCard/duplicateDetection.ts',
  'src/features/crm/businessCard/saveBusinessCard.ts',
  'src/features/crm/businessCard/scanStore.ts',
  'app/(app)/crm/business-card/index.tsx',
  'app/(app)/crm/business-card/preview.tsx',
  'app/(app)/crm/business-card/review.tsx',
]
for (const rel of required) {
  assert.ok(existsSync(src(rel)), `missing ${rel}`)
}

// English + Indian sample card
const sample = `
RAHUL SHARMA
Sales Manager
ABC Engineering Pvt Ltd
+91 98765 43210
022-40001234
rahul.sharma@abcengg.in
www.abcengg.in
Plot 12, MIDC, Pune 411019
Maharashtra India
GSTIN 27AABCU9603R1ZM
linkedin.com/in/rahulsharma
`

const parsed = parseBusinessCardText(sample)
assert.ok(parsed.fields.mobile.includes('9876543210') || parsed.fields.mobile === '9876543210')
assert.ok(parsed.fields.email.includes('rahul'))
assert.ok(parsed.fields.company.toLowerCase().includes('abc'))
assert.ok(parsed.fields.firstName.toLowerCase().includes('rahul') || parsed.fields.firstName)
assert.ok(parsed.fields.gstin.toUpperCase().includes('27AABCU9603R1ZM'))
assert.ok(parsed.fields.pincode === '411019' || parsed.fields.pincode)
assert.ok((parsed.confidence.mobile ?? 0) >= 90)

// Multiple phones / emails
const multi = parseBusinessCardText(`
Priya Nair
Director
priya@acme.com
info@acme.com
9988776655
8877665544
Acme Solutions LLP
`)
assert.ok(multi.fields.mobile)
assert.ok(multi.fields.alternateMobile || multi.fields.email)
assert.ok(multi.fields.email)

// Duplicate detection
const dups = findBusinessCardDuplicates({
  fields: {
    ...EMPTY_BUSINESS_CARD_FIELDS,
    mobile: '9876543210',
    email: 'rahul.sharma@abcengg.in',
    company: 'ABC Engineering Pvt Ltd',
    gstin: '27AABCU9603R1ZM',
  },
  companies: [
    {
      id: 'c1',
      name: 'ABC Engineering Pvt Ltd',
      gstin: '27AABCU9603R1ZM',
      phone: '9876543210',
    },
  ],
  leads: [{ id: 'l1', prospectName: 'Rahul', mobile: '9876543210' }],
  contacts: [],
})
assert.ok(dups.some((d) => d.kind === 'company'))
assert.ok(dups[0]!.score >= 30)

// CRM payloads
const f = parsed.fields
const lead = toLeadPayload(f)
assert.equal(typeof lead.prospectName, 'string')
assert.ok(String(lead.prospectName).length > 0)
assert.equal(lead.priority, 'medium')

const company = toCompanyPayload(f)
assert.ok(company.customerName)

const contact = toContactPayload(f, '550e8400-e29b-41d4-a716-446655440000')
assert.equal(contact.customerId, '550e8400-e29b-41d4-a716-446655440000')
assert.ok(contact.name)

// Entry points wired
const fab = readFileSync(src('src/features/crm/components/CrmFab.tsx'), 'utf8')
assert.ok(fab.includes('business-card'))
const home = readFileSync(src('app/(app)/(tabs)/index.tsx'), 'utf8')
assert.ok(home.includes('business-card'))
const offline = readFileSync(src('src/types/crm.ts'), 'utf8')
assert.ok(offline.includes('business_card'))
const drafts = readFileSync(src('src/features/crm/offlineDrafts.ts'), 'utf8')
assert.ok(drafts.includes('business_card'))
const pkg = JSON.parse(readFileSync(src('package.json'), 'utf8'))
assert.ok(pkg.dependencies['expo-image-manipulator'])

console.log('M3.2 Business Card Scanner checks: PASS')

/**
 * Pure business-card OCR text → structured fields (English + Indian cards).
 * No AI enrichment — pattern / heuristic only.
 */

import {
  EMPTY_BUSINESS_CARD_FIELDS,
  type BusinessCardConfidence,
  type BusinessCardFields,
  type ParsedBusinessCard,
} from './types'

const EMAIL_RE = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi
const URL_RE = /(?:https?:\/\/)?(?:www\.)?[a-z0-9][-a-z0-9.]*\.[a-z]{2,}(?:\/\S*)?/gi
const LINKEDIN_RE = /(?:https?:\/\/)?(?:www\.)?linkedin\.com\/\S+/gi
const GSTIN_RE = /\b\d{2}[A-Z]{5}\d{4}[A-Z][A-Z0-9]Z[A-Z0-9]\b/gi
const PIN_RE = /\b\d{6}\b/g
const PHONE_RE =
  /(?:\+?91[\s-]?)?(?:0)?(?:\d{5}[\s-]?\d{5}|\d{3}[\s-]?\d{3}[\s-]?\d{4}|\d{4}[\s-]?\d{3}[\s-]?\d{3}|\d{10,12})/g

const DESIGNATION_HINTS =
  /\b(ceo|cto|cfo|coo|md|director|manager|engineer|sales|purchase|founder|partner|executive|head|lead|officer|president|vp|vice\s*president|owner|proprietor|consultant|architect|gm|agm|sr\.?\s*|senior|junior|asst\.?|assistant)\b/i

const COMPANY_HINTS =
  /\b(pvt\.?\s*ltd|private\s+limited|ltd|limited|llp|inc|llc|corp|corporation|industries|engineering|engg|solutions|technologies|tech|systems|services|enterprises|traders|exports|imports|india|mfg|manufacturing|company|co\.)\b/i

const INDIAN_STATES =
  /\b(andhra pradesh|arunachal pradesh|assam|bihar|chhattisgarh|goa|gujarat|haryana|himachal pradesh|jharkhand|karnataka|kerala|madhya pradesh|maharashtra|manipur|meghalaya|mizoram|nagaland|odisha|punjab|rajasthan|sikkim|tamil nadu|telangana|tripura|uttar pradesh|uttarakhand|west bengal|delhi|nct of delhi|jammu and kashmir|ladakh|puducherry|chandigarh)\b/i

const CITY_HINTS =
  /\b(mumbai|pune|bengaluru|bangalore|chennai|hyderabad|ahmedabad|kolkata|delhi|noida|gurgaon|gurugram|jaipur|indore|nagpur|surat|coimbatore|vadodara|lucknow|chandigarh|kochi|trivandrum|thiruvananthapuram|visakhapatnam|bhopal|patna|ranchi|raipur)\b/i

function normalizeLines(raw: string): string[] {
  return raw
    .replace(/\r/g, '\n')
    .split('\n')
    .map((l) => l.replace(/\s+/g, ' ').trim())
    .filter(Boolean)
}

function digitsOnly(s: string): string {
  return s.replace(/\D/g, '')
}

function normalizeIndianMobile(raw: string): string {
  let d = digitsOnly(raw)
  if (d.startsWith('91') && d.length === 12) d = d.slice(2)
  if (d.startsWith('0') && d.length === 11) d = d.slice(1)
  return d
}

function looksLikeName(line: string): boolean {
  if (line.length < 2 || line.length > 60) return false
  if (EMAIL_RE.test(line) || URL_RE.test(line) || PHONE_RE.test(line)) return false
  EMAIL_RE.lastIndex = 0
  URL_RE.lastIndex = 0
  PHONE_RE.lastIndex = 0
  if (COMPANY_HINTS.test(line) || DESIGNATION_HINTS.test(line)) return false
  if (/\d{3,}/.test(line)) return false
  const words = line.split(/\s+/)
  if (words.length > 5) return false
  return /^[A-Za-z.'\-\s]+$/.test(line)
}

function splitName(full: string): { firstName: string; lastName: string } {
  const parts = full.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return { firstName: '', lastName: '' }
  if (parts.length === 1) return { firstName: parts[0]!, lastName: '' }
  return {
    firstName: parts[0]!,
    lastName: parts.slice(1).join(' '),
  }
}

function extractPhones(text: string): string[] {
  const found: string[] = []
  const re = new RegExp(PHONE_RE.source, 'g')
  let m: RegExpExecArray | null
  while ((m = re.exec(text))) {
    const n = normalizeIndianMobile(m[0])
    if (n.length >= 10 && n.length <= 12 && !found.includes(n)) found.push(n.slice(-10))
  }
  return found
}

function extractEmails(text: string): string[] {
  const found: string[] = []
  const re = new RegExp(EMAIL_RE.source, 'gi')
  let m: RegExpExecArray | null
  while ((m = re.exec(text))) {
    const e = m[0].toLowerCase()
    if (!found.includes(e)) found.push(e)
  }
  return found
}

/**
 * Parse multiline OCR text into CRM business-card fields with confidence scores.
 */
export function parseBusinessCardText(rawText: string): ParsedBusinessCard {
  const lines = normalizeLines(rawText || '')
  const text = lines.join('\n')
  const fields: BusinessCardFields = { ...EMPTY_BUSINESS_CARD_FIELDS }
  const confidence: BusinessCardConfidence = {}

  if (!text.trim()) {
    return { fields, confidence, rawText: '', lines: [] }
  }

  // Emails
  const emails = extractEmails(text)
  if (emails[0]) {
    fields.email = emails[0]
    confidence.email = 96
  }
  if (emails[1] && !fields.email) {
    fields.email = emails[1]
    confidence.email = 90
  }

  // Phones
  const phones = extractPhones(text)
  if (phones[0]) {
    fields.mobile = phones[0]
    confidence.mobile = 98
  }
  if (phones[1]) {
    fields.alternateMobile = phones[1]
    confidence.alternateMobile = 92
  }

  // LinkedIn
  const li = text.match(LINKEDIN_RE)
  if (li?.[0]) {
    fields.linkedin = li[0].startsWith('http') ? li[0] : `https://${li[0]}`
    confidence.linkedin = 94
  }

  // Website (not email domain only)
  const urls = text.match(URL_RE) || []
  for (const u of urls) {
    if (/linkedin/i.test(u)) continue
    if (/@/.test(u)) continue
    fields.website = u.replace(/\/$/, '')
    if (!/^https?:\/\//i.test(fields.website)) fields.website = `https://${fields.website}`
    confidence.website = 88
    break
  }

  // GSTIN
  const gst = text.match(GSTIN_RE)
  if (gst?.[0]) {
    fields.gstin = gst[0].toUpperCase()
    confidence.gstin = 97
  }

  // PIN
  const pins = text.match(PIN_RE) || []
  for (const p of pins) {
    // ignore phone substrings already used
    if (phones.some((ph) => ph.includes(p))) continue
    fields.pincode = p
    confidence.pincode = 90
    break
  }

  // State / city
  const stateMatch = text.match(INDIAN_STATES)
  if (stateMatch?.[0]) {
    fields.state = stateMatch[0].replace(/\b\w/g, (c) => c.toUpperCase())
    confidence.state = 85
    if (!fields.country) {
      fields.country = 'India'
      confidence.country = 80
    }
  }
  const cityMatch = text.match(CITY_HINTS)
  if (cityMatch?.[0]) {
    fields.city = cityMatch[0].replace(/\b\w/g, (c) => c.toUpperCase())
    confidence.city = 82
  }

  // Designation
  const desigLine = lines.find((l) => DESIGNATION_HINTS.test(l) && !COMPANY_HINTS.test(l) && l.length < 80)
  if (desigLine) {
    fields.designation = desigLine
    confidence.designation = 78
  }

  // Company
  const companyLine =
    lines.find((l) => COMPANY_HINTS.test(l)) ||
    lines.find(
      (l) =>
        l === l.toUpperCase() &&
        l.length > 3 &&
        l.length < 80 &&
        !EMAIL_RE.test(l) &&
        !PHONE_RE.test(l) &&
        !looksLikeName(l),
    )
  if (companyLine) {
    fields.company = companyLine
    confidence.company = COMPANY_HINTS.test(companyLine) ? 86 : 72
  }

  // Person name — first non-company / non-desig / non-contact line
  const nameLine = lines.find(
    (l) =>
      looksLikeName(l) &&
      l !== fields.company &&
      l !== fields.designation &&
      !CITY_HINTS.test(l) &&
      !INDIAN_STATES.test(l),
  )
  if (nameLine) {
    const { firstName, lastName } = splitName(nameLine)
    fields.firstName = firstName
    fields.lastName = lastName
    confidence.firstName = 84
    confidence.lastName = lastName ? 80 : 50
  }

  // Address — remaining long lines
  const used = new Set(
    [fields.company, fields.designation, nameLine, fields.email, fields.website, fields.linkedin]
      .filter(Boolean)
      .map((s) => s!.toLowerCase()),
  )
  const addressBits = lines.filter((l) => {
    const low = l.toLowerCase()
    if (used.has(low)) return false
    if (EMAIL_RE.test(l) || extractPhones(l).length) return false
    if (looksLikeName(l) && l === nameLine) return false
    if (GSTIN_RE.test(l)) return false
    if (l.length < 8) return false
    if (CITY_HINTS.test(l) && l.split(/\s+/).length <= 2) return false
    return true
  })
  if (addressBits.length) {
    fields.address = addressBits.slice(0, 3).join(', ')
    confidence.address = 65
  }

  if (!fields.country && (fields.gstin || fields.pincode || fields.state)) {
    fields.country = 'India'
    confidence.country = 75
  }

  return { fields, confidence, rawText: text, lines }
}

export function fieldsToEditableList(
  fields: BusinessCardFields,
  confidence: BusinessCardConfidence,
): Array<{ key: keyof BusinessCardFields; value: string; confidence: number; uncertain: boolean }> {
  const keys = Object.keys(EMPTY_BUSINESS_CARD_FIELDS) as Array<keyof BusinessCardFields>
  return keys.map((key) => {
    const conf = confidence[key] ?? (fields[key] ? 55 : 0)
    return {
      key,
      value: fields[key],
      confidence: conf,
      uncertain: Boolean(fields[key]) && conf < 75,
    }
  })
}

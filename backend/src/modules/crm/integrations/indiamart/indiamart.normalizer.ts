import { IndiaMartError } from './indiamart.errors.js'
import {
  DEFAULT_RESPONSE_FIELD_MAP,
  type IndiaMartNormalizedEnquiry,
} from './indiamart.types.js'

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  return value as Record<string, unknown>
}

function pickString(
  row: Record<string, unknown>,
  keys: readonly string[],
): string | null {
  for (const key of keys) {
    const raw = row[key]
    if (raw == null) continue
    const s = String(raw).trim()
    if (s) return s
  }
  return null
}

/** Parse IndiaMART QUERY_TIME variants (IST). */
export function parseIndiaMartDate(value: string | null | undefined): Date | null {
  if (!value?.trim()) return null
  const raw = value.trim()
  const iso = Date.parse(raw)
  if (!Number.isNaN(iso)) return new Date(iso)

  // DD-Mon-YYYY or DD-Mon-YYYY HH:MM:SS
  const monMatch = raw.match(
    /^(\d{1,2})-([A-Za-z]{3})-(\d{4})(?:[ T]?(\d{1,2}):(\d{2})(?::(\d{2}))?)?$/,
  )
  if (monMatch) {
    const months: Record<string, number> = {
      jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
      jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11,
    }
    const mon = months[monMatch[2]!.toLowerCase()]
    if (mon == null) return null
    return new Date(Date.UTC(
      Number(monMatch[3]),
      mon,
      Number(monMatch[1]),
      Number(monMatch[4] ?? 0) - 5, // IST→approx UTC (-5:30 handled below)
      Number(monMatch[5] ?? 0) - 30,
      Number(monMatch[6] ?? 0),
    ))
  }

  // DD-MM-YYYYHH:MM:SS (no separator between date and time — IndiaMART format)
  const compact = raw.match(/^(\d{2})-(\d{2})-(\d{4})(\d{2}):(\d{2}):(\d{2})$/)
  if (compact) {
    const ist = new Date(Date.UTC(
      Number(compact[3]),
      Number(compact[2]) - 1,
      Number(compact[1]),
      Number(compact[4]) - 5,
      Number(compact[5]) - 30,
      Number(compact[6]),
    ))
    return ist
  }

  return null
}

export function normalizeMobile(value: string | null | undefined): string | null {
  if (!value?.trim()) return null
  const digits = value.replace(/\D/g, '')
  if (!digits) return null
  // Preserve country code when present; normalize IN 10-digit mobiles with 91 prefix
  if (digits.length === 10) return `91${digits}`
  if (digits.length === 12 && digits.startsWith('91')) return digits
  if (digits.length === 11 && digits.startsWith('0')) return `91${digits.slice(1)}`
  return digits
}

export function normalizeEmail(value: string | null | undefined): string | null {
  if (!value?.trim()) return null
  const email = value.trim().toLowerCase()
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return null
  return email
}

export function normalizeCompanyName(value: string | null | undefined): string | null {
  if (!value?.trim()) return null
  return value
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\b(private|pvt|ltd|limited|llp|inc|corp|corporation|co)\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim() || null
}

export function normalizeProductName(value: string | null | undefined): string | null {
  if (!value?.trim()) return null
  return value.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim() || null
}

export function buildDedupeFingerprint(input: {
  normalizedMobile: string | null
  normalizedEmail: string | null
  normalizedCompanyName: string | null
  productName: string | null
  enquiryDate: Date | null
}): string | null {
  const bucket = input.enquiryDate
    ? input.enquiryDate.toISOString().slice(0, 10)
    : ''
  const parts = [
    input.normalizedMobile ?? '',
    input.normalizedEmail ?? '',
    input.normalizedCompanyName ?? '',
    normalizeProductName(input.productName) ?? '',
    bucket,
  ]
  if (parts.every((p) => !p)) return null
  return parts.join('|')
}

export function formatIndiaMartTimestamp(date: Date): string {
  // IST = UTC+5:30 — IndiaMART expects DD-MM-YYYYHH:MM:SS in IST
  const istMs = date.getTime() + 5.5 * 60 * 60 * 1000
  const d = new Date(istMs)
  const dd = String(d.getUTCDate()).padStart(2, '0')
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0')
  const yyyy = d.getUTCFullYear()
  const hh = String(d.getUTCHours()).padStart(2, '0')
  const mi = String(d.getUTCMinutes()).padStart(2, '0')
  const ss = String(d.getUTCSeconds()).padStart(2, '0')
  return `${dd}-${mm}-${yyyy}${hh}:${mi}:${ss}`
}

export function maskSecret(value: string | null | undefined): string | null {
  if (!value) return null
  if (value.length <= 4) return '****'
  return `${'*'.repeat(Math.min(12, value.length - 4))}${value.slice(-4)}`
}

export function maskMobile(value: string | null | undefined): string | null {
  if (!value) return null
  const digits = value.replace(/\D/g, '')
  if (digits.length < 4) return '****'
  return `${'*'.repeat(Math.max(0, digits.length - 4))}${digits.slice(-4)}`
}

export function maskEmail(value: string | null | undefined): string | null {
  if (!value) return null
  const [user, domain] = value.split('@')
  if (!domain) return '****'
  const visible = user.slice(0, 2)
  return `${visible}***@${domain}`
}

type FieldMap = typeof DEFAULT_RESPONSE_FIELD_MAP

export function normalizeIndiaMartEnquiry(
  rawPayload: unknown,
  fieldMap?: Partial<Record<keyof FieldMap, string[]>>,
): IndiaMartNormalizedEnquiry {
  const row = asRecord(rawPayload)
  if (!row) {
    throw new IndiaMartError('PAYLOAD_INVALID', 'Enquiry payload must be an object')
  }

  const map: FieldMap = { ...DEFAULT_RESPONSE_FIELD_MAP }
  if (fieldMap) {
    for (const [k, v] of Object.entries(fieldMap)) {
      if (v?.length) (map as unknown as Record<string, string[]>)[k] = v
    }
  }

  const externalEnquiryId = pickString(row, map.externalEnquiryId)
  if (!externalEnquiryId) {
    throw new IndiaMartError('PAYLOAD_INVALID', 'Missing UNIQUE_QUERY_ID (external enquiry id)')
  }

  const quantityText = pickString(row, map.quantityText)
  const qtyNum = quantityText ? Number(String(quantityText).replace(/[^\d.]/g, '')) : null

  return {
    externalEnquiryId,
    enquiryDate: parseIndiaMartDate(pickString(row, map.enquiryDate)),
    buyerName: pickString(row, map.buyerName),
    buyerCompanyName: pickString(row, map.buyerCompanyName),
    buyerMobile: pickString(row, map.buyerMobile),
    buyerAlternateMobile: pickString(row, map.buyerAlternateMobile),
    buyerEmail: pickString(row, map.buyerEmail),
    buyerAddress: pickString(row, map.buyerAddress),
    buyerCity: pickString(row, map.buyerCity),
    buyerState: pickString(row, map.buyerState),
    buyerCountry: pickString(row, map.buyerCountry),
    buyerPincode: pickString(row, map.buyerPincode),
    subject: pickString(row, map.subject),
    requirementText: pickString(row, map.requirementText),
    productName: pickString(row, map.productName),
    productCategory: pickString(row, map.productCategory),
    quantityText,
    quantityValue: qtyNum != null && Number.isFinite(qtyNum) ? qtyNum : null,
    quantityUom: null,
    estimatedOrderValue: null,
    sourceType: pickString(row, map.sourceType),
    sourceUrl: pickString(row, map.sourceUrl),
    senderIp: pickString(row, ['SENDER_IP', 'sender_ip']),
    rawPayload,
  }
}

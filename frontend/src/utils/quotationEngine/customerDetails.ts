import { resolvePlaceholders } from './placeholders'

const UUID_LINE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

/** Standard customer-details block for print / PDF (legacy + fallback). */
export function formatCustomerDetailsFromMap(
  map: Record<string, string>,
  salesOwnerName?: string | null,
): string {
  const lines: string[] = []
  if (map.customer_name && map.customer_name !== '-') {
    lines.push(map.customer_name)
  }
  if (map.customer_address && map.customer_address !== '-') {
    lines.push(map.customer_address)
  }
  if (lines.length === 0) lines.push(map.customer_name || '-')

  lines.push('')
  lines.push(`Contact: ${map.contact_person}`)
  if (map.contact_mobile && map.contact_mobile !== '-') {
    lines.push(`Mobile: ${map.contact_mobile}`)
  }
  if (map.contact_email && map.contact_email !== '-') {
    lines.push(`Email: ${map.contact_email}`)
  }
  if (salesOwnerName?.trim()) {
    lines.push(`Sales owner: ${salesOwnerName.trim()}`)
  }
  return lines.join('\n')
}

function isLegacyCustomerDetailsContent(content: string): boolean {
  const trimmed = content.trim()
  if (!trimmed) return false
  if (/Sales owner:/i.test(trimmed)) return true
  const firstLine = trimmed.split('\n').find((line) => line.trim())?.trim() ?? ''
  return UUID_LINE.test(firstLine)
}

/** Resolve customer-details section for print — handles placeholders, legacy UUID rows, and fallbacks. */
export function resolveCustomerDetailsPrintContent(
  storedContent: string,
  map: Record<string, string>,
  salesOwnerName?: string | null,
): string {
  const trimmed = storedContent.trim()
  if (!trimmed) {
    return formatCustomerDetailsFromMap(map, salesOwnerName)
  }
  if (trimmed.includes('{{')) {
    const resolved = resolvePlaceholders(storedContent, map).trim()
    if (resolved && !UUID_LINE.test(resolved.split('\n').find((l) => l.trim())?.trim() ?? '')) {
      return resolved
    }
    return formatCustomerDetailsFromMap(map, salesOwnerName)
  }
  if (isLegacyCustomerDetailsContent(trimmed)) {
    return formatCustomerDetailsFromMap(map, salesOwnerName)
  }
  return resolvePlaceholders(storedContent, map)
}

/**
 * Build the standard required-fields toast / notification body (top-right notify).
 *
 * Examples:
 * - One field → `Please fill in Customer before saving.`
 * - Several → bullet list under a short intro
 */
export function formatRequiredFieldsNotifyMessage(fieldLabels: string[]): string {
  const unique: string[] = []
  const seen = new Set<string>()
  for (const raw of fieldLabels) {
    const label = raw.trim()
    if (!label) continue
    const key = label.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    unique.push(label)
  }
  if (!unique.length) return 'Please complete the required fields before saving.'
  if (unique.length === 1) return `Please fill in ${unique[0]} before saving.`
  return `Please complete the required fields before saving:\n${unique.map((l) => `• ${l}`).join('\n')}`
}

/** Known display labels for common CRM / ERP "… is required" messages. */
const KNOWN_REQUIRED_LABELS: Record<string, string> = {
  company: 'Customer',
  'opportunity name': 'Opportunity Name',
  'expected close date': 'Expected Close Date',
  'opportunity owner': 'Owner',
  owner: 'Owner',
  stage: 'Stage',
  probability: 'Probability',
  priority: 'Priority',
  customer: 'Customer',
  'unit price': 'Unit Price',
}

/**
 * Turn an error message into a short field label for notify / ValidationGuide.
 * `"Customer is required."` → `"Customer"`
 */
export function toRequiredFieldLabel(message: string): string {
  const trimmed = message.trim().replace(/\.$/, '')
  const requiredMatch = trimmed.match(/^(.+?)\s+is required$/i)
  const base = (requiredMatch?.[1] ?? trimmed).trim()
  return KNOWN_REQUIRED_LABELS[base.toLowerCase()] ?? base
}

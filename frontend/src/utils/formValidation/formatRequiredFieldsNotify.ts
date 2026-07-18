/**
 * Build the standard required-fields toast / notification body.
 *
 * Example:
 * ```
 * Please complete the required fields:
 * • Company
 * • Opportunity Name
 * ```
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
  if (!unique.length) return 'Please complete the required fields.'
  return `Please complete the required fields:\n${unique.map((l) => `• ${l}`).join('\n')}`
}

/** Known display labels for common CRM / ERP "… is required" messages. */
const KNOWN_REQUIRED_LABELS: Record<string, string> = {
  company: 'Company',
  'opportunity name': 'Opportunity Name',
  'expected close date': 'Expected Close Date',
  'opportunity owner': 'Owner',
  owner: 'Owner',
  stage: 'Stage',
  probability: 'Probability',
  priority: 'Priority',
  customer: 'Company',
  'unit price': 'Unit Price',
}

/**
 * Turn an error message into a short field label for notify / ValidationGuide.
 * `"Company is required."` → `"Company"`
 */
export function toRequiredFieldLabel(message: string): string {
  const trimmed = message.trim().replace(/\.$/, '')
  const requiredMatch = trimmed.match(/^(.+?)\s+is required$/i)
  const base = (requiredMatch?.[1] ?? trimmed).trim()
  return KNOWN_REQUIRED_LABELS[base.toLowerCase()] ?? base
}

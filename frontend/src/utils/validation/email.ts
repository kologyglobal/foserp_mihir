/**
 * Practical RFC-lite email checks for forms and duplicate comparison.
 * Does not verify that the mailbox exists (no SMTP / verification service).
 */

const LOCAL_PART_RE = /^[A-Za-z0-9.!#$%&'*+/=?^_`{|}~-]+$/
/** Domain label: alnum, optional interior hyphens; 1–63 chars. */
const DOMAIN_LABEL_RE = /^[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?$/

/** Trim + lowercase for comparison / storage-key use. */
export function normalizeEmail(value: string): string {
  return value.trim().toLowerCase()
}

/**
 * Validate email structure. Returns an error message or null when valid
 * (or empty when not required).
 */
export function validateEmail(
  value: string,
  options?: { required?: boolean },
): string | null {
  const trimmed = value.trim()

  if (!trimmed) {
    return options?.required ? 'Email is required' : null
  }

  if (/\s/.test(trimmed)) {
    return 'Email must not contain spaces'
  }

  const atParts = trimmed.split('@')
  if (atParts.length !== 2) {
    return 'Email must contain exactly one @'
  }

  const [local, domain] = atParts
  if (!local || !domain) {
    return 'Enter a valid email address'
  }

  if (!LOCAL_PART_RE.test(local)) {
    return 'Enter a valid email address'
  }

  if (!domain.includes('.')) {
    return 'Enter a valid email domain'
  }

  const labels = domain.split('.')
  if (labels.length < 2 || labels.some((label) => !label)) {
    return 'Enter a valid email domain'
  }

  for (const label of labels) {
    if (!DOMAIN_LABEL_RE.test(label)) {
      return 'Enter a valid email domain'
    }
  }

  const tld = labels[labels.length - 1]
  if (tld.length < 2 || !/^[A-Za-z]{2,}$/.test(tld)) {
    return 'Enter a valid email domain'
  }

  return null
}

/** True when empty (optional) or structurally valid. */
export function isValidOptionalEmail(value: string | null | undefined): boolean {
  if (value == null) return true
  return validateEmail(value) === null
}

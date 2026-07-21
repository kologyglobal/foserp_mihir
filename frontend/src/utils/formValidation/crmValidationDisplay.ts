/**
 * CRM validation display policy — one problem, one surface.
 *
 * Priority:
 * 1. Inline field error (`ErpFieldRow.fieldError` / RHF `errors`) for field-specific issues
 * 2. Toast (`handleInvalidSubmit` / `notify`) for API, permission, network, or non-field errors
 * 3. Summary card (`validationItems` → EnterpriseValidationGuide) ONLY for multi-issue
 *    blockers that cannot be mapped to fields (rare). Prefer not using it on CRM forms.
 * 4. Smart Context = coaching / next actions — never a second validation list
 *
 * Do not stack toast + red guide + yellow ValidationSummary for the same field errors.
 * Do not show required-field spam before the user has interacted (dirty / submit attempt).
 */

import type { EnterpriseValidationItem } from '../../design-system/workspace/types'
import type { FieldErrorMap } from './types'

/** CRM create/edit forms: never promote field-keyed maps into the red summary card. */
export function crmFieldErrorsToGuideItems(
  _fieldErrors: FieldErrorMap | Record<string, string | undefined>,
): EnterpriseValidationItem[] | undefined {
  return undefined
}

/**
 * Rare non-field blockers (workflow gate, permission copy, etc.).
 * Only surfaces a summary when there are 2+ distinct messages.
 */
export function crmNonFieldGuideItems(
  messages: string[],
  opts?: { minCount?: number },
): EnterpriseValidationItem[] | undefined {
  const cleaned = [...new Set(messages.map((m) => m.trim()).filter(Boolean))]
  const minCount = opts?.minCount ?? 2
  if (cleaned.length < minCount) return undefined
  return cleaned.map((label, i) => ({ id: `crm-nf-${i}`, label, message: label }))
}

/** Smart Context gap chips: hide on pristine create forms until dirty or save attempted. */
export function crmShowCompletenessHints(opts: {
  isEdit?: boolean
  dirty?: boolean
  saveAttempted?: boolean
}): boolean {
  return Boolean(opts.isEdit || opts.dirty || opts.saveAttempted)
}

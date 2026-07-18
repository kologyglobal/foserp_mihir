import type { ZodError } from 'zod'

/** Field key → human-readable error message */
export type FieldErrorMap = Record<string, string>

export type InvalidSubmitErrors = FieldErrorMap | string[] | ZodError

export interface HandleInvalidSubmitOptions {
  /** Field-keyed map, ordered message list, or ZodError */
  errors: InvalidSubmitErrors
  /** Preferred field order when picking the first invalid field */
  fieldOrder?: string[]
  /** fieldId → section element `id` (used with expand + scroll) */
  sectionByField?: Record<string, string>
  /** Toast / notify message override */
  notifyMessage?: string
  /**
   * Field key → short display label for the bullet-list toast
   * (`Please complete the required fields: • Company`).
   * When omitted, labels are derived from error messages.
   */
  fieldLabels?: Record<string, string>
  /** Scope for querySelector (form root). Defaults to `document`. */
  root?: ParentNode | null
  /**
   * Called with the section element id for the first invalid field.
   * Use to bump `ErpCardSection` `forceOpenKey`, open Additional Info, switch tabs, etc.
   */
  expandSection?: (sectionId: string) => void
  /** Optional callback after errors are normalized (e.g. setState for fieldError props) */
  onFieldErrors?: (errors: FieldErrorMap) => void
  /** Delay before scroll/focus so collapsed sections can paint (ms). Default 80 when expandSection runs. */
  delayMs?: number
  /** Skip top-right toast (when a banner/summary already notifies). Default false. */
  silentNotify?: boolean
  /** Toast variant. Default `warning`. */
  notifyVariant?: 'warning' | 'error' | 'info'
}

export interface HandleInvalidSubmitResult {
  fieldErrors: FieldErrorMap
  firstField?: string
  firstSection?: string
  messages: string[]
}

export interface FocusScrollOptions {
  root?: ParentNode | null
  behavior?: ScrollBehavior
  block?: ScrollLogicalPosition
  /** Extra delay before focus/scroll (e.g. after section expand). */
  delayMs?: number
}

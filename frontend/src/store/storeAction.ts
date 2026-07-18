/** Result shape returned by Zustand store mutations */
export interface StoreActionResult {
  ok: boolean
  error?: string
  /** Machine code from API (e.g. STAGE_REQUIREMENTS_INCOMPLETE). */
  code?: string
  /** Missing mandatory stage fields when a stage gate fails. */
  missingFields?: Array<{ field: string; label: string }>
  leadId?: string
  contactId?: string
  customerId?: string
  opportunityId?: string
  activityId?: string
}

export type MaybePromise<T> = T | Promise<T>

export type StoreAction<T extends StoreActionResult = StoreActionResult> = MaybePromise<T>

export async function resolveStoreAction<T extends StoreActionResult>(result: MaybePromise<T>): Promise<T> {
  return Promise.resolve(result)
}

export async function resolveMaybeId(result: MaybePromise<string>): Promise<string> {
  return Promise.resolve(result)
}

export async function resolveMaybeVoid(result: MaybePromise<void>): Promise<void> {
  return Promise.resolve(result)
}

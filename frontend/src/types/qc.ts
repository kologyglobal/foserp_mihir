export interface QcChecklistItem {
  id: string
  label: string
  sortOrder: number
}

export interface JobCardQcCheck extends QcChecklistItem {
  passed: boolean
}

export function allQcChecksPassed(checks: JobCardQcCheck[]): boolean {
  return checks.length > 0 && checks.every((c) => c.passed)
}

export function toJobCardQcChecks(items: QcChecklistItem[]): JobCardQcCheck[] {
  return [...items]
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((item) => ({ ...item, passed: false }))
}

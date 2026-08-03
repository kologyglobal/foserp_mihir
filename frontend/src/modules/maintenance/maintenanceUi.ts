import type { MaintenanceStatus } from '@/services/api/maintenanceApi'

export const MAINTENANCE_BREADCRUMB = { label: 'Maintenance', to: '/maintenance' }

export function maintenanceStatusTone(
  status: MaintenanceStatus | string,
): 'success' | 'warning' | 'danger' | 'neutral' | 'info' {
  switch (status) {
    case 'CLOSED':
      return 'success'
    case 'TESTING':
      return 'info'
    case 'IN_REPAIR':
    case 'REPORTED':
      return 'warning'
    case 'WAITING_FOR_PART':
    case 'ON_HOLD':
      return 'danger'
    default:
      return 'neutral'
  }
}

export function formatInr(n: number | null | undefined) {
  return `₹${(n ?? 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`
}

export function formatStatusLabel(status: string) {
  return status.replace(/_/g, ' ')
}

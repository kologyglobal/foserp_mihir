import type { CodeSeriesContext, CodeSeriesEntityType, CodeSeriesPermission } from '../types/codeSeriesMaster'
import { getSessionUser, type ErpRole } from './permissions'

const ADMIN_ROLES: ErpRole[] = ['admin']

const ERP_MANAGER_ROLES: ErpRole[] = ['admin', 'director', 'ceo']

const VIEW_ROLES: ErpRole[] = [
  'admin',
  'director',
  'ceo',
  'engineering_head',
  'sales_manager',
  'planning_manager',
  'purchase_head',
  'production_head',
  'quality_head',
  'dispatch_manager',
  'accounts_head',
]

const PERMISSION_ROLES: Record<CodeSeriesPermission, ErpRole[]> = {
  'codeSeries.view': VIEW_ROLES,
  'codeSeries.create': ERP_MANAGER_ROLES,
  'codeSeries.edit': ERP_MANAGER_ROLES,
  'codeSeries.delete': ADMIN_ROLES,
  'codeSeries.reset': ERP_MANAGER_ROLES,
  'codeSeries.override': ERP_MANAGER_ROLES,
  'codeSeries.manualNumber': ERP_MANAGER_ROLES,
  'codeSeries.deactivate': ERP_MANAGER_ROLES,
}

export function canCodeSeriesPermission(permission: CodeSeriesPermission, role?: ErpRole): boolean {
  const r = role ?? getSessionUser().role
  if (r === 'admin') return true
  return PERMISSION_ROLES[permission].includes(r)
}

export function assertCodeSeriesPermission(permission: CodeSeriesPermission): void {
  if (!canCodeSeriesPermission(permission)) {
    throw new Error(`Permission denied: ${permission}`)
  }
}

export const CODE_SERIES_PERMISSION_LABELS: Record<CodeSeriesPermission, string> = {
  'codeSeries.view': 'View code series',
  'codeSeries.create': 'Create code series',
  'codeSeries.edit': 'Edit code series',
  'codeSeries.delete': 'Delete code series',
  'codeSeries.reset': 'Reset series counter',
  'codeSeries.override': 'Override numbering rules',
  'codeSeries.manualNumber': 'Enter manual numbers',
  'codeSeries.deactivate': 'Deactivate series',
}

export type { CodeSeriesContext, CodeSeriesEntityType }

import { isApiMode } from '../../config/apiConfig'
import { getSessionUser } from '../../utils/permissions'
import { getCrmMasterEntries } from '../../store/crmMasterStore'

export interface CrmLeadUser {
  id: string
  name: string
  role: string
  department: string
  isActive: boolean
}

export const CRM_LEAD_USERS: CrmLeadUser[] = [
  { id: 'user-demo', name: 'Demo User', role: 'Admin', department: 'Management', isActive: true },
  { id: 'user-rajesh', name: 'Rajesh Kumar', role: 'Sales Manager', department: 'Sales', isActive: true },
  { id: 'user-priya', name: 'Priya Deshmukh', role: 'Sales Executive', department: 'Sales', isActive: true },
  { id: 'user-amit', name: 'Amit Sharma', role: 'Sales Executive', department: 'Sales', isActive: true },
  { id: 'user-sneha', name: 'Sneha Patil', role: 'Sales Coordinator', department: 'Sales', isActive: true },
  { id: 'user-vikram', name: 'Vikram Joshi', role: 'Regional Manager', department: 'Sales', isActive: false },
]

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
}

function ownersFromMasters(): CrmLeadUser[] {
  return getCrmMasterEntries('owners', false).map((e) => ({
    id: e.code,
    name: e.name,
    role: String(e.attributes.role ?? ''),
    department: String(e.attributes.department ?? ''),
    isActive: e.status === 'active',
  }))
}

export function getActiveLeadUsers(): CrmLeadUser[] {
  if (isApiMode()) {
    const session = getSessionUser()
    const fromMasters = ownersFromMasters().filter((u) => u.isActive && isUuid(u.id))
    const sessionUser: CrmLeadUser = {
      id: session.id,
      name: session.name,
      role: String(session.role),
      department: '',
      isActive: true,
    }
    if (!fromMasters.some((u) => u.id === sessionUser.id) && isUuid(sessionUser.id)) {
      return [sessionUser, ...fromMasters]
    }
    return fromMasters.length > 0 ? fromMasters : (isUuid(sessionUser.id) ? [sessionUser] : [])
  }

  const fromMasters = ownersFromMasters().filter((u) => u.isActive)
  if (fromMasters.length > 0) return fromMasters
  return CRM_LEAD_USERS.filter((u) => u.isActive)
}

export function getLeadUser(id: string): CrmLeadUser | undefined {
  if (isApiMode()) {
    const session = getSessionUser()
    if (session.id === id) {
      return {
        id: session.id,
        name: session.name,
        role: String(session.role),
        department: '',
        isActive: true,
      }
    }
  }
  const fromMasters = ownersFromMasters().find((u) => u.id === id)
  if (fromMasters) return fromMasters
  return CRM_LEAD_USERS.find((u) => u.id === id)
}

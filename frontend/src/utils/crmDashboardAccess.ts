import type { ErpRole } from './permissions'
import { getSessionUser } from './permissions'
import type { CrmActivity, FollowUp, Opportunity } from '../types/crm'

export type CrmDashboardViewMode = 'ceo' | 'manager' | 'my'

const EXEC_ROLES: ErpRole[] = ['admin', 'ceo', 'director', 'management']
const MANAGER_ROLES: ErpRole[] = ['sales_manager', ...EXEC_ROLES]

/** Demo owner ids used in CRM seed data */
export const CRM_TEAM_OWNER_IDS = ['user-rajesh', 'user-priya', 'user-amit'] as const

export function getAvailableCrmViewModes(role?: ErpRole): CrmDashboardViewMode[] {
  const r = role ?? getSessionUser().role
  if (EXEC_ROLES.includes(r)) return ['ceo', 'manager', 'my']
  if (MANAGER_ROLES.includes(r)) return ['manager', 'my']
  return ['my']
}

export function getDefaultCrmViewMode(role?: ErpRole): CrmDashboardViewMode {
  const modes = getAvailableCrmViewModes(role)
  if (modes.includes('ceo')) return 'ceo'
  if (modes.includes('manager')) return 'manager'
  return 'my'
}

/** Map session user to a CRM owner id for My CRM filtering in demo */
export function resolveCrmOwnerId(userId?: string): string {
  const id = userId ?? getSessionUser().id
  if (CRM_TEAM_OWNER_IDS.includes(id as (typeof CRM_TEAM_OWNER_IDS)[number])) return id
  return CRM_TEAM_OWNER_IDS[0]
}

export function filterOpportunitiesByView(
  opportunities: Opportunity[],
  mode: CrmDashboardViewMode,
  ownerId?: string,
): Opportunity[] {
  if (mode === 'ceo') return opportunities
  if (mode === 'manager') {
    return opportunities.filter((o) => CRM_TEAM_OWNER_IDS.includes(o.ownerId as (typeof CRM_TEAM_OWNER_IDS)[number]))
  }
  const mine = ownerId ?? resolveCrmOwnerId()
  return opportunities.filter((o) => o.ownerId === mine)
}

export function filterFollowUpsByView(
  followUps: FollowUp[],
  mode: CrmDashboardViewMode,
  ownerId?: string,
): FollowUp[] {
  if (mode === 'ceo') return followUps
  if (mode === 'manager') {
    return followUps.filter((f) => CRM_TEAM_OWNER_IDS.includes(f.assignedTo as (typeof CRM_TEAM_OWNER_IDS)[number]))
  }
  const mine = ownerId ?? resolveCrmOwnerId()
  return followUps.filter((f) => f.assignedTo === mine)
}

export function filterActivitiesByView(
  activities: CrmActivity[],
  mode: CrmDashboardViewMode,
  ownerId?: string,
): CrmActivity[] {
  if (mode === 'ceo') return activities
  if (mode === 'manager') {
    return activities.filter((a) => CRM_TEAM_OWNER_IDS.includes(a.ownerId as (typeof CRM_TEAM_OWNER_IDS)[number]))
  }
  const mine = ownerId ?? resolveCrmOwnerId()
  return activities.filter((a) => a.ownerId === mine)
}

export const CRM_VIEW_MODE_LABELS: Record<CrmDashboardViewMode, string> = {
  ceo: 'CEO View',
  manager: 'Manager View',
  my: 'My CRM',
}

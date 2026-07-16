import type { LucideIcon } from 'lucide-react'

/** UX role — defines home dashboard, inbox, approvals, KPIs, shortcuts (pre-auth backend) */
export type ExperienceRole =
  | 'ceo'
  | 'coo'
  | 'engineering'
  | 'planning'
  | 'purchase'
  | 'stores'
  | 'production'
  | 'quality'
  | 'dispatch'
  | 'accounts'

export type RoleKpiAccent = 'blue' | 'green' | 'amber' | 'red'

export interface RoleKpi {
  id: string
  label: string
  value: string | number
  accent: RoleKpiAccent
  href?: string
}

export interface RoleShortcut {
  label: string
  path: string
  description?: string
  icon?: LucideIcon
}

export interface RoleExperienceDefinition {
  role: ExperienceRole
  title: string
  tagline: string
  /** Optional deep-dive dashboard (control tower / workspace) */
  deepDashboardPath?: string
  deepDashboardLabel?: string
  /** Filter unified inbox by module name (substring match). Empty = all modules. */
  inboxModules: string[]
  /** Filter approval items by module. Empty = all approvals. */
  approvalModules: string[]
  /** KPI ids resolved in roleExperienceMetrics */
  kpiIds: string[]
  shortcuts: RoleShortcut[]
}

export const EXPERIENCE_ROLE_LABELS: Record<ExperienceRole, string> = {
  ceo: 'CEO',
  coo: 'COO',
  engineering: 'Engineering',
  planning: 'Planning',
  purchase: 'Purchase',
  stores: 'Stores',
  production: 'Production',
  quality: 'Quality',
  dispatch: 'Dispatch',
  accounts: 'Accounts',
}

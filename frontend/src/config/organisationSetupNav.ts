import type { LucideIcon } from 'lucide-react'
import { Building2, FileText, BookOpen, Link2, CalendarRange, CalendarClock } from 'lucide-react'

export type OrganisationSetupNavItem = {
  id: string
  label: string
  path: string
  end?: boolean
  icon: LucideIcon
}

export const ORGANISATION_SETUP_NAV: OrganisationSetupNavItem[] = [
  { id: 'legal-entity', label: 'Legal Entity', path: '/settings/organisation/legal-entity', icon: Building2, end: true },
  { id: 'registrations', label: 'Registration Details', path: '/settings/organisation/registrations', icon: FileText },
  { id: 'chart-of-accounts', label: 'Chart of Accounts', path: '/settings/organisation/chart-of-accounts', icon: BookOpen },
  { id: 'account-mapping', label: 'Account Mapping', path: '/settings/organisation/account-mapping', icon: Link2 },
  { id: 'fiscal-years', label: 'Fiscal Years', path: '/settings/organisation/fiscal-years', icon: CalendarRange },
  { id: 'posting-periods', label: 'Posting Periods', path: '/settings/organisation/posting-periods', icon: CalendarClock },
]

export const ORGANISATION_SETUP_WORKSPACE_TABS = ORGANISATION_SETUP_NAV.map((t) => ({
  label: t.label,
  path: t.path,
  end: t.end,
}))

export function organisationSetupNavIsActive(pathname: string, item: { path: string; end?: boolean }) {
  if (item.end) return pathname === item.path || pathname === '/settings/organisation'
  return pathname === item.path || pathname.startsWith(`${item.path}/`)
}

export function findOrganisationSetupNavItem(pathname: string) {
  return (
    ORGANISATION_SETUP_NAV.find((t) => organisationSetupNavIsActive(pathname, t)) ??
    ORGANISATION_SETUP_NAV[0]
  )
}

export function organisationSetupBreadcrumbs(pathname: string) {
  const active = findOrganisationSetupNavItem(pathname)
  return [
    { label: 'Settings', to: '/settings/organisation' },
    { label: 'Organisation Setup', to: '/settings/organisation' },
    { label: active.label },
  ]
}

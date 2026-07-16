import type { LeadRoutes } from '../hooks/useLeadRoutes'
import { CRM_BREADCRUMB_ROOT, crmChildBreadcrumbs, crmModuleBreadcrumbs } from './crmNavigation'

export { CRM_BREADCRUMB_ROOT as CRM_LEAD_BREADCRUMB_ROOT }

export function leadListBreadcrumbs(routes: LeadRoutes) {
  return crmModuleBreadcrumbs('Leads', routes.base)
}

export function leadNewBreadcrumbs(routes: LeadRoutes) {
  return crmChildBreadcrumbs('Leads', routes.base, 'New Lead')
}

export function leadEditBreadcrumbs(routes: LeadRoutes) {
  return crmChildBreadcrumbs('Leads', routes.base, 'Edit Lead')
}

export function leadViewBreadcrumbs(routes: LeadRoutes) {
  return crmChildBreadcrumbs('Leads', routes.base, 'Lead Details')
}

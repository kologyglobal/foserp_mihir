export const CRM_BREADCRUMB_ROOT = [
  { label: 'Home', to: '/home' },
  { label: 'CRM', to: '/crm' },
] as const

export type CrmBreadcrumbItem = { label: string; to?: string }

/** Home → CRM → module (list page) */
export function crmModuleBreadcrumbs(moduleLabel: string, modulePath?: string): CrmBreadcrumbItem[] {
  return [
    ...CRM_BREADCRUMB_ROOT,
    modulePath ? { label: moduleLabel, to: modulePath } : { label: moduleLabel },
  ]
}

/** Home → CRM → parent → current (form / detail page) */
export function crmChildBreadcrumbs(
  parentLabel: string,
  parentPath: string,
  currentLabel: string,
): CrmBreadcrumbItem[] {
  return [
    ...CRM_BREADCRUMB_ROOT,
    { label: parentLabel, to: parentPath },
    { label: currentLabel },
  ]
}

/** Home → CRM → …arbitrary trail */
export function crmBreadcrumbs(...segments: CrmBreadcrumbItem[]): CrmBreadcrumbItem[] {
  return [...CRM_BREADCRUMB_ROOT, ...segments]
}

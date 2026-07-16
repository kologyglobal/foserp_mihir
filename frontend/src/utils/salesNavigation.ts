export const SALES_BREADCRUMB_ROOT = [
  { label: 'Home', to: '/home' },
  { label: 'Sales', to: '/sales' },
] as const

export type SalesBreadcrumbItem = { label: string; to?: string }

/** Home → Sales → module (list page) */
export function salesModuleBreadcrumbs(moduleLabel: string, modulePath?: string): SalesBreadcrumbItem[] {
  return [
    ...SALES_BREADCRUMB_ROOT,
    modulePath ? { label: moduleLabel, to: modulePath } : { label: moduleLabel },
  ]
}

/** Home → Sales → parent → current (form / detail page) */
export function salesChildBreadcrumbs(
  parentLabel: string,
  parentPath: string,
  currentLabel: string,
): SalesBreadcrumbItem[] {
  return [
    ...SALES_BREADCRUMB_ROOT,
    { label: parentLabel, to: parentPath },
    { label: currentLabel },
  ]
}

/** Home → Sales → …arbitrary trail */
export function salesBreadcrumbs(...segments: SalesBreadcrumbItem[]): SalesBreadcrumbItem[] {
  return [...SALES_BREADCRUMB_ROOT, ...segments]
}

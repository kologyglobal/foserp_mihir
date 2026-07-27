/** Human-readable labels for permission `module` prefixes from the catalog. */
export const PERMISSION_MODULE_LABELS: Record<string, string> = {
  tenant: 'Tenant Administration',
  user: 'User Administration',
  role: 'Role Administration',
  crm: 'CRM',
  master: 'Master Data',
  masters: 'Masters (shell)',
  purchase: 'Purchase',
  inventory: 'Inventory',
  manufacturing: 'Manufacturing',
  production: 'Production',
  quality: 'Quality',
  dispatch: 'Dispatch',
  finance: 'Finance / Accounting',
  accounts: 'Accounts (shell)',
  sales: 'Sales (shell)',
  engineering: 'Engineering',
  gate: 'Gate',
  operations: 'Operations',
  dms: 'Document Management',
  approval: 'Approvals',
  reports: 'Reports',
  traceability: 'Traceability',
  settings: 'Settings',
}

export function permissionModuleLabel(module: string): string {
  return PERMISSION_MODULE_LABELS[module] ?? module.charAt(0).toUpperCase() + module.slice(1)
}

/** Mutating permission → sibling `.view` (e.g. crm.lead.create → crm.lead.view). */
export function viewDependencyFor(permissionName: string): string | null {
  const parts = permissionName.split('.')
  if (parts.length < 2) return null
  const action = parts[parts.length - 1]
  if (!action || action === 'view') return null
  return [...parts.slice(0, -1), 'view'].join('.')
}

export function ensureViewDependencies(
  selected: Iterable<string>,
  catalogNames?: ReadonlySet<string>,
): Set<string> {
  const next = new Set(selected)
  for (const name of [...next]) {
    const view = viewDependencyFor(name)
    if (!view) continue
    if (catalogNames && !catalogNames.has(view)) continue
    next.add(view)
  }
  return next
}

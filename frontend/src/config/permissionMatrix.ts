import type { ErpRole } from '../utils/permissions'

export type PermissionModule =
  | 'masters'
  | 'engineering'
  | 'purchase'
  | 'inventory'
  | 'production'
  | 'quality'
  | 'dispatch'
  | 'sales'
  | 'accounts'
  | 'dms'
  | 'approval'
  | 'reports'
  | 'traceability'
  | 'settings'

export type PermissionAction =
  | 'view'
  | 'create'
  | 'edit'
  | 'submit'
  | 'approve'
  | 'release'
  | 'post'
  | 'cancel'
  | 'close'
  | 'print'
  | 'export'
  | 'override'

export type PermissionKey = `${PermissionModule}.${PermissionAction}`

const ALL: PermissionAction[] = [
  'view',
  'create',
  'edit',
  'submit',
  'approve',
  'release',
  'post',
  'cancel',
  'close',
  'print',
  'export',
  'override',
]
const RO: PermissionAction[] = ['view', 'print']
const VIEW: PermissionAction[] = ['view']

function mod(module: PermissionModule, actions: PermissionAction[]): PermissionKey[] {
  return actions.map((a) => `${module}.${a}` as PermissionKey)
}

/** Route prefix → required view permission (longest match wins) */
export const ROUTE_PERMISSION_MAP: Array<{ prefix: string; permission: PermissionKey; pageName: string }> = [
  { prefix: '/admin', permission: 'settings.view', pageName: 'Administration' },
  { prefix: '/masters/approval-workflows', permission: 'approval.view', pageName: 'Approval Workflow' },
  { prefix: '/masters/approval-matrix', permission: 'approval.view', pageName: 'Approval Workflow' },
  { prefix: '/masters/role-permissions', permission: 'settings.view', pageName: 'Role Permission Matrix' },
  { prefix: '/masters/permissions', permission: 'settings.view', pageName: 'Role Permission Matrix' },
  { prefix: '/masters/roles', permission: 'settings.view', pageName: 'Role Master' },
  { prefix: '/settings/approval-matrix', permission: 'approval.view', pageName: 'Approval Workflow' },
  { prefix: '/settings/permissions', permission: 'settings.view', pageName: 'Role Permission Matrix' },
  { prefix: '/settings/roles', permission: 'settings.view', pageName: 'Role Master' },
  { prefix: '/settings', permission: 'settings.view', pageName: 'Settings' },
  { prefix: '/approvals', permission: 'approval.view', pageName: 'My Approvals' },
  { prefix: '/masters/serial-numbers', permission: 'masters.view', pageName: 'Serial Numbers' },
  { prefix: '/masters', permission: 'masters.view', pageName: 'Masters' },
  { prefix: '/engineering', permission: 'engineering.view', pageName: 'Engineering' },
  { prefix: '/purchase', permission: 'purchase.view', pageName: 'Purchase' },
  { prefix: '/inventory', permission: 'inventory.view', pageName: 'Inventory' },
  { prefix: '/manufacturing', permission: 'production.view', pageName: 'Manufacturing & Production' },
  { prefix: '/work-orders', permission: 'production.view', pageName: 'Work Orders' },
  { prefix: '/job-work', permission: 'production.view', pageName: 'Job Work' },
  { prefix: '/shop-floor', permission: 'production.view', pageName: 'Shop Floor' },
  { prefix: '/production', permission: 'production.view', pageName: 'Production' },
  { prefix: '/quality', permission: 'quality.view', pageName: 'Quality' },
  { prefix: '/dispatch', permission: 'dispatch.view', pageName: 'Dispatch' },
  { prefix: '/sales', permission: 'sales.view', pageName: 'Sales' },
  // CRM shell: canRoute uses canAccessCrmShell / JWT crm.*.view — matrix key only for AccessDenied label in demo.
  { prefix: '/crm', permission: 'sales.view', pageName: 'CRM' },
  { prefix: '/invoice', permission: 'accounts.view', pageName: 'Invoice' },
  { prefix: '/documents', permission: 'dms.view', pageName: 'Documents' },
  { prefix: '/reports', permission: 'reports.view', pageName: 'Reports' },
  { prefix: '/serials', permission: 'masters.view', pageName: 'Serial Numbers' },
  { prefix: '/traceability/trailers', permission: 'traceability.view', pageName: 'Trailer Genealogy' },
  { prefix: '/traceability/warranty', permission: 'traceability.view', pageName: 'Warranty Investigation' },
  { prefix: '/traceability/components', permission: 'traceability.view', pageName: 'Component Genealogy' },
  { prefix: '/traceability', permission: 'traceability.view', pageName: 'Traceability 360' },
  { prefix: '/genealogy', permission: 'traceability.view', pageName: 'Genealogy' },
  { prefix: '/m/crm', permission: 'sales.view', pageName: 'Mobile CRM' },
  { prefix: '/m/approvals', permission: 'approval.view', pageName: 'Mobile Approvals' },
  { prefix: '/m/qc', permission: 'quality.view', pageName: 'Mobile QC' },
  { prefix: '/m/ncr', permission: 'quality.view', pageName: 'Mobile NCR' },
  { prefix: '/m/grn', permission: 'purchase.view', pageName: 'Mobile GRN' },
  { prefix: '/m/gate-pass', permission: 'dispatch.view', pageName: 'Mobile Gate Pass' },
  { prefix: '/m/gate', permission: 'dispatch.view', pageName: 'Mobile Gate' },
  { prefix: '/m/dispatch', permission: 'dispatch.view', pageName: 'Mobile Dispatch' },
  { prefix: '/m/job-work', permission: 'production.view', pageName: 'Mobile Job Work' },
  { prefix: '/m/job-card', permission: 'production.view', pageName: 'Mobile Job Card' },
  { prefix: '/m/shop-floor', permission: 'production.view', pageName: 'Mobile Shop Floor' },
  { prefix: '/m/material-issue', permission: 'inventory.post', pageName: 'Mobile Material Issue' },
  { prefix: '/m/material-return', permission: 'inventory.post', pageName: 'Mobile Material Return' },
  { prefix: '/m/warehouse-transfer', permission: 'inventory.post', pageName: 'Mobile Warehouse Transfer' },
  { prefix: '/m/stock-count', permission: 'inventory.view', pageName: 'Mobile Stock Count' },
  { prefix: '/m/scan', permission: 'traceability.view', pageName: 'Mobile Scan' },
  { prefix: '/scan', permission: 'traceability.view', pageName: 'QR Scanner' },
  { prefix: '/qr', permission: 'traceability.view', pageName: 'QR Registry' },
  { prefix: '/mrp', permission: 'production.view', pageName: 'MRP' },
  { prefix: '/costing', permission: 'accounts.view', pageName: 'Costing' },
  { prefix: '/executive', permission: 'reports.view', pageName: 'Executive Dashboard' },
  { prefix: '/inbox', permission: 'reports.view', pageName: 'Inbox' },
  { prefix: '/home', permission: 'reports.view', pageName: 'Home' },
]

const PURCHASE_USER: PermissionKey[] = mod('purchase', ['view', 'create', 'edit', 'submit', 'print'])
const PURCHASE_HEAD: PermissionKey[] = mod('purchase', ALL)
const STORE_USER: PermissionKey[] = mod('inventory', ['view', 'create', 'edit', 'post', 'print'])
const STORE_MANAGER: PermissionKey[] = mod('inventory', ALL)
const QUALITY_INSPECTOR: PermissionKey[] = mod('quality', ['view', 'create', 'edit', 'post', 'print'])
const QUALITY_HEAD: PermissionKey[] = mod('quality', ALL)
const DISPATCH_USER: PermissionKey[] = mod('dispatch', ['view', 'create', 'edit', 'post', 'print'])
const DISPATCH_MANAGER: PermissionKey[] = mod('dispatch', ALL)
const ACCOUNTS_USER: PermissionKey[] = mod('accounts', ['view', 'create', 'edit', 'post', 'print'])
const ACCOUNTS_HEAD: PermissionKey[] = mod('accounts', ALL)
const SHOP_FLOOR: PermissionKey[] = mod('production', ['view', 'edit', 'post'])
const PRODUCTION_SUPERVISOR: PermissionKey[] = mod('production', ['view', 'create', 'edit', 'submit', 'release', 'post', 'print'])
const PRODUCTION_HEAD: PermissionKey[] = mod('production', ALL)
const ENGINEERING_HEAD: PermissionKey[] = mod('engineering', ALL)
const SALES_MANAGER: PermissionKey[] = mod('sales', ALL)
const PLANNING_MANAGER: PermissionKey[] = [
  ...mod('production', ['view', 'create', 'edit', 'submit', 'release', 'post', 'print', 'export']),
  ...mod('masters', RO),
  ...mod('engineering', RO),
  ...mod('inventory', RO),
  ...mod('purchase', RO),
  ...mod('sales', RO),
  ...mod('quality', RO),
  ...mod('dispatch', RO),
  ...mod('reports', RO),
  ...mod('traceability', RO),
]
const EXEC_VIEW: PermissionKey[] = [
  ...mod('masters', RO),
  ...mod('engineering', ['view', 'approve']),
  ...mod('purchase', ['view', 'approve']),
  ...mod('production', RO),
  ...mod('quality', ['view', 'approve']),
  ...mod('dispatch', ['view', 'approve']),
  ...mod('sales', RO),
  ...mod('accounts', RO),
  ...mod('dms', RO),
  ...mod('approval', ['view', 'approve']),
  ...mod('reports', ['view', 'export']),
  ...mod('traceability', RO),
  ...mod('settings', VIEW),
]
const DIRECTOR: PermissionKey[] = [
  ...EXEC_VIEW,
  ...mod('purchase', ['approve', 'override']),
  ...mod('engineering', ['approve', 'release']),
  ...mod('accounts', ['approve', 'cancel']),
  ...mod('approval', ['approve', 'export']),
]

export const ROLE_PERMISSION_MATRIX: Record<ErpRole, PermissionKey[] | '*'> = {
  admin: '*',
  ceo: EXEC_VIEW,
  director: DIRECTOR,
  engineering_head: [
    ...ENGINEERING_HEAD,
    ...mod('masters', ['view', 'edit']),
    ...mod('dms', ['view', 'create', 'edit']),
    ...mod('production', RO),
    ...mod('quality', RO),
    ...mod('approval', RO),
    ...mod('reports', RO),
  ],
  sales_manager: [
    ...SALES_MANAGER,
    ...mod('masters', RO),
    ...mod('dms', ['view', 'create']),
    ...mod('reports', RO),
    ...mod('dispatch', RO),
    ...mod('production', RO),
  ],
  planning_manager: PLANNING_MANAGER,
  purchase_head: [
    ...PURCHASE_HEAD,
    ...mod('masters', RO),
    ...mod('inventory', ['view', 'post']),
    ...mod('quality', RO),
    ...mod('dms', ['view', 'create']),
    ...mod('reports', RO),
  ],
  purchase_user: [
    ...PURCHASE_USER,
    ...mod('masters', RO),
    ...mod('inventory', ['view']),
    ...mod('dms', ['view', 'create']),
    ...mod('reports', RO),
  ],
  store_manager: [
    ...STORE_MANAGER,
    ...mod('purchase', ['view', 'post']),
    ...mod('quality', ['view', 'post']),
    ...mod('masters', RO),
    ...mod('traceability', ['view', 'post']),
    ...mod('production', RO),
  ],
  store_user: [
    ...STORE_USER,
    ...mod('purchase', ['view']),
    ...mod('quality', ['view', 'post']),
    ...mod('masters', RO),
    ...mod('traceability', ['view', 'post']),
    ...mod('production', RO),
  ],
  production_head: [
    ...PRODUCTION_HEAD,
    ...mod('quality', ['view', 'create', 'edit']),
    ...mod('masters', RO),
    ...mod('inventory', ['view', 'post']),
    ...mod('traceability', ['view', 'post']),
  ],
  production_supervisor: [
    ...PRODUCTION_SUPERVISOR,
    ...mod('quality', ['view', 'create', 'edit']),
    ...mod('masters', RO),
    ...mod('inventory', ['view', 'post']),
    ...mod('engineering', RO),
    ...mod('traceability', ['view', 'post']),
  ],
  shop_floor: [
    ...SHOP_FLOOR,
    ...mod('quality', ['view', 'create']),
    ...mod('traceability', ['view', 'post']),
    ...mod('inventory', RO),
  ],
  quality_head: [
    ...QUALITY_HEAD,
    ...mod('production', RO),
    ...mod('masters', RO),
    ...mod('dms', ['view', 'create']),
    ...mod('traceability', RO),
    ...mod('reports', RO),
  ],
  quality_inspector: [
    ...QUALITY_INSPECTOR,
    ...mod('production', RO),
    ...mod('masters', RO),
    ...mod('traceability', RO),
    ...mod('reports', RO),
  ],
  dispatch_manager: [
    ...DISPATCH_MANAGER,
    ...mod('production', RO),
    ...mod('sales', RO),
    ...mod('masters', RO),
    ...mod('traceability', ['view', 'post']),
    ...mod('dms', ['view', 'create']),
  ],
  dispatch_user: [
    ...DISPATCH_USER,
    ...mod('production', RO),
    ...mod('sales', RO),
    ...mod('masters', RO),
    ...mod('traceability', ['view', 'post']),
    ...mod('dms', ['view', 'create']),
  ],
  accounts_head: [
    ...ACCOUNTS_HEAD,
    ...mod('purchase', RO),
    ...mod('dispatch', RO),
    ...mod('sales', RO),
    ...mod('reports', ['view', 'export']),
    ...mod('approval', ['view', 'approve']),
  ],
  accounts_user: [
    ...ACCOUNTS_USER,
    ...mod('purchase', RO),
    ...mod('dispatch', RO),
    ...mod('sales', RO),
    ...mod('reports', RO),
  ],
  // Legacy aliases — keep existing tests and store calls working
  management: DIRECTOR,
  purchase: PURCHASE_USER,
  stores: [
    ...STORE_MANAGER,
    ...mod('purchase', ['view', 'post']),
    ...mod('quality', ['view', 'post']),
    ...mod('masters', RO),
    ...mod('traceability', ['view', 'post']),
    ...mod('production', RO),
  ],
  sales: SALES_MANAGER,
  planning: PLANNING_MANAGER,
  quality: QUALITY_HEAD,
  dispatch: DISPATCH_MANAGER,
  accounts: ACCOUNTS_HEAD,
  engineering: ENGINEERING_HEAD,
  production: PRODUCTION_SUPERVISOR,
}

export function resolveRoutePermission(pathname: string): PermissionKey | null {
  const sorted = [...ROUTE_PERMISSION_MAP].sort((a, b) => b.prefix.length - a.prefix.length)
  for (const entry of sorted) {
    if (pathname === entry.prefix || pathname.startsWith(`${entry.prefix}/`)) {
      return entry.permission
    }
  }
  return null
}

export function resolveRoutePageName(pathname: string): string {
  const sorted = [...ROUTE_PERMISSION_MAP].sort((a, b) => b.prefix.length - a.prefix.length)
  for (const entry of sorted) {
    if (pathname === entry.prefix || pathname.startsWith(`${entry.prefix}/`)) {
      return entry.pageName
    }
  }
  return 'This Page'
}

export function formatPermissionKey(key: PermissionKey): string {
  const [module, action] = key.split('.') as [PermissionModule, PermissionAction]
  return `${module} → ${action}`
}

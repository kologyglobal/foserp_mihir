/**
 * Human-readable People & Access workspace config.
 * Maps technical permissions into matrix cells, templates, presets, SoD, and approval docs.
 */

export type MatrixAction =
  | 'view'
  | 'create'
  | 'edit'
  | 'delete'
  | 'submit'
  | 'approve'
  | 'post'
  | 'reverse'
  | 'export'
  | 'sensitive'

export const MATRIX_ACTIONS: { id: MatrixAction; label: string }[] = [
  { id: 'view', label: 'View' },
  { id: 'create', label: 'Create' },
  { id: 'edit', label: 'Edit' },
  { id: 'delete', label: 'Delete' },
  { id: 'submit', label: 'Submit' },
  { id: 'approve', label: 'Approve' },
  { id: 'post', label: 'Post' },
  { id: 'reverse', label: 'Reverse' },
  { id: 'export', label: 'Export' },
  { id: 'sensitive', label: 'Sensitive' },
]

export type MatrixArea = {
  module: string
  resource: string
  /** permission code contains any of these */
  match: string[]
  actions: Partial<Record<MatrixAction, string[]>>
}

/** Primary matrix rows — codes are matched loosely against catalog names. */
export const ACCESS_MATRIX_ROWS: MatrixArea[] = [
  { module: 'CRM', resource: 'Leads', match: ['crm.lead'], actions: { view: ['crm.lead.view'], create: ['crm.lead.create'], edit: ['crm.lead.update'], delete: ['crm.lead.delete'], export: ['crm.export.view'] } },
  { module: 'CRM', resource: 'Opportunities', match: ['crm.opportunity'], actions: { view: ['crm.opportunity.view'], create: ['crm.opportunity.create'], edit: ['crm.opportunity.update'] } },
  { module: 'CRM', resource: 'Quotations', match: ['crm.quotation'], actions: { view: ['crm.quotation.view'], create: ['crm.quotation.create'], edit: ['crm.quotation.update'], submit: ['crm.quotation.convert'], approve: ['crm.quotation.approve'] } },
  { module: 'CRM', resource: 'Sales Orders', match: ['crm.sales_order'], actions: { view: ['crm.sales_order.view'], create: ['crm.sales_order.create'], edit: ['crm.sales_order.update'], approve: ['crm.sales_order.confirm'] } },
  { module: 'CRM', resource: 'Tax Invoices', match: ['crm.commercial.invoice', 'invoice'], actions: { view: ['crm.commercial.invoice.view'], create: ['crm.commercial.invoice.create'], post: ['crm.commercial.invoice.post'], reverse: ['crm.commercial.invoice.cancel'], sensitive: ['crm.commercial.invoice.post'] } },
  { module: 'CRM', resource: 'Receipts', match: ['crm.commercial.receipt', 'receipt'], actions: { view: ['crm.commercial.receipt.view'], create: ['crm.commercial.receipt.create'], sensitive: ['crm.commercial.receipt.create'] } },
  { module: 'Purchase', resource: 'PR', match: ['purchase.pr', 'purchase.requisition'], actions: { view: ['purchase.pr.view'], create: ['purchase.pr.create'], edit: ['purchase.pr.edit'], submit: ['purchase.pr.submit'], approve: ['purchase.pr.approve'] } },
  { module: 'Purchase', resource: 'RFQ', match: ['purchase.rfq'], actions: { view: ['purchase.rfq.view'], create: ['purchase.rfq.create'], edit: ['purchase.rfq.edit'] } },
  { module: 'Purchase', resource: 'Vendor Quotation', match: ['purchase.vq', 'purchase.vendor_quotation'], actions: { view: ['purchase.vq.view'], create: ['purchase.vq.create'] } },
  { module: 'Purchase', resource: 'Comparison', match: ['purchase.comparison'], actions: { view: ['purchase.comparison.view'], approve: ['purchase.comparison.approve'] } },
  { module: 'Purchase', resource: 'PO', match: ['purchase.po', 'purchase.order'], actions: { view: ['purchase.po.view'], create: ['purchase.po.create'], edit: ['purchase.po.edit'], approve: ['purchase.po.approve'], post: ['purchase.po.release'] } },
  { module: 'Purchase', resource: 'GRN', match: ['purchase.grn'], actions: { view: ['purchase.grn.view'], create: ['purchase.grn.create'], post: ['purchase.grn.post'] } },
  { module: 'Purchase', resource: 'QI', match: ['purchase.qi'], actions: { view: ['purchase.qi.view'], edit: ['purchase.qi.edit'], approve: ['purchase.qi.complete'] } },
  { module: 'Purchase', resource: 'Purchase Invoice', match: ['purchase.invoice'], actions: { view: ['purchase.invoice.view'], create: ['purchase.invoice.create'], post: ['purchase.invoice.post'], sensitive: ['purchase.invoice.post'] } },
  { module: 'Purchase', resource: 'Return', match: ['purchase.return'], actions: { view: ['purchase.return.view'], create: ['purchase.return.create'] } },
  { module: 'Inventory', resource: 'Stock', match: ['inventory.stock', 'inventory.view'], actions: { view: ['inventory.view', 'inventory.stock.view'], export: ['inventory.export'] } },
  { module: 'Inventory', resource: 'Receipt', match: ['inventory.receipt'], actions: { view: ['inventory.receipt.view'], create: ['inventory.receipt.create'], post: ['inventory.receipt.post'] } },
  { module: 'Inventory', resource: 'Issue', match: ['inventory.issue'], actions: { view: ['inventory.issue.view'], create: ['inventory.issue.create'], post: ['inventory.issue.post'] } },
  { module: 'Inventory', resource: 'Transfer', match: ['inventory.transfer'], actions: { view: ['inventory.transfer.view'], create: ['inventory.transfer.create'] } },
  { module: 'Inventory', resource: 'Count', match: ['inventory.count', 'inventory.stock_count'], actions: { view: ['inventory.count.view'], create: ['inventory.count.create'] } },
  { module: 'Inventory', resource: 'Adjustment', match: ['inventory.adjustment'], actions: { view: ['inventory.adjustment.view'], create: ['inventory.adjustment.create'], approve: ['inventory.adjustment.approve'] } },
  { module: 'Inventory', resource: 'Cost', match: ['inventory.cost'], actions: { view: ['inventory.view_cost'], sensitive: ['inventory.view_cost'] } },
  { module: 'Gate', resource: 'Visitor', match: ['gate.visitor'], actions: { view: ['gate.visitor.view'], create: ['gate.visitor.create'] } },
  { module: 'Gate', resource: 'Vehicle', match: ['gate.vehicle'], actions: { view: ['gate.vehicle.view'], create: ['gate.vehicle.create'] } },
  { module: 'Gate', resource: 'Material In', match: ['gate.material_in', 'gate.inward'], actions: { view: ['gate.inward.view'], create: ['gate.inward.create'] } },
  { module: 'Gate', resource: 'Material Out', match: ['gate.material_out', 'gate.outward'], actions: { view: ['gate.outward.view'], create: ['gate.outward.create'] } },
  { module: 'Gate', resource: 'Gate Pass', match: ['gate.pass'], actions: { view: ['gate.pass.view'], create: ['gate.pass.create'], approve: ['gate.pass.approve'] } },
]

export type AccessPresetId = 'none' | 'view' | 'operator' | 'approver' | 'manager' | 'full'

export const ACCESS_PRESETS: {
  id: AccessPresetId
  label: string
  description: string
  actions: MatrixAction[]
}[] = [
  { id: 'none', label: 'No Access', description: 'Clear all cells for selected rows', actions: [] },
  { id: 'view', label: 'View Only', description: 'View (+ export where mapped)', actions: ['view', 'export'] },
  { id: 'operator', label: 'Operator', description: 'Day-to-day create/edit/submit', actions: ['view', 'create', 'edit', 'submit'] },
  { id: 'approver', label: 'Approver', description: 'View + approve', actions: ['view', 'approve'] },
  { id: 'manager', label: 'Manager', description: 'Operate + approve (no reverse/sensitive)', actions: ['view', 'create', 'edit', 'submit', 'approve', 'export'] },
  { id: 'full', label: 'Full Operational Access', description: 'All mapped actions except bank/salary sensitive packs', actions: ['view', 'create', 'edit', 'delete', 'submit', 'approve', 'post', 'export'] },
]

export type RoleTemplateDef = {
  id: string
  name: string
  description: string
  recommendedScope: 'OWN' | 'TEAM' | 'DEPARTMENT' | 'BRANCH' | 'LEGAL_ENTITY' | 'WAREHOUSE' | 'ALL'
  permissionHints: string[]
}

export const ROLE_TEMPLATES: RoleTemplateDef[] = [
  { id: 'lead-user', name: 'Lead User', description: 'CRM leads only', recommendedScope: 'OWN', permissionHints: ['crm.lead'] },
  { id: 'sales-exec', name: 'Sales Executive', description: 'Leads + opportunities + quotations create', recommendedScope: 'OWN', permissionHints: ['crm.lead', 'crm.opportunity', 'crm.quotation'] },
  { id: 'sales-mgr', name: 'Sales Manager', description: 'Team CRM + quotation approve', recommendedScope: 'TEAM', permissionHints: ['crm.', 'crm.quotation'] },
  { id: 'purchase-exec', name: 'Purchase Executive', description: 'PR/RFQ/PO create', recommendedScope: 'BRANCH', permissionHints: ['purchase.pr', 'purchase.rfq', 'purchase.po'] },
  { id: 'purchase-mgr', name: 'Purchase Manager', description: 'Purchase approvals', recommendedScope: 'BRANCH', permissionHints: ['purchase.'] },
  { id: 'storekeeper', name: 'Storekeeper', description: 'Warehouse receives/issues', recommendedScope: 'WAREHOUSE', permissionHints: ['inventory.'] },
  { id: 'inventory-mgr', name: 'Inventory Manager', description: 'Stock + adjustments', recommendedScope: 'LEGAL_ENTITY', permissionHints: ['inventory.'] },
  { id: 'gate-security', name: 'Gate Security', description: 'Gate operations', recommendedScope: 'BRANCH', permissionHints: ['gate.'] },
  { id: 'accountant', name: 'Accountant', description: 'Books posting', recommendedScope: 'LEGAL_ENTITY', permissionHints: ['finance.', 'accounting.'] },
  { id: 'finance-mgr', name: 'Finance Manager', description: 'Finance approvals', recommendedScope: 'ALL', permissionHints: ['finance.', 'accounting.'] },
  { id: 'ceo-viewer', name: 'CEO Viewer', description: 'Executive read + high approvals', recommendedScope: 'ALL', permissionHints: ['crm.dashboard', 'executive', '.view'] },
  { id: 'administrator', name: 'Administrator', description: 'Tenant administration', recommendedScope: 'ALL', permissionHints: ['user.', 'role.', 'tenant.'] },
]

export const DATA_ACCESS_LEVELS = [
  { id: 'OWN', label: 'Own', description: 'Own records only' },
  { id: 'TEAM', label: 'Team', description: 'Self + team members' },
  { id: 'DEPARTMENT', label: 'Department', description: 'Department membership' },
  { id: 'BRANCH', label: 'Branch', description: 'Assigned finance branches' },
  { id: 'LEGAL_ENTITY', label: 'Legal Entity', description: 'Assigned companies' },
  { id: 'WAREHOUSE', label: 'Warehouse', description: 'Assigned warehouses' },
  { id: 'ALL', label: 'All', description: 'Tenant-wide (unrestricted org scope)' },
] as const

export const APPROVAL_DOCUMENT_TYPES = [
  { id: 'QUOTATION', label: 'Quotation' },
  { id: 'SALES_ORDER', label: 'Sales Order' },
  { id: 'PURCHASE_REQUISITION', label: 'Purchase Requisition' },
  { id: 'PURCHASE_ORDER', label: 'Purchase Order' },
  { id: 'GRN_EXCEPTION', label: 'GRN exception' },
  { id: 'PURCHASE_INVOICE', label: 'Purchase Invoice' },
  { id: 'STOCK_ADJUSTMENT', label: 'Stock Adjustment' },
  { id: 'TAX_INVOICE', label: 'Tax Invoice' },
  { id: 'RECEIPT', label: 'Receipt' },
  { id: 'VENDOR_PAYMENT', label: 'Vendor Payment' },
] as const

/** Soft SoD warnings — not hard-blocked. */
export const SOD_WARNING_PAIRS: { label: string; a: string[]; b: string[] }[] = [
  { label: 'Vendor Create + Vendor Payment Approve', a: ['master.vendor.create', 'purchase.vendor.create'], b: ['finance.payment.approve', 'accounting.payment.approve'] },
  { label: 'PO Create + PO Approve + Payment Post', a: ['purchase.po.create'], b: ['purchase.po.approve'] },
  { label: 'Invoice Create + Receipt + Reverse', a: ['crm.commercial.invoice.create'], b: ['crm.commercial.invoice.cancel', 'crm.commercial.receipt.create'] },
  { label: 'Stock Adjustment Create + Approve', a: ['inventory.adjustment.create'], b: ['inventory.adjustment.approve'] },
  { label: 'Payroll Calculate + Finalize + Pay', a: ['hrms.payroll'], b: ['hrms.payroll'] },
]

export const SENSITIVE_HINTS = [
  'Tax Invoice create/post',
  'Receipt create/post/allocate',
  'Vendor Payment',
  'Bank details',
  'Salary / payroll',
  'Inventory cost',
  'Customer outstanding',
  'Margin / profit',
  'GST / TDS data',
  'Reversal / cancel',
  'Export',
]

/** Resolve which catalog permission names a matrix cell would toggle. */
export function resolveCellPermissions(
  row: MatrixArea,
  action: MatrixAction,
  catalog: string[],
): string[] {
  const explicit = row.actions[action] ?? []
  const catalogSet = new Set(catalog)
  const hits = explicit.filter((p) => catalogSet.has(p))
  if (hits.length) return hits
  // loose match by prefix for view/create/update
  const actionSuffix: Record<string, string[]> = {
    view: ['view'],
    create: ['create'],
    edit: ['update', 'edit'],
    delete: ['delete'],
    submit: ['submit', 'convert'],
    approve: ['approve', 'confirm', 'complete'],
    post: ['post', 'release'],
    reverse: ['reverse', 'cancel'],
    export: ['export'],
    sensitive: ['post', 'reverse', 'approve', 'delete'],
  }
  const suffixes = actionSuffix[action] ?? []
  return catalog.filter((name) => {
    if (!row.match.some((m) => name.includes(m) || name.startsWith(m))) return false
    return suffixes.some((s) => name.endsWith(`.${s}`) || name.includes(`.${s}.`))
  })
}

export function applyPresetToSelected(
  preset: AccessPresetId,
  rows: MatrixArea[],
  catalog: string[],
  selected: Set<string>,
): Set<string> {
  const next = new Set(selected)
  const presetDef = ACCESS_PRESETS.find((p) => p.id === preset)
  if (!presetDef) return next
  for (const row of rows) {
    for (const action of MATRIX_ACTIONS.map((a) => a.id)) {
      const cells = resolveCellPermissions(row, action, catalog)
      for (const p of cells) next.delete(p)
      if (presetDef.actions.includes(action)) {
        for (const p of cells) next.add(p)
      }
    }
  }
  return next
}

export function templatePermissionNames(template: RoleTemplateDef, catalog: string[]): string[] {
  return catalog.filter((name) => template.permissionHints.some((h) => name.includes(h) || name.startsWith(h)))
}

export function detectSodWarnings(permissionNames: string[]): string[] {
  const set = new Set(permissionNames)
  const warnings: string[] = []
  for (const pair of SOD_WARNING_PAIRS) {
    const hasA = pair.a.some((p) => [...set].some((n) => n.includes(p) || n === p))
    const hasB = pair.b.some((p) => [...set].some((n) => n.includes(p) || n === p))
    if (hasA && hasB) warnings.push(pair.label)
  }
  return warnings
}

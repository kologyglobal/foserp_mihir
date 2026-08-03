/**
 * Quick-apply permission presets for the Admin Role builder.
 * Sourced from backend ROLE_PERMISSIONS packs (CRM User / Viewer / Tenant Admin).
 * Names are filtered against the live catalog when applied.
 */

/** Mirrors backend `ROLE_PERMISSIONS['CRM User']`. */
export const PRESET_CRM_USER: readonly string[] = [
  'crm.lead.view', 'crm.lead.create', 'crm.lead.update',
  'crm.contact.view', 'crm.contact.create', 'crm.contact.update',
  'crm.company.view',
  'crm.activity.view', 'crm.activity.create', 'crm.activity.update', 'crm.activity.complete',
  'crm.follow_up.view', 'crm.follow_up.create', 'crm.follow_up.update',
  'crm.pipeline.view',
  'crm.opportunity.view', 'crm.opportunity.create', 'crm.opportunity.update',
  'crm.quotation.view', 'crm.quotation.create', 'crm.quotation.update', 'crm.quotation.convert',
  'crm.sales_order.view', 'crm.sales_order.create', 'crm.sales_order.update', 'crm.sales_order.confirm',
  'crm.commercial.view',
  'crm.commercial.receipt.view', 'crm.commercial.receipt.create',
  'crm.commercial.invoice.view', 'crm.commercial.invoice.create', 'crm.commercial.invoice.post', 'crm.commercial.invoice.cancel',
  'crm.commercial.allocation.view', 'crm.commercial.allocation.create',
  'crm.note.view', 'crm.note.create', 'crm.note.update',
  'crm.attachment.view', 'crm.attachment.create',
  'crm.dashboard.view', 'crm.report.view', 'crm.search.view', 'crm.export.view',
  'crm.indiamart.view', 'crm.indiamart.enquiry.view',
  'master.lookup.view',
  'master.item.view',
  'master.product.view',
]

/** Sales-oriented read-only pack (backend Viewer, CRM/sales focused). */
export const PRESET_SALES_VIEWER: readonly string[] = [
  'crm.lead.view', 'crm.contact.view', 'crm.company.view',
  'crm.activity.view', 'crm.follow_up.view', 'crm.pipeline.view', 'crm.opportunity.view',
  'crm.quotation.view', 'crm.sales_order.view',
  'crm.commercial.view', 'crm.commercial.receipt.view', 'crm.commercial.invoice.view',
  'crm.dashboard.view', 'crm.report.view', 'crm.search.view',
  'crm.indiamart.view', 'crm.indiamart.enquiry.view',
  'master.lookup.view',
  'master.item.view',
  'master.product.view',
]

export interface RolePermissionPreset {
  id: string
  label: string
  description: string
  /** When true, select every catalog permission except platform-only tenant lifecycle keys. */
  selectAllTenantScoped?: boolean
  permissionNames?: readonly string[]
}

const PLATFORM_ONLY = new Set(['tenant.manage', 'tenant.create', 'tenant.delete'])

export const ROLE_PERMISSION_PRESETS: RolePermissionPreset[] = [
  {
    id: 'crm-user',
    label: 'CRM User',
    description: 'Day-to-day CRM / commercial operations',
    permissionNames: PRESET_CRM_USER,
  },
  {
    id: 'sales-viewer',
    label: 'Sales Viewer',
    description: 'Read-only CRM and sales visibility',
    permissionNames: PRESET_SALES_VIEWER,
  },
  {
    id: 'admin',
    label: 'Admin',
    description: 'Full tenant workspace access (excludes platform tenant lifecycle)',
    selectAllTenantScoped: true,
  },
]

export function resolvePresetPermissionNames(
  preset: RolePermissionPreset,
  catalogNames: readonly string[],
): string[] {
  const catalog = new Set(catalogNames)
  if (preset.selectAllTenantScoped) {
    return catalogNames.filter((n) => !PLATFORM_ONLY.has(n)).sort()
  }
  return (preset.permissionNames ?? []).filter((n) => catalog.has(n)).sort()
}

/**
 * Tenant module catalog — keys align with frontend `moduleCategories` ids where possible.
 * Missing TenantModuleFlag row = enabled (fail-open for existing tenants).
 */
export type TenantModuleDef = {
  key: string
  name: string
  description: string
  /** Must be enabled before this module can be enabled */
  dependsOn: string[]
  /** Always on — cannot disable */
  alwaysOn?: boolean
}

export const TENANT_MODULE_CATALOG: TenantModuleDef[] = [
  {
    key: 'masters',
    name: 'Master Data',
    description: 'Items, vendors, warehouses, geo, and shared masters',
    dependsOn: [],
  },
  {
    key: 'crm',
    name: 'CRM',
    description: 'Leads, opportunities, quotations, sales orders',
    dependsOn: [],
  },
  {
    key: 'purchase',
    name: 'Purchase',
    description: 'PR → RFQ → PO → GRN procurement',
    dependsOn: ['masters'],
  },
  {
    key: 'inventory',
    name: 'Inventory',
    description: 'Stock, movements, transfers',
    dependsOn: ['masters'],
  },
  {
    key: 'manufacturing',
    name: 'Manufacturing',
    description: 'BOMs, routings, work orders, shop floor',
    dependsOn: ['inventory'],
  },
  {
    key: 'quality',
    name: 'Quality',
    description: 'Inspections and QC',
    dependsOn: ['manufacturing'],
  },
  {
    key: 'dispatch',
    name: 'Dispatch',
    description: 'Delivery challans and dispatch',
    dependsOn: ['inventory'],
  },
  {
    key: 'accounting',
    name: 'Accounting',
    description: 'GL, AP/AR, period close (finance feature controls remain LE-scoped)',
    dependsOn: [],
  },
  {
    key: 'logistics',
    name: 'Logistics',
    description: 'Logistics / transport ops',
    dependsOn: ['dispatch'],
  },
  {
    key: 'gate',
    name: 'Gate',
    description: 'Gate entry and yard',
    dependsOn: [],
  },
  {
    key: 'reports',
    name: 'Reports',
    description: 'Operational and executive reports',
    dependsOn: [],
  },
]

export function getModuleDef(key: string): TenantModuleDef | undefined {
  return TENANT_MODULE_CATALOG.find((m) => m.key === key)
}

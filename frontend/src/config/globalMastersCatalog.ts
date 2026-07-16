import type { CrmMasterCatalogItem } from '../types/crmMasters'

const STATUS_FIELD = {
  key: 'status',
  label: 'Status',
  type: 'select' as const,
  section: 'basic' as const,
  options: [
    { value: 'active', label: 'Active' },
    { value: 'inactive', label: 'Inactive' },
  ],
}

/** CRM sales owners / users — maintained under Global Masters → User Management. */
export const USER_MASTER_CATALOG: CrmMasterCatalogItem = {
  kind: 'owners',
  slug: 'users',
  title: 'User Management',
  description: 'CRM users and sales owners for lead, opportunity, follow-up, and quotation assignment.',
  purpose: 'Maintain employee-linked CRM ownership, roles, and permission groups in one global register.',
  group: 'company',
  usedIn: ['leads', 'opportunities', 'quotations', 'sales-orders', 'reports'],
  importExport: true,
  fields: [
    { key: 'code', label: 'User ID', type: 'text', required: true, section: 'basic' },
    { key: 'name', label: 'User Name', type: 'text', required: true, section: 'basic' },
    { key: 'employeeCode', label: 'Employee Code', type: 'text', section: 'configuration' },
    { key: 'role', label: 'Role', type: 'text', section: 'configuration' },
    { key: 'department', label: 'Department', type: 'text', section: 'configuration' },
    { key: 'email', label: 'Email', type: 'text', section: 'configuration' },
    { key: 'mobile', label: 'Mobile', type: 'text', section: 'configuration' },
    { key: 'territory', label: 'Territory', type: 'text', section: 'configuration' },
    { key: 'permissionGroup', label: 'CRM Permission Group', type: 'text', section: 'configuration' },
    STATUS_FIELD,
  ],
}

/** Product interest catalog — maintained under Global Masters → Item Master. */
export const PRODUCT_INTEREST_MASTER_CATALOG: CrmMasterCatalogItem = {
  kind: 'product-interests',
  slug: 'product-interests',
  title: 'Product Interest Master',
  description: 'Product families and default quotation templates for demand analytics.',
  purpose: 'Link customer demand signals to product families and templates in one global register.',
  group: 'company',
  usedIn: ['leads', 'opportunities', 'quotations', 'sales-orders', 'reports'],
  importExport: true,
  fields: [
    { key: 'code', label: 'Interest Code', type: 'text', required: true, section: 'basic' },
    { key: 'name', label: 'Product Interest Name', type: 'text', required: true, section: 'basic' },
    { key: 'productFamily', label: 'Product Family', type: 'text', section: 'configuration' },
    { key: 'defaultTemplate', label: 'Default Quotation Template', type: 'text', section: 'configuration' },
    STATUS_FIELD,
  ],
}

export function getGlobalMasterCatalog(slug: string): CrmMasterCatalogItem | undefined {
  if (slug === 'users') return USER_MASTER_CATALOG
  if (slug === 'product-interests') return PRODUCT_INTEREST_MASTER_CATALOG
  return undefined
}

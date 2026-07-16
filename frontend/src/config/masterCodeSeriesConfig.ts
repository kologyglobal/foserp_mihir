import type { CodeSeriesEntityType } from '../types/codeSeriesMaster'
import type { CrmMasterKind } from '../types/crmMasters'

/** User-facing master keys → centralized code series entity types */
export const MASTER_ENTITY_CODE_MAP: Record<string, CodeSeriesEntityType> = {
  COMPANY: 'company',
  CUSTOMER: 'customer',
  VENDOR: 'vendor',
  CONTACT: 'contact',
  EMPLOYEE: 'employee',
  ROLE: 'role',
  PERMISSION: 'permission',
  ITEM: 'item',
  ITEM_CATEGORY: 'item_category',
  UOM: 'uom',
  WAREHOUSE: 'warehouse',
  HSN: 'hsn',
  GST_GROUP: 'gst_group',
  GST_RATE: 'gst_rate',
  BOM: 'bom',
  ROUTING: 'routing',
  WORK_CENTER: 'work_center',
  QUALITY_TEST_GROUP: 'quality_test_group',
  DEPARTMENT: 'department',
  TERRITORY: 'territory',
  INDUSTRY: 'industry',
  PAYMENT_TERMS: 'payment_terms',
  PRICE_LIST: 'price_list',
  APPROVAL_WORKFLOW: 'approval_workflow',
}

export const CRM_KIND_ENTITY_TYPE: Record<CrmMasterKind, CodeSeriesEntityType> = {
  'lead-sources': 'lead_source',
  industries: 'industry',
  territories: 'territory',
  owners: 'employee',
  designations: 'employee',
  departments: 'department',
  'lead-stages': 'lead_stage',
  'lead-priorities': 'lead_priority',
  'lead-reasons': 'lead_reason',
  'opportunity-stages': 'opportunity_stage',
  'opportunity-priorities': 'opportunity_priority',
  'activity-types': 'activity_type',
  'product-interests': 'product_interest',
  'lost-reasons': 'lost_reason',
  'commercial-terms': 'commercial_term',
  'payment-terms': 'payment_terms',
  'delivery-terms': 'delivery_term',
  'warranty-terms': 'warranty_term',
  'approval-rules': 'approval_rule',
  'document-types': 'document_type',
}

export function crmKindToEntityType(kind: CrmMasterKind): CodeSeriesEntityType {
  return CRM_KIND_ENTITY_TYPE[kind]
}

export function resolveCustomerEntityType(pathname: string): CodeSeriesEntityType {
  return pathname.includes('/masters/companies') ? 'company' : 'customer'
}

/** Masters that must use centralized code series (for automated tests) */
export const MASTER_CODE_SERIES_FORMS: { label: string; entityType: CodeSeriesEntityType; formPath: string }[] = [
  { label: 'Company Master', entityType: 'company', formPath: 'src/modules/masters/customer/CustomerPages.tsx' },
  { label: 'Customer Master', entityType: 'customer', formPath: 'src/modules/masters/customer/CustomerPages.tsx' },
  { label: 'Vendor Master', entityType: 'vendor', formPath: 'src/modules/masters/vendor/VendorPages.tsx' },
  { label: 'Contact Master', entityType: 'contact', formPath: 'src/modules/crm/CrmContactFormPage.tsx' },
  { label: 'Item Master', entityType: 'item', formPath: 'src/modules/masters/item/ItemPages.tsx' },
  { label: 'Item Category Master', entityType: 'item_category', formPath: 'src/modules/masters/item-category/ItemCategoryPages.tsx' },
  { label: 'UOM Master', entityType: 'uom', formPath: 'src/modules/masters/uom/UomPages.tsx' },
  { label: 'Warehouse Master', entityType: 'warehouse', formPath: 'src/modules/masters/warehouse/WarehousePages.tsx' },
  { label: 'HSN Master', entityType: 'hsn', formPath: 'src/modules/masters/hsn/HsnPages.tsx' },
  { label: 'GST Group Master', entityType: 'gst_group', formPath: 'src/modules/masters/gst-group/GstGroupPages.tsx' },
  { label: 'GST Rate Master', entityType: 'gst_rate', formPath: 'src/modules/masters/gst-rate/GstRatePages.tsx' },
  { label: 'BOM Master', entityType: 'bom', formPath: 'src/modules/masters/bom/BomPages.tsx' },
  { label: 'Routing Master', entityType: 'routing', formPath: 'src/modules/masters/routing/RoutingPages.tsx' },
  { label: 'Work Center Master', entityType: 'work_center', formPath: 'src/modules/masters/work-center/WorkCenterPages.tsx' },
  { label: 'CRM Master', entityType: 'territory', formPath: 'src/modules/crm/masters/CrmMasterPages.tsx' },
]

export const MASTER_CODE_HELPER_TEXT = 'Auto-generated from Code Series Master.'
export const MASTER_CODE_SERIES_MISSING = 'Code Series is not configured for this master.'

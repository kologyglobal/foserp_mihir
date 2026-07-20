import type {
  PurchaseLinkedMaster,
  PurchaseMasterCatalogItem,
  PurchaseMasterKind,
} from '../types/purchaseMasters'

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

const USED_IN_GRN: PurchaseMasterCatalogItem['usedIn'] = ['grn', 'returns']

export const PURCHASE_LINKED_MASTERS: PurchaseLinkedMaster[] = [
  {
    slug: 'vendors',
    title: 'Vendor Master',
    description: 'Approved suppliers, payment days, GSTIN, and item–vendor sourcing maps.',
    group: 'vendor',
    listRoute: '/masters/vendors',
    newRoute: '/masters/vendors/new',
    sourceModule: 'global',
    usedInPurchase: ['requisitions', 'rfqs', 'purchase-orders', 'grn', 'returns', 'vendor-quotations'],
  },
  {
    slug: 'items',
    title: 'Item Master',
    description: 'Purchasable items, specifications, and default UOM for PR/PO lines.',
    group: 'item',
    listRoute: '/masters/items',
    newRoute: '/masters/items/new',
    sourceModule: 'global',
    usedInPurchase: ['requisitions', 'rfqs', 'purchase-orders', 'grn', 'returns'],
  },
  {
    slug: 'item-categories',
    title: 'Item Category Master',
    description: 'Category hierarchy used for vendor supply scope and tolerance rules.',
    group: 'item',
    listRoute: '/masters/item-categories',
    newRoute: '/masters/item-categories/new',
    sourceModule: 'global',
    usedInPurchase: ['grn', 'returns'],
  },
  {
    slug: 'warehouses',
    title: 'Warehouse Master',
    description: 'Receipt and quarantine locations for GRN posting.',
    group: 'item',
    listRoute: '/masters/warehouses',
    newRoute: '/masters/warehouses/new',
    sourceModule: 'global',
    usedInPurchase: ['requisitions', 'purchase-orders', 'grn'],
  },
  {
    slug: 'locations',
    title: 'Location Master',
    description: 'BC-style receipt locations on PR, PO, and GRN lines.',
    group: 'item',
    listRoute: '/masters/locations',
    newRoute: '/masters/locations/new',
    sourceModule: 'global',
    usedInPurchase: ['requisitions', 'purchase-orders', 'grn'],
  },
  {
    slug: 'uom',
    title: 'UOM Master',
    description: 'Units of measure for purchase lines and GRN quantities.',
    group: 'item',
    listRoute: '/masters/uom',
    newRoute: '/masters/uom/new',
    sourceModule: 'global',
    usedInPurchase: ['requisitions', 'purchase-orders', 'grn'],
  },
  {
    slug: 'payment-terms',
    title: 'Payment Terms Master',
    description: 'Shared payment terms for POs, RFQs, quotations, and sales orders.',
    group: 'terms',
    listRoute: '/masters/payment-terms',
    newRoute: '/masters/payment-terms/new',
    sourceModule: 'crm',
    usedInPurchase: ['purchase-orders', 'rfqs', 'vendor-quotations'],
  },
  {
    slug: 'delivery-terms',
    title: 'Delivery Terms Master',
    description: 'Shared incoterms and lead times for POs, RFQs, and quotations.',
    group: 'terms',
    listRoute: '/crm/masters/delivery-terms',
    newRoute: '/crm/masters/delivery-terms/new',
    sourceModule: 'crm',
    usedInPurchase: ['purchase-orders', 'rfqs', 'vendor-quotations'],
  },
  {
    slug: 'approval-matrix',
    title: 'Approval Matrix',
    description: 'PR and PO approval amount thresholds and roles (Purchase Setup).',
    group: 'governance',
    listRoute: '/purchase/setup',
    newRoute: '/purchase/setup',
    sourceModule: 'governance',
    usedInPurchase: ['requisitions', 'purchase-orders'],
  },
  {
    slug: 'qc-parameters',
    title: 'QC Parameter Master',
    description: 'Inspection parameters referenced by incoming QC plans.',
    group: 'receiving',
    listRoute: '/quality/parameters',
    newRoute: '/quality/parameters/new',
    sourceModule: 'quality',
    usedInPurchase: ['grn'],
  },
  {
    slug: 'inspection-plans',
    title: 'Inspection Plan Master',
    description: 'Incoming inspection plans linked to GRN QC workflow.',
    group: 'receiving',
    listRoute: '/quality/inspection-plans',
    newRoute: '/quality/inspection-plans/new',
    sourceModule: 'quality',
    usedInPurchase: ['grn'],
  },
]

export const PURCHASE_MASTERS_CATALOG: PurchaseMasterCatalogItem[] = [
  {
    kind: 'freight-terms',
    slug: 'freight-terms',
    title: 'Freight Terms Master',
    description: 'Freight responsibility for vendor quotations and POs.',
    group: 'terms',
    usedIn: ['vendor-quotations', 'purchase-orders'],
    importExport: true,
    fields: [
      { key: 'code', label: 'Term Code', type: 'text', required: true },
      { key: 'name', label: 'Freight Term Name', type: 'text', required: true },
      { key: 'freightIncluded', label: 'Freight Included', type: 'boolean' },
      STATUS_FIELD,
    ],
  },
  {
    kind: 'buyers',
    slug: 'buyers',
    title: 'Buyer / Purchaser Master',
    description: 'Procurement buyers assigned to requisitions and RFQs.',
    group: 'governance',
    usedIn: ['requisitions', 'rfqs', 'purchase-orders'],
    fields: [
      { key: 'code', label: 'Buyer Code', type: 'text', required: true },
      { key: 'name', label: 'Buyer Name', type: 'text', required: true },
      { key: 'employeeCode', label: 'Employee Code', type: 'text' },
      { key: 'email', label: 'Email', type: 'text' },
      { key: 'department', label: 'Department', type: 'text' },
      STATUS_FIELD,
    ],
  },
  {
    kind: 'qc-rules',
    slug: 'qc-rules',
    title: 'QC Requirement Rules',
    description: 'Rules that flag incoming QC at GRN by item or category.',
    purpose: 'Replace hardcoded item lists — define which materials require incoming inspection.',
    group: 'receiving',
    usedIn: USED_IN_GRN,
    fields: [
      { key: 'code', label: 'Rule Code', type: 'text', required: true },
      { key: 'name', label: 'Rule Name', type: 'text', required: true },
      {
        key: 'scopeType',
        label: 'Scope',
        type: 'select',
        required: true,
        options: [
          { value: 'all', label: 'All Items' },
          { value: 'item', label: 'Specific Item' },
          { value: 'category', label: 'Item Category' },
        ],
      },
      { key: 'itemId', label: 'Item ID', type: 'text', placeholder: 'e.g. item-rm-plt' },
      { key: 'categoryId', label: 'Category ID', type: 'text', placeholder: 'e.g. cat-rm-steel' },
      { key: 'requiresIncomingQc', label: 'Requires Incoming QC', type: 'boolean' },
      STATUS_FIELD,
    ],
  },
  {
    kind: 'grn-tolerance',
    slug: 'grn-tolerance',
    title: 'GRN Excess Tolerance',
    description: 'Allowed over-receipt % at GRN by default or per category/item.',
    group: 'receiving',
    usedIn: USED_IN_GRN,
    fields: [
      { key: 'code', label: 'Rule Code', type: 'text', required: true },
      { key: 'name', label: 'Rule Name', type: 'text', required: true },
      {
        key: 'scopeType',
        label: 'Scope',
        type: 'select',
        options: [
          { value: 'default', label: 'Default (All)' },
          { value: 'item', label: 'Specific Item' },
          { value: 'category', label: 'Item Category' },
        ],
      },
      { key: 'itemId', label: 'Item ID', type: 'text' },
      { key: 'categoryId', label: 'Category ID', type: 'text' },
      { key: 'tolerancePct', label: 'Tolerance %', type: 'number', required: true },
      STATUS_FIELD,
    ],
  },
  {
    kind: 'return-reasons',
    slug: 'return-reasons',
    title: 'Purchase Return Reasons',
    description: 'Reason codes for vendor returns and debit notes.',
    group: 'receiving',
    usedIn: ['returns'],
    importExport: true,
    fields: [
      { key: 'code', label: 'Reason Code', type: 'text', required: true },
      { key: 'name', label: 'Reason Name', type: 'text', required: true },
      { key: 'requiresApproval', label: 'Requires Approval', type: 'boolean' },
      STATUS_FIELD,
    ],
  },
  {
    kind: 'bin-codes',
    slug: 'bin-codes',
    title: 'BIN Code Master',
    description: 'Storage BIN codes selectable on purchase requisition lines.',
    group: 'item',
    usedIn: ['requisitions', 'purchase-orders', 'grn'],
    importExport: true,
    fields: [
      { key: 'code', label: 'BIN Code', type: 'text', required: true, placeholder: 'e.g. A1-01' },
      { key: 'name', label: 'BIN Name', type: 'text', required: true, placeholder: 'e.g. Rack A / Bin 01' },
      { key: 'warehouseCode', label: 'Warehouse Code', type: 'text', placeholder: 'Optional warehouse' },
      { key: 'locationCode', label: 'Location Code', type: 'text', placeholder: 'Optional location' },
      STATUS_FIELD,
    ],
  },
]

export function getPurchaseMasterCatalog(slug: string): PurchaseMasterCatalogItem | undefined {
  return PURCHASE_MASTERS_CATALOG.find((m) => m.slug === slug)
}

export function getPurchaseLinkedMaster(slug: string): PurchaseLinkedMaster | undefined {
  return PURCHASE_LINKED_MASTERS.find((m) => m.slug === slug)
}

export function slugToPurchaseKind(slug: string): PurchaseMasterKind | null {
  const item = getPurchaseMasterCatalog(slug)
  return item?.kind ?? null
}

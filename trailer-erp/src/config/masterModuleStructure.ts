import type { LucideIcon } from 'lucide-react'
import {
  Building2,
  CreditCard,
  Factory,
  FileText,
  FolderOpen,
  FolderTree,
  GitBranch,
  Globe,
  Hash,
  Landmark,
  Layers,
  LayoutDashboard,
  MapPin,
  Package,
  PackageCheck,
  Percent,
  Ruler,
  ScanLine,
  Settings2,
  ShieldCheck,
  SlidersHorizontal,
  Target,
  Truck,
  Users,
  Warehouse,
} from 'lucide-react'

/** Enterprise Master Data module — SAP Fiori / BC-style grouping */
export type MasterModuleGroupId =
  | 'administration'
  | 'customer-vendor'
  | 'inventory'
  | 'tax'
  | 'manufacturing'
  | 'organization'
  | 'configuration'

/** Legacy group ids still referenced by existing master forms */
export type LegacyMasterGroupId =
  | 'foundation'
  | 'crm'
  | 'procurement'
  | 'purchase'
  | 'production'
  | 'engineering'
  | 'quality'
  | 'documents'

export type MasterCatalogGroupId = MasterModuleGroupId | LegacyMasterGroupId

export type MasterImplementationStatus = 'implemented' | 'placeholder' | 'linked'

export type MasterGroupAccent = 'blue' | 'green' | 'amber' | 'purple' | 'indigo' | 'cyan' | 'rose' | 'slate'

export interface MasterDefinition {
  id: string
  label: string
  path: string
  description: string
  groupId: MasterModuleGroupId
  status: MasterImplementationStatus
  icon: LucideIcon
  countKey?: string
  /** RBAC prefix — e.g. masters.items */
  permissionKey?: string
  legacyPaths?: string[]
  /** CRM register slug when status is linked */
  crmSlug?: string
}

export interface MasterModuleGroup {
  id: MasterModuleGroupId
  title: string
  description: string
  icon: LucideIcon
  accent: MasterGroupAccent
  masters: MasterDefinition[]
}

const def = (
  id: string,
  label: string,
  path: string,
  groupId: MasterModuleGroupId,
  icon: LucideIcon,
  opts: Partial<Omit<MasterDefinition, 'id' | 'label' | 'path' | 'groupId' | 'icon'>> = {},
): MasterDefinition => ({
  id,
  label,
  path,
  groupId,
  icon,
  description: opts.description ?? '',
  status: opts.status ?? 'implemented',
  countKey: opts.countKey,
  permissionKey: opts.permissionKey,
  legacyPaths: opts.legacyPaths,
  crmSlug: opts.crmSlug,
})

export const MASTER_MODULE_GROUPS: MasterModuleGroup[] = [
  {
    id: 'administration',
    title: 'Administration',
    description: 'Company profile, security, numbering, and system control',
    icon: SlidersHorizontal,
    accent: 'slate',
    masters: [
      def('companies', 'Company Master', '/masters/companies', 'administration', Building2, {
        description: 'Legal entities, GSTIN, and company profile',
        countKey: 'customers',
        permissionKey: 'masters.companies',
        legacyPaths: ['/masters/customers'],
      }),
      def('users', 'User Management', '/masters/users', 'administration', Users, {
        description: 'CRM users, sales owners, and assignment — one register (Employee / User / Owner contexts)',
        countKey: 'users',
        permissionKey: 'masters.users',
        legacyPaths: ['/crm/masters/owners'],
      }),
      def('roles', 'Role Master', '/masters/roles', 'administration', ShieldCheck, {
        description: 'ERP roles and permission scope',
        permissionKey: 'masters.roles',
        legacyPaths: ['/settings/roles'],
      }),
      def('role-permissions', 'Role Permission Matrix', '/masters/role-permissions', 'administration', ShieldCheck, {
        description: 'Role × module × action permission matrix',
        permissionKey: 'masters.role-permissions',
        legacyPaths: ['/masters/permissions', '/settings/permissions'],
      }),
      def('code-series', 'Code / Number Series Master', '/masters/code-series', 'administration', Hash, {
        description: 'Centralized document and master code generation',
        countKey: 'codeSeries',
        permissionKey: 'masters.code-series',
      }),
    ],
  },
  {
    id: 'customer-vendor',
    title: 'Customer & Vendor',
    description: 'Commercial parties, contacts, and procurement registers',
    icon: Target,
    accent: 'green',
    masters: [
      def('vendors', 'Vendor Master', '/masters/vendors', 'customer-vendor', Truck, {
        description: 'Suppliers, job-work, and service vendors',
        countKey: 'vendors',
        permissionKey: 'masters.vendors',
      }),
      def('contacts', 'Contact Master', '/masters/contacts', 'customer-vendor', Users, {
        description: 'People linked to companies — designation and communication',
        status: 'linked',
        countKey: 'contacts',
        permissionKey: 'masters.contacts',
        legacyPaths: ['/crm/contacts'],
      }),
      def('designations', 'Designation Master', '/masters/designations', 'customer-vendor', Users, {
        description: 'Contact job titles and decision roles',
        status: 'linked',
        permissionKey: 'crm.master.view',
      }),
      def('departments', 'Department Master', '/masters/departments', 'customer-vendor', Users, {
        description: 'Organizational departments for contacts and purchase requests',
        status: 'linked',
        permissionKey: 'crm.master.view',
      }),
      def('order-addresses', 'Order Address Code', '/masters/order-addresses', 'customer-vendor', MapPin, {
        description: 'Alternate vendor ship-to / order-from addresses',
        countKey: 'orderAddresses',
        permissionKey: 'masters.order-addresses',
      }),
    ],
  },
  {
    id: 'inventory',
    title: 'Inventory',
    description: 'Items, categories, units, and storage locations',
    icon: Warehouse,
    accent: 'cyan',
    masters: [
      def('items', 'Item Master', '/masters/items', 'inventory', Package, {
        description: 'Engineering items — RM, BO, SA, FG',
        countKey: 'items',
        permissionKey: 'masters.items',
      }),
      def('item-categories', 'Item Category Master', '/masters/item-categories', 'inventory', FolderTree, {
        description: 'Material classification hierarchy',
        countKey: 'categories',
        permissionKey: 'masters.item-categories',
      }),
      def('uom', 'Unit of Measure Master', '/masters/uom', 'inventory', Ruler, {
        description: 'NOS, KG, MTR, LTR and alternate UOMs',
        countKey: 'uoms',
        permissionKey: 'masters.uom',
      }),
      def('warehouses', 'Warehouse Master', '/masters/warehouses', 'inventory', Warehouse, {
        description: 'RM, WIP, FG and quarantine storage',
        countKey: 'warehouses',
        permissionKey: 'masters.warehouses',
      }),
      def('locations', 'Location Master', '/masters/locations', 'inventory', MapPin, {
        description: 'BC-style locations for sales, purchase, and stock documents',
        countKey: 'locations',
        permissionKey: 'masters.locations',
      }),
    ],
  },
  {
    id: 'tax',
    title: 'Tax',
    description: 'HSN, GST groups, and rate slabs',
    icon: Percent,
    accent: 'amber',
    masters: [
      def('hsn', 'HSN Master', '/masters/hsn', 'tax', Hash, {
        description: 'Harmonized System nomenclature codes',
        countKey: 'hsn',
        permissionKey: 'masters.hsn',
      }),
      def('gst-groups', 'GST Group Code Master', '/masters/gst-groups', 'tax', Percent, {
        description: 'GST classification groups for goods and services',
        countKey: 'gstGroups',
        permissionKey: 'masters.gst-groups',
      }),
      def('gst-rates', 'GST Rate Master', '/masters/gst-rates', 'tax', Percent, {
        description: 'State-wise SGST, CGST, IGST rate slabs',
        countKey: 'gstRates',
        permissionKey: 'masters.gst-rates',
      }),
    ],
  },
  {
    id: 'manufacturing',
    title: 'Manufacturing',
    description: 'BOM, routing, work centers, and quality setup',
    icon: Factory,
    accent: 'indigo',
    masters: [
      def('bom', 'BOM Master', '/masters/bom', 'manufacturing', Layers, {
        description: 'Bill of materials and costing',
        countKey: 'boms',
        permissionKey: 'masters.bom',
      }),
      def('routing', 'Routing Master', '/masters/routing', 'manufacturing', GitBranch, {
        description: 'Operation sequences and standard times',
        countKey: 'routings',
        permissionKey: 'masters.routing',
      }),
      def('work-centers', 'Work Center Master', '/masters/work-centers', 'manufacturing', Factory, {
        description: 'Machines, cells, and labour resources',
        countKey: 'workCenters',
        permissionKey: 'masters.work-centers',
      }),
      def('products', 'Product Master', '/masters/products', 'manufacturing', Package, {
        description: 'Finished goods and trailer variants',
        countKey: 'products',
        permissionKey: 'masters.products',
      }),
      def('serial-numbers', 'Serial Numbers', '/masters/serial-numbers', 'manufacturing', PackageCheck, {
        description: 'Serial and batch genealogy register',
        countKey: 'serials',
        permissionKey: 'masters.serial-numbers',
        legacyPaths: ['/serials'],
      }),
      def('quality-test-groups', 'Quality Test Group Master', '/masters/quality-test-groups', 'manufacturing', ShieldCheck, {
        description: 'QC test groups for incoming, WIP, and FG inspection',
        status: 'placeholder',
        permissionKey: 'masters.quality-test-groups',
      }),
    ],
  },
  {
    id: 'organization',
    title: 'Organization',
    description: 'Departments, territories, and industry segments',
    icon: MapPin,
    accent: 'purple',
    masters: [
      def('countries', 'Country Master', '/masters/countries', 'organization', Globe, {
        description: 'Countries for customer, vendor, and address forms',
        countKey: 'geoCountries',
        permissionKey: 'masters.countries',
      }),
      def('states', 'State / Province Master', '/masters/states', 'organization', MapPin, {
        description: 'States and provinces linked to geography lookups',
        countKey: 'geoStates',
        permissionKey: 'masters.states',
      }),
      def('cities', 'City Master', '/masters/cities', 'organization', Building2, {
        description: 'Cities linked to states for address entry',
        countKey: 'geoCities',
        permissionKey: 'masters.cities',
      }),
    ],
  },
  {
    id: 'configuration',
    title: 'Configuration',
    description: 'Commercial terms, pricing, and approval workflows',
    icon: Settings2,
    accent: 'blue',
    masters: [
      def('payment-methods', 'Payment Method', '/masters/payment-methods', 'configuration', CreditCard, {
        description: 'NEFT, RTGS, Cheque, Cash, UPI payment methods',
        countKey: 'paymentMethods',
        permissionKey: 'masters.payment-methods',
      }),
      def('bank-accounts', 'Bank Account', '/masters/bank-accounts', 'configuration', Landmark, {
        description: 'Company treasury and payment posting bank accounts',
        countKey: 'bankAccounts',
        permissionKey: 'masters.bank-accounts',
      }),
      def('banks', 'Bank Master', '/masters/banks', 'configuration', Building2, {
        description: 'Bank register lookup for bank accounts',
        countKey: 'banks',
        permissionKey: 'masters.banks',
      }),
      def('price-lists', 'Price List', '/masters/price-lists', 'configuration', FileText, {
        description: 'Customer and item price list registers',
        status: 'placeholder',
        permissionKey: 'masters.price-lists',
      }),
      def('approval-workflows', 'Approval Workflow', '/masters/approval-workflows', 'configuration', ShieldCheck, {
        description: 'Document approval rules and sign-off limits',
        permissionKey: 'masters.approval-workflows',
        legacyPaths: ['/masters/approval-matrix', '/settings/approval-matrix'],
      }),
      def('documents', 'Document Register', '/documents', 'configuration', FolderOpen, {
        description: 'Drawings, specs, and controlled files',
        permissionKey: 'masters.documents',
      }),
      def('barcode', 'Barcode Master', '/barcode/master', 'configuration', ScanLine, {
        description: 'Barcode format definitions',
        permissionKey: 'masters.barcode',
      }),
    ],
  },
]

/** @deprecated Extended registers merged into MASTER_MODULE_GROUPS — kept for imports */
export const MASTER_EXTENDED_REGISTERS: MasterDefinition[] = []

export const ALL_MASTER_DEFINITIONS: MasterDefinition[] = [
  ...MASTER_MODULE_GROUPS.flatMap((g) => g.masters),
  ...MASTER_EXTENDED_REGISTERS,
]

export const MASTER_SUMMARY_CARD_KEYS = [
  'customers',
  'vendors',
  'items',
  'users',
  'taxMasters',
  'workCenters',
  'boms',
  'routings',
] as const

export const MASTER_SEARCH_GROUP_LABELS: Record<string, string> = {
  Company: 'Company',
  Customer: 'Customer',
  Vendor: 'Vendor',
  Item: 'Item',
  Employee: 'Employee',
  HSN: 'HSN',
  GST: 'GST',
  UOM: 'UOM',
  Role: 'Role',
  Permission: 'Permission',
  'Code Series': 'Code Series',
  Contact: 'Contact',
  BOM: 'BOM',
  Routing: 'Routing',
  'Work Center': 'Work Center',
}

export function getMasterDefinitionById(id: string): MasterDefinition | undefined {
  return ALL_MASTER_DEFINITIONS.find((m) => m.id === id)
}

export function getMasterDefinitionByPath(pathname: string): MasterDefinition | undefined {
  const normalized = pathname.split('?')[0]
  const sorted = [...ALL_MASTER_DEFINITIONS].sort((a, b) => b.path.length - a.path.length)
  for (const master of sorted) {
    if (normalized === master.path || normalized.startsWith(`${master.path}/`)) return master
    for (const legacy of master.legacyPaths ?? []) {
      if (normalized === legacy || normalized.startsWith(`${legacy}/`)) return master
    }
  }
  return undefined
}

export function getMasterGroupById(id: MasterCatalogGroupId): MasterModuleGroup | undefined {
  const normalized = normalizeMasterGroupId(id)
  return MASTER_MODULE_GROUPS.find((g) => g.id === normalized)
}

export function normalizeMasterGroupId(id: MasterCatalogGroupId): MasterModuleGroupId {
  const legacyMap: Record<LegacyMasterGroupId, MasterModuleGroupId> = {
    foundation: 'inventory',
    crm: 'customer-vendor',
    procurement: 'customer-vendor',
    purchase: 'configuration',
    production: 'manufacturing',
    engineering: 'manufacturing',
    quality: 'manufacturing',
    documents: 'configuration',
  }
  if (id in legacyMap) return legacyMap[id as LegacyMasterGroupId]
  return id as MasterModuleGroupId
}

export function resolveMasterGroupIdFromPath(pathname: string): MasterCatalogGroupId | undefined {
  const master = getMasterDefinitionByPath(pathname)
  if (master) return master.groupId
  if (pathname.startsWith('/crm/masters')) return 'crm'
  if (pathname.startsWith('/purchase/masters')) return 'purchase'
  if (pathname.startsWith('/masters/')) return 'inventory'
  return undefined
}

/** CRM register slugs served under /masters/* with Master Data hub breadcrumbs */
export const MASTER_DATA_CRM_SLUGS = new Set([
  'territories',
  'industries',
  'designations',
  'departments',
  'payment-terms',
])

/** Primary masters shown in the workspace top tab strip (same pattern as CRM / Purchase). */
const MASTER_WORKSPACE_SUBNAV_IDS = new Set([
  'companies',
  'contacts',
  'items',
  'vendors',
  'uom',
  'warehouses',
  'products',
  'territories',
  'industries',
  'designations',
  'departments',
  'payment-terms',
])

export function isMasterDataPath(pathname: string): boolean {
  return pathname === '/masters' || pathname.startsWith('/masters/')
}

export function buildMasterNavItems(): Array<{
  label: string
  path: string
  icon: LucideIcon
  end?: boolean
  workspace?: boolean
  subNav?: boolean
  disabled?: boolean
  section?: string
}> {
  const hub = {
    label: 'Master Data Hub',
    path: '/masters',
    icon: LayoutDashboard,
    end: true,
    workspace: true,
    subNav: true,
    section: 'Overview',
  }

  const items: ReturnType<typeof buildMasterNavItems> = [hub]

  for (const group of MASTER_MODULE_GROUPS) {
    for (const master of group.masters) {
      items.push({
        label: master.label,
        path: master.path,
        icon: master.icon,
        subNav: MASTER_WORKSPACE_SUBNAV_IDS.has(master.id),
        disabled: master.status === 'placeholder',
        section: group.title,
      })
    }
  }

  return items
}

/** Standard master actions for RBAC documentation */
export const MASTER_PERMISSION_ACTIONS = [
  'view',
  'create',
  'edit',
  'delete',
  'import',
  'export',
  'approve',
  'history',
  'audit',
] as const

export type MasterPermissionAction = (typeof MASTER_PERMISSION_ACTIONS)[number]

export function masterPermissionKey(masterKey: string, action: MasterPermissionAction): string {
  return `${masterKey}.${action}`
}

/** Master entity relationships for documentation and cross-links */
export const MASTER_RELATIONSHIPS: Array<{ from: string; to: string; label: string }> = [
  { from: 'Item Master', to: 'HSN Master', label: 'HSN code' },
  { from: 'Item Master', to: 'GST Group Code Master', label: 'GST group' },
  { from: 'Item Master', to: 'Unit of Measure Master', label: 'Base UOM' },
  { from: 'Item Master', to: 'Item Category Master', label: 'Category' },
  { from: 'Company Master', to: 'Contact Master', label: 'Contacts' },
  { from: 'Company Master', to: 'Opportunity', label: 'CRM pipeline' },
  { from: 'Company Master', to: 'Sales Order', label: 'Commercial orders' },
  { from: 'User Management', to: 'Role Master', label: 'Assigned role' },
  { from: 'User Management', to: 'Role Permission Matrix', label: 'Effective permissions' },
  { from: 'GST Rate Master', to: 'GST Group Code Master', label: 'Rate slab' },
  { from: 'HSN Master', to: 'GST Group Code Master', label: 'Default GST group' },
]

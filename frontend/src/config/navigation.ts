import type { LucideIcon } from 'lucide-react'
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  BarChart3,
  BookOpen,
  CalendarCheck,
  ClipboardList,
  FileSpreadsheet,
  FileText,
  GitBranch,
  Handshake,
  HardHat,
  Inbox,
  KeyRound,
  Landmark,
  LayoutDashboard,
  Lock,
  Network,
  Package,
  PackageCheck,
  Factory,
  RotateCcw,
  Receipt,
  ShieldAlert,
  Settings2,
  ShoppingCart,
  SlidersHorizontal,
  Truck,
  Users,
  UserPlus,
  Building2,
  Warehouse,
  Wrench,
  Clock,
  ShieldCheck,
  ScanLine,
  Target,
  TrendingUp,
  Layers,
  Cog,
  CircuitBoard,
} from 'lucide-react'

import { buildMasterNavItems } from './masterModuleStructure'
import { TAX_COMPLIANCE_NAV } from './taxComplianceNav'

export type NavItem = {
  label: string
  path: string
  icon: LucideIcon
  end?: boolean
  disabled?: boolean
  /** Dashboard / workspace landing page for the module */
  workspace?: boolean
  /** When false, hidden from workspace tab strip (discover via hub) */
  subNav?: boolean
  /** Section label for grouped master navigation */
  section?: string
  /** Workspace tab dropdown group (e.g. Procurement, Warehouse) */
  group?: string
}

export type NavCategory = {
  id: string
  title: string
  items: NavItem[]
}

/** Module navigation — each category leads with its workspace/dashboard */
export const moduleCategories: NavCategory[] = [
  {
    id: 'executive',
    title: 'Executive',
    items: [
      { label: 'My Home', path: '/home', icon: LayoutDashboard, end: true, workspace: true },
      { label: 'Executive', path: '/executive', icon: BarChart3 },
      { label: 'Inbox', path: '/inbox', icon: Inbox },
      { label: 'Role Inbox', path: '/home/inbox', icon: Inbox },
    ],
  },
  {
    id: 'masters',
    title: 'Master Data',
    items: buildMasterNavItems(),
  },
  {
    id: 'crm',
    title: 'CRM',
    items: [
      { label: 'Dashboard', path: '/crm', icon: LayoutDashboard, end: true, workspace: true },
      { label: 'Sales Forecast', path: '/crm/forecast', icon: TrendingUp },
      { label: 'Leads', path: '/crm/leads', icon: Target },
      { label: 'Opportunities', path: '/crm/opportunities', icon: Handshake },
      { label: 'Quotations', path: '/crm/quotations', icon: FileText },
      { label: 'Quotation Templates', path: '/crm/quotation-templates', icon: ClipboardList },
      { label: 'Sales Orders', path: '/crm/sales-orders', icon: ShoppingCart },
      { label: 'Companies', path: '/crm/companies', icon: Building2 },
      { label: 'Contacts', path: '/crm/contacts', icon: Users },
      { label: 'Reports', path: '/crm/reports', icon: BarChart3 },
      { label: 'Masters', path: '/crm/masters', icon: Settings2 },
    ],
  },
  {
    id: 'sales',
    title: 'Sales',
    items: [
      { label: 'Sales Dashboard', path: '/sales', icon: LayoutDashboard, end: true, workspace: true },
      { label: 'Quotation Approvals', path: '/sales/approvals', icon: Handshake },
      { label: 'Sales Orders', path: '/sales/orders', icon: ShoppingCart },
      { label: 'Company 360', path: '/sales/customers', icon: Building2 },
    ],
  },
  {
    id: 'inventory',
    title: 'Inventory & Warehouse',
    items: [
      { label: 'Store Home', path: '/inventory', icon: LayoutDashboard, end: true, workspace: true },
      { label: 'Today’s Work', path: '/inventory/store-workbench', icon: ClipboardList },
      { label: 'Items', path: '/inventory/items', icon: Package },
      { label: 'Stock', path: '/inventory/stock', icon: Warehouse },
      { label: 'Receive Stock', path: '/inventory/movements/receipts', icon: ArrowDownToLine },
      { label: 'Issue Stock', path: '/inventory/movements/issues', icon: ArrowUpFromLine },
      { label: 'Move Between Warehouses', path: '/inventory/movements/transfers', icon: GitBranch },
      { label: 'Adjust Stock', path: '/inventory/movements/adjustments', icon: SlidersHorizontal },
      { label: 'Returns', path: '/inventory/movements/returns', icon: RotateCcw },
      { label: 'Stock Count', path: '/inventory/stock-count', icon: ClipboardList },
      { label: 'Reorder Planning', path: '/inventory/planning', icon: Target },
      { label: 'Accounting', path: '/inventory/accounting', icon: Landmark },
      { label: 'Reports', path: '/inventory/reports', icon: BarChart3 },
      { label: 'Setup', path: '/inventory/setup', icon: Settings2 },
      /** Legacy routes — kept for bookmarks / deep links; hidden from workspace tabs */
      { label: 'Stock Ledger', path: '/inventory/ledger', icon: BookOpen, subNav: false },
      { label: 'Reservations', path: '/inventory/reservations', icon: ClipboardList, subNav: false },
      { label: 'Opening Stock', path: '/inventory/opening-stock', icon: ClipboardList, subNav: false },
      { label: 'Material Inward', path: '/inventory/inward', icon: ArrowDownToLine, subNav: false },
      { label: 'Material Issue', path: '/inventory/issue', icon: ArrowUpFromLine, subNav: false },
      { label: 'Stock Adjustment', path: '/inventory/adjustment', icon: SlidersHorizontal, subNav: false },
      { label: 'Scan To Receive', path: '/inventory/scan/receive', icon: ScanLine, subNav: false },
      { label: 'Scan To Issue', path: '/inventory/scan/issue', icon: ScanLine, subNav: false },
      { label: 'Scan To Transfer', path: '/inventory/scan/transfer', icon: ScanLine, subNav: false },
    ],
  },
  {
    id: 'purchase',
    title: 'Procurement',
    items: [
      { label: 'Dashboard', path: '/purchase', icon: LayoutDashboard, end: true, workspace: true },
      { label: 'Approvals', path: '/purchase/approvals', icon: ShieldCheck },
      { label: 'Purchase Requisitions', path: '/purchase/requisitions', icon: FileText, group: 'Procurement' },
      { label: 'Purchase Planning Sheet', path: '/purchase/planning-sheet', icon: ClipboardList, group: 'Procurement' },
      { label: 'Request for Quotations', path: '/purchase/rfqs', icon: ShoppingCart, group: 'Procurement' },
      { label: 'Quotation Comparison', path: '/purchase/comparison', icon: SlidersHorizontal, group: 'Procurement' },
      { label: 'Purchase Orders', path: '/purchase/orders', icon: Truck },
      { label: 'Goods Receipt Notes', path: '/purchase/grn', icon: PackageCheck, group: 'Warehouse' },
      { label: 'Purchase Returns', path: '/purchase/returns', icon: RotateCcw, group: 'Warehouse' },
      { label: 'Purchase Invoices', path: '/purchase/invoices', icon: Receipt, group: 'Accounts' },
      { label: 'Vendor Quotations', path: '/purchase/vendor-quotations', icon: Receipt, group: 'Vendors' },
      { label: 'Masters', path: '/purchase/masters', icon: Settings2 },
      { label: 'Setup', path: '/purchase/setup', icon: Settings2 },
    ],
  },
  {
    id: 'production',
    title: 'Manufacturing',
    items: [
      { label: 'Control Room', path: '/manufacturing/control-room', icon: LayoutDashboard, end: true, workspace: true },
      { label: 'Shopfloor', path: '/manufacturing/shopfloor', icon: Factory },
      { label: 'Production Plan', path: '/manufacturing/production-plan', icon: ClipboardList },
      { label: 'Work Orders', path: '/manufacturing/work-orders', icon: Wrench },
      { label: 'Job Work', path: '/manufacturing/job-work', icon: Truck },
      { label: 'BOMs', path: '/manufacturing/setup/boms', icon: Layers, group: 'Setup' },
      { label: 'Routings', path: '/manufacturing/setup/routings', icon: GitBranch, group: 'Setup' },
      { label: 'Work Centres', path: '/manufacturing/work-centres', icon: HardHat, group: 'Setup' },
      { label: 'Machines', path: '/manufacturing/machines', icon: Cog, group: 'Setup' },
      { label: 'Profiles', path: '/manufacturing/profiles', icon: CircuitBoard, group: 'Setup' },
      { label: 'Setup', path: '/manufacturing/setup', icon: Settings2, end: true, group: 'Setup' },
      { label: 'Reports', path: '/manufacturing/reports', icon: BarChart3 },
      { label: 'Settings', path: '/manufacturing/settings', icon: Settings2 },
    ],
  },
  {
    id: 'quality',
    title: 'Quality Ops',
    items: [
      { label: 'Quality Workspace', path: '/quality', icon: LayoutDashboard, end: true, workspace: true },
      { label: 'QC Queue', path: '/quality/queue', icon: Clock },
      { label: 'Incoming QC', path: '/quality/incoming', icon: ArrowDownToLine },
      { label: 'Rework Workbench', path: '/quality/rework', icon: RotateCcw },
      { label: 'NCR Register', path: '/quality/ncr', icon: ShieldAlert },
      { label: 'QC Parameter Master', path: '/quality/parameters', icon: SlidersHorizontal },
      { label: 'Inspection Plans', path: '/quality/inspection-plans', icon: ClipboardList },
      { label: 'Reports', path: '/quality/reports', icon: BarChart3 },
    ],
  },
  {
    id: 'dispatch',
    title: 'Logistics',
    items: [
      { label: 'Dispatch Workspace', path: '/dispatch', icon: LayoutDashboard, end: true, workspace: true },
      { label: 'Dispatch Register', path: '/dispatch/register', icon: ClipboardList },
      { label: 'Reports', path: '/dispatch/reports', icon: BarChart3 },
    ],
  },
  {
    id: 'gate',
    title: 'Gate & Security',
    items: [
      { label: 'Dashboard', path: '/gate', icon: LayoutDashboard, end: true, workspace: true },
      { label: "Today's Register", path: '/gate/register', icon: ClipboardList },
      { label: 'Visitors', path: '/gate/visitors', icon: Users },
      { label: 'Vehicles', path: '/gate/vehicles', icon: Truck },
      { label: 'Material Inward', path: '/gate/material-inward', icon: ArrowDownToLine },
      { label: 'Material Outward', path: '/gate/material-outward', icon: ArrowUpFromLine },
      { label: 'Gate Passes', path: '/gate/passes', icon: FileText },
      { label: 'Contractors', path: '/gate/contractors', icon: HardHat },
      { label: 'Courier Register', path: '/gate/couriers', icon: Package },
      { label: 'Approvals', path: '/gate/approvals', icon: ShieldCheck },
      { label: 'Reports', path: '/gate/reports', icon: BarChart3 },
      { label: 'Settings', path: '/gate/settings', icon: Settings2 },
    ],
  },
  {
    id: 'accounting',
    title: 'Accounting',
    items: [
      { label: 'Dashboard', path: '/accounting', icon: LayoutDashboard, end: true, workspace: true },
      { label: 'Organisation Setup', path: '/settings/organisation', icon: Building2 },
      { label: 'Chart of Accounts', path: '/accounting/settings/chart-of-accounts', icon: BookOpen },
      { label: 'Journals', path: '/accounting/entries/journals', icon: FileText },
      { label: 'Money In', path: '/accounting/money-in', icon: ArrowDownToLine },
      { label: 'Money Out', path: '/accounting/money-out', icon: ArrowUpFromLine },
      { label: 'Bank & Cash', path: '/accounting/bank-cash', icon: Landmark },
      { label: 'Fixed Assets', path: '/accounting/fixed-assets', icon: Building2 },
      { label: 'Manufacturing Accounting', path: '/accounting/manufacturing', icon: Factory },
      { label: 'GST & Tax', path: '/accounting/tax-compliance', icon: Receipt },
      ...TAX_COMPLIANCE_NAV.map((item) => ({
        label: item.label,
        path: item.path,
        icon: item.group === 'gst' ? FileSpreadsheet : Receipt,
        end: item.end,
        subNav: false as const,
      })),
      { label: 'Ledger Entries', path: '/accounting/ledger-entries', icon: ClipboardList },
      { label: 'Period Close', path: '/accounting/period-close', icon: CalendarCheck },
      { label: 'Setup', path: '/accounting/settings', icon: Settings2 },
    ],
  },
  {
    id: 'admin',
    title: 'Administration',
    items: [
      { label: 'Overview', path: '/admin', icon: LayoutDashboard, end: true, workspace: true },
      { label: 'Users', path: '/admin/users', icon: Users },
      { label: 'Roles', path: '/admin/roles', icon: ShieldCheck },
      { label: 'Invitations', path: '/admin/invitations', icon: UserPlus },
      { label: 'Responsibilities', path: '/admin/responsibilities', icon: ClipboardList },
      { label: 'Access Review', path: '/admin/access-review', icon: ClipboardList },
      { label: 'Login Activity', path: '/admin/security/login-activity', icon: ShieldAlert },
      { label: 'Active Sessions', path: '/admin/security/sessions', icon: KeyRound },
      { label: 'Locked Accounts', path: '/admin/security/locked-accounts', icon: Lock },
      { label: 'Admin Audit', path: '/admin/security/audit', icon: ClipboardList },
      { label: 'Organization Structure', path: '/admin/org-structure', icon: GitBranch },
      { label: 'Departments', path: '/admin/departments', icon: Layers },
      { label: 'Companies', path: '/admin/companies', icon: Building2 },
      { label: 'Branches', path: '/admin/branches', icon: Network },
      { label: 'Tenant Profile', path: '/admin/tenant-profile', icon: Building2 },
      { label: 'Module Access', path: '/admin/modules', icon: SlidersHorizontal },
    ],
  },
]

/** Platform Admin — Super Admin only (filtered in nav consumers). */
export const platformNavCategory: NavCategory = {
  id: 'platform',
  title: 'Platform',
  items: [
    { label: 'Platform Overview', path: '/platform', icon: LayoutDashboard, end: true },
    { label: 'Tenants', path: '/platform/tenants', icon: Building2 },
  ],
}

/** Flat list of all workspace landing pages — used for quick access / keyboard nav */
export const workspaceNav: NavItem[] = moduleCategories
  .flatMap((cat) => cat.items.filter((item) => item.workspace))

export type SearchablePage = NavItem & { category: string; keywords?: string }

/** All navigable pages indexed for global search and discovery audits */
export const searchablePages: SearchablePage[] = allNavCategories().flatMap((cat) =>
  cat.items
    .filter((item) => !item.disabled)
    .map((item) => ({
      ...item,
      category: cat.title,
      keywords: `${item.label} ${cat.title}`.toLowerCase(),
    })),
)

export function navItemIsActive(item: NavItem, pathname: string): boolean {
  if (item.disabled) return false
  return item.end ? pathname === item.path : pathname === item.path || pathname.startsWith(`${item.path}/`)
}

export function categoryIsActive(category: NavCategory, pathname: string): boolean {
  return category.items.some((item) => navItemIsActive(item, pathname))
}

export function getNavCategoryById(id: string): NavCategory | undefined {
  if (id === platformNavCategory.id) return platformNavCategory
  return moduleCategories.find((c) => c.id === id)
}

/** Workspace + platform categories (platform filtered in nav consumers for Super Admin). */
export function allNavCategories(): NavCategory[] {
  return [...moduleCategories, platformNavCategory]
}

export function findActiveCategoryId(pathname: string): string | null {
  if (pathname.startsWith('/platform')) return 'platform'
  if (pathname.startsWith('/entity360/customers')) return 'crm'
  if (pathname.startsWith('/sales/leads')) return 'crm'
  if (pathname.startsWith('/logistics')) return 'dispatch'
  if (pathname.startsWith('/masters') || pathname.startsWith('/settings/roles') || pathname.startsWith('/settings/permissions')) {
    return 'masters'
  }
  if (
    pathname.startsWith('/manufacturing/setup') ||
    pathname.startsWith('/manufacturing/profiles') ||
    pathname.startsWith('/manufacturing/work-centres') ||
    pathname.startsWith('/manufacturing/machines')
  ) {
    return 'production'
  }
  for (const cat of allNavCategories()) {
    if (categoryIsActive(cat, pathname)) return cat.id
  }
  return null
}

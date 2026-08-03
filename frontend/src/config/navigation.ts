import type { LucideIcon } from 'lucide-react'
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  BarChart3,
  BookOpen,
  CalendarCheck,
  CalendarDays,
  ClipboardList,
  FileSpreadsheet,
  FileText,
  GitBranch,
  GitCompare,
  Handshake,
  HardHat,
  Inbox,
  KeyRound,
  Landmark,
  Calculator,
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
  Wallet,
  Wrench,
  Clock,
  ShieldCheck,
  ScanLine,
  Target,
  TrendingUp,
  Layers,
  Cog,
  CircuitBoard,
  ShoppingBag,
  QrCode,
  Activity,
  LogOut,
  Banknote,
  UserCircle,
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
      { label: 'CEO Dashboard', path: '/executive', icon: BarChart3 },
      { label: 'Exception Centre', path: '/operations/exceptions', icon: ShieldAlert },
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
      { label: 'IndiaMART', path: '/crm/integrations/indiamart/dashboard', icon: Inbox, group: 'Integrations' },
    ],
  },
  {
    id: 'sales',
    title: 'Sales',
    items: [
      { label: 'Sales Dashboard', path: '/sales', icon: LayoutDashboard, end: true, workspace: true },
      { label: 'Quotation Approvals', path: '/sales/approvals', icon: Handshake },
      { label: 'Sales Orders', path: '/sales/orders', icon: ShoppingCart },
      { label: 'Proforma Invoices', path: '/sales/proforma-invoices', icon: Receipt },
      { label: 'Tax Invoices', path: '/sales/invoices', icon: Receipt },
      { label: 'Payment Allocation', path: '/sales/payment-allocation', icon: Wallet },
      { label: 'Company 360', path: '/sales/customers', icon: Building2 },
      { label: 'Order Status', path: '/sales/order-status', icon: ClipboardList },
      { label: 'Sales Reports', path: '/sales/reports', icon: BarChart3 },
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
      { label: 'Costing', path: '/inventory/costing', icon: Calculator },
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
    id: 'maintenance',
    title: 'Maintenance',
    items: [
      { label: 'Dashboard', path: '/maintenance', icon: LayoutDashboard, end: true, workspace: true },
      { label: 'Tickets', path: '/maintenance/tickets', icon: Wrench },
      { label: 'Preventive Maintenance', path: '/maintenance/preventive', icon: CalendarCheck },
      { label: 'Machine Health', path: '/maintenance/machine-health', icon: Activity },
      { label: 'Machine History', path: '/maintenance/machines', icon: Cog },
      { label: 'Reports', path: '/maintenance/reports', icon: BarChart3 },
      { label: 'Setup', path: '/maintenance/setup', icon: Settings2, group: 'Setup' },
    ],
  },
  {
    id: 'hrms',
    title: 'HRMS',
    items: [
      { label: 'Overview', path: '/hrms', icon: LayoutDashboard, end: true, workspace: true },
      { label: 'Employees', path: '/hrms/employees', icon: Users, group: 'People' },
      { label: 'Departments', path: '/admin/departments', icon: Layers, group: 'People' },
      { label: 'Designations', path: '/hrms/setup/designations', icon: Settings2, group: 'People' },
      { label: 'Attendance', path: '/hrms/attendance', icon: Clock, group: 'Time' },
      { label: 'Shifts', path: '/hrms/shifts', icon: Clock, group: 'Time' },
      { label: 'Roster', path: '/hrms/roster', icon: CalendarCheck, group: 'Time' },
      { label: 'Holidays', path: '/hrms/holidays', icon: CalendarDays, group: 'Time' },
      { label: 'My Leave', path: '/hrms/leave', icon: CalendarDays, group: 'Leave' },
      { label: 'Requests', path: '/hrms/leave/requests', icon: CalendarDays, group: 'Leave' },
      { label: 'Balances', path: '/hrms/leave/balances', icon: CalendarDays, group: 'Leave' },
      { label: 'OT Register', path: '/hrms/overtime', icon: Clock, group: 'Overtime' },
      { label: 'Payroll Runs', path: '/hrms/payroll/runs', icon: CalendarDays, group: 'Payroll' },
      { label: 'Payslips', path: '/hrms/payroll/payslips', icon: FileText, group: 'Payroll' },
      { label: 'Salary Structures', path: '/hrms/payroll/setup/structures', icon: Settings2, group: 'Payroll' },
      { label: 'Salary Components', path: '/hrms/payroll/setup/components', icon: Settings2, group: 'Payroll' },
      { label: 'Statutory', path: '/hrms/payroll/statutory', icon: Settings2, group: 'Payroll' },
      { label: 'Salary Payments', path: '/hrms/payroll/payments', icon: Banknote, group: 'Payroll' },
      { label: 'Loans & Advances', path: '/hrms/loans', icon: Wallet, group: 'Finance' },
      { label: 'Employee Exits', path: '/hrms/exits', icon: LogOut, group: 'Exit' },
      { label: 'Full & Final', path: '/hrms/fnf', icon: Banknote, group: 'Exit' },
      { label: 'HR Settings', path: '/hrms/setup', icon: Settings2, group: 'Setup' },
      { label: 'Leave Types', path: '/hrms/leave/types', icon: Settings2, group: 'Setup' },
      { label: 'My HR', path: '/hrms/my', icon: UserCircle, group: 'Self-service' },
      { label: 'My Payslips', path: '/hrms/payroll/my-payslips', icon: FileText, group: 'Self-service' },
      { label: 'My Loans', path: '/hrms/my-loans', icon: Wallet, group: 'Self-service' },
    ],
  },
  {
    id: 'dispatch',
    title: 'Logistics',
    items: [
      { label: 'Dispatch Workspace', path: '/dispatch', icon: LayoutDashboard, end: true, workspace: true },
      { label: 'Dispatch Register', path: '/dispatch/register', icon: ClipboardList },
      { label: 'Reports', path: '/dispatch/reports', icon: BarChart3 },
      { label: 'Settings', path: '/dispatch/settings', icon: Settings2 },
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
      { label: 'Expenses', path: '/accounting/expenses', icon: Wallet },
      { label: 'Bank & Cash', path: '/accounting/bank-cash', icon: Landmark },
      { label: 'Fixed Assets', path: '/accounting/fixed-assets', icon: Building2 },
      { label: 'Manufacturing Accounting', path: '/accounting/manufacturing', icon: Factory },
      { label: 'Inventory ↔ GL', path: '/accounting/inventory-gl-reconciliation', icon: GitCompare },
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
      { label: 'Tenant Profile', path: '/admin/organization/tenant', icon: Building2, group: 'Organization' },
      { label: 'Legal Entities & Branches', path: '/admin/organization', icon: GitBranch, end: true, group: 'Organization' },
      { label: 'Organization Structure', path: '/admin/org-structure', icon: GitBranch, group: 'Organization' },
      { label: 'Departments', path: '/admin/departments', icon: Layers, group: 'Organization' },
      { label: 'Companies', path: '/admin/companies', icon: Building2, group: 'Organization' },
      { label: 'Branches', path: '/admin/branches', icon: Network, group: 'Organization' },
      { label: 'Tenant Profile', path: '/admin/tenant-profile', icon: Building2, group: 'Organization', subNav: false },
      { label: 'Users', path: '/admin/users', icon: Users, end: true, group: 'People & Access' },
      { label: 'Roles', path: '/admin/roles', icon: ShieldCheck, group: 'People & Access' },
      { label: 'Invitations', path: '/admin/invitations', icon: UserPlus, group: 'People & Access' },
      { label: 'Responsibilities', path: '/admin/responsibilities', icon: ClipboardList, group: 'People & Access' },
      { label: 'Access Review', path: '/admin/access-review', icon: ClipboardList, group: 'People & Access' },
      { label: 'Login Activity', path: '/admin/security/login-activity', icon: ShieldAlert, group: 'Security' },
      { label: 'Active Sessions', path: '/admin/security/sessions', icon: KeyRound, group: 'Security' },
      { label: 'Locked Accounts', path: '/admin/security/locked-accounts', icon: Lock, group: 'Security' },
      { label: 'Admin Audit', path: '/admin/security/audit', icon: ClipboardList, group: 'Security' },
      { label: 'Module Access', path: '/admin/modules', icon: SlidersHorizontal, group: 'Platform' },
      /** Platform Super Admin only — filtered in moduleWorkspaceNav via canViewAdminNavItem */
      { label: 'Tenants', path: '/admin/tenants', icon: Building2, group: 'Platform' },
    ],
  },
  {
    id: 'reports',
    title: 'Analytics',
    items: [
      { label: 'Reports Hub', path: '/reports', icon: LayoutDashboard, end: true, workspace: true },
      { label: 'Stock Aging', path: '/reports/inventory/stock-aging', icon: Warehouse },
      { label: 'Negative Stock', path: '/reports/inventory/negative-stock', icon: Package },
      { label: 'Slow Moving', path: '/reports/inventory/slow-moving', icon: Clock },
      { label: 'Open PO', path: '/reports/purchase/open-po', icon: ShoppingCart },
      { label: 'Delayed PO', path: '/reports/purchase/delayed-po', icon: Truck },
      { label: 'WO Status', path: '/reports/production/wo-status', icon: Wrench },
      { label: 'WIP Aging', path: '/reports/production/wip-aging', icon: Factory },
      { label: 'NCR Aging', path: '/reports/quality/ncr-aging', icon: ShieldAlert },
      { label: 'Rework Trend', path: '/reports/quality/rework-trend', icon: RotateCcw },
      { label: 'Pending Dispatch', path: '/reports/dispatch/pending-dispatch', icon: Truck },
      { label: 'Open Orders', path: '/reports/sales/open-orders', icon: ShoppingBag },
      { label: 'Barcode Traceability', path: '/reports/traceability/barcode', icon: QrCode },
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
  // Lazy import avoided — packaging applied at call sites via getPackagedModuleCategories when needed.
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
  if (pathname.startsWith('/maintenance')) return 'maintenance'
  if (pathname.startsWith('/hrms')) return 'hrms'
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

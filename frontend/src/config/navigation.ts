import type { LucideIcon } from 'lucide-react'
import {
  AlertTriangle,
  ArrowDownToLine,
  ArrowUpFromLine,
  BarChart3,
  Bell,
  Bookmark,
  BookOpen,
  Calendar,
  CalendarCheck,
  ClipboardList,
  FileSpreadsheet,
  FileText,
  GitBranch,
  Handshake,
  Inbox,
  IndianRupee,
  Landmark,
  LayoutDashboard,
  Package,
  PackageCheck,
  Play,
  Factory,
  RotateCcw,
  Receipt,
  ShieldAlert,
  Settings2,
  ShoppingBag,
  ShoppingCart,
  SlidersHorizontal,
  Truck,
  Users,
  Building2,
  Warehouse,
  Wrench,
  Clock,
  ShieldCheck,
  QrCode,
  ScanLine,
  Target,
  TrendingUp,
  Layers,
} from 'lucide-react'

import { buildMasterNavItems } from './masterModuleStructure'
import { TAX_COMPLIANCE_NAV } from './taxComplianceNav'
import { BUDGETING_NAV } from './budgetingNav'
import { RECEIVABLES_NAV, RECEIVABLES_NAV_GROUP } from './receivablesNav'

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
      { label: 'Role Approvals', path: '/home/approvals', icon: ShieldCheck },
    ],
  },
  {
    id: 'masters',
    title: 'Master Data',
    items: buildMasterNavItems(),
  },
  {
    id: 'traceability',
    title: 'QR Traceability',
    items: [
      { label: 'QR Scanner', path: '/scan', icon: ScanLine, end: true, workspace: true },
      { label: 'Traceability 360', path: '/traceability', icon: GitBranch },
      { label: 'Trailer Genealogy', path: '/traceability/trailers', icon: Layers },
      { label: 'QR Registry', path: '/qr/registry', icon: QrCode },
    ],
  },
  {
    id: 'traceability-barcode',
    title: 'Barcode Traceability',
    items: [
      { label: 'Barcode Hub', path: '/barcode', icon: LayoutDashboard, end: true, workspace: true },
      { label: 'Barcode Generator', path: '/barcode/generator', icon: QrCode },
      { label: 'Print Labels', path: '/barcode/print', icon: PackageCheck },
      { label: 'Barcode History', path: '/barcode/history', icon: ClipboardList },
      { label: 'Traceability Report', path: '/barcode/trace', icon: BarChart3 },
    ],
  },
  {
    id: 'engineering',
    title: 'Engineering',
    items: [
      { label: 'Engineering Change', path: '/engineering/eco', icon: GitBranch, end: true, workspace: true },
      { label: 'BOM Master', path: '/engineering/bom', icon: Layers },
    ],
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
      { label: 'Quotation Templates', path: '/crm/quotation-templates', icon: Bookmark },
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
      { label: 'Proforma Invoices', path: '/sales/proforma-invoices', icon: Receipt },
      { label: 'Company 360', path: '/sales/customers', icon: Building2 },
      { label: 'Order Status', path: '/sales/order-status', icon: ClipboardList },
      { label: 'Run Planning', path: '/mrp/run', icon: Play },
      { label: 'Sales Reports', path: '/sales/reports', icon: BarChart3 },
    ],
  },
  {
    id: 'inventory',
    title: 'Inventory & Warehouse',
    items: [
      { label: 'Overview', path: '/inventory', icon: LayoutDashboard, end: true, workspace: true },
      { label: 'Items', path: '/inventory/items', icon: Package },
      { label: 'Stock', path: '/inventory/stock', icon: Warehouse },
      { label: 'Receipts', path: '/inventory/movements/receipts', icon: ArrowDownToLine },
      { label: 'Issues', path: '/inventory/movements/issues', icon: ArrowUpFromLine },
      { label: 'Transfers', path: '/inventory/movements/transfers', icon: GitBranch },
      { label: 'Adjustments', path: '/inventory/movements/adjustments', icon: SlidersHorizontal },
      { label: 'Returns', path: '/inventory/movements/returns', icon: RotateCcw },
      { label: 'Stock Count', path: '/inventory/stock-count', icon: ClipboardList },
      { label: 'Planning', path: '/inventory/planning', icon: Target },
      { label: 'Reports', path: '/inventory/reports', icon: BarChart3 },
      { label: 'Setup', path: '/inventory/setup', icon: Settings2 },
      /** Legacy routes — kept for bookmarks / deep links; hidden from workspace tabs */
      { label: 'Stock Ledger', path: '/inventory/ledger', icon: BookOpen, subNav: false },
      { label: 'Reservations', path: '/inventory/reservations', icon: Bookmark, subNav: false },
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
    id: 'mrp',
    title: 'Planning',
    items: [
      { label: 'Planning', path: '/mrp', icon: LayoutDashboard, end: true, workspace: true },
      { label: 'Run Planning', path: '/mrp/run', icon: Play },
    ],
  },
  {
    id: 'purchase',
    title: 'Procurement',
    items: [
      { label: 'Dashboard', path: '/purchase', icon: LayoutDashboard, end: true, workspace: true },
      { label: 'Approvals', path: '/purchase/approvals', icon: ShieldCheck },
      { label: 'PR', path: '/purchase/requisitions', icon: FileText, group: 'Procurement' },
      { label: 'Purchase Planning Sheet', path: '/purchase/planning-sheet', icon: ClipboardList, group: 'Procurement' },
      { label: 'RFQ', path: '/purchase/rfqs', icon: ShoppingCart, group: 'Procurement' },
      { label: 'Quote Comparison', path: '/purchase/comparison', icon: SlidersHorizontal, group: 'Procurement' },
      { label: 'Purchase Orders', path: '/purchase/orders', icon: Truck },
      { label: 'GRN', path: '/purchase/grn', icon: PackageCheck, group: 'Warehouse' },
      { label: 'Purchase Return', path: '/purchase/returns', icon: RotateCcw, group: 'Warehouse' },
      { label: 'Purchase Invoice', path: '/purchase/invoices', icon: Receipt, group: 'Accounts' },
      { label: 'Vendor Quotation', path: '/purchase/vendor-quotations', icon: Receipt, group: 'Vendors' },
      { label: 'Vendor Performance', path: '/purchase/vendor-performance', icon: TrendingUp, group: 'Vendors' },
      { label: 'Reports', path: '/purchase/reports', icon: BarChart3 },
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
      { label: 'BOM', path: '/manufacturing/bom', icon: Layers },
      { label: 'Routes', path: '/manufacturing/routes', icon: GitBranch },
      { label: 'Production Plan', path: '/manufacturing/production-plan', icon: ClipboardList },
      { label: 'Work Orders', path: '/manufacturing/work-orders', icon: Wrench },
      { label: 'Job Work', path: '/manufacturing/job-work', icon: Truck },
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
      { label: 'Dispatch Plan', path: '/dispatch/plan', icon: PackageCheck },
      { label: 'Scan Trailer', path: '/dispatch/scan/trailer', icon: ScanLine },
      { label: 'Scan Dispatch', path: '/dispatch/scan/dispatch', icon: ScanLine },
      { label: 'Reports', path: '/dispatch/reports', icon: BarChart3 },
    ],
  },
  {
    id: 'finance',
    title: 'Finance',
    items: [
      { label: 'Finance Workspace', path: '/invoices', icon: LayoutDashboard, end: true, workspace: true },
      { label: 'Invoice Register', path: '/invoices/register', icon: Receipt },
    ],
  },
  {
    id: 'accounting',
    title: 'Accounting',
    items: [
      { label: 'Dashboard', path: '/accounting', icon: LayoutDashboard, end: true, workspace: true },
      { label: 'Chart of Accounts', path: '/accounting/chart-of-accounts', icon: BookOpen },
      { label: 'Journals', path: '/accounting/entries/journals', icon: FileText },
      { label: 'Vouchers (demo)', path: '/accounting/vouchers', icon: FileText, subNav: false as const },
      /** Receivables workspace — DynamicsTabs dropdown group */
      ...RECEIVABLES_NAV.map((item) => ({
        label: item.label,
        path: item.path,
        icon:
          item.id === 'overview'
            ? LayoutDashboard
            : item.id === 'outstanding'
              ? Users
              : item.id === 'invoices'
                ? Receipt
                : item.id === 'ageing'
                  ? Clock
                  : item.id === 'collections'
                    ? ClipboardList
                    : item.id === 'receipts'
                      ? ArrowDownToLine
                      : item.id === 'allocations'
                        ? Layers
                        : item.id === 'credit-notes'
                          ? FileText
                          : item.id === 'disputes'
                            ? ShieldAlert
                            : Bell,
        end: item.end,
        group: RECEIVABLES_NAV_GROUP,
      })),
      /** API-backed Money In (Phase 3A) — discover via deep link / search */
      { label: 'Money In (API)', path: '/accounting/money-in', icon: ArrowDownToLine, subNav: false as const },
      {
        label: 'Commercial Commitments',
        path: '/accounting/commercial-commitments',
        icon: Handshake,
        subNav: false as const,
      },
      { label: 'Payables', path: '/accounting/payables', icon: ArrowUpFromLine },
      { label: 'Bank & Cash', path: '/accounting/bank-cash', icon: Landmark },
      { label: 'Fixed Assets', path: '/accounting/fixed-assets', icon: Building2 },
      { label: 'Manufacturing Accounting', path: '/accounting/manufacturing', icon: Factory },
      /** Parent tab in Accounting sub-nav — children listed below with subNav:false for titles/search */
      { label: 'GST & TDS', path: '/accounting/tax-compliance', icon: Receipt },
      ...TAX_COMPLIANCE_NAV.map((item) => ({
        label: item.label,
        path: item.path,
        icon:
          item.group === 'gst'
            ? FileSpreadsheet
            : item.group === 'tds' || item.group === 'tcs'
              ? IndianRupee
              : item.id === 'calendar'
                ? Calendar
                : item.id === 'notices' || item.id === 'exceptions'
                  ? AlertTriangle
                  : item.id === 'setup'
                    ? Settings2
                    : item.id === 'reports'
                      ? BarChart3
                      : Receipt,
        end: item.end,
        /** Hidden from Accounting Dynamics tabs — rendered in GST & TDS in-page tree */
        subNav: false as const,
      })),
      { label: 'Ledger Entries', path: '/accounting/ledger-entries', icon: ClipboardList },
      { label: 'Financial Reports', path: '/accounting/reports', icon: IndianRupee },
      /** Parent tab — children use subNav:false (in-page Budgeting tree) */
      { label: 'Budgeting & Forecasting', path: '/accounting/budgeting', icon: TrendingUp },
      ...BUDGETING_NAV.map((item) => ({
        label: item.label,
        path: item.path,
        icon:
          item.id === 'overview'
            ? LayoutDashboard
            : item.id === 'approvals'
              ? ShieldCheck
              : item.id === 'setup'
                ? Settings2
                : item.id === 'reports' || item.id === 'vs-actual' || item.id === 'rolling'
                  ? BarChart3
                  : item.id === 'cash-flow'
                    ? Landmark
                    : TrendingUp,
        end: item.end,
        subNav: false as const,
      })),
      { label: 'Period Close', path: '/accounting/period-close', icon: CalendarCheck },
      { label: 'Setup', path: '/accounting/settings', icon: Settings2 },
    ],
  },
  {
    id: 'admin',
    title: 'Administration',
    items: [
      { label: 'Users', path: '/admin/users', icon: Users, end: true, workspace: true },
      { label: 'Roles', path: '/admin/roles', icon: ShieldCheck },
      { label: 'Tenants', path: '/admin/tenants', icon: Building2 },
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

/** Flat list of all workspace landing pages — used for quick access / keyboard nav */
export const workspaceNav: NavItem[] = moduleCategories
  .flatMap((cat) => cat.items.filter((item) => item.workspace))

export type SearchablePage = NavItem & { category: string; keywords?: string }

/** All navigable pages indexed for global search and discovery audits */
export const searchablePages: SearchablePage[] = moduleCategories.flatMap((cat) =>
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

export function findActiveCategoryId(pathname: string): string | null {
  if (pathname.startsWith('/entity360/customers')) return 'crm'
  if (pathname.startsWith('/sales/leads')) return 'crm'
  if (pathname.startsWith('/masters') || pathname.startsWith('/settings/roles') || pathname.startsWith('/settings/permissions')) {
    return 'masters'
  }
  for (const cat of moduleCategories) {
    if (categoryIsActive(cat, pathname)) return cat.id
  }
  return null
}

import {
  BarChart3,
  Box,
  ClipboardList,
  Factory,
  FileText,
  Gauge,
  Inbox,
  Layers,
  Package,
  PackageCheck,
  Receipt,
  ShieldCheck,
  ShoppingCart,
  Truck,
  Warehouse,
  Wrench,
} from 'lucide-react'
import type { ExperienceRole, RoleExperienceDefinition } from '../types/roleExperience'
import { CONTROL_TOWER_ROUTES } from './controlTowerRoutes'

export const ROLE_HOME_ROUTES = {
  home: '/home',
  inbox: '/home/inbox',
  approvals: '/home/approvals',
} as const

const CEO: RoleExperienceDefinition = {
  role: 'ceo',
  title: 'CEO Command Center',
  tagline: 'Order book, cash, delivery risk, and plant health at a glance.',
  deepDashboardPath: CONTROL_TOWER_ROUTES.executive,
  deepDashboardLabel: 'Executive Dashboard',
  inboxModules: [],
  approvalModules: [],
  kpiIds: ['orderBook', 'invoiceValue', 'outstanding', 'delayedOrders', 'openNcr', 'dispatchPending'],
  shortcuts: [
    { label: 'Executive Dashboard', path: CONTROL_TOWER_ROUTES.executive, icon: BarChart3 },
    { label: 'Unified Inbox', path: ROLE_HOME_ROUTES.inbox, icon: Inbox },
    { label: 'Approvals', path: ROLE_HOME_ROUTES.approvals, icon: ShieldCheck },
    { label: 'Reports Hub', path: '/reports', icon: FileText },
    { label: 'Sales Orders', path: '/sales/orders', icon: ShoppingCart },
  ],
}

const COO: RoleExperienceDefinition = {
  role: 'coo',
  title: 'COO Operations Hub',
  tagline: 'Production flow, WIP, quality holds, and dispatch readiness.',
  deepDashboardPath: CONTROL_TOWER_ROUTES.production,
  deepDashboardLabel: 'Manufacturing Dashboard',
  inboxModules: ['Production', 'Shop Floor', 'Quality', 'Dispatch', 'Procurement'],
  approvalModules: ['Procurement', 'Engineering'],
  kpiIds: ['activeWo', 'lateWo', 'wipValue', 'qcPending', 'materialShortages', 'dispatchPending'],
  shortcuts: [
    { label: 'Manufacturing', path: '/manufacturing', icon: Factory },
    { label: 'Work Orders', path: '/manufacturing/work-orders', icon: Wrench },
    { label: 'Planning', path: '/mrp', icon: Gauge },
    { label: 'Dispatch Register', path: '/dispatch/register', icon: Truck },
    { label: 'Quality Queue', path: '/quality/queue', icon: ShieldCheck },
  ],
}

const ENGINEERING: RoleExperienceDefinition = {
  role: 'engineering',
  title: 'Engineering Workspace',
  tagline: 'Products, BOM revisions, routings, and document control.',
  inboxModules: ['Engineering', 'Procurement'],
  approvalModules: ['Engineering'],
  kpiIds: ['submittedBom', 'releasedProducts', 'openEco', 'pendingDrawings', 'routingDraft', 'costOverridePending'],
  shortcuts: [
    { label: 'Product Master', path: '/masters/products', icon: Box },
    { label: 'BOM Master', path: '/engineering/bom', icon: Layers },
    { label: 'Routing Master', path: '/masters/routing', icon: Factory },
    { label: 'Document Register', path: '/documents', icon: FileText },
    { label: 'Approval Workflow', path: '/masters/approval-workflows', icon: ShieldCheck },
  ],
}

const PLANNING: RoleExperienceDefinition = {
  role: 'planning',
  title: 'Planning',
  tagline: 'Check material needs, run planning, and see what to buy or make.',
  deepDashboardPath: '/mrp',
  deepDashboardLabel: 'Planning',
  inboxModules: ['Procurement', 'Production', 'Planning'],
  approvalModules: ['Procurement', 'Sales'],
  kpiIds: ['openSo', 'mrpShortages', 'expediteCount', 'delayedPo', 'woMaterialShort', 'activeWo'],
  shortcuts: [
    { label: 'Planning', path: '/mrp', icon: Gauge },
    { label: 'Run Planning', path: '/mrp/run', icon: ClipboardList },
    { label: 'Reservations', path: '/inventory/reservations', icon: Package },
    { label: 'Sales Orders', path: '/sales/orders', icon: ShoppingCart },
    { label: 'Work Orders', path: '/manufacturing/work-orders', icon: Wrench },
  ],
}

const PURCHASE: RoleExperienceDefinition = {
  role: 'purchase',
  title: 'Purchase Desk',
  tagline: 'PR queue, PO approvals, vendor performance, and GRN follow-up.',
  inboxModules: ['Procurement'],
  approvalModules: ['Procurement'],
  kpiIds: ['pendingPr', 'poApprovalPending', 'openPo', 'delayedPo', 'grnPending', 'vendorQuotes'],
  shortcuts: [
    { label: 'Purchase Workspace', path: '/purchase', icon: ShoppingCart },
    { label: 'Purchase Requisitions', path: '/purchase/requisitions', icon: ClipboardList },
    { label: 'Purchase Orders', path: '/purchase/orders', icon: FileText },
    { label: 'Goods Receipt Notes', path: '/purchase/grns', icon: PackageCheck },
    { label: 'Request for Quotations', path: '/purchase/rfqs', icon: Truck },
  ],
}

const STORES: RoleExperienceDefinition = {
  role: 'stores',
  title: 'Stores & Inventory',
  tagline: 'Receipts, issues, stock accuracy, and reservations.',
  inboxModules: ['Procurement', 'Production'],
  approvalModules: [],
  kpiIds: ['grnPending', 'openReservations', 'negativeStock', 'pendingIssues', 'slowMoving', 'qcIncoming'],
  shortcuts: [
    { label: 'Inventory Workspace', path: '/inventory', icon: Warehouse },
    { label: 'Store Workbench', path: '/manufacturing/store-workbench', icon: Package },
    { label: 'Material Inward', path: '/inventory/inward', icon: PackageCheck },
    { label: 'Material Issue', path: '/inventory/issue', icon: Package },
    { label: 'Stock Ledger', path: '/inventory/ledger', icon: ClipboardList },
    { label: 'Reservations', path: '/inventory/reservations', icon: Box },
  ],
}

const PRODUCTION: RoleExperienceDefinition = {
  role: 'production',
  title: 'Production Floor Hub',
  tagline: 'Active work orders, material readiness, and shop-floor queue.',
  deepDashboardPath: CONTROL_TOWER_ROUTES.production,
  deepDashboardLabel: 'Manufacturing Dashboard',
  inboxModules: ['Production', 'Shop Floor', 'Quality'],
  approvalModules: [],
  kpiIds: ['activeWo', 'runningWo', 'todayJobCards', 'qcHolds', 'lateWo', 'capacityUtil'],
  shortcuts: [
    { label: 'Manufacturing', path: '/manufacturing', icon: Factory },
    { label: 'Work Orders', path: '/manufacturing/work-orders', icon: FileText },
    { label: 'Production Plan', path: '/manufacturing/production-plan', icon: ClipboardList },
    { label: 'Shop Floor Queue', path: '/shop-floor', icon: Wrench },
    { label: 'BOM', path: '/manufacturing/bom', icon: Layers },
  ],
}

const QUALITY: RoleExperienceDefinition = {
  role: 'quality',
  title: 'Quality Command',
  tagline: 'Inspection queue, NCR aging, rework, and incoming material QC.',
  inboxModules: ['Quality'],
  approvalModules: [],
  kpiIds: ['qcPending', 'openNcr', 'openRework', 'incomingQc', 'finalQcHold', 'vendorNcr'],
  shortcuts: [
    { label: 'Quality Workspace', path: '/quality', icon: ShieldCheck },
    { label: 'QC Queue', path: '/quality/queue', icon: ClipboardList },
    { label: 'Incoming QC', path: '/quality/incoming', icon: PackageCheck },
    { label: 'NCR Register', path: '/quality/ncr', icon: FileText },
    { label: 'QC Parameters', path: '/quality/parameters', icon: Gauge },
  ],
}

const DISPATCH: RoleExperienceDefinition = {
  role: 'dispatch',
  title: 'Dispatch Control',
  tagline: 'Ready trailers, loading checklist, transport, and POD.',
  inboxModules: ['Dispatch'],
  approvalModules: ['Dispatch'],
  kpiIds: ['readyToDispatch', 'dispatchPending', 'loadingToday', 'podPending', 'inTransit', 'gatePassPending'],
  shortcuts: [
    { label: 'Dispatch Workspace', path: '/dispatch', icon: Truck },
    { label: 'Dispatch Register', path: '/dispatch/register', icon: ClipboardList },
    { label: 'Plan Dispatch', path: '/dispatch/plan', icon: FileText },
    { label: 'Pending Dispatch Report', path: '/reports/dispatch/pending-dispatch', icon: BarChart3 },
    { label: 'Invoices', path: '/invoices', icon: Receipt },
  ],
}

const ACCOUNTS: RoleExperienceDefinition = {
  role: 'accounts',
  title: 'Finance Desk',
  tagline: 'Invoicing, collections, cost overrides, and dispatch billing.',
  inboxModules: ['Finance', 'Procurement'],
  approvalModules: ['Finance', 'Procurement'],
  kpiIds: ['invoiceValue', 'outstanding', 'paymentPending', 'overdueInvoices', 'costOverridePending', 'dispatchUnbilled'],
  shortcuts: [
    { label: 'Finance Workspace', path: '/invoices', icon: Receipt },
    { label: 'Invoice Register', path: '/invoices/register', icon: FileText },
    { label: 'Costing Dashboard', path: '/costing', icon: BarChart3 },
    { label: 'Approvals', path: ROLE_HOME_ROUTES.approvals, icon: ShieldCheck },
    { label: 'Dispatch Register', path: '/dispatch/register', icon: Truck },
  ],
}

export const ROLE_EXPERIENCE_DEFINITIONS: Record<ExperienceRole, RoleExperienceDefinition> = {
  ceo: CEO,
  coo: COO,
  engineering: ENGINEERING,
  planning: PLANNING,
  purchase: PURCHASE,
  stores: STORES,
  production: PRODUCTION,
  quality: QUALITY,
  dispatch: DISPATCH,
  accounts: ACCOUNTS,
}

export function getRoleExperienceDefinition(role: ExperienceRole): RoleExperienceDefinition {
  return ROLE_EXPERIENCE_DEFINITIONS[role]
}

export const ALL_EXPERIENCE_ROLES = Object.keys(ROLE_EXPERIENCE_DEFINITIONS) as ExperienceRole[]

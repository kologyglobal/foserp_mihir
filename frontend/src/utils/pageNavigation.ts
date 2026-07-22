import type { BreadcrumbItem } from '../components/ui/Breadcrumbs'

const PAGE_LABELS: Record<string, string> = {
  '/': 'Executive Dashboard',
  '/executive': 'Executive Dashboard',
  '/inbox': 'Unified Inbox',
  '/inventory': 'Inventory Workspace',
  '/inventory/ledger': 'Stock Ledger',
  '/inventory/opening-stock': 'Opening Stock',
  '/inventory/inward': 'Material Inward',
  '/inventory/issue': 'Material Issue',
  '/inventory/adjustment': 'Stock Adjustment',
  '/inventory/reservations': 'Reservations',
  '/purchase': 'Purchase Workspace',
  '/purchase/requisitions': 'Requisitions (PR)',
  '/purchase/orders': 'Purchase Orders',
  '/purchase/grns': 'Gate Entry & GRN',
  '/purchase/grn': 'Gate Entry & GRN',
  '/purchase/rfqs': 'RFQs',
  '/purchase/reports': 'Purchase Reports',
  '/sales': 'Sales Workspace',
  '/sales/leads': 'Leads',
  '/sales/inquiries': 'Opportunities',
  '/sales/quotations': 'Quotations',
  '/crm/quotations': 'Quotations',
  '/sales/approvals': 'Quotation Approvals',
  '/sales/orders': 'Sales Orders',
  '/sales/customers': 'Company 360',
  '/work-orders': 'Work Order Register',
  '/work-orders/create-from-mrp': 'Create from MRP',
  '/production': 'Production Control Tower',
  '/production/control-tower': 'Production Control Tower',
  '/shop-floor': 'Shop Floor Job Queue',
  '/mrp': 'MRP Dashboard',
  '/mrp/planner': 'MRP Planner Workbench',
  '/mrp/workbench': 'MRP Planner Workbench',
  '/mrp/run': 'Run MRP',
  '/quality': 'Quality Workspace',
  '/quality/queue': 'QC Queue',
  '/dispatch': 'Dispatch Workspace',
  '/dispatch/register': 'Dispatch Register',
  '/dispatch/plan': 'Dispatch Plan',
  '/invoices': 'Finance Workspace',
  '/invoices/register': 'Invoice Register',
  '/masters': 'Master Data Overview',
  '/reports': 'Operational Reports',
  '/costing': 'Work Order Costing',
  '/barcode': 'Barcode Hub',
  '/barcode/master': 'Barcode Master',
  '/barcode/generator': 'Barcode Generator',
  '/barcode/print': 'Print Labels',
  '/barcode/history': 'Barcode History',
  '/barcode/trace': 'Barcode Traceability',
  '/crm': 'CRM Dashboard',
  '/crm/leads': 'Leads',
  '/crm/opportunities': 'Opportunities',
  '/crm/contacts': 'Contacts',
  '/crm/forecast': 'Sales Forecast',
  '/crm/companies': 'Companies',
  '/crm/customers': 'Companies',
  '/crm/sales-orders': 'CRM Sales Orders',
  '/crm/quotation-templates': 'Quotation Templates',
  '/scan': 'QR Scanner',
  '/traceability': 'Traceability 360',
  '/qr/registry': 'QR Registry',
}

const MODULE_HOME: Record<string, { label: string; to: string; group?: string }> = {
  inventory: { label: 'Inventory', to: '/inventory', group: 'Operations' },
  purchase: { label: 'Purchase', to: '/purchase', group: 'Procurement' },
  sales: { label: 'Sales', to: '/sales', group: 'Commercial' },
  mrp: { label: 'Planning', to: '/mrp', group: 'Planning' },
  inbox: { label: 'Executive', to: '/executive', group: 'Inbox' },
  production: { label: 'Production', to: '/production/control-tower', group: 'Shop Floor' },
  'work-orders': { label: 'Production', to: '/production/control-tower', group: 'Shop Floor' },
  quality: { label: 'Quality', to: '/quality', group: 'Quality Ops' },
  dispatch: { label: 'Dispatch', to: '/dispatch', group: 'Logistics' },
  invoices: { label: 'Finance', to: '/invoices', group: 'Finance' },
  masters: { label: 'Master Data', to: '/masters', group: 'Administration' },
  crm: { label: 'CRM', to: '/crm', group: 'CRM' },
  reports: { label: 'Analytics', to: '/reports', group: 'Reports' },
  costing: { label: 'Costing', to: '/costing', group: 'Shop Floor' },
}

export function getPageLabel(pathname: string): string {
  if (PAGE_LABELS[pathname]) return PAGE_LABELS[pathname]
  if (pathname.match(/\/work-orders\/[^/]+$/)) return 'Work Order Detail'
  if (pathname.match(/\/purchase\/orders\/[^/]+$/)) return 'Purchase Order'
  if (pathname.match(/\/sales\/orders\/[^/]+$/)) return 'Sales Order'
  if (pathname.match(/\/sales\/customers\/[^/]+\/360$/)) return 'Company 360'
  if (pathname.match(/\/purchase\/grns\/[^/]+$/)) return 'GRN Detail'
  if (pathname.match(/\/invoices\/[^/]+$/)) return 'Invoice Detail'
  if (pathname.match(/\/dispatch\/[^/]+$/)) return 'Dispatch Detail'
  if (pathname.startsWith('/masters/items')) return 'Item Master'
  if (pathname.startsWith('/masters/customers') || pathname.startsWith('/masters/companies')) return 'Company Master'
  if (pathname.startsWith('/masters/vendors')) return 'Vendor Master'
  if (pathname.startsWith('/masters/contacts')) return 'Contact Master'
  if (pathname.match(/\/crm\/leads\/[^/]+\/edit$/)) return 'Edit Lead'
  if (pathname.match(/\/crm\/leads\/[^/]+$/)) return 'Lead'
  if (pathname.match(/\/crm\/opportunities\/[^/]+\/edit$/)) return 'Edit Opportunity'
  if (pathname.match(/\/crm\/opportunities\/[^/]+$/)) return 'Opportunity'
  if (pathname.match(/\/crm\/contacts\/[^/]+\/edit$/)) return 'Edit Contact'
  if (pathname.match(/\/crm\/contacts\/[^/]+$/)) return 'Contact'
  if (pathname.match(/\/crm\/customers\/[^/]+\/edit$/)) return 'Edit Company'
  if (pathname.match(/\/crm\/customers\/[^/]+$/)) return 'Company'
  if (pathname.match(/\/crm\/quotations\/[^/]+\/edit$/)) return 'Edit Quotation'
  if (pathname.match(/\/crm\/quotations\/[^/]+$/)) return 'Quotation'
  if (pathname.match(/\/crm\/masters\/[^/]+\/[^/]+\/edit$/)) return 'Edit Master'
  if (pathname.match(/\/crm\/masters\/[^/]+\/[^/]+$/)) return 'CRM Master'
  if (pathname.match(/\/crm\/masters\/[^/]+$/)) return 'CRM Masters'
  const parts = pathname.split('/').filter(Boolean)
  if (parts.length === 0) return 'Home'
  const last = parts[parts.length - 1]
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(last)) {
    const parent = parts[parts.length - 2]
    if (parent) return parent.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
    return 'Record'
  }
  return last.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}

/** Home > Module > Group > Page — clickable ERP breadcrumbs */
export function buildRouteBreadcrumbs(pathname: string): BreadcrumbItem[] {
  const items: BreadcrumbItem[] = [{ label: 'Home', to: '/' }]

  if (pathname === '/' || pathname === '') return items

  const segments = pathname.split('/').filter(Boolean)
  const moduleKey = segments[0]
  const moduleMeta = MODULE_HOME[moduleKey]

  if (moduleMeta) {
    items.push({ label: moduleMeta.label, to: moduleMeta.to })
    if (moduleMeta.group && moduleMeta.group !== moduleMeta.label && segments.length > 1) {
      items.push({ label: moduleMeta.group, to: moduleMeta.to })
    }
  }

  const exactLabel = getPageLabel(pathname)
  const isModuleRoot = moduleMeta && pathname === moduleMeta.to

  if (!isModuleRoot) {
    items.push({ label: exactLabel })
  }

  return items
}

export const DEFAULT_SAVED_VIEWS = ['My View', 'Store Manager View', 'Production View', 'Finance View'] as const

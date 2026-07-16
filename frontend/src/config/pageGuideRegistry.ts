export interface PageGuideEntry {
  purpose: string
  nextStep: string
}

/** Route-prefix → user-facing page guide (longest prefix wins) */
const GUIDES: { prefix: string; guide: PageGuideEntry }[] = [
  { prefix: '/crm/guided-deal', guide: { purpose: 'Guided commercial flow — Lead → Qualify → Opportunity → Quote → Order.', nextStep: 'Complete the current step with minimum data, then Continue. Use header Quick create for fast capture.' } },
  { prefix: '/crm/leads', guide: { purpose: 'Lead register — Quick create captures the minimum; qualify when serious.', nextStep: 'Open a lead, use Guided deal, or convert a qualified lead.' } },
  { prefix: '/crm/opportunities', guide: { purpose: 'Opportunity pipeline — product lines can wait until the deal is serious.', nextStep: 'Use Pipeline, Follow-ups, or Activities; create a quotation when ready.' } },
  { prefix: '/crm/quotation-templates', guide: { purpose: 'Reusable technical-commercial quotation document templates by product family.', nextStep: 'Open a template to edit sections, or create a new template from ISO Tank or trailer bases.' } },
  { prefix: '/crm/quotations', guide: { purpose: 'Prepare editable customer quotations with revisions.', nextStep: 'Create or open a quotation, edit sections, then submit for approval.' } },
  { prefix: '/crm/sales-orders', guide: { purpose: 'CRM sales orders — create from quotation or directly when customer and items exist. Fulfilment, MRP, and dispatch live under Sales → Sales Orders.', nextStep: 'Use New Sales Order for a direct draft, or Create from Quotation for pipeline handover.' } },
  { prefix: '/crm/contacts', guide: { purpose: 'Maintain customer contact directory.', nextStep: 'Create contacts directly, or open Company 360 to manage related records.' } },
  { prefix: '/crm/customers', guide: { purpose: 'CRM companies — account relationships, pipeline, quotations, and activity. Operational receivables and order fulfilment use Sales → Companies.', nextStep: 'Create Company, Opportunity, Quotation, Follow-up, or Sales Order directly — funnel links are optional.' } },
  { prefix: '/crm', guide: { purpose: 'CRM command center — use header Quick create or Guided deal.', nextStep: 'Review open opportunities and due follow-ups.' } },
  { prefix: '/sales/customers', guide: { purpose: 'Sales company hub — commercial operations, receivables context, and order history by company. Pipeline and deal work stays in CRM → Companies.', nextStep: 'Open Company 360, or jump to CRM for opportunities and quotations.' } },
  { prefix: '/sales/orders', guide: { purpose: 'Sales order fulfilment — confirm orders, run MRP, production, and dispatch. CRM → Sales Orders supports direct create and quotation handover.', nextStep: 'Confirm an open SO, then run MRP for production planning.' } },
  { prefix: '/sales/proforma-invoices', guide: { purpose: 'Proforma invoices for advance billing before tax invoice.', nextStep: 'Create from sales order or direct, then issue to customer.' } },
  { prefix: '/sales/inquiries', guide: { purpose: 'Inquiries are now managed as Opportunities.', nextStep: 'Open Opportunities and create a quotation from there.' } },
  { prefix: '/sales', guide: { purpose: 'Sales workspace for orders, pipeline, and approvals.', nextStep: 'Open order status or pending approvals.' } },
  { prefix: '/mrp/run', guide: { purpose: 'Run material planning for a sales order.', nextStep: 'Select an order and run planning to see shortages and purchase needs.' } },
  { prefix: '/mrp', guide: { purpose: 'Planning hub — shortages, purchase needs, and order readiness.', nextStep: 'Run planning on an open sales order.' } },
  { prefix: '/purchase/requisitions', guide: { purpose: 'Purchase requisition created from demand (MRP / manual).', nextStep: 'Submit for requisition approval, then send RFQ to vendors or create PO.' } },
  { prefix: '/purchase/rfqs', guide: { purpose: 'RFQ sent to approved vendors and quote capture — create manually or from approved PR(s).', nextStep: 'Send RFQ, record vendor quotations, then run technical and commercial comparison.' } },
  { prefix: '/purchase/vendor-quotations', guide: { purpose: 'Vendor quotations received against RFQs.', nextStep: 'Open a quote, then compare and select vendor.' } },
  { prefix: '/purchase/comparison', guide: { purpose: 'Technical and commercial comparison to select a vendor.', nextStep: 'Rank quotes, select vendor, then create the purchase order.' } },
  { prefix: '/purchase/orders', guide: { purpose: 'Purchase orders — create, approve and release, then track delivery.', nextStep: 'Approve and release PO, await vendor confirmation, then record gate entry & GRN.' } },
  { prefix: '/purchase/grn', guide: { purpose: 'Gate entry and GRN — material delivered, QC, then accepted stock posted (demo).', nextStep: 'Post GRN, complete quality inspection if required. Invoice match and payment are Planned.' } },
  { prefix: '/purchase', guide: { purpose: 'Procurement lifecycle: Demand → PR → RFQ → Compare → PO → GRN → QC → stock. Invoice/payment Planned.', nextStep: 'Use the process map, or open awaiting PR approval / open POs.' } },
  { prefix: '/inventory/issue', guide: { purpose: 'Issue material to production or projects.', nextStep: 'Select item, warehouse, and quantity — save to post issue.' } },
  { prefix: '/inventory/adjustment', guide: { purpose: 'Stock adjustment requests with approval.', nextStep: 'Enter variance reason and submit for approval.' } },
  { prefix: '/inventory/ledger', guide: { purpose: 'Stock movement ledger across warehouses.', nextStep: 'Filter by item or open item stock detail.' } },
  { prefix: '/inventory', guide: { purpose: 'Inventory operations — inward, issue, transfer, count.', nextStep: 'Open stock ledger or material issue.' } },
  { prefix: '/manufacturing/bom', guide: { purpose: 'Manufacturing BOMs for make items.', nextStep: 'Open a BOM or create a new revision.' } },
  { prefix: '/manufacturing/production-plan', guide: { purpose: 'Plan production from sales orders or stock.', nextStep: 'Review planned lines and generate work orders when ready.' } },
  { prefix: '/manufacturing/work-orders', guide: { purpose: 'Simple work orders — select source, confirm quantity, complete inside the WO.', nextStep: 'Open a work order when Phase 4 lands; Job Cards are folded into this workspace.' } },
  { prefix: '/manufacturing/job-work', guide: { purpose: 'Subcontract send/receive under manufacturing.', nextStep: 'Use Job Work when Phase 5 is available.' } },
  { prefix: '/manufacturing', guide: { purpose: 'Manufacturing & Production hub — KPIs, open WOs, and quick actions.', nextStep: 'Open BOM, Production Plan, or Work Orders from the sub-nav.' } },
  { prefix: '/work-orders', guide: { purpose: 'Legacy work-order URLs redirect to Manufacturing › Work Orders.', nextStep: 'Use /manufacturing/work-orders for the simple manufacturing shell.' } },
  { prefix: '/job-cards', guide: { purpose: 'Job Cards are folded into Work Orders in simple manufacturing mode.', nextStep: 'Open Manufacturing › Work Orders.' } },
  { prefix: '/quality/queue', guide: { purpose: 'Pending QC inspections across incoming and in-process.', nextStep: 'Open next inspection and record pass/fail.' } },
  { prefix: '/quality/ncr', guide: { purpose: 'Non-conformance reports and rework tracking.', nextStep: 'Review open NCRs and assign rework.' } },
  { prefix: '/quality', guide: { purpose: 'Quality workspace for inspections and NCR.', nextStep: 'Open QC queue or incoming QC.' } },
  { prefix: '/dispatch', guide: { purpose: 'Dispatch planning, gate pass, and POD.', nextStep: 'Create dispatch plan after final QC and FG receipt.' } },
  { prefix: '/invoices', guide: { purpose: 'Tax invoices, receivables, and payments.', nextStep: 'Post invoice and record customer payment.' } },
  { prefix: '/engineering/eco', guide: { purpose: 'Engineering change orders — impact, approval, release.', nextStep: 'Create ECO from ECR or release approved change.' } },
  { prefix: '/engineering/bom', guide: { purpose: 'Bill of materials for trailer products.', nextStep: 'Open BOM 360 or create new BOM revision via ECO.' } },
  { prefix: '/masters/companies/new', guide: { purpose: 'Register a new company master record.', nextStep: 'Complete profile, address, and contact — then Save.' } },
  { prefix: '/masters/vendors/new', guide: { purpose: 'Register a new vendor for procurement.', nextStep: 'Enter vendor details and payment terms — then Save.' } },
  { prefix: '/masters', guide: { purpose: 'Master data hub for items, companies, vendors, products.', nextStep: 'Open the register you need to maintain.' } },
  { prefix: '/documents', guide: { purpose: 'Controlled document register with versions.', nextStep: 'Upload document or open approval queue.' } },
  { prefix: '/m/grn', guide: { purpose: 'Mobile GRN receipt at store gate.', nextStep: 'Scan PO/GRN and submit receipt.' } },
  { prefix: '/m/job-card', guide: { purpose: 'Mobile shop floor daily job card entry.', nextStep: 'Record actual quantity and hours, then Save Entry.' } },
  { prefix: '/m/qc', guide: { purpose: 'Mobile QC inspection at line.', nextStep: 'Complete checklist and submit pass or fail.' } },
  { prefix: '/m/dispatch', guide: { purpose: 'Mobile dispatch confirmation.', nextStep: 'Confirm loading and dispatch with scan.' } },
]

function matchGuide(pathname: string): PageGuideEntry | null {
  const path = pathname.split('?')[0].replace(/\/$/, '') || '/'
  let best: { prefix: string; guide: PageGuideEntry } | null = null
  for (const entry of GUIDES) {
    if (path === entry.prefix || path.startsWith(`${entry.prefix}/`)) {
      if (!best || entry.prefix.length > best.prefix.length) best = entry
    }
  }
  return best?.guide ?? null
}

/** Banner guides — CRM uses icon tip instead of persistent ErpPageGuide. */
export function resolvePageGuide(pathname: string): PageGuideEntry | null {
  const path = pathname.split('?')[0].replace(/\/$/, '') || '/'
  if (path === '/crm' || path.startsWith('/crm/')) return null
  // PR / PO / Invoice / GRN / Return create/edit: document header is enough; skip Purpose/Next-step banner
  if (
    path === '/purchase/requisitions/new' ||
    /^\/purchase\/requisitions\/[^/]+\/edit$/.test(path) ||
    path === '/purchase/orders/new' ||
    /^\/purchase\/orders\/[^/]+\/edit$/.test(path) ||
    path === '/purchase/invoices/new' ||
    /^\/purchase\/invoices\/[^/]+\/edit$/.test(path) ||
    path === '/purchase/grn/new' ||
    /^\/purchase\/grn\/[^/]+\/edit$/.test(path) ||
    path === '/purchase/returns/new' ||
    /^\/purchase\/returns\/[^/]+\/edit$/.test(path) ||
    path === '/purchase/rfqs/new' ||
    /^\/purchase\/rfqs\/[^/]+\/edit$/.test(path) ||
    path === '/purchase/vendor-quotations/new' ||
    /^\/purchase\/vendor-quotations\/[^/]+\/edit$/.test(path) ||
    /^\/purchase\/vendor-quotations\/[^/]+$/.test(path)
  ) {
    return null
  }
  return matchGuide(pathname)
}

/** CRM tip content from the same registry (CRM is excluded from banner resolve). */
export function resolveCrmPageGuide(pathname: string): PageGuideEntry | null {
  const path = pathname.split('?')[0].replace(/\/$/, '') || '/'
  if (path !== '/crm' && !path.startsWith('/crm/')) return null
  return matchGuide(pathname)
}

export const PAGE_GUIDE_COUNT = GUIDES.length

export const CRM_PAGE_TIP_FALLBACK: PageGuideEntry = {
  purpose: 'Use this CRM page to manage customers, pipeline, and follow-up work.',
  nextStep: 'Open a record or use the command bar to create the next action.',
}

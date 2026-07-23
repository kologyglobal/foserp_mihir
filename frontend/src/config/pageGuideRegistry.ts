export interface PageGuideEntry {
  purpose: string
  nextStep: string
}

/** Route-prefix → user-facing page guide (longest prefix wins) */
const GUIDES: { prefix: string; guide: PageGuideEntry }[] = [
  // —— Home / shell ——
  { prefix: '/home/inbox', guide: { purpose: 'Role inbox — items assigned to your persona.', nextStep: 'Open the next due item and complete the action.' } },
  { prefix: '/home', guide: { purpose: 'Personal home — shortcuts and work waiting on you.', nextStep: 'Open Inbox or jump to your primary module.' } },
  { prefix: '/executive', guide: { purpose: 'Executive dashboard — plant KPIs and exceptions.', nextStep: 'Drill into a KPI or open Unified Inbox for action items.' } },
  { prefix: '/inbox', guide: { purpose: 'Unified inbox across modules.', nextStep: 'Clear overdue items first, then open the linked document.' } },

  // —— CRM ——
  { prefix: '/crm/guided-deal', guide: { purpose: 'Guided commercial flow — Lead → Qualify → Opportunity → Quote → Order.', nextStep: 'Complete the current step with minimum data, then Continue. Use header Quick create for fast capture.' } },
  { prefix: '/crm/leads', guide: { purpose: 'Lead register — Quick create captures the minimum; qualify when serious.', nextStep: 'Open a lead, use Guided deal, or convert a qualified lead.' } },
  { prefix: '/crm/opportunities', guide: { purpose: 'Opportunity pipeline — product lines can wait until the deal is serious.', nextStep: 'Use Pipeline, Follow-ups, or Activities; create a quotation when ready.' } },
  { prefix: '/crm/quotation-templates', guide: { purpose: 'Reusable technical-commercial quotation document templates by product family.', nextStep: 'Open a template to edit sections, or create a new template from ISO Tank or trailer bases.' } },
  { prefix: '/crm/quotations', guide: { purpose: 'Prepare editable customer quotations with revisions.', nextStep: 'Create or open a quotation, edit sections, then submit for approval.' } },
  { prefix: '/crm/sales-orders', guide: { purpose: 'CRM sales orders — create from quotation or directly when customer and items exist. Fulfilment, MRP, and dispatch live under Sales → Sales Orders.', nextStep: 'Use New Sales Order for a direct draft, or Create from Quotation for pipeline handover.' } },
  { prefix: '/crm/contacts', guide: { purpose: 'Maintain customer contact directory.', nextStep: 'Create contacts directly, or open Company 360 to manage related records.' } },
  { prefix: '/crm/companies', guide: { purpose: 'CRM companies — account relationships, pipeline, quotations, and activity. Operational receivables and order fulfilment use Sales → Companies.', nextStep: 'Create Company, Opportunity, Quotation, Follow-up, or Sales Order directly — funnel links are optional.' } },
  { prefix: '/crm/customers', guide: { purpose: 'CRM companies — account relationships, pipeline, quotations, and activity. Operational receivables and order fulfilment use Sales → Companies.', nextStep: 'Create Company, Opportunity, Quotation, Follow-up, or Sales Order directly — funnel links are optional.' } },
  { prefix: '/crm/forecast', guide: { purpose: 'Sales forecast by territory and period.', nextStep: 'Review pipeline coverage, then adjust opportunity stages or owners.' } },
  { prefix: '/crm/reports', guide: { purpose: 'CRM operational reports — pipeline, conversion, and activity.', nextStep: 'Pick a report, set filters, then export if needed.' } },
  { prefix: '/crm/masters', guide: { purpose: 'CRM reference masters — territories, stages, commercial terms, and more.', nextStep: 'Open the register you need; shared masters may redirect to Master Data.' } },
  { prefix: '/crm', guide: { purpose: 'CRM command center — use header Quick create or Guided deal.', nextStep: 'Review open opportunities and due follow-ups.' } },

  // —— Sales ——
  { prefix: '/sales/customers', guide: { purpose: 'Sales company hub — commercial operations, receivables context, and order history by company. Pipeline and deal work stays in CRM → Companies.', nextStep: 'Open Company 360, or jump to CRM for opportunities and quotations.' } },
  { prefix: '/sales/orders', guide: { purpose: 'Sales order fulfilment — confirm orders, run MRP, production, and dispatch. CRM → Sales Orders supports direct create and quotation handover.', nextStep: 'Confirm an open SO, then open Manufacturing for production planning.' } },
  { prefix: '/sales/inquiries', guide: { purpose: 'Inquiries are now managed as Opportunities.', nextStep: 'Open Opportunities and create a quotation from there.' } },
  { prefix: '/sales', guide: { purpose: 'Sales workspace for orders and company 360.', nextStep: 'Open Sales Orders or Company 360.' } },

  // —— Purchase ——
  { prefix: '/purchase/planning-sheet', guide: { purpose: 'Purchase Planning Sheet for approved PRs where RFQ is not required — one row per item for vendor selection and direct PO.', nextStep: 'Assign buyer, select vendor, approve, then Create Purchase Order when net qty and rate are ready.' } },
  { prefix: '/purchase/requisitions', guide: { purpose: 'Purchase requisition demand capture with Complete worksheet (item, qty, required date, rate, vendor, order date, customer).', nextStep: 'Submit for requisition approval, then send RFQ to vendors or create PO.' } },
  { prefix: '/purchase/rfqs', guide: { purpose: 'RFQ sent to approved vendors and quote capture — create manually or from approved PR(s).', nextStep: 'Send RFQ, record vendor quotations, then run technical and commercial comparison.' } },
  { prefix: '/purchase/vendor-quotations', guide: { purpose: 'Vendor quotations received against RFQs.', nextStep: 'Open a quote, then compare and select vendor.' } },
  { prefix: '/purchase/comparison', guide: { purpose: 'Technical and commercial comparison to select a vendor.', nextStep: 'Rank quotes, select vendor, then create the purchase order.' } },
  { prefix: '/purchase/orders', guide: { purpose: 'Purchase orders — create, approve and release, then track delivery.', nextStep: 'Approve and release PO, await vendor confirmation, then record gate entry & GRN.' } },
  { prefix: '/purchase/grn', guide: { purpose: 'Gate entry and GRN — material delivered, QC, then accepted stock posted (demo).', nextStep: 'Post GRN, complete quality inspection if required. Invoice match and payment are Planned.' } },
  { prefix: '/purchase/returns', guide: { purpose: 'Vendor material returns — draft, approve, and post return challans (demo).', nextStep: 'Create a return from GRN/QC, submit for approval, then post.' } },
  { prefix: '/purchase/invoices', guide: { purpose: 'Purchase invoices — match to PO/GRN, verify, and send for approval (demo).', nextStep: 'Save draft, verify match, then submit for approval.' } },
  { prefix: '/purchase/approvals', guide: { purpose: 'Approval queue for purchase documents awaiting your decision.', nextStep: 'Open a row to review, then Approve, Reject, Send Back, or Delegate.' } },
  { prefix: '/purchase/vendor-performance', guide: { purpose: 'Vendor scorecards — delivery, quality, and commercial performance.', nextStep: 'Filter by vendor and review trends before the next RFQ.' } },
  { prefix: '/purchase/reports', guide: { purpose: 'Purchase reports and analytics — operational and vendor performance (demo).', nextStep: 'Open a report category and run the register you need.' } },
  { prefix: '/purchase/masters', guide: { purpose: 'Purchase masters — vendors, items, terms, QC rules, and receiving setup.', nextStep: 'Open a register to maintain values used across procurement.' } },
  { prefix: '/purchase/setup', guide: { purpose: 'Purchase setup — approval matrix and process defaults (demo).', nextStep: 'Review approval roles and thresholds, then return to the queue.' } },
  { prefix: '/purchase', guide: { purpose: 'Procurement lifecycle: Demand → PR → RFQ → Compare → PO → GRN → QC → stock. Invoice/payment Planned.', nextStep: 'Use the process map, or open awaiting PR approval / open POs.' } },

  // —— Inventory ——
  { prefix: '/inventory/items', guide: { purpose: 'Inventory item browse — engineering items live under Master Data → Items.', nextStep: 'Open an item or jump to Master Data for full CRUD.' } },
  { prefix: '/inventory/stock', guide: { purpose: 'Stock availability by warehouse and location.', nextStep: 'Filter by item or warehouse, then drill into ledger.' } },
  { prefix: '/inventory/movements', guide: { purpose: 'Inventory movements — receipts, issues, transfers, adjustments, returns.', nextStep: 'Open the movement type you need and post a document.' } },
  { prefix: '/inventory/stock-count', guide: { purpose: 'Physical stock count and variance posting.', nextStep: 'Start a count, enter quantities, then post variances.' } },
  { prefix: '/inventory/planning', guide: { purpose: 'Inventory planning signals — reorder and shortage context.', nextStep: 'Review shortages and create purchase demand if needed.' } },
  { prefix: '/inventory/accounting', guide: { purpose: 'Inventory GL event trail for GRN, adjustments, and FG dispatch (flag-gated).', nextStep: 'Review event status; enable INVENTORY_ACCOUNTING when mappings are ready.' } },
  { prefix: '/inventory/issue', guide: { purpose: 'Issue material to production or projects.', nextStep: 'Select item, warehouse, and quantity — save to post issue.' } },
  { prefix: '/inventory/adjustment', guide: { purpose: 'Stock adjustment requests with approval.', nextStep: 'Enter variance reason and submit for approval.' } },
  { prefix: '/inventory/ledger', guide: { purpose: 'Stock movement ledger across warehouses.', nextStep: 'Filter by item or open item stock detail.' } },
  { prefix: '/inventory/opening-stock', guide: { purpose: 'Opening stock entry for go-live balances.', nextStep: 'Enter quantities by warehouse, then post opening.' } },
  { prefix: '/inventory/inward', guide: { purpose: 'Material inward outside the purchase GRN flow.', nextStep: 'Create an inward document and post to stock.' } },
  { prefix: '/inventory/reservations', guide: { purpose: 'Stock reservations against sales or production demand.', nextStep: 'Review soft allocations and release unused holds.' } },
  { prefix: '/inventory/reports', guide: { purpose: 'Inventory reports — valuation, ageing, and movement.', nextStep: 'Select a report and set warehouse / period filters.' } },
  { prefix: '/inventory/setup', guide: { purpose: 'Inventory module setup.', nextStep: 'Confirm warehouses, locations, and posting defaults.' } },
  { prefix: '/inventory', guide: { purpose: 'Inventory operations — inward, issue, transfer, count.', nextStep: 'Open stock ledger or material issue.' } },

  // —— Manufacturing ——
  { prefix: '/manufacturing/bom', guide: { purpose: 'BOM tells what is needed — recipes Work Orders consume.', nextStep: 'Activate a BOM, then create or open a Work Order.' } },
  { prefix: '/manufacturing/routes', guide: { purpose: 'Route Master — reusable process template attached to Finished Item / BOM. Create once; Work Orders snapshot the active route.', nextStep: 'Activate a route, then create a Work Order — stages copy automatically. Do not rebuild operations on each WO.' } },
  { prefix: '/manufacturing/production-plan', guide: { purpose: 'Production Plan tells what to make — then generates Work Orders.', nextStep: 'Review lines and Generate Work Orders when ready.' } },
  { prefix: '/manufacturing/work-orders', guide: { purpose: 'Work Order is the only execution document. Enter Item + Qty; BOM, materials, and Route stages auto-fill as a snapshot.', nextStep: 'Review Route Operations on create, then open the Operations tab to execute stages.' } },
  { prefix: '/manufacturing/shopfloor', guide: { purpose: 'Shopfloor View — live visibility of Work Orders with current/next operation (not a separate posting document).', nextStep: 'Start, hold, complete, or open a Work Order card.' } },
  { prefix: '/manufacturing/job-work', guide: { purpose: 'Job Work handles outside processing linked to a Work Order.', nextStep: 'Create Job Work from a WO, then send / receive / reconcile.' } },
  { prefix: '/manufacturing/reports', guide: { purpose: 'Reports show production performance across Work Orders.', nextStep: 'Open a report card, filter, export or print.' } },
  { prefix: '/manufacturing/settings', guide: { purpose: 'Settings control complexity — keep Advanced off for simple mode.', nextStep: 'Review Quick Mode and Auto Consumption defaults.' } },
  { prefix: '/manufacturing/control-room', guide: { purpose: 'Owner / manager Production Control Room — today\'s plan, running WOs, shortages, QC, delays, job work.', nextStep: 'Click a WO to execute; use Fulfilment for Produce → Dispatch coach; use Accept/Reject/Rework for QC pending.' } },
  { prefix: '/manufacturing/guided-fulfilment', guide: { purpose: 'Guided Fulfilment — Produce → Quality → Stock → Dispatch. Progress stored in ?step= (like Guided Deal).', nextStep: 'Open the linked WO, Store workbench, or Dispatch workbench for the current step.' } },
  { prefix: '/manufacturing', guide: { purpose: 'Simple manufacturing: BOM → Plan → Work Order → Start/Hold/Complete/QC/Close → Shopfloor + Reports. Not Job Card / Material Issue / FG Receipt chains.', nextStep: 'Open Work Orders to execute, or Control Room for manager attention.' } },
  { prefix: '/work-orders', guide: { purpose: 'Legacy work-order URLs redirect to Manufacturing › Work Orders.', nextStep: 'Use /manufacturing/work-orders.' } },
  { prefix: '/job-cards', guide: { purpose: 'Job Cards are not used — actions live on the Work Order.', nextStep: 'Open Manufacturing › Work Orders.' } },
  { prefix: '/production', guide: { purpose: 'Production control tower — legacy production views.', nextStep: 'Prefer Manufacturing › Control Room for day-to-day execution.' } },

  // —— Quality ——
  { prefix: '/quality/queue', guide: { purpose: 'Pending QC inspections across incoming and in-process.', nextStep: 'Open next inspection and record pass/fail.' } },
  { prefix: '/quality/ncr', guide: { purpose: 'Non-conformance reports and rework tracking.', nextStep: 'Review open NCRs and assign rework.' } },
  { prefix: '/quality', guide: { purpose: 'Quality workspace for inspections and NCR.', nextStep: 'Open QC queue or incoming QC.' } },

  // —— Dispatch ——
  { prefix: '/dispatch', guide: { purpose: 'Dispatch planning and fulfilment workbench.', nextStep: 'Open the register or plan, then work from the dispatch workbench.' } },

  // —— Engineering / BOM ——
  { prefix: '/manufacturing/setup/boms', guide: { purpose: 'Manufacturing BOMs and versions used when creating work orders.', nextStep: 'Create or activate a BOM version, then link it on the manufacturing profile.' } },

  // —— Master Data ——
  { prefix: '/masters/companies/new', guide: { purpose: 'Register a new company master record.', nextStep: 'Complete profile, address, and contact — then Save.' } },
  { prefix: '/masters/companies', guide: { purpose: 'Company Master — legal entities, GSTIN, and commercial parties.', nextStep: 'Create or open a company; use 360 for relationships and activity.' } },
  { prefix: '/masters/vendors/new', guide: { purpose: 'Register a new vendor for procurement.', nextStep: 'Enter vendor details and payment terms — then Save.' } },
  { prefix: '/masters/vendors', guide: { purpose: 'Vendor Master — suppliers and service vendors.', nextStep: 'Create or open a vendor; keep GSTIN and payment terms current.' } },
  { prefix: '/masters/items', guide: { purpose: 'Item Master — RM, BO, SA, FG engineering items.', nextStep: 'Create or edit an item; link HSN, UOM, and category.' } },
  { prefix: '/masters/products', guide: { purpose: 'Product Master — finished goods and trailer variants.', nextStep: 'Maintain sellable products and link to FG items.' } },
  { prefix: '/masters/users', guide: { purpose: 'User Management — CRM owners and assignment identities.', nextStep: 'Create or edit a user, then assign territory and role context.' } },
  { prefix: '/masters/roles', guide: { purpose: 'Role Master — ERP role catalogue.', nextStep: 'Review roles, then open Role Permission Matrix to see effective rights.' } },
  { prefix: '/masters/role-permissions', guide: { purpose: 'Role Permission Matrix — role × module × action.', nextStep: 'Review matrix coverage; code changes live in permissionMatrix.ts until AuthModule ships.' } },
  { prefix: '/masters/contacts', guide: { purpose: 'Contact Master — people linked to companies.', nextStep: 'Create a contact or open Company 360 to manage related people.' } },
  { prefix: '/masters/uom', guide: { purpose: 'Unit of Measure Master.', nextStep: 'Add or activate UOMs used on items and documents.' } },
  { prefix: '/masters/warehouses', guide: { purpose: 'Warehouse Master — storage sites.', nextStep: 'Maintain RM/WIP/FG warehouses used by inventory and GRN.' } },
  { prefix: '/masters/locations', guide: { purpose: 'Location Master — BC-style document locations.', nextStep: 'Keep locations aligned with warehouses for stock documents.' } },
  { prefix: '/masters/hsn', guide: { purpose: 'HSN Master — tax nomenclature codes.', nextStep: 'Assign HSN on items; keep GST group links accurate.' } },
  { prefix: '/masters/gst-groups', guide: { purpose: 'GST Group Code Master.', nextStep: 'Maintain groups used by items and rate slabs.' } },
  { prefix: '/masters/gst-rates', guide: { purpose: 'GST Rate Master — SGST/CGST/IGST slabs.', nextStep: 'Keep rates current for the active financial year.' } },
  { prefix: '/masters/code-series', guide: { purpose: 'Code / Number Series Master.', nextStep: 'Configure prefixes and running numbers for documents and masters.' } },
  { prefix: '/manufacturing/setup', guide: { purpose: 'Manufacturing setup — profiles, BOMs, routings, work centres.', nextStep: 'Configure BOM and routing before releasing a work order.' } },
  { prefix: '/masters/payment-terms', guide: { purpose: 'Payment Terms Master — shared with CRM and purchase.', nextStep: 'Create or edit terms used on quotations, SO, and PO.' } },
  { prefix: '/masters', guide: { purpose: 'Master data hub for items, companies, vendors, products.', nextStep: 'Open the register you need to maintain.' } },

  // —— Accounting / Finance ——
  { prefix: '/accounting/settings', guide: { purpose: 'Finance setup — legal entities, years, periods, CoA, mappings, and approval rules.', nextStep: 'Complete the setup wizard, then open Chart of Accounts or periods.' } },
  { prefix: '/settings/organisation', guide: { purpose: 'Organisation foundation — legal entity, tax registrations, CoA, mappings, fiscal years, and posting periods.', nextStep: 'Confirm GST registration and active fiscal year, then review account mappings.' } },
  { prefix: '/accounting/settings/chart-of-accounts', guide: { purpose: 'Chart of Accounts for the active legal entity.', nextStep: 'Create or open an account; keep postable leaves for journals.' } },
  { prefix: '/accounting/entries/journals', guide: { purpose: 'Manual journals and accounting entries register.', nextStep: 'Create a journal, balance lines, then post when ready.' } },
  { prefix: '/accounting/money-in', guide: { purpose: 'Money In — sales invoices, outstanding, ageing, and AR-to-GL reconciliation.', nextStep: 'Create a draft invoice or review ready-to-post items.' } },
  { prefix: '/accounting/money-out', guide: { purpose: 'Money Out — vendor invoices, payments, ageing, and AP close gate.', nextStep: 'Create a vendor invoice or review payment planning.' } },
  { prefix: '/accounting/bank-cash', guide: { purpose: 'Bank & Cash — live API for internal UAT / controlled pilot (liquidity, statements, transfers, recon). AIS / FX / intercompany deferred.', nextStep: 'Import a statement or open reconciliation. Use connectors for sandbox/REST/SFTP only — not AIS pull.' } },
  { prefix: '/accounting/fixed-assets', guide: { purpose: 'Fixed assets register, depreciation, and disposal.', nextStep: 'Open the register or run the depreciation workbench.' } },
  { prefix: '/accounting/manufacturing', guide: { purpose: 'Manufacturing accounting workspace — WIP and production cost events.', nextStep: 'Review unposted events or open Work Order costing.' } },
  { prefix: '/accounting/tax-compliance', guide: { purpose: 'GST extract, e-invoice, and e-way bill registers.', nextStep: 'Open outward/inward supplies or e-invoice / e-way.' } },
  { prefix: '/accounting/ledger-entries', guide: { purpose: 'Posted ledger entries and drill-down ledgers.', nextStep: 'Filter by account, voucher, or party.' } },
  { prefix: '/accounting', guide: { purpose: 'Finance & accounting workspace.', nextStep: 'Open Money In / Money Out, journals, or CoA.' } },

  // —— Mobile ——
  { prefix: '/m/grn', guide: { purpose: 'Mobile GRN receipt at store gate.', nextStep: 'Scan PO/GRN and submit receipt.' } },
  { prefix: '/m/qc', guide: { purpose: 'Mobile QC inspection at line.', nextStep: 'Complete checklist and submit pass or fail.' } },
  { prefix: '/m/dispatch', guide: { purpose: 'Mobile dispatch confirmation.', nextStep: 'Confirm loading and dispatch.' } },
  { prefix: '/m', guide: { purpose: 'Mobile operational apps.', nextStep: 'Pick GRN, QC, dispatch, or CRM for the current task.' } },

  // —— Settings / reports / platform ——
  { prefix: '/settings', guide: { purpose: 'System settings and organisation setup.', nextStep: 'Open Organisation Setup or Role Permission Matrix.' } },
  { prefix: '/reports/crm', guide: { purpose: 'CRM operational reports.', nextStep: 'Pick a report and apply filters.' } },
  { prefix: '/admin/invitations', guide: { purpose: 'Invite users and track open invitations.', nextStep: 'Share the invite link; acceptants set a password on /login?invite=…' } },
  { prefix: '/admin/departments', guide: { purpose: 'Department master for people admin (IAM org units).', nextStep: 'Create departments, then assign them on Users.' } },
  { prefix: '/admin/responsibilities', guide: { purpose: 'Cross-module responsibility catalog and ownership labels.', nextStep: 'Assign responsibilities on a user detail page; do not rebuild approval engines here.' } },
  { prefix: '/admin/access-review', guide: { purpose: 'Live access review of users needing attention (roles, sensitive perms, scopes).', nextStep: 'Open a flagged user and use Effective Access to explain grants.' } },
  { prefix: '/admin/security/login-activity', guide: { purpose: 'Review successful and failed sign-ins.', nextStep: 'Investigate failures; unlock accounts under Locked Accounts if auto-locked.' } },
  { prefix: '/admin/security/sessions', guide: { purpose: 'Tenant-wide active refresh-token sessions.', nextStep: 'Revoke a device session or open the user to revoke all.' } },
  { prefix: '/admin/security/locked-accounts', guide: { purpose: 'Users with BLOCKED status (admin lock or failed-login lockout).', nextStep: 'Unlock to restore ACTIVE and clear the failure counter.' } },
  { prefix: '/admin/modules', guide: { purpose: 'Enable or disable workspace modules for this tenant (missing flags default to enabled).', nextStep: 'Disable only unused modules; manage permissions on Roles.' } },
  { prefix: '/admin/org-structure', guide: { purpose: 'Read-only Legal Entity → Branch map with department/warehouse links.', nextStep: 'Open Companies or Branches to manage masters.' } },
  { prefix: '/admin/security/audit', guide: { purpose: 'IAM and security AuditLog register for this tenant.', nextStep: 'Filter by module, then open the related Admin register if action is needed.' } },
  { prefix: '/admin/tenant-profile', guide: { purpose: 'Workspace tenant profile — name, contact, timezone, currency.', nextStep: 'Save profile, then open Companies for legal entities.' } },
  { prefix: '/admin/companies', guide: { purpose: 'Companies hub over Legal Entity organisation APIs.', nextStep: 'Open Organisation Setup to create or edit an entity.' } },
  { prefix: '/admin/branches', guide: { purpose: 'Branches hub over finance Branch APIs.', nextStep: 'Manage create/activate under Accounting → Branches.' } },
  { prefix: '/admin', guide: { purpose: 'Administration — Dynamics chrome aligned with CRM/Accounting. People, organisation, and security.', nextStep: 'Use workspace tabs or Invite User from the command bar.' } },
  { prefix: '/admin/users', guide: { purpose: 'Manage tenant users and role assignments.', nextStep: 'Open a user to assign roles or check status.' } },
  { prefix: '/admin/roles', guide: { purpose: 'Define roles with the guided Role Builder and permission matrix.', nextStep: 'Walk Identity → Modules → Sensitive review, then save.' } },
  { prefix: '/admin/tenants', guide: { purpose: 'Legacy tenants path — redirects to Platform Tenants.', nextStep: 'Use /platform/tenants (Super Admin).' } },
  { prefix: '/platform/tenants', guide: { purpose: 'Platform Super Admin tenant workspaces and subscriptions.', nextStep: 'Create a tenant or open one to edit status and plan.' } },
  { prefix: '/platform', guide: { purpose: 'Platform Admin home for Super Admins (tenant.manage).', nextStep: 'Open Tenants to manage workspaces across the platform.' } },
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

/**
 * Legacy banner resolver — returns null so Purpose/Next step uses the header tip only
 * (same UX as CRM on every page).
 */
export function resolvePageGuide(_pathname: string): PageGuideEntry | null {
  return null
}

/** Page tip content for any app route (longest prefix in registry, else fallback). */
export function resolvePageTipGuide(pathname: string): PageGuideEntry | null {
  return matchGuide(pathname)
}

/** @deprecated Use resolvePageTipGuide — CRM tip is now system-wide. */
export function resolveCrmPageGuide(pathname: string): PageGuideEntry | null {
  return resolvePageTipGuide(pathname)
}

/** Purchase tip content from the same registry. */
export function resolvePurchasePageGuide(pathname: string): PageGuideEntry | null {
  const path = pathname.split('?')[0].replace(/\/$/, '') || '/'
  if (path !== '/purchase' && !path.startsWith('/purchase/')) return null
  return matchGuide(pathname)
}

export const PAGE_GUIDE_COUNT = GUIDES.length

export const PAGE_TIP_FALLBACK: PageGuideEntry = {
  purpose: 'Use this page to complete the next step in your ERP workflow.',
  nextStep: 'Open a record from the list, or use the command bar to create or continue.',
}

/** @deprecated Prefer PAGE_TIP_FALLBACK */
export const CRM_PAGE_TIP_FALLBACK = PAGE_TIP_FALLBACK

export const PURCHASE_PAGE_TIP_FALLBACK: PageGuideEntry = {
  purpose: 'Procurement lifecycle: Demand → PR → RFQ → Compare → PO → GRN → QC → stock. Invoice/payment Planned.',
  nextStep: 'Use the process map, or open awaiting PR approval / open POs.',
}

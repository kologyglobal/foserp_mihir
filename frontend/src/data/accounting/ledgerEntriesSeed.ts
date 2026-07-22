/**
 * Ledger Entries — Indian manufacturing demo seed (FY 2026–27, Apr–Jul 2026).
 * Keep all mock GL lines out of page/JSX; mutate views only via ledgerEntriesService.
 */
import type {
  LedgerEntry,
  LedgerEntryAccount,
  LedgerEntryDimension,
  LedgerEntryManufacturingReference,
  LedgerEntryParty,
  LedgerEntryReversalReference,
  LedgerEntrySourceDocument,
  LedgerEntryStatus,
  LedgerEntryTaxReference,
  LedgerVoucherType,
  ManufacturingLedgerAccountType,
} from '@/types/ledgerEntries'

const USER = 'Rahul Mehta'
const ACCOUNTANT = 'Priya Sharma'
const SYSTEM = 'System'

export const LEDGER_LOOKUP_COST_CENTRES = [
  { id: 'cc-prod', code: 'CC-PROD', name: 'Production' },
  { id: 'cc-admin', code: 'CC-ADMIN', name: 'Administration' },
  { id: 'cc-sales', code: 'CC-SALES', name: 'Sales & Marketing' },
  { id: 'cc-maint', code: 'CC-MAINT', name: 'Maintenance' },
]

export const LEDGER_LOOKUP_PROJECTS = [
  {
    id: 'prj-t40',
    code: 'PRJ-T40',
    name: 'Trailer 40 FT Program',
    customer: 'Konkan Cargo Movers',
    projectManager: 'Amit Kulkarni',
    status: 'Active' as const,
  },
  {
    id: 'prj-tip',
    code: 'PRJ-TIP',
    name: 'Tipper Series',
    customer: 'Deccan Aggregates Ltd',
    projectManager: 'Neha Deshmukh',
    status: 'Active' as const,
  },
]

export const LEDGER_LOOKUP_PLANTS = [
  { id: 'plt-main', code: 'PLT-01', name: 'Main Plant — Pune' },
  { id: 'plt-unit2', code: 'PLT-02', name: 'Unit 2 — Chakan' },
]

export const LEDGER_LOOKUP_DEPARTMENTS = [
  { id: 'dept-fab', code: 'FAB', name: 'Fabrication' },
  { id: 'dept-assy', code: 'ASSY', name: 'Assembly' },
  { id: 'dept-qc', code: 'QC', name: 'Quality' },
  { id: 'dept-fin', code: 'FIN', name: 'Finance' },
]

export const LEDGER_LOOKUP_PARTIES = [
  {
    id: 'party-vnd-steel',
    type: 'Vendor' as const,
    code: 'VND-STEEL',
    name: 'Bharat Steel Traders',
    gstNumber: '27AABCB1234A1Z5',
  },
  {
    id: 'party-cus-log',
    type: 'Customer' as const,
    code: 'CUS-LOG',
    name: 'Konkan Cargo Movers',
    gstNumber: '27AABCK2345F1Z7',
  },
  {
    id: 'party-bank-hdfc',
    type: 'Bank' as const,
    code: 'HDFC-CA',
    name: 'HDFC Bank — Current A/c',
    gstNumber: null,
  },
  {
    id: 'party-emp-suresh',
    type: 'Employee' as const,
    code: 'EMP-SP01',
    name: 'Suresh Patil',
    gstNumber: null,
  },
  {
    id: 'party-v-freight',
    type: 'Vendor' as const,
    code: 'VND-FRT',
    name: 'Western Logistics Co',
    gstNumber: '27AAACW9012C1Z8',
  },
]

type AccountMeta = Omit<LedgerEntryAccount, 'accountId'>

const ACCOUNT_META: Record<string, AccountMeta> = {
  '1111': { code: '1111', name: 'Cash in Hand', category: 'Asset', accountType: 'Posting', normalBalance: 'Debit', controlAccountType: 'Cash' },
  '1112': { code: '1112', name: 'HDFC Bank — Current A/c', category: 'Asset', accountType: 'Posting', normalBalance: 'Debit', controlAccountType: 'Bank' },
  '1131': { code: '1131', name: 'Trade Debtors', category: 'Asset', accountType: 'Posting', normalBalance: 'Debit', controlAccountType: 'Customer Receivable' },
  '1141': { code: '1141', name: 'Raw Material Inventory', category: 'Asset', accountType: 'Posting', normalBalance: 'Debit', controlAccountType: 'Inventory' },
  '1142': { code: '1142', name: 'Work in Progress Inventory', category: 'Asset', accountType: 'Posting', normalBalance: 'Debit', controlAccountType: 'Inventory' },
  '1143': { code: '1143', name: 'Finished Goods Inventory', category: 'Asset', accountType: 'Posting', normalBalance: 'Debit', controlAccountType: 'Inventory' },
  '1181': { code: '1181', name: 'Input CGST', category: 'Asset', accountType: 'Posting', normalBalance: 'Debit', controlAccountType: 'GST' },
  '1182': { code: '1182', name: 'Input SGST', category: 'Asset', accountType: 'Posting', normalBalance: 'Debit', controlAccountType: 'GST' },
  '1290': { code: '1290', name: 'Accumulated Depreciation', category: 'Asset', accountType: 'Posting', normalBalance: 'Credit', controlAccountType: null },
  '2111': { code: '2111', name: 'Trade Creditors', category: 'Liability', accountType: 'Posting', normalBalance: 'Credit', controlAccountType: 'Vendor Payable' },
  '2120': { code: '2120', name: 'Expenses Payable', category: 'Liability', accountType: 'Posting', normalBalance: 'Credit', controlAccountType: null },
  '2131': { code: '2131', name: 'Output CGST', category: 'Liability', accountType: 'Posting', normalBalance: 'Credit', controlAccountType: 'GST' },
  '2132': { code: '2132', name: 'Output SGST', category: 'Liability', accountType: 'Posting', normalBalance: 'Credit', controlAccountType: 'GST' },
  '2140': { code: '2140', name: 'TDS Payable', category: 'Liability', accountType: 'Posting', normalBalance: 'Credit', controlAccountType: 'TDS' },
  '2150': { code: '2150', name: 'Salary Payable', category: 'Liability', accountType: 'Posting', normalBalance: 'Credit', controlAccountType: 'Payroll' },
  '3100': { code: '3100', name: 'Share Capital', category: 'Equity', accountType: 'Posting', normalBalance: 'Credit', controlAccountType: null },
  '3300': { code: '3300', name: 'Retained Earnings', category: 'Equity', accountType: 'Posting', normalBalance: 'Credit', controlAccountType: null },
  '4100': { code: '4100', name: 'Domestic Sales', category: 'Income', accountType: 'Posting', normalBalance: 'Credit', controlAccountType: null },
  '4400': { code: '4400', name: 'Scrap Sales', category: 'Income', accountType: 'Posting', normalBalance: 'Credit', controlAccountType: null },
  '5100': { code: '5100', name: 'Raw Material Consumption', category: 'Expense', accountType: 'Posting', normalBalance: 'Debit', controlAccountType: null },
  '5200': { code: '5200', name: 'Direct Labour', category: 'Expense', accountType: 'Posting', normalBalance: 'Debit', controlAccountType: null },
  '5300': { code: '5300', name: 'Factory Overheads', category: 'Expense', accountType: 'Posting', normalBalance: 'Debit', controlAccountType: null },
  '5500': { code: '5500', name: 'Production Variance', category: 'Expense', accountType: 'Posting', normalBalance: 'Debit', controlAccountType: null },
  '5700': { code: '5700', name: 'Inventory Adjustment', category: 'Expense', accountType: 'Posting', normalBalance: 'Debit', controlAccountType: null },
  '6300': { code: '6300', name: 'Employee Expenses', category: 'Expense', accountType: 'Posting', normalBalance: 'Debit', controlAccountType: null },
  '6500': { code: '6500', name: 'Freight and Transportation', category: 'Expense', accountType: 'Posting', normalBalance: 'Debit', controlAccountType: null },
  '6600': { code: '6600', name: 'Finance Costs', category: 'Expense', accountType: 'Posting', normalBalance: 'Debit', controlAccountType: null },
  '6700': { code: '6700', name: 'Depreciation', category: 'Expense', accountType: 'Posting', normalBalance: 'Debit', controlAccountType: null },
}

function account(code: string): LedgerEntryAccount {
  const meta = ACCOUNT_META[code]
  if (!meta) throw new Error(`Unknown account code ${code}`)
  return { accountId: `coa-${code}`, ...meta }
}

function party(
  key: 'steel' | 'log' | 'hdfc' | 'emp' | 'freight',
): LedgerEntryParty {
  const map = {
    steel: LEDGER_LOOKUP_PARTIES[0],
    log: LEDGER_LOOKUP_PARTIES[1],
    hdfc: LEDGER_LOOKUP_PARTIES[2],
    emp: LEDGER_LOOKUP_PARTIES[3],
    freight: LEDGER_LOOKUP_PARTIES[4],
  }
  const p = map[key]
  return {
    partyType: p.type,
    partyId: p.id,
    partyCode: p.code,
    partyName: p.name,
    gstNumber: p.gstNumber,
  }
}

const DIM_NONE: LedgerEntryDimension = {
  company: 'Vasant Trailers Pvt Ltd',
  locationId: null,
  locationName: null,
  plantId: null,
  plantName: null,
  departmentId: null,
  departmentName: null,
  costCentreId: null,
  costCentreCode: null,
  costCentreName: null,
  projectId: null,
  projectCode: null,
  projectName: null,
  businessUnit: null,
}

const DIM_PROD: LedgerEntryDimension = {
  company: 'Vasant Trailers Pvt Ltd',
  locationId: 'loc-rm',
  locationName: 'RM Stores',
  plantId: 'plt-main',
  plantName: 'Main Plant — Pune',
  departmentId: 'dept-fab',
  departmentName: 'Fabrication',
  costCentreId: 'cc-prod',
  costCentreCode: 'CC-PROD',
  costCentreName: 'Production',
  projectId: 'prj-t40',
  projectCode: 'PRJ-T40',
  projectName: 'Trailer 40 FT Program',
  businessUnit: 'Manufacturing',
}

const DIM_ADMIN: LedgerEntryDimension = {
  company: 'Vasant Trailers Pvt Ltd',
  locationId: 'loc-off',
  locationName: 'Head Office',
  plantId: 'plt-main',
  plantName: 'Main Plant — Pune',
  departmentId: 'dept-fin',
  departmentName: 'Finance',
  costCentreId: 'cc-admin',
  costCentreCode: 'CC-ADMIN',
  costCentreName: 'Administration',
  projectId: null,
  projectCode: null,
  projectName: null,
  businessUnit: 'Corporate',
}

const DIM_ASSY: LedgerEntryDimension = {
  ...DIM_PROD,
  departmentId: 'dept-assy',
  departmentName: 'Assembly',
}

const MFG_NONE: LedgerEntryManufacturingReference = {
  productionOrder: null,
  workCentre: null,
  machineCentre: null,
  itemCode: null,
  itemName: null,
  itemCategory: null,
  batchNumber: null,
  jobWorkOrder: null,
  manufacturingAccountType: null,
  costType: null,
}

function mfg(
  type: ManufacturingLedgerAccountType,
  costType: 'Material' | 'Labour' | 'Overhead' | 'Other',
  extras: Partial<LedgerEntryManufacturingReference> = {},
): LedgerEntryManufacturingReference {
  return {
    productionOrder: 'PO-MFG-2401',
    workCentre: 'WC-FAB-01',
    machineCentre: 'MC-PLASMA-02',
    itemCode: 'PLATE-MS',
    itemName: 'MS Plate 8mm',
    itemCategory: 'Raw Material',
    batchNumber: 'BAT-2605-014',
    jobWorkOrder: null,
    manufacturingAccountType: type,
    costType,
    ...extras,
  }
}

const TAX_NONE: LedgerEntryTaxReference = {
  gstApplicable: false,
  gstType: null,
  gstRate: null,
  tdsApplicable: false,
  tdsSection: null,
  taxableAmount: null,
}

function gstInput(rate: number, taxable: number): LedgerEntryTaxReference {
  return {
    gstApplicable: true,
    gstType: 'CGST+SGST',
    gstRate: rate,
    tdsApplicable: false,
    tdsSection: null,
    taxableAmount: taxable,
  }
}

function gstOutput(rate: number, taxable: number): LedgerEntryTaxReference {
  return gstInput(rate, taxable)
}

function tdsRef(section: string, taxable: number): LedgerEntryTaxReference {
  return {
    gstApplicable: false,
    gstType: null,
    gstRate: null,
    tdsApplicable: true,
    tdsSection: section,
    taxableAmount: taxable,
  }
}

type Draft = {
  id: string
  entryNumber: string
  postingDate: string
  documentDate: string
  voucherId: string | null
  voucherNumber: string
  voucherType: LedgerVoucherType
  referenceNumber: string
  externalDocumentNumber: string
  narration: string
  debit: number
  credit: number
  status: LedgerEntryStatus
  accountCode: string
  partyKey?: 'steel' | 'log' | 'hdfc' | 'emp' | 'freight'
  dimensions?: LedgerEntryDimension
  manufacturing?: LedgerEntryManufacturingReference
  tax?: LedgerEntryTaxReference
  sourceDocument?: LedgerEntrySourceDocument | null
  reversal?: LedgerEntryReversalReference | null
  createdBy?: string
  postedBy?: string
  hasAttachments?: boolean
  isPreviewOnly?: boolean
}

function entryNo(ym: string, seq: number): string {
  return `GLE-${ym}-${String(seq).padStart(4, '0')}`
}

function postedAt(date: string, hour = 10): string {
  return `${date}T0${hour}:30:00.000Z`
}

function buildDrafts(): Draft[] {
  let seq = 1
  const n = (ym: string) => entryNo(ym, seq++)

  return [
    // —— Opening balances (1 Apr 2026) ——
    { id: 'gle-ob-01', entryNumber: n('2604'), postingDate: '2026-04-01', documentDate: '2026-04-01', voucherId: 'vch-led-001', voucherNumber: 'OB-2026-0001', voucherType: 'Opening', referenceNumber: 'FY Opening', externalDocumentNumber: '', narration: 'Opening balance — HDFC current account', debit: 4250000, credit: 0, status: 'Opening Balance', accountCode: '1112', partyKey: 'hdfc', dimensions: DIM_ADMIN, sourceDocument: { module: 'Opening Balance', documentType: 'Opening Balance', documentNumber: 'OB-2026-0001', documentDate: '2026-04-01', partyName: null, amount: 4250000, status: 'Posted', href: '/accounting/ledger-entries/voucher/vch-led-001' } },
    { id: 'gle-ob-02', entryNumber: n('2604'), postingDate: '2026-04-01', documentDate: '2026-04-01', voucherId: 'vch-led-001', voucherNumber: 'OB-2026-0001', voucherType: 'Opening', referenceNumber: 'FY Opening', externalDocumentNumber: '', narration: 'Opening balance — trade debtors', debit: 8420000, credit: 0, status: 'Opening Balance', accountCode: '1131', dimensions: DIM_ADMIN },
    { id: 'gle-ob-03', entryNumber: n('2604'), postingDate: '2026-04-01', documentDate: '2026-04-01', voucherId: 'vch-led-001', voucherNumber: 'OB-2026-0001', voucherType: 'Opening', referenceNumber: 'FY Opening', externalDocumentNumber: '', narration: 'Opening balance — raw material inventory', debit: 6120000, credit: 0, status: 'Opening Balance', accountCode: '1141', dimensions: DIM_PROD, manufacturing: mfg('Raw Material Inventory', 'Material') },
    { id: 'gle-ob-04', entryNumber: n('2604'), postingDate: '2026-04-01', documentDate: '2026-04-01', voucherId: 'vch-led-001', voucherNumber: 'OB-2026-0001', voucherType: 'Opening', referenceNumber: 'FY Opening', externalDocumentNumber: '', narration: 'Opening balance — work in progress', debit: 1840000, credit: 0, status: 'Opening Balance', accountCode: '1142', dimensions: DIM_PROD, manufacturing: mfg('Work in Progress', 'Material', { itemCode: 'CHSIS-T40', itemName: '40 FT Chassis WIP', itemCategory: 'WIP' }) },
    { id: 'gle-ob-05', entryNumber: n('2604'), postingDate: '2026-04-01', documentDate: '2026-04-01', voucherId: 'vch-led-001', voucherNumber: 'OB-2026-0001', voucherType: 'Opening', referenceNumber: 'FY Opening', externalDocumentNumber: '', narration: 'Opening balance — finished goods', debit: 2960000, credit: 0, status: 'Opening Balance', accountCode: '1143', dimensions: DIM_ASSY, manufacturing: mfg('Finished Goods Inventory', 'Material', { itemCode: 'TRL-T40-STD', itemName: '40 FT Standard Trailer', itemCategory: 'Finished Goods', workCentre: 'WC-ASSY-03' }) },
    { id: 'gle-ob-06', entryNumber: n('2604'), postingDate: '2026-04-01', documentDate: '2026-04-01', voucherId: 'vch-led-001', voucherNumber: 'OB-2026-0001', voucherType: 'Opening', referenceNumber: 'FY Opening', externalDocumentNumber: '', narration: 'Opening balance — trade creditors', debit: 0, credit: 5240000, status: 'Opening Balance', accountCode: '2111', dimensions: DIM_ADMIN },
    { id: 'gle-ob-07', entryNumber: n('2604'), postingDate: '2026-04-01', documentDate: '2026-04-01', voucherId: 'vch-led-001', voucherNumber: 'OB-2026-0001', voucherType: 'Opening', referenceNumber: 'FY Opening', externalDocumentNumber: '', narration: 'Opening balance — share capital', debit: 0, credit: 15000000, status: 'Opening Balance', accountCode: '3100', dimensions: DIM_ADMIN },
    { id: 'gle-ob-08', entryNumber: n('2604'), postingDate: '2026-04-01', documentDate: '2026-04-01', voucherId: 'vch-led-001', voucherNumber: 'OB-2026-0001', voucherType: 'Opening', referenceNumber: 'FY Opening', externalDocumentNumber: '', narration: 'Opening balance — retained earnings', debit: 0, credit: 1980000, status: 'Opening Balance', accountCode: '3300', dimensions: DIM_ADMIN },

    // —— RM purchase + vendor invoice (8 Apr) ——
    { id: 'gle-pi-01', entryNumber: n('2604'), postingDate: '2026-04-08', documentDate: '2026-04-07', voucherId: 'vch-led-002', voucherNumber: 'PI-2026-00142', voucherType: 'Purchase Invoice', referenceNumber: 'PO-2026-0088', externalDocumentNumber: 'BST/INV/8842', narration: 'MS plate purchase — Bharat Steel Traders', debit: 250000, credit: 0, status: 'Posted', accountCode: '1141', partyKey: 'steel', dimensions: DIM_PROD, manufacturing: mfg('Raw Material Inventory', 'Material'), tax: gstInput(9, 250000), hasAttachments: true, sourceDocument: { module: 'Purchase', documentType: 'Purchase Order', documentNumber: 'PO-2026-0088', documentDate: '2026-04-05', partyName: 'Bharat Steel Traders', amount: 295000, status: 'Invoiced', href: null } },
    { id: 'gle-pi-02', entryNumber: n('2604'), postingDate: '2026-04-08', documentDate: '2026-04-07', voucherId: 'vch-led-002', voucherNumber: 'PI-2026-00142', voucherType: 'Purchase Invoice', referenceNumber: 'PO-2026-0088', externalDocumentNumber: 'BST/INV/8842', narration: 'Input CGST on RM purchase', debit: 22500, credit: 0, status: 'Posted', accountCode: '1181', partyKey: 'steel', dimensions: DIM_PROD, tax: gstInput(9, 250000), sourceDocument: { module: 'Purchase', documentType: 'Vendor Invoice', documentNumber: 'BST/INV/8842', documentDate: '2026-04-07', partyName: 'Bharat Steel Traders', amount: 295000, status: 'Posted', href: '/accounting/ledger-entries/voucher/vch-led-002' } },
    { id: 'gle-pi-03', entryNumber: n('2604'), postingDate: '2026-04-08', documentDate: '2026-04-07', voucherId: 'vch-led-002', voucherNumber: 'PI-2026-00142', voucherType: 'Purchase Invoice', referenceNumber: 'PO-2026-0088', externalDocumentNumber: 'BST/INV/8842', narration: 'Input SGST on RM purchase', debit: 22500, credit: 0, status: 'Posted', accountCode: '1182', partyKey: 'steel', dimensions: DIM_PROD, tax: gstInput(9, 250000) },
    { id: 'gle-pi-04', entryNumber: n('2604'), postingDate: '2026-04-08', documentDate: '2026-04-07', voucherId: 'vch-led-002', voucherNumber: 'PI-2026-00142', voucherType: 'Purchase Invoice', referenceNumber: 'PO-2026-0088', externalDocumentNumber: 'BST/INV/8842', narration: 'Vendor invoice payable — Bharat Steel Traders', debit: 0, credit: 295000, status: 'Posted', accountCode: '2111', partyKey: 'steel', dimensions: DIM_PROD },

    // —— Vendor payment (12 Apr) ——
    { id: 'gle-pay-01', entryNumber: n('2604'), postingDate: '2026-04-12', documentDate: '2026-04-12', voucherId: 'vch-led-003', voucherNumber: 'PAY-2026-00089', voucherType: 'Payment', referenceNumber: 'NEFT-8842910', externalDocumentNumber: 'BST/INV/8842', narration: 'NEFT payment to Bharat Steel Traders', debit: 500000, credit: 0, status: 'Posted', accountCode: '2111', partyKey: 'steel', dimensions: DIM_ADMIN, hasAttachments: true, sourceDocument: { module: 'Banking', documentType: 'Payment Voucher', documentNumber: 'PAY-2026-00089', documentDate: '2026-04-12', partyName: 'Bharat Steel Traders', amount: 500000, status: 'Posted', href: '/accounting/ledger-entries/voucher/vch-led-003' } },
    { id: 'gle-pay-02', entryNumber: n('2604'), postingDate: '2026-04-12', documentDate: '2026-04-12', voucherId: 'vch-led-003', voucherNumber: 'PAY-2026-00089', voucherType: 'Payment', referenceNumber: 'NEFT-8842910', externalDocumentNumber: 'BST/INV/8842', narration: 'HDFC bank — vendor payment', debit: 0, credit: 500000, status: 'Posted', accountCode: '1112', partyKey: 'hdfc', dimensions: DIM_ADMIN },

    // —— Domestic sales + output GST (18 Apr) ——
    { id: 'gle-si-01', entryNumber: n('2604'), postingDate: '2026-04-18', documentDate: '2026-04-17', voucherId: 'vch-led-004', voucherNumber: 'SI-2026-00318', voucherType: 'Sales Invoice', referenceNumber: 'SO-2026-0156', externalDocumentNumber: 'VT/INV/318', narration: 'Trailer sale — Konkan Cargo Movers', debit: 1180000, credit: 0, status: 'Posted', accountCode: '1131', partyKey: 'log', dimensions: DIM_ASSY, tax: gstOutput(9, 1000000), sourceDocument: { module: 'Sales', documentType: 'Sales Order', documentNumber: 'SO-2026-0156', documentDate: '2026-04-10', partyName: 'Konkan Cargo Movers', amount: 1180000, status: 'Invoiced', href: null } },
    { id: 'gle-si-02', entryNumber: n('2604'), postingDate: '2026-04-18', documentDate: '2026-04-17', voucherId: 'vch-led-004', voucherNumber: 'SI-2026-00318', voucherType: 'Sales Invoice', referenceNumber: 'SO-2026-0156', externalDocumentNumber: 'VT/INV/318', narration: 'Domestic sales revenue', debit: 0, credit: 1000000, status: 'Posted', accountCode: '4100', partyKey: 'log', dimensions: DIM_ASSY, tax: gstOutput(9, 1000000), sourceDocument: { module: 'Sales', documentType: 'Tax Invoice', documentNumber: 'VT/INV/318', documentDate: '2026-04-17', partyName: 'Konkan Cargo Movers', amount: 1180000, status: 'Posted', href: '/accounting/ledger-entries/voucher/vch-led-004' } },
    { id: 'gle-si-03', entryNumber: n('2604'), postingDate: '2026-04-18', documentDate: '2026-04-17', voucherId: 'vch-led-004', voucherNumber: 'SI-2026-00318', voucherType: 'Sales Invoice', referenceNumber: 'SO-2026-0156', externalDocumentNumber: 'VT/INV/318', narration: 'Output CGST on domestic sales', debit: 0, credit: 90000, status: 'Posted', accountCode: '2131', partyKey: 'log', dimensions: DIM_ASSY, tax: gstOutput(9, 1000000) },
    { id: 'gle-si-04', entryNumber: n('2604'), postingDate: '2026-04-18', documentDate: '2026-04-17', voucherId: 'vch-led-004', voucherNumber: 'SI-2026-00318', voucherType: 'Sales Invoice', referenceNumber: 'SO-2026-0156', externalDocumentNumber: 'VT/INV/318', narration: 'Output SGST on domestic sales', debit: 0, credit: 90000, status: 'Posted', accountCode: '2132', partyKey: 'log', dimensions: DIM_ASSY, tax: gstOutput(9, 1000000) },

    // —— Customer receipt (22 Apr) ——
    { id: 'gle-rec-01', entryNumber: n('2604'), postingDate: '2026-04-22', documentDate: '2026-04-22', voucherId: 'vch-led-005', voucherNumber: 'REC-2026-00104', voucherType: 'Receipt', referenceNumber: 'RTGS-772104', externalDocumentNumber: 'VT/INV/318', narration: 'Customer receipt — Konkan Cargo Movers', debit: 590000, credit: 0, status: 'Posted', accountCode: '1112', partyKey: 'hdfc', dimensions: DIM_ADMIN, sourceDocument: { module: 'Banking', documentType: 'Receipt Voucher', documentNumber: 'REC-2026-00104', documentDate: '2026-04-22', partyName: 'Konkan Cargo Movers', amount: 590000, status: 'Posted', href: '/accounting/ledger-entries/voucher/vch-led-005' } },
    { id: 'gle-rec-02', entryNumber: n('2604'), postingDate: '2026-04-22', documentDate: '2026-04-22', voucherId: 'vch-led-005', voucherNumber: 'REC-2026-00104', voucherType: 'Receipt', referenceNumber: 'RTGS-772104', externalDocumentNumber: 'VT/INV/318', narration: 'Allocation against trade debtors', debit: 0, credit: 590000, status: 'Posted', accountCode: '1131', partyKey: 'log', dimensions: DIM_ADMIN },

    // —— Factory electricity accrual (25 Apr) ——
    { id: 'gle-jnl-01', entryNumber: n('2604'), postingDate: '2026-04-25', documentDate: '2026-04-25', voucherId: 'vch-led-006', voucherNumber: 'JV-2026-00201', voucherType: 'Journal', referenceNumber: 'MSEDCL-APR', externalDocumentNumber: 'EB-BILL-APR26', narration: 'Factory electricity accrual — April 2026', debit: 48500, credit: 0, status: 'Posted', accountCode: '5300', dimensions: DIM_PROD, manufacturing: mfg('Factory Overhead', 'Overhead', { itemCode: null, itemName: null, workCentre: 'WC-UTIL-01' }) },
    { id: 'gle-jnl-02', entryNumber: n('2604'), postingDate: '2026-04-25', documentDate: '2026-04-25', voucherId: 'vch-led-006', voucherNumber: 'JV-2026-00201', voucherType: 'Journal', referenceNumber: 'MSEDCL-APR', externalDocumentNumber: 'EB-BILL-APR26', narration: 'Electricity expense payable', debit: 0, credit: 48500, status: 'Posted', accountCode: '2120', dimensions: DIM_PROD },

    // —— Salary provision (30 Apr) ——
    { id: 'gle-sal-01', entryNumber: n('2604'), postingDate: '2026-04-30', documentDate: '2026-04-30', voucherId: 'vch-led-007', voucherNumber: 'JV-2026-00215', voucherType: 'Journal', referenceNumber: 'PAYROLL-APR26', externalDocumentNumber: '', narration: 'Salary provision — fabrication department', debit: 420000, credit: 0, status: 'Posted', accountCode: '6300', dimensions: DIM_PROD, manufacturing: mfg('Direct Labour', 'Labour', { workCentre: 'WC-FAB-01' }) },
    { id: 'gle-sal-02', entryNumber: n('2604'), postingDate: '2026-04-30', documentDate: '2026-04-30', voucherId: 'vch-led-007', voucherNumber: 'JV-2026-00215', voucherType: 'Journal', referenceNumber: 'PAYROLL-APR26', externalDocumentNumber: '', narration: 'Salary payable — April 2026', debit: 0, credit: 420000, status: 'Posted', accountCode: '2150', dimensions: DIM_ADMIN, sourceDocument: { module: 'Payroll', documentType: 'Payroll Run', documentNumber: 'PAYROLL-APR26', documentDate: '2026-04-30', partyName: null, amount: 420000, status: 'Posted', href: '/accounting/ledger-entries/voucher/vch-led-007' } },

    // —— Depreciation (30 Apr) ——
    { id: 'gle-dep-01', entryNumber: n('2604'), postingDate: '2026-04-30', documentDate: '2026-04-30', voucherId: 'vch-led-008', voucherNumber: 'JV-2026-00218', voucherType: 'Journal', referenceNumber: 'DEP-APR26', externalDocumentNumber: '', narration: 'Monthly depreciation — plant & machinery', debit: 185000, credit: 0, status: 'Posted', accountCode: '6700', dimensions: DIM_PROD, createdBy: SYSTEM, postedBy: SYSTEM },
    { id: 'gle-dep-02', entryNumber: n('2604'), postingDate: '2026-04-30', documentDate: '2026-04-30', voucherId: 'vch-led-008', voucherNumber: 'JV-2026-00218', voucherType: 'Journal', referenceNumber: 'DEP-APR26', externalDocumentNumber: '', narration: 'Accumulated depreciation — plant & machinery', debit: 0, credit: 185000, status: 'Posted', accountCode: '1290', dimensions: DIM_PROD, createdBy: SYSTEM, postedBy: SYSTEM },

    // —— RM consumption (5 May) ——
    { id: 'gle-mc-01', entryNumber: n('2605'), postingDate: '2026-05-05', documentDate: '2026-05-05', voucherId: 'vch-led-009', voucherNumber: 'PRD-2026-00041', voucherType: 'Production', referenceNumber: 'PO-MFG-2401', externalDocumentNumber: 'ISS-2605-088', narration: 'Material consumption — MS plate for PO-MFG-2401', debit: 320000, credit: 0, status: 'Posted', accountCode: '5100', dimensions: DIM_PROD, manufacturing: mfg('Material Consumption', 'Material'), sourceDocument: { module: 'Production', documentType: 'Material Issue', documentNumber: 'ISS-2605-088', documentDate: '2026-05-05', partyName: null, amount: 320000, status: 'Posted', href: null } },
    { id: 'gle-mc-02', entryNumber: n('2605'), postingDate: '2026-05-05', documentDate: '2026-05-05', voucherId: 'vch-led-009', voucherNumber: 'PRD-2026-00041', voucherType: 'Production', referenceNumber: 'PO-MFG-2401', externalDocumentNumber: 'ISS-2605-088', narration: 'RM inventory reduction — PLATE-MS', debit: 0, credit: 320000, status: 'Posted', accountCode: '1141', dimensions: DIM_PROD, manufacturing: mfg('Raw Material Inventory', 'Material') },

    // —— WIP transfer / cost absorption (8 May) ——
    { id: 'gle-wip-01', entryNumber: n('2605'), postingDate: '2026-05-08', documentDate: '2026-05-08', voucherId: 'vch-led-010', voucherNumber: 'PRD-2026-00045', voucherType: 'Production', referenceNumber: 'PO-MFG-2401', externalDocumentNumber: '', narration: 'WIP absorption — material, labour, overhead', debit: 450000, credit: 0, status: 'Posted', accountCode: '1142', dimensions: DIM_PROD, manufacturing: mfg('Work in Progress', 'Material', { itemCode: 'CHSIS-T40', itemName: '40 FT Chassis WIP' }) },
    { id: 'gle-wip-02', entryNumber: n('2605'), postingDate: '2026-05-08', documentDate: '2026-05-08', voucherId: 'vch-led-010', voucherNumber: 'PRD-2026-00045', voucherType: 'Production', referenceNumber: 'PO-MFG-2401', externalDocumentNumber: '', narration: 'RM consumption transferred to WIP', debit: 0, credit: 320000, status: 'Posted', accountCode: '5100', dimensions: DIM_PROD, manufacturing: mfg('Material Consumption', 'Material') },
    { id: 'gle-wip-03', entryNumber: n('2605'), postingDate: '2026-05-08', documentDate: '2026-05-08', voucherId: 'vch-led-010', voucherNumber: 'PRD-2026-00045', voucherType: 'Production', referenceNumber: 'PO-MFG-2401', externalDocumentNumber: '', narration: 'Direct labour charged to WIP', debit: 0, credit: 80000, status: 'Posted', accountCode: '5200', dimensions: DIM_PROD, manufacturing: mfg('Direct Labour', 'Labour') },
    { id: 'gle-wip-04', entryNumber: n('2605'), postingDate: '2026-05-08', documentDate: '2026-05-08', voucherId: 'vch-led-010', voucherNumber: 'PRD-2026-00045', voucherType: 'Production', referenceNumber: 'PO-MFG-2401', externalDocumentNumber: '', narration: 'Factory overhead allocated to WIP', debit: 0, credit: 50000, status: 'Posted', accountCode: '5300', dimensions: DIM_PROD, manufacturing: mfg('Factory Overhead', 'Overhead') },

    // —— FG receipt (12 May) ——
    { id: 'gle-fg-01', entryNumber: n('2605'), postingDate: '2026-05-12', documentDate: '2026-05-12', voucherId: 'vch-led-011', voucherNumber: 'SJ-2026-00028', voucherType: 'Stock Journal', referenceNumber: 'PO-MFG-2401', externalDocumentNumber: 'GRN-2605-042', narration: 'Finished goods receipt from production', debit: 420000, credit: 0, status: 'Posted', accountCode: '1143', dimensions: DIM_ASSY, manufacturing: mfg('Finished Goods Inventory', 'Material', { itemCode: 'TRL-T40-STD', itemName: '40 FT Standard Trailer', workCentre: 'WC-ASSY-03' }), sourceDocument: { module: 'Inventory', documentType: 'Stock Journal', documentNumber: 'GRN-2605-042', documentDate: '2026-05-12', partyName: null, amount: 420000, status: 'Posted', href: '/accounting/ledger-entries/voucher/vch-led-011' } },
    { id: 'gle-fg-02', entryNumber: n('2605'), postingDate: '2026-05-12', documentDate: '2026-05-12', voucherId: 'vch-led-011', voucherNumber: 'SJ-2026-00028', voucherType: 'Stock Journal', referenceNumber: 'PO-MFG-2401', externalDocumentNumber: 'GRN-2605-042', narration: 'WIP clearance on FG receipt', debit: 0, credit: 420000, status: 'Posted', accountCode: '1142', dimensions: DIM_ASSY, manufacturing: mfg('Work in Progress', 'Material', { itemCode: 'CHSIS-T40', itemName: '40 FT Chassis WIP' }) },

    // —— Production variance (15 May) ——
    { id: 'gle-var-01', entryNumber: n('2605'), postingDate: '2026-05-15', documentDate: '2026-05-15', voucherId: 'vch-led-012', voucherNumber: 'JV-2026-00244', voucherType: 'Journal', referenceNumber: 'PO-MFG-2401', externalDocumentNumber: '', narration: 'Unfavourable production variance — material yield', debit: 12500, credit: 0, status: 'Posted', accountCode: '5500', dimensions: DIM_PROD, manufacturing: mfg('Production Variance', 'Material') },
    { id: 'gle-var-02', entryNumber: n('2605'), postingDate: '2026-05-15', documentDate: '2026-05-15', voucherId: 'vch-led-012', voucherNumber: 'JV-2026-00244', voucherType: 'Journal', referenceNumber: 'PO-MFG-2401', externalDocumentNumber: '', narration: 'WIP adjustment for production variance', debit: 0, credit: 12500, status: 'Posted', accountCode: '1142', dimensions: DIM_PROD, manufacturing: mfg('Work in Progress', 'Material') },

    // —— Scrap sale (20 May) ——
    { id: 'gle-scr-01', entryNumber: n('2605'), postingDate: '2026-05-20', documentDate: '2026-05-19', voucherId: 'vch-led-013', voucherNumber: 'SI-2026-00355', voucherType: 'Sales Invoice', referenceNumber: 'SCR-2605-09', externalDocumentNumber: 'VT/SCR/055', narration: 'Scrap MS offcuts sale', debit: 47250, credit: 0, status: 'Posted', accountCode: '1112', partyKey: 'log', dimensions: DIM_PROD, manufacturing: mfg('Scrap', 'Other', { itemCode: 'SCRAP-MS', itemName: 'MS Scrap', itemCategory: 'Scrap' }), tax: gstOutput(9, 40000) },
    { id: 'gle-scr-02', entryNumber: n('2605'), postingDate: '2026-05-20', documentDate: '2026-05-19', voucherId: 'vch-led-013', voucherNumber: 'SI-2026-00355', voucherType: 'Sales Invoice', referenceNumber: 'SCR-2605-09', externalDocumentNumber: 'VT/SCR/055', narration: 'Scrap sales income', debit: 0, credit: 40000, status: 'Posted', accountCode: '4400', dimensions: DIM_PROD, manufacturing: mfg('Scrap', 'Other', { itemCode: 'SCRAP-MS', itemName: 'MS Scrap' }) },
    { id: 'gle-scr-03', entryNumber: n('2605'), postingDate: '2026-05-20', documentDate: '2026-05-19', voucherId: 'vch-led-013', voucherNumber: 'SI-2026-00355', voucherType: 'Sales Invoice', referenceNumber: 'SCR-2605-09', externalDocumentNumber: 'VT/SCR/055', narration: 'Output CGST on scrap sale', debit: 0, credit: 3600, status: 'Posted', accountCode: '2131', tax: gstOutput(9, 40000) },
    { id: 'gle-scr-04', entryNumber: n('2605'), postingDate: '2026-05-20', documentDate: '2026-05-19', voucherId: 'vch-led-013', voucherNumber: 'SI-2026-00355', voucherType: 'Sales Invoice', referenceNumber: 'SCR-2605-09', externalDocumentNumber: 'VT/SCR/055', narration: 'Output SGST on scrap sale', debit: 0, credit: 3600, status: 'Posted', accountCode: '2132', tax: gstOutput(9, 40000) },

    // —— Freight expense (25 May) ——
    { id: 'gle-frt-01', entryNumber: n('2605'), postingDate: '2026-05-25', documentDate: '2026-05-24', voucherId: 'vch-led-014', voucherNumber: 'PI-2026-00168', voucherType: 'Purchase Invoice', referenceNumber: 'LR-88421', externalDocumentNumber: 'WLC/INV/4421', narration: 'Inbound freight — RM delivery Pune plant', debit: 28000, credit: 0, status: 'Posted', accountCode: '6500', partyKey: 'freight', dimensions: DIM_PROD },
    { id: 'gle-frt-02', entryNumber: n('2605'), postingDate: '2026-05-25', documentDate: '2026-05-24', voucherId: 'vch-led-014', voucherNumber: 'PI-2026-00168', voucherType: 'Purchase Invoice', referenceNumber: 'LR-88421', externalDocumentNumber: 'WLC/INV/4421', narration: 'Freight payable — Western Logistics Co', debit: 0, credit: 28000, status: 'Posted', accountCode: '2111', partyKey: 'freight', dimensions: DIM_PROD },

    // —— Bank charges (1 Jun) ——
    { id: 'gle-bnk-01', entryNumber: n('2606'), postingDate: '2026-06-01', documentDate: '2026-06-01', voucherId: 'vch-led-015', voucherNumber: 'JV-2026-00272', voucherType: 'Journal', referenceNumber: 'HDFC-CHG-JUN', externalDocumentNumber: 'BNK-STM-JUN01', narration: 'Bank service charges — June 2026', debit: 850, credit: 0, status: 'Posted', accountCode: '6600', dimensions: DIM_ADMIN, partyKey: 'hdfc' },
    { id: 'gle-bnk-02', entryNumber: n('2606'), postingDate: '2026-06-01', documentDate: '2026-06-01', voucherId: 'vch-led-015', voucherNumber: 'JV-2026-00272', voucherType: 'Journal', referenceNumber: 'HDFC-CHG-JUN', externalDocumentNumber: 'BNK-STM-JUN01', narration: 'HDFC bank charges deduction', debit: 0, credit: 850, status: 'Posted', accountCode: '1112', partyKey: 'hdfc', dimensions: DIM_ADMIN },

    // —— TDS on professional fees (5 Jun) ——
    { id: 'gle-tds-01', entryNumber: n('2606'), postingDate: '2026-06-05', documentDate: '2026-06-04', voucherId: 'vch-led-016', voucherNumber: 'PAY-2026-00112', voucherType: 'TDS', referenceNumber: '194C-TDS', externalDocumentNumber: 'CON/INV/1188', narration: 'TDS deducted u/s 194C — subcontract invoice', debit: 50000, credit: 0, status: 'Posted', accountCode: '2111', partyKey: 'steel', dimensions: DIM_PROD, tax: tdsRef('194C', 500000) },
    { id: 'gle-tds-02', entryNumber: n('2606'), postingDate: '2026-06-05', documentDate: '2026-06-04', voucherId: 'vch-led-016', voucherNumber: 'PAY-2026-00112', voucherType: 'TDS', referenceNumber: '194C-TDS', externalDocumentNumber: 'CON/INV/1188', narration: 'TDS payable — Section 194C', debit: 0, credit: 5000, status: 'Posted', accountCode: '2140', dimensions: DIM_PROD, tax: tdsRef('194C', 500000), sourceDocument: { module: 'GST and TDS', documentType: 'TDS Voucher', documentNumber: 'PAY-2026-00112', documentDate: '2026-06-05', partyName: 'Bharat Steel Traders', amount: 5000, status: 'Posted', href: '/accounting/ledger-entries/voucher/vch-led-016' } },
    { id: 'gle-tds-03', entryNumber: n('2606'), postingDate: '2026-06-05', documentDate: '2026-06-04', voucherId: 'vch-led-016', voucherNumber: 'PAY-2026-00112', voucherType: 'Payment', referenceNumber: '194C-TDS', externalDocumentNumber: 'CON/INV/1188', narration: 'Net payment after TDS — subcontractor', debit: 0, credit: 45000, status: 'Posted', accountCode: '1112', partyKey: 'hdfc', dimensions: DIM_PROD },

    // —— Reversed journal + reversal entry pair (10–11 Jun) ——
    {
      id: 'gle-rev-orig-01',
      entryNumber: n('2606'),
      postingDate: '2026-06-10',
      documentDate: '2026-06-10',
      voucherId: 'vch-led-017',
      voucherNumber: 'JV-2026-00288',
      voucherType: 'Journal',
      referenceNumber: 'DUPL-EB',
      externalDocumentNumber: 'EB-BILL-MAY26',
      narration: 'Duplicate electricity accrual — to be reversed',
      debit: 12000,
      credit: 0,
      status: 'Reversed',
      accountCode: '5300',
      dimensions: DIM_PROD,
      reversal: {
        originalEntryId: null,
        originalVoucherNumber: null,
        reversalEntryId: 'gle-rev-new-01',
        reversalVoucherNumber: 'REV-2026-00012',
        reversalDate: '2026-06-11',
        reversalReason: 'Duplicate accrual posted in error',
      },
    },
    {
      id: 'gle-rev-orig-02',
      entryNumber: n('2606'),
      postingDate: '2026-06-10',
      documentDate: '2026-06-10',
      voucherId: 'vch-led-017',
      voucherNumber: 'JV-2026-00288',
      voucherType: 'Journal',
      referenceNumber: 'DUPL-EB',
      externalDocumentNumber: 'EB-BILL-MAY26',
      narration: 'Duplicate electricity payable — to be reversed',
      debit: 0,
      credit: 12000,
      status: 'Reversed',
      accountCode: '2120',
      dimensions: DIM_PROD,
      reversal: {
        originalEntryId: null,
        originalVoucherNumber: null,
        reversalEntryId: 'gle-rev-new-02',
        reversalVoucherNumber: 'REV-2026-00012',
        reversalDate: '2026-06-11',
        reversalReason: 'Duplicate accrual posted in error',
      },
    },
    {
      id: 'gle-rev-new-01',
      entryNumber: n('2606'),
      postingDate: '2026-06-11',
      documentDate: '2026-06-11',
      voucherId: 'vch-led-018',
      voucherNumber: 'REV-2026-00012',
      voucherType: 'Reversal',
      referenceNumber: 'DUPL-EB',
      externalDocumentNumber: 'EB-BILL-MAY26',
      narration: 'Reversal of duplicate electricity accrual',
      debit: 0,
      credit: 12000,
      status: 'Reversal Entry',
      accountCode: '5300',
      dimensions: DIM_PROD,
      reversal: {
        originalEntryId: 'gle-rev-orig-01',
        originalVoucherNumber: 'JV-2026-00288',
        reversalEntryId: null,
        reversalVoucherNumber: null,
        reversalDate: null,
        reversalReason: 'Duplicate accrual posted in error',
      },
    },
    {
      id: 'gle-rev-new-02',
      entryNumber: n('2606'),
      postingDate: '2026-06-11',
      documentDate: '2026-06-11',
      voucherId: 'vch-led-018',
      voucherNumber: 'REV-2026-00012',
      voucherType: 'Reversal',
      referenceNumber: 'DUPL-EB',
      externalDocumentNumber: 'EB-BILL-MAY26',
      narration: 'Reversal of duplicate electricity payable',
      debit: 12000,
      credit: 0,
      status: 'Reversal Entry',
      accountCode: '2120',
      dimensions: DIM_PROD,
      reversal: {
        originalEntryId: 'gle-rev-orig-02',
        originalVoucherNumber: 'JV-2026-00288',
        reversalEntryId: null,
        reversalVoucherNumber: null,
        reversalDate: null,
        reversalReason: 'Duplicate accrual posted in error',
      },
    },

    // —— System-generated inventory adjustment (15 Jun) ——
    { id: 'gle-adj-01', entryNumber: n('2606'), postingDate: '2026-06-15', documentDate: '2026-06-15', voucherId: 'vch-led-019', voucherNumber: 'ADJ-2026-00008', voucherType: 'Journal', referenceNumber: 'CYCLE-COUNT-JUN', externalDocumentNumber: 'CC-RM-0615', narration: 'System-generated stock adjustment — RM shrinkage', debit: 8500, credit: 0, status: 'System Generated', accountCode: '5700', dimensions: DIM_PROD, manufacturing: mfg('Material Consumption', 'Material'), createdBy: SYSTEM, postedBy: SYSTEM, sourceDocument: { module: 'Inventory', documentType: 'Stock Adjustment', documentNumber: 'CC-RM-0615', documentDate: '2026-06-15', partyName: null, amount: 8500, status: 'Posted', href: null } },
    { id: 'gle-adj-02', entryNumber: n('2606'), postingDate: '2026-06-15', documentDate: '2026-06-15', voucherId: 'vch-led-019', voucherNumber: 'ADJ-2026-00008', voucherType: 'Journal', referenceNumber: 'CYCLE-COUNT-JUN', externalDocumentNumber: 'CC-RM-0615', narration: 'RM inventory write-down — cycle count', debit: 0, credit: 8500, status: 'Adjustment', accountCode: '1141', dimensions: DIM_PROD, manufacturing: mfg('Raw Material Inventory', 'Material'), createdBy: SYSTEM, postedBy: SYSTEM },

    // —— Preview-only draft rows (Jul 2026) ——
    { id: 'gle-prv-01', entryNumber: n('2607'), postingDate: '2026-07-10', documentDate: '2026-07-10', voucherId: null, voucherNumber: 'SI-DRAFT-0412', voucherType: 'Sales Invoice', referenceNumber: 'SO-DRAFT-0412', externalDocumentNumber: '', narration: 'Preview — pending trailer dispatch invoice', debit: 885000, credit: 0, status: 'Posted', accountCode: '1131', partyKey: 'log', dimensions: DIM_ASSY, isPreviewOnly: true },
    { id: 'gle-prv-02', entryNumber: n('2607'), postingDate: '2026-07-10', documentDate: '2026-07-10', voucherId: null, voucherNumber: 'SI-DRAFT-0412', voucherType: 'Sales Invoice', referenceNumber: 'SO-DRAFT-0412', externalDocumentNumber: '', narration: 'Preview — domestic sales (not yet posted)', debit: 0, credit: 750000, status: 'Posted', accountCode: '4100', partyKey: 'log', dimensions: DIM_ASSY, isPreviewOnly: true },
  ]
}

function toEntry(d: Draft): Omit<LedgerEntry, 'runningBalance' | 'runningBalanceSide'> {
  const amount = d.debit || d.credit
  return {
    id: d.id,
    entryNumber: d.entryNumber,
    postingDate: d.postingDate,
    documentDate: d.documentDate,
    voucherId: d.voucherId,
    voucherNumber: d.voucherNumber,
    voucherType: d.voucherType,
    referenceNumber: d.referenceNumber,
    externalDocumentNumber: d.externalDocumentNumber,
    narration: d.narration,
    debit: d.debit,
    credit: d.credit,
    status: d.status,
    account: account(d.accountCode),
    party: d.partyKey ? party(d.partyKey) : null,
    dimensions: d.dimensions ?? DIM_NONE,
    manufacturing: d.manufacturing ?? MFG_NONE,
    tax: d.tax ?? TAX_NONE,
    sourceDocument: d.sourceDocument ?? null,
    reversal: d.reversal ?? null,
    currency: 'INR',
    exchangeRate: 1,
    baseCurrencyAmount: amount,
    createdBy: d.createdBy ?? ACCOUNTANT,
    createdAt: postedAt(d.documentDate, 6),
    postedBy: d.postedBy ?? USER,
    postedAt: postedAt(d.postingDate, 9),
    hasAttachments: d.hasAttachments ?? false,
    isPreviewOnly: d.isPreviewOnly ?? false,
  }
}

function computeRunningBalances(entries: Omit<LedgerEntry, 'runningBalance' | 'runningBalanceSide'>[]): LedgerEntry[] {
  const sorted = [...entries].sort(
    (a, b) => a.postingDate.localeCompare(b.postingDate) || a.entryNumber.localeCompare(b.entryNumber),
  )

  const balanceByAccount = new Map<string, number>()

  return sorted.map((e) => {
    const accId = e.account.accountId
    const prev = balanceByAccount.get(accId) ?? 0
    const isDebitNormal = e.account.normalBalance === 'Debit'
    const movement = isDebitNormal ? e.debit - e.credit : e.credit - e.debit
    const next = Math.round((prev + movement) * 100) / 100
    balanceByAccount.set(accId, next)

    const side: 'Dr' | 'Cr' = next >= 0 ? (isDebitNormal ? 'Dr' : 'Cr') : isDebitNormal ? 'Cr' : 'Dr'
    const runningBalance = Math.abs(next)

    return {
      ...e,
      runningBalance,
      runningBalanceSide: side,
    }
  })
}

export function seedLedgerEntries(): LedgerEntry[] {
  return computeRunningBalances(buildDrafts().map(toEntry))
}

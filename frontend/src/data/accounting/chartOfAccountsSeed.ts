/**
 * Indian manufacturing Chart of Accounts demo seed.
 * Keep data out of page/JSX components — mutate only via the mock service.
 */
import type {
  AccountCategory,
  AccountType,
  ChartOfAccount,
  ControlAccountType,
  GstAccountType,
  ManufacturingAccountType,
  NormalBalance,
  TdsAccountType,
} from '../../types/chartOfAccounts'
import {
  defaultDimensionConfiguration,
  defaultManufacturingConfiguration,
  defaultPostingControl,
  defaultTaxConfiguration,
} from '../../types/chartOfAccounts'

const CREATED = '2025-04-01T04:30:00.000Z'
const USER = 'System Seed'

type SeedSpec = {
  code: string
  name: string
  alias?: string
  type: AccountType
  category: AccountCategory
  parentCode: string | null
  normal: NormalBalance
  balance?: number
  system?: boolean
  control?: ControlAccountType
  recon?: boolean
  gst?: GstAccountType
  tds?: TdsAccountType
  mfg?: ManufacturingAccountType
  costCentre?: boolean
  ledger?: boolean
  inactive?: boolean
  description?: string
}

function buildAccount(spec: SeedSpec, parentId: string | null): ChartOfAccount {
  const posting = defaultPostingControl(spec.type)
  if (spec.type === 'Group') {
    posting.allowDirectPosting = false
    posting.allowManualJournalPosting = false
    posting.allowOpeningBalance = false
  }
  if (spec.control) {
    posting.isControlAccount = true
    posting.controlAccountType = spec.control
    posting.allowDirectPosting = false
    posting.allowManualJournalPosting = false
    posting.reconciliationRequired = Boolean(spec.recon) || spec.control === 'Bank'
    if (spec.control === 'Inventory') {
      posting.allowManualJournalPosting = false
    }
  }
  if (spec.recon) posting.reconciliationRequired = true
  if (spec.costCentre) posting.costCentreRequired = true

  const tax = defaultTaxConfiguration()
  if (spec.gst) {
    tax.gstRelevant = true
    tax.gstAccountType = spec.gst
    tax.statutoryAccount = true
  }
  if (spec.tds) {
    tax.tdsRelevant = true
    tax.tdsAccountType = spec.tds
    tax.statutoryAccount = true
  }

  const manufacturing = defaultManufacturingConfiguration()
  if (spec.mfg) {
    manufacturing.manufacturingAccount = true
    manufacturing.manufacturingAccountType = spec.mfg
    manufacturing.inventoryValuationAccount = [
      'Raw Material Inventory',
      'Work in Progress',
      'Finished Goods Inventory',
      'Stores and Consumables',
    ].includes(spec.mfg)
    manufacturing.consumptionAccount = spec.mfg === 'Material Consumption'
    manufacturing.wipAccount = spec.mfg === 'Work in Progress'
    manufacturing.finishedGoodsAccount = spec.mfg === 'Finished Goods Inventory'
    manufacturing.cogsAccount = spec.mfg === 'Cost of Goods Sold'
    manufacturing.purchaseVarianceAccount = spec.mfg === 'Purchase Variance'
    manufacturing.productionVarianceAccount = spec.mfg === 'Production Variance'
    manufacturing.scrapAccount = spec.mfg === 'Scrap'
    manufacturing.overheadAccount = spec.mfg === 'Factory Overhead'
    if (spec.mfg === 'Material Consumption' || spec.mfg === 'Raw Material Inventory') {
      manufacturing.costElementType = 'Material'
    } else if (spec.mfg === 'Direct Labour') {
      manufacturing.costElementType = 'Labour'
    } else if (spec.mfg === 'Factory Overhead') {
      manufacturing.costElementType = 'Overhead'
    } else if (spec.mfg === 'Subcontracting') {
      manufacturing.costElementType = 'Subcontracting'
    }
  }

  const balance = spec.balance ?? 0
  return {
    id: `coa-${spec.code}`,
    code: spec.code,
    name: spec.name,
    alias: spec.alias ?? '',
    accountType: spec.type,
    category: spec.category,
    parentId,
    normalBalance: spec.normal,
    description: spec.description ?? '',
    active: !spec.inactive,
    systemAccount: Boolean(spec.system),
    posting,
    tax,
    manufacturing,
    dimensions: defaultDimensionConfiguration(),
    currentBalance: balance,
    hasLedgerActivity: Boolean(spec.ledger) || Math.abs(balance) > 0,
    createdBy: USER,
    createdAt: CREATED,
    modifiedBy: USER,
    modifiedAt: CREATED,
    deactivatedReason: spec.inactive ? 'Legacy account retained for history' : null,
  }
}

const SPECS: SeedSpec[] = [
  // Assets
  { code: '1000', name: 'Assets', type: 'Group', category: 'Asset', parentCode: null, normal: 'Debit', system: true },
  { code: '1100', name: 'Current Assets', type: 'Group', category: 'Asset', parentCode: '1000', normal: 'Debit', system: true },
  { code: '1110', name: 'Cash and Bank', type: 'Group', category: 'Asset', parentCode: '1100', normal: 'Debit' },
  { code: '1111', name: 'Cash in Hand', alias: 'Cash', type: 'Posting', category: 'Asset', parentCode: '1110', normal: 'Debit', balance: 185000, control: 'Cash', ledger: true },
  { code: '1112', name: 'HDFC Bank — Current A/c', alias: 'HDFC', type: 'Posting', category: 'Asset', parentCode: '1110', normal: 'Debit', balance: 4250000, control: 'Bank', recon: true, ledger: true },
  { code: '1113', name: 'ICICI Bank — Current A/c', alias: 'ICICI', type: 'Posting', category: 'Asset', parentCode: '1110', normal: 'Debit', balance: 1180000, control: 'Bank', recon: true, ledger: true },
  { code: '1120', name: 'Bank Accounts', type: 'Group', category: 'Asset', parentCode: '1100', normal: 'Debit' },
  { code: '1130', name: 'Trade Receivables', type: 'Group', category: 'Asset', parentCode: '1100', normal: 'Debit' },
  { code: '1131', name: 'Trade Debtors', alias: 'AR', type: 'Posting', category: 'Asset', parentCode: '1130', normal: 'Debit', balance: 8420000, control: 'Customer Receivable', system: true, ledger: true },
  { code: '1140', name: 'Inventory', type: 'Group', category: 'Asset', parentCode: '1100', normal: 'Debit' },
  { code: '1141', name: 'Raw Material Inventory', type: 'Posting', category: 'Asset', parentCode: '1140', normal: 'Debit', balance: 6120000, control: 'Inventory', mfg: 'Raw Material Inventory', system: true, ledger: true },
  { code: '1142', name: 'Work in Progress Inventory', type: 'Posting', category: 'Asset', parentCode: '1140', normal: 'Debit', balance: 1840000, control: 'Inventory', mfg: 'Work in Progress', system: true, ledger: true },
  { code: '1143', name: 'Finished Goods Inventory', type: 'Posting', category: 'Asset', parentCode: '1140', normal: 'Debit', balance: 2960000, control: 'Inventory', mfg: 'Finished Goods Inventory', system: true, ledger: true },
  { code: '1144', name: 'Stores and Consumables', type: 'Posting', category: 'Asset', parentCode: '1140', normal: 'Debit', balance: 420000, control: 'Inventory', mfg: 'Stores and Consumables', ledger: true },
  { code: '1150', name: 'Advances and Deposits', type: 'Group', category: 'Asset', parentCode: '1100', normal: 'Debit' },
  { code: '1151', name: 'Vendor Advances', type: 'Posting', category: 'Asset', parentCode: '1150', normal: 'Debit', balance: 275000, ledger: true },
  { code: '1152', name: 'Security Deposits', type: 'Posting', category: 'Asset', parentCode: '1150', normal: 'Debit', balance: 150000 },
  { code: '1180', name: 'Input GST', type: 'Group', category: 'Asset', parentCode: '1100', normal: 'Debit' },
  { code: '1181', name: 'Input CGST', type: 'Posting', category: 'Asset', parentCode: '1180', normal: 'Debit', balance: 312000, control: 'GST', gst: 'Input CGST', system: true, ledger: true },
  { code: '1182', name: 'Input SGST', type: 'Posting', category: 'Asset', parentCode: '1180', normal: 'Debit', balance: 312000, control: 'GST', gst: 'Input SGST', system: true, ledger: true },
  { code: '1183', name: 'Input IGST', type: 'Posting', category: 'Asset', parentCode: '1180', normal: 'Debit', balance: 145000, control: 'GST', gst: 'Input IGST', system: true, ledger: true },
  { code: '1184', name: 'TDS Receivable', type: 'Posting', category: 'Asset', parentCode: '1180', normal: 'Debit', balance: 96000, control: 'TDS', tds: 'TDS Receivable', ledger: true },
  { code: '1200', name: 'Fixed Assets', type: 'Group', category: 'Asset', parentCode: '1000', normal: 'Debit', system: true },
  { code: '1210', name: 'Land and Building', type: 'Posting', category: 'Asset', parentCode: '1200', normal: 'Debit', balance: 8500000, control: 'Fixed Asset', ledger: true },
  { code: '1220', name: 'Plant and Machinery', type: 'Posting', category: 'Asset', parentCode: '1200', normal: 'Debit', balance: 18500000, control: 'Fixed Asset', ledger: true },
  { code: '1230', name: 'Furniture and Fixtures', type: 'Posting', category: 'Asset', parentCode: '1200', normal: 'Debit', balance: 920000, control: 'Fixed Asset' },
  { code: '1240', name: 'Computers and Equipment', type: 'Posting', category: 'Asset', parentCode: '1200', normal: 'Debit', balance: 680000, control: 'Fixed Asset' },
  { code: '1290', name: 'Accumulated Depreciation', type: 'Posting', category: 'Asset', parentCode: '1200', normal: 'Credit', balance: -4200000, system: true, ledger: true },
  { code: '1300', name: 'Other Assets', type: 'Group', category: 'Asset', parentCode: '1000', normal: 'Debit' },
  { code: '1310', name: 'Prepaid Expenses', type: 'Posting', category: 'Asset', parentCode: '1300', normal: 'Debit', balance: 85000 },

  // Liabilities
  { code: '2000', name: 'Liabilities', type: 'Group', category: 'Liability', parentCode: null, normal: 'Credit', system: true },
  { code: '2100', name: 'Current Liabilities', type: 'Group', category: 'Liability', parentCode: '2000', normal: 'Credit', system: true },
  { code: '2110', name: 'Trade Payables', type: 'Group', category: 'Liability', parentCode: '2100', normal: 'Credit' },
  { code: '2111', name: 'Trade Creditors', alias: 'AP', type: 'Posting', category: 'Liability', parentCode: '2110', normal: 'Credit', balance: 5240000, control: 'Vendor Payable', system: true, ledger: true },
  { code: '2120', name: 'Expenses Payable', type: 'Posting', category: 'Liability', parentCode: '2100', normal: 'Credit', balance: 340000, ledger: true },
  { code: '2130', name: 'GST Payable', type: 'Group', category: 'Liability', parentCode: '2100', normal: 'Credit' },
  { code: '2131', name: 'Output CGST', type: 'Posting', category: 'Liability', parentCode: '2130', normal: 'Credit', balance: 218000, control: 'GST', gst: 'Output CGST', system: true, ledger: true },
  { code: '2132', name: 'Output SGST', type: 'Posting', category: 'Liability', parentCode: '2130', normal: 'Credit', balance: 218000, control: 'GST', gst: 'Output SGST', system: true, ledger: true },
  { code: '2133', name: 'Output IGST', type: 'Posting', category: 'Liability', parentCode: '2130', normal: 'Credit', balance: 96000, control: 'GST', gst: 'Output IGST', system: true, ledger: true },
  { code: '2140', name: 'TDS Payable', type: 'Posting', category: 'Liability', parentCode: '2100', normal: 'Credit', balance: 64000, control: 'TDS', tds: 'TDS Payable', system: true, ledger: true },
  { code: '2150', name: 'Salary Payable', type: 'Posting', category: 'Liability', parentCode: '2100', normal: 'Credit', balance: 1120000, control: 'Payroll', ledger: true },
  { code: '2160', name: 'Statutory Liabilities', type: 'Group', category: 'Liability', parentCode: '2100', normal: 'Credit' },
  { code: '2161', name: 'PF Payable', type: 'Posting', category: 'Liability', parentCode: '2160', normal: 'Credit', balance: 185000, ledger: true },
  { code: '2162', name: 'ESI Payable', type: 'Posting', category: 'Liability', parentCode: '2160', normal: 'Credit', balance: 42000 },
  { code: '2200', name: 'Long-Term Liabilities', type: 'Group', category: 'Liability', parentCode: '2000', normal: 'Credit' },
  { code: '2210', name: 'Secured Loans', type: 'Posting', category: 'Liability', parentCode: '2200', normal: 'Credit', balance: 9500000, control: 'Loan', ledger: true },
  { code: '2220', name: 'Unsecured Loans', type: 'Posting', category: 'Liability', parentCode: '2200', normal: 'Credit', balance: 1500000, control: 'Loan' },

  // Equity
  { code: '3000', name: 'Equity', type: 'Group', category: 'Equity', parentCode: null, normal: 'Credit', system: true },
  { code: '3100', name: 'Share Capital', type: 'Posting', category: 'Equity', parentCode: '3000', normal: 'Credit', balance: 15000000, system: true, ledger: true },
  { code: '3200', name: 'Reserves and Surplus', type: 'Posting', category: 'Equity', parentCode: '3000', normal: 'Credit', balance: 4200000, ledger: true },
  { code: '3300', name: 'Retained Earnings', type: 'Posting', category: 'Equity', parentCode: '3000', normal: 'Credit', balance: 1980000, system: true, ledger: true },
  { code: '3400', name: 'Current Year Profit and Loss', type: 'Posting', category: 'Equity', parentCode: '3000', normal: 'Credit', balance: 0, system: true },

  // Income
  { code: '4000', name: 'Income', type: 'Group', category: 'Income', parentCode: null, normal: 'Credit', system: true },
  { code: '4100', name: 'Domestic Sales', alias: 'Sales', type: 'Posting', category: 'Income', parentCode: '4000', normal: 'Credit', balance: 0, ledger: true },
  { code: '4200', name: 'Export Sales', type: 'Posting', category: 'Income', parentCode: '4000', normal: 'Credit', balance: 0 },
  { code: '4300', name: 'Job Work Income', type: 'Posting', category: 'Income', parentCode: '4000', normal: 'Credit', balance: 0 },
  { code: '4400', name: 'Scrap Sales', type: 'Posting', category: 'Income', parentCode: '4000', normal: 'Credit', balance: 0, mfg: 'Scrap' },
  { code: '4500', name: 'Service Income', type: 'Posting', category: 'Income', parentCode: '4000', normal: 'Credit', balance: 0 },
  { code: '4900', name: 'Other Income', type: 'Posting', category: 'Income', parentCode: '4000', normal: 'Credit', balance: 0 },

  // COGS / Manufacturing expenses
  { code: '5000', name: 'Cost of Goods Sold', type: 'Group', category: 'Expense', parentCode: null, normal: 'Debit', system: true },
  { code: '5100', name: 'Raw Material Consumption', type: 'Posting', category: 'Expense', parentCode: '5000', normal: 'Debit', balance: 0, mfg: 'Material Consumption', costCentre: true, ledger: true },
  { code: '5200', name: 'Direct Labour', type: 'Posting', category: 'Expense', parentCode: '5000', normal: 'Debit', balance: 0, mfg: 'Direct Labour', costCentre: true },
  { code: '5300', name: 'Factory Overheads', type: 'Posting', category: 'Expense', parentCode: '5000', normal: 'Debit', balance: 0, mfg: 'Factory Overhead', costCentre: true },
  { code: '5400', name: 'Subcontracting Charges', type: 'Posting', category: 'Expense', parentCode: '5000', normal: 'Debit', balance: 0, mfg: 'Subcontracting' },
  { code: '5500', name: 'Production Variance', type: 'Posting', category: 'Expense', parentCode: '5000', normal: 'Debit', balance: 0, mfg: 'Production Variance' },
  { code: '5600', name: 'Purchase Variance', type: 'Posting', category: 'Expense', parentCode: '5000', normal: 'Debit', balance: 0, mfg: 'Purchase Variance' },
  { code: '5700', name: 'Inventory Adjustment', type: 'Posting', category: 'Expense', parentCode: '5000', normal: 'Debit', balance: 0 },
  { code: '5800', name: 'Cost of Goods Sold Expense', alias: 'COGS', type: 'Posting', category: 'Expense', parentCode: '5000', normal: 'Debit', balance: 0, mfg: 'Cost of Goods Sold', system: true },

  // Operating expenses
  { code: '6000', name: 'Operating Expenses', type: 'Group', category: 'Expense', parentCode: null, normal: 'Debit', system: true },
  { code: '6100', name: 'Administrative Expenses', type: 'Posting', category: 'Expense', parentCode: '6000', normal: 'Debit', balance: 0, costCentre: true },
  { code: '6200', name: 'Selling and Distribution Expenses', type: 'Posting', category: 'Expense', parentCode: '6000', normal: 'Debit', balance: 0 },
  { code: '6300', name: 'Employee Expenses', type: 'Posting', category: 'Expense', parentCode: '6000', normal: 'Debit', balance: 0, costCentre: true },
  { code: '6400', name: 'Repairs and Maintenance', type: 'Posting', category: 'Expense', parentCode: '6000', normal: 'Debit', balance: 0 },
  { code: '6500', name: 'Freight and Transportation', type: 'Posting', category: 'Expense', parentCode: '6000', normal: 'Debit', balance: 0 },
  { code: '6600', name: 'Finance Costs', type: 'Posting', category: 'Expense', parentCode: '6000', normal: 'Debit', balance: 0 },
  { code: '6700', name: 'Depreciation', type: 'Posting', category: 'Expense', parentCode: '6000', normal: 'Debit', balance: 0, system: true },
  { code: '6900', name: 'Obsolete Misc Expense', type: 'Posting', category: 'Expense', parentCode: '6000', normal: 'Debit', balance: 0, inactive: true, description: 'Kept for historical journals only' },
]

export function seedChartOfAccountsDemo(): ChartOfAccount[] {
  const byCode = new Map<string, ChartOfAccount>()
  for (const spec of SPECS) {
    const parentId = spec.parentCode ? byCode.get(spec.parentCode)?.id ?? null : null
    const account = buildAccount(spec, parentId)
    byCode.set(spec.code, account)
  }
  return [...byCode.values()]
}

/** Dimension master options for CoA form lookups (not hardcoded in JSX). */
export function seedCoaDimensionLookups() {
  return {
    costCentres: [
      { id: 'cc-prod', code: 'CC-PROD', name: 'Production' },
      { id: 'cc-admin', code: 'CC-ADMIN', name: 'Administration' },
      { id: 'cc-sales', code: 'CC-SALES', name: 'Sales & Marketing' },
      { id: 'cc-maint', code: 'CC-MAINT', name: 'Maintenance' },
    ],
    departments: [
      { id: 'dept-fab', code: 'FAB', name: 'Fabrication' },
      { id: 'dept-assy', code: 'ASSY', name: 'Assembly' },
      { id: 'dept-qc', code: 'QC', name: 'Quality' },
      { id: 'dept-fin', code: 'FIN', name: 'Finance' },
    ],
    projects: [
      { id: 'prj-t40', code: 'PRJ-T40', name: 'Trailer 40 FT Program' },
      { id: 'prj-tip', code: 'PRJ-TIP', name: 'Tipper Series' },
    ],
    plants: [
      { id: 'plt-main', code: 'PLT-01', name: 'Main Plant — Pune' },
      { id: 'plt-unit2', code: 'PLT-02', name: 'Unit 2 — Chakan' },
    ],
    locations: [
      { id: 'loc-rm', code: 'WH-RM', name: 'RM Stores' },
      { id: 'loc-fg', code: 'WH-FG', name: 'FG Yard' },
      { id: 'loc-off', code: 'OFF-HQ', name: 'Head Office' },
    ],
  }
}

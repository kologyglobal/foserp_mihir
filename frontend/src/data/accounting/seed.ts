/**
 * Demo seed data for the Accounting module — UI/localStorage only.
 */
import type {
  AccountingDimension,
  AccountingPeriodSetup,
  BankReconciliationSession,
  BankStatementLine,
  CashBankAccountSummary,
  CostVarianceRow,
  GrniRow,
  GstSummaryRow,
  InventoryValuationRow,
  InvVsGlRow,
  LedgerAccount,
  OpenItemEntry,
  PeriodCloseChecklist,
  PostingSetupRule,
  ProductionOrderCostMock,
  TdsEntryRow,
  Voucher,
  VoucherLine,
  WipRow,
} from '../../types/accounting'
import { buildLedgerEntriesFromVoucher, genAccountingId } from '../../utils/accounting/ledgerEngine'

const NOW = new Date()
const FY_YEAR = NOW.getFullYear()
const iso = (y: number, m: number, d: number) => new Date(y, m - 1, d).toISOString()
const dateOnly = (y: number, m: number, d: number) => new Date(y, m - 1, d).toISOString().slice(0, 10)

function account(
  code: string,
  name: string,
  parentId: string | null,
  groupType: LedgerAccount['groupType'],
  nature: LedgerAccount['nature'],
  opts: Partial<LedgerAccount> = {},
): LedgerAccount {
  return {
    id: `acc-${code}`,
    code,
    name,
    parentId,
    groupType,
    nature,
    isGroup: opts.isGroup ?? false,
    isPostable: opts.isPostable ?? !opts.isGroup,
    isActive: true,
    currency: 'INR',
    openingBalance: opts.openingBalance ?? 0,
    openingBalanceType: opts.openingBalanceType ?? nature,
    linkedTo: opts.linkedTo ?? null,
    description: opts.description,
    costCenterRequired: opts.costCenterRequired ?? false,
    createdAt: iso(FY_YEAR - 1, 4, 1),
    updatedAt: iso(FY_YEAR - 1, 4, 1),
  }
}

export function seedChartOfAccounts(): LedgerAccount[] {
  return [
    // ASSETS
    account('1000', 'Assets', null, 'asset', 'debit', { isGroup: true }),
    account('1100', 'Current Assets', 'acc-1000', 'asset', 'debit', { isGroup: true }),
    account('1110', 'Cash & Bank', 'acc-1100', 'asset', 'debit', { isGroup: true }),
    account('1111', 'Cash in Hand', 'acc-1110', 'asset', 'debit', { linkedTo: 'cash', openingBalance: 185000 }),
    account('1112', 'HDFC Bank — Current A/c', 'acc-1110', 'asset', 'debit', { linkedTo: 'bank', openingBalance: 4250000 }),
    account('1113', 'ICICI Bank — Current A/c', 'acc-1110', 'asset', 'debit', { linkedTo: 'bank', openingBalance: 1180000 }),
    account('1120', 'Accounts Receivable', 'acc-1100', 'asset', 'debit', { isGroup: true }),
    account('1121', 'Trade Debtors', 'acc-1120', 'asset', 'debit', { linkedTo: 'customer', openingBalance: 8420000 }),
    account('1130', 'Inventory', 'acc-1100', 'asset', 'debit', { isGroup: true }),
    account('1131', 'Raw Material Stock', 'acc-1130', 'asset', 'debit', { openingBalance: 6120000 }),
    account('1132', 'Work-In-Progress Stock', 'acc-1130', 'asset', 'debit', { openingBalance: 1840000 }),
    account('1133', 'Finished Goods Stock', 'acc-1130', 'asset', 'debit', { openingBalance: 2960000 }),
    account('1140', 'Input Tax Credit', 'acc-1100', 'asset', 'debit', { isGroup: true }),
    account('1141', 'Input CGST', 'acc-1140', 'asset', 'debit', { openingBalance: 312000 }),
    account('1142', 'Input SGST', 'acc-1140', 'asset', 'debit', { openingBalance: 312000 }),
    account('1143', 'Input IGST', 'acc-1140', 'asset', 'debit', { openingBalance: 145000 }),
    account('1144', 'TDS Receivable', 'acc-1140', 'asset', 'debit', { openingBalance: 96000 }),
    account('1200', 'Fixed Assets', 'acc-1000', 'asset', 'debit', { isGroup: true }),
    account('1210', 'Plant & Machinery', 'acc-1200', 'asset', 'debit', { openingBalance: 18500000 }),
    account('1220', 'Furniture & Fixtures', 'acc-1200', 'asset', 'debit', { openingBalance: 920000 }),
    account('1230', 'Accumulated Depreciation', 'acc-1200', 'asset', 'credit', { openingBalance: 4200000, openingBalanceType: 'credit' }),

    // LIABILITIES
    account('2000', 'Liabilities', null, 'liability', 'credit', { isGroup: true }),
    account('2100', 'Current Liabilities', 'acc-2000', 'liability', 'credit', { isGroup: true }),
    account('2110', 'Accounts Payable', 'acc-2100', 'liability', 'credit', { isGroup: true }),
    account('2111', 'Trade Creditors', 'acc-2110', 'liability', 'credit', { linkedTo: 'vendor', openingBalance: 5240000 }),
    account('2120', 'Output Tax Payable', 'acc-2100', 'liability', 'credit', { isGroup: true }),
    account('2121', 'Output CGST', 'acc-2120', 'liability', 'credit', { openingBalance: 218000 }),
    account('2122', 'Output SGST', 'acc-2120', 'liability', 'credit', { openingBalance: 218000 }),
    account('2123', 'Output IGST', 'acc-2120', 'liability', 'credit', { openingBalance: 96000 }),
    account('2130', 'TDS Payable', 'acc-2100', 'liability', 'credit', { openingBalance: 64000 }),
    account('2140', 'Salary Payable', 'acc-2100', 'liability', 'credit', { openingBalance: 1120000 }),
    account('2200', 'Long Term Liabilities', 'acc-2000', 'liability', 'credit', { isGroup: true }),
    account('2210', 'Term Loan — Bank', 'acc-2200', 'liability', 'credit', { openingBalance: 9500000 }),

    // EQUITY
    account('3000', 'Equity', null, 'equity', 'credit', { isGroup: true }),
    account('3100', 'Share Capital', 'acc-3000', 'equity', 'credit', { openingBalance: 15000000 }),
    account('3200', 'Retained Earnings', 'acc-3000', 'equity', 'credit', { openingBalance: 6180000 }),

    // INCOME
    account('4000', 'Income', null, 'income', 'credit', { isGroup: true }),
    account('4100', 'Sales Revenue', 'acc-4000', 'income', 'credit', { isGroup: true }),
    account('4110', 'Domestic Sales', 'acc-4100', 'income', 'credit'),
    account('4120', 'Export Sales', 'acc-4100', 'income', 'credit'),
    account('4200', 'Other Income', 'acc-4000', 'income', 'credit', { isGroup: true }),
    account('4210', 'Interest Income', 'acc-4200', 'income', 'credit'),
    account('4220', 'Scrap Sales', 'acc-4200', 'income', 'credit'),

    // EXPENSES
    account('5000', 'Expenses', null, 'expense', 'debit', { isGroup: true }),
    account('5100', 'Cost of Goods Sold', 'acc-5000', 'expense', 'debit', { isGroup: true }),
    account('5110', 'Raw Material Consumption', 'acc-5100', 'expense', 'debit'),
    account('5120', 'Direct Labour', 'acc-5100', 'expense', 'debit'),
    account('5130', 'Manufacturing Overheads', 'acc-5100', 'expense', 'debit'),
    account('5200', 'Operating Expenses', 'acc-5000', 'expense', 'debit', { isGroup: true }),
    account('5210', 'Salaries & Wages', 'acc-5200', 'expense', 'debit', { costCenterRequired: true }),
    account('5220', 'Rent', 'acc-5200', 'expense', 'debit', { costCenterRequired: true }),
    account('5230', 'Utilities — Power & Water', 'acc-5200', 'expense', 'debit', { costCenterRequired: true }),
    account('5240', 'Freight & Forwarding', 'acc-5200', 'expense', 'debit'),
    account('5250', 'Office & Admin Expenses', 'acc-5200', 'expense', 'debit', { costCenterRequired: true }),
    account('5260', 'Repairs & Maintenance', 'acc-5200', 'expense', 'debit'),
    account('5300', 'Finance Costs', 'acc-5000', 'expense', 'debit', { isGroup: true }),
    account('5310', 'Bank Charges', 'acc-5300', 'expense', 'debit'),
    account('5320', 'Interest Paid', 'acc-5300', 'expense', 'debit'),
    account('5400', 'Depreciation', 'acc-5000', 'expense', 'debit'),
  ]
}

function line(
  no: number,
  accountId: string,
  debit: number,
  credit: number,
  narration: string,
  extra: Partial<VoucherLine> = {},
): VoucherLine {
  return { id: genAccountingId('vl'), lineNo: no, accountId, debit, credit, narration, ...extra }
}

function voucher(input: {
  no: string
  type: Voucher['voucherType']
  date: string
  narration: string
  status: Voucher['status']
  lines: VoucherLine[]
  source?: Voucher['sourceDocument']
  bankAccountId?: string | null
  paymentMode?: Voucher['paymentMode']
  refNo?: string
  createdBy: string
  createdAt: string
  approvedBy?: string
  approvedAt?: string
  postedBy?: string
  postedAt?: string
  rejectedReason?: string
  partyType?: Voucher['partyType']
  partyId?: string
}): Voucher {
  const totalDebit = Math.round(input.lines.reduce((s, l) => s + l.debit, 0) * 100) / 100
  const totalCredit = Math.round(input.lines.reduce((s, l) => s + l.credit, 0) * 100) / 100
  return {
    id: genAccountingId('vch'),
    voucherNo: input.no,
    voucherType: input.type,
    voucherDate: input.date,
    narration: input.narration,
    status: input.status,
    lines: input.lines,
    totalDebit,
    totalCredit,
    sourceDocument: input.source ?? null,
    referenceNo: input.refNo,
    bankAccountId: input.bankAccountId ?? null,
    paymentMode: input.paymentMode ?? null,
    partyType: input.partyType ?? null,
    partyId: input.partyId ?? null,
    createdBy: input.createdBy,
    createdAt: input.createdAt,
    updatedAt: input.createdAt,
    approvedBy: input.approvedBy ?? null,
    approvedAt: input.approvedAt ?? null,
    postedBy: input.postedBy ?? null,
    postedAt: input.postedAt ?? null,
    rejectedReason: input.rejectedReason ?? null,
    reversedByVoucherId: null,
    reversalOfVoucherId: null,
    attachments: [],
  }
}

export function seedVouchers(): Voucher[] {
  const m = NOW.getMonth() + 1
  const y = FY_YEAR

  const vouchers: Voucher[] = [
    voucher({
      no: `RCT-${y}-0001`,
      type: 'receipt',
      date: dateOnly(y, m, 3),
      narration: 'Receipt from Bharat Trailers & Fabrication against SO-2201',
      status: 'posted',
      lines: [
        line(1, 'acc-1112', 685000, 0, 'Received via NEFT'),
        line(2, 'acc-1121', 0, 685000, 'Against outstanding invoice INV-2201', { partyType: 'customer', partyId: 'cust-bharat-trailers' }),
      ],
      source: { type: 'invoice', id: 'INV-2201', label: 'Sales Invoice INV-2201' },
      bankAccountId: 'acc-1112',
      paymentMode: 'neft',
      partyType: 'customer',
      partyId: 'cust-bharat-trailers',
      createdBy: 'Priya Sharma (Accountant)',
      createdAt: iso(y, m, 3),
      approvedBy: 'Rakesh Iyer (Finance Manager)',
      approvedAt: iso(y, m, 3),
      postedBy: 'Rakesh Iyer (Finance Manager)',
      postedAt: iso(y, m, 3),
    }),
    voucher({
      no: `PMT-${y}-0001`,
      type: 'payment',
      date: dateOnly(y, m, 4),
      narration: 'Payment to Suresh Steel Traders against PO-1105',
      status: 'posted',
      lines: [
        line(1, 'acc-2111', 412000, 0, 'Settling outstanding vendor invoice', { partyType: 'vendor', partyId: 'vend-suresh-steel' }),
        line(2, 'acc-1112', 0, 412000, 'Paid via RTGS'),
      ],
      source: { type: 'purchase_order', id: 'PO-1105', label: 'Purchase Order PO-1105' },
      bankAccountId: 'acc-1112',
      paymentMode: 'rtgs',
      partyType: 'vendor',
      partyId: 'vend-suresh-steel',
      createdBy: 'Priya Sharma (Accountant)',
      createdAt: iso(y, m, 4),
      approvedBy: 'Rakesh Iyer (Finance Manager)',
      approvedAt: iso(y, m, 4),
      postedBy: 'Rakesh Iyer (Finance Manager)',
      postedAt: iso(y, m, 4),
    }),
    voucher({
      no: `JV-${y}-0001`,
      type: 'journal',
      date: dateOnly(y, m, 5),
      narration: 'Depreciation for the month — Plant & Machinery',
      status: 'posted',
      lines: [
        line(1, 'acc-5400', 154000, 0, 'Monthly depreciation charge'),
        line(2, 'acc-1230', 0, 154000, 'Accumulated depreciation — P&M'),
      ],
      createdBy: 'Priya Sharma (Accountant)',
      createdAt: iso(y, m, 5),
      approvedBy: 'Rakesh Iyer (Finance Manager)',
      approvedAt: iso(y, m, 5),
      postedBy: 'Rakesh Iyer (Finance Manager)',
      postedAt: iso(y, m, 5),
    }),
    voucher({
      no: `CTR-${y}-0001`,
      type: 'contra',
      date: dateOnly(y, m, 6),
      narration: 'Cash deposited into HDFC Bank current account',
      status: 'posted',
      lines: [
        line(1, 'acc-1112', 90000, 0, 'Cash deposit'),
        line(2, 'acc-1111', 0, 90000, 'Cash withdrawn for deposit'),
      ],
      bankAccountId: 'acc-1112',
      paymentMode: 'cash',
      createdBy: 'Meena Nair (Cashier)',
      createdAt: iso(y, m, 6),
      approvedBy: 'Rakesh Iyer (Finance Manager)',
      approvedAt: iso(y, m, 6),
      postedBy: 'Rakesh Iyer (Finance Manager)',
      postedAt: iso(y, m, 6),
    }),
    voucher({
      no: `PMT-${y}-0002`,
      type: 'payment',
      date: dateOnly(y, m, 8),
      narration: 'Salary payment — production staff',
      status: 'posted',
      lines: [
        line(1, 'acc-2140', 1120000, 0, 'Salary payable cleared'),
        line(2, 'acc-1112', 0, 1120000, 'Paid via bank transfer'),
      ],
      bankAccountId: 'acc-1112',
      paymentMode: 'bank',
      createdBy: 'Priya Sharma (Accountant)',
      createdAt: iso(y, m, 8),
      approvedBy: 'Rakesh Iyer (Finance Manager)',
      approvedAt: iso(y, m, 8),
      postedBy: 'Rakesh Iyer (Finance Manager)',
      postedAt: iso(y, m, 8),
    }),
    voucher({
      no: `RCT-${y}-0002`,
      type: 'receipt',
      date: dateOnly(y, m, 9),
      narration: 'Advance received — Konkan Logistics Pvt Ltd',
      status: 'posted',
      lines: [
        line(1, 'acc-1112', 250000, 0, 'Advance receipt via UPI'),
        line(2, 'acc-1121', 0, 250000, 'On account advance', { partyType: 'customer', partyId: 'cust-konkan-logistics' }),
      ],
      bankAccountId: 'acc-1112',
      paymentMode: 'upi',
      partyType: 'customer',
      partyId: 'cust-konkan-logistics',
      createdBy: 'Priya Sharma (Accountant)',
      createdAt: iso(y, m, 9),
      approvedBy: 'Rakesh Iyer (Finance Manager)',
      approvedAt: iso(y, m, 9),
      postedBy: 'Rakesh Iyer (Finance Manager)',
      postedAt: iso(y, m, 9),
    }),
    voucher({
      no: `JV-${y}-0002`,
      type: 'journal',
      date: dateOnly(y, m, 10),
      narration: 'GST set-off — CGST/SGST input against output for the period',
      status: 'posted',
      lines: [
        line(1, 'acc-2121', 218000, 0, 'Output CGST set off'),
        line(2, 'acc-2122', 218000, 0, 'Output SGST set off'),
        line(3, 'acc-1141', 0, 218000, 'Input CGST utilised'),
        line(4, 'acc-1142', 0, 218000, 'Input SGST utilised'),
      ],
      createdBy: 'Priya Sharma (Accountant)',
      createdAt: iso(y, m, 10),
      approvedBy: 'Rakesh Iyer (Finance Manager)',
      approvedAt: iso(y, m, 10),
      postedBy: 'Rakesh Iyer (Finance Manager)',
      postedAt: iso(y, m, 10),
    }),
    voucher({
      no: `PMT-${y}-0003`,
      type: 'payment',
      date: dateOnly(y, m, 12),
      narration: 'Factory rent — current month',
      status: 'approved',
      lines: [
        line(1, 'acc-5220', 180000, 0, 'Rent for the month', { dimension1: 'dept-production' }),
        line(2, 'acc-1112', 0, 180000, 'Paid via bank transfer'),
      ],
      bankAccountId: 'acc-1112',
      paymentMode: 'bank',
      createdBy: 'Priya Sharma (Accountant)',
      createdAt: iso(y, m, 12),
      approvedBy: 'Rakesh Iyer (Finance Manager)',
      approvedAt: iso(y, m, 12),
    }),
    voucher({
      no: `RCT-${y}-0003`,
      type: 'receipt',
      date: dateOnly(y, m, 13),
      narration: 'Receipt from Godavari Roadlines — partial settlement',
      status: 'pending_approval',
      lines: [
        line(1, 'acc-1112', 320000, 0, 'Received via NEFT'),
        line(2, 'acc-1121', 0, 320000, 'Partial settlement of INV-2214', { partyType: 'customer', partyId: 'cust-godavari-roadlines' }),
      ],
      source: { type: 'invoice', id: 'INV-2214', label: 'Sales Invoice INV-2214' },
      bankAccountId: 'acc-1112',
      paymentMode: 'neft',
      partyType: 'customer',
      partyId: 'cust-godavari-roadlines',
      createdBy: 'Meena Nair (Cashier)',
      createdAt: iso(y, m, 13),
    }),
    voucher({
      no: `JV-${y}-0003`,
      type: 'journal',
      date: dateOnly(y, m, 14),
      narration: 'Provision for utilities — power & water (accrual)',
      status: 'draft',
      lines: [
        line(1, 'acc-5230', 96000, 0, 'Utilities accrual', { dimension1: 'dept-production' }),
        line(2, 'acc-2100', 0, 96000, 'Provision for expenses'),
      ],
      createdBy: 'Priya Sharma (Accountant)',
      createdAt: iso(y, m, 14),
    }),
    voucher({
      no: `PMT-${y}-0004`,
      type: 'payment',
      date: dateOnly(y, m, 2),
      narration: 'Vendor advance to Om Fabricators Pvt Ltd — rejected, incorrect account head',
      status: 'rejected',
      lines: [
        line(1, 'acc-2111', 150000, 0, 'Advance to vendor', { partyType: 'vendor', partyId: 'vend-om-fabricators' }),
        line(2, 'acc-1112', 0, 150000, 'Paid via bank transfer'),
      ],
      bankAccountId: 'acc-1112',
      paymentMode: 'bank',
      partyType: 'vendor',
      partyId: 'vend-om-fabricators',
      createdBy: 'Meena Nair (Cashier)',
      createdAt: iso(y, m, 2),
      rejectedReason: 'Incorrect ledger head — resubmit against Trade Creditors sub-ledger with vendor bill reference.',
    }),
    voucher({
      no: `CTR-${y}-0002`,
      type: 'contra',
      date: dateOnly(y, m, 15),
      narration: 'Transfer between HDFC and ICICI current accounts',
      status: 'posted',
      lines: [
        line(1, 'acc-1113', 200000, 0, 'Fund transfer received'),
        line(2, 'acc-1112', 0, 200000, 'Fund transfer sent'),
      ],
      bankAccountId: 'acc-1112',
      paymentMode: 'neft',
      createdBy: 'Priya Sharma (Accountant)',
      createdAt: iso(y, m, 15),
      approvedBy: 'Rakesh Iyer (Finance Manager)',
      approvedAt: iso(y, m, 15),
      postedBy: 'Rakesh Iyer (Finance Manager)',
      postedAt: iso(y, m, 15),
    }),
  ]

  return vouchers
}

export function seedOpenReceivables(): OpenItemEntry[] {
  const m = NOW.getMonth() + 1
  const y = FY_YEAR
  return [
    { id: genAccountingId('oi'), partyType: 'customer', partyId: 'cust-bharat-trailers', partyName: 'Bharat Trailers & Fabrication', documentType: 'invoice', documentNo: 'INV-2201', documentDate: dateOnly(y, m, 1), dueDate: dateOnly(y, m, 31), amount: 685000, amountSettled: 685000, balance: 0, sourceDocument: { type: 'invoice', id: 'INV-2201', label: 'Sales Invoice INV-2201' } },
    { id: genAccountingId('oi'), partyType: 'customer', partyId: 'cust-konkan-logistics', partyName: 'Konkan Logistics Pvt Ltd', documentType: 'invoice', documentNo: 'INV-2208', documentDate: dateOnly(y, m - 1 <= 0 ? 12 : m - 1, 18), dueDate: dateOnly(y, m, 17), amount: 940000, amountSettled: 0, balance: 940000, sourceDocument: { type: 'invoice', id: 'INV-2208', label: 'Sales Invoice INV-2208' } },
    { id: genAccountingId('oi'), partyType: 'customer', partyId: 'cust-godavari-roadlines', partyName: 'Godavari Roadlines', documentType: 'invoice', documentNo: 'INV-2214', documentDate: dateOnly(y, m, 13), dueDate: dateOnly(y, m + 1 > 12 ? 1 : m + 1, 12), amount: 620000, amountSettled: 320000, balance: 300000, sourceDocument: { type: 'invoice', id: 'INV-2214', label: 'Sales Invoice INV-2214' } },
    { id: genAccountingId('oi'), partyType: 'customer', partyId: 'cust-sahyadri-carriers', partyName: 'Sahyadri Carriers', documentType: 'invoice', documentNo: 'INV-2150', documentDate: dateOnly(y, m - 2 <= 0 ? 10 : m - 2, 5), dueDate: dateOnly(y, m - 1 <= 0 ? 11 : m - 1, 4), amount: 1250000, amountSettled: 0, balance: 1250000, sourceDocument: { type: 'invoice', id: 'INV-2150', label: 'Sales Invoice INV-2150' } },
    { id: genAccountingId('oi'), partyType: 'customer', partyId: 'cust-deccan-freight', partyName: 'Deccan Freight Movers', documentType: 'invoice', documentNo: 'INV-2098', documentDate: dateOnly(y, m - 3 <= 0 ? 9 : m - 3, 20), dueDate: dateOnly(y, m - 2 <= 0 ? 10 : m - 2, 19), amount: 780000, amountSettled: 0, balance: 780000, sourceDocument: { type: 'invoice', id: 'INV-2098', label: 'Sales Invoice INV-2098' } },
    { id: genAccountingId('oi'), partyType: 'customer', partyId: 'cust-bharat-trailers', partyName: 'Bharat Trailers & Fabrication', documentType: 'invoice', documentNo: 'INV-2230', documentDate: dateOnly(y, m, 20), dueDate: dateOnly(y, m + 1 > 12 ? 1 : m + 1, 19), amount: 512000, amountSettled: 0, balance: 512000, sourceDocument: { type: 'invoice', id: 'INV-2230', label: 'Sales Invoice INV-2230' } },
  ]
}

export function seedOpenPayables(): OpenItemEntry[] {
  const m = NOW.getMonth() + 1
  const y = FY_YEAR
  return [
    { id: genAccountingId('oi'), partyType: 'vendor', partyId: 'vend-suresh-steel', partyName: 'Suresh Steel Traders', documentType: 'invoice', documentNo: 'PB-9021', documentDate: dateOnly(y, m, 1), dueDate: dateOnly(y, m, 31), amount: 412000, amountSettled: 412000, balance: 0, sourceDocument: { type: 'purchase_order', id: 'PO-1105', label: 'Purchase Order PO-1105' } },
    { id: genAccountingId('oi'), partyType: 'vendor', partyId: 'vend-om-fabricators', partyName: 'Om Fabricators Pvt Ltd', documentType: 'invoice', documentNo: 'PB-9105', documentDate: dateOnly(y, m - 1 <= 0 ? 12 : m - 1, 22), dueDate: dateOnly(y, m, 21), amount: 890000, amountSettled: 0, balance: 890000, sourceDocument: { type: 'purchase_order', id: 'PO-1132', label: 'Purchase Order PO-1132' } },
    { id: genAccountingId('oi'), partyType: 'vendor', partyId: 'vend-mahavir-alloys', partyName: 'Mahavir Alloys & Metals', documentType: 'invoice', documentNo: 'PB-8890', documentDate: dateOnly(y, m - 2 <= 0 ? 10 : m - 2, 12), dueDate: dateOnly(y, m - 1 <= 0 ? 11 : m - 1, 11), amount: 1340000, amountSettled: 0, balance: 1340000, sourceDocument: { type: 'purchase_order', id: 'PO-1087', label: 'Purchase Order PO-1087' } },
    { id: genAccountingId('oi'), partyType: 'vendor', partyId: 'vend-shreeji-tyres', partyName: 'Shreeji Tyres & Axles', documentType: 'invoice', documentNo: 'PB-8790', documentDate: dateOnly(y, m - 3 <= 0 ? 9 : m - 3, 8), dueDate: dateOnly(y, m - 2 <= 0 ? 10 : m - 2, 7), amount: 560000, amountSettled: 0, balance: 560000, sourceDocument: { type: 'purchase_order', id: 'PO-1042', label: 'Purchase Order PO-1042' } },
    { id: genAccountingId('oi'), partyType: 'vendor', partyId: 'vend-suresh-steel', partyName: 'Suresh Steel Traders', documentType: 'invoice', documentNo: 'PB-9210', documentDate: dateOnly(y, m, 18), dueDate: dateOnly(y, m + 1 > 12 ? 1 : m + 1, 17), amount: 275000, amountSettled: 0, balance: 275000, sourceDocument: { type: 'purchase_order', id: 'PO-1150', label: 'Purchase Order PO-1150' } },
  ]
}

export function seedBankAccounts(): CashBankAccountSummary[] {
  return [
    { accountId: 'acc-1112', accountName: 'HDFC Bank — Current A/c', accountCode: '1112', kind: 'bank', bankName: 'HDFC Bank', accountNumberMasked: 'XXXX XXXX 4821', ifsc: 'HDFC0001234', currentBalance: 0, lastReconciledDate: null },
    { accountId: 'acc-1113', accountName: 'ICICI Bank — Current A/c', accountCode: '1113', kind: 'bank', bankName: 'ICICI Bank', accountNumberMasked: 'XXXX XXXX 7790', ifsc: 'ICIC0005678', currentBalance: 0, lastReconciledDate: null },
    { accountId: 'acc-1111', accountName: 'Cash in Hand', accountCode: '1111', kind: 'cash', currentBalance: 0, lastReconciledDate: null },
  ]
}

export function seedBankStatementLines(): BankStatementLine[] {
  const m = NOW.getMonth() + 1
  const y = FY_YEAR
  return [
    { id: genAccountingId('bsl'), bankAccountId: 'acc-1112', txnDate: dateOnly(y, m, 3), description: 'NEFT CR BHARAT TRAILERS', reference: 'NEFT0003321', debit: 0, credit: 685000, isMatched: true },
    { id: genAccountingId('bsl'), bankAccountId: 'acc-1112', txnDate: dateOnly(y, m, 4), description: 'RTGS DR SURESH STEEL TRADERS', reference: 'RTGS0044210', debit: 412000, credit: 0, isMatched: true },
    { id: genAccountingId('bsl'), bankAccountId: 'acc-1112', txnDate: dateOnly(y, m, 6), description: 'CASH DEPOSIT', reference: 'DEP009812', debit: 0, credit: 90000, isMatched: true },
    { id: genAccountingId('bsl'), bankAccountId: 'acc-1112', txnDate: dateOnly(y, m, 8), description: 'SALARY BATCH TRANSFER', reference: 'SAL0009921', debit: 1120000, credit: 0, isMatched: true },
    { id: genAccountingId('bsl'), bankAccountId: 'acc-1112', txnDate: dateOnly(y, m, 9), description: 'UPI CR KONKAN LOGISTICS', reference: 'UPI7789012', debit: 0, credit: 250000, isMatched: true },
    { id: genAccountingId('bsl'), bankAccountId: 'acc-1112', txnDate: dateOnly(y, m, 11), description: 'BANK CHARGES — QUARTERLY', reference: 'CHG002210', debit: 1850, credit: 0, isMatched: false },
    { id: genAccountingId('bsl'), bankAccountId: 'acc-1112', txnDate: dateOnly(y, m, 15), description: 'NEFT DR ICICI TRANSFER', reference: 'NEFT0003890', debit: 200000, credit: 0, isMatched: true },
    { id: genAccountingId('bsl'), bankAccountId: 'acc-1112', txnDate: dateOnly(y, m, 18), description: 'INTEREST CREDIT — SAVINGS SWEEP', reference: 'INT0001120', debit: 0, credit: 4250, isMatched: false },
    { id: genAccountingId('bsl'), bankAccountId: 'acc-1112', txnDate: dateOnly(y, m, 20), description: 'NEFT CR GODAVARI ROADLINES', reference: 'NEFT0004102', debit: 0, credit: 320000, isMatched: false },
    { id: genAccountingId('bsl'), bankAccountId: 'acc-1112', txnDate: dateOnly(y, m, 22), description: 'CHEQUE DR 000412 — OFFICE RENT', reference: 'CHQ000412', debit: 180000, credit: 0, isMatched: false },
  ]
}

export function seedBankReconciliation(): BankReconciliationSession {
  const m = NOW.getMonth() + 1
  const y = FY_YEAR
  return {
    id: genAccountingId('recon'),
    bankAccountId: 'acc-1112',
    statementDate: dateOnly(y, m, 22),
    openingBalanceBank: 4250000,
    closingBalanceBank: 4250000 + 685000 - 412000 + 90000 - 1120000 + 250000 - 1850 - 200000 + 4250 + 320000 - 180000,
    openingBalanceBooks: 4250000,
    closingBalanceBooks: 4250000 + 685000 - 412000 + 90000 - 1120000 + 250000 - 200000,
    status: 'in_progress',
    matches: [],
    completedAt: null,
    completedBy: null,
  }
}

export function seedInventoryValuation(): InventoryValuationRow[] {
  const y = FY_YEAR
  const m = NOW.getMonth() + 1
  const asOf = dateOnly(y, m, NOW.getDate())
  return [
    { id: genAccountingId('iv'), itemCode: 'RM-MS-PLATE-8MM', itemName: 'MS Plate 8mm', warehouseName: 'Raw Material Store', qtyOnHand: 4200, valuationMethod: 'FIFO', unitCost: 62.5, totalValue: 262500, glAccountId: 'acc-1131', asOfDate: asOf },
    { id: genAccountingId('iv'), itemCode: 'RM-AXLE-9T', itemName: 'Axle Assembly 9T', warehouseName: 'Raw Material Store', qtyOnHand: 48, valuationMethod: 'Moving Average', unitCost: 28500, totalValue: 1368000, glAccountId: 'acc-1131', asOfDate: asOf },
    { id: genAccountingId('iv'), itemCode: 'WIP-TRLR-20FT', itemName: 'Trailer Chassis 20ft (WIP)', warehouseName: 'Shop Floor WIP', qtyOnHand: 6, valuationMethod: 'Standard Cost', unitCost: 306700, totalValue: 1840200, glAccountId: 'acc-1132', asOfDate: asOf },
    { id: genAccountingId('iv'), itemCode: 'FG-TRLR-40FT-FB', itemName: 'Flatbed Trailer 40ft', warehouseName: 'Finished Goods Store', qtyOnHand: 8, valuationMethod: 'Standard Cost', unitCost: 370000, totalValue: 2960000, glAccountId: 'acc-1133', asOfDate: asOf },
    { id: genAccountingId('iv'), itemCode: 'RM-TYRE-1000R20', itemName: 'Tyre 1000R20', warehouseName: 'Raw Material Store', qtyOnHand: 96, valuationMethod: 'FIFO', unitCost: 14200, totalValue: 1363200, glAccountId: 'acc-1131', asOfDate: asOf },
  ]
}

export function seedWip(): WipRow[] {
  return [
    { id: genAccountingId('wip'), workOrderNo: 'WO-3021', itemName: 'Flatbed Trailer 40ft', materialCost: 268000, labourCost: 42000, overheadCost: 21000, totalWip: 331000, status: 'in_progress' },
    { id: genAccountingId('wip'), workOrderNo: 'WO-3025', itemName: 'Tipper Trailer 32ft', materialCost: 312000, labourCost: 58000, overheadCost: 26000, totalWip: 396000, status: 'in_progress' },
    { id: genAccountingId('wip'), workOrderNo: 'WO-3018', itemName: 'Skeletal Trailer 20ft', materialCost: 198000, labourCost: 31000, overheadCost: 15500, totalWip: 244500, status: 'completed' },
    { id: genAccountingId('wip'), workOrderNo: 'WO-3030', itemName: 'Lowbed Trailer 3-axle', materialCost: 410000, labourCost: 72000, overheadCost: 34000, totalWip: 516000, status: 'in_progress' },
  ]
}

export function seedCostVariance(): CostVarianceRow[] {
  return [
    { id: genAccountingId('cv'), workOrderNo: 'WO-3018', itemName: 'Skeletal Trailer 20ft', standardCost: 230000, actualCost: 244500, materialVariance: 8000, labourVariance: 4500, overheadVariance: 2000, totalVariance: 14500 },
    { id: genAccountingId('cv'), workOrderNo: 'WO-3005', itemName: 'Flatbed Trailer 40ft', standardCost: 355000, actualCost: 342000, materialVariance: -9000, labourVariance: -3000, overheadVariance: -1000, totalVariance: -13000 },
    { id: genAccountingId('cv'), workOrderNo: 'WO-2998', itemName: 'Tipper Trailer 32ft', standardCost: 378000, actualCost: 401200, materialVariance: 15200, labourVariance: 5000, overheadVariance: 3000, totalVariance: 23200 },
  ]
}

export function seedGrni(): GrniRow[] {
  const m = NOW.getMonth() + 1
  const y = FY_YEAR
  return [
    { id: genAccountingId('grni'), grnNo: 'GRN-4102', poNo: 'PO-1132', vendorName: 'Om Fabricators Pvt Ltd', grnDate: dateOnly(y, m - 1 <= 0 ? 12 : m - 1, 22), grnValue: 890000, invoicedValue: 0, outstandingValue: 890000, ageDays: 34 },
    { id: genAccountingId('grni'), grnNo: 'GRN-4088', poNo: 'PO-1087', vendorName: 'Mahavir Alloys & Metals', grnDate: dateOnly(y, m - 2 <= 0 ? 10 : m - 2, 12), grnValue: 1340000, invoicedValue: 1340000, outstandingValue: 0, ageDays: 62 },
    { id: genAccountingId('grni'), grnNo: 'GRN-4145', poNo: 'PO-1150', vendorName: 'Suresh Steel Traders', grnDate: dateOnly(y, m, 18), grnValue: 275000, invoicedValue: 0, outstandingValue: 275000, ageDays: 4 },
    { id: genAccountingId('grni'), grnNo: 'GRN-4051', poNo: 'PO-1042', vendorName: 'Shreeji Tyres & Axles', grnDate: dateOnly(y, m - 3 <= 0 ? 9 : m - 3, 8), grnValue: 560000, invoicedValue: 0, outstandingValue: 560000, ageDays: 91 },
  ]
}

export function seedInvVsGl(): InvVsGlRow[] {
  return [
    { id: genAccountingId('ivg'), category: 'Raw Material Stock', inventoryLedgerValue: 6248200, glStockAccountValue: 6120000, difference: 128200 },
    { id: genAccountingId('ivg'), category: 'Work-In-Progress', inventoryLedgerValue: 1840200, glStockAccountValue: 1840000, difference: 200 },
    { id: genAccountingId('ivg'), category: 'Finished Goods', inventoryLedgerValue: 2960000, glStockAccountValue: 2960000, difference: 0 },
  ]
}

export function seedProductionOrderCosts(): ProductionOrderCostMock[] {
  return [
    { id: genAccountingId('poc'), woNo: 'WO-3018', itemName: 'Skeletal Trailer 20ft', qtyProduced: 4, materialCost: 198000, labourCost: 31000, overheadCost: 15500, totalCost: 244500, unitCost: 61125, status: 'completed' },
    { id: genAccountingId('poc'), woNo: 'WO-3005', itemName: 'Flatbed Trailer 40ft', qtyProduced: 3, materialCost: 245000, labourCost: 58000, overheadCost: 39000, totalCost: 342000, unitCost: 114000, status: 'completed' },
    { id: genAccountingId('poc'), woNo: 'WO-3021', itemName: 'Flatbed Trailer 40ft', qtyProduced: 0, materialCost: 268000, labourCost: 42000, overheadCost: 21000, totalCost: 331000, unitCost: 0, status: 'in_progress' },
  ]
}

export function seedGstSummary(): GstSummaryRow[] {
  const m = NOW.getMonth() + 1
  const y = FY_YEAR
  const prevM = m - 1 <= 0 ? 12 : m - 1
  return [
    { id: genAccountingId('gst'), period: `${String(prevM).padStart(2, '0')}-${y}`, returnType: 'GSTR-3B', outputTax: 532000, inputTaxCredit: 769000, netPayable: 0, status: 'filed', dueDate: dateOnly(y, m, 20), filedDate: dateOnly(y, m, 18) },
    { id: genAccountingId('gst'), period: `${String(prevM).padStart(2, '0')}-${y}`, returnType: 'GSTR-1', outputTax: 532000, inputTaxCredit: 0, netPayable: 532000, status: 'filed', dueDate: dateOnly(y, m, 11), filedDate: dateOnly(y, m, 9) },
    { id: genAccountingId('gst'), period: `${String(m).padStart(2, '0')}-${y}`, returnType: 'GSTR-3B', outputTax: 486000, inputTaxCredit: 391000, netPayable: 95000, status: 'draft', dueDate: dateOnly(y, m + 1 > 12 ? 1 : m + 1, 20) },
    { id: genAccountingId('gst'), period: `${String(m).padStart(2, '0')}-${y}`, returnType: 'GSTR-1', outputTax: 486000, inputTaxCredit: 0, netPayable: 486000, status: 'not_filed', dueDate: dateOnly(y, m + 1 > 12 ? 1 : m + 1, 11) },
  ]
}

export function seedTdsEntries(): TdsEntryRow[] {
  const m = NOW.getMonth() + 1
  const y = FY_YEAR
  return [
    { id: genAccountingId('tds'), section: '194C', partyName: 'Om Fabricators Pvt Ltd', partyPan: 'AAOCF1234K', paymentDate: dateOnly(y, m, 4), paymentAmount: 412000, tdsRate: 1, tdsAmount: 4120, challanNo: 'CHLN0091122', challanDate: dateOnly(y, m, 7), status: 'deposited' },
    { id: genAccountingId('tds'), section: '194J', partyName: 'Nova Engineering Consultants', partyPan: 'AAJCN5678R', paymentDate: dateOnly(y, m, 10), paymentAmount: 85000, tdsRate: 10, tdsAmount: 8500, status: 'pending' },
    { id: genAccountingId('tds'), section: '194I', partyName: 'Ganesh Estates', partyPan: 'AAGPE4321L', paymentDate: dateOnly(y, m, 12), paymentAmount: 180000, tdsRate: 10, tdsAmount: 18000, challanNo: 'CHLN0091198', challanDate: dateOnly(y, m, 14), status: 'return_filed' },
    { id: genAccountingId('tds'), section: '194C', partyName: 'Suresh Steel Traders', partyPan: 'AASPS8765M', paymentDate: dateOnly(y, m, 18), paymentAmount: 275000, tdsRate: 1, tdsAmount: 2750, status: 'pending' },
  ]
}

export function seedPeriodCloseChecklist(): PeriodCloseChecklist {
  const m = NOW.getMonth() + 1
  const y = FY_YEAR
  const period = `${String(m).padStart(2, '0')}-${y}`
  return {
    id: genAccountingId('pcc'),
    period,
    isLocked: false,
    tasks: [
      { id: genAccountingId('pct'), period, taskLabel: 'Post all pending vouchers for the period', category: 'reporting', status: 'in_progress', assignedTo: 'Priya Sharma (Accountant)' },
      { id: genAccountingId('pct'), period, taskLabel: 'Complete bank reconciliation — HDFC Bank', category: 'reconciliation', status: 'in_progress', assignedTo: 'Priya Sharma (Accountant)' },
      { id: genAccountingId('pct'), period, taskLabel: 'Complete bank reconciliation — ICICI Bank', category: 'reconciliation', status: 'pending', assignedTo: 'Priya Sharma (Accountant)' },
      { id: genAccountingId('pct'), period, taskLabel: 'Review AR ageing and follow up overdue customers', category: 'review', status: 'pending', assignedTo: 'Rakesh Iyer (Finance Manager)' },
      { id: genAccountingId('pct'), period, taskLabel: 'Review AP ageing and vendor payment schedule', category: 'review', status: 'pending', assignedTo: 'Rakesh Iyer (Finance Manager)' },
      { id: genAccountingId('pct'), period, taskLabel: 'Reconcile Inventory vs G/L stock accounts', category: 'reconciliation', status: 'done', assignedTo: 'Priya Sharma (Accountant)', completedAt: dateOnly(y, m, 20) },
      { id: genAccountingId('pct'), period, taskLabel: 'Review WIP and production cost variances', category: 'review', status: 'pending', assignedTo: 'Rakesh Iyer (Finance Manager)' },
      { id: genAccountingId('pct'), period, taskLabel: 'Finalise GSTR-3B draft for the period', category: 'reporting', status: 'in_progress', assignedTo: 'Priya Sharma (Accountant)' },
      { id: genAccountingId('pct'), period, taskLabel: 'Finance Manager review & sign-off', category: 'approval', status: 'pending', assignedTo: 'Rakesh Iyer (Finance Manager)' },
      { id: genAccountingId('pct'), period, taskLabel: 'Lock period after sign-off', category: 'approval', status: 'blocked', assignedTo: 'Anita Deshpande (Finance Administrator)', notes: 'Blocked until Finance Manager sign-off is complete' },
    ],
  }
}

export function seedPostingSetupRules(): PostingSetupRule[] {
  return [
    { id: genAccountingId('psr'), area: 'Sales', event: 'Sales Invoice Posted', debitAccountName: 'Trade Debtors', creditAccountName: 'Domestic Sales', isActive: true },
    { id: genAccountingId('psr'), area: 'Sales', event: 'Sales Invoice — Output GST', debitAccountName: 'Trade Debtors', creditAccountName: 'Output CGST / SGST / IGST', isActive: true },
    { id: genAccountingId('psr'), area: 'Purchase', event: 'GRN Posted', debitAccountName: 'Raw Material Stock', creditAccountName: 'GRNI Clearing', isActive: true },
    { id: genAccountingId('psr'), area: 'Purchase', event: 'Vendor Invoice Matched', debitAccountName: 'GRNI Clearing', creditAccountName: 'Trade Creditors', isActive: true },
    { id: genAccountingId('psr'), area: 'Purchase', event: 'Purchase Invoice — Input GST', debitAccountName: 'Input CGST / SGST / IGST', creditAccountName: 'Trade Creditors', isActive: true },
    { id: genAccountingId('psr'), area: 'Manufacturing', event: 'Material Issue to WO', debitAccountName: 'Work-In-Progress Stock', creditAccountName: 'Raw Material Stock', isActive: true },
    { id: genAccountingId('psr'), area: 'Manufacturing', event: 'WO Completion — FG Receipt', debitAccountName: 'Finished Goods Stock', creditAccountName: 'Work-In-Progress Stock', isActive: true },
    { id: genAccountingId('psr'), area: 'Manufacturing', event: 'Labour & Overhead Absorption', debitAccountName: 'Work-In-Progress Stock', creditAccountName: 'Direct Labour / Mfg Overheads', isActive: true },
    { id: genAccountingId('psr'), area: 'Bank', event: 'Bank Charges (auto)', debitAccountName: 'Bank Charges', creditAccountName: 'Bank Account', isActive: true },
    { id: genAccountingId('psr'), area: 'Payroll', event: 'Salary Accrual', debitAccountName: 'Salaries & Wages', creditAccountName: 'Salary Payable', isActive: true },
    { id: genAccountingId('psr'), area: 'Fixed Assets', event: 'Monthly Depreciation', debitAccountName: 'Depreciation', creditAccountName: 'Accumulated Depreciation', isActive: false },
  ]
}

export function seedAccountingDimensions(): AccountingDimension[] {
  return [
    {
      id: genAccountingId('dim'),
      name: 'Department',
      description: 'Cost tracking by department / cost centre',
      values: [
        { id: 'dept-production', code: 'PROD', name: 'Production', isActive: true },
        { id: 'dept-sales', code: 'SALES', name: 'Sales & Marketing', isActive: true },
        { id: 'dept-admin', code: 'ADMIN', name: 'Administration', isActive: true },
        { id: 'dept-quality', code: 'QC', name: 'Quality', isActive: true },
        { id: 'dept-stores', code: 'STORES', name: 'Stores & Logistics', isActive: true },
      ],
    },
    {
      id: genAccountingId('dim'),
      name: 'Project / Work Order',
      description: 'Cost tracking by manufacturing work order or customer project',
      values: [
        { id: 'proj-wo-3021', code: 'WO-3021', name: 'Flatbed Trailer 40ft — WO-3021', isActive: true },
        { id: 'proj-wo-3025', code: 'WO-3025', name: 'Tipper Trailer 32ft — WO-3025', isActive: true },
        { id: 'proj-wo-3030', code: 'WO-3030', name: 'Lowbed Trailer 3-axle — WO-3030', isActive: true },
      ],
    },
  ]
}

export function seedAccountingPeriods(): AccountingPeriodSetup[] {
  const y = FY_YEAR
  const currentMonth = NOW.getMonth() + 1
  const months = [
    { name: 'April', num: 4 }, { name: 'May', num: 5 }, { name: 'June', num: 6 },
    { name: 'July', num: 7 }, { name: 'August', num: 8 }, { name: 'September', num: 9 },
    { name: 'October', num: 10 }, { name: 'November', num: 11 }, { name: 'December', num: 12 },
    { name: 'January', num: 1 }, { name: 'February', num: 2 }, { name: 'March', num: 3 },
  ]
  const fyLabel = `FY ${y}-${String(y + 1).slice(2)}`
  return months.map(({ name, num }) => {
    const calendarYear = num >= 4 ? y : y + 1
    const startDate = dateOnly(calendarYear, num, 1)
    const endDate = dateOnly(calendarYear, num, new Date(calendarYear, num, 0).getDate())
    const isPast = calendarYear < NOW.getFullYear() || (calendarYear === NOW.getFullYear() && num < currentMonth)
    const isCurrent = calendarYear === NOW.getFullYear() && num === currentMonth
    return {
      id: genAccountingId('period'),
      fiscalYear: fyLabel,
      periodName: `${name} ${calendarYear}`,
      startDate,
      endDate,
      status: isPast ? 'closed' : isCurrent ? 'open' : 'open',
    }
  })
}

/** Convenience — build all seed collections plus derived ledger entries for posted vouchers. */
export function buildAccountingSeed() {
  const accounts = seedChartOfAccounts()
  const vouchers = seedVouchers()
  const ledgerEntries = vouchers
    .filter((v) => v.status === 'posted')
    .flatMap((v) => buildLedgerEntriesFromVoucher(v))

  return {
    accounts,
    vouchers,
    ledgerEntries,
    receivables: seedOpenReceivables(),
    payables: seedOpenPayables(),
    bankAccounts: seedBankAccounts(),
    bankStatementLines: seedBankStatementLines(),
    bankReconciliations: [seedBankReconciliation()],
    inventoryValuation: seedInventoryValuation(),
    wip: seedWip(),
    costVariance: seedCostVariance(),
    grni: seedGrni(),
    invVsGl: seedInvVsGl(),
    productionOrderCosts: seedProductionOrderCosts(),
    gstSummary: seedGstSummary(),
    tdsEntries: seedTdsEntries(),
    periodCloseChecklist: seedPeriodCloseChecklist(),
    postingSetupRules: seedPostingSetupRules(),
    dimensions: seedAccountingDimensions(),
    periods: seedAccountingPeriods(),
  }
}

/**
 * Bank & Cash — Indian manufacturing demo seed (frontend only).
 * FY 2026 dates (Apr–Jul). Mutate via bankCashService; does NOT post real GL.
 */
import type {
  BankAccount,
  BankCashAuditEntry,
  BankCashSetup,
  BankCashTransaction,
  BankDeposit,
  BankStatement,
  BankStatementLine,
  CashAccount,
  CashCount,
  Cheque,
  FundTransfer,
  Reconciliation,
  ReconciliationLine,
  ReconciliationMatch,
} from '../../types/bankCash'
import { maskAccountNumber } from '../../types/bankCash'

const COMPANY = 'Vasant Trailers Pvt Ltd'
const CREATED_BY = 'Priya Sharma'
const APPROVED_BY = 'Rahul Mehta'

export const INDIAN_DENOMINATIONS = [2000, 500, 200, 100, 50, 20, 10, 5, 2, 1] as const

/** Fixed ISO dates in FY 2026 (Apr–Jul). */
function fyDate(month: number, day: number): string {
  return `2026-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

function fyDateTime(month: number, day: number, hour = 10): string {
  return `${fyDate(month, day)}T${String(hour).padStart(2, '0')}:30:00.000Z`
}

// ─── Stable IDs ───────────────────────────────────────────────────────────────

export const BANK_IDS = {
  hdfcMain: 'bacc-hdfc-main',
  iciciVendor: 'bacc-icici-vendor',
  hdfcCollection: 'bacc-hdfc-collection',
  hdfcCc: 'bacc-hdfc-cc',
  iciciPlant: 'bacc-icici-plant',
  hdfcPayroll: 'bacc-hdfc-payroll',
  hdfcUsd: 'bacc-hdfc-usd',
} as const

export const CASH_IDS = {
  hoMain: 'cacc-ho-main',
  plantPetty: 'cacc-plant-petty',
  sitePune: 'cacc-site-pune',
  maintImprest: 'cacc-maint-imprest',
  salesOffice: 'cacc-sales-office',
} as const

function bankBase(
  id: string,
  code: string,
  name: string,
  bankName: string,
  branch: string,
  ifsc: string,
  last4: string,
  accountType: BankAccount['accountType'],
  currency: string,
  bookBalance: number,
  statementBalance: number,
  ledgerAccountId: string,
  extra: Partial<BankAccount> = {},
): BankAccount {
  const unreconciled = Math.round((bookBalance - statementBalance) * 100) / 100
  return {
    id,
    code,
    name,
    bankName,
    branch,
    ifsc,
    swiftCode: currency === 'USD' ? 'HDFCINBB' : null,
    accountNumberMasked: maskAccountNumber(last4),
    accountNumberLast4: last4,
    accountType,
    currency,
    bookBalance,
    statementBalance,
    availableBalance: bookBalance - (extra.paymentsInTransit ?? 0),
    unreconciledAmount: unreconciled,
    paymentsInTransit: extra.paymentsInTransit ?? 0,
    depositsInTransit: extra.depositsInTransit ?? 0,
    overdraftLimit: extra.overdraftLimit ?? null,
    minimumBalance: extra.minimumBalance ?? null,
    lastReconciledDate: extra.lastReconciledDate ?? null,
    lastStatementDate: extra.lastStatementDate ?? null,
    lastTransactionDate: extra.lastTransactionDate ?? fyDate(7, 12),
    status: extra.status ?? 'Active',
    reconciliationStatus: extra.reconciliationStatus ?? 'Not Started',
    ledgerAccountId,
    bankChargesAccountId: 'coa-5210',
    interestIncomeAccountId: 'coa-4210',
    interestExpenseAccountId: 'coa-5310',
    suspenseAccountId: 'coa-1199',
    exchangeGainAccountId: currency === 'USD' ? 'coa-4220' : null,
    exchangeLossAccountId: currency === 'USD' ? 'coa-5320' : null,
    purpose: extra.purpose ?? name,
    reconciliationFrequency: extra.reconciliationFrequency ?? 'Monthly',
    custodian: extra.custodian ?? 'Priya Sharma',
    isPaymentAccount: extra.isPaymentAccount ?? false,
    isCollectionAccount: extra.isCollectionAccount ?? false,
    location: extra.location ?? 'Head Office — Pune',
    company: COMPANY,
    createdBy: CREATED_BY,
    createdAt: fyDateTime(4, 1),
    modifiedAt: fyDateTime(7, 10),
  }
}

export function seedBankAccounts(): BankAccount[] {
  return [
    bankBase(
      BANK_IDS.hdfcMain,
      'BNK-HDFC-01',
      'HDFC Bank — Main Operating A/c',
      'HDFC Bank',
      'Koregaon Park, Pune',
      'HDFC0001234',
      '4582',
      'Current Account',
      'INR',
      4_250_000,
      4_248_500,
      'coa-1112',
      {
        isPaymentAccount: true,
        reconciliationStatus: 'In Progress',
        lastReconciledDate: fyDate(6, 30),
        lastStatementDate: fyDate(7, 10),
        paymentsInTransit: 125_000,
        purpose: 'Primary operating account for receipts and vendor payments',
      },
    ),
    bankBase(
      BANK_IDS.iciciVendor,
      'BNK-ICICI-01',
      'ICICI Bank — Vendor Payment A/c',
      'ICICI Bank',
      'Camp, Pune',
      'ICIC0005678',
      '7821',
      'Payment Account',
      'INR',
      1_180_000,
      1_180_000,
      'coa-1113',
      {
        isPaymentAccount: true,
        reconciliationStatus: 'Completed',
        lastReconciledDate: fyDate(7, 5),
        lastStatementDate: fyDate(7, 8),
        purpose: 'Dedicated vendor RTGS/NEFT disbursements',
        custodian: 'Rahul Mehta',
      },
    ),
    bankBase(
      BANK_IDS.hdfcCollection,
      'BNK-HDFC-02',
      'HDFC Bank — Collection A/c',
      'HDFC Bank',
      'Hinjewadi, Pune',
      'HDFC0009876',
      '3341',
      'Collection Account',
      'INR',
      2_840_000,
      2_835_200,
      'coa-1114',
      {
        isCollectionAccount: true,
        reconciliationStatus: 'Draft',
        lastStatementDate: fyDate(7, 11),
        depositsInTransit: 185_000,
        purpose: 'Customer collections and dealer receipts',
      },
    ),
    bankBase(
      BANK_IDS.hdfcCc,
      'BNK-HDFC-CC',
      'HDFC Bank — Cash Credit Limit',
      'HDFC Bank',
      'Koregaon Park, Pune',
      'HDFC0001234',
      '4582',
      'Cash Credit',
      'INR',
      -1_250_000,
      -1_250_000,
      'coa-2115',
      {
        overdraftLimit: 5_000_000,
        minimumBalance: null,
        reconciliationStatus: 'Completed',
        lastReconciledDate: fyDate(6, 28),
        purpose: 'Working capital cash credit against stock & debtors',
        custodian: 'Rahul Mehta',
      },
    ),
    bankBase(
      BANK_IDS.iciciPlant,
      'BNK-ICICI-02',
      'ICICI Bank — Plant Operating A/c',
      'ICICI Bank',
      'Chakan MIDC, Pune',
      'ICIC0009012',
      '6610',
      'Current Account',
      'INR',
      485_000,
      482_750,
      'coa-1116',
      {
        location: 'Plant — Chakan',
        reconciliationStatus: 'In Progress',
        lastStatementDate: fyDate(7, 9),
        purpose: 'Plant utilities, wages advance and local purchases',
        custodian: 'Suresh Patil',
      },
    ),
    bankBase(
      BANK_IDS.hdfcPayroll,
      'BNK-HDFC-PY',
      'HDFC Bank — Payroll A/c',
      'HDFC Bank',
      'Koregaon Park, Pune',
      'HDFC0001234',
      '9923',
      'Current Account',
      'INR',
      620_000,
      620_000,
      'coa-1117',
      {
        reconciliationStatus: 'Completed',
        lastReconciledDate: fyDate(7, 1),
        purpose: 'Salary and statutory disbursements',
        custodian: 'Kavita Deshpande',
      },
    ),
    bankBase(
      BANK_IDS.hdfcUsd,
      'BNK-HDFC-USD',
      'HDFC Bank — USD Foreign Currency A/c',
      'HDFC Bank',
      'Koregaon Park, Pune',
      'HDFC0001234',
      '1108',
      'Foreign Currency Account',
      'USD',
      42_500,
      42_500,
      'coa-1118',
      {
        reconciliationStatus: 'Not Started',
        lastStatementDate: fyDate(6, 30),
        purpose: 'Import LC margins and export proceeds',
        custodian: 'Rahul Mehta',
      },
    ),
  ]
}

function cashBase(
  id: string,
  code: string,
  name: string,
  cashAccountType: CashAccount['cashAccountType'],
  bookBalance: number,
  ledgerAccountId: string,
  extra: Partial<CashAccount> = {},
): CashAccount {
  const physicalBalance = extra.physicalBalance ?? bookBalance
  const variance = extra.variance ?? physicalBalance - bookBalance
  return {
    id,
    code,
    name,
    cashAccountType,
    currency: extra.currency ?? 'INR',
    bookBalance,
    physicalBalance,
    availableBalance: bookBalance,
    variance,
    cashLimit: extra.cashLimit ?? null,
    imprestLimit: extra.imprestLimit ?? null,
    lastCountDate: extra.lastCountDate ?? null,
    lastTransactionDate: extra.lastTransactionDate ?? fyDate(7, 12),
    status: extra.status ?? 'Active',
    ledgerAccountId,
    custodian: extra.custodian ?? 'Priya Sharma',
    location: extra.location ?? 'Head Office — Pune',
    plant: extra.plant ?? null,
    department: extra.department ?? null,
    company: COMPANY,
    purpose: extra.purpose ?? name,
    countFrequency: extra.countFrequency ?? 'Monthly',
    varianceTolerance: extra.varianceTolerance ?? 500,
    createdBy: CREATED_BY,
    createdAt: fyDateTime(4, 1),
    modifiedAt: fyDateTime(7, 10),
  }
}

export function seedCashAccounts(): CashAccount[] {
  return [
    cashBase(CASH_IDS.hoMain, 'CSH-HO-01', 'Head Office — Main Cash', 'Main Cash', 185_000, 'coa-1111', {
      custodian: 'Priya Sharma',
      department: 'Finance',
      cashLimit: 500_000,
      countFrequency: 'Monthly',
      varianceTolerance: 500,
      lastCountDate: fyDate(7, 1),
      variance: 0,
    }),
    cashBase(CASH_IDS.plantPetty, 'CSH-PLT-01', 'Plant — Petty Cash', 'Petty Cash', 25_000, 'coa-1119', {
      location: 'Plant — Chakan',
      plant: 'Chakan MIDC',
      department: 'Production',
      cashLimit: 50_000,
      imprestLimit: 50_000,
      custodian: 'Suresh Patil',
      countFrequency: 'Weekly',
      varianceTolerance: 200,
      lastCountDate: fyDate(6, 28),
      physicalBalance: 25_450,
      variance: 450,
    }),
    cashBase(CASH_IDS.sitePune, 'CSH-SITE-01', 'Site Cash — Pune Metro Yard', 'Site Cash', 18_500, 'coa-1120', {
      location: 'Site — Pune Metro Yard',
      department: 'Projects',
      cashLimit: 25_000,
      custodian: 'Anil Kulkarni',
      countFrequency: 'Weekly',
      varianceTolerance: 100,
      variance: 0,
    }),
    cashBase(CASH_IDS.maintImprest, 'CSH-IMP-01', 'Maintenance Imprest', 'Imprest Cash', 10_000, 'coa-1121', {
      location: 'Plant — Chakan',
      plant: 'Chakan MIDC',
      department: 'Maintenance',
      cashLimit: 15_000,
      imprestLimit: 15_000,
      custodian: 'Ravi Deshmukh',
      countFrequency: 'Weekly',
      varianceTolerance: 100,
      lastCountDate: fyDate(7, 5),
      physicalBalance: 9_650,
      variance: -350,
    }),
    cashBase(CASH_IDS.salesOffice, 'CSH-SLS-01', 'Sales Office — Cash Counter', 'Branch Cash', 42_000, 'coa-1122', {
      location: 'Sales Office — Pimpri',
      department: 'Sales',
      cashLimit: 100_000,
      custodian: 'Neha Joshi',
      countFrequency: 'Daily',
      varianceTolerance: 250,
      variance: 0,
    }),
  ]
}

type TxnSeed = {
  id: string
  num: string
  m: number
  d: number
  type: BankCashTransaction['transactionType']
  kind: 'bank' | 'cash'
  bankId?: string
  cashId?: string
  acct: string
  party?: string
  ref: string
  narr: string
  debit: number
  credit: number
  bal: number
  mode?: BankCashTransaction['transferMode']
  chq?: string
  utr?: string
  vch?: string
  recon?: boolean
}

export function seedBankCashTransactions(): BankCashTransaction[] {
  const seeds: TxnSeed[] = [
    { id: 'bct-001', num: 'BCT-2026-00041', m: 4, d: 2, type: 'Customer Receipt', kind: 'bank', bankId: BANK_IDS.hdfcCollection, acct: 'HDFC Collection A/c', party: 'Mahindra Logistics Ltd', ref: 'NEFT-IN-240402', narr: 'Advance against SO-2026-0142', debit: 0, credit: 590_000, bal: 2_590_000, mode: 'NEFT', utr: 'HDFCN240402001', vch: 'RV-2026-0088', recon: true },
    { id: 'bct-002', num: 'BCT-2026-00042', m: 4, d: 3, type: 'Vendor Payment', kind: 'bank', bankId: BANK_IDS.iciciVendor, acct: 'ICICI Vendor Payment A/c', party: 'Tata Steel Ltd', ref: 'RTGS-OUT-240403', narr: 'RM invoice TS-88421', debit: 845_000, credit: 0, bal: 335_000, mode: 'RTGS', utr: 'ICICR240403882', vch: 'PV-2026-0312', recon: true },
    { id: 'bct-003', num: 'BCT-2026-00043', m: 4, d: 5, type: 'Bank Charge', kind: 'bank', bankId: BANK_IDS.hdfcMain, acct: 'HDFC Main Operating A/c', ref: 'CHG-APR25', narr: 'Monthly account maintenance charges', debit: 1_500, credit: 0, bal: 4_248_500, mode: 'Other', recon: true },
    { id: 'bct-004', num: 'BCT-2026-00044', m: 4, d: 8, type: 'Cash Deposit', kind: 'bank', bankId: BANK_IDS.hdfcMain, acct: 'HDFC Main Operating A/c', ref: 'CD-240408', narr: 'HO cash deposited — counter 12', debit: 0, credit: 125_000, bal: 4_373_500, mode: 'Cash Deposit', recon: true },
    { id: 'bct-005', num: 'BCT-2026-00045', m: 4, d: 8, type: 'Cash Withdrawal', kind: 'cash', cashId: CASH_IDS.hoMain, acct: 'HO Main Cash', ref: 'CW-240408', narr: 'Cash withdrawn for deposit', debit: 0, credit: 125_000, bal: 60_000, mode: 'Cash Withdrawal' },
    { id: 'bct-006', num: 'BCT-2026-00046', m: 4, d: 12, type: 'Customer Receipt', kind: 'bank', bankId: BANK_IDS.hdfcMain, acct: 'HDFC Main Operating A/c', party: 'Ashok Leyland Fleet', ref: 'CHQ-882341', narr: 'Cheque deposit — trailer dispatch', debit: 0, credit: 1_180_000, bal: 5_553_500, mode: 'Cheque', chq: '882341', recon: false },
    { id: 'bct-007', num: 'BCT-2026-00047', m: 4, d: 15, type: 'Vendor Payment', kind: 'bank', bankId: BANK_IDS.iciciVendor, acct: 'ICICI Vendor Payment A/c', party: 'Bosch Automotive', ref: 'NEFT-OUT-240415', narr: 'Brake assembly components', debit: 312_500, credit: 0, bal: 22_500, mode: 'NEFT', utr: 'ICICN240415441', vch: 'PV-2026-0328', recon: true },
    { id: 'bct-008', num: 'BCT-2026-00048', m: 4, d: 18, type: 'Bank Interest', kind: 'bank', bankId: BANK_IDS.hdfcMain, acct: 'HDFC Main Operating A/c', ref: 'INT-APR25', narr: 'Interest credit Q1 FY26', debit: 0, credit: 8_420, bal: 5_561_920, mode: 'Other', recon: true },
    { id: 'bct-009', num: 'BCT-2026-00049', m: 4, d: 22, type: 'Cash Transfer', kind: 'cash', cashId: CASH_IDS.plantPetty, acct: 'Plant Petty Cash', party: 'HO Main Cash', ref: 'CT-240422', narr: 'Petty cash replenishment', debit: 15_000, credit: 0, bal: 22_000, mode: 'Internal Transfer' },
    { id: 'bct-010', num: 'BCT-2026-00050', m: 4, d: 22, type: 'Cash Transfer', kind: 'cash', cashId: CASH_IDS.hoMain, acct: 'HO Main Cash', party: 'Plant Petty Cash', ref: 'CT-240422', narr: 'Petty cash replenishment', debit: 0, credit: 15_000, bal: 75_000, mode: 'Internal Transfer' },
    { id: 'bct-011', num: 'BCT-2026-00051', m: 5, d: 2, type: 'Vendor Payment', kind: 'bank', bankId: BANK_IDS.hdfcMain, acct: 'HDFC Main Operating A/c', party: 'Maharashtra State Electricity', ref: 'NEFT-OUT-240502', narr: 'Plant electricity bill Apr-26', debit: 186_400, credit: 0, bal: 5_375_520, mode: 'NEFT', utr: 'HDFCN240502118', recon: true },
    { id: 'bct-012', num: 'BCT-2026-00052', m: 5, d: 5, type: 'Customer Receipt', kind: 'bank', bankId: BANK_IDS.hdfcCollection, acct: 'HDFC Collection A/c', party: 'Tata Motors CVBU', ref: 'UPI-240505', narr: 'Part payment against invoice', debit: 0, credit: 250_000, bal: 2_840_000, mode: 'UPI', utr: 'UPI2405059921', recon: false },
    { id: 'bct-013', num: 'BCT-2026-00053', m: 5, d: 8, type: 'Cheque Issue', kind: 'bank', bankId: BANK_IDS.iciciVendor, acct: 'ICICI Vendor Payment A/c', party: 'SKF Bearings India', ref: 'CHQ-445201', narr: 'Bearing set procurement', debit: 98_750, credit: 0, bal: -76_250, mode: 'Cheque', chq: '445201', recon: false },
    { id: 'bct-014', num: 'BCT-2026-00054', m: 5, d: 12, type: 'Direct Debit', kind: 'bank', bankId: BANK_IDS.hdfcPayroll, acct: 'HDFC Payroll A/c', ref: 'ECS-240512', narr: 'PF / ESI statutory debit', debit: 142_800, credit: 0, bal: 477_200, mode: 'Other', recon: true },
    { id: 'bct-015', num: 'BCT-2026-00055', m: 5, d: 15, type: 'Customer Receipt', kind: 'bank', bankId: BANK_IDS.hdfcMain, acct: 'HDFC Main Operating A/c', party: 'Eicher Motors', ref: 'RTGS-IN-240515', narr: 'Export trailer order advance', debit: 0, credit: 2_450_000, bal: 7_825_520, mode: 'RTGS', utr: 'HDFCR240515009', vch: 'RV-2026-0104', recon: true },
    { id: 'bct-016', num: 'BCT-2026-00056', m: 5, d: 18, type: 'Bank Transfer', kind: 'bank', bankId: BANK_IDS.hdfcMain, acct: 'HDFC Main Operating A/c', ref: 'FT-240518', narr: 'Transfer to payroll account', debit: 620_000, credit: 0, bal: 7_205_520, mode: 'Internal Transfer', recon: true },
    { id: 'bct-017', num: 'BCT-2026-00057', m: 5, d: 18, type: 'Bank Transfer', kind: 'bank', bankId: BANK_IDS.hdfcPayroll, acct: 'HDFC Payroll A/c', ref: 'FT-240518', narr: 'Transfer from main operating', debit: 0, credit: 620_000, bal: 620_000, mode: 'Internal Transfer', recon: true },
    { id: 'bct-018', num: 'BCT-2026-00058', m: 5, d: 22, type: 'Cash Deposit', kind: 'cash', cashId: CASH_IDS.salesOffice, acct: 'Sales Office Cash', party: 'Walk-in customer', ref: 'CSH-240522', narr: 'Spot sale — accessories', debit: 12_500, credit: 0, bal: 42_000 },
    { id: 'bct-019', num: 'BCT-2026-00059', m: 5, d: 25, type: 'Vendor Payment', kind: 'bank', bankId: BANK_IDS.iciciPlant, acct: 'ICICI Plant Operating A/c', party: 'Local Fabricator — Chakan', ref: 'IMPS-240525', narr: 'Welding job work', debit: 48_600, credit: 0, bal: 436_400, mode: 'IMPS', utr: 'ICICI240525771', recon: true },
    { id: 'bct-020', num: 'BCT-2026-00060', m: 6, d: 1, type: 'Customer Receipt', kind: 'bank', bankId: BANK_IDS.hdfcCollection, acct: 'HDFC Collection A/c', party: 'JCB India Ltd', ref: 'NEFT-IN-240601', narr: 'Balance against dispatch DT-884', debit: 0, credit: 875_000, bal: 2_835_200, mode: 'NEFT', utr: 'HDFCN240601442', recon: true },
    { id: 'bct-021', num: 'BCT-2026-00061', m: 6, d: 5, type: 'Bank Charge', kind: 'bank', bankId: BANK_IDS.hdfcCc, acct: 'HDFC Cash Credit', ref: 'CHG-CC-JUN', narr: 'CC processing fee', debit: 4_250, credit: 0, bal: -1_254_250, mode: 'Other', recon: true },
    { id: 'bct-022', num: 'BCT-2026-00062', m: 6, d: 8, type: 'Cheque Clearance', kind: 'bank', bankId: BANK_IDS.hdfcMain, acct: 'HDFC Main Operating A/c', ref: 'CHQ-CLR-882341', narr: 'Ashok Leyland cheque cleared', debit: 0, credit: 1_180_000, bal: 4_250_000, mode: 'Cheque', chq: '882341', recon: true },
    { id: 'bct-023', num: 'BCT-2026-00063', m: 6, d: 12, type: 'Vendor Payment', kind: 'bank', bankId: BANK_IDS.iciciVendor, acct: 'ICICI Vendor Payment A/c', party: 'JSW Steel', ref: 'RTGS-OUT-240612', narr: 'HR sheet consignment', debit: 1_120_000, credit: 0, bal: 1_180_000, mode: 'RTGS', utr: 'ICICR240612009', vch: 'PV-2026-0388', recon: true },
    { id: 'bct-024', num: 'BCT-2026-00064', m: 6, d: 15, type: 'Cash Withdrawal', kind: 'cash', cashId: CASH_IDS.maintImprest, acct: 'Maintenance Imprest', ref: 'CW-240615', narr: 'Spare parts — conveyor belt', debit: 0, credit: 3_200, bal: 6_800 },
    { id: 'bct-025', num: 'BCT-2026-00065', m: 6, d: 18, type: 'Customer Receipt', kind: 'bank', bankId: BANK_IDS.hdfcUsd, acct: 'HDFC USD FC A/c', party: 'Dubai Trailers FZE', ref: 'SWIFT-IN-240618', narr: 'Export LC proceeds USD 12,500', debit: 0, credit: 12_500, bal: 42_500, mode: 'Other', recon: false },
    { id: 'bct-026', num: 'BCT-2026-00066', m: 6, d: 22, type: 'Direct Credit', kind: 'bank', bankId: BANK_IDS.iciciPlant, acct: 'ICICI Plant Operating A/c', ref: 'GST-REF-240622', narr: 'GST refund credit', debit: 0, credit: 48_350, bal: 485_000, mode: 'Other', recon: false },
    { id: 'bct-027', num: 'BCT-2026-00067', m: 6, d: 25, type: 'Adjustment', kind: 'bank', bankId: BANK_IDS.hdfcMain, acct: 'HDFC Main Operating A/c', ref: 'ADJ-240625', narr: 'Bank reconciliation adjustment — suspense', debit: 1_500, credit: 0, bal: 4_248_500, recon: false },
    { id: 'bct-028', num: 'BCT-2026-00068', m: 6, d: 28, type: 'Cash Deposit', kind: 'bank', bankId: BANK_IDS.hdfcCollection, acct: 'HDFC Collection A/c', ref: 'CD-240628', narr: 'Sales office cash deposit', debit: 0, credit: 85_000, bal: 2_920_000, mode: 'Cash Deposit', recon: false },
    { id: 'bct-029', num: 'BCT-2026-00069', m: 7, d: 1, type: 'Vendor Payment', kind: 'bank', bankId: BANK_IDS.hdfcPayroll, acct: 'HDFC Payroll A/c', ref: 'SAL-JUN26', narr: 'June salary disbursement', debit: 520_000, credit: 0, bal: 100_000, mode: 'NEFT', recon: true },
    { id: 'bct-030', num: 'BCT-2026-00070', m: 7, d: 3, type: 'Customer Receipt', kind: 'bank', bankId: BANK_IDS.hdfcMain, acct: 'HDFC Main Operating A/c', party: 'Volvo Eicher JV', ref: 'NEFT-IN-240703', narr: 'Service AMC receipt', debit: 0, credit: 185_000, bal: 4_433_500, mode: 'NEFT', utr: 'HDFCN240703221', recon: false },
    { id: 'bct-031', num: 'BCT-2026-00071', m: 7, d: 5, type: 'Cheque Deposit', kind: 'bank', bankId: BANK_IDS.hdfcCollection, acct: 'HDFC Collection A/c', party: 'Force Motors', ref: 'CHQ-991204', narr: 'PDC deposited', debit: 0, credit: 320_000, bal: 3_155_200, mode: 'Cheque', chq: '991204', recon: false },
    { id: 'bct-032', num: 'BCT-2026-00072', m: 7, d: 8, type: 'Bank Transfer', kind: 'bank', bankId: BANK_IDS.hdfcMain, acct: 'HDFC Main Operating A/c', ref: 'FT-240708', narr: 'Fund transfer to collection a/c', debit: 500_000, credit: 0, bal: 3_933_500, mode: 'Internal Transfer', recon: false },
    { id: 'bct-033', num: 'BCT-2026-00073', m: 7, d: 8, type: 'Bank Transfer', kind: 'bank', bankId: BANK_IDS.hdfcCollection, acct: 'HDFC Collection A/c', ref: 'FT-240708', narr: 'Fund transfer from main a/c', debit: 0, credit: 500_000, bal: 3_655_200, mode: 'Internal Transfer', recon: false },
    { id: 'bct-034', num: 'BCT-2026-00074', m: 7, d: 10, type: 'Vendor Payment', kind: 'bank', bankId: BANK_IDS.iciciVendor, acct: 'ICICI Vendor Payment A/c', party: 'L&T Construction', ref: 'RTGS-OUT-240710', narr: 'Civil work — bay extension', debit: 425_000, credit: 0, bal: 755_000, mode: 'RTGS', utr: 'ICICR240710331', recon: false },
    { id: 'bct-035', num: 'BCT-2026-00075', m: 7, d: 11, type: 'Cash Transfer', kind: 'cash', cashId: CASH_IDS.sitePune, acct: 'Site Cash — Pune Metro', ref: 'CT-240711', narr: 'Site labour advance', debit: 5_000, credit: 0, bal: 18_500 },
    { id: 'bct-036', num: 'BCT-2026-00076', m: 7, d: 12, type: 'Reversal', kind: 'bank', bankId: BANK_IDS.iciciVendor, acct: 'ICICI Vendor Payment A/c', party: 'L&T Construction', ref: 'REV-240712', narr: 'Reversal — duplicate RTGS entry', debit: 0, credit: 425_000, bal: 1_180_000, mode: 'RTGS', recon: false },
    { id: 'bct-037', num: 'BCT-2026-00077', m: 7, d: 12, type: 'Customer Receipt', kind: 'cash', cashId: CASH_IDS.salesOffice, acct: 'Sales Office Cash', party: 'Dealer — Kolhapur', ref: 'CSH-240712', narr: 'Booking advance cash', debit: 25_000, credit: 0, bal: 42_000, mode: 'Cash Deposit' },
    { id: 'bct-038', num: 'BCT-2026-00078', m: 4, d: 25, type: 'Cash Withdrawal', kind: 'cash', cashId: CASH_IDS.plantPetty, acct: 'Plant Petty Cash', ref: 'PET-240425', narr: 'Canteen & stationery', debit: 0, credit: 2_800, bal: 22_200 },
    { id: 'bct-039', num: 'BCT-2026-00079', m: 5, d: 28, type: 'Cash Deposit', kind: 'cash', cashId: CASH_IDS.hoMain, acct: 'HO Main Cash', ref: 'CSH-240528', narr: 'Staff welfare collection', debit: 8_500, credit: 0, bal: 83_500 },
    { id: 'bct-040', num: 'BCT-2026-00080', m: 6, d: 10, type: 'Vendor Payment', kind: 'cash', cashId: CASH_IDS.plantPetty, acct: 'Plant Petty Cash', party: 'Local Transport', ref: 'PET-240610', narr: 'Urgent material carriage', debit: 0, credit: 4_500, bal: 17_700 },
    { id: 'bct-041', num: 'BCT-2026-00081', m: 7, d: 6, type: 'Bank Interest', kind: 'bank', bankId: BANK_IDS.iciciPlant, acct: 'ICICI Plant Operating A/c', ref: 'INT-JUN26', narr: 'Savings interest credit', debit: 0, credit: 1_250, bal: 482_750, mode: 'Other', recon: false },
    { id: 'bct-042', num: 'BCT-2026-00082', m: 7, d: 9, type: 'Cheque Issue', kind: 'bank', bankId: BANK_IDS.hdfcMain, acct: 'HDFC Main Operating A/c', party: 'Office Lease — Koregaon', ref: 'CHQ-558901', narr: 'Quarterly rent cheque', debit: 450_000, credit: 0, bal: 3_483_500, mode: 'Cheque', chq: '558901', recon: false },
  ]

  return seeds.map((s) => ({
    id: s.id,
    transactionNumber: s.num,
    transactionDate: fyDate(s.m, s.d),
    valueDate: fyDate(s.m, s.d),
    transactionType: s.type,
    accountKind: s.kind,
    bankAccountId: s.bankId ?? null,
    cashAccountId: s.cashId ?? null,
    accountName: s.acct,
    counterpartyName: s.party ?? null,
    reference: s.ref,
    narration: s.narr,
    debitAmount: s.debit,
    creditAmount: s.credit,
    runningBalance: s.bal,
    currency: s.bankId === BANK_IDS.hdfcUsd ? 'USD' : 'INR',
    transferMode: s.mode ?? null,
    chequeNumber: s.chq ?? null,
    utrNumber: s.utr ?? null,
    voucherId: s.vch ? `vch-${s.vch}` : null,
    voucherNumber: s.vch ?? null,
    fundTransferId: null,
    reconciliationId: s.recon ? 'brecon-001' : null,
    isReconciled: Boolean(s.recon),
    createdBy: CREATED_BY,
    createdAt: fyDateTime(s.m, s.d),
  }))
}

export function seedFundTransfers(): FundTransfer[] {
  return [
    {
      id: 'ftr-001', transferNumber: 'FTR-2026-00018', transferDate: fyDate(5, 18), valueDate: fyDate(5, 18),
      transferType: 'Bank to Bank', transferMode: 'Internal Transfer', status: 'Completed',
      fromAccountKind: 'bank', fromBankAccountId: BANK_IDS.hdfcMain, fromCashAccountId: null, fromAccountName: 'HDFC Main Operating A/c',
      toAccountKind: 'bank', toBankAccountId: BANK_IDS.hdfcPayroll, toCashAccountId: null, toAccountName: 'HDFC Payroll A/c',
      amount: 620_000, currency: 'INR', exchangeRate: null, charges: 0,
      narration: 'Monthly payroll funding', reference: 'FT-240518', utrNumber: null,
      submittedBy: CREATED_BY, submittedAt: fyDateTime(5, 18, 9), approvedBy: APPROVED_BY, approvedAt: fyDateTime(5, 18, 11),
      rejectedBy: null, rejectedAt: null, rejectionReason: null, completedAt: fyDateTime(5, 18, 12),
      createdBy: CREATED_BY, createdAt: fyDateTime(5, 18, 8), modifiedAt: fyDateTime(5, 18, 12),
    },
    {
      id: 'ftr-002', transferNumber: 'FTR-2026-00019', transferDate: fyDate(7, 8), valueDate: fyDate(7, 8),
      transferType: 'Bank to Bank', transferMode: 'Internal Transfer', status: 'Completed',
      fromAccountKind: 'bank', fromBankAccountId: BANK_IDS.hdfcMain, fromCashAccountId: null, fromAccountName: 'HDFC Main Operating A/c',
      toAccountKind: 'bank', toBankAccountId: BANK_IDS.hdfcCollection, toCashAccountId: null, toAccountName: 'HDFC Collection A/c',
      amount: 500_000, currency: 'INR', exchangeRate: null, charges: 0,
      narration: 'Collection account top-up', reference: 'FT-240708', utrNumber: null,
      submittedBy: CREATED_BY, submittedAt: fyDateTime(7, 8, 9), approvedBy: APPROVED_BY, approvedAt: fyDateTime(7, 8, 10),
      rejectedBy: null, rejectedAt: null, rejectionReason: null, completedAt: fyDateTime(7, 8, 11),
      createdBy: CREATED_BY, createdAt: fyDateTime(7, 8, 8), modifiedAt: fyDateTime(7, 8, 11),
    },
    {
      id: 'ftr-003', transferNumber: 'FTR-2026-00020', transferDate: fyDate(7, 14), valueDate: fyDate(7, 14),
      transferType: 'Bank to Cash', transferMode: 'Cash Withdrawal', status: 'Pending Approval',
      fromAccountKind: 'bank', fromBankAccountId: BANK_IDS.hdfcMain, fromCashAccountId: null, fromAccountName: 'HDFC Main Operating A/c',
      toAccountKind: 'cash', toBankAccountId: null, toCashAccountId: CASH_IDS.hoMain, toAccountName: 'HO Main Cash',
      amount: 200_000, currency: 'INR', exchangeRate: null, charges: 0,
      narration: 'Weekly cash requirement — HO', reference: 'FT-240714', utrNumber: null,
      submittedBy: CREATED_BY, submittedAt: fyDateTime(7, 14, 9),
      approvedBy: null, approvedAt: null, rejectedBy: null, rejectedAt: null, rejectionReason: null, completedAt: null,
      createdBy: CREATED_BY, createdAt: fyDateTime(7, 14, 8), modifiedAt: fyDateTime(7, 14, 9),
    },
    {
      id: 'ftr-004', transferNumber: 'FTR-2026-00021', transferDate: fyDate(7, 15), valueDate: fyDate(7, 15),
      transferType: 'Cash to Bank', transferMode: 'Cash Deposit', status: 'Approved',
      fromAccountKind: 'cash', fromBankAccountId: null, fromCashAccountId: CASH_IDS.salesOffice, fromAccountName: 'Sales Office Cash',
      toAccountKind: 'bank', toBankAccountId: BANK_IDS.hdfcCollection, toCashAccountId: null, toAccountName: 'HDFC Collection A/c',
      amount: 85_000, currency: 'INR', exchangeRate: null, charges: 0,
      narration: 'Sales counter cash deposit', reference: 'FT-240715', utrNumber: null,
      submittedBy: 'Neha Joshi', submittedAt: fyDateTime(7, 15, 10), approvedBy: APPROVED_BY, approvedAt: fyDateTime(7, 15, 14),
      rejectedBy: null, rejectedAt: null, rejectionReason: null, completedAt: null,
      createdBy: 'Neha Joshi', createdAt: fyDateTime(7, 15, 9), modifiedAt: fyDateTime(7, 15, 14),
    },
    {
      id: 'ftr-005', transferNumber: 'FTR-2026-00022', transferDate: fyDate(6, 20), valueDate: fyDate(6, 20),
      transferType: 'Foreign Currency Transfer', transferMode: 'RTGS', status: 'Rejected',
      fromAccountKind: 'bank', fromBankAccountId: BANK_IDS.iciciVendor, fromCashAccountId: null, fromAccountName: 'ICICI Vendor Payment A/c',
      toAccountKind: 'bank', toBankAccountId: BANK_IDS.hdfcUsd, toCashAccountId: null, toAccountName: 'HDFC USD FC A/c',
      amount: 500_000, currency: 'INR', exchangeRate: 83.25, charges: 25,
      narration: 'FC margin top-up — rejected (wrong account)', reference: 'FT-240620', utrNumber: null,
      submittedBy: CREATED_BY, submittedAt: fyDateTime(6, 20, 9), approvedBy: null, approvedAt: null,
      rejectedBy: APPROVED_BY, rejectedAt: fyDateTime(6, 20, 15), rejectionReason: 'Use dedicated FC funding account, not vendor payment a/c',
      completedAt: null, createdBy: CREATED_BY, createdAt: fyDateTime(6, 20, 8), modifiedAt: fyDateTime(6, 20, 15),
    },
    {
      id: 'ftr-006', transferNumber: 'FTR-2026-00023', transferDate: fyDate(7, 10), valueDate: fyDate(7, 10),
      transferType: 'Cash to Cash', transferMode: 'Internal Transfer', status: 'Draft',
      fromAccountKind: 'cash', fromBankAccountId: null, fromCashAccountId: CASH_IDS.hoMain, fromAccountName: 'HO Main Cash',
      toAccountKind: 'cash', toBankAccountId: null, toCashAccountId: CASH_IDS.plantPetty, toAccountName: 'Plant Petty Cash',
      amount: 20_000, currency: 'INR', exchangeRate: null, charges: 0,
      narration: 'Petty cash replenishment — draft', reference: 'FT-DRAFT-001', utrNumber: null,
      submittedBy: null, submittedAt: null, approvedBy: null, approvedAt: null,
      rejectedBy: null, rejectedAt: null, rejectionReason: null, completedAt: null,
      createdBy: CREATED_BY, createdAt: fyDateTime(7, 10, 8), modifiedAt: fyDateTime(7, 10, 8),
    },
    {
      id: 'ftr-007', transferNumber: 'FTR-2026-00024', transferDate: fyDate(5, 5), valueDate: fyDate(5, 5),
      transferType: 'Bank to Bank', transferMode: 'NEFT', status: 'Reversed',
      fromAccountKind: 'bank', fromBankAccountId: BANK_IDS.hdfcMain, fromCashAccountId: null, fromAccountName: 'HDFC Main Operating A/c',
      toAccountKind: 'bank', toBankAccountId: BANK_IDS.iciciPlant, toCashAccountId: null, toAccountName: 'ICICI Plant Operating A/c',
      amount: 150_000, currency: 'INR', exchangeRate: null, charges: 5,
      narration: 'Plant emergency fund — reversed after duplicate', reference: 'FT-240505', utrNumber: 'HDFCN240505881',
      submittedBy: CREATED_BY, submittedAt: fyDateTime(5, 5, 9), approvedBy: APPROVED_BY, approvedAt: fyDateTime(5, 5, 11),
      rejectedBy: null, rejectedAt: null, rejectionReason: null, completedAt: fyDateTime(5, 5, 12),
      createdBy: CREATED_BY, createdAt: fyDateTime(5, 5, 8), modifiedAt: fyDateTime(5, 6, 10),
    },
    {
      id: 'ftr-008', transferNumber: 'FTR-2026-00025', transferDate: fyDate(7, 16), valueDate: fyDate(7, 16),
      transferType: 'Bank to Bank', transferMode: 'IMPS', status: 'In Process',
      fromAccountKind: 'bank', fromBankAccountId: BANK_IDS.hdfcCollection, fromCashAccountId: null, fromAccountName: 'HDFC Collection A/c',
      toAccountKind: 'bank', toBankAccountId: BANK_IDS.iciciVendor, toCashAccountId: null, toAccountName: 'ICICI Vendor Payment A/c',
      amount: 275_000, currency: 'INR', exchangeRate: null, charges: 5,
      narration: 'Vendor payment pool transfer', reference: 'FT-240716', utrNumber: 'HDFCI240716002',
      submittedBy: CREATED_BY, submittedAt: fyDateTime(7, 16, 9), approvedBy: APPROVED_BY, approvedAt: fyDateTime(7, 16, 10),
      rejectedBy: null, rejectedAt: null, rejectionReason: null, completedAt: null,
      createdBy: CREATED_BY, createdAt: fyDateTime(7, 16, 8), modifiedAt: fyDateTime(7, 16, 10),
    },
    {
      id: 'ftr-009', transferNumber: 'FTR-2026-00026', transferDate: fyDate(6, 10), valueDate: fyDate(6, 10),
      transferType: 'Intercompany', transferMode: 'NEFT', status: 'Completed',
      fromAccountKind: 'bank', fromBankAccountId: BANK_IDS.hdfcMain, fromCashAccountId: null, fromAccountName: 'HDFC Main Operating A/c',
      toAccountKind: 'bank', toBankAccountId: BANK_IDS.iciciPlant, toCashAccountId: null, toAccountName: 'ICICI Plant Operating A/c',
      amount: 350_000, currency: 'INR', exchangeRate: null, charges: 0,
      narration: 'Intercompany plant operating fund transfer — HO to Chakan', reference: 'IC-240610', utrNumber: 'HDFCN240610442',
      submittedBy: CREATED_BY, submittedAt: fyDateTime(6, 10, 9), approvedBy: APPROVED_BY, approvedAt: fyDateTime(6, 10, 11),
      rejectedBy: null, rejectedAt: null, rejectionReason: null, completedAt: fyDateTime(6, 10, 14),
      createdBy: CREATED_BY, createdAt: fyDateTime(6, 10, 8), modifiedAt: fyDateTime(6, 10, 14),
    },
  ]
}

export const STATEMENT_IDS = {
  hdfcMainMatched: 'bstmt-001',
  hdfcCollectionPartial: 'bstmt-002',
  iciciPlantErrors: 'bstmt-003',
} as const

export function seedBankStatements(): BankStatement[] {
  return [
    {
      id: STATEMENT_IDS.hdfcMainMatched,
      statementNumber: 'STMT-HDFC-2026-06',
      bankAccountId: BANK_IDS.hdfcMain,
      bankAccountName: 'HDFC Main Operating A/c',
      periodFrom: fyDate(6, 1),
      periodTo: fyDate(6, 30),
      openingBalance: 5_561_920,
      closingBalance: 4_248_500,
      totalDebits: 2_317_420,
      totalCredits: 1_004_000,
      lineCount: 8,
      importedAt: fyDateTime(7, 2, 11),
      importedBy: CREATED_BY,
      fileName: 'HDFC_Main_Jun2026.csv',
      status: 'Fully Reconciled',
      errorCount: 0,
      duplicateCount: 0,
      matchedCount: 8,
      unmatchedCount: 0,
      createdAt: fyDateTime(7, 2, 11),
    },
    {
      id: STATEMENT_IDS.hdfcCollectionPartial,
      statementNumber: 'STMT-HDFC-COL-2026-07',
      bankAccountId: BANK_IDS.hdfcCollection,
      bankAccountName: 'HDFC Collection A/c',
      periodFrom: fyDate(7, 1),
      periodTo: fyDate(7, 15),
      openingBalance: 2_835_200,
      closingBalance: 3_655_200,
      totalDebits: 0,
      totalCredits: 1_005_000,
      lineCount: 5,
      importedAt: fyDateTime(7, 12, 10),
      importedBy: CREATED_BY,
      fileName: 'HDFC_Collection_Jul2026.csv',
      status: 'Partially Reconciled',
      errorCount: 0,
      duplicateCount: 1,
      matchedCount: 2,
      unmatchedCount: 2,
      createdAt: fyDateTime(7, 12, 10),
    },
    {
      id: STATEMENT_IDS.iciciPlantErrors,
      statementNumber: 'STMT-ICICI-PLT-2026-07',
      bankAccountId: BANK_IDS.iciciPlant,
      bankAccountName: 'ICICI Plant Operating A/c',
      periodFrom: fyDate(7, 1),
      periodTo: fyDate(7, 10),
      openingBalance: 436_400,
      closingBalance: 482_750,
      totalDebits: 48_600,
      totalCredits: 95_000,
      lineCount: 6,
      importedAt: fyDateTime(7, 11, 14),
      importedBy: 'Suresh Patil',
      fileName: 'ICICI_Plant_Jul2026.csv',
      status: 'With Errors',
      errorCount: 2,
      duplicateCount: 1,
      matchedCount: 1,
      unmatchedCount: 2,
      createdAt: fyDateTime(7, 11, 14),
    },
  ]
}

export function seedBankStatementLines(): BankStatementLine[] {
  return [
    // HDFC Main — fully matched June
    { id: 'bsl-001', statementId: STATEMENT_IDS.hdfcMainMatched, lineDate: fyDate(6, 5), valueDate: fyDate(6, 5), description: 'NEFT CR — JCB INDIA LTD', reference: 'NEFT240605442', debitAmount: 0, creditAmount: 875_000, balance: 6_436_920, matchStatus: 'Matched', reconciliationId: 'brecon-002', matchedBookLineId: 'bct-020', isDuplicate: false, validationMessage: null },
    { id: 'bsl-002', statementId: STATEMENT_IDS.hdfcMainMatched, lineDate: fyDate(6, 8), valueDate: fyDate(6, 8), description: 'CC PROCESSING FEE', reference: 'CHG-CC-JUN', debitAmount: 4_250, creditAmount: 0, balance: 6_432_670, matchStatus: 'Matched', reconciliationId: 'brecon-002', matchedBookLineId: 'bct-021', isDuplicate: false, validationMessage: null },
    { id: 'bsl-003', statementId: STATEMENT_IDS.hdfcMainMatched, lineDate: fyDate(6, 12), valueDate: fyDate(6, 12), description: 'RTGS DR — JSW STEEL', reference: 'RTGS240612009', debitAmount: 1_120_000, creditAmount: 0, balance: 5_312_670, matchStatus: 'Matched', reconciliationId: 'brecon-002', matchedBookLineId: 'bct-023', isDuplicate: false, validationMessage: null },
    { id: 'bsl-004', statementId: STATEMENT_IDS.hdfcMainMatched, lineDate: fyDate(6, 15), valueDate: fyDate(6, 15), description: 'CHQ CLG — ASHOK LEYLAND', reference: 'CHQ882341', debitAmount: 0, creditAmount: 1_180_000, balance: 6_492_670, matchStatus: 'Matched', reconciliationId: 'brecon-002', matchedBookLineId: 'bct-022', isDuplicate: false, validationMessage: null },
    { id: 'bsl-005', statementId: STATEMENT_IDS.hdfcMainMatched, lineDate: fyDate(6, 22), valueDate: fyDate(6, 22), description: 'GST REFUND CR', reference: 'GST-REF-240622', debitAmount: 0, creditAmount: 48_350, balance: 6_541_020, matchStatus: 'Matched', reconciliationId: 'brecon-002', matchedBookLineId: 'bct-026', isDuplicate: false, validationMessage: null },
    { id: 'bsl-006', statementId: STATEMENT_IDS.hdfcMainMatched, lineDate: fyDate(6, 25), valueDate: fyDate(6, 25), description: 'RECON ADJUSTMENT', reference: 'ADJ-240625', debitAmount: 1_500, creditAmount: 0, balance: 6_539_520, matchStatus: 'Matched', reconciliationId: 'brecon-002', matchedBookLineId: 'bct-027', isDuplicate: false, validationMessage: null },
    { id: 'bsl-007', statementId: STATEMENT_IDS.hdfcMainMatched, lineDate: fyDate(6, 28), valueDate: fyDate(6, 28), description: 'CASH DEP — SALES OFFICE', reference: 'CD-240628', debitAmount: 0, creditAmount: 85_000, balance: 6_624_520, matchStatus: 'Matched', reconciliationId: 'brecon-002', matchedBookLineId: 'bct-028', isDuplicate: false, validationMessage: null },
    { id: 'bsl-008', statementId: STATEMENT_IDS.hdfcMainMatched, lineDate: fyDate(6, 30), valueDate: fyDate(6, 30), description: 'SALARY DR — PAYROLL', reference: 'SAL-JUN26', debitAmount: 520_000, creditAmount: 0, balance: 4_248_500, matchStatus: 'Matched', reconciliationId: 'brecon-002', matchedBookLineId: 'bct-029', isDuplicate: false, validationMessage: null },
    // HDFC Collection — partial July
    { id: 'bsl-009', statementId: STATEMENT_IDS.hdfcCollectionPartial, lineDate: fyDate(7, 1), valueDate: fyDate(7, 1), description: 'NEFT CR — JCB INDIA', reference: 'NEFT240601442', debitAmount: 0, creditAmount: 875_000, balance: 3_710_200, matchStatus: 'Matched', reconciliationId: 'brecon-001', matchedBookLineId: 'bct-020', isDuplicate: false, validationMessage: null },
    { id: 'bsl-010', statementId: STATEMENT_IDS.hdfcCollectionPartial, lineDate: fyDate(7, 5), valueDate: fyDate(7, 5), description: 'UPI CR — TATA MOTORS', reference: 'UPI2405059921', debitAmount: 0, creditAmount: 250_000, balance: 3_960_200, matchStatus: 'Unmatched', reconciliationId: 'brecon-001', matchedBookLineId: null, isDuplicate: false, validationMessage: null },
    { id: 'bsl-011', statementId: STATEMENT_IDS.hdfcCollectionPartial, lineDate: fyDate(7, 8), valueDate: fyDate(7, 8), description: 'INTERNAL TRF CR', reference: 'FT-240708', debitAmount: 0, creditAmount: 500_000, balance: 4_460_200, matchStatus: 'Matched', reconciliationId: 'brecon-001', matchedBookLineId: 'bct-033', isDuplicate: false, validationMessage: null },
    { id: 'bsl-012', statementId: STATEMENT_IDS.hdfcCollectionPartial, lineDate: fyDate(7, 10), valueDate: fyDate(7, 10), description: 'UPI CR — TATA MOTORS (DUPLICATE)', reference: 'UPI2405059921', debitAmount: 0, creditAmount: 250_000, balance: 4_710_200, matchStatus: 'Duplicate', reconciliationId: 'brecon-001', matchedBookLineId: null, isDuplicate: true, validationMessage: 'Duplicate reference detected' },
    { id: 'bsl-013', statementId: STATEMENT_IDS.hdfcCollectionPartial, lineDate: fyDate(7, 12), valueDate: fyDate(7, 12), description: 'CHQ DEP — FORCE MOTORS', reference: 'CHQ991204', debitAmount: 0, creditAmount: 320_000, balance: 3_655_200, matchStatus: 'Unmatched', reconciliationId: 'brecon-001', matchedBookLineId: null, isDuplicate: false, validationMessage: null },
    // ICICI Plant — errors
    { id: 'bsl-014', statementId: STATEMENT_IDS.iciciPlantErrors, lineDate: fyDate(7, 5), valueDate: fyDate(7, 5), description: 'IMPS DR — LOCAL FABRICATOR', reference: 'IMPS240525771', debitAmount: 48_600, creditAmount: 0, balance: 387_800, matchStatus: 'Matched', reconciliationId: null, matchedBookLineId: 'bct-019', isDuplicate: false, validationMessage: null },
    { id: 'bsl-015', statementId: STATEMENT_IDS.iciciPlantErrors, lineDate: fyDate(7, 6), valueDate: fyDate(7, 6), description: 'INT CR', reference: 'INT-JUN26', debitAmount: 0, creditAmount: 1_250, balance: 389_050, matchStatus: 'Unmatched', reconciliationId: null, matchedBookLineId: null, isDuplicate: false, validationMessage: null },
    { id: 'bsl-016', statementId: STATEMENT_IDS.iciciPlantErrors, lineDate: fyDate(7, 7), valueDate: fyDate(7, 7), description: 'INVALID DATE ROW', reference: 'ERR-001', debitAmount: 0, creditAmount: 0, balance: 389_050, matchStatus: 'Unmatched', reconciliationId: null, matchedBookLineId: null, isDuplicate: false, validationMessage: 'Invalid amount — both debit and credit zero' },
    { id: 'bsl-017', statementId: STATEMENT_IDS.iciciPlantErrors, lineDate: fyDate(7, 8), valueDate: fyDate(7, 8), description: 'GST REFUND CR (DUPLICATE)', reference: 'GST-REF-240622', debitAmount: 0, creditAmount: 48_350, balance: 437_400, matchStatus: 'Duplicate', reconciliationId: null, matchedBookLineId: null, isDuplicate: true, validationMessage: 'Duplicate reference in import file' },
    { id: 'bsl-018', statementId: STATEMENT_IDS.iciciPlantErrors, lineDate: fyDate(7, 9), valueDate: fyDate(7, 9), description: 'UNKNOWN CREDIT', reference: '', debitAmount: 0, creditAmount: 45_350, balance: 482_750, matchStatus: 'Unmatched', reconciliationId: null, matchedBookLineId: null, isDuplicate: false, validationMessage: 'Missing reference number' },
    { id: 'bsl-019', statementId: STATEMENT_IDS.iciciPlantErrors, lineDate: fyDate(7, 10), valueDate: fyDate(7, 10), description: 'MALFORMED AMOUNT', reference: 'ERR-002', debitAmount: -500, creditAmount: 0, balance: 482_250, matchStatus: 'Unmatched', reconciliationId: null, matchedBookLineId: null, isDuplicate: false, validationMessage: 'Negative debit amount not allowed' },
  ]
}

function reconLine(
  id: string,
  reconId: string,
  side: ReconciliationLine['side'],
  m: number,
  d: number,
  desc: string,
  ref: string,
  debit: number,
  credit: number,
  status: ReconciliationLine['matchStatus'],
  stmtId: string | null,
  bookId: string | null,
  conf: ReconciliationLine['confidence'] = null,
): ReconciliationLine {
  return {
    id,
    reconciliationId: reconId,
    side,
    lineDate: fyDate(m, d),
    description: desc,
    reference: ref,
    debitAmount: debit,
    creditAmount: credit,
    amount: debit > 0 ? debit : credit,
    matchStatus: status,
    statementLineId: stmtId,
    bookTransactionId: bookId,
    confidence: conf,
  }
}

export function seedReconciliations(): Reconciliation[] {
  /** Draft workbench session — rich unmatched set for auto/manual matching demos */
  const draftLines: ReconciliationLine[] = [
    // Already matched
    reconLine('rcl-005', 'brecon-001', 'statement', 7, 8, 'INTERNAL TRF CR', 'FT-240708', 0, 500_000, 'Matched', 'bsl-011', 'bct-033', 'High'),
    reconLine('rcl-006', 'brecon-001', 'statement', 7, 1, 'NEFT CR — JCB INDIA', 'NEFT240601442', 0, 875_000, 'Matched', 'bsl-009', 'bct-020', 'High'),
    reconLine('rcl-007', 'brecon-001', 'book', 7, 8, 'Fund Transfer — Collection A/c', 'FT-240708', 0, 500_000, 'Matched', null, 'bct-033', 'High'),
    reconLine('rcl-008', 'brecon-001', 'book', 7, 1, 'Customer Receipt — JCB India', 'NEFT240601442', 0, 875_000, 'Matched', null, 'bct-020', 'High'),
    // 1:1 high-confidence candidates
    reconLine('rcl-001', 'brecon-001', 'statement', 7, 5, 'UPI CR — TATA MOTORS', 'UPI2405059921', 0, 250_000, 'Unmatched', 'bsl-010', null),
    reconLine('rcl-002', 'brecon-001', 'book', 5, 5, 'UPI CR — Tata Motors CVBU', 'UPI2405059921', 0, 250_000, 'Unmatched', null, 'bct-012', 'High'),
    reconLine('rcl-003', 'brecon-001', 'statement', 7, 12, 'CHQ DEP — FORCE MOTORS', 'CHQ991204', 0, 320_000, 'Unmatched', 'bsl-013', null),
    reconLine('rcl-004', 'brecon-001', 'book', 7, 5, 'CHQ DEP — Force Motors PDC', 'CHQ991204', 0, 320_000, 'Unmatched', null, 'bct-031', 'High'),
    // One statement → many book (1:N) — ₹180,000 bank credit vs two receipts
    reconLine('rcl-009', 'brecon-001', 'statement', 7, 9, 'NEFT CR — MIXED RECEIPTS', 'NEFT240709880', 0, 180_000, 'Unmatched', 'bsl-demo-1n', null),
    reconLine('rcl-010', 'brecon-001', 'book', 7, 9, 'Customer Receipt — Local Dealer A', 'RCPT-A-0709', 0, 100_000, 'Unmatched', null, 'bct-demo-a', null),
    reconLine('rcl-011', 'brecon-001', 'book', 7, 9, 'Customer Receipt — Local Dealer B', 'RCPT-B-0709', 0, 80_000, 'Unmatched', null, 'bct-demo-b', null),
    // Many statement → one book (N:1) — two bank charges vs one journal
    reconLine('rcl-012', 'brecon-001', 'statement', 7, 10, 'SMS ALERT CHARGES', 'CHG-SMS-JUL', 118, 0, 'Unmatched', 'bsl-demo-chg1', null),
    reconLine('rcl-013', 'brecon-001', 'statement', 7, 10, 'IMPS FEE', 'CHG-IMPS-JUL', 177, 0, 'Unmatched', 'bsl-demo-chg2', null),
    reconLine('rcl-014', 'brecon-001', 'book', 7, 10, 'Bank Charges — July pack', 'JV-BC-JUL', 295, 0, 'Unmatched', null, 'bct-demo-chg', 'Medium'),
    // Statement-only bank charge → Adjustment Required (creates difference)
    reconLine('rcl-015', 'brecon-001', 'statement', 7, 11, 'ACCOUNT MAINTENANCE FEE', 'CHG-AMF-JUL', 2_500, 0, 'Adjustment Required', 'bsl-demo-amf', null),
    // Interest credit unmatched
    reconLine('rcl-016', 'brecon-001', 'statement', 7, 14, 'INTEREST CREDIT', 'INT-JUL26', 0, 1_850, 'Unmatched', 'bsl-demo-int', null),
    // Payment in transit (book payment not on statement)
    reconLine('rcl-017', 'brecon-001', 'book', 7, 14, 'Vendor RTGS — SKF Bearings (in transit)', 'RTGS-SKF-0714', 98_750, 0, 'Unmatched', null, 'bct-demo-pit', null),
    // Deposit in transit
    reconLine('rcl-018', 'brecon-001', 'book', 7, 15, 'Cash Deposit slip (in transit)', 'CD-0715', 0, 45_000, 'Unmatched', null, 'bct-demo-dit', null),
  ]

  const draftMatches: ReconciliationMatch[] = [
    { id: 'rm-001', reconciliationId: 'brecon-001', statementLineId: 'bsl-009', bookLineId: 'rcl-008', matchAmount: 875_000, confidence: 'High', matchStatus: 'Matched', matchedAt: fyDateTime(7, 12, 11), matchedBy: CREATED_BY },
    { id: 'rm-002', reconciliationId: 'brecon-001', statementLineId: 'bsl-011', bookLineId: 'rcl-007', matchAmount: 500_000, confidence: 'High', matchStatus: 'Matched', matchedAt: fyDateTime(7, 12, 11), matchedBy: CREATED_BY },
  ]

  const completedLines: ReconciliationLine[] = [
    reconLine('rcl-101', 'brecon-002', 'statement', 6, 30, 'SALARY DR — PAYROLL', 'SAL-JUN26', 520_000, 0, 'Matched', 'bsl-008', 'bct-029', 'High'),
    reconLine('rcl-102', 'brecon-002', 'statement', 6, 25, 'RECON ADJUSTMENT', 'ADJ-240625', 1_500, 0, 'Matched', 'bsl-006', 'bct-027', 'High'),
  ]

  const completedMatches: ReconciliationMatch[] = [
    { id: 'rm-101', reconciliationId: 'brecon-002', statementLineId: 'bsl-008', bookLineId: 'rcl-101', matchAmount: 520_000, confidence: 'High', matchStatus: 'Matched', matchedAt: fyDateTime(7, 2, 14), matchedBy: APPROVED_BY },
    { id: 'rm-102', reconciliationId: 'brecon-002', statementLineId: 'bsl-006', bookLineId: 'rcl-102', matchAmount: 1_500, confidence: 'High', matchStatus: 'Matched', matchedAt: fyDateTime(7, 2, 14), matchedBy: APPROVED_BY },
  ]

  return [
    {
      id: 'brecon-001',
      reconciliationNumber: 'BREC-2026-00007',
      bankAccountId: BANK_IDS.hdfcCollection,
      bankAccountName: 'HDFC Collection A/c',
      statementId: STATEMENT_IDS.hdfcCollectionPartial,
      periodFrom: fyDate(7, 1),
      periodTo: fyDate(7, 15),
      openingBookBalance: 2_835_200,
      openingStatementBalance: 2_835_200,
      closingBookBalance: 3_655_200,
      closingStatementBalance: 3_655_200,
      matchedAmount: 1_375_000,
      unmatchedBookAmount: 894_045,
      unmatchedStatementAmount: 754_645,
      /** Unexplained difference = account maintenance fee (Adjustment Required) until authorised */
      finalDifference: 2_500,
      status: 'In Progress',
      completedAt: null,
      completedBy: null,
      adjustmentPosted: false,
      adjustmentAmount: 0,
      adjustmentReason: null,
      lines: draftLines,
      matches: draftMatches,
      createdBy: CREATED_BY,
      createdAt: fyDateTime(7, 12, 11),
      modifiedAt: fyDateTime(7, 12, 11),
    },
    {
      id: 'brecon-002',
      reconciliationNumber: 'BREC-2026-00006',
      bankAccountId: BANK_IDS.hdfcMain,
      bankAccountName: 'HDFC Main Operating A/c',
      statementId: STATEMENT_IDS.hdfcMainMatched,
      periodFrom: fyDate(6, 1),
      periodTo: fyDate(6, 30),
      openingBookBalance: 5_561_920,
      openingStatementBalance: 5_561_920,
      closingBookBalance: 4_248_500,
      closingStatementBalance: 4_248_500,
      matchedAmount: 2_317_420,
      unmatchedBookAmount: 0,
      unmatchedStatementAmount: 0,
      finalDifference: 0,
      status: 'Completed',
      completedAt: fyDateTime(7, 2, 14),
      completedBy: APPROVED_BY,
      adjustmentPosted: false,
      adjustmentAmount: 0,
      adjustmentReason: null,
      lines: completedLines,
      matches: completedMatches,
      createdBy: CREATED_BY,
      createdAt: fyDateTime(7, 2, 11),
      modifiedAt: fyDateTime(7, 2, 14),
    },
  ]
}

export function seedCheques(): Cheque[] {
  return [
    { id: 'chq-001', chequeNumber: '882341', chequeDate: fyDate(4, 12), direction: 'Received', status: 'Cleared', bankAccountId: BANK_IDS.hdfcMain, bankAccountName: 'HDFC Main Operating A/c', payeeName: 'Ashok Leyland Fleet', amount: 1_180_000, currency: 'INR', depositDate: fyDate(4, 12), clearanceDate: fyDate(6, 15), bounceDate: null, bounceReason: null, pdcDate: null, reference: 'CHQ-882341', narration: 'Trailer dispatch payment', linkedTransactionId: 'bct-022', createdBy: CREATED_BY, createdAt: fyDateTime(4, 12) },
    { id: 'chq-002', chequeNumber: '445201', chequeDate: fyDate(5, 8), direction: 'Issued', status: 'Issued', bankAccountId: BANK_IDS.iciciVendor, bankAccountName: 'ICICI Vendor Payment A/c', payeeName: 'SKF Bearings India', amount: 98_750, currency: 'INR', depositDate: null, clearanceDate: null, bounceDate: null, bounceReason: null, pdcDate: null, reference: 'CHQ-445201', narration: 'Bearing set procurement', linkedTransactionId: 'bct-013', createdBy: CREATED_BY, createdAt: fyDateTime(5, 8) },
    { id: 'chq-003', chequeNumber: '991204', chequeDate: fyDate(7, 15), direction: 'Received', status: 'PDC', bankAccountId: BANK_IDS.hdfcCollection, bankAccountName: 'HDFC Collection A/c', payeeName: 'Force Motors', amount: 320_000, currency: 'INR', depositDate: fyDate(7, 5), clearanceDate: null, bounceDate: null, bounceReason: null, pdcDate: fyDate(7, 15), reference: 'CHQ-991204', narration: 'Post-dated cheque — Jul dispatch', linkedTransactionId: 'bct-031', createdBy: CREATED_BY, createdAt: fyDateTime(7, 5) },
    { id: 'chq-004', chequeNumber: '558901', chequeDate: fyDate(7, 9), direction: 'Issued', status: 'Issued', bankAccountId: BANK_IDS.hdfcMain, bankAccountName: 'HDFC Main Operating A/c', payeeName: 'Office Lease — Koregaon', amount: 450_000, currency: 'INR', depositDate: null, clearanceDate: null, bounceDate: null, bounceReason: null, pdcDate: null, reference: 'CHQ-558901', narration: 'Quarterly rent', linkedTransactionId: 'bct-042', createdBy: CREATED_BY, createdAt: fyDateTime(7, 9) },
    { id: 'chq-005', chequeNumber: '772105', chequeDate: fyDate(6, 18), direction: 'Received', status: 'Bounced', bankAccountId: BANK_IDS.hdfcCollection, bankAccountName: 'HDFC Collection A/c', payeeName: 'Local Dealer — Satara', amount: 85_000, currency: 'INR', depositDate: fyDate(6, 18), clearanceDate: null, bounceDate: fyDate(6, 25), bounceReason: 'Insufficient funds', pdcDate: null, reference: 'CHQ-772105', narration: 'Dealer booking advance — bounced', linkedTransactionId: null, createdBy: 'Neha Joshi', createdAt: fyDateTime(6, 18) },
    { id: 'chq-006', chequeNumber: '334890', chequeDate: fyDate(5, 22), direction: 'Received', status: 'Deposited', bankAccountId: BANK_IDS.hdfcMain, bankAccountName: 'HDFC Main Operating A/c', payeeName: 'Bharat Forge', amount: 542_000, currency: 'INR', depositDate: fyDate(5, 22), clearanceDate: null, bounceDate: null, bounceReason: null, pdcDate: null, reference: 'CHQ-334890', narration: 'Awaiting clearance', linkedTransactionId: null, createdBy: CREATED_BY, createdAt: fyDateTime(5, 22) },
    { id: 'chq-007', chequeNumber: '661023', chequeDate: fyDate(4, 28), direction: 'Issued', status: 'Cleared', bankAccountId: BANK_IDS.iciciVendor, bankAccountName: 'ICICI Vendor Payment A/c', payeeName: 'Cummins India', amount: 215_000, currency: 'INR', depositDate: null, clearanceDate: fyDate(5, 3), bounceDate: null, bounceReason: null, pdcDate: null, reference: 'CHQ-661023', narration: 'Engine service parts', linkedTransactionId: null, createdBy: CREATED_BY, createdAt: fyDateTime(4, 28) },
    { id: 'chq-008', chequeNumber: '889012', chequeDate: fyDate(8, 5), direction: 'Received', status: 'PDC', bankAccountId: BANK_IDS.hdfcCollection, bankAccountName: 'HDFC Collection A/c', payeeName: 'Mahindra Logistics Ltd', amount: 750_000, currency: 'INR', depositDate: null, clearanceDate: null, bounceDate: null, bounceReason: null, pdcDate: fyDate(8, 5), reference: 'CHQ-889012', narration: 'PDC against SO balance', linkedTransactionId: null, createdBy: CREATED_BY, createdAt: fyDateTime(7, 10) },
  ]
}

export function seedBankDeposits(): BankDeposit[] {
  return [
    { id: 'bdep-001', depositNumber: 'DEP-2026-00014', depositDate: fyDate(4, 8), depositType: 'Cash Deposit', status: 'Cleared', bankAccountId: BANK_IDS.hdfcMain, bankAccountName: 'HDFC Main Operating A/c', cashAccountId: CASH_IDS.hoMain, cashAccountName: 'HO Main Cash', totalAmount: 125_000, cashAmount: 125_000, chequeAmount: 0, chequeCount: 0, slipNumber: 'CD-240408', narration: 'HO cash deposited at Koregaon Park branch', createdBy: CREATED_BY, createdAt: fyDateTime(4, 8) },
    { id: 'bdep-002', depositNumber: 'DEP-2026-00015', depositDate: fyDate(6, 28), depositType: 'Cash Deposit', status: 'Deposited', bankAccountId: BANK_IDS.hdfcCollection, bankAccountName: 'HDFC Collection A/c', cashAccountId: CASH_IDS.salesOffice, cashAccountName: 'Sales Office Cash', totalAmount: 85_000, cashAmount: 85_000, chequeAmount: 0, chequeCount: 0, slipNumber: 'CD-240628', narration: 'Sales counter collections', createdBy: 'Neha Joshi', createdAt: fyDateTime(6, 28) },
    { id: 'bdep-003', depositNumber: 'DEP-2026-00016', depositDate: fyDate(7, 5), depositType: 'Cheque Deposit', status: 'Pending', bankAccountId: BANK_IDS.hdfcCollection, bankAccountName: 'HDFC Collection A/c', cashAccountId: null, cashAccountName: null, totalAmount: 320_000, cashAmount: 0, chequeAmount: 320_000, chequeCount: 1, slipNumber: 'CD-240705', narration: 'Force Motors PDC deposit', createdBy: CREATED_BY, createdAt: fyDateTime(7, 5) },
    { id: 'bdep-004', depositNumber: 'DEP-2026-00017', depositDate: fyDate(7, 15), depositType: 'Mixed', status: 'Draft', bankAccountId: BANK_IDS.hdfcCollection, bankAccountName: 'HDFC Collection A/c', cashAccountId: CASH_IDS.salesOffice, cashAccountName: 'Sales Office Cash', totalAmount: 95_000, cashAmount: 45_000, chequeAmount: 50_000, chequeCount: 2, slipNumber: null, narration: 'Mixed deposit — draft pending verification', createdBy: 'Neha Joshi', createdAt: fyDateTime(7, 15) },
  ]
}

function denomRows(counts: Partial<Record<number, number>>) {
  return INDIAN_DENOMINATIONS.map((d) => {
    const count = counts[d] ?? 0
    return { denomination: d, count, amount: d * count }
  }).filter((r) => r.count > 0)
}

export function seedCashCounts(): CashCount[] {
  return [
    {
      id: 'ccnt-001', countNumber: 'CCNT-2026-00005', countDate: fyDate(7, 1), cashAccountId: CASH_IDS.hoMain, cashAccountName: 'HO Main Cash',
      status: 'Approved', bookBalance: 185_000, physicalTotal: 185_000, varianceAmount: 0, varianceStatus: 'Matched',
      denominations: denomRows({ 2000: 50, 500: 90, 200: 50, 100: 100, 50: 40, 20: 50, 10: 50, 5: 20, 2: 10, 1: 10 }),
      countedBy: 'Priya Sharma', verifiedBy: 'Rahul Mehta', approvedBy: APPROVED_BY, approvedAt: fyDateTime(7, 1, 14),
      adjustmentPosted: false, notes: 'Monthly HO cash verification', createdAt: fyDateTime(7, 1, 10),
    },
    {
      id: 'ccnt-002', countNumber: 'CCNT-2026-00006', countDate: fyDate(7, 5), cashAccountId: CASH_IDS.maintImprest, cashAccountName: 'Maintenance Imprest',
      status: 'Submitted', bookBalance: 10_000, physicalTotal: 9_650, varianceAmount: -350, varianceStatus: 'Shortage',
      denominations: denomRows({ 500: 12, 200: 10, 100: 15, 50: 10, 20: 10, 10: 10, 5: 6 }),
      countedBy: 'Ravi Deshmukh', verifiedBy: 'Suresh Patil', approvedBy: null, approvedAt: null,
      adjustmentPosted: false, notes: 'Shortage — missing petty cash voucher for grease purchase', createdAt: fyDateTime(7, 5, 11),
    },
    {
      id: 'ccnt-003', countNumber: 'CCNT-2026-00007', countDate: fyDate(7, 12), cashAccountId: CASH_IDS.plantPetty, cashAccountName: 'Plant Petty Cash',
      status: 'Draft', bookBalance: 25_000, physicalTotal: 25_450, varianceAmount: 450, varianceStatus: 'Excess',
      denominations: denomRows({ 500: 35, 200: 20, 100: 30, 50: 20, 20: 15, 10: 10, 5: 9 }),
      countedBy: 'Suresh Patil', verifiedBy: null, approvedBy: null, approvedAt: null,
      adjustmentPosted: false, notes: 'Excess found — unrecorded refund from canteen vendor', createdAt: fyDateTime(7, 12, 9),
    },
    {
      id: 'ccnt-004', countNumber: 'CCNT-2026-00004', countDate: fyDate(6, 28), cashAccountId: CASH_IDS.plantPetty, cashAccountName: 'Plant Petty Cash',
      status: 'Posted', bookBalance: 22_000, physicalTotal: 22_000, varianceAmount: 0, varianceStatus: 'Matched',
      denominations: denomRows({ 500: 30, 200: 20, 100: 30, 50: 20, 20: 20, 10: 20 }),
      countedBy: 'Suresh Patil', verifiedBy: 'Ravi Deshmukh', approvedBy: APPROVED_BY, approvedAt: fyDateTime(6, 28, 15),
      adjustmentPosted: false, notes: null, createdAt: fyDateTime(6, 28, 11),
    },
  ]
}

export function seedBankCashSetup(): BankCashSetup {
  return {
    companyName: COMPANY,
    defaultCurrency: 'INR',
    financialYearStartMonth: 4,
    autoReconciliationEnabled: true,
    requireDualApprovalAbove: 500_000,
    allowNegativeCash: false,
    defaultTransferMode: 'NEFT',
    chequeSeriesPrefix: 'CHQ-',
    depositSlipPrefix: 'DEP-',
    fundTransferPrefix: 'FTR-',
    reconciliationTolerance: 1,
    statementImportFormats: ['CSV', 'MT940', 'Excel'],
    notifyOnVariance: true,
    notifyOnBouncedCheque: true,
    approvalWorkflowEnabled: true,
  }
}

export function seedBankCashAudit(): BankCashAuditEntry[] {
  return [
    { id: 'bca-001', entityType: 'Reconciliation', entityId: 'brecon-002', action: 'Complete', details: 'June HDFC main reconciliation completed — zero difference', performedBy: APPROVED_BY, performedAt: fyDateTime(7, 2, 14), isDemo: true },
    { id: 'bca-002', entityType: 'FundTransfer', entityId: 'ftr-002', action: 'Complete', details: 'Internal transfer FTR-2026-00019 completed', performedBy: APPROVED_BY, performedAt: fyDateTime(7, 8, 11), isDemo: true },
    { id: 'bca-003', entityType: 'CashCount', entityId: 'ccnt-001', action: 'Approve', details: 'HO cash count approved — matched', performedBy: APPROVED_BY, performedAt: fyDateTime(7, 1, 14), isDemo: true },
    { id: 'bca-004', entityType: 'Cheque', entityId: 'chq-005', action: 'Bounce', details: 'Cheque 772105 bounced — insufficient funds', performedBy: CREATED_BY, performedAt: fyDateTime(6, 25, 10), isDemo: true },
    { id: 'bca-005', entityType: 'BankStatement', entityId: STATEMENT_IDS.iciciPlantErrors, action: 'Import', details: 'Imported ICICI plant statement with 2 errors and 1 duplicate', performedBy: 'Suresh Patil', performedAt: fyDateTime(7, 11, 14), isDemo: true },
    { id: 'bca-006', entityType: 'FundTransfer', entityId: 'ftr-005', action: 'Reject', details: 'Rejected FC margin transfer — wrong source account', performedBy: APPROVED_BY, performedAt: fyDateTime(6, 20, 15), isDemo: true },
  ]
}

/**
 * Financial Reports demo seed — Vasant Trailers Pvt Ltd, FY 2026–27.
 * Demo / UI only. Amounts are illustrative; not statutory or audited figures.
 * Keep data out of page JSX — mutate only via financialReportsService.
 */
import type {
  AccountScheduleDefinition,
  BalanceSheetStatement,
  BudgetVsActualSeries,
  CashFlowStatement,
  CostCentreProfitabilityRow,
  DepartmentPerformanceRow,
  FinancialMisDashboard,
  FinancialReportSetup,
  FinancialReportsDashboardData,
  ManufacturingProfitabilityRow,
  ProfitLossStatement,
  ProjectProfitabilityRow,
  StatementLine,
  TrialBalanceRow,
} from '../../types/financialReports'
import { getIndianFinancialYear } from '../../utils/accounting/indianFinancialYear'

/** ISO date (YYYY-MM-DD) from a Date — demo-relative dates stay FY-aware. */
export function dateOnly(d = new Date()): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

const COMPANY = 'Vasant Trailers Pvt Ltd'
const FY = getIndianFinancialYear(new Date('2026-07-16'))
const PERIOD_LABEL = `${FY.label} · Apr–Jul 2026 (YTD)`

/** CoA-aligned account ids (see chartOfAccountsSeed). */
const ACC = {
  cash: 'coa-1111',
  hdfc: 'coa-1112',
  icici: 'coa-1113',
  debtors: 'coa-1131',
  rm: 'coa-1141',
  wip: 'coa-1142',
  fg: 'coa-1143',
  stores: 'coa-1144',
  plant: 'coa-1220',
  creditors: 'coa-2111',
  gstOut: 'coa-2131',
  tdsPay: 'coa-2140',
  salaryPay: 'coa-2150',
  loan: 'coa-2210',
  shareCap: 'coa-3100',
  reserves: 'coa-3200',
  retained: 'coa-3300',
  sales: 'coa-4100',
  scrap: 'coa-4400',
  material: 'coa-5100',
  labour: 'coa-5200',
  overhead: 'coa-5300',
  variance: 'coa-5500',
  admin: 'coa-6100',
  selling: 'coa-6200',
  employee: 'coa-6300',
  freight: 'coa-6500',
  finance: 'coa-6600',
  depreciation: 'coa-6700',
} as const

export function seedFinancialReportsDashboard(): FinancialReportsDashboardData {
  return {
    kpis: {
      revenue: 11_85_00_000,
      grossProfit: 3_42_00_000,
      ebitda: 1_68_00_000, // GP minus SG&A (excludes finance & depreciation)
      netProfit: 98_50_000,
      totalAssets: 5_12_00_000,
      totalLiabilities: 2_18_00_000,
      workingCapital: 1_45_00_000,
      cashAndBank: 56_10_000,
      receivables: 84_20_000,
      payables: 52_40_000,
      inventoryValue: 1_13_40_000,
      currentRatio: 1.62,
    },
    monthlyTrend: [
      { month: 'Apr 26', revenue: 2_45_00_000, expenses: 2_08_00_000, netProfit: 22_00_000 },
      { month: 'May 26', revenue: 2_78_00_000, expenses: 2_31_00_000, netProfit: 26_50_000 },
      { month: 'Jun 26', revenue: 3_12_00_000, expenses: 2_54_00_000, netProfit: 28_00_000 },
      { month: 'Jul 26', revenue: 3_50_00_000, expenses: 2_78_00_000, netProfit: 22_00_000 },
    ],
    expenseByCategory: [
      { category: 'Raw Material', amount: 4_82_00_000 },
      { category: 'Direct Labour', amount: 1_24_00_000 },
      { category: 'Factory Overhead', amount: 86_00_000 },
      { category: 'Admin & Selling', amount: 58_00_000 },
      { category: 'Finance & Depreciation', amount: 35_00_000 },
    ],
    budgetVsActual: [
      { label: 'Revenue', budget: 12_00_00_000, actual: 11_85_00_000, variance: -15_00_000 },
      { label: 'Material Cost', budget: 4_90_00_000, actual: 4_82_00_000, variance: 8_00_000 },
      { label: 'EBITDA', budget: 1_75_00_000, actual: 1_68_00_000, variance: -7_00_000 },
      { label: 'Net Profit', budget: 1_05_00_000, actual: 98_50_000, variance: -6_50_000 },
    ],
    receivablesVsPayables: [
      { month: 'Apr 26', receivables: 72_00_000, payables: 48_50_000 },
      { month: 'May 26', receivables: 78_40_000, payables: 50_20_000 },
      { month: 'Jun 26', receivables: 81_60_000, payables: 51_80_000 },
      { month: 'Jul 26', receivables: 84_20_000, payables: 52_40_000 },
    ],
    plantProfitability: [
      { plant: 'Main Plant — Pune', revenue: 7_85_00_000, contribution: 2_18_00_000, marginPct: 27.8 },
      { plant: 'Unit 2 — Chakan', revenue: 4_00_00_000, contribution: 1_24_00_000, marginPct: 31.0 },
    ],
    productCategoryProfitability: [
      { category: 'Semi-trailers (40 FT)', revenue: 6_20_00_000, marginPct: 28.5 },
      { category: 'Tippers & Hyva bodies', revenue: 3_45_00_000, marginPct: 26.2 },
      { category: 'Spare parts & service', revenue: 2_20_00_000, marginPct: 34.8 },
    ],
    alerts: [
      {
        id: 'fr-alert-wc',
        type: 'working_capital',
        severity: 'warning',
        title: 'Receivables ageing above 90 days',
        description: '₹18.4 L outstanding from 3 fleet operators — review collection plan',
        href: '/accounting/receivables/ageing?bucket=91-180',
      },
      {
        id: 'fr-alert-budget',
        type: 'budget_variance',
        severity: 'info',
        title: 'Revenue 1.3% below YTD budget',
        description: 'Tipper series dispatch delayed by chassis supply — Jul catch-up expected',
        href: '/accounting/reports/budget-vs-actual',
      },
      {
        id: 'fr-alert-variance',
        type: 'production_variance',
        severity: 'critical',
        title: 'Production variance spike — Jun',
        description: 'Scrap & rework on welding line 2 — ₹4.2 L unfavourable',
        href: '/accounting/reports/manufacturing',
      },
    ],
  }
}

export function seedTrialBalanceRows(): TrialBalanceRow[] {
  return [
    {
      accountId: ACC.cash,
      accountCode: '1111',
      accountName: 'Cash in Hand',
      accountGroup: 'Current Assets',
      openingDebit: 1_42_000,
      openingCredit: 0,
      periodDebit: 28_50_000,
      periodCredit: 27_07_000,
      closingDebit: 2_85_000,
      closingCredit: 0,
    },
    {
      accountId: ACC.hdfc,
      accountCode: '1112',
      accountName: 'HDFC Bank — Current A/c',
      accountGroup: 'Current Assets',
      openingDebit: 38_20_000,
      openingCredit: 0,
      periodDebit: 2_45_00_000,
      periodCredit: 2_38_45_000,
      closingDebit: 49_75_000,
      closingCredit: 0,
    },
    {
      accountId: ACC.icici,
      accountCode: '1113',
      accountName: 'ICICI Bank — Current A/c',
      accountGroup: 'Current Assets',
      openingDebit: 11_80_000,
      openingCredit: 0,
      periodDebit: 86_00_000,
      periodCredit: 91_45_000,
      closingDebit: 6_35_000,
      closingCredit: 0,
    },
    {
      accountId: ACC.debtors,
      accountCode: '1131',
      accountName: 'Trade Debtors',
      accountGroup: 'Current Assets',
      openingDebit: 68_40_000,
      openingCredit: 0,
      periodDebit: 11_85_00_000,
      periodCredit: 10_69_20_000,
      closingDebit: 84_20_000,
      closingCredit: 0,
    },
    {
      accountId: ACC.rm,
      accountCode: '1141',
      accountName: 'Raw Material Inventory',
      accountGroup: 'Inventory',
      openingDebit: 58_60_000,
      openingCredit: 0,
      periodDebit: 4_95_00_000,
      periodCredit: 4_92_60_000,
      closingDebit: 61_00_000,
      closingCredit: 0,
    },
    {
      accountId: ACC.wip,
      accountCode: '1142',
      accountName: 'Work in Progress Inventory',
      accountGroup: 'Inventory',
      openingDebit: 16_20_000,
      openingCredit: 0,
      periodDebit: 3_42_00_000,
      periodCredit: 3_38_00_000,
      closingDebit: 20_20_000,
      closingCredit: 0,
    },
    {
      accountId: ACC.fg,
      accountCode: '1143',
      accountName: 'Finished Goods Inventory',
      accountGroup: 'Inventory',
      openingDebit: 24_80_000,
      openingCredit: 0,
      periodDebit: 3_18_00_000,
      periodCredit: 3_12_40_000,
      closingDebit: 30_40_000,
      closingCredit: 0,
    },
    {
      accountId: ACC.creditors,
      accountCode: '2111',
      accountName: 'Trade Creditors',
      accountGroup: 'Current Liabilities',
      openingDebit: 0,
      openingCredit: 46_80_000,
      periodDebit: 4_72_00_000,
      periodCredit: 5_24_60_000,
      closingDebit: 0,
      closingCredit: 52_40_000,
    },
    {
      accountId: ACC.salaryPay,
      accountCode: '2150',
      accountName: 'Salary Payable',
      accountGroup: 'Current Liabilities',
      openingDebit: 0,
      openingCredit: 9_80_000,
      periodDebit: 1_24_00_000,
      periodCredit: 1_26_40_000,
      closingDebit: 0,
      closingCredit: 11_20_000,
    },
    {
      accountId: ACC.sales,
      accountCode: '4100',
      accountName: 'Domestic Sales',
      accountGroup: 'Income',
      openingDebit: 0,
      openingCredit: 0,
      periodDebit: 12_40_000,
      periodCredit: 11_97_40_000,
      closingDebit: 0,
      closingCredit: 11_85_00_000,
    },
    {
      accountId: ACC.material,
      accountCode: '5100',
      accountName: 'Raw Material Consumption',
      accountGroup: 'COGS',
      openingDebit: 0,
      openingCredit: 0,
      periodDebit: 4_82_00_000,
      periodCredit: 0,
      closingDebit: 4_82_00_000,
      closingCredit: 0,
    },
    {
      accountId: ACC.labour,
      accountCode: '5200',
      accountName: 'Direct Labour',
      accountGroup: 'COGS',
      openingDebit: 0,
      openingCredit: 0,
      periodDebit: 1_24_00_000,
      periodCredit: 0,
      closingDebit: 1_24_00_000,
      closingCredit: 0,
    },
    {
      accountId: ACC.overhead,
      accountCode: '5300',
      accountName: 'Factory Overheads',
      accountGroup: 'COGS',
      openingDebit: 0,
      openingCredit: 0,
      periodDebit: 86_00_000,
      periodCredit: 0,
      closingDebit: 86_00_000,
      closingCredit: 0,
    },
    {
      accountId: ACC.admin,
      accountCode: '6100',
      accountName: 'Administrative Expenses',
      accountGroup: 'Operating Expenses',
      openingDebit: 0,
      openingCredit: 0,
      periodDebit: 32_00_000,
      periodCredit: 0,
      closingDebit: 32_00_000,
      closingCredit: 0,
    },
    {
      accountId: ACC.selling,
      accountCode: '6200',
      accountName: 'Selling and Distribution Expenses',
      accountGroup: 'Operating Expenses',
      openingDebit: 0,
      openingCredit: 0,
      periodDebit: 26_00_000,
      periodCredit: 0,
      closingDebit: 26_00_000,
      closingCredit: 0,
    },
  ]
}

function plLine(
  code: string,
  label: string,
  amount: number,
  opts: Partial<StatementLine> = {},
): StatementLine {
  return {
    code,
    label,
    amount,
    indent: 0,
    bold: false,
    underline: false,
    isTotal: false,
    isHeader: false,
    ...opts,
  }
}

export function seedProfitLossStatement(): ProfitLossStatement {
  const priorLabel = 'FY 2025–26 (same period)'
  return {
    companyName: COMPANY,
    periodLabel: PERIOD_LABEL,
    priorPeriodLabel: priorLabel,
    budgetLabel: 'Budget YTD',
    sections: [
      {
        id: 'revenue',
        title: 'Revenue',
        lines: [
          plLine('4100', 'Domestic Sales — Trailers & Tippers', 10_65_00_000, {
            accountId: ACC.sales,
            indent: 1,
            priorAmount: 9_82_00_000,
            budgetAmount: 10_80_00_000,
          }),
          plLine('4400', 'Scrap Sales', 12_00_000, {
            accountId: ACC.scrap,
            indent: 1,
            priorAmount: 9_50_000,
            budgetAmount: 10_00_000,
          }),
          plLine('4500', 'Service & Spares Income', 1_08_00_000, { indent: 1, priorAmount: 95_00_000, budgetAmount: 1_10_00_000 }),
          plLine('REV-T', 'Total Revenue', 11_85_00_000, {
            bold: true,
            isTotal: true,
            priorAmount: 10_86_50_000,
            budgetAmount: 12_00_00_000,
          }),
        ],
      },
      {
        id: 'cogs',
        title: 'Cost of Goods Sold',
        lines: [
          plLine('5100', 'Raw Material Consumption', 6_15_00_000, {
            accountId: ACC.material,
            indent: 1,
            priorAmount: 5_68_00_000,
            budgetAmount: 6_22_00_000,
          }),
          plLine('5200', 'Direct Labour', 1_24_00_000, {
            accountId: ACC.labour,
            indent: 1,
            priorAmount: 1_12_00_000,
            budgetAmount: 1_26_00_000,
          }),
          plLine('5300', 'Factory Overheads', 86_00_000, {
            accountId: ACC.overhead,
            indent: 1,
            priorAmount: 78_00_000,
            budgetAmount: 88_00_000,
          }),
          plLine('5500', 'Production Variance', 18_00_000, {
            accountId: ACC.variance,
            indent: 1,
            priorAmount: 12_00_000,
            budgetAmount: 10_00_000,
          }),
          plLine('COGS-T', 'Total COGS', 8_43_00_000, { bold: true, isTotal: true, priorAmount: 7_70_00_000, budgetAmount: 8_46_00_000 }),
          plLine('GP', 'Gross Profit', 3_42_00_000, {
            bold: true,
            isTotal: true,
            priorAmount: 3_16_50_000,
            budgetAmount: 3_54_00_000,
          }),
        ],
      },
      {
        id: 'opex',
        title: 'Operating Expenses',
        lines: [
          plLine('6100', 'Administrative Expenses', 32_00_000, { accountId: ACC.admin, indent: 1, priorAmount: 28_00_000 }),
          plLine('6200', 'Selling & Distribution', 26_00_000, { accountId: ACC.selling, indent: 1, priorAmount: 24_00_000 }),
          plLine('6300', 'Employee Expenses (SG&A)', 78_00_000, { accountId: ACC.employee, indent: 1, priorAmount: 68_00_000 }),
          plLine('6500', 'Freight Outward', 38_00_000, { accountId: ACC.freight, indent: 1, priorAmount: 34_00_000 }),
          plLine('OPEX-T', 'Total Operating Expenses', 1_74_00_000, { bold: true, isTotal: true, priorAmount: 1_54_00_000 }),
          plLine('EBITDA', 'EBITDA', 1_68_00_000, { bold: true, isTotal: true, priorAmount: 1_62_50_000, budgetAmount: 1_75_00_000 }),
          plLine('6600', 'Finance Costs', 14_00_000, { accountId: ACC.finance, indent: 1, priorAmount: 13_20_000 }),
          plLine('6700', 'Depreciation', 21_00_000, { accountId: ACC.depreciation, indent: 1, priorAmount: 19_80_000 }),
          plLine('PBT', 'Profit Before Tax', 1_33_00_000, { bold: true, isTotal: true, priorAmount: 1_29_50_000 }),
          plLine('TAX', 'Tax Expense (demo)', 34_50_000, { indent: 1, priorAmount: 37_50_000 }),
          plLine('NP', 'Net Profit', 98_50_000, {
            bold: true,
            underline: true,
            isTotal: true,
            priorAmount: 92_00_000,
            budgetAmount: 1_05_00_000,
          }),
        ],
      },
    ],
    netProfit: 98_50_000,
    priorNetProfit: 92_00_000,
  }
}

export function seedBalanceSheetStatement(): BalanceSheetStatement {
  return {
    companyName: COMPANY,
    periodLabel: PERIOD_LABEL,
    priorPeriodLabel: 'As at 31 Mar 2026',
    asOfDate: dateOnly(new Date('2026-07-16')),
    sections: [
      {
        id: 'assets',
        title: 'Assets',
        lines: [
          plLine('A-H', 'Current Assets', 0, { isHeader: true, bold: true }),
          plLine('1111', 'Cash in Hand', 2_85_000, { accountId: ACC.cash, indent: 1, priorAmount: 1_85_000 }),
          plLine('1112', 'HDFC Bank', 49_75_000, { accountId: ACC.hdfc, indent: 1, priorAmount: 42_50_000 }),
          plLine('1113', 'ICICI Bank', 6_35_000, { accountId: ACC.icici, indent: 1, priorAmount: 11_80_000 }),
          plLine('1131', 'Trade Debtors', 84_20_000, { accountId: ACC.debtors, indent: 1, priorAmount: 68_40_000 }),
          plLine('1141', 'Raw Material Inventory', 61_00_000, { accountId: ACC.rm, indent: 1, priorAmount: 58_60_000 }),
          plLine('1142', 'Work in Progress', 20_20_000, { accountId: ACC.wip, indent: 1, priorAmount: 18_40_000 }),
          plLine('1143', 'Finished Goods', 30_40_000, { accountId: ACC.fg, indent: 1, priorAmount: 29_60_000 }),
          plLine('1144', 'Stores & Consumables', 1_80_000, { accountId: ACC.stores, indent: 1, priorAmount: 4_20_000 }),
          plLine('CA-T', 'Total Current Assets', 2_54_55_000, { bold: true, isTotal: true, indent: 1, priorAmount: 2_35_35_000 }),
          plLine('FA-H', 'Fixed Assets', 0, { isHeader: true, bold: true }),
          plLine('1220', 'Plant & Machinery (net)', 2_57_45_000, { accountId: ACC.plant, indent: 1, priorAmount: 2_59_20_000 }),
          plLine('TA', 'Total Assets', 5_12_00_000, { bold: true, underline: true, isTotal: true, priorAmount: 4_94_55_000 }),
        ],
      },
      {
        id: 'liabilities',
        title: 'Liabilities & Equity',
        lines: [
          plLine('L-H', 'Current Liabilities', 0, { isHeader: true, bold: true }),
          plLine('2111', 'Trade Creditors', 52_40_000, { accountId: ACC.creditors, indent: 1, priorAmount: 46_80_000 }),
          plLine('2131', 'GST Payable', 21_80_000, { accountId: ACC.gstOut, indent: 1, priorAmount: 19_60_000 }),
          plLine('2140', 'TDS Payable', 6_40_000, { accountId: ACC.tdsPay, indent: 1, priorAmount: 5_80_000 }),
          plLine('2150', 'Salary Payable', 11_20_000, { accountId: ACC.salaryPay, indent: 1, priorAmount: 9_80_000 }),
          plLine('CL-T', 'Total Current Liabilities', 91_80_000, { bold: true, isTotal: true, indent: 1, priorAmount: 82_00_000 }),
          plLine('LT-H', 'Long-Term Liabilities', 0, { isHeader: true, bold: true }),
          plLine('2210', 'Secured Term Loan', 95_00_000, { accountId: ACC.loan, indent: 1, priorAmount: 98_00_000 }),
          plLine('TL-L', 'Total Liabilities', 1_86_80_000, { bold: true, isTotal: true, priorAmount: 1_80_00_000 }),
          plLine('E-H', 'Equity', 0, { isHeader: true, bold: true }),
          plLine('3100', 'Share Capital', 1_50_00_000, { accountId: ACC.shareCap, indent: 1, priorAmount: 1_50_00_000 }),
          plLine('3200', 'Reserves & Surplus', 42_00_000, { accountId: ACC.reserves, indent: 1, priorAmount: 42_00_000 }),
          plLine('3300', 'Retained Earnings', 1_25_70_000, { accountId: ACC.retained, indent: 1, priorAmount: 1_16_20_000 }),
          plLine('CY-PNL', 'Current Year P&L (YTD)', 98_50_000, { indent: 1, priorAmount: 0 }),
          plLine('TE', 'Total Liabilities & Equity', 5_12_00_000, { bold: true, underline: true, isTotal: true, priorAmount: 4_94_55_000 }),
        ],
      },
    ],
    totalAssets: 5_12_00_000,
    totalLiabilitiesAndEquity: 5_12_00_000,
    isBalanced: true,
  }
}

export function seedCashFlowStatement(): CashFlowStatement {
  return {
    companyName: COMPANY,
    periodLabel: PERIOD_LABEL,
    openingCash: 55_85_000,
    closingCash: 58_95_000,
    netChangeInCash: 3_10_000,
    sections: [
      {
        section: 'Operating',
        subtotal: 42_00_000,
        lines: [
          plLine('CF-NP', 'Net Profit', 98_50_000, { indent: 1 }),
          plLine('CF-DEP', 'Add: Depreciation', 21_00_000, { indent: 1 }),
          plLine('CF-WC', 'Working capital changes', -77_50_000, { indent: 1 }),
        ],
      },
      {
        section: 'Investing',
        subtotal: -18_00_000,
        lines: [
          plLine('CF-CAPEX', 'Purchase of plant & machinery', -22_00_000, { indent: 1 }),
          plLine('CF-SCRAP', 'Proceeds from asset disposal', 4_00_000, { indent: 1 }),
        ],
      },
      {
        section: 'Financing',
        subtotal: -20_90_000,
        lines: [
          plLine('CF-LOAN', 'Term loan repayment', -15_00_000, { indent: 1 }),
          plLine('CF-INT', 'Interest paid', -5_90_000, { indent: 1 }),
        ],
      },
    ],
  }
}

export function seedAccountScheduleDefinitions(): AccountScheduleDefinition[] {
  return [
    {
      id: 'asch-mpl',
      code: 'MPL-01',
      name: 'Management P&L',
      description: 'Monthly management P&L layout for board review — trailers manufacturing.',
      category: 'Management',
      active: true,
      lastRunAt: '2026-07-15T06:30:00.000Z',
      isDemo: true,
      columns: [
        { id: 'col-cm', label: 'Jul 2026', columnType: 'CurrentMonth' },
        { id: 'col-pm', label: 'Jun 2026', columnType: 'PreviousMonth' },
        { id: 'col-cy', label: 'YTD FY26-27', columnType: 'CurrentYear' },
        { id: 'col-bud', label: 'Budget YTD', columnType: 'Budget' },
        { id: 'col-var', label: 'Variance', columnType: 'Variance' },
      ],
      rows: [
        {
          rowCode: 'R01',
          description: 'Gross Sales',
          totalingType: 'PostingAccounts',
          accountRange: '4100-4500',
          formula: '',
          show: true,
          indent: 0,
          bold: false,
          underline: false,
          signReversal: false,
        },
        {
          rowCode: 'R02',
          description: 'Less: Returns & discounts',
          totalingType: 'PostingAccounts',
          accountRange: '4900',
          formula: '',
          show: true,
          indent: 1,
          bold: false,
          underline: false,
          signReversal: true,
        },
        {
          rowCode: 'R03',
          description: 'Net Sales',
          totalingType: 'Formula',
          accountRange: '',
          formula: 'R01-R02',
          show: true,
          indent: 0,
          bold: true,
          underline: false,
          signReversal: false,
        },
        {
          rowCode: 'R04',
          description: 'Material, Labour & Overhead',
          totalingType: 'PostingAccounts',
          accountRange: '5100-5400',
          formula: '',
          show: true,
          indent: 0,
          bold: false,
          underline: false,
          signReversal: false,
        },
        {
          rowCode: 'R05',
          description: 'Contribution',
          totalingType: 'Formula',
          accountRange: '',
          formula: 'R03-R04',
          show: true,
          indent: 0,
          bold: true,
          underline: true,
          signReversal: false,
        },
      ],
    },
    {
      id: 'asch-wc',
      code: 'WC-01',
      name: 'Working Capital Movement',
      description: 'Debtors, creditors, inventory bridge for monthly MIS.',
      category: 'Working Capital',
      active: true,
      lastRunAt: '2026-07-10T09:00:00.000Z',
      isDemo: true,
      columns: [
        { id: 'col-open', label: 'Opening', columnType: 'PreviousYear' },
        { id: 'col-close', label: 'Closing', columnType: 'CurrentYear' },
        { id: 'col-move', label: 'Movement', columnType: 'Variance' },
      ],
      rows: [
        {
          rowCode: 'WC1',
          description: 'Trade Debtors',
          totalingType: 'PostingAccounts',
          accountRange: '1131',
          formula: '',
          show: true,
          indent: 0,
          bold: false,
          underline: false,
          signReversal: false,
        },
        {
          rowCode: 'WC2',
          description: 'Inventory (RM + WIP + FG)',
          totalingType: 'PostingAccounts',
          accountRange: '1141-1143',
          formula: '',
          show: true,
          indent: 0,
          bold: false,
          underline: false,
          signReversal: false,
        },
        {
          rowCode: 'WC3',
          description: 'Trade Creditors',
          totalingType: 'PostingAccounts',
          accountRange: '2111',
          formula: '',
          show: true,
          indent: 0,
          bold: false,
          underline: false,
          signReversal: true,
        },
        {
          rowCode: 'WC-T',
          description: 'Net Working Capital',
          totalingType: 'Formula',
          accountRange: '',
          formula: 'WC1+WC2-WC3',
          show: true,
          indent: 0,
          bold: true,
          underline: true,
          signReversal: false,
        },
      ],
    },
  ]
}

export function seedManufacturingProfitability(): ManufacturingProfitabilityRow[] {
  return [
    {
      productCategory: 'Semi-trailers (40 FT flatbed)',
      unitsProduced: 118,
      revenue: 6_20_00_000,
      materialCost: 3_85_00_000,
      labourCost: 98_00_000,
      overhead: 72_00_000,
      grossProfit: 1_65_00_000,
      marginPct: 26.6,
    },
    {
      productCategory: 'Tippers & hyva bodies',
      unitsProduced: 64,
      revenue: 3_45_00_000,
      materialCost: 2_18_00_000,
      labourCost: 58_00_000,
      overhead: 42_00_000,
      grossProfit: 87_00_000,
      marginPct: 25.2,
    },
    {
      productCategory: 'Spare parts & service kits',
      unitsProduced: 0,
      revenue: 2_20_00_000,
      materialCost: 79_00_000,
      labourCost: 18_00_000,
      overhead: 12_00_000,
      grossProfit: 1_11_00_000,
      marginPct: 50.5,
    },
  ]
}

export function seedBudgetVsActualSeries(): BudgetVsActualSeries[] {
  return [
    { label: 'Domestic Sales', category: 'Revenue', budget: 10_80_00_000, actual: 10_65_00_000, variance: -15_00_000, variancePct: -1.4 },
    { label: 'Spares & Service', category: 'Revenue', budget: 1_10_00_000, actual: 1_08_00_000, variance: -2_00_000, variancePct: -1.8 },
    { label: 'Scrap Sales', category: 'Revenue', budget: 10_00_000, actual: 12_00_000, variance: 2_00_000, variancePct: 20.0 },
    { label: 'Raw Material', category: 'COGS', budget: 4_90_00_000, actual: 4_82_00_000, variance: 8_00_000, variancePct: 1.6 },
    { label: 'Direct Labour', category: 'COGS', budget: 1_26_00_000, actual: 1_24_00_000, variance: 2_00_000, variancePct: 1.6 },
    { label: 'Factory Overhead', category: 'COGS', budget: 88_00_000, actual: 86_00_000, variance: 2_00_000, variancePct: 2.3 },
    { label: 'Admin & Selling', category: 'Opex', budget: 62_00_000, actual: 58_00_000, variance: 4_00_000, variancePct: 6.5 },
    { label: 'EBITDA', category: 'Profit', budget: 1_75_00_000, actual: 1_68_00_000, variance: -7_00_000, variancePct: -4.0 },
    { label: 'Net Profit', category: 'Profit', budget: 1_05_00_000, actual: 98_50_000, variance: -6_50_000, variancePct: -6.2 },
  ]
}

export function seedCostCentreProfitability(): CostCentreProfitabilityRow[] {
  return [
    {
      costCentreId: 'cc-prod',
      costCentreCode: 'CC-PROD',
      costCentreName: 'Production',
      revenue: 9_85_00_000,
      directCost: 6_42_00_000,
      overhead: 98_00_000,
      netContribution: 2_45_00_000,
      marginPct: 24.9,
    },
    {
      costCentreId: 'cc-sales',
      costCentreCode: 'CC-SALES',
      costCentreName: 'Sales & Marketing',
      revenue: 11_85_00_000,
      directCost: 0,
      overhead: 26_00_000,
      netContribution: -26_00_000,
      marginPct: -2.2,
    },
    {
      costCentreId: 'cc-admin',
      costCentreCode: 'CC-ADMIN',
      costCentreName: 'Administration',
      revenue: 0,
      directCost: 0,
      overhead: 32_00_000,
      netContribution: -32_00_000,
      marginPct: 0,
    },
    {
      costCentreId: 'cc-maint',
      costCentreCode: 'CC-MAINT',
      costCentreName: 'Maintenance',
      revenue: 0,
      directCost: 18_00_000,
      overhead: 12_00_000,
      netContribution: -30_00_000,
      marginPct: 0,
    },
  ]
}

export function seedDepartmentPerformance(): DepartmentPerformanceRow[] {
  return [
    {
      departmentId: 'dept-fab',
      departmentCode: 'FAB',
      departmentName: 'Fabrication',
      budget: 1_45_00_000,
      actual: 1_42_00_000,
      variance: 3_00_000,
      variancePct: 2.1,
      headcount: 86,
    },
    {
      departmentId: 'dept-assy',
      departmentCode: 'ASSY',
      departmentName: 'Assembly',
      budget: 98_00_000,
      actual: 1_02_00_000,
      variance: -4_00_000,
      variancePct: -4.1,
      headcount: 52,
    },
    {
      departmentId: 'dept-qc',
      departmentCode: 'QC',
      departmentName: 'Quality',
      budget: 18_00_000,
      actual: 19_50_000,
      variance: -1_50_000,
      variancePct: -8.3,
      headcount: 14,
    },
    {
      departmentId: 'dept-fin',
      departmentCode: 'FIN',
      departmentName: 'Finance',
      budget: 24_00_000,
      actual: 23_20_000,
      variance: 80_000,
      variancePct: 3.3,
      headcount: 8,
    },
  ]
}

export function seedProjectProfitability(): ProjectProfitabilityRow[] {
  return [
    {
      projectId: 'prj-t40',
      projectCode: 'PRJ-T40',
      projectName: 'Trailer 40 FT Program',
      customer: 'Maharashtra Logistics Fleet',
      revenue: 4_85_00_000,
      cost: 3_62_00_000,
      netResult: 1_23_00_000,
      marginPct: 25.4,
      status: 'Active',
    },
    {
      projectId: 'prj-tip',
      projectCode: 'PRJ-TIP',
      projectName: 'Tipper Series — Mining segment',
      customer: 'Western Quarry Co-op',
      revenue: 2_95_00_000,
      cost: 2_28_00_000,
      netResult: 67_00_000,
      marginPct: 22.7,
      status: 'Active',
    },
  ]
}

export function seedFinancialReportSetup(): FinancialReportSetup {
  return {
    defaultFy: FY.label,
    defaultComparisonMode: 'ytd',
    defaultViewMode: 'summary',
    showZeroBalanceAccounts: false,
    roundToNearest: 1,
    currencyDisplay: 'lakhs',
    includeProvisionalEntries: false,
    consolidatePlants: true,
    watermarkDemoReports: true,
    exportFormats: ['csv', 'excel', 'pdf'],
    scheduleEmailRecipients: ['cfo@vasanttrailers.in', 'accounts@vasanttrailers.in'],
    lastUpdatedBy: 'System Seed',
    lastUpdatedAt: '2026-04-01T04:30:00.000Z',
  }
}

export function seedFinancialMisSnapshot(view: FinancialMisDashboard['view'] = 'executive_summary'): FinancialMisDashboard {
  const base = {
    view,
    periodLabel: PERIOD_LABEL,
    generatedAt: new Date().toISOString(),
  }

  if (view === 'working_capital') {
    return {
      ...base,
      headline: 'Working capital days trending higher on RM inventory',
      kpis: [
        { label: 'Debtor Days', value: 52, unit: 'days', trendPct: 4.2 },
        { label: 'Creditor Days', value: 38, unit: 'days', trendPct: -1.1 },
        { label: 'Inventory Days', value: 46, unit: 'days', trendPct: 6.8 },
        { label: 'Cash Conversion Cycle', value: 60, unit: 'days', trendPct: 5.5 },
      ],
      charts: [
        {
          id: 'wc-bridge',
          title: 'WC Bridge (₹ Lakhs)',
          type: 'bar',
          data: [
            { label: 'Debtors', value: 84.2 },
            { label: 'Inventory', value: 113.4 },
            { label: 'Creditors', value: -52.4 },
          ],
        },
      ],
      highlights: ['FG dispatch accelerated in Jul — inventory days expected to improve'],
      risks: ['RM buffer for chassis shortage inflating RM stock by ₹8.2 L'],
    }
  }

  if (view === 'plant_dashboard') {
    return {
      ...base,
      headline: 'Chakan unit margin outperforms Pune on tipper mix',
      kpis: [
        { label: 'Pune Contribution', value: 218, unit: '₹ L', trendPct: 2.1 },
        { label: 'Chakan Contribution', value: 124, unit: '₹ L', trendPct: 8.4 },
        { label: 'OEE (demo)', value: 78, unit: '%', trendPct: -1.2 },
        { label: 'Scrap %', value: 1.8, unit: '%', trendPct: 0.3 },
      ],
      charts: [
        {
          id: 'plant-rev',
          title: 'Revenue by Plant',
          type: 'pie',
          data: [
            { label: 'Pune', value: 785 },
            { label: 'Chakan', value: 400 },
          ],
        },
      ],
      highlights: ['Tipper line 2 ramp completed — capacity +12 units/month'],
      risks: ['Welding rework cost centre overrun in Jun'],
    }
  }

  return {
    ...base,
    headline: 'YTD revenue ₹11.85 Cr — on track for ₹36 Cr annual plan',
    kpis: [
      { label: 'Revenue YTD', value: 11.85, unit: '₹ Cr', trendPct: 9.1 },
      { label: 'EBITDA Margin', value: 14.2, unit: '%', trendPct: -0.4 },
      { label: 'Net Profit', value: 98.5, unit: '₹ L', trendPct: 7.1 },
      { label: 'Order Book', value: 18.2, unit: '₹ Cr', trendPct: 12.0 },
    ],
    charts: [
      {
        id: 'rev-trend',
        title: 'Monthly Revenue (₹ L)',
        type: 'line',
        data: [
          { label: 'Apr', value: 245 },
          { label: 'May', value: 278 },
          { label: 'Jun', value: 312 },
          { label: 'Jul', value: 350 },
        ],
      },
      {
        id: 'margin-mix',
        title: 'Product Margin Mix',
        type: 'bar',
        data: [
          { label: 'Trailers', value: 28.5 },
          { label: 'Tippers', value: 26.2 },
          { label: 'Spares', value: 34.8 },
        ],
      },
    ],
    highlights: [
      'Spares revenue growing faster than trailer dispatch — attach rate up 6%',
      'Export enquiry pipeline ₹2.1 Cr (demo) — not in YTD numbers',
    ],
    risks: ['Collection slippage on 3 fleet accounts', 'Steel price volatility on Q2 buy-forward'],
  }
}

export { COMPANY as FINANCIAL_REPORTS_COMPANY_NAME, FY as FINANCIAL_REPORTS_FY, PERIOD_LABEL as FINANCIAL_REPORTS_PERIOD_LABEL }

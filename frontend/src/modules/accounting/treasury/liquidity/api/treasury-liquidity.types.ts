/** Finance Phase 5C1 — liquidity / cash position API types */

export interface CashPositionAccountRow {
  treasuryAccountId: string
  code: string
  name: string
  accountType: 'BANK' | 'CASH'
  glAccountId: string
  currencyCode: string
  bookBalance: string
  status: string
}

export interface CashPositionResult {
  legalEntityId: string
  asOfDate: string
  currencyCode: string
  totalBankBalance: string
  totalCashBalance: string
  totalBookBalance: string
  accounts: CashPositionAccountRow[]
  negativeCashAccountIds: string[]
}

export interface LiquidityBucket {
  label: string
  amount: string
}

export interface DailyLiquidityResult {
  legalEntityId: string
  asOfDate: string
  currencyCode: string
  bookBankBalance: string
  bookCashBalance: string
  totalBookBalance: string
  fundsInTransit: string
  unclearedIssuedCheques: string
  unclearedReceivedCheques: string
  unmatchedStatementAmount: string
  availableLiquidity: string
  buckets: LiquidityBucket[]
  warnings: string[]
}

export interface ForecastLine {
  source: string
  sourceId: string
  direction: 'INFLOW' | 'OUTFLOW'
  dueDate: string
  amount: string
  currencyCode: string
  description: string
  confidence: 'HIGH' | 'MEDIUM' | 'LOW'
}

export interface ForecastHorizonBucket {
  horizonDays: number
  inflow: string
  outflow: string
  net: string
  projectedClosing: string
}

export interface ShortTermForecastResult {
  legalEntityId: string
  asOfDate: string
  horizonDays: number
  currencyCode: string
  openingAvailableLiquidity: string
  lines: ForecastLine[]
  buckets: ForecastHorizonBucket[]
}

export interface ClosingControlItem {
  id: string
  label: string
  severity: 'critical' | 'warning' | 'info' | 'ok'
  passed: boolean
  detail: string
  count?: number
  amount?: string
  href?: string
}

export interface ClosingControlsResult {
  legalEntityId: string
  asOfDate: string
  readyToClose: boolean
  items: ClosingControlItem[]
  dayClose: { id: string; status: 'OPEN' | 'REVIEWED' | 'CLOSED'; updatedAt: string } | null
}

export interface TreasuryDashboardResult {
  legalEntityId: string
  asOfDate: string
  currencyCode: string
  position: CashPositionResult
  liquidity: DailyLiquidityResult
  forecast: ShortTermForecastResult
  closingControls: ClosingControlsResult
  workflow: {
    transfersInTransit: number
    transfersPendingApproval: number
    chequesUncleared: number
    adjustmentsReadyToPost: number
    openReconciliationSessions: number
    standingInstructionsDue: number
  }
}

export interface TreasuryDayCloseDto {
  id: string
  legalEntityId: string
  closeDate: string
  status: 'OPEN' | 'REVIEWED' | 'CLOSED'
  bookBankBalance: string
  bookCashBalance: string
  availableLiquidity: string
  currencyCode: string
  checklist: ClosingControlItem[]
  notes: string | null
  reviewedAt: string | null
  closedAt: string | null
  createdAt: string
  updatedAt: string
  allowedActions: {
    view: boolean
    review: boolean
    close: boolean
    reopen: boolean
  }
}

export interface LiquidityQuery {
  legalEntityId: string
  asOfDate?: string
  currencyCode?: string
  horizonDays?: number
}

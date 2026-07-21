/** Finance Phase 5C1 — treasury cash position / liquidity response types (Decimal as strings). */

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
  /** Book liquidity after known transit/uncleared visibility adjustments (informational). */
  availableLiquidity: string
  buckets: LiquidityBucket[]
  warnings: string[]
}

export type ForecastDirection = 'INFLOW' | 'OUTFLOW'
export type ForecastSource =
  | 'STANDING_INSTRUCTION'
  | 'PAYABLE_OPEN_ITEM'
  | 'RECEIVABLE_OPEN_ITEM'
  | 'TREASURY_CHEQUE'

export interface ForecastLine {
  source: ForecastSource
  sourceId: string
  direction: ForecastDirection
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

export type ClosingControlSeverity = 'critical' | 'warning' | 'info' | 'ok'

export interface ClosingControlItem {
  id: string
  label: string
  severity: ClosingControlSeverity
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
  dayClose: {
    id: string
    status: 'OPEN' | 'REVIEWED' | 'CLOSED'
    updatedAt: string
  } | null
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

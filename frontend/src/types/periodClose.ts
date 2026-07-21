/**
 * Period Close & Year-End — frontend types.
 * Demo mode: mock seed. API mode (Phase 1): real AccountingPeriod close/reopen + readiness compose.
 */

export type CloseWorkflowStage =
  | 'open'
  | 'close_preparation'
  | 'subledger_review'
  | 'adjustment_posting'
  | 'finance_review'
  | 'period_locked'

export type CloseTaskStatus =
  | 'not_started'
  | 'in_progress'
  | 'waiting'
  | 'blocked'
  | 'ready_for_review'
  | 'completed'
  | 'reopened'
  | 'not_applicable'

export type CloseTaskModule =
  | 'sales_ar'
  | 'purchase_ap'
  | 'inventory'
  | 'manufacturing'
  | 'fixed_assets'
  | 'bank_cash'
  | 'gst_tds'
  | 'general_ledger'

export type ReconciliationStatus =
  | 'open'
  | 'in_progress'
  | 'difference'
  | 'reviewed'
  | 'reconciled'

export type AccrualStatus = 'draft' | 'ready' | 'previewed' | 'posted_demo' | 'reversed_demo' | 'cancelled'

export type PrepaidStatus = 'active' | 'suspended' | 'closed' | 'fully_recognized'

export type ModuleLockStatus =
  | 'open'
  | 'soft_locked'
  | 'hard_locked'
  | 'reopened_temporarily'
  | 'closed'

export type ReopenRequestStatus =
  | 'draft'
  | 'pending_approval'
  | 'approved'
  | 'rejected'
  | 'open_temporarily'
  | 'expired'
  | 'closed'

export type YearEndWizardStep =
  | 'select_fy'
  | 'validate_open_periods'
  | 'validate_reconciliations'
  | 'review_trial_balance'
  | 'review_pnl'
  | 'review_tax'
  | 'review_fixed_assets'
  | 'review_inventory_wip'
  | 'preview_closing_entries'
  | 'transfer_pnl'
  | 'create_opening_balances'
  | 'final_approval'
  | 'lock_financial_year'

export interface PeriodFilterState {
  companyId: string
  companyName: string
  fiscalYear: string
  periodCode: string
  periodLabel: string
  locationId?: string
  /** API mode: AccountingPeriod UUID */
  periodId?: string
  /** API mode: FinancialYear UUID */
  fiscalYearId?: string
}

export type PeriodCloseReadinessSeverity = 'info' | 'warning' | 'blocking' | 'ok'

export type PeriodCloseReadinessCheckCode =
  | 'PERIOD_STATUS'
  | 'AP_CLOSE_GATE'
  | 'UNPOSTED_JOURNALS'
  | 'BANK_RECON'

export interface PeriodCloseReadinessCheck {
  code: PeriodCloseReadinessCheckCode
  label: string
  status: CloseTaskStatus
  severity: PeriodCloseReadinessSeverity
  message: string
  href?: string
  count?: number
}

export interface PeriodCloseReadiness {
  periodId: string
  periodCode: string
  periodLabel: string
  periodStatus: string
  legalEntityId: string
  overallProgressPct: number
  blockingCount: number
  warningCount: number
  unpostedJournalCount: number
  checks: PeriodCloseReadinessCheck[]
  /** Soft warnings only — backend close is not blocked by these. */
  canCloseSoft: boolean
}

export interface CloseTask {
  id: string
  periodCode: string
  task: string
  module: CloseTaskModule
  owner: string
  reviewer: string
  dueDate: string
  dependencyIds: string[]
  status: CloseTaskStatus
  completionPct: number
  evidence?: string
  comments?: string
}

export interface CloseCalendarEvent {
  id: string
  periodCode: string
  title: string
  category: 'checklist' | 'reconciliation' | 'lock' | 'year_end' | 'review' | 'other'
  dueDate: string
  owner: string
  status: 'upcoming' | 'due_soon' | 'due_today' | 'overdue' | 'completed' | 'not_applicable'
}

export interface SubledgerReconciliation {
  id: string
  periodCode: string
  name: string
  subledgerBalance: number
  glBalance: number
  difference: number
  lastReconciled?: string
  owner: string
  status: ReconciliationStatus
  notes?: string
}

export interface AccrualEntry {
  id: string
  accrualNumber: string
  accrualType: string
  accountCode: string
  accountName: string
  department?: string
  costCentre?: string
  amount: number
  startPeriod: string
  reversalDate: string
  source: string
  status: AccrualStatus
  debitAccount: string
  creditAccount: string
  narration: string
}

export interface PrepaidExpense {
  id: string
  name: string
  category: string
  originalAmount: number
  startDate: string
  endDate: string
  numberOfPeriods: number
  amountRecognized: number
  remainingBalance: number
  currentPeriodExpense: number
  status: PrepaidStatus
  expenseAccount: string
  prepaidAccount: string
}

export interface FxRevaluationLine {
  id: string
  accountOrParty: string
  currency: string
  foreignAmount: number
  originalRate: number
  closingRate: number
  bookValueInr: number
  revaluedValueInr: number
  gainLoss: number
}

export interface ModulePeriodLock {
  id: string
  module: string
  lockThroughDate: string
  status: ModuleLockStatus
  lockedBy?: string
  lockedDate?: string
  reopenAllowed: boolean
}

export interface ReopenRequest {
  id: string
  periodCode: string
  module: string
  reason: string
  documentRef?: string
  requestedBy: string
  requestedUntil: string
  riskExplanation: string
  status: ReopenRequestStatus
  approver?: string
  attachmentName?: string
  audit: { at: string; by: string; action: string; note?: string }[]
}

export interface InventoryCloseSummary {
  inventoryValue: number
  negativeStockItems: number
  unpostedMovements: number
  pendingTransfers: number
  pendingAdjustments: number
  itemLedgerVsGlDiff: number
  costAdjustmentStatus: string
}

export interface ManufacturingCloseSummary {
  openProductionOrders: number
  completedUnclosedOrders: number
  wipValue: number
  unpostedConsumption: number
  missingLabourBooking: number
  missingMachineBooking: number
  unallocatedOverhead: number
  productionVariance: number
  scrapVariance: number
}

export interface FixedAssetCloseSummary {
  pendingCapitalizations: number
  depreciationPreview: number
  pendingDisposals: number
  registerVsGlDiff: number
  lastDepreciationRun?: string
}

export interface BankCloseSummary {
  accountsPendingRecon: number
  cashCountsPending: number
  chequesInTransit: number
  unidentifiedTransactions: number
  bankVsGlDiff: number
}

export interface GstTdsCloseSummary {
  gstExceptionsOpen: number
  itcMismatches: number
  reverseChargePending: number
  tdsPayableDiff: number
  challansPending: number
}

export interface TrialBalanceLine {
  accountCode: string
  accountName: string
  debit: number
  credit: number
  exception?: string
}

export interface CloseDashboardData {
  periodCode: string
  periodLabel: string
  workflowStage: CloseWorkflowStage
  overallProgressPct: number
  tasksCompleted: number
  tasksPending: number
  overdueTasks: number
  unpostedDocuments: number
  reconciliationDifferences: number
  blockingExceptions: number
  periodStatusLabel: string
  deptProgress: { department: string; completed: number; total: number; pct: number }[]
  criticalBlockers: { id: string; title: string; module: string; href: string }[]
  pendingReconciliations: SubledgerReconciliation[]
  unpostedItems: { id: string; docType: string; docNo: string; amount: number; href: string }[]
  approvalWorklist: { id: string; title: string; owner: string; status: string }[]
  recentActivities: { id: string; at: string; by: string; summary: string }[]
  moduleLocks: ModulePeriodLock[]
}

export interface YearEndPreview {
  fiscalYear: string
  revenueToClose: number
  expenseToClose: number
  profitOrLoss: number
  retainedEarningsAccount: string
  exceptions: string[]
  unresolvedDifferences: number
}

export interface CloseReportDef {
  id: string
  name: string
  category: string
  description: string
}

export interface PeriodCloseSetup {
  fiscalYears: { code: string; label: string; start: string; end: string }[]
  periods: { code: string; label: string; fiscalYear: string; start: string; end: string; id?: string }[]
  taskTemplates: { id: string; task: string; module: CloseTaskModule; defaultOwnerRole: string }[]
  lockPolicies: { module: string; softLockDaysBefore: number; hardLockOnClose: boolean }[]
  fxRates: { currency: string; closingRate: number; asOf: string }[]
  companies: { id: string; name: string }[]
}

export const CLOSE_WORKFLOW_STAGES: { id: CloseWorkflowStage; label: string }[] = [
  { id: 'open', label: 'Open' },
  { id: 'close_preparation', label: 'Close Preparation' },
  { id: 'subledger_review', label: 'Subledger Review' },
  { id: 'adjustment_posting', label: 'Adjustment Posting' },
  { id: 'finance_review', label: 'Finance Review' },
  { id: 'period_locked', label: 'Period Locked' },
]

export const CLOSE_TASK_STATUS_LABELS: Record<CloseTaskStatus, string> = {
  not_started: 'Not Started',
  in_progress: 'In Progress',
  waiting: 'Waiting',
  blocked: 'Blocked',
  ready_for_review: 'Ready for Review',
  completed: 'Completed',
  reopened: 'Reopened',
  not_applicable: 'Not Applicable',
}

export const CLOSE_TASK_MODULE_LABELS: Record<CloseTaskModule, string> = {
  sales_ar: 'Sales and Receivables',
  purchase_ap: 'Purchase and Payables',
  inventory: 'Inventory',
  manufacturing: 'Manufacturing',
  fixed_assets: 'Fixed Assets',
  bank_cash: 'Bank and Cash',
  gst_tds: 'GST and TDS',
  general_ledger: 'General Ledger',
}

export const YEAR_END_STEPS: { id: YearEndWizardStep; label: string; step: number }[] = [
  { id: 'select_fy', label: 'Select Financial Year', step: 1 },
  { id: 'validate_open_periods', label: 'Validate Open Periods', step: 2 },
  { id: 'validate_reconciliations', label: 'Validate Subledger Reconciliations', step: 3 },
  { id: 'review_trial_balance', label: 'Review Trial Balance', step: 4 },
  { id: 'review_pnl', label: 'Review Profit & Loss', step: 5 },
  { id: 'review_tax', label: 'Review Tax and Compliance', step: 6 },
  { id: 'review_fixed_assets', label: 'Review Fixed Assets', step: 7 },
  { id: 'review_inventory_wip', label: 'Review Inventory and WIP', step: 8 },
  { id: 'preview_closing_entries', label: 'Preview Closing Entries', step: 9 },
  { id: 'transfer_pnl', label: 'Transfer Profit or Loss', step: 10 },
  { id: 'create_opening_balances', label: 'Create Opening Balances', step: 11 },
  { id: 'final_approval', label: 'Final Approval', step: 12 },
  { id: 'lock_financial_year', label: 'Lock Financial Year', step: 13 },
]

import type { ReactNode } from 'react'
import type { RouteObject } from 'react-router-dom'
import { Navigate, useParams } from 'react-router-dom'
import { isApiMode } from '@/config/apiConfig'
import { demoOnlyRoute } from '@/components/system/DemoOnlyRouteGate'

/**
 * Phase 8C Wave 1 (8B-R-010): legacy demo AR/AP workspaces must never render
 * seed balances in API mode — deep links land on live Money In / Money Out.
 * Demo mode (VITE_USE_API=false) keeps the legacy pages.
 */
const legacyArRoute = (element: ReactNode): ReactNode =>
  isApiMode() ? <Navigate to="/accounting/money-in" replace /> : element
const legacyApRoute = (element: ReactNode): ReactNode =>
  isApiMode() ? <Navigate to="/accounting/money-out" replace /> : element

/** Gate copy for seed-backed bank/cash sub-registers (live treasury: liquidity, statements, reconciliation). */
const BANK_CASH_DEMO_GATE = {
  title: 'Bank & Cash register',
  description:
    'This bank/cash sub-register is a demo-only screen with seed balances. Live treasury runs from the Bank & Cash overview, statements, reconciliation, transfers and cheques.',
  links: [
    { label: 'Bank & Cash overview', to: '/accounting/bank-cash' },
    { label: 'Bank statements', to: '/accounting/bank-cash/statements' },
  ],
}

/** Gate copy for seed-backed financial report pages. */
const FINANCIAL_REPORTS_DEMO_GATE = {
  title: 'Financial Reports',
  description:
    'Financial statement reports (P&L, balance sheet, trial balance, MIS) are demo-only screens with seed figures. Live GL truth is available from Journals and Ledger Entries.',
  links: [
    { label: 'Open Journals', to: '/accounting/entries/journals' },
    { label: 'Open Ledger Entries', to: '/accounting/ledger-entries' },
  ],
}

/** Legacy deep-link from Accounting dashboard overdue table → Customer Receivable Card */
function LegacyReceivablesCustomerRedirect() {
  const { partyId } = useParams()
  if (isApiMode()) return <Navigate to="/accounting/money-in" replace />
  return <Navigate to={partyId ? `/accounting/receivables/customer/${partyId}` : '/accounting/receivables/outstanding'} replace />
}

/** Legacy demo vouchers → live journals (edit keeps id param). */
function LegacyVoucherEditRedirect() {
  const { voucherId } = useParams()
  return <Navigate to={voucherId ? `/accounting/entries/journals/${voucherId}/edit` : '/accounting/entries/journals'} replace />
}

/** Legacy demo voucher detail → GL voucher ledger (Money In/Out accountingVoucherId is a GL voucher UUID). */
function LegacyVoucherDetailRedirect() {
  const { voucherId } = useParams()
  return (
    <Navigate
      to={voucherId ? `/accounting/ledger-entries/voucher/${voucherId}` : '/accounting/entries/journals'}
      replace
    />
  )
}
import { CommercialCommitmentsPage } from '@/modules/accounting/CommercialCommitmentsPage'
import { AccountingDashboardPage } from '@/modules/accounting/AccountingDashboardPage'
import { LedgerEntriesPage } from '@/modules/accounting/LedgerEntriesPage'
import { AccountLedgerPage } from '@/modules/accounting/AccountLedgerPage'
import { VoucherLedgerPage } from '@/modules/accounting/VoucherLedgerPage'
import { PartyLedgerPage } from '@/modules/accounting/PartyLedgerPage'
import { LedgerEntryDetailPage } from '@/modules/accounting/LedgerEntryDetailPage'
import { ReceivablesDashboardPage } from '@/modules/accounting/ReceivablesDashboardPage'
import { CustomerOutstandingPage } from '@/modules/accounting/CustomerOutstandingPage'
import { ReceivableInvoicesPage } from '@/modules/accounting/ReceivableInvoicesPage'
import { ReceivablesAgeingPage } from '@/modules/accounting/ReceivablesAgeingPage'
import { CollectionWorklistPage } from '@/modules/accounting/CollectionWorklistPage'
import { CustomerReceiptsPage } from '@/modules/accounting/CustomerReceiptsPage'
import {
  CustomerReceiptNewPage,
  CustomerReceiptEditPage,
} from '@/modules/accounting/CustomerReceiptEditorPage'
import { CustomerReceiptDetailPage } from '@/modules/accounting/CustomerReceiptDetailPage'
import { CustomerReceivableCardPage } from '@/modules/accounting/CustomerReceivableCardPage'
import { InvoiceReceivableDetailsPage } from '@/modules/accounting/InvoiceReceivableDetailsPage'
import { CreditNotesPage } from '@/modules/accounting/CreditNotesPage'
import { DisputesPage } from '@/modules/accounting/DisputesPage'
import { ReminderCentrePage } from '@/modules/accounting/ReminderCentrePage'
import { AllocationsPage } from '@/modules/accounting/AllocationsPage'
import {
  TaxComplianceOverviewPage,
  GstDashboardPage,
  OutwardSuppliesPage,
  InwardSuppliesPage,
  Gstr2bImportPage,
  ItcReconciliationPage,
  Gstr1Page,
  Gstr3bPage,
  ReverseChargePage,
  EInvoicesPage,
  EWayBillsPage,
  GstExceptionsPage,
  NoticesPage,
  TdsDashboardPage,
  TdsTransactionsPage,
  TdsDeductionWorkbenchPage,
  TdsChallansPage,
  TdsReturnsPage,
  TdsCertificatesPage,
  TdsReconciliationPage,
  TcsRegisterPage,
  ComplianceCalendarPage,
  TaxReportsPage,
  TaxSetupPage,
} from '@/modules/accounting/tax-compliance'
import {
  BudgetingOverviewPage,
  BudgetVersionsPage,
  AnnualBudgetPage,
  DepartmentBudgetsPage,
  CostCentreBudgetsPage,
  SalesBudgetPage,
  PurchaseBudgetPage,
  ProductionBudgetPage,
  ExpenseBudgetPage,
  CapexBudgetPage,
  CapexRequestDetailPage,
  CashFlowForecastPage,
  BudgetVsActualPage as BudgetingVsActualPage,
  RollingForecastPage,
  BudgetApprovalsPage,
  BudgetReportsPage,
  BudgetingSetupPage,
} from '@/modules/accounting/budgeting'
import {
  CloseDashboardPage,
  CloseCalendarPage,
  CloseChecklistPage,
  SubledgerReconciliationPage,
  InventoryClosePage,
  ManufacturingClosePage,
  FixedAssetClosePage,
  BankReconciliationStatusPage,
  GstTdsReviewPage,
  AccrualsPage,
  PrepaidExpensesPage,
  FxRevaluationPage,
  TrialBalanceReviewPage,
  PeriodLockingPage,
  ReopenRequestsPage,
  YearEndClosingPage,
  CloseReportsPage,
  CloseSetupPage,
} from '@/modules/accounting/period-close'
import { PayablesDashboardPage } from '@/modules/accounting/PayablesDashboardPage'
import { VendorOutstandingPage } from '@/modules/accounting/VendorOutstandingPage'
import { PayableInvoicesPage } from '@/modules/accounting/PayableInvoicesPage'
import { PayableInvoiceDetailPage } from '@/modules/accounting/PayableInvoiceDetailPage'
import { PayablesAgeingPage } from '@/modules/accounting/PayablesAgeingPage'
import { PaymentPlanningPage } from '@/modules/accounting/PaymentPlanningPage'
import { PaymentProposalsPage } from '@/modules/accounting/PaymentProposalsPage'
import { PaymentProposalDetailPage } from '@/modules/accounting/PaymentProposalDetailPage'
import { VendorPaymentsPage } from '@/modules/accounting/VendorPaymentsPage'
import { VendorPaymentNewPage, VendorPaymentEditPage } from '@/modules/accounting/VendorPaymentEditorPage'
import { VendorPaymentDetailPage } from '@/modules/accounting/VendorPaymentDetailPage'
import { PaymentAllocationsPage } from '@/modules/accounting/PaymentAllocationsPage'
import {
  VendorAdvancesPage,
  PayableDebitNotesPage,
  VendorDisputesPage,
  VendorPayablesCardPage,
  PayablesReportsPage,
  PayablesSetupPage,
} from '@/modules/accounting/payables'
import { BankCashTransactionsPage } from '@/modules/accounting/BankCashTransactionsPage'
import { BankAccountsPage } from '@/modules/accounting/BankAccountsPage'
import { BankAccountCardPage } from '@/modules/accounting/BankAccountCardPage'
import { CashAccountsPage } from '@/modules/accounting/CashAccountsPage'
import { CashAccountCardPage } from '@/modules/accounting/CashAccountCardPage'
import {
  TransferListPage,
  TransferCreatePage,
  TransferEditPage,
  TransferDetailPage,
  TransferInTransitPage,
  TransferApprovalsPage,
} from '@/modules/accounting/treasury/transfers'
import {
  BankStatementListPage,
  BankStatementImportPage,
  BankStatementDetailPage,
  BankStatementManualCreatePage,
  BankStatementEditPage,
  BankStatementImportBatchPage,
  BankStatementMappingTemplatesPage,
} from '@/modules/accounting/treasury/bank-statements'
import {
  ReconciliationListPage,
  ReconciliationWorkspacePage,
  ReconciliationMatchDetailPage,
  ReconciliationHistoryPage,
  ReconciliationExceptionsPage,
} from '@/modules/accounting/treasury/bank-reconciliation'
import { ChequeListPage, ChequeCreatePage, ChequeDetailPage } from '@/modules/accounting/treasury/cheques'
import { LiquidityDashboardPage } from '@/modules/accounting/treasury/liquidity'
import {
  AdjustmentListPage,
  AdjustmentCreatePage,
  AdjustmentDetailPage,
  BankPostingRuleListPage,
} from '@/modules/accounting/treasury/adjustments'
import {
  SIListPage,
  SICreatePage,
  SIDetailPage,
} from '@/modules/accounting/treasury/standing-instructions'
import { BankbookPage, CashbookPage } from '@/modules/accounting/treasury/books'
import { ConnectorListPage } from '@/modules/accounting/treasury/connectors'
import { BankDepositsPage } from '@/modules/accounting/BankDepositsPage'
import { CashBookPage } from '@/modules/accounting/CashBookPage'
import { CashCountsPage } from '@/modules/accounting/CashCountsPage'
import { CashCountEditorPage } from '@/modules/accounting/CashCountEditorPage'
import { BankCashReportsPage } from '@/modules/accounting/BankCashReportsPage'
import { BankCashSetupPage } from '@/modules/accounting/BankCashSetupPage'
import { FixedAssetsOverviewPage } from '@/modules/accounting/FixedAssetsOverviewPage'
import { FixedAssetsRegisterPage } from '@/modules/accounting/FixedAssetsRegisterPage'
import { FixedAssetCardPage } from '@/modules/accounting/FixedAssetCardPage'
import { AssetCategoriesPage } from '@/modules/accounting/AssetCategoriesPage'
import { AssetAcquisitionPage } from '@/modules/accounting/AssetAcquisitionPage'
import { AssetCapitalizationPage } from '@/modules/accounting/AssetCapitalizationPage'
import { DepreciationWorkbenchPage } from '@/modules/accounting/DepreciationWorkbenchPage'
import { AssetTransfersPage } from '@/modules/accounting/AssetTransfersPage'
import { AssetMaintenancePage } from '@/modules/accounting/AssetMaintenancePage'
import { AssetRevaluationPage } from '@/modules/accounting/AssetRevaluationPage'
import { AssetImpairmentPage } from '@/modules/accounting/AssetImpairmentPage'
import { AssetDisposalPage } from '@/modules/accounting/AssetDisposalPage'
import { PhysicalVerificationPage } from '@/modules/accounting/PhysicalVerificationPage'
import { PhysicalVerificationDetailPage } from '@/modules/accounting/PhysicalVerificationDetailPage'
import { AssetLedgerPage } from '@/modules/accounting/AssetLedgerPage'
import { FixedAssetsReportsPage } from '@/modules/accounting/FixedAssetsReportsPage'
import { FixedAssetsSetupPage } from '@/modules/accounting/FixedAssetsSetupPage'
import {
  FinancialReportsDashboardPage,
  TrialBalancePage,
  ProfitLossPage,
  BalanceSheetPage,
  CashFlowPage,
  GeneralLedgerReportPage,
  AccountSchedulesPage,
  CostCentreProfitabilityPage,
  DepartmentPerformancePage,
  ProjectProfitabilityPage,
  ManufacturingCostSummaryPage,
  BudgetVsActualPage,
  ComparativeStatementsPage,
  RatioAnalysisPage,
  FinancialMisPage,
  FinancialReportSetupPage,
} from '@/modules/accounting/financialReports'
import { ManufacturingAccountingOverviewPage } from '@/modules/accounting/ManufacturingAccountingOverviewPage'
import { ManufacturingMaterialConsumptionPage } from '@/modules/accounting/ManufacturingMaterialConsumptionPage'
import { ManufacturingWipRegisterPage } from '@/modules/accounting/ManufacturingWipRegisterPage'
import { ManufacturingFinishedGoodsPage } from '@/modules/accounting/ManufacturingFinishedGoodsPage'
import { ManufacturingProductionCostingPage } from '@/modules/accounting/ManufacturingProductionCostingPage'
import { ManufacturingVariancesPage } from '@/modules/accounting/ManufacturingVariancesPage'
import { ManufacturingSubcontractingPage } from '@/modules/accounting/ManufacturingSubcontractingPage'
import { ManufacturingScrapReworkPage } from '@/modules/accounting/ManufacturingScrapReworkPage'
import { ManufacturingOverheadPage } from '@/modules/accounting/ManufacturingOverheadPage'
import { ManufacturingCostCentresPage } from '@/modules/accounting/ManufacturingCostCentresPage'
import { ManufacturingProductCostSheetPage } from '@/modules/accounting/ManufacturingProductCostSheetPage'
import { ManufacturingProductionLedgerPage } from '@/modules/accounting/ManufacturingProductionLedgerPage'
import { ManufacturingCostingReportsPage } from '@/modules/accounting/ManufacturingCostingReportsPage'
import { ManufacturingCostingSetupPage } from '@/modules/accounting/ManufacturingCostingSetupPage'
import { ManufacturingAccountingApiGate } from '@/components/accounting/manufacturingAccounting/ManufacturingAccountingApiGate'
import {
  ApprovalRulesPage,
  BranchesPage,
  ChartOfAccountsSetupPage,
  CostCentresPage,
  DefaultMappingsPage,
  FeaturesPage,
  FinanceSettingsOverviewPage,
  FinanceSetupWizardPage,
  FinancialYearsPage,
  LegalEntitiesPage,
  NumberSeriesPage,
  PeriodsPage,
} from '@/modules/accounting/settings'
import {
  ApprovalDetailPage,
  ApprovalInboxPage,
  JournalDetailPage,
  JournalEditPage,
  JournalListPage,
  JournalNewPage,
} from '@/modules/accounting/journals'
import {
  AgeingPage as MoneyInAgeingPage,
  CreditNoteAllocatePage as MoneyInCreditNoteAllocatePage,
  CreditNoteDetailPage as MoneyInCreditNoteDetailPage,
  CreditNoteEditPage as MoneyInCreditNoteEditPage,
  CreditNoteListPage as MoneyInCreditNoteListPage,
  CreditNoteNewPage as MoneyInCreditNoteNewPage,
  CustomerDetailPage as MoneyInCustomerDetailPage,
  CustomerListPage as MoneyInCustomerListPage,
  InvoiceDetailPage as MoneyInInvoiceDetailPage,
  InvoiceEditPage as MoneyInInvoiceEditPage,
  InvoiceListPage as MoneyInInvoiceListPage,
  InvoiceNewPage as MoneyInInvoiceNewPage,
  MoneyInOverviewPage,
  OutstandingPage as MoneyInOutstandingPage,
  ReceiptAllocatePage as MoneyInReceiptAllocatePage,
  ReceiptDetailPage as MoneyInReceiptDetailPage,
  ReceiptEditPage as MoneyInReceiptEditPage,
  ReceiptListPage as MoneyInReceiptListPage,
  ReceiptNewPage as MoneyInReceiptNewPage,
  ReconciliationPage as MoneyInReconciliationPage,
} from '@/modules/accounting/money-in'
import {
  MoneyOutOverviewPage,
  PayableAllocationDetailPage as MoneyOutAllocationDetailPage,
  PayablesPage as MoneyOutPayablesPage,
  VendorAdvanceListPage as MoneyOutVendorAdvanceListPage,
  VendorInvoiceApprovalDetailPage as MoneyOutApprovalDetailPage,
  VendorInvoiceApprovalListPage as MoneyOutApprovalListPage,
  VendorInvoiceDetailPage as MoneyOutVendorInvoiceDetailPage,
  VendorInvoiceEditPage as MoneyOutVendorInvoiceEditPage,
  VendorInvoiceListPage as MoneyOutVendorInvoiceListPage,
  VendorInvoiceNewPage as MoneyOutVendorInvoiceNewPage,
  VendorPaymentAllocatePage as MoneyOutVendorPaymentAllocatePage,
  VendorPaymentDetailPage as MoneyOutVendorPaymentDetailPage,
  VendorPaymentEditPage as MoneyOutVendorPaymentEditPage,
  VendorPaymentListPage as MoneyOutVendorPaymentListPage,
  VendorPaymentNewPage as MoneyOutVendorPaymentNewPage,
  VendorAdjustmentAllocatePage as MoneyOutVendorAdjustmentAllocatePage,
  VendorAdjustmentDetailPage as MoneyOutVendorAdjustmentDetailPage,
  VendorAdjustmentEditPage as MoneyOutVendorAdjustmentEditPage,
  VendorAdjustmentListPage as MoneyOutVendorAdjustmentListPage,
  VendorAdjustmentNewPage as MoneyOutVendorAdjustmentNewPage,
  CorrectionsWorkspacePage as MoneyOutCorrectionsWorkspacePage,
  ReversalHistoryPage as MoneyOutReversalHistoryPage,
  ReversalPreviewPage as MoneyOutReversalPreviewPage,
  PayableOutstandingPage as MoneyOutOutstandingPage,
  PayableAgeingPage as MoneyOutAgeingPage,
  PayableVendorListPage as MoneyOutVendorListPage,
  PayableVendorDetailPage as MoneyOutVendorDetailPage,
  PaymentPlanningPage as MoneyOutPaymentPlanningPage,
  PayableReconciliationPage as MoneyOutPayableReconciliationPage,
  PayableReconciliationRunListPage as MoneyOutPayableReconciliationRunListPage,
  PayableReconciliationRunDetailPage as MoneyOutPayableReconciliationRunDetailPage,
  PayableReconciliationExceptionsPage as MoneyOutPayableReconciliationExceptionsPage,
  PayableReconciliationExceptionDetailPage as MoneyOutPayableReconciliationExceptionDetailPage,
  PayableCloseGatePage as MoneyOutPayableCloseGatePage,
  PayableCloseGateRunDetailPage as MoneyOutPayableCloseGateRunDetailPage,
} from '@/modules/accounting/money-out'

/**
 * Accounting module routes — mix of dual-mode live workspaces and demo/UI-only screens.
 * Legacy CoA (`/accounting/chart-of-accounts*`) and vouchers (`/accounting/vouchers*`) redirect to
 * settings CoA / journals / GL voucher ledger; page components retained but unmounted.
 */
export const accountingRouteChildren: RouteObject[] = [
  { path: 'accounting', element: <AccountingDashboardPage /> },
  { path: 'accounting/dashboard', element: <Navigate to="/accounting" replace /> },

  /** Legacy CoA / vouchers → live settings CoA + journals / GL voucher ledger (page files retained, unmounted). */
  { path: 'accounting/coa', element: <Navigate to="/accounting/settings/chart-of-accounts" replace /> },
  { path: 'accounting/chart-of-accounts', element: <Navigate to="/accounting/settings/chart-of-accounts" replace /> },
  { path: 'accounting/chart-of-accounts/:accountId', element: <Navigate to="/accounting/settings/chart-of-accounts" replace /> },
  { path: 'accounting/vouchers', element: <Navigate to="/accounting/entries/journals" replace /> },
  { path: 'accounting/vouchers/new', element: <Navigate to="/accounting/entries/journals/new" replace /> },
  { path: 'accounting/vouchers/:voucherId/edit', element: <LegacyVoucherEditRedirect /> },
  { path: 'accounting/vouchers/:voucherId', element: <LegacyVoucherDetailRedirect /> },

  /** Manual journals — Phase 2C1 API + demo dual-mode */
  { path: 'accounting/entries', element: <Navigate to="/accounting/entries/journals" replace /> },
  { path: 'accounting/entries/journals', element: <JournalListPage /> },
  { path: 'accounting/entries/journals/new', element: <JournalNewPage /> },
  { path: 'accounting/entries/journals/:id', element: <JournalDetailPage /> },
  { path: 'accounting/entries/journals/:id/edit', element: <JournalEditPage /> },
  { path: 'accounting/entries/approvals', element: <ApprovalInboxPage /> },
  { path: 'accounting/entries/approvals/:id', element: <ApprovalDetailPage /> },
  /** Money In — Phase 3A6 AR frontend (API + demo dual-mode) */
  { path: 'accounting/money-in', element: <MoneyInOverviewPage /> },
  { path: 'accounting/money-in/invoices', element: <MoneyInInvoiceListPage /> },
  { path: 'accounting/money-in/invoices/new', element: <MoneyInInvoiceNewPage /> },
  { path: 'accounting/money-in/invoices/:id', element: <MoneyInInvoiceDetailPage /> },
  { path: 'accounting/money-in/invoices/:id/edit', element: <MoneyInInvoiceEditPage /> },
  /** Customer receipts — Phase 3B6 AR frontend (API + demo dual-mode) */
  { path: 'accounting/money-in/receipts', element: <MoneyInReceiptListPage /> },
  { path: 'accounting/money-in/receipts/new', element: <MoneyInReceiptNewPage /> },
  { path: 'accounting/money-in/receipts/:id', element: <MoneyInReceiptDetailPage /> },
  { path: 'accounting/money-in/receipts/:id/edit', element: <MoneyInReceiptEditPage /> },
  { path: 'accounting/money-in/receipts/:id/allocate', element: <MoneyInReceiptAllocatePage /> },
  /** Credit notes — Phase 3C6 AR frontend (API + demo dual-mode) */
  { path: 'accounting/money-in/credit-notes', element: <MoneyInCreditNoteListPage /> },
  { path: 'accounting/money-in/credit-notes/new', element: <MoneyInCreditNoteNewPage /> },
  { path: 'accounting/money-in/credit-notes/:id', element: <MoneyInCreditNoteDetailPage /> },
  { path: 'accounting/money-in/credit-notes/:id/edit', element: <MoneyInCreditNoteEditPage /> },
  { path: 'accounting/money-in/credit-notes/:id/allocate', element: <MoneyInCreditNoteAllocatePage /> },
  { path: 'accounting/money-in/outstanding', element: <MoneyInOutstandingPage /> },
  { path: 'accounting/money-in/customers', element: <MoneyInCustomerListPage /> },
  { path: 'accounting/money-in/customers/:customerId', element: <MoneyInCustomerDetailPage /> },
  { path: 'accounting/money-in/ageing', element: <MoneyInAgeingPage /> },
  { path: 'accounting/money-in/reconciliation', element: <MoneyInReconciliationPage /> },

  /** Money Out — Phase 4A5 AP vendor-invoice frontend (API mode) */
  { path: 'accounting/money-out', element: <MoneyOutOverviewPage /> },
  { path: 'accounting/money-out/vendor-invoices', element: <MoneyOutVendorInvoiceListPage /> },
  { path: 'accounting/money-out/vendor-invoices/new', element: <MoneyOutVendorInvoiceNewPage /> },
  { path: 'accounting/money-out/vendor-invoices/:id', element: <MoneyOutVendorInvoiceDetailPage /> },
  { path: 'accounting/money-out/vendor-invoices/:id/edit', element: <MoneyOutVendorInvoiceEditPage /> },
  /** Vendor payments / advances / allocations / payables — Phase 4B5 AP frontend (API mode) */
  { path: 'accounting/money-out/vendor-payments', element: <MoneyOutVendorPaymentListPage /> },
  { path: 'accounting/money-out/vendor-payments/new', element: <MoneyOutVendorPaymentNewPage /> },
  { path: 'accounting/money-out/vendor-payments/:id', element: <MoneyOutVendorPaymentDetailPage /> },
  { path: 'accounting/money-out/vendor-payments/:id/edit', element: <MoneyOutVendorPaymentEditPage /> },
  { path: 'accounting/money-out/vendor-payments/:id/allocate', element: <MoneyOutVendorPaymentAllocatePage /> },
  { path: 'accounting/money-out/vendor-advances', element: <MoneyOutVendorAdvanceListPage /> },
  { path: 'accounting/money-out/payables', element: <MoneyOutPayablesPage /> },
  { path: 'accounting/money-out/outstanding', element: <MoneyOutOutstandingPage /> },
  { path: 'accounting/money-out/vendors', element: <MoneyOutVendorListPage /> },
  { path: 'accounting/money-out/vendors/:vendorId', element: <MoneyOutVendorDetailPage /> },
  { path: 'accounting/money-out/ageing', element: <MoneyOutAgeingPage /> },
  { path: 'accounting/money-out/payment-planning', element: <MoneyOutPaymentPlanningPage /> },
  { path: 'accounting/money-out/allocations/:allocationId', element: <MoneyOutAllocationDetailPage /> },
  { path: 'accounting/money-out/approvals', element: <MoneyOutApprovalListPage /> },
  { path: 'accounting/money-out/approvals/:id', element: <MoneyOutApprovalDetailPage /> },
  /** Vendor adjustments + corrections — Phase 4C2 AP frontend (API mode) */
  { path: 'accounting/money-out/vendor-adjustments', element: <MoneyOutVendorAdjustmentListPage /> },
  { path: 'accounting/money-out/vendor-adjustments/new', element: <MoneyOutVendorAdjustmentNewPage /> },
  { path: 'accounting/money-out/vendor-adjustments/:id', element: <MoneyOutVendorAdjustmentDetailPage /> },
  { path: 'accounting/money-out/vendor-adjustments/:id/edit', element: <MoneyOutVendorAdjustmentEditPage /> },
  { path: 'accounting/money-out/vendor-adjustments/:id/allocate', element: <MoneyOutVendorAdjustmentAllocatePage /> },
  { path: 'accounting/money-out/corrections', element: <MoneyOutCorrectionsWorkspacePage /> },
  { path: 'accounting/money-out/reversals', element: <MoneyOutReversalHistoryPage /> },
  { path: 'accounting/money-out/reversals/:type/:id', element: <MoneyOutReversalPreviewPage /> },
  /** AP reconciliation + close gate — Phase 4D2 (API mode) */
  { path: 'accounting/money-out/reconciliation', element: <MoneyOutPayableReconciliationPage /> },
  { path: 'accounting/money-out/reconciliation/runs', element: <MoneyOutPayableReconciliationRunListPage /> },
  { path: 'accounting/money-out/reconciliation/runs/:id', element: <MoneyOutPayableReconciliationRunDetailPage /> },
  { path: 'accounting/money-out/reconciliation/exceptions', element: <MoneyOutPayableReconciliationExceptionsPage /> },
  { path: 'accounting/money-out/reconciliation/exceptions/:id', element: <MoneyOutPayableReconciliationExceptionDetailPage /> },
  { path: 'accounting/money-out/close-gate', element: <MoneyOutPayableCloseGatePage /> },
  { path: 'accounting/money-out/close-gate/runs/:id', element: <MoneyOutPayableCloseGateRunDetailPage /> },

  /** Legacy demo AR — API mode redirects every deep link to live Money In (8B-R-010). */
  { path: 'accounting/receivables', element: legacyArRoute(<ReceivablesDashboardPage />) },
  { path: 'accounting/commercial-commitments', element: <CommercialCommitmentsPage /> },
  { path: 'accounting/receivables/customers', element: legacyArRoute(<CustomerOutstandingPage />) },
  { path: 'accounting/receivables/outstanding', element: legacyArRoute(<CustomerOutstandingPage />) },
  { path: 'accounting/receivables/invoices', element: legacyArRoute(<ReceivableInvoicesPage />) },
  { path: 'accounting/receivables/ageing', element: legacyArRoute(<ReceivablesAgeingPage />) },
  { path: 'accounting/receivables/collections', element: legacyArRoute(<CollectionWorklistPage />) },
  { path: 'accounting/receivables/receipts', element: legacyArRoute(<CustomerReceiptsPage />) },
  { path: 'accounting/receivables/receipts/new', element: legacyArRoute(<CustomerReceiptNewPage />) },
  { path: 'accounting/receivables/receipts/:receiptId/edit', element: legacyArRoute(<CustomerReceiptEditPage />) },
  { path: 'accounting/receivables/receipts/:receiptId', element: legacyArRoute(<CustomerReceiptDetailPage />) },
  { path: 'accounting/receivables/allocations', element: legacyArRoute(<AllocationsPage />) },
  { path: 'accounting/receivables/credit-notes', element: legacyArRoute(<CreditNotesPage />) },
  { path: 'accounting/receivables/disputes', element: legacyArRoute(<DisputesPage />) },
  { path: 'accounting/receivables/reminders', element: legacyArRoute(<ReminderCentrePage />) },
  { path: 'accounting/receivables/customer/:customerId', element: legacyArRoute(<CustomerReceivableCardPage />) },
  { path: 'accounting/receivables/invoice/:invoiceId', element: legacyArRoute(<InvoiceReceivableDetailsPage />) },
  {
    path: 'accounting/receivables/customers/:partyId',
    element: <LegacyReceivablesCustomerRedirect />,
  },
  /** Legacy demo AP — API mode redirects every deep link to live Money Out (8B-R-010). */
  { path: 'accounting/payables', element: legacyApRoute(<PayablesDashboardPage />) },
  { path: 'accounting/payables/outstanding', element: legacyApRoute(<VendorOutstandingPage />) },
  { path: 'accounting/payables/invoices', element: legacyApRoute(<PayableInvoicesPage />) },
  { path: 'accounting/payables/invoice/:invoiceId', element: legacyApRoute(<PayableInvoiceDetailPage />) },
  { path: 'accounting/payables/ageing', element: legacyApRoute(<PayablesAgeingPage />) },
  { path: 'accounting/payables/payment-planning', element: legacyApRoute(<PaymentPlanningPage />) },
  { path: 'accounting/payables/payment-proposals', element: legacyApRoute(<PaymentProposalsPage />) },
  { path: 'accounting/payables/payment-proposals/:proposalId', element: legacyApRoute(<PaymentProposalDetailPage />) },
  { path: 'accounting/payables/payments', element: legacyApRoute(<VendorPaymentsPage />) },
  { path: 'accounting/payables/payments/new', element: legacyApRoute(<VendorPaymentNewPage />) },
  { path: 'accounting/payables/payments/:paymentId/edit', element: legacyApRoute(<VendorPaymentEditPage />) },
  { path: 'accounting/payables/payments/:paymentId', element: legacyApRoute(<VendorPaymentDetailPage />) },
  { path: 'accounting/payables/allocations', element: legacyApRoute(<PaymentAllocationsPage />) },
  { path: 'accounting/payables/advances', element: legacyApRoute(<VendorAdvancesPage />) },
  { path: 'accounting/payables/debit-notes', element: legacyApRoute(<PayableDebitNotesPage />) },
  { path: 'accounting/payables/disputes', element: legacyApRoute(<VendorDisputesPage />) },
  { path: 'accounting/payables/vendor/:vendorId', element: legacyApRoute(<VendorPayablesCardPage />) },
  { path: 'accounting/payables/reports', element: legacyApRoute(<PayablesReportsPage />) },
  { path: 'accounting/payables/setup', element: legacyApRoute(<PayablesSetupPage />) },

  /** Bank & Cash — full demo frontend module */
  { path: 'accounting/bank', element: <Navigate to="/accounting/bank-cash" replace /> },
  { path: 'accounting/bank/:bankAccountId/reconcile', element: <Navigate to="/accounting/bank-cash/reconciliation" replace /> },
  { path: 'accounting/bank-cash', element: <LiquidityDashboardPage /> },
  { path: 'accounting/bank-cash/liquidity', element: <LiquidityDashboardPage /> },
  /** Seed-backed bank/cash account registers — demo-only; live treasury runs via liquidity/statements/recon (8B-R-010). */
  { path: 'accounting/bank-cash/bank-accounts', element: demoOnlyRoute(<BankAccountsPage />, BANK_CASH_DEMO_GATE) },
  { path: 'accounting/bank-cash/bank-accounts/:id', element: demoOnlyRoute(<BankAccountCardPage />, BANK_CASH_DEMO_GATE) },
  { path: 'accounting/bank-cash/cash-accounts', element: demoOnlyRoute(<CashAccountsPage />, BANK_CASH_DEMO_GATE) },
  { path: 'accounting/bank-cash/cash-accounts/:id', element: demoOnlyRoute(<CashAccountCardPage />, BANK_CASH_DEMO_GATE) },
  { path: 'accounting/bank-cash/transactions', element: demoOnlyRoute(<BankCashTransactionsPage />, BANK_CASH_DEMO_GATE) },
  { path: 'accounting/bank-cash/transfers', element: <TransferListPage /> },
  { path: 'accounting/bank-cash/transfers/new', element: <TransferCreatePage /> },
  { path: 'accounting/bank-cash/transfers/in-transit', element: <TransferInTransitPage /> },
  { path: 'accounting/bank-cash/transfers/approvals', element: <TransferApprovalsPage /> },
  { path: 'accounting/bank-cash/transfers/:id/edit', element: <TransferEditPage /> },
  { path: 'accounting/bank-cash/transfers/:id', element: <TransferDetailPage /> },
  { path: 'accounting/bank-cash/statements', element: <BankStatementListPage /> },
  { path: 'accounting/bank-cash/statements/import', element: <BankStatementImportPage /> },
  { path: 'accounting/bank-cash/statements/manual', element: <BankStatementManualCreatePage /> },
  { path: 'accounting/bank-cash/statements/:id/edit', element: <BankStatementEditPage /> },
  { path: 'accounting/bank-cash/statements/:id', element: <BankStatementDetailPage /> },
  { path: 'accounting/bank-cash/import-batches/:id', element: <BankStatementImportBatchPage /> },
  { path: 'accounting/bank-cash/mapping-templates', element: <BankStatementMappingTemplatesPage /> },
  { path: 'accounting/bank-cash/reconciliation', element: <ReconciliationListPage /> },
  { path: 'accounting/bank-cash/reconciliation/history', element: <ReconciliationHistoryPage /> },
  { path: 'accounting/bank-cash/reconciliation/exceptions', element: <ReconciliationExceptionsPage /> },
  { path: 'accounting/bank-cash/reconciliation/matches/:matchId', element: <ReconciliationMatchDetailPage /> },
  { path: 'accounting/bank-cash/reconciliation/:statementId', element: <ReconciliationWorkspacePage /> },
  { path: 'accounting/bank-cash/cheques', element: <ChequeListPage /> },
  { path: 'accounting/bank-cash/cheques/new', element: <ChequeCreatePage /> },
  { path: 'accounting/bank-cash/cheques/:id', element: <ChequeDetailPage /> },
  { path: 'accounting/bank-cash/treasury-adjustments', element: <AdjustmentListPage /> },
  { path: 'accounting/bank-cash/treasury-adjustments/new', element: <AdjustmentCreatePage /> },
  { path: 'accounting/bank-cash/treasury-adjustments/:id/edit', element: <AdjustmentDetailPage /> },
  { path: 'accounting/bank-cash/treasury-adjustments/:id', element: <AdjustmentDetailPage /> },
  { path: 'accounting/bank-cash/standing-instructions', element: <SIListPage /> },
  { path: 'accounting/bank-cash/standing-instructions/new', element: <SICreatePage /> },
  { path: 'accounting/bank-cash/standing-instructions/:id', element: <SIDetailPage /> },
  { path: 'accounting/bank-cash/posting-rules', element: <BankPostingRuleListPage /> },
  { path: 'accounting/bank-cash/connectors', element: <ConnectorListPage /> },
  { path: 'accounting/bank-cash/bankbook', element: <BankbookPage /> },
  { path: 'accounting/bank-cash/cashbook', element: <CashbookPage /> },
  { path: 'accounting/bank-cash/deposits', element: demoOnlyRoute(<BankDepositsPage />, BANK_CASH_DEMO_GATE) },
  { path: 'accounting/bank-cash/cash-book', element: demoOnlyRoute(<CashBookPage />, BANK_CASH_DEMO_GATE) },
  { path: 'accounting/bank-cash/cash-counts', element: demoOnlyRoute(<CashCountsPage />, BANK_CASH_DEMO_GATE) },
  { path: 'accounting/bank-cash/cash-counts/new', element: demoOnlyRoute(<CashCountEditorPage />, BANK_CASH_DEMO_GATE) },
  { path: 'accounting/bank-cash/reports', element: demoOnlyRoute(<BankCashReportsPage />, BANK_CASH_DEMO_GATE) },
  { path: 'accounting/bank-cash/setup', element: demoOnlyRoute(<BankCashSetupPage />, BANK_CASH_DEMO_GATE) },

  /** Fixed Assets — full demo frontend module */
  { path: 'accounting/fixed-assets', element: <FixedAssetsOverviewPage /> },
  { path: 'accounting/fixed-assets/register', element: <FixedAssetsRegisterPage /> },
  { path: 'accounting/fixed-assets/register/:id', element: <FixedAssetCardPage /> },
  { path: 'accounting/fixed-assets/categories', element: <AssetCategoriesPage /> },
  { path: 'accounting/fixed-assets/acquisition', element: <AssetAcquisitionPage /> },
  { path: 'accounting/fixed-assets/capitalization', element: <AssetCapitalizationPage /> },
  { path: 'accounting/fixed-assets/depreciation', element: <DepreciationWorkbenchPage /> },
  { path: 'accounting/fixed-assets/transfers', element: <AssetTransfersPage /> },
  { path: 'accounting/fixed-assets/maintenance', element: <AssetMaintenancePage /> },
  { path: 'accounting/fixed-assets/revaluation', element: <AssetRevaluationPage /> },
  { path: 'accounting/fixed-assets/impairment', element: <AssetImpairmentPage /> },
  { path: 'accounting/fixed-assets/disposal', element: <AssetDisposalPage /> },
  { path: 'accounting/fixed-assets/verification', element: <PhysicalVerificationPage /> },
  { path: 'accounting/fixed-assets/verification/:id', element: <PhysicalVerificationDetailPage /> },
  { path: 'accounting/fixed-assets/ledger', element: <AssetLedgerPage /> },
  { path: 'accounting/fixed-assets/reports', element: <FixedAssetsReportsPage /> },
  { path: 'accounting/fixed-assets/setup', element: <FixedAssetsSetupPage /> },

  /** Manufacturing Accounting & Costing — demo pages; API mode gated to live Phase 7E workspace */
  { path: 'accounting/manufacturing', element: <ManufacturingAccountingApiGate><ManufacturingAccountingOverviewPage /></ManufacturingAccountingApiGate> },
  { path: 'accounting/manufacturing/material-consumption', element: <ManufacturingAccountingApiGate><ManufacturingMaterialConsumptionPage /></ManufacturingAccountingApiGate> },
  { path: 'accounting/manufacturing/wip', element: <ManufacturingAccountingApiGate><ManufacturingWipRegisterPage /></ManufacturingAccountingApiGate> },
  { path: 'accounting/manufacturing/finished-goods', element: <ManufacturingAccountingApiGate><ManufacturingFinishedGoodsPage /></ManufacturingAccountingApiGate> },
  { path: 'accounting/manufacturing/production-costing', element: <ManufacturingAccountingApiGate><ManufacturingProductionCostingPage /></ManufacturingAccountingApiGate> },
  { path: 'accounting/manufacturing/variances', element: <ManufacturingAccountingApiGate><ManufacturingVariancesPage /></ManufacturingAccountingApiGate> },
  { path: 'accounting/manufacturing/subcontracting', element: <ManufacturingAccountingApiGate><ManufacturingSubcontractingPage /></ManufacturingAccountingApiGate> },
  { path: 'accounting/manufacturing/scrap-rework', element: <ManufacturingAccountingApiGate><ManufacturingScrapReworkPage /></ManufacturingAccountingApiGate> },
  { path: 'accounting/manufacturing/overhead', element: <ManufacturingAccountingApiGate><ManufacturingOverheadPage /></ManufacturingAccountingApiGate> },
  { path: 'accounting/manufacturing/cost-centres', element: <ManufacturingAccountingApiGate><ManufacturingCostCentresPage /></ManufacturingAccountingApiGate> },
  { path: 'accounting/manufacturing/cost-sheet', element: <ManufacturingAccountingApiGate><ManufacturingProductCostSheetPage /></ManufacturingAccountingApiGate> },
  { path: 'accounting/manufacturing/ledger', element: <ManufacturingAccountingApiGate><ManufacturingProductionLedgerPage /></ManufacturingAccountingApiGate> },
  { path: 'accounting/manufacturing/reports', element: <ManufacturingAccountingApiGate><ManufacturingCostingReportsPage /></ManufacturingAccountingApiGate> },
  { path: 'accounting/manufacturing/setup', element: <ManufacturingAccountingApiGate><ManufacturingCostingSetupPage /></ManufacturingAccountingApiGate> },

  /** Legacy path → GST & TDS compliance workspace */
  { path: 'accounting/gst-tds', element: <Navigate to="/accounting/tax-compliance" replace /> },
  { path: 'accounting/tax-compliance', element: <TaxComplianceOverviewPage /> },
  { path: 'accounting/tax-compliance/gst', element: <GstDashboardPage /> },
  { path: 'accounting/tax-compliance/gst/outward-supplies', element: <OutwardSuppliesPage /> },
  { path: 'accounting/tax-compliance/gst/inward-supplies', element: <InwardSuppliesPage /> },
  { path: 'accounting/tax-compliance/gst/gstr-2b', element: <Gstr2bImportPage /> },
  { path: 'accounting/tax-compliance/gst/itc-reconciliation', element: <ItcReconciliationPage /> },
  { path: 'accounting/tax-compliance/gst/gstr-1', element: <Gstr1Page /> },
  { path: 'accounting/tax-compliance/gst/gstr-3b', element: <Gstr3bPage /> },
  { path: 'accounting/tax-compliance/gst/reverse-charge', element: <ReverseChargePage /> },
  { path: 'accounting/tax-compliance/gst/e-invoices', element: <EInvoicesPage /> },
  { path: 'accounting/tax-compliance/gst/e-way-bills', element: <EWayBillsPage /> },
  { path: 'accounting/tax-compliance/gst/exceptions', element: <GstExceptionsPage /> },
  { path: 'accounting/tax-compliance/gst/notices', element: <Navigate to="/accounting/tax-compliance/notices" replace /> },
  { path: 'accounting/tax-compliance/tds', element: <TdsDashboardPage /> },
  { path: 'accounting/tax-compliance/tds/transactions', element: <TdsTransactionsPage /> },
  { path: 'accounting/tax-compliance/tds/deductions', element: <TdsDeductionWorkbenchPage /> },
  { path: 'accounting/tax-compliance/tds/challans', element: <TdsChallansPage /> },
  { path: 'accounting/tax-compliance/tds/returns', element: <TdsReturnsPage /> },
  { path: 'accounting/tax-compliance/tds/certificates', element: <TdsCertificatesPage /> },
  { path: 'accounting/tax-compliance/tds/reconciliation', element: <TdsReconciliationPage /> },
  { path: 'accounting/tax-compliance/tcs', element: <TcsRegisterPage /> },
  { path: 'accounting/tax-compliance/notices', element: <NoticesPage /> },
  { path: 'accounting/tax-compliance/calendar', element: <ComplianceCalendarPage /> },
  { path: 'accounting/tax-compliance/reports', element: <TaxReportsPage /> },
  { path: 'accounting/tax-compliance/setup', element: <TaxSetupPage /> },

  /** Budgeting & Forecasting workspace (demo FE) */
  { path: 'accounting/budgeting', element: <BudgetingOverviewPage /> },
  { path: 'accounting/budgeting/versions', element: <BudgetVersionsPage /> },
  { path: 'accounting/budgeting/annual', element: <AnnualBudgetPage /> },
  { path: 'accounting/budgeting/departments', element: <DepartmentBudgetsPage /> },
  { path: 'accounting/budgeting/cost-centres', element: <CostCentreBudgetsPage /> },
  { path: 'accounting/budgeting/sales', element: <SalesBudgetPage /> },
  { path: 'accounting/budgeting/purchase', element: <PurchaseBudgetPage /> },
  { path: 'accounting/budgeting/production', element: <ProductionBudgetPage /> },
  { path: 'accounting/budgeting/expense', element: <ExpenseBudgetPage /> },
  { path: 'accounting/budgeting/capex', element: <CapexBudgetPage /> },
  { path: 'accounting/budgeting/capex/:id', element: <CapexRequestDetailPage /> },
  { path: 'accounting/budgeting/cash-flow', element: <CashFlowForecastPage /> },
  { path: 'accounting/budgeting/vs-actual', element: <BudgetingVsActualPage /> },
  { path: 'accounting/budgeting/rolling-forecast', element: <RollingForecastPage /> },
  { path: 'accounting/budgeting/approvals', element: <BudgetApprovalsPage /> },
  { path: 'accounting/budgeting/reports', element: <BudgetReportsPage /> },
  { path: 'accounting/budgeting/setup', element: <BudgetingSetupPage /> },

  { path: 'accounting/ledger', element: <Navigate to="/accounting/ledger-entries" replace /> },
  { path: 'accounting/ledger-entries', element: <LedgerEntriesPage /> },
  { path: 'accounting/ledger-entries/account/:accountId', element: <AccountLedgerPage /> },
  { path: 'accounting/ledger-entries/voucher/:voucherId', element: <VoucherLedgerPage /> },
  { path: 'accounting/ledger-entries/party/:partyType/:partyId', element: <PartyLedgerPage /> },
  { path: 'accounting/ledger-entries/:entryId', element: <LedgerEntryDetailPage /> },
  /** Seed-backed financial reports — demo-only screens; hard-stop in API mode (8B-R-010). */
  { path: 'accounting/reports', element: demoOnlyRoute(<FinancialReportsDashboardPage />, FINANCIAL_REPORTS_DEMO_GATE) },
  { path: 'accounting/reports/trial-balance', element: demoOnlyRoute(<TrialBalancePage />, FINANCIAL_REPORTS_DEMO_GATE) },
  { path: 'accounting/reports/profit-loss', element: demoOnlyRoute(<ProfitLossPage />, FINANCIAL_REPORTS_DEMO_GATE) },
  { path: 'accounting/reports/balance-sheet', element: demoOnlyRoute(<BalanceSheetPage />, FINANCIAL_REPORTS_DEMO_GATE) },
  { path: 'accounting/reports/cash-flow', element: demoOnlyRoute(<CashFlowPage />, FINANCIAL_REPORTS_DEMO_GATE) },
  { path: 'accounting/reports/general-ledger', element: demoOnlyRoute(<GeneralLedgerReportPage />, FINANCIAL_REPORTS_DEMO_GATE) },
  { path: 'accounting/reports/account-schedules', element: demoOnlyRoute(<AccountSchedulesPage />, FINANCIAL_REPORTS_DEMO_GATE) },
  { path: 'accounting/reports/cost-centre', element: demoOnlyRoute(<CostCentreProfitabilityPage />, FINANCIAL_REPORTS_DEMO_GATE) },
  { path: 'accounting/reports/department', element: demoOnlyRoute(<DepartmentPerformancePage />, FINANCIAL_REPORTS_DEMO_GATE) },
  { path: 'accounting/reports/project', element: demoOnlyRoute(<ProjectProfitabilityPage />, FINANCIAL_REPORTS_DEMO_GATE) },
  { path: 'accounting/reports/manufacturing', element: demoOnlyRoute(<ManufacturingCostSummaryPage />, FINANCIAL_REPORTS_DEMO_GATE) },
  { path: 'accounting/reports/budget-vs-actual', element: demoOnlyRoute(<BudgetVsActualPage />, FINANCIAL_REPORTS_DEMO_GATE) },
  { path: 'accounting/reports/comparative', element: demoOnlyRoute(<ComparativeStatementsPage />, FINANCIAL_REPORTS_DEMO_GATE) },
  { path: 'accounting/reports/ratios', element: demoOnlyRoute(<RatioAnalysisPage />, FINANCIAL_REPORTS_DEMO_GATE) },
  { path: 'accounting/reports/mis', element: demoOnlyRoute(<FinancialMisPage />, FINANCIAL_REPORTS_DEMO_GATE) },
  { path: 'accounting/reports/setup', element: demoOnlyRoute(<FinancialReportSetupPage />, FINANCIAL_REPORTS_DEMO_GATE) },
  { path: 'accounting/period-close', element: <CloseDashboardPage /> },
  { path: 'accounting/period-close/calendar', element: <CloseCalendarPage /> },
  { path: 'accounting/period-close/checklist', element: <CloseChecklistPage /> },
  { path: 'accounting/period-close/subledger-reconciliation', element: <SubledgerReconciliationPage /> },
  { path: 'accounting/period-close/inventory', element: <InventoryClosePage /> },
  { path: 'accounting/period-close/manufacturing', element: <ManufacturingClosePage /> },
  { path: 'accounting/period-close/fixed-assets', element: <FixedAssetClosePage /> },
  { path: 'accounting/period-close/bank-reconciliation', element: <BankReconciliationStatusPage /> },
  { path: 'accounting/period-close/gst-tds-review', element: <GstTdsReviewPage /> },
  { path: 'accounting/period-close/accruals', element: <AccrualsPage /> },
  { path: 'accounting/period-close/prepaid', element: <PrepaidExpensesPage /> },
  { path: 'accounting/period-close/fx-revaluation', element: <FxRevaluationPage /> },
  { path: 'accounting/period-close/trial-balance', element: <TrialBalanceReviewPage /> },
  { path: 'accounting/period-close/period-locking', element: <PeriodLockingPage /> },
  { path: 'accounting/period-close/year-end', element: <YearEndClosingPage /> },
  { path: 'accounting/period-close/reopen-requests', element: <ReopenRequestsPage /> },
  { path: 'accounting/period-close/reports', element: <CloseReportsPage /> },
  { path: 'accounting/period-close/setup', element: <CloseSetupPage /> },

  { path: 'accounting/setup', element: <Navigate to="/accounting/settings" replace /> },

  /** Finance settings — Phase 1C setup workspace */
  { path: 'accounting/settings', element: <FinanceSettingsOverviewPage /> },
  { path: 'accounting/settings/setup', element: <FinanceSetupWizardPage /> },
  { path: 'accounting/settings/legal-entities', element: <LegalEntitiesPage /> },
  { path: 'accounting/settings/branches', element: <BranchesPage /> },
  { path: 'accounting/settings/financial-years', element: <FinancialYearsPage /> },
  { path: 'accounting/settings/periods', element: <PeriodsPage /> },
  { path: 'accounting/settings/chart-of-accounts', element: <ChartOfAccountsSetupPage /> },
  { path: 'accounting/settings/default-mappings', element: <DefaultMappingsPage /> },
  { path: 'accounting/settings/number-series', element: <NumberSeriesPage /> },
  { path: 'accounting/settings/cost-centres', element: <CostCentresPage /> },
  { path: 'accounting/settings/approval-rules', element: <ApprovalRulesPage /> },
  { path: 'accounting/settings/features', element: <FeaturesPage /> },
]

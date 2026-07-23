import type { RouteObject } from 'react-router-dom'
import { Navigate, useParams } from 'react-router-dom'
import { AccountingDashboardPage } from '@/modules/accounting/AccountingDashboardPage'
import { LedgerEntriesPage } from '@/modules/accounting/LedgerEntriesPage'
import { AccountLedgerPage } from '@/modules/accounting/AccountLedgerPage'
import { VoucherLedgerPage } from '@/modules/accounting/VoucherLedgerPage'
import { PartyLedgerPage } from '@/modules/accounting/PartyLedgerPage'
import { LedgerEntryDetailPage } from '@/modules/accounting/LedgerEntryDetailPage'
import {
  TaxComplianceOverviewPage,
  GstDashboardPage,
  OutwardSuppliesPage,
  InwardSuppliesPage,
  EInvoicesPage,
  EWayBillsPage,
} from '@/modules/accounting/tax-compliance'
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
  SalesInvoicePrintPage as MoneyInSalesInvoicePrintPage,
  CreditNotePrintPage as MoneyInCreditNotePrintPage,
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
  VendorAdjustmentPrintPage as MoneyOutVendorAdjustmentPrintPage,
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

/** Legacy demo vouchers → live journals (edit keeps id param). */
function LegacyVoucherEditRedirect() {
  const { voucherId } = useParams()
  return <Navigate to={voucherId ? `/accounting/entries/journals/${voucherId}/edit` : '/accounting/entries/journals'} replace />
}

/** Legacy demo voucher detail → GL voucher ledger. */
function LegacyVoucherDetailRedirect() {
  const { voucherId } = useParams()
  return (
    <Navigate
      to={voucherId ? `/accounting/ledger-entries/voucher/${voucherId}` : '/accounting/entries/journals'}
      replace
    />
  )
}

/**
 * Accounting module routes — live Phase workspaces only.
 * Seed/demo AR/AP, bank-cash registers, financial reports, budgeting, filing, and
 * manufacturing seed pages removed. Legacy deep links Navigate to Money In/Out / journals.
 */
export const accountingRouteChildren: RouteObject[] = [
  { path: 'accounting', element: <AccountingDashboardPage /> },
  { path: 'accounting/dashboard', element: <Navigate to="/accounting" replace /> },

  /** Legacy CoA / vouchers → live settings CoA + journals / GL voucher ledger. */
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
  { path: 'accounting/money-in/invoices/:id/print', element: <MoneyInSalesInvoicePrintPage /> },
  { path: 'accounting/money-in/invoices/:id', element: <MoneyInInvoiceDetailPage /> },
  { path: 'accounting/money-in/invoices/:id/edit', element: <MoneyInInvoiceEditPage /> },
  { path: 'accounting/money-in/receipts', element: <MoneyInReceiptListPage /> },
  { path: 'accounting/money-in/receipts/new', element: <MoneyInReceiptNewPage /> },
  { path: 'accounting/money-in/receipts/:id', element: <MoneyInReceiptDetailPage /> },
  { path: 'accounting/money-in/receipts/:id/edit', element: <MoneyInReceiptEditPage /> },
  { path: 'accounting/money-in/receipts/:id/allocate', element: <MoneyInReceiptAllocatePage /> },
  { path: 'accounting/money-in/credit-notes', element: <MoneyInCreditNoteListPage /> },
  { path: 'accounting/money-in/credit-notes/new', element: <MoneyInCreditNoteNewPage /> },
  { path: 'accounting/money-in/credit-notes/:id/print', element: <MoneyInCreditNotePrintPage /> },
  { path: 'accounting/money-in/credit-notes/:id', element: <MoneyInCreditNoteDetailPage /> },
  { path: 'accounting/money-in/credit-notes/:id/edit', element: <MoneyInCreditNoteEditPage /> },
  { path: 'accounting/money-in/credit-notes/:id/allocate', element: <MoneyInCreditNoteAllocatePage /> },
  { path: 'accounting/money-in/outstanding', element: <MoneyInOutstandingPage /> },
  { path: 'accounting/money-in/customers', element: <MoneyInCustomerListPage /> },
  { path: 'accounting/money-in/customers/:customerId', element: <MoneyInCustomerDetailPage /> },
  { path: 'accounting/money-in/ageing', element: <MoneyInAgeingPage /> },
  { path: 'accounting/money-in/reconciliation', element: <MoneyInReconciliationPage /> },

  /** Money Out — Phase 4A5+ AP frontend (API mode) */
  { path: 'accounting/money-out', element: <MoneyOutOverviewPage /> },
  { path: 'accounting/money-out/vendor-invoices', element: <MoneyOutVendorInvoiceListPage /> },
  { path: 'accounting/money-out/vendor-invoices/new', element: <MoneyOutVendorInvoiceNewPage /> },
  { path: 'accounting/money-out/vendor-invoices/:id', element: <MoneyOutVendorInvoiceDetailPage /> },
  { path: 'accounting/money-out/vendor-invoices/:id/edit', element: <MoneyOutVendorInvoiceEditPage /> },
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
  { path: 'accounting/money-out/vendor-adjustments', element: <MoneyOutVendorAdjustmentListPage /> },
  { path: 'accounting/money-out/vendor-adjustments/new', element: <MoneyOutVendorAdjustmentNewPage /> },
  { path: 'accounting/money-out/vendor-adjustments/:id/print', element: <MoneyOutVendorAdjustmentPrintPage /> },
  { path: 'accounting/money-out/vendor-adjustments/:id', element: <MoneyOutVendorAdjustmentDetailPage /> },
  { path: 'accounting/money-out/vendor-adjustments/:id/edit', element: <MoneyOutVendorAdjustmentEditPage /> },
  { path: 'accounting/money-out/vendor-adjustments/:id/allocate', element: <MoneyOutVendorAdjustmentAllocatePage /> },
  { path: 'accounting/money-out/corrections', element: <MoneyOutCorrectionsWorkspacePage /> },
  { path: 'accounting/money-out/reversals', element: <MoneyOutReversalHistoryPage /> },
  { path: 'accounting/money-out/reversals/:type/:id', element: <MoneyOutReversalPreviewPage /> },
  { path: 'accounting/money-out/reconciliation', element: <MoneyOutPayableReconciliationPage /> },
  { path: 'accounting/money-out/reconciliation/runs', element: <MoneyOutPayableReconciliationRunListPage /> },
  { path: 'accounting/money-out/reconciliation/runs/:id', element: <MoneyOutPayableReconciliationRunDetailPage /> },
  { path: 'accounting/money-out/reconciliation/exceptions', element: <MoneyOutPayableReconciliationExceptionsPage /> },
  { path: 'accounting/money-out/reconciliation/exceptions/:id', element: <MoneyOutPayableReconciliationExceptionDetailPage /> },
  { path: 'accounting/money-out/close-gate', element: <MoneyOutPayableCloseGatePage /> },
  { path: 'accounting/money-out/close-gate/runs/:id', element: <MoneyOutPayableCloseGateRunDetailPage /> },

  /** Legacy demo AR/AP → live Money In / Money Out */
  { path: 'accounting/receivables', element: <Navigate to="/accounting/money-in" replace /> },
  { path: 'accounting/receivables/*', element: <Navigate to="/accounting/money-in" replace /> },
  { path: 'accounting/commercial-commitments', element: <Navigate to="/accounting/money-in" replace /> },
  { path: 'accounting/payables', element: <Navigate to="/accounting/money-out" replace /> },
  { path: 'accounting/payables/*', element: <Navigate to="/accounting/money-out" replace /> },

  /** Bank & Cash — live treasury (transfers, statements, recon, cheques, books) */
  { path: 'accounting/bank', element: <Navigate to="/accounting/bank-cash" replace /> },
  { path: 'accounting/bank/:bankAccountId/reconcile', element: <Navigate to="/accounting/bank-cash/reconciliation" replace /> },
  { path: 'accounting/bank-cash', element: <LiquidityDashboardPage /> },
  { path: 'accounting/bank-cash/liquidity', element: <LiquidityDashboardPage /> },
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

  /** Seed/demo Bank & Cash registers removed — send deep links to live hub */
  { path: 'accounting/bank-cash/bank-accounts', element: <Navigate to="/accounting/bank-cash" replace /> },
  { path: 'accounting/bank-cash/bank-accounts/:id', element: <Navigate to="/accounting/bank-cash" replace /> },
  { path: 'accounting/bank-cash/cash-accounts', element: <Navigate to="/accounting/bank-cash" replace /> },
  { path: 'accounting/bank-cash/cash-accounts/:id', element: <Navigate to="/accounting/bank-cash" replace /> },
  { path: 'accounting/bank-cash/transactions', element: <Navigate to="/accounting/bank-cash" replace /> },
  { path: 'accounting/bank-cash/deposits', element: <Navigate to="/accounting/bank-cash" replace /> },
  { path: 'accounting/bank-cash/cash-book', element: <Navigate to="/accounting/bank-cash/cashbook" replace /> },
  { path: 'accounting/bank-cash/cash-counts', element: <Navigate to="/accounting/bank-cash" replace /> },
  { path: 'accounting/bank-cash/cash-counts/:id', element: <Navigate to="/accounting/bank-cash" replace /> },
  { path: 'accounting/bank-cash/reports', element: <Navigate to="/accounting/bank-cash" replace /> },
  { path: 'accounting/bank-cash/setup', element: <Navigate to="/accounting/bank-cash" replace /> },

  /** Fixed Assets */
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

  /** Manufacturing Accounting — live Phase 7E workspace only (seed sub-pages removed) */
  { path: 'accounting/manufacturing', element: <ManufacturingAccountingApiGate /> },
  { path: 'accounting/manufacturing/*', element: <Navigate to="/accounting/manufacturing" replace /> },

  /** Tax — live GST extract + e-invoice / e-way only */
  { path: 'accounting/gst-tds', element: <Navigate to="/accounting/tax-compliance" replace /> },
  { path: 'accounting/tax-compliance', element: <TaxComplianceOverviewPage /> },
  { path: 'accounting/tax-compliance/gst', element: <GstDashboardPage /> },
  { path: 'accounting/tax-compliance/gst/outward-supplies', element: <OutwardSuppliesPage /> },
  { path: 'accounting/tax-compliance/gst/inward-supplies', element: <InwardSuppliesPage /> },
  { path: 'accounting/tax-compliance/gst/e-invoices', element: <EInvoicesPage /> },
  { path: 'accounting/tax-compliance/gst/e-way-bills', element: <EWayBillsPage /> },

  { path: 'accounting/ledger', element: <Navigate to="/accounting/ledger-entries" replace /> },
  { path: 'accounting/ledger-entries', element: <LedgerEntriesPage /> },
  { path: 'accounting/ledger-entries/account/:accountId', element: <AccountLedgerPage /> },
  { path: 'accounting/ledger-entries/voucher/:voucherId', element: <VoucherLedgerPage /> },
  { path: 'accounting/ledger-entries/party/:partyType/:partyId', element: <PartyLedgerPage /> },
  { path: 'accounting/ledger-entries/:entryId', element: <LedgerEntryDetailPage /> },

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

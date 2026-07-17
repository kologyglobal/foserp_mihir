import type { RouteObject } from 'react-router-dom'
import { Navigate, useParams } from 'react-router-dom'

/** Legacy deep-link from Accounting dashboard overdue table → Customer Receivable Card */
function LegacyReceivablesCustomerRedirect() {
  const { partyId } = useParams()
  return <Navigate to={partyId ? `/accounting/receivables/customer/${partyId}` : '/accounting/receivables/outstanding'} replace />
}
import { CommercialCommitmentsPage } from '@/modules/accounting/CommercialCommitmentsPage'
import { AccountingDashboardPage } from '@/modules/accounting/AccountingDashboardPage'
import { ChartOfAccountsPage } from '@/modules/accounting/ChartOfAccountsPage'
import { AccountCardPage } from '@/modules/accounting/AccountCardPage'
import { VouchersRegisterPage } from '@/modules/accounting/VouchersRegisterPage'
import { VoucherNewPage, VoucherEditPage } from '@/modules/accounting/VoucherEditorPage'
import { VoucherDetailPage } from '@/modules/accounting/VoucherDetailPage'
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
import { BankCashOverviewPage } from '@/modules/accounting/BankCashOverviewPage'
import { BankAccountsPage } from '@/modules/accounting/BankAccountsPage'
import { BankAccountCardPage } from '@/modules/accounting/BankAccountCardPage'
import { CashAccountsPage } from '@/modules/accounting/CashAccountsPage'
import { CashAccountCardPage } from '@/modules/accounting/CashAccountCardPage'
import { BankCashTransactionsPage } from '@/modules/accounting/BankCashTransactionsPage'
import { FundTransfersPage } from '@/modules/accounting/FundTransfersPage'
import { FundTransferNewPage, FundTransferDetailPage } from '@/modules/accounting/FundTransferEditorPage'
import { BankStatementsPage } from '@/modules/accounting/BankStatementsPage'
import { BankStatementImportPage } from '@/modules/accounting/BankStatementImportPage'
import { BankStatementDetailPage } from '@/modules/accounting/BankStatementDetailPage'
import { BankReconciliationPage } from '@/modules/accounting/BankReconciliationPage'
import { BankReconciliationWorkbenchPage } from '@/modules/accounting/BankReconciliationWorkbenchPage'
import { ChequeManagementPage } from '@/modules/accounting/ChequeManagementPage'
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
  JournalDetailPage,
  JournalEditPage,
  JournalListPage,
  JournalNewPage,
} from '@/modules/accounting/journals'

/**
 * Accounting module routes — demo/UI-only (no backend posting engine).
 * CoA, Vouchers, Ledger, Receivables, Payables, Tax, Bank & Cash, Fixed Assets,
 * Manufacturing Accounting, Financial Reports, Period Close are full FE modules.
 */
export const accountingRouteChildren: RouteObject[] = [
  { path: 'accounting', element: <AccountingDashboardPage /> },
  { path: 'accounting/dashboard', element: <Navigate to="/accounting" replace /> },

  { path: 'accounting/coa', element: <Navigate to="/accounting/chart-of-accounts" replace /> },
  { path: 'accounting/chart-of-accounts', element: <ChartOfAccountsPage /> },
  { path: 'accounting/chart-of-accounts/:accountId', element: <AccountCardPage /> },
  { path: 'accounting/vouchers', element: <VouchersRegisterPage /> },
  { path: 'accounting/vouchers/new', element: <VoucherNewPage /> },
  { path: 'accounting/vouchers/:voucherId/edit', element: <VoucherEditPage /> },
  { path: 'accounting/vouchers/:voucherId', element: <VoucherDetailPage /> },

  /** Manual journals — Phase 2C1 API + demo dual-mode */
  { path: 'accounting/entries', element: <Navigate to="/accounting/entries/journals" replace /> },
  { path: 'accounting/entries/journals', element: <JournalListPage /> },
  { path: 'accounting/entries/journals/new', element: <JournalNewPage /> },
  { path: 'accounting/entries/journals/:id', element: <JournalDetailPage /> },
  { path: 'accounting/entries/journals/:id/edit', element: <JournalEditPage /> },
  { path: 'accounting/receivables', element: <ReceivablesDashboardPage /> },
  { path: 'accounting/commercial-commitments', element: <CommercialCommitmentsPage /> },
  { path: 'accounting/receivables/customers', element: <CustomerOutstandingPage /> },
  { path: 'accounting/receivables/outstanding', element: <CustomerOutstandingPage /> },
  { path: 'accounting/receivables/invoices', element: <ReceivableInvoicesPage /> },
  { path: 'accounting/receivables/ageing', element: <ReceivablesAgeingPage /> },
  { path: 'accounting/receivables/collections', element: <CollectionWorklistPage /> },
  { path: 'accounting/receivables/receipts', element: <CustomerReceiptsPage /> },
  { path: 'accounting/receivables/receipts/new', element: <CustomerReceiptNewPage /> },
  { path: 'accounting/receivables/receipts/:receiptId/edit', element: <CustomerReceiptEditPage /> },
  { path: 'accounting/receivables/receipts/:receiptId', element: <CustomerReceiptDetailPage /> },
  { path: 'accounting/receivables/allocations', element: <AllocationsPage /> },
  { path: 'accounting/receivables/credit-notes', element: <CreditNotesPage /> },
  { path: 'accounting/receivables/disputes', element: <DisputesPage /> },
  { path: 'accounting/receivables/reminders', element: <ReminderCentrePage /> },
  { path: 'accounting/receivables/customer/:customerId', element: <CustomerReceivableCardPage /> },
  { path: 'accounting/receivables/invoice/:invoiceId', element: <InvoiceReceivableDetailsPage /> },
  {
    path: 'accounting/receivables/customers/:partyId',
    element: <LegacyReceivablesCustomerRedirect />,
  },
  { path: 'accounting/payables', element: <PayablesDashboardPage /> },
  { path: 'accounting/payables/outstanding', element: <VendorOutstandingPage /> },
  { path: 'accounting/payables/invoices', element: <PayableInvoicesPage /> },
  { path: 'accounting/payables/invoice/:invoiceId', element: <PayableInvoiceDetailPage /> },
  { path: 'accounting/payables/ageing', element: <PayablesAgeingPage /> },
  { path: 'accounting/payables/payment-planning', element: <PaymentPlanningPage /> },
  { path: 'accounting/payables/payment-proposals', element: <PaymentProposalsPage /> },
  { path: 'accounting/payables/payment-proposals/:proposalId', element: <PaymentProposalDetailPage /> },
  { path: 'accounting/payables/payments', element: <VendorPaymentsPage /> },
  { path: 'accounting/payables/payments/new', element: <VendorPaymentNewPage /> },
  { path: 'accounting/payables/payments/:paymentId/edit', element: <VendorPaymentEditPage /> },
  { path: 'accounting/payables/payments/:paymentId', element: <VendorPaymentDetailPage /> },
  { path: 'accounting/payables/allocations', element: <PaymentAllocationsPage /> },
  { path: 'accounting/payables/advances', element: <VendorAdvancesPage /> },
  { path: 'accounting/payables/debit-notes', element: <PayableDebitNotesPage /> },
  { path: 'accounting/payables/disputes', element: <VendorDisputesPage /> },
  { path: 'accounting/payables/vendor/:vendorId', element: <VendorPayablesCardPage /> },
  { path: 'accounting/payables/reports', element: <PayablesReportsPage /> },
  { path: 'accounting/payables/setup', element: <PayablesSetupPage /> },

  /** Bank & Cash — full demo frontend module */
  { path: 'accounting/bank', element: <Navigate to="/accounting/bank-cash" replace /> },
  { path: 'accounting/bank/:bankAccountId/reconcile', element: <Navigate to="/accounting/bank-cash/reconciliation" replace /> },
  { path: 'accounting/bank-cash', element: <BankCashOverviewPage /> },
  { path: 'accounting/bank-cash/bank-accounts', element: <BankAccountsPage /> },
  { path: 'accounting/bank-cash/bank-accounts/:id', element: <BankAccountCardPage /> },
  { path: 'accounting/bank-cash/cash-accounts', element: <CashAccountsPage /> },
  { path: 'accounting/bank-cash/cash-accounts/:id', element: <CashAccountCardPage /> },
  { path: 'accounting/bank-cash/transactions', element: <BankCashTransactionsPage /> },
  { path: 'accounting/bank-cash/transfers', element: <FundTransfersPage /> },
  { path: 'accounting/bank-cash/transfers/new', element: <FundTransferNewPage /> },
  { path: 'accounting/bank-cash/transfers/:id', element: <FundTransferDetailPage /> },
  { path: 'accounting/bank-cash/statements', element: <BankStatementsPage /> },
  { path: 'accounting/bank-cash/statements/import', element: <BankStatementImportPage /> },
  { path: 'accounting/bank-cash/statements/:id', element: <BankStatementDetailPage /> },
  { path: 'accounting/bank-cash/reconciliation', element: <BankReconciliationPage /> },
  { path: 'accounting/bank-cash/reconciliation/:id', element: <BankReconciliationWorkbenchPage /> },
  { path: 'accounting/bank-cash/cheques', element: <ChequeManagementPage /> },
  { path: 'accounting/bank-cash/deposits', element: <BankDepositsPage /> },
  { path: 'accounting/bank-cash/cash-book', element: <CashBookPage /> },
  { path: 'accounting/bank-cash/cash-counts', element: <CashCountsPage /> },
  { path: 'accounting/bank-cash/cash-counts/new', element: <CashCountEditorPage /> },
  { path: 'accounting/bank-cash/reports', element: <BankCashReportsPage /> },
  { path: 'accounting/bank-cash/setup', element: <BankCashSetupPage /> },

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

  /** Manufacturing Accounting & Costing — full demo frontend module */
  { path: 'accounting/manufacturing', element: <ManufacturingAccountingOverviewPage /> },
  { path: 'accounting/manufacturing/material-consumption', element: <ManufacturingMaterialConsumptionPage /> },
  { path: 'accounting/manufacturing/wip', element: <ManufacturingWipRegisterPage /> },
  { path: 'accounting/manufacturing/finished-goods', element: <ManufacturingFinishedGoodsPage /> },
  { path: 'accounting/manufacturing/production-costing', element: <ManufacturingProductionCostingPage /> },
  { path: 'accounting/manufacturing/variances', element: <ManufacturingVariancesPage /> },
  { path: 'accounting/manufacturing/subcontracting', element: <ManufacturingSubcontractingPage /> },
  { path: 'accounting/manufacturing/scrap-rework', element: <ManufacturingScrapReworkPage /> },
  { path: 'accounting/manufacturing/overhead', element: <ManufacturingOverheadPage /> },
  { path: 'accounting/manufacturing/cost-centres', element: <ManufacturingCostCentresPage /> },
  { path: 'accounting/manufacturing/cost-sheet', element: <ManufacturingProductCostSheetPage /> },
  { path: 'accounting/manufacturing/ledger', element: <ManufacturingProductionLedgerPage /> },
  { path: 'accounting/manufacturing/reports', element: <ManufacturingCostingReportsPage /> },
  { path: 'accounting/manufacturing/setup', element: <ManufacturingCostingSetupPage /> },

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
  { path: 'accounting/reports', element: <FinancialReportsDashboardPage /> },
  { path: 'accounting/reports/trial-balance', element: <TrialBalancePage /> },
  { path: 'accounting/reports/profit-loss', element: <ProfitLossPage /> },
  { path: 'accounting/reports/balance-sheet', element: <BalanceSheetPage /> },
  { path: 'accounting/reports/cash-flow', element: <CashFlowPage /> },
  { path: 'accounting/reports/general-ledger', element: <GeneralLedgerReportPage /> },
  { path: 'accounting/reports/account-schedules', element: <AccountSchedulesPage /> },
  { path: 'accounting/reports/cost-centre', element: <CostCentreProfitabilityPage /> },
  { path: 'accounting/reports/department', element: <DepartmentPerformancePage /> },
  { path: 'accounting/reports/project', element: <ProjectProfitabilityPage /> },
  { path: 'accounting/reports/manufacturing', element: <ManufacturingCostSummaryPage /> },
  { path: 'accounting/reports/budget-vs-actual', element: <BudgetVsActualPage /> },
  { path: 'accounting/reports/comparative', element: <ComparativeStatementsPage /> },
  { path: 'accounting/reports/ratios', element: <RatioAnalysisPage /> },
  { path: 'accounting/reports/mis', element: <FinancialMisPage /> },
  { path: 'accounting/reports/setup', element: <FinancialReportSetupPage /> },
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

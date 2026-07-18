import { Navigate } from 'react-router-dom'
import { RouteErrorBoundary } from '../components/system/RouteErrorBoundary'
import { PurchaseModuleDashboard } from '../modules/purchase/PurchaseModuleDashboard'
import {
  PurchaseRequisitionListPage,
  PurchaseRequisitionDetailPage,
} from '../modules/purchase/PurchasePages'
import { RfqListPage } from '../modules/purchase/RfqListPage'
import { RfqDetailPage } from '../modules/purchase/RfqDetailPage'
import { RfqEditorPage } from '../modules/purchase/RfqEditorPage'
import {
  PurchaseRequisitionFormPage,
  PurchaseRequisitionEditPage,
  ManualPrFormPage,
} from '../modules/purchase/PurchaseFormPages'
import {
  PurchaseOrderListPage,
  PurchaseOrderEditorPage,
  PurchaseOrderDetailPage,
  PurchaseOrderRevisePage,
  PurchaseOrderPrintPage,
} from '../modules/purchase/PurchaseOrderPages'
import {
  GrnListPage,
  GrnEditorPage,
  GrnDetailPage,
  QualityInspectionListPage,
  QualityInspectionDetailPage,
} from '../modules/purchase/GrnDomainPages'
import { PurchaseReportsHubPage } from '../modules/purchase/PurchaseReportsHubPage'
import { PurchaseReportRunnerPage } from '../modules/purchase/PurchaseReportRunnerPage'
import {
  VendorQuotationListPage,
  VendorQuotationDetailPage,
  VendorQuotationEditorPage,
} from '../modules/purchase/VendorQuotationPages'
import {
  QuotationComparisonPage,
  QuotationComparisonIndexPage,
} from '../modules/purchase/QuotationComparisonPages'
import { VendorPerformancePage } from '../modules/purchase/PurchaseExtendedPages'
import {
  PurchaseReturnListPage,
  PurchaseReturnEditorPage,
  PurchaseReturnDetailPage,
  PurchaseReturnPrintPage,
} from '../modules/purchase/PurchaseReturnPages'
import {
  PurchaseInvoiceListPage,
  PurchaseInvoiceEditorPage,
  PurchaseInvoiceDetailPage,
  PurchaseInvoicePrintPage,
} from '../modules/purchase/PurchaseInvoicePages'
import { PurchaseMastersHubPage } from '../modules/purchase/masters/PurchaseMastersHubPage'
import {
  PurchaseMasterListPage,
  PurchaseMasterFormPage,
  PurchaseMasterDetailPage,
  PurchaseLinkedMasterPage,
} from '../modules/purchase/masters/PurchaseMasterPages'
import { PurchaseApprovalsPage } from '../modules/purchase/PurchaseApprovalsPage'
import { PurchaseSetupPage } from '../modules/purchase/PurchaseSetupPage'
import { PurchasePlanningSheetPage } from '../modules/purchase/PurchasePlanningSheetPage'

export const purchaseRouteChildren = [
  { index: true, element: <PurchaseModuleDashboard /> },
  { path: 'approvals', element: <PurchaseApprovalsPage /> },
  { path: 'setup', element: <PurchaseSetupPage /> },
  { path: 'requisitions', element: <PurchaseRequisitionListPage /> },
  { path: 'requisitions/new', element: <PurchaseRequisitionFormPage /> },
  { path: 'requisitions/:id/edit', element: <PurchaseRequisitionEditPage /> },
  { path: 'requisitions/:id', element: <PurchaseRequisitionDetailPage /> },
  { path: 'planning-sheet', element: <PurchasePlanningSheetPage /> },
  { path: 'rfqs', element: <RfqListPage /> },
  { path: 'rfqs/new', element: <RfqEditorPage /> },
  { path: 'rfqs/:id/edit', element: <RfqEditorPage /> },
  { path: 'rfqs/:id', element: <RfqDetailPage /> },
  { path: 'vendor-quotations', element: <VendorQuotationListPage /> },
  { path: 'vendor-quotations/new', element: <VendorQuotationEditorPage /> },
  { path: 'vendor-quotations/:id/edit', element: <VendorQuotationEditorPage /> },
  { path: 'vendor-quotations/:id', element: <VendorQuotationDetailPage /> },
  { path: 'comparison', element: <QuotationComparisonIndexPage /> },
  { path: 'comparison/:rfqId', element: <QuotationComparisonPage /> },
  { path: 'orders', element: <PurchaseOrderListPage /> },
  { path: 'orders/new', element: <PurchaseOrderEditorPage /> },
  { path: 'orders/:id/edit', element: <PurchaseOrderEditorPage /> },
  { path: 'orders/:id/revise', element: <PurchaseOrderRevisePage /> },
  { path: 'orders/:id/amend', element: <PurchaseOrderRevisePage /> },
  { path: 'orders/:id/print', element: <PurchaseOrderPrintPage /> },
  { path: 'orders/:id', element: <PurchaseOrderDetailPage /> },
  { path: 'invoices', element: <PurchaseInvoiceListPage /> },
  { path: 'invoices/new', element: <PurchaseInvoiceEditorPage /> },
  { path: 'invoices/:id/edit', element: <PurchaseInvoiceEditorPage /> },
  { path: 'invoices/:id/print', element: <PurchaseInvoicePrintPage /> },
  { path: 'invoices/:id', element: <PurchaseInvoiceDetailPage /> },
  { path: 'grn', element: <GrnListPage /> },
  { path: 'grn/new', element: <GrnEditorPage /> },
  { path: 'grn/:id/edit', element: <GrnEditorPage /> },
  { path: 'grn/:id/print', element: <GrnDetailPage /> },
  { path: 'grn/:id', element: <GrnDetailPage /> },
  { path: 'grns', element: <Navigate to="/purchase/grn" replace /> },
  { path: 'grns/:id', element: <GrnDetailPage /> },
  { path: 'quality-inspections', element: <QualityInspectionListPage /> },
  { path: 'quality-inspections/:id', element: <QualityInspectionDetailPage /> },
  { path: 'returns', element: <PurchaseReturnListPage /> },
  { path: 'returns/new', element: <PurchaseReturnEditorPage /> },
  { path: 'returns/:id/edit', element: <PurchaseReturnEditorPage /> },
  { path: 'returns/:id/print', element: <PurchaseReturnPrintPage /> },
  { path: 'returns/:id', element: <PurchaseReturnDetailPage /> },
  { path: 'vendor-performance', element: <VendorPerformancePage /> },
  { path: 'reports', element: <PurchaseReportsHubPage /> },
  { path: 'reports/:reportId', element: <PurchaseReportRunnerPage /> },
  { path: 'masters', element: <PurchaseMastersHubPage /> },
  { path: 'masters/vendors', element: <PurchaseLinkedMasterPage /> },
  { path: 'masters/vendors/new', element: <PurchaseLinkedMasterPage /> },
  { path: 'masters/vendors/:id', element: <PurchaseLinkedMasterPage /> },
  { path: 'masters/vendors/:id/edit', element: <PurchaseLinkedMasterPage /> },
  { path: 'masters/items', element: <PurchaseLinkedMasterPage /> },
  { path: 'masters/items/new', element: <PurchaseLinkedMasterPage /> },
  { path: 'masters/items/:id', element: <PurchaseLinkedMasterPage /> },
  { path: 'masters/items/:id/edit', element: <PurchaseLinkedMasterPage /> },
  { path: 'masters/item-categories', element: <PurchaseLinkedMasterPage /> },
  { path: 'masters/item-categories/new', element: <PurchaseLinkedMasterPage /> },
  { path: 'masters/item-categories/:id', element: <PurchaseLinkedMasterPage /> },
  { path: 'masters/item-categories/:id/edit', element: <PurchaseLinkedMasterPage /> },
  { path: 'masters/warehouses', element: <PurchaseLinkedMasterPage /> },
  { path: 'masters/warehouses/new', element: <PurchaseLinkedMasterPage /> },
  { path: 'masters/warehouses/:id', element: <PurchaseLinkedMasterPage /> },
  { path: 'masters/warehouses/:id/edit', element: <PurchaseLinkedMasterPage /> },
  { path: 'masters/locations', element: <PurchaseLinkedMasterPage /> },
  { path: 'masters/locations/new', element: <PurchaseLinkedMasterPage /> },
  { path: 'masters/locations/:id', element: <PurchaseLinkedMasterPage /> },
  { path: 'masters/locations/:id/edit', element: <PurchaseLinkedMasterPage /> },
  { path: 'masters/uom', element: <PurchaseLinkedMasterPage /> },
  { path: 'masters/uom/new', element: <PurchaseLinkedMasterPage /> },
  { path: 'masters/uom/:id', element: <PurchaseLinkedMasterPage /> },
  { path: 'masters/uom/:id/edit', element: <PurchaseLinkedMasterPage /> },
  { path: 'masters/payment-terms', element: <PurchaseLinkedMasterPage /> },
  { path: 'masters/payment-terms/new', element: <PurchaseLinkedMasterPage /> },
  { path: 'masters/payment-terms/:id', element: <PurchaseLinkedMasterPage /> },
  { path: 'masters/payment-terms/:id/edit', element: <PurchaseLinkedMasterPage /> },
  { path: 'masters/delivery-terms', element: <PurchaseLinkedMasterPage /> },
  { path: 'masters/delivery-terms/new', element: <PurchaseLinkedMasterPage /> },
  { path: 'masters/delivery-terms/:id', element: <PurchaseLinkedMasterPage /> },
  { path: 'masters/delivery-terms/:id/edit', element: <PurchaseLinkedMasterPage /> },
  { path: 'masters/approval-matrix', element: <Navigate to="/purchase/setup" replace /> },
  { path: 'masters/qc-parameters', element: <PurchaseLinkedMasterPage /> },
  { path: 'masters/qc-parameters/new', element: <PurchaseLinkedMasterPage /> },
  { path: 'masters/inspection-plans', element: <PurchaseLinkedMasterPage /> },
  { path: 'masters/inspection-plans/new', element: <PurchaseLinkedMasterPage /> },
  { path: 'masters/:kind', element: <PurchaseMasterListPage /> },
  { path: 'masters/:kind/new', element: <PurchaseMasterFormPage /> },
  { path: 'masters/:kind/:id/edit', element: <PurchaseMasterFormPage /> },
  { path: 'masters/:kind/:id', element: <PurchaseMasterDetailPage /> },
  // Legacy manual PR route
  { path: 'manual-pr', element: <ManualPrFormPage /> },
]

export const purchaseRouteTree = {
  path: 'purchase',
  errorElement: <RouteErrorBoundary />,
  children: purchaseRouteChildren,
}

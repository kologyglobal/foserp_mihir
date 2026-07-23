import type { ReactElement } from 'react'
import type { RouteObject } from 'react-router-dom'
import { Navigate, useParams } from 'react-router-dom'
import { InventoryOverviewPage } from '@/modules/inventory/overview/InventoryOverviewPage'
import { InventoryItemsListPage } from '@/modules/inventory/items/InventoryItemsListPage'
import { InventoryItemFormPage } from '@/modules/inventory/items/InventoryItemFormPage'
import { InventoryItemDetailPage } from '@/modules/inventory/items/InventoryItemDetailPage'
import { StockAvailabilityPage } from '@/modules/inventory/stock/StockAvailabilityPage'
import { InventoryPlanningPage } from '@/modules/inventory/planning/InventoryPlanningPage'
import { InventoryReportsHubPage } from '@/modules/inventory/reports/InventoryReportsHubPage'
import { InventoryReportRunnerPage } from '@/modules/inventory/reports/InventoryReportRunnerPage'
import { InventorySetupPage } from '@/modules/inventory/setup/InventorySetupPage'
import { InventoryAccountingEventsPage } from '@/modules/inventory/accounting/InventoryAccountingEventsPage'
import {
  TransferRegisterPage,
  TransferEditorPage,
  AdjustmentRegisterPage,
  AdjustmentEditorPage,
  ReturnRegisterPage,
  ReturnEditorPage,
} from '@/modules/inventory/movements'
import { ReceiptsRegisterPage } from '@/modules/inventory/movements/ReceiptsRegisterPage'
import { QuickReceiptPage, ReceiptDetailPage } from '@/modules/inventory/movements/QuickReceiptPage'
import { IssuesRegisterPage } from '@/modules/inventory/movements/IssuesRegisterPage'
import { QuickIssuePage, IssueDetailPage } from '@/modules/inventory/movements/QuickIssuePage'
import { ItemLedgerPage } from '@/modules/inventory/ledger/ItemLedgerPage'
import { StockCountRegisterPage } from '@/modules/inventory/stockCount/StockCountRegisterPage'
import { StockCountNewPage, StockCountDetailPage } from '@/modules/inventory/stockCount/StockCountWorkbenchPage'
import {
  OpeningStockPage,
  MaterialInwardPage,
  MaterialIssuePage,
  StockAdjustmentPage,
} from '@/modules/inventory/InventoryTxnPages'
import { StockLedgerPage } from '@/modules/inventory/StockLedgerPage'
import { InventoryStockDetailPage } from '@/modules/inventory/stock/InventoryStockDetailPage'
import { ReservationsPage } from '@/modules/inventory/ReservationsPage'
import { ScanToReceivePage, ScanToIssuePage, ScanToTransferPage } from '@/modules/barcode'
import {
  ApiStockBalancesPage,
  ApiStockLedgerPage,
  ApiItemLedgerRedirect,
  ApiReservationsPage,
  ApiMovementPostPage,
  ApiInventoryDocumentsPage,
} from '@/modules/inventory/api/ApiInventoryPages'
import {
  ApiReceiptsRegisterPage,
  ApiReceiptPostPage,
  ApiReceiptDetailPage,
  ApiReceiptEditRedirect,
} from '@/modules/inventory/api/ApiReceiptsPages'
import {
  ApiReturnsRegisterPage,
  ApiReturnPostPage,
  ApiReturnDetailPage,
} from '@/modules/inventory/api/ApiReturnsPages'
import {
  ApiIssuesRegisterPage,
  ApiIssuePostPage,
  ApiIssueDetailPage,
  ApiIssueEditRedirect,
} from '@/modules/inventory/api/ApiIssuesPages'
import {
  ApiScanToReceivePage,
  ApiScanToIssuePage,
  ApiScanToTransferPage,
} from '@/modules/inventory/api/ApiInventoryScanPages'
import { StoreWorkbenchPage } from '@/modules/manufacturing/store-workbench/StoreWorkbenchPage'
import { isApiMode } from '@/config/apiConfig'
import { ApiModeDemoGatePage } from '@/components/system/DemoOnlyRouteGate'

/** Live mode: item master CRUD lives under /masters/items. */
function MastersItemEditRedirect() {
  const { id, itemId } = useParams()
  const recordId = id ?? itemId
  return <Navigate to={recordId ? `/masters/items/${recordId}/edit` : '/masters/items'} replace />
}

const demoInventoryRouteChildren: RouteObject[] = [
  { path: 'inventory', element: <InventoryOverviewPage /> },
  { path: 'inventory/items', element: <InventoryItemsListPage /> },
  { path: 'inventory/items/new', element: <InventoryItemFormPage /> },
  { path: 'inventory/items/:itemId/edit', element: <InventoryItemFormPage /> },
  { path: 'inventory/items/:id/edit', element: <InventoryItemFormPage /> },
  { path: 'inventory/items/:itemId/ledger', element: <ItemLedgerPage /> },
  { path: 'inventory/items/:id/ledger', element: <ItemLedgerPage /> },
  { path: 'inventory/items/:itemId', element: <InventoryItemDetailPage /> },
  { path: 'inventory/items/:id', element: <InventoryItemDetailPage /> },
  { path: 'inventory/stock', element: <StockAvailabilityPage /> },
  { path: 'inventory/stock/:itemId', element: <InventoryStockDetailPage /> },

  { path: 'inventory/movements/receipts', element: <ReceiptsRegisterPage /> },
  { path: 'inventory/movements/receipts/new', element: <QuickReceiptPage /> },
  { path: 'inventory/movements/receipts/:id/edit', element: <QuickReceiptPage /> },
  { path: 'inventory/movements/receipts/:id', element: <ReceiptDetailPage /> },
  { path: 'inventory/movements/issues', element: <IssuesRegisterPage /> },
  { path: 'inventory/movements/issues/new', element: <QuickIssuePage /> },
  { path: 'inventory/movements/issues/:id/edit', element: <QuickIssuePage /> },
  { path: 'inventory/movements/issues/:id', element: <IssueDetailPage /> },
  { path: 'inventory/movements/transfers', element: <TransferRegisterPage /> },
  { path: 'inventory/movements/transfers/new', element: <TransferEditorPage /> },
  { path: 'inventory/movements/transfers/:id', element: <TransferEditorPage /> },
  { path: 'inventory/movements/adjustments', element: <AdjustmentRegisterPage /> },
  { path: 'inventory/movements/adjustments/new', element: <AdjustmentEditorPage /> },
  { path: 'inventory/movements/adjustments/:id', element: <AdjustmentEditorPage /> },
  { path: 'inventory/movements/returns', element: <ReturnRegisterPage /> },
  { path: 'inventory/movements/returns/new', element: <ReturnEditorPage /> },
  { path: 'inventory/movements/returns/:id', element: <ReturnEditorPage /> },

  { path: 'inventory/stock-count', element: <StockCountRegisterPage /> },
  { path: 'inventory/stock-count/new', element: <StockCountNewPage /> },
  { path: 'inventory/stock-count/:id', element: <StockCountDetailPage /> },

  { path: 'inventory/planning', element: <InventoryPlanningPage /> },
  { path: 'inventory/accounting', element: <InventoryAccountingEventsPage /> },
  { path: 'inventory/reports', element: <InventoryReportsHubPage /> },
  { path: 'inventory/reports/:reportId', element: <InventoryReportRunnerPage /> },
  { path: 'inventory/setup', element: <InventorySetupPage /> },

  /** Legacy routes */
  { path: 'inventory/opening-stock', element: <OpeningStockPage /> },
  { path: 'inventory/ledger', element: <StockLedgerPage /> },
  { path: 'inventory/inward', element: <MaterialInwardPage /> },
  { path: 'inventory/issue', element: <MaterialIssuePage /> },
  { path: 'inventory/adjustment', element: <StockAdjustmentPage /> },
  { path: 'inventory/reservations', element: <ReservationsPage /> },
  { path: 'inventory/scan/receive', element: <ScanToReceivePage /> },
  { path: 'inventory/scan/issue', element: <ScanToIssuePage /> },
  { path: 'inventory/scan/transfer', element: <ScanToTransferPage /> },
  { path: 'inventory/store-workbench', element: <StoreWorkbenchPage /> },
  { path: 'inventory/movements', element: <StockLedgerPage /> },
  { path: 'inventory/transfers', element: <Navigate to="/inventory/movements/transfers" replace /> },
  { path: 'inventory/counts', element: <Navigate to="/inventory/stock-count" replace /> },
  { path: 'inventory/traceability', element: <Navigate to="/manufacturing/traceability" replace /> },
  { path: 'inventory/settings', element: <Navigate to="/inventory/setup" replace /> },
]

/**
 * Phase 8C Wave 1 + Inventory 3A/documents FE wiring: stock truth lives in the
 * Inventory API. In API mode (`VITE_USE_API=true`) live pages cover items
 * register, receipts/issues/returns, planning (reorder from balances), balances,
 * ledger, reservations, immediate movement posts, document registers
 * (transfers / adjustments / stock counts), reports, setup, and barcode scan.
 * Demo mode is unchanged.
 */
const inventoryApiModeGate = (
  <ApiModeDemoGatePage
    title="Inventory workspace"
    description="This inventory screen is demo-only and does not read live stock. Live stock is available under Stock, Stock Ledger, Issues and Reservations; work-order material moves also run from the Work Order Materials tab."
    links={[
      { label: 'Open Stock', to: '/inventory/stock' },
      { label: 'Open Stock Ledger', to: '/inventory/ledger' },
      { label: 'Open Issues', to: '/inventory/movements/issues' },
      { label: 'Open Work Orders', to: '/manufacturing/work-orders' },
    ]}
  />
)

/** Routes with a live Inventory 3A backend — rendered instead of the gate in API mode. */
const apiInventoryRouteOverrides: Record<string, ReactElement> = {
  inventory: <InventoryOverviewPage />,
  'inventory/store-workbench': <StoreWorkbenchPage />,
  'inventory/items': <InventoryItemsListPage />,
  'inventory/items/new': <Navigate to="/masters/items/new" replace />,
  'inventory/items/:itemId/edit': <MastersItemEditRedirect />,
  'inventory/items/:id/edit': <MastersItemEditRedirect />,
  'inventory/items/:itemId': <InventoryItemDetailPage />,
  'inventory/items/:id': <InventoryItemDetailPage />,
  'inventory/movements/receipts': <ApiReceiptsRegisterPage />,
  'inventory/movements/receipts/new': <ApiReceiptPostPage />,
  'inventory/movements/receipts/:id/edit': <ApiReceiptEditRedirect />,
  'inventory/movements/receipts/:id': <ApiReceiptDetailPage />,
  'inventory/movements/issues': <ApiIssuesRegisterPage />,
  'inventory/movements/issues/new': <ApiIssuePostPage />,
  'inventory/movements/issues/:id/edit': <ApiIssueEditRedirect />,
  'inventory/movements/issues/:id': <ApiIssueDetailPage />,
  'inventory/movements/returns': <ApiReturnsRegisterPage />,
  'inventory/movements/returns/new': <ApiReturnPostPage />,
  'inventory/movements/returns/:id': <ApiReturnDetailPage />,
  'inventory/planning': <InventoryPlanningPage />,
  'inventory/accounting': <InventoryAccountingEventsPage />,
  'inventory/reports': <InventoryReportsHubPage />,
  'inventory/reports/:reportId': <InventoryReportRunnerPage />,
  'inventory/setup': <InventorySetupPage />,
  'inventory/scan/receive': <ApiScanToReceivePage />,
  'inventory/scan/issue': <ApiScanToIssuePage />,
  'inventory/scan/transfer': <ApiScanToTransferPage />,
  'inventory/stock': <ApiStockBalancesPage />,
  'inventory/stock/:itemId': <ApiItemLedgerRedirect />,
  'inventory/movements': <ApiStockLedgerPage />,
  'inventory/ledger': <ApiStockLedgerPage />,
  'inventory/items/:itemId/ledger': <ApiItemLedgerRedirect />,
  'inventory/items/:id/ledger': <ApiItemLedgerRedirect />,
  'inventory/reservations': <ApiReservationsPage />,
  'inventory/opening-stock': <ApiMovementPostPage kind="opening" />,
  'inventory/inward': <ApiMovementPostPage kind="inward" />,
  'inventory/issue': <ApiMovementPostPage kind="issue" />,
  'inventory/adjustment': <ApiMovementPostPage kind="adjustment" />,
  'inventory/movements/transfers': <ApiInventoryDocumentsPage kind="transfers" />,
  'inventory/movements/transfers/new': <ApiInventoryDocumentsPage kind="transfers" />,
  'inventory/movements/transfers/:id': <ApiInventoryDocumentsPage kind="transfers" />,
  'inventory/movements/adjustments': <ApiInventoryDocumentsPage kind="adjustments" />,
  'inventory/movements/adjustments/new': <ApiInventoryDocumentsPage kind="adjustments" />,
  'inventory/movements/adjustments/:id': <ApiInventoryDocumentsPage kind="adjustments" />,
  'inventory/stock-count': <ApiInventoryDocumentsPage kind="stock-counts" />,
  'inventory/stock-count/new': <ApiInventoryDocumentsPage kind="stock-counts" />,
  'inventory/stock-count/:id': <ApiInventoryDocumentsPage kind="stock-counts" />,
  'inventory/transfers': <Navigate to="/inventory/movements/transfers" replace />,
  'inventory/counts': <Navigate to="/inventory/stock-count" replace />,
  'inventory/traceability': <Navigate to="/manufacturing/traceability" replace />,
  'inventory/settings': <Navigate to="/inventory/setup" replace />,
}

export const inventoryRouteChildren: RouteObject[] = isApiMode()
  ? demoInventoryRouteChildren.map((route) => ({
      ...route,
      element: apiInventoryRouteOverrides[route.path ?? ''] ?? inventoryApiModeGate,
    }))
  : demoInventoryRouteChildren

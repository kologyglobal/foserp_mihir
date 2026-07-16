import type { RouteObject } from 'react-router-dom'
import { InventoryOverviewPage } from '@/modules/inventory/overview/InventoryOverviewPage'
import { InventoryItemsListPage } from '@/modules/inventory/items/InventoryItemsListPage'
import { InventoryItemFormPage } from '@/modules/inventory/items/InventoryItemFormPage'
import { InventoryItemDetailPage } from '@/modules/inventory/items/InventoryItemDetailPage'
import { StockAvailabilityPage } from '@/modules/inventory/stock/StockAvailabilityPage'
import { InventoryPlanningPage } from '@/modules/inventory/planning/InventoryPlanningPage'
import { InventoryReportsHubPage } from '@/modules/inventory/reports/InventoryReportsHubPage'
import { InventoryReportRunnerPage } from '@/modules/inventory/reports/InventoryReportRunnerPage'
import { InventorySetupPage } from '@/modules/inventory/setup/InventorySetupPage'
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
import { ItemStockDetailPage } from '@/modules/inventory/ItemStockDetailPage'
import { ReservationsPage } from '@/modules/inventory/ReservationsPage'
import { ScanToReceivePage, ScanToIssuePage, ScanToTransferPage } from '@/modules/barcode'

export const inventoryRouteChildren: RouteObject[] = [
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
  { path: 'inventory/stock/:itemId', element: <ItemStockDetailPage /> },

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
]

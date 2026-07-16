import type { RouteObject } from 'react-router-dom'
import { DocumentRegisterPage, DocumentDetailPage, DocumentApprovalQueuePage } from '@/modules/dms'
import { SettingsHomePage, DemoDataPage } from '@/modules/settings'
import { UatDashboardPage } from '@/modules/uat/UatDashboardPage'
import { MyApprovalsPage, ApprovalDetailPage } from '@/modules/approval'
import {
  BarcodeHubPage,
  BarcodeMasterPage,
  BarcodeGeneratorPage,
  BarcodePrintPage,
  BarcodeHistoryPage,
  BarcodeTraceReportPage,
} from '@/modules/barcode'
import {
  QrPrintPage,
  QrPrintBatchPage,
  QrScannerPage,
  Traceability360Page,
  QrRegistryPage,
} from '@/modules/qr'

export const platformRouteChildren: RouteObject[] = [
  { path: 'documents', element: <DocumentRegisterPage /> },
  { path: 'documents/approvals', element: <DocumentApprovalQueuePage /> },
  { path: 'documents/:id', element: <DocumentDetailPage /> },
  { path: 'settings', element: <SettingsHomePage /> },
  { path: 'settings/demo-data', element: <DemoDataPage /> },
  { path: 'uat/dashboard', element: <UatDashboardPage /> },
  { path: 'approvals', element: <MyApprovalsPage /> },
  { path: 'approvals/:id', element: <ApprovalDetailPage /> },

  { path: 'barcode', element: <BarcodeHubPage /> },
  { path: 'barcode/master', element: <BarcodeMasterPage /> },
  { path: 'barcode/generator', element: <BarcodeGeneratorPage /> },
  { path: 'barcode/print', element: <BarcodePrintPage /> },
  { path: 'barcode/history', element: <BarcodeHistoryPage /> },
  { path: 'barcode/trace', element: <BarcodeTraceReportPage /> },

  { path: 'scan', element: <QrScannerPage /> },
  { path: 'traceability', element: <Traceability360Page /> },
  { path: 'qr/registry', element: <QrRegistryPage /> },
  { path: 'qr/print-batch', element: <QrPrintBatchPage /> },
  { path: 'qr/print/:qrId', element: <QrPrintPage /> },
]

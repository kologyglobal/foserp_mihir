import type { RouteObject } from 'react-router-dom'
import { Navigate } from 'react-router-dom'
import { SalesWorkspacePage } from '@/modules/workspaces'
import {
  SalesOrderListPage,
  SalesOrderDetailPage,
  Customer360HubPage,
  SalesCustomersRouteLayout,
} from '@/modules/sales/SalesPages'
import {
  SalesPipelineLegacyRedirect,
  SalesLeadsLegacyRedirect,
  SalesLeadNewLegacyRedirect,
  SalesLeadDetailLegacyRedirect,
  SalesLeadEditLegacyRedirect,
  SalesInquiriesLegacyRedirect,
  InquiryDetailLegacyRedirect,
  SalesQuotationsLegacyRedirect,
  SalesQuotationNewLegacyRedirect,
  SalesQuotationDetailLegacyRedirect,
  SalesApprovalsLegacyRedirect,
  SalesOrder360LegacyRedirect,
} from '@/modules/sales/SalesNavigationPages'
import { SalesOrderNewPage, SalesOrderEditPage } from '@/modules/sales/SalesOrderFormPage'
import { Customer360Page } from '@/modules/entity360'
import { SalesOrderPrintPage } from '@/components/sales/SalesOrderPrintPage'
import {
  ProformaInvoiceListPage,
  ProformaInvoiceDetailPage,
  ProformaInvoicePrintPage,
} from '@/modules/sales/ProformaInvoicePages'
import { ProformaInvoiceFormPage } from '@/modules/sales/ProformaInvoiceFormPage'

/** Sales Phase 1 (SO) + CRM redirects + demo proforma print/PDF. */
export const salesRouteChildren: RouteObject[] = [
  { path: 'sales-pipeline', element: <SalesPipelineLegacyRedirect /> },
  { path: 'sales', element: <SalesWorkspacePage /> },
  {
    path: 'sales/customers',
    element: <SalesCustomersRouteLayout />,
    children: [
      { index: true, element: <Customer360HubPage /> },
      { path: ':id/360', element: <Customer360Page /> },
    ],
  },
  { path: 'sales/orders/:id/360', element: <SalesOrder360LegacyRedirect /> },
  { path: 'sales/leads', element: <SalesLeadsLegacyRedirect /> },
  { path: 'sales/leads/new', element: <SalesLeadNewLegacyRedirect /> },
  { path: 'sales/leads/:id/edit', element: <SalesLeadEditLegacyRedirect /> },
  { path: 'sales/leads/:id', element: <SalesLeadDetailLegacyRedirect /> },
  { path: 'sales/inquiries', element: <SalesInquiriesLegacyRedirect /> },
  { path: 'sales/inquiries/new', element: <Navigate to="/crm/opportunities/new" replace /> },
  { path: 'sales/inquiries/:id/edit', element: <InquiryDetailLegacyRedirect /> },
  { path: 'sales/inquiries/:id', element: <InquiryDetailLegacyRedirect /> },
  { path: 'sales/quotations', element: <SalesQuotationsLegacyRedirect /> },
  { path: 'sales/quotations/new', element: <SalesQuotationNewLegacyRedirect /> },
  { path: 'sales/quotations/:id', element: <SalesQuotationDetailLegacyRedirect /> },
  { path: 'sales/approvals', element: <SalesApprovalsLegacyRedirect /> },
  { path: 'sales/orders', element: <SalesOrderListPage /> },
  { path: 'sales/orders/new', element: <SalesOrderNewPage /> },
  { path: 'sales/orders/:id/edit', element: <SalesOrderEditPage /> },
  { path: 'sales/orders/:id/print', element: <SalesOrderPrintPage /> },
  { path: 'sales/orders/:id', element: <SalesOrderDetailPage /> },
  { path: 'sales/proforma-invoices', element: <ProformaInvoiceListPage /> },
  { path: 'sales/proforma-invoices/new', element: <ProformaInvoiceFormPage /> },
  { path: 'sales/proforma-invoices/:id/print', element: <ProformaInvoicePrintPage /> },
  { path: 'sales/proforma-invoices/:id', element: <ProformaInvoiceDetailPage /> },
]

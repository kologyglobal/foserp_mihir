import type { RouteObject } from 'react-router-dom'
import {
  CrmQuotationListPage,
  CrmQuotationNewPage,
  CrmQuotationDetailPage,
  CrmQuotationEditorPage,
  CrmQuotationPreviewPage,
  CrmQuotationRevisionsPage,
  CrmQuotationTemplatesPage,
  CrmQuotationTemplateNewPage,
  CrmQuotationTemplateEditorPage,
  CrmQuotationTemplatePreviewPage,
  CrmQuotationPrintPage,
} from '@/modules/quotations'

/** Quotation routes mounted under `/crm` */
export const quotationRouteChildren: RouteObject[] = [
  { path: 'quotations', element: <CrmQuotationListPage /> },
  { path: 'quotations/new', element: <CrmQuotationNewPage /> },
  { path: 'quotations/:id', element: <CrmQuotationDetailPage /> },
  { path: 'quotations/:id/editor', element: <CrmQuotationEditorPage /> },
  { path: 'quotations/:id/preview', element: <CrmQuotationPreviewPage /> },
  { path: 'quotations/:id/print', element: <CrmQuotationPrintPage /> },
  { path: 'quotations/:id/revisions', element: <CrmQuotationRevisionsPage /> },
  { path: 'quotation-templates', element: <CrmQuotationTemplatesPage /> },
  { path: 'quotation-templates/new', element: <CrmQuotationTemplateNewPage /> },
  { path: 'quotation-templates/:id/editor', element: <CrmQuotationTemplateEditorPage /> },
  { path: 'quotation-templates/:id/preview', element: <CrmQuotationTemplatePreviewPage /> },
  { path: 'quotation-templates/:id', element: <CrmQuotationTemplatesPage /> },
]

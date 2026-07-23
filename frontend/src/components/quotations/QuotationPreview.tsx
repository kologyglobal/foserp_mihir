import { useMemo } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowLeft, Eye, Printer, Download, Send, AlertTriangle } from 'lucide-react'
import { useCrmStore } from '../../store/crmStore'
import { useSalesStore } from '../../store/salesStore'
import { useMasterStore } from '../../store/masterStore'
import { QuotationPrintDocument } from './QuotationPrintDocument'
import { ErpButton } from '../erp/ErpButton'
import { ConvertQuotationToSOAction } from './ConvertQuotationToSOAction'
import { validateQuotationForPrint } from '../../utils/quotationEngine/validation'
import { printQuotationDocument, saveQuotationPdfToDms } from '../../utils/quotationEngine/pdfExport'
import { resolveQuotationPrintLayout } from '../../utils/quotationEngine/printLayout'
import { notify } from '../../store/toastStore'

interface QuotationPreviewProps {
  documentId: string
}

export function QuotationPreview({ documentId }: QuotationPreviewProps) {
  const navigate = useNavigate()
  const doc = useCrmStore((s) => s.getQuotationDocument(documentId))
  const opportunities = useCrmStore((s) => s.opportunities)
  const quotation = useSalesStore((s) => (doc ? s.getQuotation(doc.quotationId) : undefined))
  const customers = useMasterStore((s) => s.customers)

  const customer = useMemo(
    () => customers.find((c) => c.id === quotation?.customerId),
    [customers, quotation?.customerId],
  )
  const opportunity = doc?.opportunityId ? opportunities.find((o) => o.id === doc.opportunityId) : undefined
  const contact = doc?.contactId ? useCrmStore.getState().getContact(doc.contactId) : null
  const template = doc?.templateId ? useCrmStore.getState().getTemplate(doc.templateId) : undefined
  const printLayout = resolveQuotationPrintLayout(template)

  if (!doc || !quotation) return <p className="p-6">Preview not available.</p>

  const issues = validateQuotationForPrint(doc, customer)
  const errors = issues.filter((i) => i.severity === 'error')
  const warnings = issues.filter((i) => i.severity === 'warning')

  function handleDmsSave() {
    if (!quotation || !doc) return
    const r = saveQuotationPdfToDms({
      quotationNo: quotation.quotationNo,
      revisionNo: doc.revisionNo,
      quotationId: doc.quotationId,
      documentId: doc.id,
      customerId: quotation.customerId,
    })
    if (r.ok) notify.success('Saved to DMS')
  }

  return (
    <div className="quo-preview-shell">
      <div className="quo-preview-toolbar print:hidden">
        <Link to={`/crm/quotations/${doc.quotationId}/editor?doc=${documentId}`}>
          <ErpButton variant="secondary" size="sm" icon={ArrowLeft}>Back to editor</ErpButton>
        </Link>
        <div className="quo-preview-toolbar__actions">
          <ErpButton variant="secondary" size="sm" icon={Printer} onClick={printQuotationDocument}>Print</ErpButton>
          <ErpButton variant="secondary" size="sm" icon={Download} onClick={printQuotationDocument}>Download PDF</ErpButton>
          <ErpButton variant="secondary" size="sm" icon={Send} onClick={handleDmsSave}>Save to DMS</ErpButton>
          <ConvertQuotationToSOAction documentId={documentId} variant="card-action" />
          <ErpButton variant="primary" size="sm" icon={Eye} onClick={() => navigate(`/crm/quotations/${doc.quotationId}`)}>Quote 360</ErpButton>
        </div>
      </div>

      {(errors.length > 0 || warnings.length > 0) && (
        <div className="quo-preview-warnings print:hidden">
          <p className="quo-preview-warnings__title"><AlertTriangle className="h-4 w-4" /> Review before printing</p>
          <ul>
            {[...errors, ...warnings].map((i) => (
              <li key={i.id} className={i.severity === 'error' ? 'quo-preview-warnings__error' : ''}>{i.message}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="quo-preview-canvas">
        <QuotationPrintDocument
          doc={doc}
          quotation={quotation}
          customer={customer}
          opportunity={opportunity}
          contactName={contact?.name}
          printLayout={printLayout}
        />
      </div>
    </div>
  )
}

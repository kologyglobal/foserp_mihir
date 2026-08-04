import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { DocumentPrintShell } from '@/components/print/DocumentPrintShell'
import { getSalesInvoice } from '@/services/bridges/receivablesApiBridge'
import type { SalesInvoiceDto } from '@/types/moneyIn'
import { invoiceDisplayNumber } from '../moneyInUi'
import { notify } from '@/store/toastStore'
import { SalesInvoiceDocument } from './SalesInvoiceDocument'

export function SalesInvoicePrintPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [invoice, setInvoice] = useState<SalesInvoiceDto | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!id) return
    let cancelled = false
    ;(async () => {
      try {
        const row = await getSalesInvoice(id)
        if (!cancelled) setInvoice(row)
      } catch (e) {
        notify.error(e instanceof Error ? e.message : 'Invoice not found')
        navigate('/accounting/money-in/invoices')
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [id, navigate])

  if (loading || !invoice) {
    return <div className="erp-page p-12 text-center text-erp-muted">Loading tax invoice…</div>
  }

  const docNo = invoiceDisplayNumber(invoice)

  return (
    <DocumentPrintShell
      title={docNo}
      subtitle="Tax invoice — print-ready / Save as PDF"
      backLabel="Back to invoice"
      onBack={() => navigate(`/accounting/money-in/invoices/${invoice.id}`)}
    >
      <SalesInvoiceDocument invoice={invoice} />
    </DocumentPrintShell>
  )
}

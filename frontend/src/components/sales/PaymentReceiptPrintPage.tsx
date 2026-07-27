import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { ArrowLeft, Download, Printer } from 'lucide-react'
import { ErpButton, ErpButtonGroup } from '../erp/ErpButton'
import { PaymentReceiptDocument } from './PaymentReceiptDocument'
import { useCrmCommercialStore } from '../../store/crmCommercialStore'
import { useMasterStore } from '../../store/masterStore'
import {
  downloadPaymentReceiptPdf,
  paymentReceiptPdfFileName,
  printPaymentReceiptDocument,
} from '../../utils/paymentReceiptExport'
import { notify } from '../../store/toastStore'
import type { Customer } from '../../types/master'

function customerPartyInfo(customer: Customer | undefined) {
  if (!customer) return null
  const lines = [
    customer.addressLine1,
    customer.addressLine2,
    [customer.city, customer.state, customer.pincode].filter(Boolean).join(', '),
  ].filter(Boolean)
  return {
    address: lines.join('\n') || undefined,
    gstin: customer.gstin || undefined,
    state: customer.state || undefined,
  }
}

export function PaymentReceiptPrintPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const receipt = useCrmCommercialStore((s) => (id ? s.receipts.find((r) => r.id === id) : undefined))
  const allAllocations = useCrmCommercialStore((s) => s.allocations)
  const customer = useMasterStore((s) =>
    receipt ? s.customers.find((c) => c.id === receipt.customerId) : undefined,
  )
  const [downloading, setDownloading] = useState(false)

  const allocations = useMemo(
    () => (id ? allAllocations.filter((a) => a.receiptId === id && !a.reversedAt) : []),
    [allAllocations, id],
  )
  const party = useMemo(() => customerPartyInfo(customer), [customer])
  const fileName = receipt ? paymentReceiptPdfFileName(receipt.receiptNo) : 'PaymentReceipt.pdf'
  const detailPath = receipt ? `/sales/receipts/${receipt.id}` : '/sales/payment-allocation'

  async function handleDownloadPdf() {
    if (!receipt || downloading) return
    setDownloading(true)
    notify.info('Preparing PDF…')
    const result = await downloadPaymentReceiptPdf({
      receipt,
      allocations,
      customer: party,
    })
    setDownloading(false)
    if (result.ok) notify.success(`Downloaded ${result.fileName}`)
    else notify.error(result.error)
  }

  useEffect(() => {
    if (!receipt) return
    const autoDownload = searchParams.get('download') === '1' || searchParams.get('autodownload') === '1'
    const autoPrint = searchParams.get('autoprint') === '1'
    if (!autoDownload && !autoPrint) return

    const timer = window.setTimeout(() => {
      if (autoDownload) {
        void (async () => {
          notify.info('Preparing PDF…')
          const result = await downloadPaymentReceiptPdf({
            receipt,
            allocations,
            customer: party,
          })
          if (result.ok) notify.success(`Downloaded ${result.fileName}`)
          else notify.error(result.error)
        })()
      } else {
        printPaymentReceiptDocument({ fileName: paymentReceiptPdfFileName(receipt.receiptNo) })
      }
    }, 450)
    return () => window.clearTimeout(timer)
  }, [receipt, searchParams, allocations, party])

  if (!receipt) {
    return (
      <div className="erp-page flex flex-col items-center justify-center gap-3 p-12 text-center">
        <p className="text-erp-muted">Payment receipt not found.</p>
        <Link to="/sales/payment-allocation" className="text-sm font-semibold text-erp-primary hover:underline">
          Back to payment allocation
        </Link>
      </div>
    )
  }

  return (
    <div className="pi-print-page erp-page">
      <div className="pi-print-toolbar no-print">
        <div>
          <p className="pi-print-toolbar__title">{receipt.receiptNo}</p>
          <p className="pi-print-toolbar__subtitle">Payment receipt — professional preview &amp; print</p>
        </div>
        <ErpButtonGroup>
          <ErpButton
            type="button"
            variant="primary"
            icon={Printer}
            onClick={() => printPaymentReceiptDocument({ fileName })}
          >
            Print
          </ErpButton>
          <ErpButton
            type="button"
            variant="secondary"
            icon={Download}
            disabled={downloading}
            onClick={() => void handleDownloadPdf()}
          >
            {downloading ? 'Preparing…' : 'Download PDF'}
          </ErpButton>
          <ErpButton type="button" variant="ghost" icon={ArrowLeft} onClick={() => navigate(detailPath)}>
            Back to receipt
          </ErpButton>
        </ErpButtonGroup>
      </div>

      <div className="pi-print-stage">
        <PaymentReceiptDocument receipt={receipt} allocations={allocations} customer={party} />
      </div>
    </div>
  )
}

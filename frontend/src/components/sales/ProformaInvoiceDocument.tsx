import { formatCurrency, formatNumber } from '../../utils/formatters/currency'
import { formatDate } from '../../utils/dates/format'
import { gstSchemeLabel } from '../../utils/gstEngine'
import { amountInWords } from '../../utils/amountInWords'
import type { ProformaInvoice } from '../../types/proformaInvoice'
import {
  COMPANY_ADDRESS,
  COMPANY_GSTIN,
  COMPANY_NAME,
  COMPANY_PAN,
  COMPANY_STATE,
} from '../../types/invoice'

interface ProformaInvoiceDocumentProps {
  proforma: ProformaInvoice
  className?: string
}

export function ProformaInvoiceDocument({ proforma, className }: ProformaInvoiceDocumentProps) {
  const { gst } = proforma

  return (
    <div className={className} id="proforma-invoice-print">
      <div className="rounded-lg border border-slate-300 bg-white p-6 text-slate-900 shadow-sm print:border-0 print:shadow-none">
        <div className="mb-6 border-b border-slate-300 pb-4 text-center">
          <h1 className="text-lg font-bold uppercase tracking-wide">Proforma Invoice</h1>
          <p className="mt-1 text-xs text-slate-600">Not a tax invoice — for advance payment / customs purposes</p>
        </div>

        <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-2">
          <div>
            <p className="text-sm font-bold">{COMPANY_NAME}</p>
            <p className="mt-1 text-xs leading-relaxed text-slate-600">{COMPANY_ADDRESS}</p>
            <p className="mt-2 text-xs"><span className="font-medium">GSTIN:</span> {COMPANY_GSTIN}</p>
            <p className="text-xs"><span className="font-medium">PAN:</span> {COMPANY_PAN}</p>
            <p className="text-xs"><span className="font-medium">State:</span> {COMPANY_STATE}</p>
          </div>
          <div className="text-left md:text-right">
            <p className="font-mono text-sm font-bold">{proforma.proformaNo}</p>
            <p className="mt-2 text-xs"><span className="font-medium">Date:</span> {formatDate(proforma.proformaDate)}</p>
            <p className="text-xs"><span className="font-medium">Valid Until:</span> {formatDate(proforma.validUntil)}</p>
            {proforma.salesOrderNo ? (
              <p className="text-xs"><span className="font-medium">Sales Order:</span> {proforma.salesOrderNo}</p>
            ) : null}
          </div>
        </div>

        <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="rounded border border-slate-200 p-3">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Bill To</p>
            <p className="mt-1 text-sm font-semibold">{proforma.customerName}</p>
            <p className="mt-1 text-xs text-slate-600">{proforma.billingAddress ?? proforma.customerAddress}</p>
            <p className="mt-2 text-xs">GSTIN: {proforma.customerGstin || '—'}</p>
            <p className="text-xs">Place of Supply: {proforma.placeOfSupply}</p>
          </div>
          <div className="rounded border border-slate-200 p-3">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Ship To</p>
            <p className="mt-1 text-xs text-slate-600">{proforma.shippingAddress ?? proforma.customerAddress}</p>
            <p className="mt-3 text-xs"><span className="font-medium">Payment:</span> {proforma.paymentTerms}</p>
            <p className="text-xs"><span className="font-medium">Delivery:</span> {proforma.deliveryTerms}</p>
            {proforma.customerPoNumber ? (
              <p className="text-xs"><span className="font-medium">Customer PO:</span> {proforma.customerPoNumber}</p>
            ) : null}
          </div>
        </div>

        <table className="mb-6 w-full border-collapse text-xs">
          <thead>
            <tr className="border-b border-slate-300 bg-slate-50">
              <th className="px-2 py-2 text-left">#</th>
              <th className="px-2 py-2 text-left">Description</th>
              <th className="px-2 py-2 text-left">HSN</th>
              <th className="px-2 py-2 text-right">Qty</th>
              <th className="px-2 py-2 text-right">Rate</th>
              <th className="px-2 py-2 text-right">Taxable</th>
              <th className="px-2 py-2 text-right">GST %</th>
              <th className="px-2 py-2 text-right">Total</th>
            </tr>
          </thead>
          <tbody>
            {proforma.lines.map((line) => (
              <tr key={line.id} className="border-b border-slate-200">
                <td className="px-2 py-2">{line.lineNo}</td>
                <td className="px-2 py-2">{line.description}</td>
                <td className="px-2 py-2">{line.hsnCode || '—'}</td>
                <td className="px-2 py-2 text-right">{formatNumber(line.qty)} {line.uom}</td>
                <td className="px-2 py-2 text-right">{formatCurrency(line.unitPrice)}</td>
                <td className="px-2 py-2 text-right">{formatCurrency(line.taxableValue)}</td>
                <td className="px-2 py-2 text-right">{line.taxPct}%</td>
                <td className="px-2 py-2 text-right font-medium">{formatCurrency(line.lineTotal)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="mb-6 flex justify-end">
          <div className="w-full max-w-sm space-y-1 text-xs">
            <div className="flex justify-between"><span>Taxable Amount</span><span>{formatCurrency(gst.taxableAmount)}</span></div>
            {gst.scheme === 'cgst_sgst' ? (
              <>
                <div className="flex justify-between"><span>CGST @ {gst.cgstRate}%</span><span>{formatCurrency(gst.cgstAmount)}</span></div>
                <div className="flex justify-between"><span>SGST @ {gst.sgstRate}%</span><span>{formatCurrency(gst.sgstAmount)}</span></div>
              </>
            ) : (
              <div className="flex justify-between"><span>IGST @ {gst.igstRate}%</span><span>{formatCurrency(gst.igstAmount)}</span></div>
            )}
            <div className="flex justify-between border-t border-slate-300 pt-2 text-sm font-bold">
              <span>Grand Total</span><span>{formatCurrency(gst.grandTotal)}</span>
            </div>
            <p className="pt-2 text-[11px] text-slate-600">{gstSchemeLabel(gst.scheme)}</p>
          </div>
        </div>

        <p className="mb-4 text-xs text-slate-700">
          <span className="font-semibold">Amount in words:</span> {amountInWords(gst.grandTotal)}
        </p>

        {proforma.remarks ? (
          <p className="text-xs text-slate-600"><span className="font-semibold">Remarks:</span> {proforma.remarks}</p>
        ) : null}

        <div className="mt-8 border-t border-slate-300 pt-4 text-center text-[10px] text-slate-500">
          This is a computer-generated proforma invoice and does not require a physical signature.
        </div>
      </div>
    </div>
  )
}

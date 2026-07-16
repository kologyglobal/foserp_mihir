import { formatCurrency, formatNumber } from '../../utils/formatters/currency'
import { formatDate } from '../../utils/dates/format'
import { gstSchemeLabel } from '../../utils/gstEngine'
import { amountInWords } from '../../utils/amountInWords'
import type { SalesInvoice } from '../../types/invoice'
import {
  COMPANY_ADDRESS,
  COMPANY_GSTIN,
  COMPANY_NAME,
  COMPANY_PAN,
  COMPANY_STATE,
} from '../../types/invoice'

interface TaxInvoiceDocumentProps {
  invoice: SalesInvoice
  className?: string
}

export function TaxInvoiceDocument({ invoice, className }: TaxInvoiceDocumentProps) {
  const { gst } = invoice

  return (
    <div className={className} id="tax-invoice-print">
      <div className="rounded-lg border border-slate-300 bg-white p-6 text-slate-900 shadow-sm print:border-0 print:shadow-none">
        <div className="mb-6 border-b border-slate-300 pb-4 text-center">
          <h1 className="text-lg font-bold uppercase tracking-wide">Tax Invoice</h1>
          <p className="mt-1 text-xs text-slate-600">Original for Recipient</p>
        </div>

        <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-2">
          <div>
            <p className="text-sm font-bold">{COMPANY_NAME}</p>
            <p className="mt-1 text-xs leading-relaxed text-slate-600">{COMPANY_ADDRESS}</p>
            <p className="mt-2 text-xs">
              <span className="font-medium">GSTIN:</span> {COMPANY_GSTIN}
            </p>
            <p className="text-xs">
              <span className="font-medium">PAN:</span> {COMPANY_PAN}
            </p>
            <p className="text-xs">
              <span className="font-medium">State:</span> {COMPANY_STATE}
            </p>
          </div>
          <div className="text-left md:text-right">
            <p className="font-mono text-sm font-bold">{invoice.invoiceNo}</p>
            <p className="mt-2 text-xs">
              <span className="font-medium">Invoice Date:</span> {formatDate(invoice.invoiceDate)}
            </p>
            <p className="text-xs">
              <span className="font-medium">Due Date:</span> {formatDate(invoice.dueDate)}
            </p>
            <p className="text-xs">
              <span className="font-medium">SO:</span> {invoice.salesOrderNo}
            </p>
            <p className="text-xs">
              <span className="font-medium">Dispatch:</span> {invoice.dispatchNo}
            </p>
            {invoice.lrNo && (
              <p className="text-xs">
                <span className="font-medium">LR No:</span> {invoice.lrNo}
              </p>
            )}
            {invoice.vehicleNo && (
              <p className="text-xs">
                <span className="font-medium">Vehicle:</span> {invoice.vehicleNo}
              </p>
            )}
          </div>
        </div>

        <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="rounded border border-slate-200 p-3">
            <p className="mb-2 text-xs font-semibold uppercase text-slate-500">Bill To</p>
            <p className="text-sm font-semibold">{invoice.customerName}</p>
            {invoice.customerAddress && (
              <p className="mt-1 text-xs leading-relaxed text-slate-600">{invoice.customerAddress}</p>
            )}
            <p className="mt-2 text-xs">
              <span className="font-medium">GSTIN:</span> {invoice.customerGstin || '—'}
            </p>
            <p className="text-xs">
              <span className="font-medium">Place of Supply:</span> {invoice.placeOfSupply}
            </p>
          </div>
          <div className="rounded border border-slate-200 p-3">
            <p className="mb-2 text-xs font-semibold uppercase text-slate-500">Transport</p>
            <p className="text-xs">
              <span className="font-medium">Transporter:</span> {invoice.transporter || '—'}
            </p>
            <p className="text-xs">
              <span className="font-medium">LR Number:</span> {invoice.lrNo || '—'}
            </p>
            <p className="text-xs">
              <span className="font-medium">Vehicle No:</span> {invoice.vehicleNo || '—'}
            </p>
            <p className="mt-2 text-xs text-slate-500">{gstSchemeLabel(gst.scheme)}</p>
          </div>
        </div>

        <table className="mb-4 w-full border-collapse text-xs">
          <thead>
            <tr className="border border-slate-300 bg-slate-50">
              <th className="border border-slate-300 px-2 py-2 text-left">#</th>
              <th className="border border-slate-300 px-2 py-2 text-left">Description</th>
              <th className="border border-slate-300 px-2 py-2 text-left">HSN</th>
              <th className="border border-slate-300 px-2 py-2 text-left">Trailer No</th>
              <th className="border border-slate-300 px-2 py-2 text-left">Chassis No</th>
              <th className="border border-slate-300 px-2 py-2 text-right">Qty</th>
              <th className="border border-slate-300 px-2 py-2 text-right">Rate (₹)</th>
              <th className="border border-slate-300 px-2 py-2 text-right">Taxable (₹)</th>
              <th className="border border-slate-300 px-2 py-2 text-right">GST %</th>
            </tr>
          </thead>
          <tbody>
            {invoice.lines.map((line, idx) => (
              <tr key={line.id}>
                <td className="border border-slate-300 px-2 py-2">{idx + 1}</td>
                <td className="border border-slate-300 px-2 py-2">
                  <span className="font-mono">{line.itemCode}</span>
                  <br />
                  {line.description}
                </td>
                <td className="border border-slate-300 px-2 py-2 font-mono">{line.hsnCode}</td>
                <td className="border border-slate-300 px-2 py-2 font-mono">{line.trailerNo || '—'}</td>
                <td className="border border-slate-300 px-2 py-2 font-mono">{line.chassisNo || '—'}</td>
                <td className="border border-slate-300 px-2 py-2 text-right">{formatNumber(line.qty)}</td>
                <td className="border border-slate-300 px-2 py-2 text-right font-mono">{formatCurrency(line.unitPrice)}</td>
                <td className="border border-slate-300 px-2 py-2 text-right font-mono">{formatCurrency(line.taxableAmount)}</td>
                <td className="border border-slate-300 px-2 py-2 text-right">{line.gstRate}%</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="flex justify-end">
          <div className="w-full max-w-xs space-y-1 text-xs">
            <div className="flex justify-between">
              <span>Taxable Amount</span>
              <span className="font-mono">{formatCurrency(gst.taxableAmount)}</span>
            </div>
            {gst.scheme === 'cgst_sgst' ? (
              <>
                <div className="flex justify-between">
                  <span>CGST @ {gst.cgstRate}%</span>
                  <span className="font-mono">{formatCurrency(gst.cgstAmount)}</span>
                </div>
                <div className="flex justify-between">
                  <span>SGST @ {gst.sgstRate}%</span>
                  <span className="font-mono">{formatCurrency(gst.sgstAmount)}</span>
                </div>
              </>
            ) : (
              <div className="flex justify-between">
                <span>IGST @ {gst.igstRate}%</span>
                <span className="font-mono">{formatCurrency(gst.igstAmount)}</span>
              </div>
            )}
            <div className="flex justify-between border-t border-slate-300 pt-2 text-sm font-bold">
              <span>Grand Total</span>
              <span className="font-mono">{formatCurrency(gst.grandTotal)}</span>
            </div>
          </div>
        </div>

        <p className="mt-4 text-xs italic text-slate-600">
          Amount in words: <span className="font-medium not-italic">{amountInWords(gst.grandTotal)}</span>
        </p>

        {invoice.status === 'posted' && (
          <p className="mt-4 text-xs text-slate-500">
            Payment status: {invoice.paymentStatus} · Balance due: {formatCurrency(invoice.balanceDue)}
          </p>
        )}

        <div className="mt-8 grid grid-cols-2 gap-8 border-t border-slate-200 pt-6 text-xs">
          <div>
            <p className="font-medium">For {COMPANY_NAME}</p>
            <p className="mt-10 text-slate-500">Authorised Signatory</p>
          </div>
          <div className="text-right">
            <p className="font-medium">Receiver&apos;s Signature</p>
            <p className="mt-10 text-slate-500">Customer Stamp &amp; Sign</p>
          </div>
        </div>
      </div>
    </div>
  )
}

export function printTaxInvoice() {
  window.print()
}

import type { ProformaInvoice } from '../types/proformaInvoice'
import {
  COMPANY_ADDRESS,
  COMPANY_GSTIN,
  COMPANY_NAME,
  COMPANY_PAN,
  COMPANY_STATE,
} from '../types/invoice'
import { amountInWords } from './amountInWords'
import { formatCurrency, formatNumber } from './formatters/currency'
import { formatDate } from './dates/format'
import { gstSchemeLabel } from './gstEngine'
import { downloadTextFile } from './purchaseOrderExport'

function escapeTsv(value: string | number): string {
  const s = String(value ?? '')
  if (/[\t\n"]/.test(s)) return `"${s.replace(/"/g, '""')}"`
  return s
}

function formatStatus(status: string): string {
  return status.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}

export function exportProformaExcelTsv(proforma: ProformaInvoice): string {
  const { gst } = proforma
  const headerRows: string[][] = [
    ['Proforma Invoice', proforma.proformaNo],
    ['Date', proforma.proformaDate],
    ['Valid Until', proforma.validUntil],
    ['Status', formatStatus(proforma.status)],
    ['Customer', proforma.customerName],
    ['Customer GSTIN', proforma.customerGstin || '—'],
    ['Place of Supply', proforma.placeOfSupply],
    ['Sales Order', proforma.salesOrderNo ?? '—'],
    ['Quotation', proforma.quotationNo ?? '—'],
    ['Customer PO', proforma.customerPoNumber ?? '—'],
    ['Payment Terms', proforma.paymentTerms],
    ['Delivery Terms', proforma.deliveryTerms],
    ['Billing Address', proforma.billingAddress ?? proforma.customerAddress],
    ['Shipping Address', proforma.shippingAddress ?? proforma.customerAddress],
    ['Remarks', proforma.remarks || '—'],
    [],
    ['Line', 'Item Code', 'Description', 'HSN', 'Qty', 'UOM', 'Rate', 'Disc %', 'GST %', 'Taxable', 'GST Amt', 'Line Total'],
  ]

  const lineRows = proforma.lines.map((l) => [
    l.lineNo,
    l.itemCode,
    l.description,
    l.hsnCode,
    l.qty,
    l.uom,
    l.unitPrice,
    l.discountPct,
    l.taxPct,
    l.taxableValue,
    l.gstAmount,
    l.lineTotal,
  ])

  const taxRows: string[][] = [
    [],
    ['Taxable Amount', '', '', '', '', '', '', '', '', String(gst.taxableAmount)],
    ...(gst.scheme === 'cgst_sgst'
      ? [
          ['CGST', '', '', '', '', '', '', '', '', String(gst.cgstAmount)],
          ['SGST', '', '', '', '', '', '', '', '', String(gst.sgstAmount)],
        ]
      : [['IGST', '', '', '', '', '', '', '', '', String(gst.igstAmount)]]),
    ['Grand Total', '', '', '', '', '', '', '', '', String(gst.grandTotal)],
    ['GST Scheme', gstSchemeLabel(gst.scheme)],
    ['Amount in Words', amountInWords(gst.grandTotal)],
  ]

  return [...headerRows, ...lineRows, ...taxRows]
    .map((row) => row.map(escapeTsv).join('\t'))
    .join('\n')
}

export function downloadProformaExcel(proforma: ProformaInvoice): void {
  const tsv = exportProformaExcelTsv(proforma)
  downloadTextFile(`${proforma.proformaNo}.xls`, tsv, 'application/vnd.ms-excel')
}

const PI_PRINT_CSS = `
  * { box-sizing: border-box; }
  body { margin: 0; font-family: "Segoe UI", system-ui, sans-serif; color: #1f2937; background: #fff; }
  .pi-print-doc { max-width: 210mm; margin: 0 auto; padding: 14mm 12mm; font-size: 11px; line-height: 1.45; }
  .pi-print-header { display: flex; justify-content: space-between; gap: 16px; border-bottom: 2px solid #004e8c; padding-bottom: 12px; margin-bottom: 16px; }
  .pi-print-header__company { font-size: 16px; font-weight: 700; color: #004e8c; margin: 0 0 4px; }
  .pi-print-header__meta { text-align: right; }
  .pi-print-title { font-size: 18px; font-weight: 700; letter-spacing: 0.06em; margin: 0 0 6px; color: #111827; }
  .pi-print-subtitle { font-size: 10px; color: #6b7280; margin: 0; }
  .pi-print-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 16px; }
  .pi-print-box { border: 1px solid #d1d5db; border-radius: 6px; padding: 10px 12px; background: #f9fafb; }
  .pi-print-box__label { font-size: 9px; font-weight: 700; letter-spacing: 0.05em; text-transform: uppercase; color: #6b7280; margin: 0 0 6px; }
  .pi-print-box p { margin: 2px 0; }
  .pi-print-table { width: 100%; border-collapse: collapse; margin: 12px 0; font-size: 10.5px; }
  .pi-print-table th, .pi-print-table td { border: 1px solid #d1d5db; padding: 6px 8px; vertical-align: top; }
  .pi-print-table th { background: #f3f4f6; font-size: 9px; text-transform: uppercase; letter-spacing: 0.04em; color: #4b5563; }
  .pi-print-table .num { text-align: right; white-space: nowrap; }
  .pi-print-summary { margin-left: auto; width: min(100%, 280px); border: 1px solid #d1d5db; border-radius: 6px; overflow: hidden; }
  .pi-print-summary__row { display: flex; justify-content: space-between; gap: 12px; padding: 7px 10px; border-bottom: 1px solid #e5e7eb; }
  .pi-print-summary__row:last-child { border-bottom: 0; background: #eff6ff; font-weight: 700; }
  .pi-print-words { margin: 10px 0 16px; padding: 8px 10px; background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 6px; font-size: 10.5px; }
  .pi-print-footer { margin-top: 24px; border-top: 1px solid #d1d5db; padding-top: 10px; text-align: center; font-size: 9px; color: #6b7280; }
  @media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
`

function buildProformaPrintBodyHtml(proforma: ProformaInvoice): string {
  const { gst } = proforma
  const lineRows = proforma.lines
    .map(
      (l) => `<tr>
        <td class="num">${l.lineNo}</td>
        <td>${l.description}</td>
        <td>${l.hsnCode || '—'}</td>
        <td class="num">${formatNumber(l.qty)} ${l.uom}</td>
        <td class="num">${formatCurrency(l.unitPrice)}</td>
        <td class="num">${formatCurrency(l.taxableValue)}</td>
        <td class="num">${l.taxPct}%</td>
        <td class="num">${formatCurrency(l.lineTotal)}</td>
      </tr>`,
    )
    .join('')

  const taxSummary = gst.scheme === 'cgst_sgst'
    ? `<div class="pi-print-summary__row"><span>CGST @ ${gst.cgstRate}%</span><span>${formatCurrency(gst.cgstAmount)}</span></div>
       <div class="pi-print-summary__row"><span>SGST @ ${gst.sgstRate}%</span><span>${formatCurrency(gst.sgstAmount)}</span></div>`
    : `<div class="pi-print-summary__row"><span>IGST @ ${gst.igstRate}%</span><span>${formatCurrency(gst.igstAmount)}</span></div>`

  return `
    <article class="pi-print-doc">
      <header class="pi-print-header">
        <div>
          <h1 class="pi-print-header__company">${COMPANY_NAME}</h1>
          <p>${COMPANY_ADDRESS}</p>
          <p>GSTIN: ${COMPANY_GSTIN} · PAN: ${COMPANY_PAN} · ${COMPANY_STATE}</p>
        </div>
        <div class="pi-print-header__meta">
          <p class="pi-print-title">PROFORMA INVOICE</p>
          <p class="pi-print-subtitle">Not a tax invoice — for advance payment / customs</p>
          <p><strong>${proforma.proformaNo}</strong></p>
          <p>Date: ${formatDate(proforma.proformaDate)}</p>
          <p>Valid Until: ${formatDate(proforma.validUntil)}</p>
          <p>Status: ${formatStatus(proforma.status)}</p>
          ${proforma.salesOrderNo ? `<p>Sales Order: ${proforma.salesOrderNo}</p>` : ''}
        </div>
      </header>

      <div class="pi-print-grid">
        <section class="pi-print-box">
          <p class="pi-print-box__label">Bill To</p>
          <p><strong>${proforma.customerName}</strong></p>
          <p>${proforma.billingAddress ?? proforma.customerAddress}</p>
          <p>GSTIN: ${proforma.customerGstin || '—'}</p>
          <p>Place of Supply: ${proforma.placeOfSupply}</p>
        </section>
        <section class="pi-print-box">
          <p class="pi-print-box__label">Commercial</p>
          <p><strong>Payment:</strong> ${proforma.paymentTerms}</p>
          <p><strong>Delivery:</strong> ${proforma.deliveryTerms}</p>
          ${proforma.customerPoNumber ? `<p><strong>Customer PO:</strong> ${proforma.customerPoNumber}</p>` : ''}
          <p><strong>Ship To:</strong> ${proforma.shippingAddress ?? proforma.customerAddress}</p>
        </section>
      </div>

      <table class="pi-print-table">
        <thead>
          <tr>
            <th>#</th><th>Description</th><th>HSN</th><th class="num">Qty</th>
            <th class="num">Rate</th><th class="num">Taxable</th><th class="num">GST</th><th class="num">Total</th>
          </tr>
        </thead>
        <tbody>${lineRows}</tbody>
      </table>

      <div class="pi-print-summary">
        <div class="pi-print-summary__row"><span>Taxable Amount</span><span>${formatCurrency(gst.taxableAmount)}</span></div>
        ${taxSummary}
        <div class="pi-print-summary__row"><span>Grand Total</span><span>${formatCurrency(gst.grandTotal)}</span></div>
      </div>

      <p class="pi-print-words"><strong>Amount in words:</strong> ${amountInWords(gst.grandTotal)}</p>
      <p class="pi-print-words"><strong>GST scheme:</strong> ${gstSchemeLabel(gst.scheme)}</p>
      ${proforma.remarks ? `<p class="pi-print-words"><strong>Remarks:</strong> ${proforma.remarks}</p>` : ''}

      <div class="pi-print-footer">
        This is a computer-generated proforma invoice and does not require a physical signature.
      </div>
    </article>
  `
}

export function buildProformaPrintHtml(proforma: ProformaInvoice): string {
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${proforma.proformaNo} — Proforma Invoice</title><style>${PI_PRINT_CSS}</style></head><body>${buildProformaPrintBodyHtml(proforma)}</body></html>`
}

/** Opens a print-ready window — user can choose Save as PDF */
export function downloadProformaPdf(proforma: ProformaInvoice): void {
  const html = buildProformaPrintHtml(proforma)
  const win = window.open('', '_blank', 'noopener,noreferrer')
  if (!win) return
  win.document.open()
  win.document.write(html)
  win.document.close()
  win.focus()
  win.onload = () => {
    win.print()
  }
  setTimeout(() => win.print(), 400)
}

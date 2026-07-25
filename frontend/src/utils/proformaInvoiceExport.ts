import type { ProformaInvoice } from '../types/proformaInvoice'
import { PROFORMA_STATUS_LABELS } from '../types/proformaInvoice'
import { QUOTATION_COMPANY } from './quotationEngine/companyProfile'
import { amountInWords } from './amountInWords'
import { formatCurrency, formatNumber } from './formatters/currency'
import { formatDate } from './dates/format'
import { gstSchemeLabel } from './gstEngine'
import { downloadTextFile } from './purchaseOrderExport'
import {
  downloadElementAsPdf,
  findPrintDocumentElement,
  type DocumentPdfResult,
} from './documentPdfDownload'

function escapeHtml(value: string | number | null | undefined): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

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
  .pi-print-doc { position: relative; max-width: 210mm; margin: 0 auto; padding: 14mm 12mm; font-size: 11px; line-height: 1.45; overflow: hidden; }
  .pi-print-doc__accent { position: absolute; left: 0; right: 0; top: 0; height: 5px; background: linear-gradient(90deg, #0b3a66 0%, #1d6fb8 55%, #b45309 100%); }
  .pi-print-header { display: flex; justify-content: space-between; gap: 20px; padding-top: 10px; margin-bottom: 14px; border-bottom: 1px solid #dbe3ef; padding-bottom: 14px; }
  .pi-print-header__brand { display: flex; gap: 12px; min-width: 0; flex: 1; }
  .pi-print-header__logo-wrap { flex-shrink: 0; width: 56px; height: 56px; border-radius: 12px; border: 1px solid #dbe3ef; background: #fff; display: grid; place-items: center; overflow: hidden; }
  .pi-print-header__logo { max-width: 46px; max-height: 46px; object-fit: contain; }
  .pi-print-header__company { margin: 0 0 2px; font-size: 15px; font-weight: 800; color: #0b3a66; }
  .pi-print-header__tagline { margin: 1px 0; font-size: 10px; font-weight: 600; color: #1d6fb8; }
  .pi-print-header__address, .pi-print-header__contact, .pi-print-header__gstin { margin: 1px 0; font-size: 10px; color: #4b5563; }
  .pi-print-header__badge { flex-shrink: 0; min-width: 190px; text-align: right; padding: 10px 12px; border-radius: 12px; background: linear-gradient(160deg, #7c2d12 0%, #b45309 55%, #0b3a66 100%); color: #fff; }
  .pi-print-header__doc-type { margin: 0; font-size: 10px; font-weight: 700; letter-spacing: 0.14em; text-transform: uppercase; opacity: 0.9; }
  .pi-print-header__doc-no { margin: 4px 0 8px; font-size: 17px; font-weight: 800; }
  .pi-print-header__meta { margin: 0; display: grid; gap: 4px; }
  .pi-print-header__meta div { display: flex; justify-content: space-between; gap: 12px; font-size: 10px; }
  .pi-print-header__meta dt { opacity: 0.75; }
  .pi-print-header__meta dd { margin: 0; font-weight: 600; }
  .pi-print-banner { margin: 0 0 14px; padding: 9px 12px; border: 1px solid #fcd34d; border-radius: 10px; background: linear-gradient(90deg, #fffbeb, #fef3c7); color: #78350f; font-size: 10px; }
  .pi-print-parties { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 10px; margin-bottom: 16px; }
  .pi-print-party { border: 1px solid #dbe3ef; border-radius: 10px; padding: 10px 12px; background: #f8fafc; }
  .pi-print-party--meta { background: #f3f7fb; }
  .pi-print-party__label { margin: 0 0 6px; font-size: 9px; font-weight: 800; letter-spacing: 0.08em; text-transform: uppercase; color: #64748b; }
  .pi-print-party__name { margin: 0 0 4px; font-size: 12px; font-weight: 700; color: #0f172a; }
  .pi-print-party__line { margin: 2px 0; color: #334155; word-break: break-word; }
  .pi-print-party__line span { display: inline-block; min-width: 78px; color: #64748b; font-weight: 600; }
  .pi-print-table { width: 100%; border-collapse: collapse; margin: 4px 0 14px; font-size: 10px; }
  .pi-print-table th, .pi-print-table td { border: 1px solid #d7dde8; padding: 6px 7px; vertical-align: top; }
  .pi-print-table th { background: #0b3a66; color: #fff; font-size: 9px; font-weight: 700; letter-spacing: 0.04em; text-transform: uppercase; text-align: left; }
  .pi-print-table tbody tr:nth-child(even) { background: #f8fafc; }
  .pi-print-table .num { text-align: right; white-space: nowrap; }
  .pi-print-table__desc { display: block; font-weight: 600; color: #0f172a; }
  .pi-print-table__code { display: block; margin-top: 2px; font-size: 9px; color: #64748b; }
  .pi-print-footer-grid { display: grid; grid-template-columns: 1.4fr 0.9fr; gap: 14px; align-items: start; margin-bottom: 18px; }
  .pi-print-words__label, .pi-print-notes__title { margin: 0 0 4px; font-size: 9px; font-weight: 800; letter-spacing: 0.08em; text-transform: uppercase; color: #64748b; }
  .pi-print-words__value { margin: 0 0 12px; font-size: 11px; font-weight: 600; color: #0f172a; }
  .pi-print-bank { margin-bottom: 12px; padding: 8px 10px; border: 1px dashed #cbd5e1; border-radius: 8px; background: #f8fafc; }
  .pi-print-bank__value { margin: 0; font-size: 10px; color: #334155; }
  .pi-print-notes { margin-top: 8px; }
  .pi-print-notes p, .pi-print-notes ul { margin: 0; font-size: 10px; color: #334155; }
  .pi-print-notes ul { padding-left: 16px; }
  .pi-print-notes li { margin: 2px 0; }
  .pi-print-totals { border: 1px solid #dbe3ef; border-radius: 12px; overflow: hidden; background: #fff; }
  .pi-print-totals__row { display: flex; justify-content: space-between; gap: 12px; padding: 8px 12px; border-bottom: 1px solid #eef2f7; }
  .pi-print-totals__row:last-child { border-bottom: 0; }
  .pi-print-totals__row--grand { background: linear-gradient(90deg, #7c2d12, #b45309); color: #fff; font-size: 13px; font-weight: 800; }
  .pi-print-signatures { display: grid; grid-template-columns: repeat(3, 1fr); gap: 18px; margin: 8px 0 14px; }
  .pi-print-signatures__block p { margin: 4px 0 0; font-size: 10px; color: #475569; }
  .pi-print-signatures__role { color: #64748b !important; font-size: 9px !important; }
  .pi-print-signatures__line { border-top: 1px solid #94a3b8; margin-top: 36px; }
  .pi-print-doc__footer { display: flex; justify-content: space-between; gap: 12px; margin-top: 8px; padding-top: 10px; border-top: 1px dashed #cbd5e1; font-size: 9px; color: #64748b; }
  @media print {
    body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    .pi-print-doc { padding: 0; max-width: none; }
  }
`

function buildProformaPrintBodyHtml(proforma: ProformaInvoice): string {
  const { gst } = proforma
  const company = QUOTATION_COMPANY
  const billToRaw = proforma.billingAddress?.trim() || proforma.customerAddress || '—'
  const shipToRaw = proforma.shippingAddress?.trim() || proforma.customerAddress || billToRaw
  const billTo = escapeHtml(billToRaw)
  const shipTo = escapeHtml(shipToRaw)

  const lineRows = proforma.lines
    .map(
      (l) => `<tr>
        <td class="num">${l.lineNo}</td>
        <td>
          <span class="pi-print-table__desc">${escapeHtml(l.description)}</span>
          ${l.itemCode ? `<span class="pi-print-table__code">${escapeHtml(l.itemCode)}</span>` : ''}
        </td>
        <td>${escapeHtml(l.hsnCode || '—')}</td>
        <td class="num">${formatNumber(l.qty)}</td>
        <td>${escapeHtml(l.uom || 'Nos')}</td>
        <td class="num">${formatCurrency(l.unitPrice)}</td>
        <td class="num">${formatNumber(l.discountPct)}</td>
        <td class="num">${formatNumber(l.taxPct)}</td>
        <td class="num">${formatCurrency(l.taxableValue)}</td>
        <td class="num">${formatCurrency(l.gstAmount)}</td>
        <td class="num">${formatCurrency(l.lineTotal)}</td>
      </tr>`,
    )
    .join('')

  const taxRows =
    gst.scheme === 'cgst_sgst'
      ? `<div class="pi-print-totals__row"><span>CGST @ ${gst.cgstRate}%</span><span>${formatCurrency(gst.cgstAmount)}</span></div>
         <div class="pi-print-totals__row"><span>SGST @ ${gst.sgstRate}%</span><span>${formatCurrency(gst.sgstAmount)}</span></div>`
      : `<div class="pi-print-totals__row"><span>IGST @ ${gst.igstRate}%</span><span>${formatCurrency(gst.igstAmount)}</span></div>`

  return `
    <article class="pi-print-doc">
      <div class="pi-print-doc__accent"></div>
      <header class="pi-print-header">
        <div class="pi-print-header__brand">
          <div class="pi-print-header__logo-wrap">
            <img class="pi-print-header__logo" src="${escapeHtml(company.logoUrl)}" alt="${escapeHtml(company.brandName)}" />
          </div>
          <div>
            <h1 class="pi-print-header__company">${escapeHtml(company.legalName)}</h1>
            <p class="pi-print-header__tagline">${escapeHtml(company.tagline)}</p>
            <p class="pi-print-header__address">${escapeHtml(company.address)}</p>
            <p class="pi-print-header__contact">${escapeHtml(company.phone)} · ${escapeHtml(company.email)}${company.website ? ` · ${escapeHtml(company.website)}` : ''}</p>
            <p class="pi-print-header__gstin">GSTIN: ${escapeHtml(company.gstin)}</p>
          </div>
        </div>
        <div class="pi-print-header__badge">
          <p class="pi-print-header__doc-type">Proforma Invoice</p>
          <p class="pi-print-header__doc-no">${escapeHtml(proforma.proformaNo)}</p>
          <dl class="pi-print-header__meta">
            <div><dt>Date</dt><dd>${formatDate(proforma.proformaDate)}</dd></div>
            <div><dt>Valid until</dt><dd>${formatDate(proforma.validUntil)}</dd></div>
            <div><dt>Status</dt><dd>${escapeHtml(PROFORMA_STATUS_LABELS[proforma.status])}</dd></div>
          </dl>
        </div>
      </header>

      <div class="pi-print-banner">
        <strong>Not a tax invoice.</strong> This proforma is issued for advance payment, booking confirmation, or customs documentation only. A GST tax invoice will be raised at the time of supply.
      </div>

      <div class="pi-print-parties">
        <section class="pi-print-party">
          <p class="pi-print-party__label">Bill to</p>
          <p class="pi-print-party__name">${escapeHtml(proforma.customerName)}</p>
          <p class="pi-print-party__line">${billTo}</p>
          <p class="pi-print-party__line">GSTIN: ${escapeHtml(proforma.customerGstin || '—')}</p>
          <p class="pi-print-party__line">State: ${escapeHtml(proforma.customerState || '—')}</p>
          <p class="pi-print-party__line">Place of supply: ${escapeHtml(proforma.placeOfSupply || '—')}</p>
        </section>
        <section class="pi-print-party">
          <p class="pi-print-party__label">Ship to</p>
          <p class="pi-print-party__name">${escapeHtml(proforma.customerName)}</p>
          <p class="pi-print-party__line">${shipTo}</p>
        </section>
        <section class="pi-print-party pi-print-party--meta">
          <p class="pi-print-party__label">Commercial</p>
          <p class="pi-print-party__line"><span>Payment</span> ${escapeHtml(proforma.paymentTerms || '—')}</p>
          <p class="pi-print-party__line"><span>Delivery</span> ${escapeHtml(proforma.deliveryTerms || '—')}</p>
          <p class="pi-print-party__line"><span>Customer PO</span> ${escapeHtml(proforma.customerPoNumber || '—')}</p>
          <p class="pi-print-party__line"><span>Sales order</span> ${escapeHtml(proforma.salesOrderNo || '—')}</p>
          <p class="pi-print-party__line"><span>Quotation</span> ${escapeHtml(proforma.quotationNo || '—')}</p>
          <p class="pi-print-party__line"><span>GST</span> ${escapeHtml(gstSchemeLabel(gst.scheme))}</p>
        </section>
      </div>

      <table class="pi-print-table">
        <thead>
          <tr>
            <th class="num">#</th><th>Description</th><th>HSN</th><th class="num">Qty</th><th>UOM</th>
            <th class="num">Rate</th><th class="num">Disc %</th><th class="num">Tax %</th>
            <th class="num">Taxable</th><th class="num">GST</th><th class="num">Total</th>
          </tr>
        </thead>
        <tbody>${lineRows}</tbody>
      </table>

      <div class="pi-print-footer-grid">
        <div>
          <p class="pi-print-words__label">Amount in words</p>
          <p class="pi-print-words__value">${escapeHtml(amountInWords(gst.grandTotal))}</p>
          <div class="pi-print-bank">
            <p class="pi-print-words__label">Bank / remittance</p>
            <p class="pi-print-bank__value">${escapeHtml(company.bankDetails)}</p>
          </div>
          ${proforma.remarks ? `<div class="pi-print-notes"><p class="pi-print-notes__title">Remarks</p><p>${escapeHtml(proforma.remarks)}</p></div>` : ''}
          <div class="pi-print-notes">
            <p class="pi-print-notes__title">Terms</p>
            <ul>
              <li>Prices remain valid until ${formatDate(proforma.validUntil)}.</li>
              <li>Advance / booking amounts are non-refundable unless otherwise agreed in writing.</li>
              <li>Supply is subject to order confirmation and production schedule at works, Chhapi.</li>
            </ul>
          </div>
        </div>
        <div class="pi-print-totals">
          <div class="pi-print-totals__row"><span>Taxable amount</span><span>${formatCurrency(gst.taxableAmount)}</span></div>
          ${taxRows}
          <div class="pi-print-totals__row pi-print-totals__row--grand"><span>Grand total</span><span>${formatCurrency(gst.grandTotal)}</span></div>
        </div>
      </div>

      <div class="pi-print-signatures">
        <div class="pi-print-signatures__block"><div class="pi-print-signatures__line"></div><p>Prepared by</p></div>
        <div class="pi-print-signatures__block"><div class="pi-print-signatures__line"></div><p>Customer acceptance</p></div>
        <div class="pi-print-signatures__block">
          <div class="pi-print-signatures__line"></div>
          <p>For ${escapeHtml(company.legalName)}</p>
          <p class="pi-print-signatures__role">${escapeHtml(company.authorizedPerson)}</p>
          <p class="pi-print-signatures__role">${escapeHtml(company.designation)}</p>
        </div>
      </div>

      <footer class="pi-print-doc__footer">
        <span>${escapeHtml(company.legalName)}</span>
        <span>Computer-generated proforma · Subject to Chhapi jurisdiction</span>
      </footer>
    </article>
  `
}

export function buildProformaPrintHtml(proforma: ProformaInvoice): string {
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${escapeHtml(proforma.proformaNo)} — Proforma Invoice</title><style>${PI_PRINT_CSS}</style></head><body>${buildProformaPrintBodyHtml(proforma)}</body></html>`
}

function absoluteBrandAsset(path: string): string {
  if (/^https?:\/\//i.test(path)) return path
  try {
    return new URL(path, window.location.origin).href
  } catch {
    return path
  }
}

/** Download a real PDF matching the professional proforma letterhead. */
export async function downloadProformaPdf(proforma: ProformaInvoice): Promise<DocumentPdfResult> {
  const fileName = `${proforma.proformaNo.trim().replace(/[^\w.-]+/g, '_') || 'Proforma'}.pdf`
  const existing = findPrintDocumentElement('.pi-print-doc')
  if (existing) {
    return downloadElementAsPdf(existing, fileName)
  }

  const host = document.createElement('div')
  host.setAttribute('aria-hidden', 'true')
  host.style.cssText =
    'position:fixed;left:-12000px;top:0;width:210mm;background:#fff;pointer-events:none;z-index:-1;'
  const style = document.createElement('style')
  style.textContent = PI_PRINT_CSS
  host.appendChild(style)
  const wrap = document.createElement('div')
  wrap.innerHTML = buildProformaPrintBodyHtml(proforma).replace(
    `src="${QUOTATION_COMPANY.logoUrl}"`,
    `src="${absoluteBrandAsset(QUOTATION_COMPANY.logoUrl)}"`,
  )
  host.appendChild(wrap)
  document.body.appendChild(host)

  try {
    const el = host.querySelector('.pi-print-doc')
    if (!(el instanceof HTMLElement)) {
      return { ok: false, error: 'Could not build proforma preview for PDF export.' }
    }
    return await downloadElementAsPdf(el, fileName)
  } finally {
    host.remove()
  }
}

/** Browser print dialog (from on-page preview). */
export function printProformaDocument(options?: { fileName?: string }): void {
  const previousTitle = document.title
  if (options?.fileName?.trim()) {
    document.title = options.fileName.trim().replace(/\.pdf$/i, '')
  }
  window.requestAnimationFrame(() => {
    window.setTimeout(() => {
      try {
        window.print()
      } finally {
        window.setTimeout(() => {
          document.title = previousTitle
        }, 800)
      }
    }, 120)
  })
}

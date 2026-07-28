import type { CrmPaymentAllocation, CrmPaymentReceipt } from '../types/crmCommercial'
import { CRM_PAYMENT_MODE_LABELS } from '../types/crmCommercial'
import { getActiveCompanyProfile } from './quotationEngine/companyProfile'
import { useTenantProfileStore } from '../store/tenantProfileStore'
import { amountInWords } from './amountInWords'
import { formatCurrency } from './formatters/currency'
import { formatDate } from './dates/format'
import {
  downloadElementAsPdf,
  findPrintDocumentElement,
  type DocumentPdfResult,
} from './documentPdfDownload'
import type { PaymentReceiptPartyInfo } from '../components/sales/PaymentReceiptDocument'

function escapeHtml(value: string | number | null | undefined): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

export function paymentReceiptPdfFileName(receiptNo: string): string {
  const safe = receiptNo.trim().replace(/[^\w.-]+/g, '_') || 'PaymentReceipt'
  return `${safe}.pdf`
}

const RCPT_PRINT_CSS = `
  * { box-sizing: border-box; }
  body { margin: 0; font-family: "Segoe UI", system-ui, sans-serif; color: #1f2937; background: #fff; }
  .pi-print-doc { position: relative; max-width: 210mm; margin: 0 auto; padding: 14mm 12mm; font-size: 11px; line-height: 1.45; overflow: hidden; }
  .pi-print-doc__accent { position: absolute; left: 0; right: 0; top: 0; height: 5px; background: linear-gradient(90deg, #0b3a66 0%, #1d6fb8 55%, #b45309 100%); }
  .pi-print-header { display: flex; justify-content: space-between; gap: 20px; padding-top: 10px; margin-bottom: 14px; border-bottom: 1px solid #dbe3ef; padding-bottom: 14px; }
  .pi-print-header__brand { display: flex; align-items: center; gap: 16px; min-width: 0; flex: 1; }
  .pi-print-header__logo-wrap { flex-shrink: 0; width: 140px; height: 60px; display: flex; align-items: center; justify-content: flex-start; }
  .pi-print-header__logo { max-width: 100%; max-height: 100%; width: auto; height: auto; object-fit: contain; object-position: left center; display: block; }
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
  .pi-print-parties { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; margin-bottom: 16px; }
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

function buildReceiptPrintBodyHtml(
  receipt: CrmPaymentReceipt,
  allocations: CrmPaymentAllocation[] = [],
  customer?: PaymentReceiptPartyInfo | null,
): string {
  const company = getActiveCompanyProfile()
  const isServices = useTenantProfileStore.getState().isServices()
  const allocatedAmount = Math.max(0, receipt.amount - receipt.unallocatedAmount)
  const activeAllocations = allocations.filter((a) => !a.reversedAt)

  const allocationRows =
    activeAllocations.length > 0
      ? `<table class="pi-print-table">
          <thead>
            <tr><th class="num">#</th><th>Allocated to</th><th>Date</th><th class="num">Amount</th></tr>
          </thead>
          <tbody>
            ${activeAllocations
              .map(
                (row, index) => `<tr>
                  <td class="num">${index + 1}</td>
                  <td>
                    <span class="pi-print-table__desc">${escapeHtml(row.invoiceNo)}</span>
                    ${row.remarks ? `<span class="pi-print-table__code">${escapeHtml(row.remarks)}</span>` : ''}
                  </td>
                  <td>${formatDate(row.allocationDate)}</td>
                  <td class="num">${formatCurrency(row.amount)}</td>
                </tr>`,
              )
              .join('')}
          </tbody>
        </table>`
      : ''

  return `
    <article class="pi-print-doc rcpt-print-doc">
      <div class="pi-print-doc__accent"></div>
      <header class="pi-print-header">
        <div class="pi-print-header__brand">
          <div class="pi-print-header__logo-wrap">
            <img class="pi-print-header__logo" src="${escapeHtml(company.logoUrl)}" alt="${escapeHtml(company.brandName)}" />
          </div>
          <div>
            <h1 class="pi-print-header__company">${escapeHtml(company.legalName)}</h1>
            ${company.tagline ? `<p class="pi-print-header__tagline">${escapeHtml(company.tagline)}</p>` : ''}
            <p class="pi-print-header__address" style="white-space:pre-line">${escapeHtml(company.address)}</p>
            <p class="pi-print-header__contact">${escapeHtml([company.phone, company.email, company.website].filter(Boolean).join(' · '))}</p>
            ${company.gstin ? `<p class="pi-print-header__gstin">GSTIN: ${escapeHtml(company.gstin)}</p>` : ''}
          </div>
        </div>
        <div class="pi-print-header__badge">
          <p class="pi-print-header__doc-type">Payment Receipt</p>
          <p class="pi-print-header__doc-no">${escapeHtml(receipt.receiptNo)}</p>
          <dl class="pi-print-header__meta">
            <div><dt>Date</dt><dd>${formatDate(receipt.receiptDate)}</dd></div>
            <div><dt>Mode</dt><dd>${escapeHtml(CRM_PAYMENT_MODE_LABELS[receipt.paymentMode])}</dd></div>
          </dl>
        </div>
      </header>

      <div class="pi-print-banner">
        <strong>Acknowledgement of receipt.</strong> This document confirms payment received and is not a tax invoice. GST tax invoices remain the basis for supply and input tax credit.
      </div>

      <div class="pi-print-parties">
        <section class="pi-print-party">
          <p class="pi-print-party__label">Received from</p>
          <p class="pi-print-party__name">${escapeHtml(receipt.customerName)}</p>
          ${customer?.address ? `<p class="pi-print-party__line">${escapeHtml(customer.address)}</p>` : ''}
          <p class="pi-print-party__line">GSTIN: ${escapeHtml(customer?.gstin || '—')}</p>
          ${customer?.state ? `<p class="pi-print-party__line">State: ${escapeHtml(customer.state)}</p>` : ''}
        </section>
        <section class="pi-print-party pi-print-party--meta">
          <p class="pi-print-party__label">Payment details</p>
          <p class="pi-print-party__line"><span>Mode</span> ${escapeHtml(CRM_PAYMENT_MODE_LABELS[receipt.paymentMode])}</p>
          <p class="pi-print-party__line"><span>UTR / Ref</span> ${escapeHtml(receipt.transactionRef || '—')}</p>
          <p class="pi-print-party__line"><span>Proforma</span> ${escapeHtml(receipt.proformaNo || '—')}</p>
          <p class="pi-print-party__line"><span>Received by</span> ${escapeHtml(receipt.createdBy || '—')}</p>
        </section>
      </div>

      ${allocationRows}

      <div class="pi-print-footer-grid">
        <div>
          <p class="pi-print-words__label">Amount in words</p>
          <p class="pi-print-words__value">${escapeHtml(amountInWords(receipt.amount))}</p>
          ${receipt.remarks ? `<div class="pi-print-notes"><p class="pi-print-notes__title">Remarks</p><p>${escapeHtml(receipt.remarks)}</p></div>` : ''}
          <div class="pi-print-notes">
            <p class="pi-print-notes__title">Note</p>
            <ul>
              <li>Unallocated balance may be applied to future tax invoices for the same customer.</li>
              <li>Please quote the receipt number in all payment-related correspondence.</li>
            </ul>
          </div>
        </div>
        <div class="pi-print-totals">
          <div class="pi-print-totals__row"><span>Amount received</span><span>${formatCurrency(receipt.amount)}</span></div>
          <div class="pi-print-totals__row"><span>Allocated</span><span>${formatCurrency(allocatedAmount)}</span></div>
          <div class="pi-print-totals__row pi-print-totals__row--grand"><span>Unallocated</span><span>${formatCurrency(receipt.unallocatedAmount)}</span></div>
        </div>
      </div>

      <div class="pi-print-signatures">
        <div class="pi-print-signatures__block"><div class="pi-print-signatures__line"></div><p>Received by</p></div>
        <div class="pi-print-signatures__block"><div class="pi-print-signatures__line"></div><p>Customer acknowledgement</p></div>
        <div class="pi-print-signatures__block">
          <div class="pi-print-signatures__line"></div>
          <p>For ${escapeHtml(company.legalName)}</p>
          <p class="pi-print-signatures__role">${escapeHtml(company.authorizedPerson)}</p>
          <p class="pi-print-signatures__role">${escapeHtml(company.designation)}</p>
        </div>
      </div>

      <footer class="pi-print-doc__footer">
        <span>${escapeHtml(company.legalName)}</span>
        <span>Computer-generated payment receipt${!isServices ? ' · Subject to Chhapi jurisdiction' : ''}</span>
      </footer>
    </article>
  `
}

function absoluteBrandAsset(path: string): string {
  if (/^https?:\/\//i.test(path)) return path
  try {
    return new URL(path, window.location.origin).href
  } catch {
    return path
  }
}

/** Download a real PDF matching the professional payment receipt letterhead. */
export async function downloadPaymentReceiptPdf(options: {
  receipt: CrmPaymentReceipt
  allocations?: CrmPaymentAllocation[]
  customer?: PaymentReceiptPartyInfo | null
}): Promise<DocumentPdfResult> {
  const { receipt, allocations = [], customer } = options
  const fileName = paymentReceiptPdfFileName(receipt.receiptNo)
  const existing = findPrintDocumentElement(['.rcpt-print-doc', '#payment-receipt-print'])
  if (existing) {
    return downloadElementAsPdf(existing, fileName)
  }

  const host = document.createElement('div')
  host.setAttribute('aria-hidden', 'true')
  host.style.cssText =
    'position:fixed;left:-12000px;top:0;width:210mm;background:#fff;pointer-events:none;z-index:-1;'
  const style = document.createElement('style')
  style.textContent = RCPT_PRINT_CSS
  host.appendChild(style)
  const logoUrl = getActiveCompanyProfile().logoUrl
  const wrap = document.createElement('div')
  wrap.innerHTML = buildReceiptPrintBodyHtml(receipt, allocations, customer).replace(
    `src="${logoUrl}"`,
    `src="${absoluteBrandAsset(logoUrl)}"`,
  )
  host.appendChild(wrap)
  document.body.appendChild(host)

  try {
    const el = host.querySelector('.rcpt-print-doc')
    if (!(el instanceof HTMLElement)) {
      return { ok: false, error: 'Could not build receipt preview for PDF export.' }
    }
    return await downloadElementAsPdf(el, fileName)
  } finally {
    host.remove()
  }
}

/** Browser print dialog (from on-page preview). */
export function printPaymentReceiptDocument(options?: { fileName?: string }): void {
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

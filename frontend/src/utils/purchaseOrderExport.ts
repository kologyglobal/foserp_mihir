import type { PurchaseOrder, PurchaseRequisition, RequestForQuotation } from '../types/purchase'
import type { Item, Vendor, Warehouse } from '../types/master'
import {
  COMPANY_ADDRESS,
  COMPANY_GSTIN,
  COMPANY_NAME,
  COMPANY_PAN,
  COMPANY_STATE,
} from '../types/invoice'
import { amountInWordsINR } from './quotationEngine/amountInWords'
import { formatCurrency, formatNumber } from './formatters/currency'
import { formatDate } from './dates/format'
function formatDocStatus(status: string): string {
  return status.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}

export type PoPrintLine = {
  lineNo: number
  itemCode: string
  itemName: string
  hsnCode: string
  warehouse: string
  qty: number
  uom: string
  rate: number
  amount: number
  requiredDate: string
}

export type PoPrintContext = {
  po: PurchaseOrder
  vendor?: Vendor
  sourcePrNo?: string
  sourceRfqNo?: string
  lines: PoPrintLine[]
  subtotal: number
  gstEstimate: number
  grandTotal: number
  amountWords: string
}

export function buildPoPrintContext(input: {
  po: PurchaseOrder
  vendor?: Vendor
  sourcePrNo?: string
  sourceRfqNo?: string
  getItem: (id: string) => Item | undefined
  getWarehouse: (id: string) => Warehouse | undefined
  getUomCode?: (itemId: string) => string
}): PoPrintContext {
  const { po, vendor, sourcePrNo, sourceRfqNo, getItem, getWarehouse, getUomCode } = input
  const lines: PoPrintLine[] = po.lines.map((l, i) => {
    const item = getItem(l.itemId)
    return {
      lineNo: i + 1,
      itemCode: item?.itemCode ?? '—',
      itemName: item?.itemName ?? '—',
      hsnCode: item?.hsnCode ?? '—',
      warehouse: getWarehouse(l.warehouseId)?.warehouseName ?? '—',
      qty: l.qty,
      uom: getUomCode?.(l.itemId) ?? 'Nos',
      rate: l.rate,
      amount: l.qty * l.rate,
      requiredDate: l.requiredDate,
    }
  })
  const subtotal = lines.reduce((s, l) => s + l.amount, 0)
  const gstEstimate = Math.round(subtotal * 0.18 * 100) / 100
  const grandTotal = subtotal + gstEstimate
  return {
    po,
    vendor,
    sourcePrNo,
    sourceRfqNo,
    lines,
    subtotal,
    gstEstimate,
    grandTotal,
    amountWords: amountInWordsINR(grandTotal),
  }
}

function escapeTsv(value: string | number): string {
  const s = String(value ?? '')
  if (/[\t\n"]/.test(s)) return `"${s.replace(/"/g, '""')}"`
  return s
}

export function exportPoExcelTsv(ctx: PoPrintContext): string {
  const { po, vendor, lines, subtotal, gstEstimate, grandTotal } = ctx
  const headerRows: string[][] = [
    ['Purchase Order', po.poNo],
    ['Revision', String(po.revisionNo)],
    ['Order Date', po.orderDate],
    ['Expected Delivery', po.expectedDate],
    ['Status', formatDocStatus(po.status)],
    ['Vendor', vendor?.vendorName ?? '—'],
    ['Vendor Code', vendor?.vendorCode ?? '—'],
    ['Vendor GSTIN', vendor?.gstin ?? '—'],
    ['Payment Terms', po.paymentTerms || 'Net 30'],
    ['PR Reference', ctx.sourcePrNo ?? '—'],
    ['RFQ Reference', ctx.sourceRfqNo ?? '—'],
    ['Created By', po.createdByName],
    ['Approved By', po.approvedByName ?? '—'],
    [],
    ['Line', 'Item Code', 'Description', 'HSN', 'Warehouse', 'Qty', 'UOM', 'Rate', 'Amount', 'Required Date'],
  ]
  const lineRows = lines.map((l) => [
    l.lineNo,
    l.itemCode,
    l.itemName,
    l.hsnCode,
    l.warehouse,
    l.qty,
    l.uom,
    l.rate,
    l.amount,
    l.requiredDate,
  ])
  const footerRows: string[][] = [
    [],
    ['Subtotal', '', '', '', '', '', '', '', String(subtotal)],
    ['GST (18% est.)', '', '', '', '', '', '', '', String(gstEstimate)],
    ['Grand Total', '', '', '', '', '', '', '', String(grandTotal)],
  ]
  return [...headerRows, ...lineRows, ...footerRows]
    .map((row) => row.map(escapeTsv).join('\t'))
    .join('\n')
}

export function downloadTextFile(fileName: string, content: string, mimeType: string): void {
  const blob = new Blob(['\uFEFF', content], { type: `${mimeType};charset=utf-8` })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = fileName
  link.click()
  URL.revokeObjectURL(url)
}

export function downloadPoExcel(ctx: PoPrintContext): void {
  const tsv = exportPoExcelTsv(ctx)
  downloadTextFile(`${ctx.po.poNo}.xls`, tsv, 'application/vnd.ms-excel')
}

const PO_PRINT_CSS = `
  * { box-sizing: border-box; }
  body { margin: 0; font-family: "Segoe UI", system-ui, sans-serif; color: #1f2937; background: #fff; }
  .po-print-doc { max-width: 210mm; margin: 0 auto; padding: 14mm 12mm; font-size: 11px; line-height: 1.45; }
  .po-print-header { display: flex; justify-content: space-between; gap: 16px; border-bottom: 2px solid #004e8c; padding-bottom: 12px; margin-bottom: 16px; }
  .po-print-header__company { font-size: 16px; font-weight: 700; color: #004e8c; margin: 0 0 4px; }
  .po-print-header__meta { text-align: right; }
  .po-print-title { font-size: 18px; font-weight: 700; letter-spacing: 0.06em; margin: 0 0 6px; color: #111827; }
  .po-print-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 16px; }
  .po-print-box { border: 1px solid #d1d5db; border-radius: 6px; padding: 10px 12px; background: #f9fafb; }
  .po-print-box__label { font-size: 9px; font-weight: 700; letter-spacing: 0.05em; text-transform: uppercase; color: #6b7280; margin: 0 0 6px; }
  .po-print-box p { margin: 2px 0; }
  .po-print-table { width: 100%; border-collapse: collapse; margin: 12px 0; font-size: 10.5px; }
  .po-print-table th, .po-print-table td { border: 1px solid #d1d5db; padding: 6px 8px; vertical-align: top; }
  .po-print-table th { background: #f3f4f6; font-size: 9px; text-transform: uppercase; letter-spacing: 0.04em; color: #4b5563; }
  .po-print-table .num { text-align: right; white-space: nowrap; }
  .po-print-table .mono { font-family: ui-monospace, monospace; }
  .po-print-summary { margin-left: auto; width: min(100%, 280px); border: 1px solid #d1d5db; border-radius: 6px; overflow: hidden; }
  .po-print-summary__row { display: flex; justify-content: space-between; gap: 12px; padding: 7px 10px; border-bottom: 1px solid #e5e7eb; }
  .po-print-summary__row:last-child { border-bottom: 0; background: #eff6ff; font-weight: 700; }
  .po-print-words { margin: 10px 0 16px; padding: 8px 10px; background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 6px; font-size: 10.5px; }
  .po-print-terms { margin-top: 16px; font-size: 10px; color: #4b5563; }
  .po-print-signatures { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 24px; margin-top: 28px; }
  .po-print-signatures__line { border-top: 1px solid #9ca3af; padding-top: 6px; font-size: 10px; color: #6b7280; }
  @media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
`

function buildPoPrintBodyHtml(ctx: PoPrintContext): string {
  const { po, vendor, lines, subtotal, gstEstimate, grandTotal, amountWords } = ctx
  const lineRows = lines
    .map(
      (l) => `<tr>
        <td class="num">${l.lineNo}</td>
        <td class="mono">${l.itemCode}</td>
        <td>${l.itemName}</td>
        <td>${l.hsnCode}</td>
        <td>${l.warehouse}</td>
        <td class="num">${formatNumber(l.qty)}</td>
        <td>${l.uom}</td>
        <td class="num">${formatCurrency(l.rate)}</td>
        <td class="num">${formatCurrency(l.amount)}</td>
        <td>${formatDate(l.requiredDate)}</td>
      </tr>`,
    )
    .join('')

  return `
    <article class="po-print-doc">
      <header class="po-print-header">
        <div>
          <h1 class="po-print-header__company">${COMPANY_NAME}</h1>
          <p>${COMPANY_ADDRESS}</p>
          <p>GSTIN: ${COMPANY_GSTIN} · PAN: ${COMPANY_PAN} · ${COMPANY_STATE}</p>
        </div>
        <div class="po-print-header__meta">
          <p class="po-print-title">PURCHASE ORDER</p>
          <p><strong>${po.poNo}</strong> · Rev ${po.revisionNo}</p>
          <p>Date: ${formatDate(po.orderDate)}</p>
          <p>Expected: ${formatDate(po.expectedDate)}</p>
          <p>Status: ${formatDocStatus(po.status)}</p>
        </div>
      </header>

      <div class="po-print-grid">
        <section class="po-print-box">
          <p class="po-print-box__label">Vendor</p>
          <p><strong>${vendor?.vendorName ?? '—'}</strong></p>
          <p>Code: ${vendor?.vendorCode ?? '—'}</p>
          <p>GSTIN: ${vendor?.gstin || '—'}</p>
          <p>${vendor?.city ?? ''}${vendor?.state ? `, ${vendor.state}` : ''}</p>
          <p>Contact: ${vendor?.contactPerson ?? '—'} · ${vendor?.contactPhone ?? '—'}</p>
        </section>
        <section class="po-print-box">
          <p class="po-print-box__label">Order details</p>
          <p>Payment: ${po.paymentTerms || 'Net 30'}</p>
          <p>Currency: INR</p>
          <p>Incoterms: Ex-Works</p>
          <p>PR Ref: ${ctx.sourcePrNo ?? '—'}</p>
          <p>RFQ Ref: ${ctx.sourceRfqNo ?? '—'}</p>
          <p>Created by: ${po.createdByName}</p>
          <p>Approved by: ${po.approvedByName ?? '—'}</p>
        </section>
      </div>

      <table class="po-print-table">
        <thead>
          <tr>
            <th>#</th><th>Item</th><th>Description</th><th>HSN</th><th>Warehouse</th>
            <th class="num">Qty</th><th>UOM</th><th class="num">Rate</th><th class="num">Amount</th><th>Required</th>
          </tr>
        </thead>
        <tbody>${lineRows}</tbody>
      </table>

      <div class="po-print-summary">
        <div class="po-print-summary__row"><span>Subtotal</span><span>${formatCurrency(subtotal)}</span></div>
        <div class="po-print-summary__row"><span>GST (18% est.)</span><span>${formatCurrency(gstEstimate)}</span></div>
        <div class="po-print-summary__row"><span>Grand Total</span><span>${formatCurrency(grandTotal)}</span></div>
      </div>

      <p class="po-print-words"><strong>Amount in words:</strong> ${amountWords}</p>

      <div class="po-print-terms">
        <p><strong>Terms &amp; conditions</strong></p>
        <ol>
          <li>Delivery as per agreed schedule. Partial shipments require prior approval.</li>
          <li>Invoice must reference this PO number and match approved rates.</li>
          <li>Material must pass incoming QC where applicable before acceptance.</li>
          <li>All disputes subject to Pune jurisdiction.</li>
        </ol>
      </div>

      <div class="po-print-signatures">
        <div class="po-print-signatures__line">Prepared by</div>
        <div class="po-print-signatures__line">Approved by</div>
        <div class="po-print-signatures__line">Vendor acknowledgement</div>
      </div>
    </article>
  `
}

export function buildPoPrintHtml(ctx: PoPrintContext): string {
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${ctx.po.poNo} — Purchase Order</title><style>${PO_PRINT_CSS}</style></head><body>${buildPoPrintBodyHtml(ctx)}</body></html>`
}

/** Opens a print-ready window — user can choose Save as PDF */
export function downloadPoPdf(ctx: PoPrintContext): void {
  const html = buildPoPrintHtml(ctx)
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

export function exportPurchaseOrderListTsv(
  orders: PurchaseOrder[],
  ctx: {
    getVendor: (id: string) => Vendor | undefined
    prById: Map<string, PurchaseRequisition>
    rfqById: Map<string, RequestForQuotation>
  },
): string {
  const header = [
    'PO No.',
    'Revision',
    'Status',
    'Vendor',
    'Vendor No.',
    'Order Date',
    'Expected Receipt',
    'PR No.',
    'RFQ No.',
    'Lines',
    'Amount',
    'Received %',
    'Open Qty',
    'Source',
    'Payment Terms',
    'Created By',
    'Approved By',
    'Sent Date',
  ]
  const rows = orders.map((po) => {
    const vendor = ctx.getVendor(po.vendorId)
    const pr = po.prId ? ctx.prById.get(po.prId) : undefined
    const rfq = po.rfqId ? ctx.rfqById.get(po.rfqId) : undefined
    const ordered = po.lines.reduce((s, l) => s + l.qty, 0)
    const received = po.lines.reduce((s, l) => s + l.receivedQty, 0)
    const openQty = po.lines.reduce((s, l) => s + Math.max(0, l.qty - l.receivedQty), 0)
    const amount = po.lines.reduce((s, l) => s + l.qty * l.rate, 0)
    const receivedPct = ordered > 0 ? Math.round((received / ordered) * 100) : 0
    const source = po.rfqId ? 'From RFQ' : po.prId ? 'From PR' : 'Manual'
    return [
      po.poNo,
      String(po.revisionNo),
      formatDocStatus(po.status),
      vendor?.vendorName ?? '',
      vendor?.vendorCode ?? '',
      po.orderDate,
      po.expectedDate,
      pr?.prNo ?? '',
      rfq?.rfqNo ?? '',
      String(po.lines.length),
      String(amount),
      String(receivedPct),
      String(openQty),
      source,
      po.paymentTerms || 'Net 30',
      po.createdByName,
      po.approvedByName ?? '',
      po.sentAt ? po.sentAt.slice(0, 10) : '',
    ]
  })
  return [header, ...rows].map((row) => row.map(escapeTsv).join('\t')).join('\n')
}

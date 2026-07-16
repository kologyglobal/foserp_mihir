/**
 * Shared ledger workspace helpers (filters, sort, download, print window).
 */

import type { LedgerEntry, LedgerEntryFilter } from '@/types/ledgerEntries'
import { resolveLedgerDateRange } from '@/utils/accounting/indianFinancialYear'

export type LedgerWorkspaceSortKey =
  | 'entryNumber'
  | 'postingDate'
  | 'voucherNumber'
  | 'voucherType'
  | 'accountCode'
  | 'accountName'
  | 'party'
  | 'debit'
  | 'credit'
  | 'runningBalance'
  | 'status'
  | 'costCentre'
  | 'department'
  | 'project'
  | string

export function applyDateRangeToFilter(filter: LedgerEntryFilter): LedgerEntryFilter {
  const range = resolveLedgerDateRange(
    filter.dateQuickRange,
    filter.postingDateFrom || undefined,
    filter.postingDateTo || undefined,
  )
  if (filter.dateQuickRange === 'custom') {
    return {
      ...filter,
      postingDateFrom: filter.postingDateFrom || range.from,
      postingDateTo: filter.postingDateTo || range.to,
    }
  }
  return {
    ...filter,
    postingDateFrom: range.from,
    postingDateTo: range.to,
  }
}

export function periodLabelFromFilter(filter: LedgerEntryFilter): string {
  return resolveLedgerDateRange(
    filter.dateQuickRange,
    filter.postingDateFrom || undefined,
    filter.postingDateTo || undefined,
  ).label
}

export function sortLedgerRows(
  rows: LedgerEntry[],
  sortKey: LedgerWorkspaceSortKey,
  sortDir: 'asc' | 'desc',
): LedgerEntry[] {
  const dir = sortDir === 'asc' ? 1 : -1
  return [...rows].sort((a, b) => {
    let cmp = 0
    switch (sortKey) {
      case 'entryNumber':
        cmp = a.entryNumber.localeCompare(b.entryNumber)
        break
      case 'postingDate':
        cmp = a.postingDate.localeCompare(b.postingDate) || a.entryNumber.localeCompare(b.entryNumber)
        break
      case 'voucherNumber':
        cmp = a.voucherNumber.localeCompare(b.voucherNumber)
        break
      case 'voucherType':
        cmp = a.voucherType.localeCompare(b.voucherType)
        break
      case 'accountCode':
        cmp = a.account.code.localeCompare(b.account.code, undefined, { numeric: true })
        break
      case 'accountName':
        cmp = a.account.name.localeCompare(b.account.name)
        break
      case 'party':
        cmp = (a.party?.partyName ?? '').localeCompare(b.party?.partyName ?? '')
        break
      case 'debit':
        cmp = a.debit - b.debit
        break
      case 'credit':
        cmp = a.credit - b.credit
        break
      case 'runningBalance':
        cmp = a.runningBalance - b.runningBalance
        break
      case 'status':
        cmp = a.status.localeCompare(b.status)
        break
      case 'costCentre':
        cmp = (a.dimensions.costCentreCode ?? '').localeCompare(b.dimensions.costCentreCode ?? '')
        break
      default:
        cmp = 0
    }
    return cmp * dir
  })
}

export function downloadTextFile(fileName: string, content: string, mime: string) {
  const blob = new Blob([content], { type: mime })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = fileName
  a.click()
  URL.revokeObjectURL(url)
}

export function openPrintWindow(title: string, bodyHtml: string) {
  const win = window.open('', '_blank', 'noopener,noreferrer,width=960,height=720')
  if (!win) return false
  win.document.write(`<!doctype html><html><head><title>${title}</title>
    <style>
      body{font-family:Segoe UI,system-ui,sans-serif;font-size:12px;color:#111;margin:24px}
      h1{font-size:16px;margin:0 0 4px} .meta{color:#555;margin-bottom:16px}
      table{width:100%;border-collapse:collapse} th,td{border:1px solid #ddd;padding:4px 6px;text-align:left}
      th{background:#f5f5f5} .num{text-align:right;font-variant-numeric:tabular-nums}
      footer{margin-top:24px;font-size:10px;color:#666;border-top:1px solid #ddd;padding-top:8px}
      @media print{button{display:none}}
    </style></head><body>
    ${bodyHtml}
    <footer>Confidential — internal use only · Demo print preview · Page 1</footer>
    <button onclick="window.print()">Print</button>
    </body></html>`)
  win.document.close()
  return true
}

export function buildLedgerPrintHtml(opts: {
  companyName: string
  reportName: string
  periodLabel: string
  filtersLabel: string
  generatedBy: string
  generatedAt: string
  rows: LedgerEntry[]
  formatCurrency: (n: number) => string
}): string {
  const rows = opts.rows
    .slice(0, 200)
    .map(
      (r) => `<tr>
      <td>${r.entryNumber}</td>
      <td>${r.postingDate}</td>
      <td>${r.voucherNumber}</td>
      <td>${r.account.code} ${r.account.name}</td>
      <td class="num">${r.debit ? opts.formatCurrency(r.debit) : ''}</td>
      <td class="num">${r.credit ? opts.formatCurrency(r.credit) : ''}</td>
      <td>${r.status}</td>
    </tr>`,
    )
    .join('')
  return `<h1>${opts.companyName}</h1>
    <h1>${opts.reportName}</h1>
    <div class="meta">
      <div>${opts.periodLabel}</div>
      <div>${opts.filtersLabel}</div>
      <div>Generated by ${opts.generatedBy} · ${opts.generatedAt}</div>
      <div>Frontend demo print — not a statutory report.</div>
    </div>
    <table>
      <thead><tr><th>Entry</th><th>Date</th><th>Voucher</th><th>Account</th><th>Debit</th><th>Credit</th><th>Status</th></tr></thead>
      <tbody>${rows || '<tr><td colspan="7">No rows</td></tr>'}</tbody>
    </table>`
}

export const DATE_QUICK_OPTIONS: { value: LedgerEntryFilter['dateQuickRange']; label: string }[] = [
  { value: 'today', label: 'Today' },
  { value: 'this_week', label: 'This Week' },
  { value: 'this_month', label: 'This Month' },
  { value: 'previous_month', label: 'Previous Month' },
  { value: 'this_quarter', label: 'This Quarter' },
  { value: 'this_financial_year', label: 'This Financial Year' },
  { value: 'custom', label: 'Custom Range' },
]

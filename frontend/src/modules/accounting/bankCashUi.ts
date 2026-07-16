export function downloadTextFile(filename: string, content: string, mime = 'text/csv') {
  const blob = new Blob([content], { type: mime })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

export type LoadState = 'loading' | 'ready' | 'error' | 'empty'

export const BANK_CASH_BREADCRUMB = [
  { label: 'Accounting', to: '/accounting' },
  { label: 'Bank & Cash', to: '/accounting/bank-cash' },
] as const

export function amountTone(value: number): string {
  if (value < 0) return 'text-rose-700'
  if (value > 0) return 'text-emerald-700'
  return 'text-erp-text'
}

export async function exportBankCashReport(reportName: string): Promise<string> {
  const { exportBankCashData } = await import('@/services/accounting/bankCashService')
  const result = await exportBankCashData({
    reportName,
    format: 'csv',
    filter: {},
    includeAudit: false,
  })
  return `${result.fileName} generated (${result.rowCount} rows, demo export).`
}

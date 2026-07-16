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

export const FIXED_ASSETS_BREADCRUMB = [
  { label: 'Accounting', to: '/accounting' },
  { label: 'Fixed Assets', to: '/accounting/fixed-assets' },
] as const

export function amountTone(value: number): string {
  if (value < 0) return 'text-rose-700'
  if (value > 0) return 'text-emerald-700'
  return 'text-erp-text'
}

export async function exportFixedAssetsReport(reportName: string): Promise<string> {
  const { exportFixedAssetsData } = await import('@/services/accounting/fixedAssetsService')
  const result = await exportFixedAssetsData({
    reportName,
    format: 'csv',
    filter: {},
    includeAudit: false,
  })
  return `${result.fileName} generated (${result.rowCount} rows, demo export).`
}

export function rowsToCsv(rows: Array<Record<string, string | number | null>>): string {
  if (rows.length === 0) return ''
  const headers = Object.keys(rows[0])
  const escape = (v: string | number | null) => {
    const s = v == null ? '' : String(v)
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
  }
  const lines = [headers.join(','), ...rows.map((r) => headers.map((h) => escape(r[h])).join(','))]
  return lines.join('\n')
}

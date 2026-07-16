import type { CodeFormatSegment, CodeSeries, CodeSeriesContext } from '../types/codeSeriesMaster'

export function getFinancialYear(date = new Date()): string {
  const month = date.getMonth() + 1
  const year = date.getFullYear()
  return month >= 4 ? String(year) : String(year - 1)
}

export function getCalendarYear(date = new Date()): string {
  return String(date.getFullYear())
}

export function getMonthToken(date = new Date()): string {
  return String(date.getMonth() + 1).padStart(2, '0')
}

export function formatYearToken(yearFormat: CodeSeries['yearFormat'], date = new Date()): string {
  const fy = getFinancialYear(date)
  return yearFormat === 'YY' ? fy.slice(-2) : fy
}

export function buildRunningToken(n: number, length: number): string {
  return String(n).padStart(length, '0')
}

export function buildCodeFromSeries(
  series: CodeSeries,
  runningNumber: number,
  context: CodeSeriesContext = {},
  date = new Date(),
): string {
  const parts: string[] = []
  const sep = series.separator || '-'
  const yearToken = context.financialYear ?? formatYearToken(series.yearFormat, date)
  const monthToken = context.month ?? getMonthToken(date)

  for (const segment of series.formatSegments) {
    switch (segment) {
      case 'prefix':
        if (series.prefix) parts.push(series.prefix)
        break
      case 'separator':
        if (parts.length > 0 && parts[parts.length - 1] !== sep) parts.push(sep)
        break
      case 'financial_year':
        if (series.financialYearRequired) parts.push(yearToken)
        break
      case 'month':
        if (series.monthRequired) parts.push(monthToken)
        break
      case 'branch':
        if (series.branchRequired && context.branchCode) parts.push(context.branchCode)
        break
      case 'department':
        if (series.departmentRequired && context.departmentCode) parts.push(context.departmentCode)
        break
      case 'location':
        if (series.locationRequired && context.locationCode) parts.push(context.locationCode)
        break
      case 'running_number':
        parts.push(buildRunningToken(runningNumber, series.runningNumberLength))
        break
      case 'suffix':
        if (series.suffix) parts.push(series.suffix)
        break
      default:
        break
    }
  }

  let code = parts.join('')
  code = code.replace(new RegExp(`${escapeRegExp(sep)}+`, 'g'), sep)
  code = code.replace(new RegExp(`^${escapeRegExp(sep)}|${escapeRegExp(sep)}$`, 'g'), '')
  return code
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

export function defaultFormatSegments(series: Pick<CodeSeries, 'financialYearRequired' | 'monthRequired' | 'branchRequired'>): CodeFormatSegment[] {
  const segments: CodeFormatSegment[] = ['prefix', 'separator']
  if (series.branchRequired) {
    segments.push('branch', 'separator')
  }
  if (series.financialYearRequired) {
    segments.push('financial_year', 'separator')
  }
  if (series.monthRequired) {
    segments.push('month', 'separator')
  }
  segments.push('running_number')
  return segments
}

export function previewFormat(series: CodeSeries, context: CodeSeriesContext = {}): string {
  const next = Math.max(series.currentNumber, series.startingNumber - 1) + series.incrementBy
  return buildCodeFromSeries(series, next, context)
}

export function parseRunningNumberFromCode(code: string, series: CodeSeries): number | null {
  const match = code.match(new RegExp(`(\\d{${series.runningNumberLength}})(?!\\d)`))
  if (!match) return null
  const n = parseInt(match[1], 10)
  return Number.isNaN(n) ? null : n
}

import { prisma } from '../../../../config/database.js'
import { formatForPersistence } from '../../shared/finance-decimal.js'
import { PayableReconciliationRunNotFoundError } from './payable-reconciliation.errors.js'

function csvEscape(value: unknown): string {
  const str = value == null ? '' : String(value)
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`
  }
  return str
}

function toCsvBlock(title: string, headers: string[], rows: string[][]): string {
  const lines = [title, headers.join(','), ...rows.map((r) => r.map(csvEscape).join(','))]
  return lines.join('\n')
}

/** Simple CSV export (summary + account results + exceptions) — no XLSX infra in this phase. */
export async function exportReconciliationRunCsv(tenantId: string, runId: string): Promise<string> {
  const run = await prisma.payableReconciliationRun.findFirst({ where: { id: runId, tenantId } })
  if (!run) throw new PayableReconciliationRunNotFoundError()

  const [accounts, exceptions] = await Promise.all([
    prisma.payableReconciliationAccountResult.findMany({ where: { runId, tenantId }, orderBy: { accountCode: 'asc' } }),
    prisma.payableReconciliationException.findMany({ where: { runId, tenantId }, orderBy: [{ severity: 'asc' }, { createdAt: 'asc' }] }),
  ])

  const summaryBlock = toCsvBlock(
    'SUMMARY',
    ['Run Id', 'As Of Date', 'Source Mode', 'Status', 'Base Currency', 'Tolerance', 'GL Total', 'Subledger Total', 'Variance', 'Control Accounts', 'Matched', 'Mismatched', 'Exceptions', 'Vendors', 'Vendor Mismatches'],
    [[
      run.id,
      run.asOfDate.toISOString().slice(0, 10),
      run.sourceMode,
      run.status ?? run.runStatus,
      run.baseCurrency,
      formatForPersistence(run.tolerance),
      formatForPersistence(run.glTotal),
      formatForPersistence(run.subledgerTotal),
      formatForPersistence(run.variance),
      String(run.controlAccountCount),
      String(run.matchedAccountCount),
      String(run.mismatchedAccountCount),
      String(run.exceptionCount),
      String(run.vendorCount),
      String(run.vendorMismatchCount),
    ]],
  )

  const accountsBlock = toCsvBlock(
    'ACCOUNTS',
    ['Account Code', 'Account Name', 'GL Balance', 'Subledger Balance', 'Variance', 'Matched', 'Open Item Count'],
    accounts.map((a) => [
      a.accountCode ?? '',
      a.accountName ?? '',
      formatForPersistence(a.glBalance),
      formatForPersistence(a.subledgerBalance),
      formatForPersistence(a.variance),
      a.matched ? 'YES' : 'NO',
      String(a.openItemCount),
    ]),
  )

  const exceptionsBlock = toCsvBlock(
    'EXCEPTIONS',
    ['Severity', 'Category', 'Code', 'Message', 'Account Id', 'Vendor Id', 'Open Item Id', 'Voucher Id', 'Acknowledged'],
    exceptions.map((e) => [
      e.severity,
      e.category,
      e.code,
      e.message,
      e.accountId ?? '',
      e.vendorId ?? '',
      e.openItemId ?? '',
      e.voucherId ?? '',
      e.isAcknowledged ? 'YES' : 'NO',
    ]),
  )

  return [summaryBlock, '', accountsBlock, '', exceptionsBlock].join('\n')
}

import { prisma } from '../../../../config/database.js'
import { PayableCloseGateRunNotFoundError } from './payable-reconciliation.errors.js'

function csvEscape(value: unknown): string {
  const str = value == null ? '' : String(value)
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`
  }
  return str
}

function toCsvBlock(title: string, headers: string[], rows: string[][]): string {
  return [title, headers.join(','), ...rows.map((r) => r.map(csvEscape).join(','))].join('\n')
}

export async function exportCloseGateRunCsv(tenantId: string, runId: string): Promise<string> {
  const run = await prisma.payableCloseGateRun.findFirst({ where: { id: runId, tenantId } })
  if (!run) throw new PayableCloseGateRunNotFoundError()

  const checks = await prisma.payableCloseGateCheck.findMany({ where: { runId, tenantId }, orderBy: { createdAt: 'asc' } })

  const summaryBlock = toCsvBlock(
    'SUMMARY',
    ['Run Id', 'Period Id', 'As Of Date', 'Status', 'Checks Total', 'Passed', 'Warning', 'Blocked', 'Failed', 'Reconciliation Run Id'],
    [[
      run.id,
      run.periodId,
      run.asOfDate.toISOString().slice(0, 10),
      run.status,
      String(run.checksTotal),
      String(run.checksPassed),
      String(run.checksWarning),
      String(run.checksBlocked),
      String(run.checksFailed),
      run.reconciliationRunId ?? '',
    ]],
  )

  const checksBlock = toCsvBlock(
    'CHECKS',
    ['Check Code', 'Check Name', 'Status', 'Message'],
    checks.map((c) => [c.checkCode, c.checkName, c.status, c.message]),
  )

  return [summaryBlock, '', checksBlock].join('\n')
}

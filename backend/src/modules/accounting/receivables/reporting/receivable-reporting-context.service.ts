import { prisma } from '../../../../config/database.js'
import { getLegalEntityOrThrow } from '../../shared/finance.helpers.js'
import { compareDateOnly, getTodayInTimezone } from './receivable-ageing.service.js'
import {
  ReceivableReportDateInFutureError,
} from './receivable-reporting.errors.js'
import type { ReceivableReportingContext } from './receivable-reporting.types.js'

export async function resolveReceivableReportingContext(
  tenantId: string,
  legalEntityId: string,
  reportDateInput?: string,
): Promise<ReceivableReportingContext> {
  await getLegalEntityOrThrow(tenantId, legalEntityId)
  const tenant = await prisma.tenant.findFirstOrThrow({
    where: { id: tenantId },
    select: { timezone: true },
  })
  const timezone = tenant.timezone || 'Asia/Kolkata'
  const today = getTodayInTimezone(timezone)
  const reportDate = reportDateInput ?? today
  const limitations: string[] = []

  if (compareDateOnly(reportDate, today) > 0) {
    throw new ReceivableReportDateInFutureError(reportDate, today)
  }
  if (compareDateOnly(reportDate, today) < 0) {
    limitations.push('AGEING_USES_CURRENT_BALANCES')
  }

  return {
    tenantId,
    legalEntityId,
    reportDate,
    today,
    timezone,
    limitations,
  }
}

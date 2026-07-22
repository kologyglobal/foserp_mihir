import { prisma } from '../../../../config/database.js'
import { getLegalEntityOrThrow } from '../../shared/finance.helpers.js'
import { compareDateOnly, getTodayInTimezone } from './payable-ageing.service.js'
import { PayableReportDateInFutureError } from './payable-reporting.errors.js'
import type { PayableReportingContext } from './payable-reporting.types.js'

export async function resolvePayableReportingContext(
  tenantId: string,
  legalEntityId: string,
  reportDateInput?: string,
): Promise<PayableReportingContext> {
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
    throw new PayableReportDateInFutureError(reportDate, today)
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

import type { BudgetLine, BudgetVersion } from '@prisma/client'
import type { MonthlyAmountsInput } from './budgeting.schemas.js'

const FY_MONTHS = ['Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec', 'Jan', 'Feb', 'Mar'] as const

export type FyMonthKey = (typeof FY_MONTHS)[number]

export function emptyMonths(): Record<FyMonthKey, string> {
  return Object.fromEntries(FY_MONTHS.map((m) => [m, '0'])) as Record<FyMonthKey, string>
}

export function monthsFromLine(line: BudgetLine): Record<FyMonthKey, string> {
  return {
    Apr: line.amountApr.toFixed(4),
    May: line.amountMay.toFixed(4),
    Jun: line.amountJun.toFixed(4),
    Jul: line.amountJul.toFixed(4),
    Aug: line.amountAug.toFixed(4),
    Sep: line.amountSep.toFixed(4),
    Oct: line.amountOct.toFixed(4),
    Nov: line.amountNov.toFixed(4),
    Dec: line.amountDec.toFixed(4),
    Jan: line.amountJan.toFixed(4),
    Feb: line.amountFeb.toFixed(4),
    Mar: line.amountMar.toFixed(4),
  }
}

export function lineAmountFields(months: MonthlyAmountsInput) {
  return {
    amountApr: months.Apr,
    amountMay: months.May,
    amountJun: months.Jun,
    amountJul: months.Jul,
    amountAug: months.Aug,
    amountSep: months.Sep,
    amountOct: months.Oct,
    amountNov: months.Nov,
    amountDec: months.Dec,
    amountJan: months.Jan,
    amountFeb: months.Feb,
    amountMar: months.Mar,
  }
}

export function sumMonths(months: Record<FyMonthKey, string>): string {
  let total = 0
  for (const m of FY_MONTHS) total += Number(months[m] || 0)
  return total.toFixed(4)
}

export function toBudgetVersionDto(row: BudgetVersion) {
  return {
    id: row.id,
    tenantId: row.tenantId,
    legalEntityId: row.legalEntityId,
    code: row.code,
    name: row.name,
    kind: row.kind,
    status: row.status,
    financialYearLabel: row.financialYearLabel,
    fyStartDate: row.fyStartDate.toISOString().slice(0, 10),
    fyEndDate: row.fyEndDate.toISOString().slice(0, 10),
    currencyCode: row.currencyCode,
    notes: row.notes,
    isPrimary: row.isPrimary,
    submittedAt: row.submittedAt?.toISOString() ?? null,
    submittedBy: row.submittedBy,
    approvedAt: row.approvedAt?.toISOString() ?? null,
    approvedBy: row.approvedBy,
    lockedAt: row.lockedAt?.toISOString() ?? null,
    lockedBy: row.lockedBy,
    createdBy: row.createdBy,
    updatedBy: row.updatedBy,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }
}

export function toBudgetLineDto(
  row: BudgetLine,
  account?: { accountCode: string; accountName: string } | null,
) {
  const months = monthsFromLine(row)
  return {
    id: row.id,
    tenantId: row.tenantId,
    versionId: row.versionId,
    accountId: row.accountId,
    accountCode: account?.accountCode ?? null,
    accountName: account?.accountName ?? null,
    costCentreId: row.costCentreId,
    months,
    total: sumMonths(months),
    notes: row.notes,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }
}

export { FY_MONTHS }

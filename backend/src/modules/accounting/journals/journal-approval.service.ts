import { prisma } from '../../../config/database.js'
import { compare, toDecimal } from '../shared/finance-decimal.js'
import type { JournalApprovalInfo, JournalApprovalLevel } from './journal.types.js'

export async function resolveJournalApproval(
  tenantId: string,
  legalEntityId: string,
  totalDebit: string,
  totalCredit: string,
): Promise<JournalApprovalInfo> {
  const debit = toDecimal(totalDebit)
  const credit = toDecimal(totalCredit)
  const amount = compare(debit, credit) >= 0 ? debit : credit
  const amountStr = amount.toFixed(4)

  const rules = await prisma.financeApprovalRule.findMany({
    where: {
      tenantId,
      legalEntityId,
      documentType: 'JOURNAL',
      isActive: true,
    },
    orderBy: [{ approvalLevel: 'asc' }, { amountFrom: 'asc' }],
  })

  const matched = rules.filter((rule) => {
    const from = toDecimal(rule.amountFrom)
    const to = rule.amountTo != null ? toDecimal(rule.amountTo) : null
    if (compare(amount, from) < 0) return false
    if (to != null && compare(amount, to) > 0) return false
    return true
  })

  const levels: JournalApprovalLevel[] = []
  const seenLevels = new Set<number>()
  for (const rule of matched) {
    if (seenLevels.has(rule.approvalLevel)) continue
    seenLevels.add(rule.approvalLevel)
    levels.push({
      level: rule.approvalLevel,
      ruleId: rule.id,
      ruleName: rule.ruleName,
      approverRoleId: rule.approverRoleId,
      approverUserId: rule.approverUserId,
    })
  }

  if (levels.length > 0) {
    const first = levels[0]!
    return {
      required: true,
      canSubmit: true,
      amount: amountStr,
      levels,
      totalLevels: levels.length,
      matchedRuleId: first.ruleId,
      matchedRuleName: first.ruleName,
      approvalLevel: first.level,
    }
  }

  const settings = await prisma.financeSettings.findFirst({ where: { tenantId, legalEntityId } })
  const limit = settings?.journalApprovalLimit != null ? toDecimal(settings.journalApprovalLimit) : null

  if (limit != null && compare(amount, limit) > 0) {
    return {
      required: true,
      canSubmit: false,
      amount: amountStr,
      levels: [],
      totalLevels: 0,
      journalApprovalLimit: limit.toFixed(4),
      blockReason: `Journal amount ${amountStr} exceeds the approval limit (${limit.toFixed(4)}) and no matching approval rule is configured`,
    }
  }

  return {
    required: false,
    canSubmit: true,
    amount: amountStr,
    levels: [],
    totalLevels: 0,
    journalApprovalLimit: limit?.toFixed(4) ?? null,
  }
}

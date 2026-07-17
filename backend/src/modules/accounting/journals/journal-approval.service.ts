import { prisma } from '../../../config/database.js'
import { compare, toDecimal } from '../shared/finance-decimal.js'
import type { JournalApprovalInfo } from './journal.types.js'

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

  if (matched.length > 0) {
    const rule = matched[0]!
    return {
      required: true,
      canSubmit: true,
      amount: amountStr,
      matchedRuleId: rule.id,
      matchedRuleName: rule.ruleName,
      approvalLevel: rule.approvalLevel,
    }
  }

  const settings = await prisma.financeSettings.findFirst({ where: { tenantId, legalEntityId } })
  const limit = settings?.journalApprovalLimit != null ? toDecimal(settings.journalApprovalLimit) : null

  if (limit != null && compare(amount, limit) > 0) {
    return {
      required: true,
      canSubmit: false,
      amount: amountStr,
      journalApprovalLimit: limit.toFixed(4),
      blockReason: `Journal amount ${amountStr} exceeds the approval limit (${limit.toFixed(4)}) and no matching approval rule is configured`,
    }
  }

  return {
    required: false,
    canSubmit: true,
    amount: amountStr,
    journalApprovalLimit: limit?.toFixed(4) ?? null,
  }
}

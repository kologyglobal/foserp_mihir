import type { BankPostingRule, BankStatementLine } from '@prisma/client'
import * as repo from './bank-posting-rule.repository.js'
import { BankPostingRuleAmbiguousError, BankPostingRuleNoMatchError } from './bank-posting-rule.errors.js'
import type { LineTemplateInput } from './bank-posting-rule.schemas.js'

export interface RuleScore {
  rule: BankPostingRule
  score: number
  matchedKeywords: string[]
}

function scoreRule(rule: BankPostingRule, line: BankStatementLine): RuleScore | null {
  if (rule.direction && rule.direction !== line.direction) return null
  const amount = Number(line.amount)
  if (rule.minAmount != null && amount < Number(rule.minAmount)) return null
  if (rule.maxAmount != null && amount > Number(rule.maxAmount)) return null

  const haystack = `${line.description ?? ''} ${line.normalizedDescription ?? ''}`.toLowerCase()
  const keywords = Array.isArray(rule.keywordPatterns) ? (rule.keywordPatterns as unknown[]).map((k) => String(k).toLowerCase()) : []
  const matchedKeywords = keywords.filter((k) => k.length > 0 && haystack.includes(k))
  if (matchedKeywords.length === 0) return null

  return { rule, score: matchedKeywords.length, matchedKeywords }
}

/** Deterministic keyword/rule scorer — no AI/ML. Highest keyword-hit count wins; ties on score AND priority are ambiguous. */
export function scoreRulesForLine(rules: BankPostingRule[], line: BankStatementLine): RuleScore[] {
  return rules
    .map((rule) => scoreRule(rule, line))
    .filter((r): r is RuleScore => r !== null)
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score
      return a.rule.priority - b.rule.priority
    })
}

export interface ClassificationResult {
  rule: BankPostingRule
  matchedKeywords: string[]
  adjustmentType: string
  lineTemplate: LineTemplateInput
  candidates: RuleScore[]
}

export async function classifyStatementLine(
  tenantId: string,
  legalEntityId: string,
  treasuryAccountId: string,
  line: BankStatementLine,
): Promise<ClassificationResult> {
  const rules = await repo.listActiveRulesForAccount(tenantId, legalEntityId, treasuryAccountId)
  const scored = scoreRulesForLine(rules, line)

  if (scored.length === 0) throw new BankPostingRuleNoMatchError()

  const top = scored[0]
  const contenders = scored.filter((s) => s.score === top.score && s.rule.priority === top.rule.priority)
  if (contenders.length > 1) {
    throw new BankPostingRuleAmbiguousError(
      `${contenders.length} posting rules matched with the same score and priority — refine keywords or priority to disambiguate`,
      contenders.map((c) => ({ field: 'ruleId', message: `${c.rule.name} (${c.rule.id})` })),
    )
  }

  await repo.recordMatch(tenantId, top.rule.id)

  return {
    rule: top.rule,
    matchedKeywords: top.matchedKeywords,
    adjustmentType: top.rule.adjustmentType,
    lineTemplate: top.rule.lineTemplateJson as unknown as LineTemplateInput,
    candidates: scored,
  }
}

import { Prisma, type BankPostingRule } from '@prisma/client'
import { prisma } from '../../../../../config/database.js'
import { getPagination } from '../../../../../utils/pagination.js'
import { BankPostingRuleNotFoundError } from './bank-posting-rule.errors.js'
import type { CreateBankPostingRuleInput, ListBankPostingRulesQuery, UpdateBankPostingRuleInput } from './bank-posting-rule.schemas.js'

export async function findRuleByIdOrThrow(tenantId: string, id: string): Promise<BankPostingRule> {
  const rule = await prisma.bankPostingRule.findFirst({ where: { id, tenantId } })
  if (!rule) throw new BankPostingRuleNotFoundError()
  return rule
}

export async function createRule(tenantId: string, input: CreateBankPostingRuleInput, userId?: string | null): Promise<BankPostingRule> {
  return prisma.bankPostingRule.create({
    data: {
      tenantId,
      legalEntityId: input.legalEntityId,
      treasuryAccountId: input.treasuryAccountId ?? null,
      name: input.name,
      description: input.description ?? null,
      isActive: input.isActive,
      priority: input.priority,
      direction: input.direction ?? null,
      keywordPatterns: input.keywordPatterns as unknown as Prisma.InputJsonValue,
      minAmount: input.minAmount != null ? new Prisma.Decimal(input.minAmount) : null,
      maxAmount: input.maxAmount != null ? new Prisma.Decimal(input.maxAmount) : null,
      adjustmentType: input.adjustmentType,
      lineTemplateJson: input.lineTemplate as unknown as Prisma.InputJsonValue,
      createdById: userId ?? null,
      updatedById: userId ?? null,
    },
  })
}

export async function updateRule(tenantId: string, id: string, input: UpdateBankPostingRuleInput, userId?: string | null): Promise<BankPostingRule> {
  const existing = await findRuleByIdOrThrow(tenantId, id)
  if (existing.updatedAt.getTime() !== new Date(input.expectedUpdatedAt).getTime()) {
    throw new Error('BANK_POSTING_RULE_STALE_VERSION')
  }
  return prisma.bankPostingRule.update({
    where: { id, tenantId },
    data: {
      legalEntityId: input.legalEntityId,
      treasuryAccountId: input.treasuryAccountId ?? null,
      name: input.name,
      description: input.description ?? null,
      isActive: input.isActive,
      priority: input.priority,
      direction: input.direction ?? null,
      keywordPatterns: input.keywordPatterns as unknown as Prisma.InputJsonValue,
      minAmount: input.minAmount != null ? new Prisma.Decimal(input.minAmount) : null,
      maxAmount: input.maxAmount != null ? new Prisma.Decimal(input.maxAmount) : null,
      adjustmentType: input.adjustmentType,
      lineTemplateJson: input.lineTemplate as unknown as Prisma.InputJsonValue,
      updatedById: userId ?? null,
    },
  })
}

export async function listRules(tenantId: string, query: ListBankPostingRulesQuery): Promise<{ items: BankPostingRule[]; total: number; page: number; limit: number }> {
  const { skip, take, page } = getPagination(query)
  const where: Prisma.BankPostingRuleWhereInput = {
    tenantId,
    legalEntityId: query.legalEntityId,
    ...(query.isActive != null ? { isActive: query.isActive } : {}),
    ...(query.treasuryAccountId ? { treasuryAccountId: query.treasuryAccountId } : {}),
  }
  const [items, total] = await Promise.all([
    prisma.bankPostingRule.findMany({ where, skip, take, orderBy: [{ priority: 'asc' }, { createdAt: query.sortOrder }] }),
    prisma.bankPostingRule.count({ where }),
  ])
  return { items, total, page, limit: query.limit }
}

export async function listActiveRulesForAccount(tenantId: string, legalEntityId: string, treasuryAccountId: string): Promise<BankPostingRule[]> {
  return prisma.bankPostingRule.findMany({
    where: {
      tenantId,
      legalEntityId,
      isActive: true,
      OR: [{ treasuryAccountId }, { treasuryAccountId: null }],
    },
    orderBy: { priority: 'asc' },
  })
}

export async function deactivateRule(tenantId: string, id: string, userId?: string | null): Promise<BankPostingRule> {
  await findRuleByIdOrThrow(tenantId, id)
  return prisma.bankPostingRule.update({ where: { id, tenantId }, data: { isActive: false, updatedById: userId ?? null } })
}

export async function recordMatch(tenantId: string, id: string): Promise<void> {
  await prisma.bankPostingRule.update({ where: { id, tenantId }, data: { matchCount: { increment: 1 }, lastMatchedAt: new Date() } })
}

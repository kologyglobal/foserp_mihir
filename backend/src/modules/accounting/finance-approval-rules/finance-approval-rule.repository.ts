import { Prisma } from '@prisma/client'
import { prisma } from '../../../config/database.js'
import { getPagination } from '../../../utils/pagination.js'
import { NotFoundError } from '../../../utils/errors.js'
import { getLegalEntityOrThrow } from '../shared/finance.helpers.js'
import type { CreateApprovalRuleInput, ListApprovalRulesQuery, UpdateApprovalRuleInput } from './finance-approval-rule.validation.js'

export async function listApprovalRules(tenantId: string, query: ListApprovalRulesQuery) {
  if (!query.legalEntityId) throw new NotFoundError('legalEntityId query parameter is required')
  await getLegalEntityOrThrow(tenantId, query.legalEntityId)
  const { skip, take } = getPagination(query)
  const where: Prisma.FinanceApprovalRuleWhereInput = {
    tenantId,
    legalEntityId: query.legalEntityId,
    ...(query.documentType ? { documentType: query.documentType } : {}),
    ...(query.isActive !== undefined ? { isActive: query.isActive } : {}),
  }
  const [items, total] = await Promise.all([
    prisma.financeApprovalRule.findMany({ where, skip, take, orderBy: { approvalLevel: 'asc' } }),
    prisma.financeApprovalRule.count({ where }),
  ])
  return { items, total, page: query.page, limit: query.limit }
}

export async function getApprovalRule(tenantId: string, id: string) {
  const item = await prisma.financeApprovalRule.findFirst({ where: { id, tenantId } })
  if (!item) throw new NotFoundError('Approval rule not found')
  return item
}

export async function createApprovalRule(tenantId: string, userId: string, input: CreateApprovalRuleInput) {
  await getLegalEntityOrThrow(tenantId, input.legalEntityId)
  return prisma.financeApprovalRule.create({
    data: {
      tenantId,
      legalEntityId: input.legalEntityId,
      documentType: input.documentType,
      ruleName: input.ruleName,
      amountFrom: input.amountFrom,
      amountTo: input.amountTo ?? null,
      conditionJson: (input.conditionJson ?? undefined) as Prisma.InputJsonValue | undefined,
      approverRoleId: input.approverRoleId ?? null,
      approverUserId: input.approverUserId ?? null,
      approvalLevel: input.approvalLevel,
      isActive: input.isActive,
      createdBy: userId,
      updatedBy: userId,
    },
  })
}

export async function updateApprovalRule(tenantId: string, id: string, userId: string, input: UpdateApprovalRuleInput) {
  await getApprovalRule(tenantId, id)
  const data: Prisma.FinanceApprovalRuleUpdateInput = {
    documentType: input.documentType,
    ruleName: input.ruleName,
    amountFrom: input.amountFrom,
    amountTo: input.amountTo ?? undefined,
    conditionJson: input.conditionJson as Prisma.InputJsonValue | undefined,
    approverRoleId: input.approverRoleId ?? undefined,
    approverUserId: input.approverUserId ?? undefined,
    approvalLevel: input.approvalLevel,
    isActive: input.isActive,
    updatedBy: userId,
  }
  return prisma.financeApprovalRule.update({
    where: { id, tenantId },
    data,
  })
}

export async function deleteApprovalRule(tenantId: string, id: string) {
  await getApprovalRule(tenantId, id)
  return prisma.financeApprovalRule.delete({ where: { id, tenantId } })
}

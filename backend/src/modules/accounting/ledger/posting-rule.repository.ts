import type { PostingRule, Prisma } from '@prisma/client'
import { prisma } from '../../../config/database.js'
import { getPagination } from '../../../utils/pagination.js'
import { InvalidStateError, NotFoundError } from '../../../utils/errors.js'
import { getLegalEntityOrThrow, parseDateOnly } from '../shared/finance.helpers.js'
import type { CreatePostingRuleInput, ListPostingRulesQuery, UpdatePostingRuleInput } from './ledger.schemas.js'

function mapConditions(conditions?: CreatePostingRuleInput['conditions']) {
  return conditions ? (conditions as Prisma.InputJsonValue) : undefined
}

function mapLineDefinitions(lineDefinitions: CreatePostingRuleInput['lineDefinitions']) {
  return lineDefinitions as Prisma.InputJsonValue
}

export async function listPostingRules(tenantId: string, query: ListPostingRulesQuery) {
  await getLegalEntityOrThrow(tenantId, query.legalEntityId)
  const { skip, take } = getPagination(query)
  const where: Prisma.PostingRuleWhereInput = {
    tenantId,
    legalEntityId: query.legalEntityId,
    ...(query.eventType ? { eventType: query.eventType } : {}),
    ...(query.isActive !== undefined ? { isActive: query.isActive } : {}),
  }
  const [items, total] = await Promise.all([
    prisma.postingRule.findMany({ where, skip, take, orderBy: [{ priority: 'asc' }, { ruleCode: 'asc' }] }),
    prisma.postingRule.count({ where }),
  ])
  return { items, total, page: query.page, limit: query.limit }
}

export async function findPostingRuleById(tenantId: string, id: string): Promise<PostingRule> {
  const item = await prisma.postingRule.findFirst({ where: { id, tenantId } })
  if (!item) throw new NotFoundError('Posting rule not found')
  return item
}

export async function createPostingRule(
  tenantId: string,
  userId: string,
  input: CreatePostingRuleInput,
): Promise<PostingRule> {
  await getLegalEntityOrThrow(tenantId, input.legalEntityId)
  return prisma.postingRule.create({
    data: {
      tenantId,
      legalEntityId: input.legalEntityId,
      ruleCode: input.ruleCode,
      ruleName: input.ruleName,
      eventType: input.eventType,
      version: input.version ?? 1,
      priority: input.priority ?? 100,
      effectiveFrom: parseDateOnly(input.effectiveFrom),
      effectiveTo: input.effectiveTo ? parseDateOnly(input.effectiveTo) : null,
      conditionsJson: mapConditions(input.conditions),
      lineDefinitionsJson: mapLineDefinitions(input.lineDefinitions),
      isSystemRule: input.isSystemRule ?? false,
      isActive: true,
      createdBy: userId,
      updatedBy: userId,
    },
  })
}

export async function updatePostingRule(
  tenantId: string,
  id: string,
  userId: string,
  input: UpdatePostingRuleInput,
): Promise<PostingRule> {
  const existing = await findPostingRuleById(tenantId, id)
  if (existing.isSystemRule && input.isSystemRule === false) {
    throw new InvalidStateError('System posting rules cannot be demoted')
  }
  const data: Prisma.PostingRuleUpdateInput = {
    ...(input.ruleCode !== undefined ? { ruleCode: input.ruleCode } : {}),
    ...(input.ruleName !== undefined ? { ruleName: input.ruleName } : {}),
    ...(input.eventType !== undefined ? { eventType: input.eventType } : {}),
    ...(input.version !== undefined ? { version: input.version } : {}),
    ...(input.priority !== undefined ? { priority: input.priority } : {}),
    ...(input.effectiveFrom !== undefined ? { effectiveFrom: parseDateOnly(input.effectiveFrom) } : {}),
    ...(input.effectiveTo !== undefined ? { effectiveTo: input.effectiveTo ? parseDateOnly(input.effectiveTo) : null } : {}),
    ...(input.conditions !== undefined ? { conditionsJson: mapConditions(input.conditions) } : {}),
    ...(input.lineDefinitions !== undefined ? { lineDefinitionsJson: mapLineDefinitions(input.lineDefinitions) } : {}),
    updatedBy: userId,
  }
  return prisma.postingRule.update({ where: { id, tenantId }, data })
}

export async function activatePostingRule(tenantId: string, id: string, userId: string): Promise<PostingRule> {
  await findPostingRuleById(tenantId, id)
  return prisma.postingRule.update({
    where: { id, tenantId },
    data: { isActive: true, updatedBy: userId },
  })
}

export async function deactivatePostingRule(tenantId: string, id: string, userId: string): Promise<PostingRule> {
  const existing = await findPostingRuleById(tenantId, id)
  if (existing.isSystemRule) {
    throw new InvalidStateError('System posting rules cannot be hard-deleted; deactivate only')
  }
  return prisma.postingRule.update({
    where: { id, tenantId },
    data: { isActive: false, updatedBy: userId },
  })
}

/** System rules cannot be hard-deleted — no delete method provided. */

export async function createPostingRuleVersion(
  tenantId: string,
  userId: string,
  sourceId: string,
  input: UpdatePostingRuleInput,
): Promise<PostingRule> {
  const source = await findPostingRuleById(tenantId, sourceId)
  const nextVersion = (input.version ?? source.version) + 1
  return prisma.postingRule.create({
    data: {
      tenantId,
      legalEntityId: source.legalEntityId,
      ruleCode: input.ruleCode ?? source.ruleCode,
      ruleName: input.ruleName ?? source.ruleName,
      eventType: input.eventType ?? source.eventType,
      version: nextVersion,
      priority: input.priority ?? source.priority,
      effectiveFrom: parseDateOnly(input.effectiveFrom ?? source.effectiveFrom.toISOString().slice(0, 10)),
      effectiveTo: input.effectiveTo
        ? parseDateOnly(input.effectiveTo)
        : source.effectiveTo,
      conditionsJson: input.conditions
        ? mapConditions(input.conditions)
        : (source.conditionsJson as Prisma.InputJsonValue | undefined),
      lineDefinitionsJson: input.lineDefinitions
        ? mapLineDefinitions(input.lineDefinitions)
        : (source.lineDefinitionsJson as Prisma.InputJsonValue),
      isSystemRule: source.isSystemRule,
      isActive: true,
      createdBy: userId,
      updatedBy: userId,
    },
  })
}

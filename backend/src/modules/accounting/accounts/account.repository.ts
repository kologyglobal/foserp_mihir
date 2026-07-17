import type { Account } from '@prisma/client'
import { Prisma } from '@prisma/client'
import { prisma } from '../../../config/database.js'
import { getPagination } from '../../../utils/pagination.js'
import { ConflictError, InvalidStateError, NotFoundError, ValidationError } from '../../../utils/errors.js'
import { flattenCoaTemplate } from '../shared/account-templates.js'
import { MAX_ACCOUNT_DEPTH } from '../shared/finance.constants.js'
import {
  assertAccountDepth,
  assertNoCircularParent,
  getLegalEntityOrThrow,
} from '../shared/finance.helpers.js'
import type { AccountTreeQuery, ApplyTemplateInput, CreateAccountInput, ListAccountsQuery, UpdateAccountInput } from './account.validation.js'

async function loadAccountParent(id: string) {
  return prisma.account.findUnique({
    where: { id },
    select: { id: true, parentAccountId: true, level: true, category: true, isGroup: true, legalEntityId: true },
  })
}

async function validateParent(tenantId: string, legalEntityId: string, parentAccountId: string | null | undefined, category: string, selfId?: string) {
  if (!parentAccountId) return { level: 1, parent: null as Account | null }
  const parent = await prisma.account.findFirst({
    where: { id: parentAccountId, tenantId, legalEntityId },
  })
  if (!parent) throw new ValidationError('Parent account not found in legal entity')
  if (!parent.isGroup) throw new ValidationError('Parent must be a group account')
  if (parent.category !== category) throw new ValidationError('Parent and child categories must be compatible')
  await assertNoCircularParent(selfId ?? 'new', parentAccountId, loadAccountParent, 'parentAccountId')
  const level = assertAccountDepth(parent.level, MAX_ACCOUNT_DEPTH)
  return { level, parent }
}

export async function listAccounts(tenantId: string, query: ListAccountsQuery) {
  if (!query.legalEntityId) throw new NotFoundError('legalEntityId query parameter is required')
  await getLegalEntityOrThrow(tenantId, query.legalEntityId)
  const { skip, take } = getPagination(query)
  const where: Prisma.AccountWhereInput = {
    tenantId,
    legalEntityId: query.legalEntityId,
    ...(query.category ? { category: query.category } : {}),
    ...(query.isActive !== undefined ? { isActive: query.isActive } : {}),
  }
  if (query.search) {
    where.OR = [{ accountCode: { contains: query.search } }, { accountName: { contains: query.search } }]
  }
  const [items, total] = await Promise.all([
    prisma.account.findMany({ where, skip, take, orderBy: { accountCode: 'asc' } }),
    prisma.account.count({ where }),
  ])
  return { items, total, page: query.page, limit: query.limit }
}

export async function getAccountTree(tenantId: string, query: AccountTreeQuery) {
  if (!query.legalEntityId) throw new NotFoundError('legalEntityId query parameter is required')
  await getLegalEntityOrThrow(tenantId, query.legalEntityId)
  const accounts = await prisma.account.findMany({
    where: {
      tenantId,
      legalEntityId: query.legalEntityId,
      ...(query.includeInactive ? {} : { isActive: true }),
    },
    orderBy: { accountCode: 'asc' },
  })
  const byParent = new Map<string | null, Account[]>()
  for (const acc of accounts) {
    const key = acc.parentAccountId ?? null
    const list = byParent.get(key) ?? []
    list.push(acc)
    byParent.set(key, list)
  }
  function build(parentId: string | null): Array<Account & { children: ReturnType<typeof build> }> {
    return (byParent.get(parentId) ?? []).map((acc) => ({ ...acc, children: build(acc.id) }))
  }
  return build(null)
}

export async function getAccount(tenantId: string, id: string) {
  const item = await prisma.account.findFirst({ where: { id, tenantId } })
  if (!item) throw new NotFoundError('Account not found')
  return item
}

export async function createAccount(tenantId: string, userId: string, input: CreateAccountInput) {
  await getLegalEntityOrThrow(tenantId, input.legalEntityId)
  const { level } = await validateParent(tenantId, input.legalEntityId, input.parentAccountId ?? null, input.category)
  const isControlAccount = input.isControlAccount ?? false
  const allowManualPosting = input.allowManualPosting ?? !isControlAccount
  const requiresParty = input.requiresParty ?? ['CUSTOMER_RECEIVABLE', 'VENDOR_PAYABLE'].includes(input.accountType)

  try {
    return await prisma.account.create({
      data: {
        tenantId,
        legalEntityId: input.legalEntityId,
        accountCode: input.accountCode,
        accountName: input.accountName,
        parentAccountId: input.parentAccountId ?? null,
        category: input.category,
        accountType: input.accountType,
        level,
        isGroup: input.isGroup,
        isControlAccount,
        allowManualPosting,
        normalBalance: input.normalBalance,
        currencyCode: input.currencyCode,
        requiresParty,
        requiresReconciliation: input.requiresReconciliation ?? false,
        description: input.description,
        isActive: true,
        createdBy: userId,
        updatedBy: userId,
      },
    })
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      throw new ConflictError(`Account code ${input.accountCode} already exists.`)
    }
    throw err
  }
}

export async function updateAccount(tenantId: string, id: string, userId: string, input: UpdateAccountInput) {
  const existing = await getAccount(tenantId, id)
  const category = input.category ?? existing.category
  const parentAccountId = input.parentAccountId !== undefined ? input.parentAccountId : existing.parentAccountId
  const { level } = await validateParent(tenantId, existing.legalEntityId, parentAccountId, category, id)

  if (input.isGroup === false && existing.isGroup) {
    const childCount = await prisma.account.count({ where: { parentAccountId: id } })
    if (childCount > 0) throw new InvalidStateError('Group account with children cannot be converted to ledger without controlled action')
  }

  const isControlAccount = input.isControlAccount ?? existing.isControlAccount
  const allowManualPosting = input.allowManualPosting ?? (isControlAccount ? false : existing.allowManualPosting)

  try {
    return await prisma.account.update({
      where: { id, tenantId },
      data: {
        accountCode: input.accountCode,
        accountName: input.accountName,
        parentAccountId,
        category,
        accountType: input.accountType,
        level,
        isGroup: input.isGroup,
        isControlAccount,
        allowManualPosting,
        normalBalance: input.normalBalance,
        currencyCode: input.currencyCode,
        requiresParty: input.requiresParty,
        requiresReconciliation: input.requiresReconciliation,
        description: input.description,
        updatedBy: userId,
      },
    })
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      throw new ConflictError(`Account code already exists.`)
    }
    throw err
  }
}

export async function activateAccount(tenantId: string, id: string, userId: string) {
  await getAccount(tenantId, id)
  return prisma.account.update({ where: { id, tenantId }, data: { isActive: true, updatedBy: userId } })
}

export async function deactivateAccount(tenantId: string, id: string, userId: string) {
  await getAccount(tenantId, id)
  return prisma.account.update({ where: { id, tenantId }, data: { isActive: false, updatedBy: userId } })
}

export async function applyCoaTemplate(tenantId: string, userId: string, input: ApplyTemplateInput) {
  await getLegalEntityOrThrow(tenantId, input.legalEntityId)
  const existingCount = await prisma.account.count({ where: { tenantId, legalEntityId: input.legalEntityId } })
  if (existingCount > 0) throw new ConflictError('Chart of accounts already exists for this legal entity')

  const flat = flattenCoaTemplate(input.templateId)
  const codeToId = new Map<string, string>()

  return prisma.$transaction(async (tx) => {
    for (const draft of flat) {
      const parentAccountId = draft.parentAccountCode ? codeToId.get(draft.parentAccountCode) ?? null : null
      const isControlAccount = draft.isControlAccount ?? false
      const created = await tx.account.create({
        data: {
          tenantId,
          legalEntityId: input.legalEntityId,
          accountCode: draft.accountCode,
          accountName: draft.accountName,
          parentAccountId,
          category: draft.category,
          accountType: draft.accountType,
          level: draft.level,
          isGroup: draft.isGroup,
          isControlAccount,
          allowManualPosting: draft.allowManualPosting ?? !isControlAccount,
          normalBalance: draft.normalBalance,
          requiresParty: draft.requiresParty ?? false,
          requiresReconciliation: draft.requiresReconciliation ?? false,
          isActive: true,
          createdBy: userId,
          updatedBy: userId,
        },
      })
      codeToId.set(draft.accountCode, created.id)
    }
    return tx.account.count({ where: { tenantId, legalEntityId: input.legalEntityId } })
  })
}

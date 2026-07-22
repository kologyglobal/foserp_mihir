import type { Request } from 'express'
import { prisma } from '../../../../config/database.js'
import { auditFromRequest, createAuditLog } from '../../../../services/audit.service.js'
import { getLegalEntityOrThrow } from '../../shared/finance.helpers.js'
import {
  PaymentAccountMappingClearingAccountRequiredError,
  PaymentAccountMappingDefaultConflictError,
  TreasuryAccountNotFoundError,
} from '../treasury.errors.js'
import * as repo from './payment-account-mapping.repository.js'
import { resolvePaymentAccountMapping } from './payment-account-mapping-resolve.service.js'
import type {
  CreatePaymentAccountMappingInput,
  ListPaymentAccountMappingsQuery,
  PaymentAccountMappingLifecycleInput,
  ResolvePaymentAccountMappingInput,
  UpdatePaymentAccountMappingInput,
} from './payment-account-mapping.schemas.js'

function auditMeta(req: Request) {
  return auditFromRequest(req)
}

async function assertTreasuryAccountActive(tenantId: string, legalEntityId: string, id: string): Promise<void> {
  const account = await prisma.treasuryAccount.findFirst({ where: { id, tenantId, legalEntityId } })
  if (!account) throw new TreasuryAccountNotFoundError(`Treasury account ${id} not found in this legal entity`)
}

export async function listRecords(tenantId: string, query: ListPaymentAccountMappingsQuery) {
  if (query.legalEntityId) await getLegalEntityOrThrow(tenantId, query.legalEntityId)
  return repo.listMappings(tenantId, query)
}

export async function getRecord(tenantId: string, id: string) {
  return repo.getMapping(tenantId, id)
}

export async function createRecord(req: Request, tenantId: string, input: CreatePaymentAccountMappingInput) {
  const audit = auditMeta(req)
  const userId = req.context?.userId ?? null
  await getLegalEntityOrThrow(tenantId, input.legalEntityId)
  await assertTreasuryAccountActive(tenantId, input.legalEntityId, input.treasuryAccountId)

  if (input.role === 'CLEARING' || input.role === 'SETTLEMENT') {
    if (!input.clearingAccountId) throw new PaymentAccountMappingClearingAccountRequiredError()
    await assertTreasuryAccountActive(tenantId, input.legalEntityId, input.clearingAccountId)
  }

  if (input.isDefault) {
    const conflict = await repo.findConflictingDefault(tenantId, input.legalEntityId, input.paymentMethod, input.useCase, input.direction)
    if (conflict) throw new PaymentAccountMappingDefaultConflictError()
  }

  const record = await repo.createMapping({
    tenantId,
    legalEntityId: input.legalEntityId,
    branchId: input.branchId ?? null,
    paymentMethod: input.paymentMethod,
    direction: input.direction,
    useCase: input.useCase,
    role: input.role,
    currencyCode: input.currencyCode ?? null,
    treasuryAccountId: input.treasuryAccountId,
    clearingAccountId: input.clearingAccountId ?? null,
    priority: input.priority,
    isDefault: input.isDefault,
    description: input.description ?? null,
    createdBy: userId,
  })

  await createAuditLog({
    tenantId,
    userId: audit.userId,
    module: 'finance',
    entity: 'payment_account_mapping',
    entityId: record.id,
    action: 'CREATE',
    newValues: record,
    ipAddress: audit.ipAddress,
    userAgent: audit.userAgent,
  })

  return record
}

export async function updateRecord(req: Request, tenantId: string, id: string, input: UpdatePaymentAccountMappingInput) {
  const audit = auditMeta(req)
  const userId = req.context?.userId ?? null
  const before = await repo.getMapping(tenantId, id)

  if (input.treasuryAccountId) await assertTreasuryAccountActive(tenantId, before.legalEntityId, input.treasuryAccountId)
  const role = before.role
  if ((role === 'CLEARING' || role === 'SETTLEMENT') && input.clearingAccountId === null) {
    throw new PaymentAccountMappingClearingAccountRequiredError()
  }
  if (input.clearingAccountId) await assertTreasuryAccountActive(tenantId, before.legalEntityId, input.clearingAccountId)

  if (input.isDefault) {
    const direction = input.direction ?? before.direction
    const conflict = await repo.findConflictingDefault(tenantId, before.legalEntityId, before.paymentMethod, before.useCase, direction, id)
    if (conflict) throw new PaymentAccountMappingDefaultConflictError()
  }

  const record = await repo.updateMapping(
    tenantId,
    id,
    {
      branchId: input.branchId,
      direction: input.direction,
      currencyCode: input.currencyCode,
      treasuryAccountId: input.treasuryAccountId,
      clearingAccountId: input.clearingAccountId,
      priority: input.priority,
      isDefault: input.isDefault,
      description: input.description,
      updatedBy: userId,
    },
    input.expectedUpdatedAt,
  )

  await createAuditLog({
    tenantId,
    userId: audit.userId,
    module: 'finance',
    entity: 'payment_account_mapping',
    entityId: id,
    action: 'UPDATE',
    oldValues: before,
    newValues: record,
    ipAddress: audit.ipAddress,
    userAgent: audit.userAgent,
  })

  return record
}

export async function activateRecord(req: Request, tenantId: string, id: string, input: PaymentAccountMappingLifecycleInput) {
  const audit = auditMeta(req)
  const userId = req.context?.userId ?? null
  const record = await repo.setActive(tenantId, id, true, userId, input.expectedUpdatedAt)
  await createAuditLog({
    tenantId,
    userId: audit.userId,
    module: 'finance',
    entity: 'payment_account_mapping',
    entityId: id,
    action: 'ACTIVATE',
    newValues: { isActive: true },
    ipAddress: audit.ipAddress,
    userAgent: audit.userAgent,
  })
  return record
}

export async function deactivateRecord(req: Request, tenantId: string, id: string, input: PaymentAccountMappingLifecycleInput) {
  const audit = auditMeta(req)
  const userId = req.context?.userId ?? null
  const record = await repo.setActive(tenantId, id, false, userId, input.expectedUpdatedAt)
  await createAuditLog({
    tenantId,
    userId: audit.userId,
    module: 'finance',
    entity: 'payment_account_mapping',
    entityId: id,
    action: 'DEACTIVATE',
    newValues: { isActive: false },
    ipAddress: audit.ipAddress,
    userAgent: audit.userAgent,
  })
  return record
}

export async function resolveRecord(tenantId: string, input: ResolvePaymentAccountMappingInput) {
  await getLegalEntityOrThrow(tenantId, input.legalEntityId)
  return resolvePaymentAccountMapping(tenantId, input)
}

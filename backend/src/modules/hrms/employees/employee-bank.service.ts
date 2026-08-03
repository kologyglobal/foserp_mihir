import { prisma } from '../../../config/prisma.js'
import { createAuditLog } from '../../../services/audit.service.js'
import { NotFoundError, ValidationError } from '../../../utils/errors.js'
import type { UserDataScope } from '../../access-scopes/scope.service.js'
import { assertEmployeeAccessible } from './employee.service.js'
import { mapBankDetail } from './employee.mapper.js'
import type { CreateBankDetailInput, UpdateBankDetailInput } from './employee.schemas.js'

interface AuditMeta {
  userId?: string
  ipAddress?: string | null
  userAgent?: string | null
}

export async function listBankDetails(tenantId: string, scope: UserDataScope, employeeId: string, reveal: boolean) {
  await assertEmployeeAccessible(tenantId, scope, employeeId)
  const rows = await prisma.hrEmployeeBankDetail.findMany({
    where: { tenantId, employeeId, deletedAt: null },
    orderBy: [{ isPrimary: 'desc' }, { createdAt: 'desc' }],
  })
  return rows.map((row) => mapBankDetail(row, reveal))
}

export async function createBankDetail(
  tenantId: string,
  scope: UserDataScope,
  employeeId: string,
  input: CreateBankDetailInput,
  audit?: AuditMeta,
) {
  await assertEmployeeAccessible(tenantId, scope, employeeId)

  const row = await prisma.$transaction(async (tx) => {
    if (input.isPrimary) {
      await tx.hrEmployeeBankDetail.updateMany({
        where: { tenantId, employeeId, deletedAt: null, isPrimary: true },
        data: { isPrimary: false },
      })
    }
    return tx.hrEmployeeBankDetail.create({
      data: {
        tenantId,
        employeeId,
        bankName: input.bankName,
        accountHolderName: input.accountHolderName,
        accountNumber: input.accountNumber,
        ifsc: input.ifsc.toUpperCase(),
        isPrimary: input.isPrimary ?? false,
        effectiveFrom: input.effectiveFrom ? new Date(input.effectiveFrom) : null,
        effectiveTo: input.effectiveTo ? new Date(input.effectiveTo) : null,
        createdBy: audit?.userId,
      },
    })
  })

  await createAuditLog({
    tenantId,
    userId: audit?.userId ?? null,
    module: 'hrms',
    entity: 'HrEmployeeBankDetail',
    entityId: row.id,
    action: 'CREATE',
    newValues: { employeeId, bankName: row.bankName, isPrimary: row.isPrimary },
    ipAddress: audit?.ipAddress,
    userAgent: audit?.userAgent,
  })

  return mapBankDetail(row, true)
}

export async function updateBankDetail(
  tenantId: string,
  scope: UserDataScope,
  employeeId: string,
  bankId: string,
  input: UpdateBankDetailInput,
  audit?: AuditMeta,
) {
  await assertEmployeeAccessible(tenantId, scope, employeeId)
  const existing = await prisma.hrEmployeeBankDetail.findFirst({
    where: { id: bankId, tenantId, employeeId, deletedAt: null },
  })
  if (!existing) throw new NotFoundError('Bank detail not found')

  if (input.ifsc && !/^[A-Za-z0-9]{4,11}$/.test(input.ifsc)) {
    throw new ValidationError('IFSC is invalid')
  }

  const row = await prisma.$transaction(async (tx) => {
    if (input.isPrimary) {
      await tx.hrEmployeeBankDetail.updateMany({
        where: { tenantId, employeeId, deletedAt: null, isPrimary: true, id: { not: bankId } },
        data: { isPrimary: false },
      })
    }
    return tx.hrEmployeeBankDetail.update({
      where: { id: bankId },
      data: {
        ...(input.bankName !== undefined ? { bankName: input.bankName } : {}),
        ...(input.accountHolderName !== undefined ? { accountHolderName: input.accountHolderName } : {}),
        ...(input.accountNumber !== undefined ? { accountNumber: input.accountNumber } : {}),
        ...(input.ifsc !== undefined ? { ifsc: input.ifsc.toUpperCase() } : {}),
        ...(input.isPrimary !== undefined ? { isPrimary: input.isPrimary } : {}),
        ...(input.effectiveFrom !== undefined
          ? { effectiveFrom: input.effectiveFrom ? new Date(input.effectiveFrom) : null }
          : {}),
        ...(input.effectiveTo !== undefined
          ? { effectiveTo: input.effectiveTo ? new Date(input.effectiveTo) : null }
          : {}),
        updatedBy: audit?.userId,
      },
    })
  })

  await createAuditLog({
    tenantId,
    userId: audit?.userId ?? null,
    module: 'hrms',
    entity: 'HrEmployeeBankDetail',
    entityId: bankId,
    action: 'UPDATE',
    oldValues: { bankName: existing.bankName, isPrimary: existing.isPrimary },
    newValues: { bankName: row.bankName, isPrimary: row.isPrimary },
    ipAddress: audit?.ipAddress,
    userAgent: audit?.userAgent,
  })

  return mapBankDetail(row, true)
}

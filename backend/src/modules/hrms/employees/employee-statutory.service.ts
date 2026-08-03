import { prisma } from '../../../config/prisma.js'
import { createAuditLog } from '../../../services/audit.service.js'
import type { UserDataScope } from '../../access-scopes/scope.service.js'
import { assertEmployeeAccessible } from './employee.service.js'
import { mapStatutoryDetail } from './employee.mapper.js'
import type { UpsertStatutoryDetailInput } from './employee.schemas.js'

interface AuditMeta {
  userId?: string
  ipAddress?: string | null
  userAgent?: string | null
}

export async function getStatutoryDetail(
  tenantId: string,
  scope: UserDataScope,
  employeeId: string,
  reveal: boolean,
) {
  await assertEmployeeAccessible(tenantId, scope, employeeId)
  const row = await prisma.hrEmployeeStatutoryDetail.findFirst({ where: { tenantId, employeeId } })
  if (!row) return null
  return mapStatutoryDetail(row, reveal)
}

export async function upsertStatutoryDetail(
  tenantId: string,
  scope: UserDataScope,
  employeeId: string,
  input: UpsertStatutoryDetailInput,
  audit?: AuditMeta,
) {
  await assertEmployeeAccessible(tenantId, scope, employeeId)
  const existing = await prisma.hrEmployeeStatutoryDetail.findFirst({ where: { tenantId, employeeId } })

  const data = {
    pan: input.pan === undefined ? undefined : input.pan,
    aadhaarRef: input.aadhaarRef === undefined ? undefined : input.aadhaarRef,
    uan: input.uan === undefined ? undefined : input.uan,
    esicNumber: input.esicNumber === undefined ? undefined : input.esicNumber,
  }

  const row = existing
    ? await prisma.hrEmployeeStatutoryDetail.update({
        where: { id: existing.id },
        data: { ...data, updatedBy: audit?.userId },
      })
    : await prisma.hrEmployeeStatutoryDetail.create({
        data: {
          tenantId,
          employeeId,
          pan: input.pan ?? null,
          aadhaarRef: input.aadhaarRef ?? null,
          uan: input.uan ?? null,
          esicNumber: input.esicNumber ?? null,
          createdBy: audit?.userId,
        },
      })

  await createAuditLog({
    tenantId,
    userId: audit?.userId ?? null,
    module: 'hrms',
    entity: 'HrEmployeeStatutoryDetail',
    entityId: row.id,
    action: existing ? 'UPDATE' : 'CREATE',
    ipAddress: audit?.ipAddress,
    userAgent: audit?.userAgent,
  })

  return mapStatutoryDetail(row, true)
}

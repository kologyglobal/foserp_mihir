import type { Prisma } from '@prisma/client'
import { prisma } from '../../../config/prisma.js'
import { createAuditLog } from '../../../services/audit.service.js'
import { ValidationError } from '../../../utils/errors.js'
import type { UserDataScope } from '../../access-scopes/scope.service.js'
import { assertEmployeeAccessible } from '../employees/employee.service.js'
import { decStatutory } from './wage-basis.service.js'
import type { UpdateEmployeeStatutoryProfileInput } from './statutory.schemas.js'

interface AuditMeta {
  userId?: string
  ipAddress?: string | null
  userAgent?: string | null
}

/** Fields that toggle statutory applicability or authorize a manual TDS figure — always require overrideReason. */
const OVERRIDE_TRIGGER_FIELDS = [
  'pfApplicable',
  'esicApplicable',
  'ptApplicable',
  'tdsApplicable',
  'lwfApplicable',
  'tdsManualMonthly',
] as const

function mapProfile(row: {
  id: string
  employeeId: string
  pan: string | null
  aadhaarRef: string | null
  uan: string | null
  esicNumber: string | null
  pfApplicable: boolean | null
  esicApplicable: boolean | null
  ptApplicable: boolean | null
  tdsApplicable: boolean | null
  lwfApplicable: boolean | null
  taxRegime: string | null
  previousEmploymentIncome: Prisma.Decimal | null
  declaredDeductions: Prisma.Decimal | null
  taxAlreadyDeducted: Prisma.Decimal | null
  tdsManualMonthly: Prisma.Decimal | null
  tdsManualReason: string | null
  overrideReason: string | null
  overrideByUserId: string | null
  overrideAt: Date | null
  createdAt: Date
  updatedAt: Date
}) {
  return {
    id: row.id,
    employeeId: row.employeeId,
    pan: row.pan,
    aadhaarRef: row.aadhaarRef,
    uan: row.uan,
    esicNumber: row.esicNumber,
    pfApplicable: row.pfApplicable,
    esicApplicable: row.esicApplicable,
    ptApplicable: row.ptApplicable,
    tdsApplicable: row.tdsApplicable,
    lwfApplicable: row.lwfApplicable,
    taxRegime: row.taxRegime,
    previousEmploymentIncome: decStatutory(row.previousEmploymentIncome),
    declaredDeductions: decStatutory(row.declaredDeductions),
    taxAlreadyDeducted: decStatutory(row.taxAlreadyDeducted),
    tdsManualMonthly: decStatutory(row.tdsManualMonthly),
    tdsManualReason: row.tdsManualReason,
    overrideReason: row.overrideReason,
    overrideByUserId: row.overrideByUserId,
    overrideAt: row.overrideAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }
}

export async function getEmployeeStatutoryProfile(tenantId: string, scope: UserDataScope, employeeId: string) {
  const employee = await assertEmployeeAccessible(tenantId, scope, employeeId)
  const branch = await prisma.branch.findFirst({ where: { id: employee.branchId, tenantId }, select: { stateCode: true } })
  const row = await prisma.hrEmployeeStatutoryDetail.findFirst({ where: { tenantId, employeeId } })

  return {
    employeeId,
    legalEntityId: employee.legalEntityId,
    branchId: employee.branchId,
    branchStateCode: branch?.stateCode ?? null,
    profile: row ? mapProfile(row) : null,
  }
}

export async function updateEmployeeStatutoryProfile(
  tenantId: string,
  scope: UserDataScope,
  employeeId: string,
  input: UpdateEmployeeStatutoryProfileInput,
  audit?: AuditMeta,
) {
  await assertEmployeeAccessible(tenantId, scope, employeeId)

  const touchesOverride = OVERRIDE_TRIGGER_FIELDS.some((field) => input[field] !== undefined)
  if (touchesOverride && !input.overrideReason?.trim()) {
    throw new ValidationError('overrideReason is required when changing applicability flags or tdsManualMonthly')
  }

  const existing = await prisma.hrEmployeeStatutoryDetail.findFirst({ where: { tenantId, employeeId } })

  const fieldData = {
    ...(input.pfApplicable !== undefined ? { pfApplicable: input.pfApplicable } : {}),
    ...(input.esicApplicable !== undefined ? { esicApplicable: input.esicApplicable } : {}),
    ...(input.ptApplicable !== undefined ? { ptApplicable: input.ptApplicable } : {}),
    ...(input.tdsApplicable !== undefined ? { tdsApplicable: input.tdsApplicable } : {}),
    ...(input.lwfApplicable !== undefined ? { lwfApplicable: input.lwfApplicable } : {}),
    ...(input.taxRegime !== undefined ? { taxRegime: input.taxRegime } : {}),
    ...(input.previousEmploymentIncome !== undefined ? { previousEmploymentIncome: input.previousEmploymentIncome } : {}),
    ...(input.declaredDeductions !== undefined ? { declaredDeductions: input.declaredDeductions } : {}),
    ...(input.taxAlreadyDeducted !== undefined ? { taxAlreadyDeducted: input.taxAlreadyDeducted } : {}),
    ...(input.tdsManualMonthly !== undefined ? { tdsManualMonthly: input.tdsManualMonthly } : {}),
    ...(input.tdsManualReason !== undefined ? { tdsManualReason: input.tdsManualReason } : {}),
    ...(touchesOverride
      ? { overrideReason: input.overrideReason, overrideByUserId: audit?.userId ?? null, overrideAt: new Date() }
      : {}),
  }

  const row = existing
    ? await prisma.hrEmployeeStatutoryDetail.update({
        where: { id: existing.id },
        data: { ...fieldData, updatedBy: audit?.userId },
      })
    : await prisma.hrEmployeeStatutoryDetail.create({
        data: {
          tenantId,
          employeeId,
          ...fieldData,
          createdBy: audit?.userId,
        },
      })

  await createAuditLog({
    tenantId,
    module: 'hrms',
    entity: 'HrEmployeeStatutoryDetail',
    entityId: row.id,
    action: existing ? 'UPDATE_PROFILE' : 'CREATE_PROFILE',
    newValues: touchesOverride ? { overrideReason: input.overrideReason, fields: OVERRIDE_TRIGGER_FIELDS.filter((f) => input[f] !== undefined) } : undefined,
    userId: audit?.userId,
    ipAddress: audit?.ipAddress,
    userAgent: audit?.userAgent,
  })

  return mapProfile(row)
}

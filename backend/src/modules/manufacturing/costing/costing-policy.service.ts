import type { Request } from 'express'
import { prisma } from '../../../config/database.js'
import { InvalidStateError, NotFoundError, ValidationError } from '../../../utils/errors.js'
import type {
  CreateCostingPolicyInput,
  ListCostingPoliciesQuery,
  UpdateCostingPolicyInput,
} from './costing.schemas.js'

export const BUILT_IN_COSTING_POLICY = {
  id: null,
  legalEntityId: null,
  plantCode: null,
  name: 'Built-in provisional costing',
  costingMethod: 'PLANNED_AS_PROVISIONAL',
  inventoryValuationMethod: 'MOVING_AVERAGE',
  materialValuationSource: 'MOVEMENT_UNIT_COST',
  labourRateSource: 'WORK_CENTRE_RATE',
  machineRateSource: 'MACHINE_RATE',
  jobWorkCostSource: 'LINKED_INVOICE',
  overheadMethod: 'NONE',
  overheadRate: 0,
  defaultLabourRate: 0,
  defaultMachineRate: 0,
  fgPostingMode: 'MANUAL',
  variancePostingMode: 'MANUAL',
  status: 'ACTIVE',
  currencyCode: 'INR',
  builtIn: true,
} as const

async function assertLegalEntity(tenantId: string, legalEntityId?: string | null) {
  if (!legalEntityId) return
  const exists = await prisma.legalEntity.findFirst({ where: { id: legalEntityId, tenantId, isActive: true } })
  if (!exists) throw new ValidationError('Active legal entity not found for tenant')
}

export async function listCostingPolicies(tenantId: string, query: ListCostingPoliciesQuery) {
  const page = query.page ?? 1
  const limit = query.limit ?? 50
  const where = {
    tenantId,
    deletedAt: null,
    ...(query.status ? { status: query.status } : {}),
    ...(query.plantCode ? { plantCode: query.plantCode } : {}),
  }
  const [total, items] = await Promise.all([
    prisma.manufacturingCostingPolicy.count({ where }),
    prisma.manufacturingCostingPolicy.findMany({ where, orderBy: { createdAt: 'desc' }, skip: (page - 1) * limit, take: limit }),
  ])
  return { total, page, limit, items }
}

export async function getCostingPolicy(tenantId: string, id: string) {
  const row = await prisma.manufacturingCostingPolicy.findFirst({ where: { id, tenantId, deletedAt: null } })
  if (!row) throw new NotFoundError('Costing policy not found')
  return row
}

export async function createCostingPolicy(req: Request, tenantId: string, input: CreateCostingPolicyInput) {
  await assertLegalEntity(tenantId, input.legalEntityId)
  return prisma.manufacturingCostingPolicy.create({
    data: { ...input, tenantId, status: 'DRAFT', createdBy: req.context?.userId, updatedBy: req.context?.userId },
  })
}

export async function updateCostingPolicy(req: Request, tenantId: string, id: string, input: UpdateCostingPolicyInput) {
  const current = await getCostingPolicy(tenantId, id)
  if (current.status !== 'DRAFT') throw new InvalidStateError('Only DRAFT costing policies can be edited')
  await assertLegalEntity(tenantId, input.legalEntityId)
  if (input.overheadMethod && !['NONE', 'ACTIVITY_BASED'].includes(input.overheadMethod)) {
    const rate = input.overheadRate ?? Number(current.overheadRate)
    if (rate <= 0) throw new ValidationError('overheadRate must be positive when overhead is enabled')
  }
  return prisma.manufacturingCostingPolicy.update({
    where: { id },
    data: { ...input, updatedBy: req.context?.userId },
  })
}

export async function deleteCostingPolicy(req: Request, tenantId: string, id: string) {
  const current = await getCostingPolicy(tenantId, id)
  if (current.status === 'ACTIVE') throw new InvalidStateError('Archive or replace an ACTIVE policy before deleting it')
  await prisma.manufacturingCostingPolicy.update({
    where: { id },
    data: { deletedAt: new Date(), status: 'ARCHIVED', updatedBy: req.context?.userId },
  })
}

export async function activateCostingPolicy(req: Request, tenantId: string, id: string) {
  const policy = await getCostingPolicy(tenantId, id)
  if (policy.status === 'ARCHIVED') throw new InvalidStateError('Archived costing policy cannot be activated')
  if (!['NONE', 'ACTIVITY_BASED'].includes(policy.overheadMethod) && policy.overheadRate.lessThanOrEqualTo(0)) {
    throw new ValidationError('Active policy with overhead requires a positive overheadRate')
  }
  await assertLegalEntity(tenantId, policy.legalEntityId)
  return prisma.$transaction(async (tx) => {
    await tx.manufacturingCostingPolicy.updateMany({
      where: {
        tenantId,
        status: 'ACTIVE',
        deletedAt: null,
        ...(policy.plantCode == null ? { plantCode: null } : { plantCode: policy.plantCode }),
        NOT: { id },
      },
      data: { status: 'ARCHIVED', updatedBy: req.context?.userId },
    })
    return tx.manufacturingCostingPolicy.update({
      where: { id },
      data: { status: 'ACTIVE', effectiveFrom: policy.effectiveFrom ?? new Date(), updatedBy: req.context?.userId },
    })
  })
}

export async function resolveCostingPolicy(tenantId: string, plantCode?: string | null) {
  const policy = await prisma.manufacturingCostingPolicy.findFirst({
    where: {
      tenantId,
      status: 'ACTIVE',
      deletedAt: null,
      OR: plantCode ? [{ plantCode }, { plantCode: null }] : [{ plantCode: null }],
    },
    orderBy: [{ plantCode: 'desc' }, { effectiveFrom: 'desc' }, { createdAt: 'desc' }],
  })
  return policy ? { ...policy, builtIn: false as const } : BUILT_IN_COSTING_POLICY
}

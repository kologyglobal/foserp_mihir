import type { FinanceFeatureKey } from '@prisma/client'
import type { Request } from 'express'
import { prisma } from '../../../config/database.js'
import { ConflictError, NotFoundError } from '../../../utils/errors.js'
import { getManufacturingAccountingReadiness } from '../costing/accounting-readiness.service.js'

export const MANUFACTURING_ACCOUNTING_FEATURE_KEY: FinanceFeatureKey = 'MANUFACTURING_ACCOUNTING'

/** Blockers a legal entity must clear before the flag can be turned on. The flag itself is excluded. */
const ENABLEMENT_IGNORED_BLOCKERS = new Set(['MANUFACTURING_ACCOUNTING_FLAG_DISABLED'])

async function assertLegalEntity(tenantId: string, legalEntityId: string) {
  const legalEntity = await prisma.legalEntity.findFirst({
    where: { id: legalEntityId, tenantId },
    select: { id: true, code: true, displayName: true, isActive: true },
  })
  if (!legalEntity) throw new NotFoundError('Legal entity not found for this tenant')
  return legalEntity
}

export async function listFeatureControls(tenantId: string, featureKey?: FinanceFeatureKey) {
  return prisma.financeFeatureControl.findMany({
    where: { tenantId, ...(featureKey ? { featureKey } : {}) },
    orderBy: [{ featureKey: 'asc' }, { updatedAt: 'desc' }],
    include: { legalEntity: { select: { id: true, code: true, displayName: true, isActive: true } } },
  })
}

/** Flag row (null when never set = off) plus the readiness summary for the legal entity. */
export async function getManufacturingAccountingFeatureStatus(tenantId: string, legalEntityId: string) {
  const legalEntity = await assertLegalEntity(tenantId, legalEntityId)
  const [control, readiness] = await Promise.all([
    prisma.financeFeatureControl.findFirst({
      where: { tenantId, legalEntityId, featureKey: MANUFACTURING_ACCOUNTING_FEATURE_KEY },
    }),
    getManufacturingAccountingReadiness(tenantId, undefined, legalEntityId),
  ])
  const enablementBlockers = readiness.blockers.filter((blocker) => !ENABLEMENT_IGNORED_BLOCKERS.has(blocker))
  return {
    legalEntity,
    featureKey: MANUFACTURING_ACCOUNTING_FEATURE_KEY,
    isEnabled: control?.isEnabled ?? false,
    control,
    readiness,
    enablement: { ready: enablementBlockers.length === 0, blockers: enablementBlockers },
  }
}

/**
 * Upsert the MANUFACTURING_ACCOUNTING flag for a legal entity.
 * Enabling requires the readiness gate (mappings + open period + no failed events) to pass;
 * otherwise a 409 CONFLICT is returned with the blockers. Disabling is always allowed.
 */
export async function setManufacturingAccountingFeature(
  req: Request,
  tenantId: string,
  legalEntityId: string,
  isEnabled: boolean,
) {
  await assertLegalEntity(tenantId, legalEntityId)

  if (isEnabled) {
    const readiness = await getManufacturingAccountingReadiness(tenantId, undefined, legalEntityId)
    const blockers = readiness.blockers.filter((blocker) => !ENABLEMENT_IGNORED_BLOCKERS.has(blocker))
    if (blockers.length > 0) {
      throw new ConflictError(
        `Manufacturing accounting cannot be enabled for this legal entity: ${blockers.join(', ')}`,
        blockers.map((blocker) => ({ field: 'blockers', message: blocker })),
      )
    }
  }

  await prisma.financeFeatureControl.upsert({
    where: { legalEntityId_featureKey: { legalEntityId, featureKey: MANUFACTURING_ACCOUNTING_FEATURE_KEY } },
    create: {
      tenantId,
      legalEntityId,
      featureKey: MANUFACTURING_ACCOUNTING_FEATURE_KEY,
      isEnabled,
      updatedBy: req.context?.userId ?? null,
    },
    update: { isEnabled, updatedBy: req.context?.userId ?? null },
  })

  return getManufacturingAccountingFeatureStatus(tenantId, legalEntityId)
}

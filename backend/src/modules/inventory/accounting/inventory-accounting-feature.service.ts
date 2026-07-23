/**
 * INVENTORY_ACCOUNTING feature control — required for FG_DISPATCH COGS G/L.
 * Enablement requires COST_OF_GOODS_SOLD + FINISHED_GOODS_INVENTORY mappings.
 */
import type { FinanceFeatureKey } from '@prisma/client'
import type { Request } from 'express'
import { prisma } from '../../../config/database.js'
import {
  AuthenticationError,
  AuthorizationError,
  NotFoundError,
  UnprocessableEntityError,
} from '../../../utils/errors.js'
import { assertFinanceActivated } from '../../accounting/posting/posting-currency.service.js'
import type { PutInventoryAccountingFeatureInput } from './inventory-accounting.schemas.js'

export const INVENTORY_ACCOUNTING_FEATURE_KEY: FinanceFeatureKey = 'INVENTORY_ACCOUNTING'

/** Mapping keys required before COGS (and other inventory GL) can post. */
export const INVENTORY_ACCOUNTING_REQUIRED_MAPPINGS = [
  'COST_OF_GOODS_SOLD',
  'FINISHED_GOODS_INVENTORY',
] as const

async function assertLegalEntity(tenantId: string, legalEntityId: string) {
  const legalEntity = await prisma.legalEntity.findFirst({
    where: { id: legalEntityId, tenantId },
    select: { id: true, code: true, displayName: true, isActive: true },
  })
  if (!legalEntity) throw new NotFoundError('Legal entity not found for this tenant')
  if (!legalEntity.isActive) {
    throw new UnprocessableEntityError(
      'Legal entity is inactive',
      'LEGAL_ENTITY_INACTIVE',
      [{ field: 'legalEntityId', message: 'LEGAL_ENTITY_INACTIVE' }],
    )
  }
  return legalEntity
}

function requireAuthenticatedUser(req: Request): string {
  const userId = req.context?.userId
  if (!userId) throw new AuthenticationError('Authentication required')
  return userId
}

function hasPermission(req: Request, permission: string): boolean {
  const ctx = req.context
  if (!ctx) return false
  if (ctx.isSuperAdmin) return true
  return ctx.permissions.includes(permission)
}

export async function getInventoryAccountingMappingReadiness(
  tenantId: string,
  legalEntityId: string,
) {
  const mappings = await prisma.defaultAccountMapping.findMany({
    where: {
      tenantId,
      legalEntityId,
      mappingKey: { in: [...INVENTORY_ACCOUNTING_REQUIRED_MAPPINGS] },
    },
    select: {
      mappingKey: true,
      account: { select: { id: true, isActive: true, isGroup: true, accountCode: true, accountName: true } },
    },
  })
  const byKey = new Map(mappings.map((m) => [m.mappingKey, m]))
  const missing: string[] = []
  const invalid: string[] = []
  const present: Array<{ mappingKey: string; accountCode: string; accountName: string }> = []

  for (const key of INVENTORY_ACCOUNTING_REQUIRED_MAPPINGS) {
    const row = byKey.get(key)
    const account = row?.account
    if (!account) {
      missing.push(key)
      continue
    }
    if (!account.isActive || account.isGroup) {
      invalid.push(key)
      continue
    }
    present.push({
      mappingKey: key,
      accountCode: account.accountCode,
      accountName: account.accountName,
    })
  }

  return {
    ready: missing.length === 0 && invalid.length === 0,
    present,
    missing,
    invalid,
  }
}

export async function getInventoryAccountingFeatureStatus(tenantId: string, legalEntityId: string) {
  const legalEntity = await assertLegalEntity(tenantId, legalEntityId)
  const [row, mapping] = await Promise.all([
    prisma.financeFeatureControl.findFirst({
      where: { tenantId, legalEntityId, featureKey: INVENTORY_ACCOUNTING_FEATURE_KEY },
    }),
    getInventoryAccountingMappingReadiness(tenantId, legalEntityId),
  ])
  return {
    legalEntity: {
      id: legalEntity.id,
      code: legalEntity.code,
      displayName: legalEntity.displayName,
    },
    featureKey: INVENTORY_ACCOUNTING_FEATURE_KEY,
    isEnabled: Boolean(row?.isEnabled),
    mapping,
    canEnable: mapping.ready,
    updatedAt: row?.updatedAt?.toISOString() ?? null,
  }
}

/**
 * Enable / disable INVENTORY_ACCOUNTING.
 * Enable requires finance activated + COGS/FG default mappings.
 */
export async function putInventoryAccountingFeatureControl(
  req: Request,
  tenantId: string,
  legalEntityId: string,
  input: PutInventoryAccountingFeatureInput,
) {
  if (!hasPermission(req, 'finance.settings.manage') && !hasPermission(req, 'tenant.manage')) {
    throw new AuthorizationError('finance.settings.manage required to change Inventory Accounting')
  }
  const userId = requireAuthenticatedUser(req)
  await assertLegalEntity(tenantId, legalEntityId)
  await assertFinanceActivated(tenantId, legalEntityId)

  if (input.isEnabled) {
    const mapping = await getInventoryAccountingMappingReadiness(tenantId, legalEntityId)
    if (!mapping.ready) {
      throw new UnprocessableEntityError(
        'Map COST_OF_GOODS_SOLD and FINISHED_GOODS_INVENTORY before enabling Inventory Accounting',
        'INVENTORY_ACCOUNTING_MAPPINGS_INCOMPLETE',
        [
          ...mapping.missing.map((k) => ({ field: 'mappingKey', message: `MISSING:${k}` })),
          ...mapping.invalid.map((k) => ({ field: 'mappingKey', message: `INVALID:${k}` })),
        ],
      )
    }
  }

  const row = await prisma.financeFeatureControl.upsert({
    where: {
      legalEntityId_featureKey: {
        legalEntityId,
        featureKey: INVENTORY_ACCOUNTING_FEATURE_KEY,
      },
    },
    create: {
      tenantId,
      legalEntityId,
      featureKey: INVENTORY_ACCOUNTING_FEATURE_KEY,
      isEnabled: input.isEnabled,
      updatedBy: userId,
      configurationJson: {
        note: input.note ?? null,
        enabledAt: input.isEnabled ? new Date().toISOString() : null,
        enabledBy: input.isEnabled ? userId : null,
      },
    },
    update: {
      isEnabled: input.isEnabled,
      updatedBy: userId,
      configurationJson: {
        note: input.note ?? null,
        enabledAt: input.isEnabled ? new Date().toISOString() : null,
        enabledBy: input.isEnabled ? userId : null,
        updatedAt: new Date().toISOString(),
      },
    },
  })

  return getInventoryAccountingFeatureStatus(tenantId, legalEntityId).then((status) => ({
    ...status,
    controlId: row.id,
  }))
}

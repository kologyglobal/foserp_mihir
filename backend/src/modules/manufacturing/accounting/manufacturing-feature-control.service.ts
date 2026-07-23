import type { FinanceFeatureKey, Prisma } from '@prisma/client'
import type { Request } from 'express'
import { prisma } from '../../../config/database.js'
import { assertFinanceActivated } from '../../accounting/posting/posting-currency.service.js'
import {
  AuthenticationError,
  AuthorizationError,
  ConflictError,
  NotFoundError,
  UnprocessableEntityError,
} from '../../../utils/errors.js'
import { getManufacturingAccountingReadiness } from '../costing/accounting-readiness.service.js'
import { listReconciliation } from '../costing/workspace.service.js'
import type { PutFeatureControlInput } from './manufacturing-accounting.schemas.js'

export const MANUFACTURING_ACCOUNTING_FEATURE_KEY: FinanceFeatureKey = 'MANUFACTURING_ACCOUNTING'

/** Blockers a legal entity must clear before the flag can be turned on. The flag itself is excluded. */
const ENABLEMENT_IGNORED_BLOCKERS = new Set(['MANUFACTURING_ACCOUNTING_FLAG_DISABLED'])

/** Sign-off blockers are satisfied by this request body — ignore when re-checking readiness after persist. */
const SIGN_OFF_BLOCKERS = new Set(['INVENTORY_RECONCILE_NOT_SIGNED_OFF', 'PILOT_FINANCE_SIGNOFF_REQUIRED'])

type ConfigJson = Record<string, unknown>

function asConfig(value: unknown): ConfigJson {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return { ...(value as ConfigJson) }
  }
  return {}
}

function historyOf(config: ConfigJson): unknown[] {
  return Array.isArray(config.signOffHistory) ? [...(config.signOffHistory as unknown[])] : []
}

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
  if (!userId) throw new AuthenticationError('Authentication required for Manufacturing Accounting sign-off')
  return userId
}

function hasPermission(req: Request, permission: string): boolean {
  const ctx = req.context
  if (!ctx) return false
  if (ctx.isSuperAdmin) return true
  return ctx.permissions.includes(permission)
}

export async function listFeatureControls(tenantId: string, featureKey?: FinanceFeatureKey) {
  return prisma.financeFeatureControl.findMany({
    where: { tenantId, ...(featureKey ? { featureKey } : {}) },
    orderBy: [{ featureKey: 'asc' }, { updatedAt: 'desc' }],
    include: { legalEntity: { select: { id: true, code: true, displayName: true, isActive: true } } },
  })
}

/** Flag row (null when never set = off) plus the readiness summary for the legal entity. */
export async function getManufacturingAccountingFeatureStatus(
  tenantId: string,
  legalEntityId: string,
  options?: { includeTechnicalDetails?: boolean },
) {
  const legalEntity = await assertLegalEntity(tenantId, legalEntityId)
  const [control, readiness] = await Promise.all([
    prisma.financeFeatureControl.findFirst({
      where: { tenantId, legalEntityId, featureKey: MANUFACTURING_ACCOUNTING_FEATURE_KEY },
    }),
    getManufacturingAccountingReadiness(tenantId, undefined, legalEntityId, undefined, {
      includeTechnicalDetails: options?.includeTechnicalDetails === true,
    }),
  ])
  const enablementBlockers = readiness.blockers.filter((blocker) => !ENABLEMENT_IGNORED_BLOCKERS.has(blocker))
  const config = asConfig(control?.configurationJson)
  return {
    legalEntity,
    featureKey: MANUFACTURING_ACCOUNTING_FEATURE_KEY,
    isEnabled: control?.isEnabled ?? false,
    control,
    readiness,
    enablement: { ready: enablementBlockers.length === 0, blockers: enablementBlockers },
    signOffs: {
      inventoryReconcile: {
        confirmed: Boolean(config.inventoryReconcileConfirmed && config.inventoryReconcileConfirmedAt),
        confirmedBy: (config.inventoryReconcileConfirmedBy as string | undefined) ?? null,
        confirmedAt: (config.inventoryReconcileConfirmedAt as string | undefined) ?? null,
        remarks: (config.inventoryReconcileRemarks as string | undefined) ?? null,
        scope: (config.inventoryReconcileScope as Record<string, unknown> | undefined) ?? null,
        reportRef: (config.inventoryReconcileReportRef as string | undefined) ?? null,
      },
      pilotFinance: {
        confirmed: Boolean(config.pilotSignOff && config.pilotSignOffAt),
        signedOffBy: (config.pilotSignOffBy as string | undefined) ?? null,
        signedOffAt: (config.pilotSignOffAt as string | undefined) ?? null,
        remarks: (config.pilotSignOffRemarks as string | undefined) ?? null,
        scope: (config.pilotScope as Record<string, unknown> | undefined) ?? null,
        legalEntityId,
      },
      /** Additive audit trail — previous confirmations are appended, never overwritten away. */
      historyCount: historyOf(config).length,
    },
  }
}

/**
 * Upsert the MANUFACTURING_ACCOUNTING flag for a legal entity.
 * Enabling requires explicit request sign-offs (never inferred from UI-only state) plus readiness.
 * Sign-offs are stored on FinanceFeatureControl.configurationJson with an additive history array.
 */
export async function setManufacturingAccountingFeature(
  req: Request,
  tenantId: string,
  legalEntityId: string,
  input: PutFeatureControlInput,
) {
  const legalEntity = await assertLegalEntity(tenantId, legalEntityId)
  const userId = requireAuthenticatedUser(req)
  const nowIso = new Date().toISOString()

  if (!hasPermission(req, 'finance.settings.manage') && !req.context?.isSuperAdmin) {
    throw new AuthorizationError('finance.settings.manage is required to change Manufacturing Accounting')
  }

  const existing = await prisma.financeFeatureControl.findFirst({
    where: { tenantId, legalEntityId, featureKey: MANUFACTURING_ACCOUNTING_FEATURE_KEY },
    select: { configurationJson: true },
  })
  const prevConfig = asConfig(existing?.configurationJson)
  const nextConfig: ConfigJson = { ...prevConfig }
  const history = historyOf(prevConfig)

  if (input.isEnabled) {
    // —— Inventory reconciliation sign-off (explicit request value required) ——
    if (input.inventoryReconcileConfirmed !== true) {
      throw new UnprocessableEntityError(
        'inventoryReconcileConfirmed must be true to enable Manufacturing Accounting',
        'INVENTORY_RECONCILE_NOT_SIGNED_OFF',
        [{ field: 'inventoryReconcileConfirmed', message: 'INVENTORY_RECONCILE_NOT_SIGNED_OFF' }],
      )
    }
    if (
      !hasPermission(req, 'manufacturing.accounting.reconcile') &&
      !hasPermission(req, 'finance.settings.manage')
    ) {
      throw new AuthorizationError(
        'manufacturing.accounting.reconcile (or finance.settings.manage) is required for inventory reconciliation sign-off',
      )
    }

    // Reconciliation checks must be available for this tenant (workspace query).
    try {
      await listReconciliation(tenantId)
    } catch {
      throw new UnprocessableEntityError(
        'Inventory/Manufacturing reconciliation checks are not available',
        'INVENTORY_RECONCILE_NOT_SIGNED_OFF',
        [{ field: 'inventoryReconcileConfirmed', message: 'RECONCILIATION_CHECKS_UNAVAILABLE' }],
      )
    }

    const inventoryRemarks =
      input.inventoryReconcileRemarks?.trim() || input.signOffNote?.trim() || undefined
    const inventoryScope = input.inventoryReconcileScope ?? undefined
    nextConfig.inventoryReconcileConfirmed = true
    nextConfig.inventoryReconcileConfirmedBy = userId
    nextConfig.inventoryReconcileConfirmedAt = nowIso
    nextConfig.inventoryReconcileRemarks = inventoryRemarks ?? null
    nextConfig.inventoryReconcileScope = inventoryScope ?? null
    nextConfig.inventoryReconcileReportRef = input.inventoryReconcileReportRef?.trim() || null
    history.push({
      type: 'INVENTORY_RECONCILE',
      inventoryReconcileConfirmed: true,
      inventoryReconcileConfirmedBy: userId,
      inventoryReconcileConfirmedAt: nowIso,
      inventoryReconcileRemarks: inventoryRemarks ?? null,
      inventoryReconcileScope: inventoryScope ?? null,
      inventoryReconcileReportRef: input.inventoryReconcileReportRef?.trim() || null,
      legalEntityId,
    })

    // —— Pilot Finance sign-off (explicit request value required) ——
    if (input.pilotSignOff !== true) {
      throw new UnprocessableEntityError(
        'pilotSignOff must be true to enable Manufacturing Accounting',
        'PILOT_FINANCE_SIGNOFF_REQUIRED',
        [{ field: 'pilotSignOff', message: 'PILOT_FINANCE_SIGNOFF_REQUIRED' }],
      )
    }
    if (!hasPermission(req, 'finance.settings.manage')) {
      throw new AuthorizationError('Finance approval permission (finance.settings.manage) is required for pilot sign-off')
    }

    try {
      await assertFinanceActivated(tenantId, legalEntityId)
    } catch {
      throw new UnprocessableEntityError(
        'Finance setup is not activated for this legal entity',
        'PILOT_FINANCE_SIGNOFF_REQUIRED',
        [{ field: 'pilotSignOff', message: 'FINANCE_NOT_ACTIVATED' }],
      )
    }

    // Pre-accept checks for pilot: mappings, open period, failed events.
    const preReadiness = await getManufacturingAccountingReadiness(tenantId, undefined, legalEntityId)
    if (!preReadiness.enablementChecks?.accountMappingsReady) {
      throw new UnprocessableEntityError(
        'Account mappings must pass before pilot Finance sign-off',
        'PILOT_FINANCE_SIGNOFF_REQUIRED',
        [{ field: 'pilotSignOff', message: 'MISSING_ACCOUNT_MAPPINGS' }],
        { blockers: preReadiness.blockers },
      )
    }
    if (!preReadiness.enablementChecks?.openFinancialPeriodExists) {
      throw new UnprocessableEntityError(
        'An OPEN accounting period must cover the posting date before pilot Finance sign-off',
        'PILOT_FINANCE_SIGNOFF_REQUIRED',
        [{ field: 'pilotSignOff', message: 'NO_OPEN_ACCOUNTING_PERIOD' }],
        { blockers: preReadiness.blockers },
      )
    }
    if ((preReadiness.enablementChecks?.failedAccountingEventCount ?? 0) > 0) {
      throw new UnprocessableEntityError(
        'Failed accounting events must be cleared before pilot Finance sign-off',
        'PILOT_FINANCE_SIGNOFF_REQUIRED',
        [{ field: 'pilotSignOff', message: 'FAILED_ACCOUNTING_EVENTS' }],
        { eventExceptions: preReadiness.eventIntegrity?.exceptions ?? [] },
      )
    }

    const pilotRemarks = input.pilotSignOffRemarks?.trim() || input.signOffNote?.trim() || undefined
    const pilotScope = {
      ...(input.pilotScope ?? {}),
      legalEntityId,
      legalEntityCode: legalEntity.code,
    }
    nextConfig.pilotSignOff = true
    nextConfig.pilotSignOffBy = userId
    nextConfig.pilotSignOffAt = nowIso
    nextConfig.pilotSignOffRemarks = pilotRemarks ?? null
    nextConfig.pilotScope = pilotScope
    history.push({
      type: 'PILOT_FINANCE',
      pilotSignOff: true,
      pilotSignOffBy: userId,
      pilotSignOffAt: nowIso,
      pilotSignOffRemarks: pilotRemarks ?? null,
      pilotScope,
      legalEntityId,
    })

    nextConfig.signOffHistory = history

    // Persist confirmations so readiness sees them; keep flag off until remaining gate passes.
    await prisma.financeFeatureControl.upsert({
      where: {
        legalEntityId_featureKey: { legalEntityId, featureKey: MANUFACTURING_ACCOUNTING_FEATURE_KEY },
      },
      create: {
        tenantId,
        legalEntityId,
        featureKey: MANUFACTURING_ACCOUNTING_FEATURE_KEY,
        isEnabled: false,
        configurationJson: nextConfig as Prisma.InputJsonValue,
        updatedBy: userId,
      },
      update: {
        configurationJson: nextConfig as Prisma.InputJsonValue,
        updatedBy: userId,
        isEnabled: false,
      },
    })

    const readiness = await getManufacturingAccountingReadiness(tenantId, undefined, legalEntityId)
    const blockers = readiness.blockers.filter(
      (blocker) => !ENABLEMENT_IGNORED_BLOCKERS.has(blocker) && !SIGN_OFF_BLOCKERS.has(blocker),
    )
    if (blockers.length > 0) {
      throw new ConflictError(
        `Manufacturing accounting cannot be enabled for this legal entity: ${blockers.join(', ')}`,
        blockers.map((blocker) => ({ field: 'blockers', message: blocker })),
        {
          eventExceptionCounts: readiness.eventIntegrity?.counts ?? null,
          eventExceptions: readiness.eventIntegrity?.exceptions ?? [],
          signOffsPersisted: true,
        },
      )
    }
  }

  await prisma.financeFeatureControl.upsert({
    where: { legalEntityId_featureKey: { legalEntityId, featureKey: MANUFACTURING_ACCOUNTING_FEATURE_KEY } },
    create: {
      tenantId,
      legalEntityId,
      featureKey: MANUFACTURING_ACCOUNTING_FEATURE_KEY,
      isEnabled: input.isEnabled,
      configurationJson: nextConfig as Prisma.InputJsonValue,
      updatedBy: userId,
    },
    update: {
      isEnabled: input.isEnabled,
      configurationJson: nextConfig as Prisma.InputJsonValue,
      updatedBy: userId,
    },
  })

  return getManufacturingAccountingFeatureStatus(tenantId, legalEntityId)
}

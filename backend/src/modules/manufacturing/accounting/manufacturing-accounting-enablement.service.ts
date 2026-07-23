/**
 * Manufacturing Accounting sign-off + enable/disable lifecycle.
 * Additive ManufacturingAccountingSignOff rows + FinanceFeatureControl.configurationJson snapshot.
 */
import type { Prisma } from '@prisma/client'
import type { Request } from 'express'
import { prisma } from '../../../config/database.js'
import { assertFinanceActivated } from '../../accounting/posting/posting-currency.service.js'
import { auditFromRequest, createAuditLog } from '../../../services/audit.service.js'
import {
  AuthenticationError,
  AuthorizationError,
  ConflictError,
  NotFoundError,
  UnprocessableEntityError,
  ValidationError,
} from '../../../utils/errors.js'
import { listReconciliation } from '../costing/workspace.service.js'
import { MANUFACTURING_ACCOUNTING_FEATURE_KEY } from './manufacturing-feature-control.service.js'
import { getReadiness } from './manufacturing-accounting-readiness.service.js'

type ConfigJson = Record<string, unknown>

function asConfig(value: unknown): ConfigJson {
  if (value && typeof value === 'object' && !Array.isArray(value)) return { ...(value as ConfigJson) }
  return {}
}

function requireUser(req: Request): string {
  const userId = req.context?.userId
  if (!userId) throw new AuthenticationError('Authentication required')
  return userId
}

function hasPerm(req: Request, permission: string): boolean {
  const ctx = req.context
  if (!ctx) return false
  if (ctx.isSuperAdmin) return true
  return ctx.permissions.includes(permission)
}

async function assertLe(tenantId: string, legalEntityId: string) {
  const le = await prisma.legalEntity.findFirst({
    where: { id: legalEntityId, tenantId, isActive: true },
    select: { id: true, code: true, displayName: true },
  })
  if (!le) throw new NotFoundError('Legal entity not found for this tenant')
  return le
}

function bumpVersion(config: ConfigJson): number {
  const next = Number(config.configurationVersion ?? 0) + 1
  config.configurationVersion = next
  return next
}

async function audit(
  req: Request,
  tenantId: string,
  entityId: string,
  action: string,
  newValues: Record<string, unknown>,
) {
  const meta = auditFromRequest(req)
  await createAuditLog({
    tenantId,
    userId: meta.userId,
    module: 'manufacturing',
    entity: 'manufacturing_accounting_enablement',
    entityId,
    action,
    newValues,
    ipAddress: meta.ipAddress,
    userAgent: meta.userAgent,
  })
}

export async function createInventoryReconciliationSignOff(
  req: Request,
  tenantId: string,
  input: {
    legalEntityId: string
    inventoryReconcileConfirmed: boolean
    remarks?: string
    scope?: Record<string, unknown>
    reportRef?: string
    idempotencyKey?: string
  },
) {
  const userId = requireUser(req)
  if (
    !hasPerm(req, 'manufacturing.accounting.reconcile_signoff') &&
    !hasPerm(req, 'manufacturing.accounting.reconcile') &&
    !hasPerm(req, 'finance.settings.manage')
  ) {
    throw new AuthorizationError('Inventory reconciliation sign-off permission required')
  }
  if (input.inventoryReconcileConfirmed !== true) {
    throw new UnprocessableEntityError(
      'inventoryReconcileConfirmed must be true',
      'INVENTORY_RECONCILE_NOT_SIGNED_OFF',
      [{ field: 'inventoryReconcileConfirmed', message: 'INVENTORY_RECONCILE_NOT_SIGNED_OFF' }],
    )
  }
  await assertLe(tenantId, input.legalEntityId)
  try {
    await listReconciliation(tenantId)
  } catch {
    throw new UnprocessableEntityError(
      'Inventory/Manufacturing reconciliation checks are not available',
      'INVENTORY_RECONCILE_NOT_SIGNED_OFF',
      [{ field: 'inventoryReconcileConfirmed', message: 'RECONCILIATION_CHECKS_UNAVAILABLE' }],
    )
  }

  if (input.idempotencyKey) {
    const existing = await prisma.manufacturingAccountingSignOff.findFirst({
      where: { tenantId, idempotencyKey: input.idempotencyKey },
    })
    if (existing) return existing
  }

  const readiness = await getReadiness({
    tenantId,
    legalEntityId: input.legalEntityId,
    userId,
  })
  const now = new Date()

  return prisma.$transaction(async (tx) => {
    const priorActive = await tx.manufacturingAccountingSignOff.findFirst({
      where: {
        tenantId,
        legalEntityId: input.legalEntityId,
        signOffType: 'INVENTORY_RECONCILIATION',
        status: 'ACTIVE',
      },
      orderBy: { confirmedAt: 'desc' },
    })
    if (priorActive) {
      await tx.manufacturingAccountingSignOff.update({
        where: { id: priorActive.id },
        data: { status: 'SUPERSEDED' },
      })
    }

    const row = await tx.manufacturingAccountingSignOff.create({
      data: {
        tenantId,
        legalEntityId: input.legalEntityId,
        signOffType: 'INVENTORY_RECONCILIATION',
        status: 'ACTIVE',
        confirmedById: userId,
        confirmedAt: now,
        remarks: input.remarks ?? null,
        scopeJson: (input.scope ?? null) as Prisma.InputJsonValue,
        readinessSnapshotJson: {
          blockingCodes: readiness.blockingCodes,
          canEnable: readiness.canEnable,
        } as Prisma.InputJsonValue,
        idempotencyKey: input.idempotencyKey ?? null,
        supersedesId: priorActive?.id ?? null,
      },
    })

    const control = await tx.financeFeatureControl.findFirst({
      where: {
        tenantId,
        legalEntityId: input.legalEntityId,
        featureKey: MANUFACTURING_ACCOUNTING_FEATURE_KEY,
      },
    })
    const config = asConfig(control?.configurationJson)
    const history = Array.isArray(config.signOffHistory) ? [...(config.signOffHistory as unknown[])] : []
    config.inventoryReconcileConfirmed = true
    config.inventoryReconcileConfirmedBy = userId
    config.inventoryReconcileConfirmedAt = now.toISOString()
    config.inventoryReconcileRemarks = input.remarks ?? null
    config.inventoryReconcileScope = input.scope ?? null
    config.inventoryReconcileReportRef = input.reportRef ?? null
    config.inventoryReconcileSignOffId = row.id
    history.push({
      type: 'INVENTORY_RECONCILE',
      signOffId: row.id,
      at: now.toISOString(),
      by: userId,
    })
    config.signOffHistory = history
    bumpVersion(config)

    await tx.financeFeatureControl.upsert({
      where: {
        legalEntityId_featureKey: {
          legalEntityId: input.legalEntityId,
          featureKey: MANUFACTURING_ACCOUNTING_FEATURE_KEY,
        },
      },
      create: {
        tenantId,
        legalEntityId: input.legalEntityId,
        featureKey: MANUFACTURING_ACCOUNTING_FEATURE_KEY,
        isEnabled: false,
        configurationJson: config as Prisma.InputJsonValue,
        updatedBy: userId,
      },
      update: {
        configurationJson: config as Prisma.InputJsonValue,
        updatedBy: userId,
      },
    })

    await audit(req, tenantId, row.id, 'INVENTORY_RECONCILE_SIGNOFF', {
      legalEntityId: input.legalEntityId,
      signOffId: row.id,
      superseded: priorActive?.id ?? null,
    })

    return row
  })
}

export async function createFinancePilotSignOff(
  req: Request,
  tenantId: string,
  input: {
    legalEntityId: string
    pilotSignOff: boolean
    remarks?: string
    scope?: Record<string, unknown>
    idempotencyKey?: string
  },
) {
  const userId = requireUser(req)
  if (
    !hasPerm(req, 'manufacturing.accounting.finance_signoff') &&
    !hasPerm(req, 'finance.settings.manage')
  ) {
    throw new AuthorizationError('Finance pilot sign-off permission required')
  }
  if (input.pilotSignOff !== true) {
    throw new UnprocessableEntityError(
      'pilotSignOff must be true',
      'PILOT_FINANCE_SIGNOFF_REQUIRED',
      [{ field: 'pilotSignOff', message: 'PILOT_FINANCE_SIGNOFF_REQUIRED' }],
    )
  }
  const le = await assertLe(tenantId, input.legalEntityId)
  try {
    await assertFinanceActivated(tenantId, input.legalEntityId)
  } catch {
    throw new UnprocessableEntityError(
      'Finance setup is not activated for this legal entity',
      'PILOT_FINANCE_SIGNOFF_REQUIRED',
      [{ field: 'pilotSignOff', message: 'FINANCE_NOT_ACTIVATED' }],
    )
  }

  const readiness = await getReadiness({
    tenantId,
    legalEntityId: input.legalEntityId,
    userId,
  })
  if (!readiness.checks.accountMappings.passed) {
    throw new UnprocessableEntityError(
      'Account mappings must pass before Finance pilot sign-off',
      'MISSING_ACCOUNT_MAPPINGS',
      [{ field: 'pilotSignOff', message: 'MISSING_ACCOUNT_MAPPINGS' }],
      { missingMappings: readiness.checks.accountMappings.missingMappings },
    )
  }
  if (!readiness.checks.openFinancialPeriod.passed) {
    throw new UnprocessableEntityError(
      'Open accounting period required before Finance pilot sign-off',
      'NO_OPEN_ACCOUNTING_PERIOD',
      [{ field: 'pilotSignOff', message: 'NO_OPEN_ACCOUNTING_PERIOD' }],
    )
  }
  if (!readiness.checks.failedAccountingEvents.passed) {
    throw new UnprocessableEntityError(
      'Failed accounting events must be cleared before Finance pilot sign-off',
      'FAILED_ACCOUNTING_EVENTS',
      [{ field: 'pilotSignOff', message: 'FAILED_ACCOUNTING_EVENTS' }],
    )
  }

  if (input.idempotencyKey) {
    const existing = await prisma.manufacturingAccountingSignOff.findFirst({
      where: { tenantId, idempotencyKey: input.idempotencyKey },
    })
    if (existing) return existing
  }

  const now = new Date()
  const scope = { ...(input.scope ?? {}), legalEntityId: le.id, legalEntityCode: le.code }

  return prisma.$transaction(async (tx) => {
    const priorActive = await tx.manufacturingAccountingSignOff.findFirst({
      where: {
        tenantId,
        legalEntityId: input.legalEntityId,
        signOffType: 'FINANCE_PILOT_APPROVAL',
        status: 'ACTIVE',
      },
      orderBy: { confirmedAt: 'desc' },
    })
    if (priorActive) {
      await tx.manufacturingAccountingSignOff.update({
        where: { id: priorActive.id },
        data: { status: 'SUPERSEDED' },
      })
    }

    const row = await tx.manufacturingAccountingSignOff.create({
      data: {
        tenantId,
        legalEntityId: input.legalEntityId,
        signOffType: 'FINANCE_PILOT_APPROVAL',
        status: 'ACTIVE',
        confirmedById: userId,
        confirmedAt: now,
        remarks: input.remarks ?? null,
        scopeJson: scope as Prisma.InputJsonValue,
        readinessSnapshotJson: {
          blockingCodes: readiness.blockingCodes,
          canEnable: readiness.canEnable,
        } as Prisma.InputJsonValue,
        idempotencyKey: input.idempotencyKey ?? null,
        supersedesId: priorActive?.id ?? null,
      },
    })

    const control = await tx.financeFeatureControl.findFirst({
      where: {
        tenantId,
        legalEntityId: input.legalEntityId,
        featureKey: MANUFACTURING_ACCOUNTING_FEATURE_KEY,
      },
    })
    const config = asConfig(control?.configurationJson)
    const history = Array.isArray(config.signOffHistory) ? [...(config.signOffHistory as unknown[])] : []
    config.pilotSignOff = true
    config.pilotSignOffBy = userId
    config.pilotSignOffAt = now.toISOString()
    config.pilotSignOffRemarks = input.remarks ?? null
    config.pilotScope = scope
    config.pilotSignOffId = row.id
    history.push({ type: 'PILOT_FINANCE', signOffId: row.id, at: now.toISOString(), by: userId })
    config.signOffHistory = history
    bumpVersion(config)

    await tx.financeFeatureControl.upsert({
      where: {
        legalEntityId_featureKey: {
          legalEntityId: input.legalEntityId,
          featureKey: MANUFACTURING_ACCOUNTING_FEATURE_KEY,
        },
      },
      create: {
        tenantId,
        legalEntityId: input.legalEntityId,
        featureKey: MANUFACTURING_ACCOUNTING_FEATURE_KEY,
        isEnabled: false,
        configurationJson: config as Prisma.InputJsonValue,
        updatedBy: userId,
      },
      update: {
        configurationJson: config as Prisma.InputJsonValue,
        updatedBy: userId,
      },
    })

    await audit(req, tenantId, row.id, 'FINANCE_PILOT_SIGNOFF', {
      legalEntityId: input.legalEntityId,
      signOffId: row.id,
      superseded: priorActive?.id ?? null,
    })

    return row
  })
}

function mapBlockerToHttp(code: string): { status: 422 | 409; code: string } {
  const map: Record<string, { status: 422 | 409; code: string }> = {
    MISSING_ACCOUNT_MAPPINGS: { status: 422, code: 'MISSING_ACCOUNT_MAPPINGS' },
    NO_OPEN_ACCOUNTING_PERIOD: { status: 422, code: 'NO_OPEN_ACCOUNTING_PERIOD' },
    FAILED_ACCOUNTING_EVENTS: { status: 422, code: 'FAILED_ACCOUNTING_EVENTS' },
    INVENTORY_POSTINGS_UNRECONCILED: { status: 422, code: 'INVENTORY_POSTINGS_UNRECONCILED' },
    INVENTORY_RECONCILE_NOT_SIGNED_OFF: { status: 422, code: 'INVENTORY_RECONCILE_NOT_SIGNED_OFF' },
    PILOT_FINANCE_SIGNOFF_REQUIRED: { status: 422, code: 'PILOT_FINANCE_SIGNOFF_REQUIRED' },
  }
  return map[code] ?? { status: 409, code: 'READINESS_CHANGED' }
}

export async function enableManufacturingAccounting(
  req: Request,
  tenantId: string,
  input: {
    legalEntityId: string
    postingDate?: string
    inventoryReconcileConfirmed: boolean
    pilotSignOff: boolean
    confirmationNote?: string
    idempotencyKey?: string
  },
) {
  const userId = requireUser(req)
  if (
    !hasPerm(req, 'manufacturing.accounting.enable') &&
    !hasPerm(req, 'finance.settings.manage')
  ) {
    throw new AuthorizationError('Manufacturing Accounting enable permission required')
  }
  await assertLe(tenantId, input.legalEntityId)

  if (input.inventoryReconcileConfirmed !== true) {
    throw new UnprocessableEntityError(
      'inventoryReconcileConfirmed must be true',
      'INVENTORY_RECONCILE_NOT_SIGNED_OFF',
      [{ field: 'inventoryReconcileConfirmed', message: 'INVENTORY_RECONCILE_NOT_SIGNED_OFF' }],
    )
  }
  if (input.pilotSignOff !== true) {
    throw new UnprocessableEntityError(
      'pilotSignOff must be true',
      'PILOT_FINANCE_SIGNOFF_REQUIRED',
      [{ field: 'pilotSignOff', message: 'PILOT_FINANCE_SIGNOFF_REQUIRED' }],
    )
  }

  return prisma.$transaction(async (tx) => {
    // Row lock via update of control (or create stub) for concurrency.
    const existing = await tx.financeFeatureControl.findFirst({
      where: {
        tenantId,
        legalEntityId: input.legalEntityId,
        featureKey: MANUFACTURING_ACCOUNTING_FEATURE_KEY,
      },
    })
    if (existing?.isEnabled) {
      // Idempotent repeated enable
      return {
        status: 'ENABLED' as const,
        idempotentReplay: true,
        control: existing,
        readiness: await getReadiness({
          tenantId,
          legalEntityId: input.legalEntityId,
          postingDate: input.postingDate,
          userId,
        }),
      }
    }

    const readiness = await getReadiness({
      tenantId,
      legalEntityId: input.legalEntityId,
      postingDate: input.postingDate,
      userId,
    })

    // Explicit request confirmations + stored sign-offs
    if (!readiness.checks.inventoryReconciliation.passed) {
      throw new UnprocessableEntityError(
        'Stored inventory reconciliation sign-off is missing',
        'INVENTORY_RECONCILE_NOT_SIGNED_OFF',
        [{ field: 'inventoryReconcileConfirmed', message: 'INVENTORY_RECONCILE_NOT_SIGNED_OFF' }],
      )
    }
    if (!readiness.checks.pilotFinanceSignOff.passed) {
      throw new UnprocessableEntityError(
        'Stored Finance pilot sign-off is missing',
        'PILOT_FINANCE_SIGNOFF_REQUIRED',
        [{ field: 'pilotSignOff', message: 'PILOT_FINANCE_SIGNOFF_REQUIRED' }],
      )
    }

    const hardBlockers = readiness.blockingCodes.filter(
      (c) => c !== 'INVENTORY_RECONCILE_NOT_SIGNED_OFF' && c !== 'PILOT_FINANCE_SIGNOFF_REQUIRED',
    )
    if (hardBlockers.length > 0 || !readiness.canEnable) {
      const primary = hardBlockers[0] ?? 'READINESS_CHANGED'
      const mapped = mapBlockerToHttp(primary)
      if (mapped.status === 422) {
        throw new UnprocessableEntityError(
          `Manufacturing Accounting cannot be enabled: ${hardBlockers.join(', ')}`,
          mapped.code,
          hardBlockers.map((b) => ({ field: 'blockers', message: b })),
          { readiness },
        )
      }
      throw new ConflictError(
        `Readiness changed — Manufacturing Accounting cannot be enabled: ${hardBlockers.join(', ')}`,
        hardBlockers.map((b) => ({ field: 'blockers', message: b })),
        { code: 'READINESS_CHANGED', readiness },
      )
    }

    const nowIso = new Date().toISOString()
    const config = asConfig(existing?.configurationJson)
    config.enabledBy = userId
    config.enabledAt = nowIso
    config.activationNote = input.confirmationNote ?? null
    config.disabledBy = null
    config.disabledAt = null
    config.disableReason = null
    config.lastReadinessResult = {
      at: nowIso,
      blockingCodes: readiness.blockingCodes,
      canEnable: true,
    }
    bumpVersion(config)

    const control = await tx.financeFeatureControl.upsert({
      where: {
        legalEntityId_featureKey: {
          legalEntityId: input.legalEntityId,
          featureKey: MANUFACTURING_ACCOUNTING_FEATURE_KEY,
        },
      },
      create: {
        tenantId,
        legalEntityId: input.legalEntityId,
        featureKey: MANUFACTURING_ACCOUNTING_FEATURE_KEY,
        isEnabled: true,
        configurationJson: config as Prisma.InputJsonValue,
        updatedBy: userId,
      },
      update: {
        isEnabled: true,
        configurationJson: config as Prisma.InputJsonValue,
        updatedBy: userId,
      },
    })

    await audit(req, tenantId, control.id, 'ENABLE_SUCCEEDED', {
      legalEntityId: input.legalEntityId,
      activationNote: input.confirmationNote ?? null,
      configurationVersion: config.configurationVersion,
    })

    return {
      status: 'ENABLED' as const,
      idempotentReplay: false,
      control,
      readiness: await getReadiness({
        tenantId,
        legalEntityId: input.legalEntityId,
        postingDate: input.postingDate,
        userId,
      }),
    }
  })
}

export async function disableManufacturingAccounting(
  req: Request,
  tenantId: string,
  input: { legalEntityId: string; reason: string },
) {
  const userId = requireUser(req)
  if (
    !hasPerm(req, 'manufacturing.accounting.disable') &&
    !hasPerm(req, 'finance.settings.manage')
  ) {
    throw new AuthorizationError('Manufacturing Accounting disable permission required')
  }
  await assertLe(tenantId, input.legalEntityId)
  const reason = input.reason?.trim()
  if (!reason || reason.length < 5) {
    throw new ValidationError('Disable reason is required (min 5 characters)', [
      { field: 'reason', message: 'REQUIRED' },
    ])
  }

  const existing = await prisma.financeFeatureControl.findFirst({
    where: {
      tenantId,
      legalEntityId: input.legalEntityId,
      featureKey: MANUFACTURING_ACCOUNTING_FEATURE_KEY,
    },
  })
  if (!existing?.isEnabled) {
    return {
      status: 'DISABLED' as const,
      idempotentReplay: true,
      control: existing,
    }
  }

  const nowIso = new Date().toISOString()
  const config = asConfig(existing.configurationJson)
  config.disabledBy = userId
  config.disabledAt = nowIso
  config.disableReason = reason
  bumpVersion(config)

  const control = await prisma.financeFeatureControl.update({
    where: { id: existing.id },
    data: {
      isEnabled: false,
      configurationJson: config as Prisma.InputJsonValue,
      updatedBy: userId,
    },
  })

  // Also turn off auto-post absorption for safety when disabling accounting (tenant setting).
  // Does not delete events or GL.
  await prisma.manufacturingSettings
    .updateMany({
      where: { tenantId },
      data: { autoPostAbsorption: false },
    })
    .catch(() => undefined)

  await audit(req, tenantId, control.id, 'DISABLE_SUCCEEDED', {
    legalEntityId: input.legalEntityId,
    reason,
    note: 'Events and posted GL preserved; future auto-posting disabled',
  })

  return { status: 'DISABLED' as const, idempotentReplay: false, control }
}

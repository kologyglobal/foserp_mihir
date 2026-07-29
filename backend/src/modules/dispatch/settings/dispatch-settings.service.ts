import type { Request } from 'express'
import type { DispatchInvoiceMode, Prisma } from '@prisma/client'
import { prisma } from '../../../config/prisma.js'
import { AuthorizationError, ConflictError, ValidationError } from '../../../utils/errors.js'
import {
  DISPATCH_POSTING_POLICY_DEFAULTS,
  resolveDispatchPostingPolicy,
  type DispatchPostingPolicy,
} from '../posting/dispatch-policy.js'

export type DispatchCommercialSettingsDto = {
  version: number
  allowPartialDispatch: boolean
  allowMultipleDispatches: boolean
  allowOverDispatch: boolean
  invoiceMode: DispatchInvoiceMode
  requirePodBeforeInvoice: boolean
  /** Effective operational + commercial policy (for readiness / UI). */
  effectivePolicy: DispatchPostingPolicy
  updatedAt: string | null
  updatedBy: string | null
}

export type UpdateDispatchCommercialSettingsInput = {
  version: number
  allowPartialDispatch: boolean
  allowMultipleDispatches: boolean
  allowOverDispatch: boolean
  invoiceMode: DispatchInvoiceMode
  requirePodBeforeInvoice: boolean
}

function canManage(req: Request): boolean {
  const perms = req.context?.permissions ?? []
  return (
    Boolean(req.context?.isSuperAdmin) ||
    perms.includes('tenant.manage') ||
    perms.includes('dispatch.settings.manage') ||
    perms.includes('finance.settings.manage')
  )
}

function canView(req: Request): boolean {
  const perms = req.context?.permissions ?? []
  return (
    canManage(req) ||
    perms.includes('dispatch.view') ||
    perms.includes('dispatch.settings.view') ||
    perms.includes('dispatch.requirement.view')
  )
}

function userId(req: Request): string | null {
  return req.context?.userId ?? null
}

function toDto(
  row: {
    version: number
    allowPartialDispatch: boolean
    allowMultipleDispatches: boolean
    allowOverDispatch: boolean
    invoiceMode: DispatchInvoiceMode
    requirePodBeforeInvoice: boolean
    updatedAt: Date
    updatedBy: string | null
  } | null,
  effectivePolicy: DispatchPostingPolicy,
): DispatchCommercialSettingsDto {
  if (!row) {
    return {
      version: 0,
      allowPartialDispatch: DISPATCH_POSTING_POLICY_DEFAULTS.allowPartialDispatch,
      allowMultipleDispatches: DISPATCH_POSTING_POLICY_DEFAULTS.allowMultipleDispatches,
      allowOverDispatch: DISPATCH_POSTING_POLICY_DEFAULTS.allowOverDispatch,
      invoiceMode: DISPATCH_POSTING_POLICY_DEFAULTS.invoiceMode,
      requirePodBeforeInvoice: effectivePolicy.requirePodBeforeInvoice,
      effectivePolicy,
      updatedAt: null,
      updatedBy: null,
    }
  }
  return {
    version: row.version,
    allowPartialDispatch: row.allowPartialDispatch,
    allowMultipleDispatches: row.allowMultipleDispatches,
    allowOverDispatch: row.allowOverDispatch,
    invoiceMode: row.invoiceMode,
    requirePodBeforeInvoice: row.requirePodBeforeInvoice,
    effectivePolicy,
    updatedAt: row.updatedAt.toISOString(),
    updatedBy: row.updatedBy,
  }
}

export async function getDispatchCommercialSettings(
  req: Request,
  tenantId: string,
): Promise<DispatchCommercialSettingsDto> {
  if (!canView(req)) throw new AuthorizationError('Missing permission to view dispatch settings')
  const [row, effectivePolicy] = await Promise.all([
    prisma.dispatchSettings.findUnique({ where: { tenantId } }),
    resolveDispatchPostingPolicy(tenantId, { forceHardened: true }),
  ])
  return toDto(row, effectivePolicy)
}

export async function updateDispatchCommercialSettings(
  req: Request,
  tenantId: string,
  input: UpdateDispatchCommercialSettingsInput,
): Promise<DispatchCommercialSettingsDto> {
  if (!canManage(req)) throw new AuthorizationError('Missing permission: dispatch.settings.manage')
  if (!Number.isInteger(input.version) || input.version < 0) {
    throw new ValidationError('version is required for optimistic concurrency')
  }

  const existing = await prisma.dispatchSettings.findUnique({ where: { tenantId } })
  const expectedVersion = existing?.version ?? 0
  if (input.version !== expectedVersion) {
    throw new ConflictError(
      `Dispatch settings version conflict (expected ${expectedVersion}, got ${input.version})`,
      [{ field: 'version', message: 'VERSION_CONFLICT' }],
    )
  }

  const data: Prisma.DispatchSettingsUncheckedCreateInput = {
    tenantId,
    version: expectedVersion + 1,
    allowPartialDispatch: input.allowPartialDispatch,
    allowMultipleDispatches: input.allowMultipleDispatches,
    allowOverDispatch: input.allowOverDispatch,
    invoiceMode: input.invoiceMode,
    requirePodBeforeInvoice: input.requirePodBeforeInvoice,
    createdBy: existing?.createdBy ?? userId(req),
    updatedBy: userId(req),
  }

  const row = existing
    ? await prisma.dispatchSettings.update({
        where: { tenantId },
        data: {
          version: data.version,
          allowPartialDispatch: data.allowPartialDispatch,
          allowMultipleDispatches: data.allowMultipleDispatches,
          allowOverDispatch: data.allowOverDispatch,
          invoiceMode: data.invoiceMode,
          requirePodBeforeInvoice: data.requirePodBeforeInvoice,
          updatedBy: data.updatedBy,
        },
      })
    : await prisma.dispatchSettings.create({ data })

  const effectivePolicy = await resolveDispatchPostingPolicy(tenantId, { forceHardened: true })
  return toDto(row, effectivePolicy)
}

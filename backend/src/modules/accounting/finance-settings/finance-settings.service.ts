import type { Request } from 'express'
import { auditFromRequest, createAuditLog } from '../../../services/audit.service.js'
import { AppError, NotFoundError } from '../../../utils/errors.js'
import type { ActivateFinanceInput, FinanceSettingsQuery, UpsertFinanceSettingsInput } from './finance-settings.validation.js'
import * as repo from './finance-settings.repository.js'

function auditMeta(req: Request) {
  return auditFromRequest(req)
}

export async function getRecord(_req: Request, tenantId: string, query: FinanceSettingsQuery) {
  return repo.getSettings(tenantId, query)
}

export async function upsertRecord(req: Request, tenantId: string, input: UpsertFinanceSettingsInput) {
  const audit = auditMeta(req)
  const before = await repo.getSettings(tenantId, { legalEntityId: input.legalEntityId })
  const record = await repo.upsertSettings(tenantId, input)
  await createAuditLog({
    tenantId,
    userId: audit.userId,
    module: 'finance',
    entity: 'finance_settings',
    entityId: input.legalEntityId,
    action: 'SETTINGS_CHANGE',
    oldValues: before,
    newValues: record,
    ipAddress: audit.ipAddress,
    userAgent: audit.userAgent,
  })
  return record
}

export async function getSetupStatus(_req: Request, tenantId: string, legalEntityId: string | undefined) {
  if (!legalEntityId) throw new NotFoundError('legalEntityId query parameter is required')
  return repo.computeSetupStatus(tenantId, legalEntityId)
}

export async function activateRecord(req: Request, tenantId: string, input: ActivateFinanceInput) {
  const audit = auditMeta(req)
  const userId = req.context?.userId ?? ''
  const status = await repo.computeSetupStatus(tenantId, input.legalEntityId)
  if (!status.ready) {
    throw new AppError(422, 'Finance setup is incomplete.', 'SETUP_INCOMPLETE')
  }
  try {
    const record = await repo.activateFinance(tenantId, userId, input)
    await createAuditLog({
      tenantId,
      userId: audit.userId,
      module: 'finance',
      entity: 'finance_settings',
      entityId: input.legalEntityId,
      action: 'FINANCE_ACTIVATE',
      newValues: record,
      ipAddress: audit.ipAddress,
      userAgent: audit.userAgent,
    })
    return record
  } catch (err) {
    if (err instanceof AppError && err.code === 'SETUP_INCOMPLETE') {
      throw new AppError(422, 'Finance setup is incomplete.', 'SETUP_INCOMPLETE')
    }
    throw err
  }
}

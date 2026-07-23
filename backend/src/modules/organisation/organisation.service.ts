import type { Request } from 'express'
import type { AccountType, DefaultAccountMappingKey } from '@prisma/client'
import { prisma } from '../../config/database.js'
import { auditFromRequest, createAuditLog } from '../../services/audit.service.js'
import { InvalidStateError, ValidationError } from '../../utils/errors.js'
import * as legalEntityService from '../accounting/legal-entities/legal-entity.service.js'
import * as accountService from '../accounting/accounts/account.service.js'
import * as mappingService from '../accounting/default-mappings/default-mapping.service.js'
import * as fyService from '../accounting/financial-years/financial-year.service.js'
import * as periodService from '../accounting/accounting-periods/accounting-period.service.js'
import type { CreateAccountInput } from '../accounting/accounts/account.validation.js'
import {
  buildRegisteredAddressJson,
  resolveMappingKey,
  toOrgLegalEntityDto,
} from './organisation.dto.js'
import * as registrationRepo from './registration.repository.js'
import type {
  CreateOrgAccountInput,
  CreateOrgFiscalYearInput,
  CreateOrgLegalEntityInput,
  CreateRegistrationInput,
  ListOrgLegalEntitiesQuery,
  ListOrgPeriodsQuery,
  ListRegistrationsQuery,
  UpdateOrgLegalEntityInput,
  UpdateRegistrationInput,
  UpsertOrgMappingsInput,
} from './organisation.validation.js'

function countryCodeFromName(country: string): string {
  return country.trim().toLowerCase() === 'india' ? 'IN' : country.trim().slice(0, 2).toUpperCase()
}

function stateCodeFromGstin(gstin: string): string {
  return gstin.slice(0, 2)
}

export async function listLegalEntities(req: Request, tenantId: string, query: ListOrgLegalEntitiesQuery) {
  const result = await legalEntityService.listRecords(req, tenantId, {
    page: query.page,
    limit: query.limit,
    isActive: query.isActive,
    sortOrder: 'asc',
  })
  return {
    ...result,
    items: result.items.map(toOrgLegalEntityDto),
  }
}

export async function getLegalEntity(tenantId: string, id: string) {
  const item = await legalEntityService.getRecord(tenantId, id)
  return toOrgLegalEntityDto(item)
}

export async function createLegalEntity(req: Request, tenantId: string, input: CreateOrgLegalEntityInput) {
  const tradeName = input.tradeName?.trim() || input.legalName
  const address = buildRegisteredAddressJson(input)
  const gstin = input.gstNumber.trim().toUpperCase()
  const created = await legalEntityService.createRecord(req, tenantId, {
    code: input.code,
    legalName: input.legalName,
    displayName: tradeName,
    entityType: input.businessType,
    pan: input.pan ?? gstin.slice(2, 12),
    gstin,
    baseCurrency: 'INR',
    countryCode: countryCodeFromName(input.country),
    stateCode: stateCodeFromGstin(gstin),
    registeredAddressJson: address,
    billingAddressJson: address,
    fiscalYearStartMonth: input.fiscalYearStartMonth,
    isDefault: input.isDefault,
    initialBranch: {
      code: 'HO',
      name: 'Head Office',
      branchType: 'HEAD_OFFICE',
      gstin,
      stateCode: stateCodeFromGstin(gstin),
      addressJson: address,
    },
  })

  await prisma.legalEntity.update({
    where: { id: created.id },
    data: {
      tradeName,
      isActive: input.status !== 'INACTIVE',
    },
  })

  return getLegalEntity(tenantId, created.id)
}

export async function updateLegalEntity(
  req: Request,
  tenantId: string,
  id: string,
  input: UpdateOrgLegalEntityInput,
) {
  const existing = await legalEntityService.getRecord(tenantId, id)
  const gstin = input.gstNumber?.trim().toUpperCase()
  const tradeName = input.tradeName?.trim()
  const address =
    input.addressLine && input.city && input.state && input.postalCode && input.country
      ? buildRegisteredAddressJson({
          addressLine: input.addressLine,
          district: input.district,
          city: input.city,
          state: input.state,
          postalCode: input.postalCode,
          country: input.country,
        })
      : undefined

  await legalEntityService.updateRecord(req, tenantId, id, {
    ...(input.legalName ? { legalName: input.legalName } : {}),
    ...(tradeName || input.legalName
      ? { displayName: tradeName || input.legalName || existing.displayName }
      : {}),
    ...(input.businessType ? { entityType: input.businessType } : {}),
    ...(gstin ? { gstin, stateCode: stateCodeFromGstin(gstin), pan: input.pan ?? gstin.slice(2, 12) } : {}),
    ...(input.pan ? { pan: input.pan } : {}),
    ...(input.country ? { countryCode: countryCodeFromName(input.country) } : {}),
    ...(address ? { registeredAddressJson: address, billingAddressJson: address } : {}),
    ...(input.fiscalYearStartMonth ? { fiscalYearStartMonth: input.fiscalYearStartMonth } : {}),
    ...(input.isDefault !== undefined ? { isDefault: input.isDefault } : {}),
  })

  await prisma.legalEntity.update({
    where: { id },
    data: {
      ...(tradeName ? { tradeName } : {}),
      ...(input.status === 'INACTIVE' ? { isActive: false } : {}),
      ...(input.status === 'ACTIVE' ? { isActive: true } : {}),
    },
  })

  return getLegalEntity(tenantId, id)
}

export async function listRegistrations(tenantId: string, query: ListRegistrationsQuery) {
  return registrationRepo.listRegistrations(tenantId, query)
}

export async function createRegistration(req: Request, tenantId: string, input: CreateRegistrationInput) {
  const userId = req.context?.userId ?? ''
  const item = await registrationRepo.createRegistration(tenantId, userId, input)
  const audit = auditFromRequest(req)
  await createAuditLog({
    tenantId,
    userId: audit.userId,
    module: 'organisation',
    entity: 'organisation_registration',
    entityId: item.id,
    action: 'CREATE',
    newValues: item as unknown as Record<string, unknown>,
    ipAddress: audit.ipAddress,
    userAgent: audit.userAgent,
  })
  return item
}

export async function updateRegistration(
  req: Request,
  tenantId: string,
  id: string,
  input: UpdateRegistrationInput,
) {
  const userId = req.context?.userId ?? ''
  const item = await registrationRepo.updateRegistration(tenantId, userId, id, input)
  const audit = auditFromRequest(req)
  await createAuditLog({
    tenantId,
    userId: audit.userId,
    module: 'organisation',
    entity: 'organisation_registration',
    entityId: item.id,
    action: 'UPDATE',
    newValues: item as unknown as Record<string, unknown>,
    ipAddress: audit.ipAddress,
    userAgent: audit.userAgent,
  })
  return item
}

export async function listChartOfAccounts(req: Request, tenantId: string, legalEntityId: string) {
  return accountService.listRecords(req, tenantId, { legalEntityId, page: 1, limit: 500, sortOrder: 'asc' })
}

export async function createChartAccount(req: Request, tenantId: string, input: CreateOrgAccountInput) {
  const payload: CreateAccountInput = {
    legalEntityId: input.legalEntityId,
    accountCode: input.accountCode,
    accountName: input.accountName,
    category: input.accountGroup,
    accountType: (input.accountType as AccountType) || 'GENERAL',
    parentAccountId: input.parentAccountId ?? null,
    isGroup: false,
    normalBalance:
      input.accountGroup === 'LIABILITY' || input.accountGroup === 'EQUITY' || input.accountGroup === 'INCOME'
        ? 'CREDIT'
        : 'DEBIT',
  }
  return accountService.createRecord(req, tenantId, payload)
}

export async function listAccountMappings(req: Request, tenantId: string, legalEntityId: string) {
  const mappings = await mappingService.listRecords(req, tenantId, { legalEntityId })
  return mappings.map((m) => ({
    id: m.id,
    tenantId: m.tenantId,
    legalEntityId: m.legalEntityId,
    transactionType: m.mappingKey,
    accountId: m.accountId,
    account: m.account,
    createdAt: m.createdAt,
    updatedAt: m.updatedAt,
  }))
}

export async function upsertAccountMappings(req: Request, tenantId: string, input: UpsertOrgMappingsInput) {
  const mappings: Array<{ mappingKey: DefaultAccountMappingKey; accountId: string }> = []
  for (const row of input.mappings) {
    const resolved = resolveMappingKey(row.transactionType)
    if (!resolved) {
      throw new ValidationError(`Unknown transaction type: ${row.transactionType}`)
    }
    mappings.push({ mappingKey: resolved, accountId: row.accountId })
  }
  return mappingService.upsertRecords(req, tenantId, {
    legalEntityId: input.legalEntityId,
    mappings: mappings as Parameters<typeof mappingService.upsertRecords>[2]['mappings'],
  })
}

export async function listFiscalYears(req: Request, tenantId: string, legalEntityId: string) {
  return fyService.listRecords(req, tenantId, {
    legalEntityId,
    page: 1,
    limit: 100,
    sortOrder: 'desc',
  })
}

export async function createFiscalYear(req: Request, tenantId: string, input: CreateOrgFiscalYearInput) {
  const activateNow = input.status === 'ACTIVE'
  const created = await fyService.createRecord(req, tenantId, {
    legalEntityId: input.legalEntityId,
    name: input.financialYear,
    startDate: input.startDate,
    endDate: input.endDate,
    isCurrent: activateNow || Boolean(input.isCurrent),
  })
  if (activateNow) {
    return fyService.activateRecord(req, tenantId, created.id)
  }
  return created
}

export async function listPostingPeriods(req: Request, tenantId: string, query: ListOrgPeriodsQuery) {
  return periodService.listRecords(req, tenantId, {
    legalEntityId: query.legalEntityId,
    financialYearId: query.financialYearId,
    page: 1,
    limit: 100,
    sortOrder: 'asc',
  })
}

export async function generatePostingPeriods(req: Request, tenantId: string, financialYearId: string) {
  const fy = await fyService.getRecord(tenantId, financialYearId)
  return periodService.generateRecord(req, tenantId, {
    financialYearId,
    legalEntityId: fy.legalEntityId,
  })
}

export async function assertPeriodEditable(tenantId: string, periodId: string) {
  const period = await prisma.accountingPeriod.findFirst({ where: { id: periodId, tenantId } })
  if (!period) throw new ValidationError('Posting period not found')
  if (period.status === 'CLOSED') {
    throw new InvalidStateError('Closed periods cannot be edited')
  }
  return period
}

import { prisma } from '../../../config/database.js'
import { AppError, InvalidStateError, NotFoundError } from '../../../utils/errors.js'
import {
  MANDATORY_MAPPING_KEYS,
  REQUIRED_NUMBER_SERIES_TYPES,
} from '../shared/finance.constants.js'
import { getLegalEntityOrThrow } from '../shared/finance.helpers.js'
import type { ActivateFinanceInput, FinanceSettingsQuery, SetupMissingItem, UpsertFinanceSettingsInput } from './finance-settings.validation.js'

export async function getSettings(tenantId: string, query: FinanceSettingsQuery) {
  if (!query.legalEntityId) throw new NotFoundError('legalEntityId query parameter is required')
  await getLegalEntityOrThrow(tenantId, query.legalEntityId)
  const settings = await prisma.financeSettings.findFirst({
    where: { tenantId, legalEntityId: query.legalEntityId },
  })
  const entity = await prisma.legalEntity.findFirst({ where: { id: query.legalEntityId, tenantId } })
  return settings ?? {
    tenantId,
    legalEntityId: query.legalEntityId,
    baseCurrency: entity?.baseCurrency ?? 'INR',
    financeActivated: false,
  }
}

export async function upsertSettings(tenantId: string, input: UpsertFinanceSettingsInput) {
  await getLegalEntityOrThrow(tenantId, input.legalEntityId)
  const { legalEntityId, ...data } = input
  return prisma.financeSettings.upsert({
    where: { legalEntityId },
    create: { tenantId, legalEntityId, ...data },
    update: data,
  })
}

export async function computeSetupStatus(tenantId: string, legalEntityId: string) {
  await getLegalEntityOrThrow(tenantId, legalEntityId)
  const missing: SetupMissingItem[] = []

  const defaultEntity = await prisma.legalEntity.findFirst({
    where: { tenantId, id: legalEntityId, isDefault: true, isActive: true },
  })
  if (!defaultEntity) {
    missing.push({ key: 'DEFAULT_LEGAL_ENTITY', label: 'Default legal entity', count: 1, route: '/accounting/settings/legal-entities' })
  }

  const defaultBranch = await prisma.branch.findFirst({
    where: { tenantId, legalEntityId, isDefault: true, isActive: true },
  })
  if (!defaultBranch) {
    missing.push({ key: 'DEFAULT_BRANCH', label: 'Default active branch', count: 1, route: '/accounting/settings/branches' })
  }

  const activeFy = await prisma.financialYear.findFirst({
    where: { tenantId, legalEntityId, status: 'ACTIVE', isCurrent: true },
  })
  if (!activeFy) {
    missing.push({ key: 'ACTIVE_FINANCIAL_YEAR', label: 'Active financial year', count: 1, route: '/accounting/settings/financial-years' })
  }

  const periodCount = activeFy
    ? await prisma.accountingPeriod.count({ where: { tenantId, legalEntityId, financialYearId: activeFy.id } })
    : 0
  if (periodCount === 0) {
    missing.push({ key: 'ACCOUNTING_PERIODS', label: 'Accounting periods', count: 12, route: '/accounting/settings/periods' })
  }

  const accountCount = await prisma.account.count({ where: { tenantId, legalEntityId, isActive: true, isGroup: false } })
  if (accountCount === 0) {
    missing.push({ key: 'CHART_OF_ACCOUNTS', label: 'Chart of Accounts', count: 1, route: '/accounting/settings/chart-of-accounts' })
  }

  const mappings = await prisma.defaultAccountMapping.findMany({
    where: { tenantId, legalEntityId },
    select: { mappingKey: true },
  })
  const mappedKeys = new Set(mappings.map((m) => m.mappingKey))
  const missingMappings = MANDATORY_MAPPING_KEYS.filter((k) => !mappedKeys.has(k))
  if (missingMappings.length > 0) {
    missing.push({
      key: 'DEFAULT_ACCOUNT_MAPPING',
      label: 'Default account mappings',
      count: missingMappings.length,
      route: '/accounting/settings/default-mappings',
    })
  }

  const series = await prisma.financeNumberSeries.findMany({
    where: { tenantId, legalEntityId, isActive: true },
    select: { documentType: true },
  })
  const seriesTypes = new Set(series.map((s) => s.documentType))
  const missingSeries = REQUIRED_NUMBER_SERIES_TYPES.filter((t) => !seriesTypes.has(t))
  if (missingSeries.length > 0) {
    missing.push({
      key: 'CODE_SERIES',
      label: 'Voucher number series',
      count: missingSeries.length,
      route: '/accounting/settings/number-series',
    })
  }

  const entity = await prisma.legalEntity.findFirst({ where: { id: legalEntityId, tenantId } })
  if (!entity?.baseCurrency) {
    missing.push({ key: 'BASE_CURRENCY', label: 'Base currency', count: 1, route: '/accounting/settings' })
  }

  const settings = await prisma.financeSettings.findFirst({ where: { tenantId, legalEntityId } })
  if (settings?.financeActivated) {
    return { ready: true, missing: [], financeActivated: true }
  }

  return { ready: missing.length === 0, missing, financeActivated: false }
}

export async function activateFinance(tenantId: string, userId: string, input: ActivateFinanceInput) {
  const status = await computeSetupStatus(tenantId, input.legalEntityId)
  if (!status.ready) {
    throw new AppError(422, 'Finance setup is incomplete.', 'SETUP_INCOMPLETE', undefined)
  }

  const existing = await prisma.financeSettings.findFirst({
    where: { tenantId, legalEntityId: input.legalEntityId },
  })
  if (existing?.financeActivated) {
    throw new InvalidStateError('Finance is already activated')
  }

  return prisma.financeSettings.upsert({
    where: { legalEntityId: input.legalEntityId },
    create: {
      tenantId,
      legalEntityId: input.legalEntityId,
      financeActivated: true,
      activatedAt: new Date(),
      activatedBy: userId,
    },
    update: {
      financeActivated: true,
      activatedAt: new Date(),
      activatedBy: userId,
    },
  })
}

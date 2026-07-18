import { getLegalEntityOrThrow } from '../../shared/finance.helpers.js'
import { resolvePeriodByDate } from '../../posting/posting-period.service.js'
import { isMultiCurrencyEnabled } from '../../posting/posting-currency.service.js'
import { prisma } from '../../../../config/database.js'
import { toDecimal } from '../../shared/finance-decimal.js'
import {
  findCustomerParty,
  requireActiveCustomerParty,
} from '../customer-party/customer-party.service.js'
import { CustomerPartyNotFoundError, InactiveCustomerPartyError } from '../customer-party/customer-party.errors.js'
import type {
  SalesInvoiceCalculationInput,
  SalesInvoiceCalculationResult,
} from './sales-invoice-calculation.types.js'
import { calculateSalesInvoice } from './sales-invoice-calculation.service.js'
import { calcError, calcWarning } from './sales-invoice-calculation.errors.js'
import type {
  CustomerReadiness,
  PeriodReadiness,
  SalesInvoiceValidationPreview,
} from '../validation/invoice-validation.types.js'
import { checkInvoiceAccountReadiness } from '../validation/invoice-account-readiness.service.js'
import { validateLineCostCentres } from '../validation/invoice-cost-centre.validator.js'
import { validateGstin } from '../validation/gstin.validator.js'
import { validatePan } from '../validation/pan.validator.js'
import { validateStateCode } from '../validation/state-code.validator.js'

export async function validateSalesInvoiceDraft(
  input: SalesInvoiceCalculationInput,
  context: { tenantId: string },
): Promise<SalesInvoiceValidationPreview> {
  const { tenantId } = context
  const errors: import('./sales-invoice-calculation.types.js').CalculationIssue[] = []
  const warnings: import('./sales-invoice-calculation.types.js').CalculationIssue[] = []

  const legalEntity = await getLegalEntityOrThrow(tenantId, input.legalEntityId)
  const enrichedInput: SalesInvoiceCalculationInput = {
    ...input,
    legalEntityStateCode: input.legalEntityStateCode ?? legalEntity.stateCode,
    placeOfSupply: input.placeOfSupply ?? null,
    postingDate: input.postingDate ?? input.invoiceDate,
  }

  const leStateCheck = validateStateCode(enrichedInput.legalEntityStateCode)
  if (!leStateCheck.valid) {
    errors.push(calcError(leStateCheck.code, leStateCheck.message ?? 'Invalid legal entity state', 'legalEntityStateCode'))
  }
  if (enrichedInput.placeOfSupply) {
    const posCheck = validateStateCode(enrichedInput.placeOfSupply)
    if (!posCheck.valid) {
      errors.push(calcError(posCheck.code, posCheck.message ?? 'Invalid place of supply', 'placeOfSupply'))
    }
  }

  const customerReadiness = await resolveCustomerReadiness(tenantId, input.customerId, errors, warnings)

  if (customerReadiness.party?.gstin) {
    const gstinCheck = validateGstin(customerReadiness.party.gstin)
    if (!gstinCheck.valid) {
      warnings.push(calcWarning(gstinCheck.code, gstinCheck.message ?? 'Invalid customer GSTIN', 'customerGstin'))
    }
  }
  if (customerReadiness.party?.pan) {
    const panCheck = validatePan(customerReadiness.party.pan)
    if (!panCheck.valid) {
      warnings.push(calcWarning(panCheck.code, panCheck.message ?? 'Invalid customer PAN', 'customerPan'))
    }
  }

  await checkMultiCurrency(tenantId, input.legalEntityId, enrichedInput, errors)

  const calculation: SalesInvoiceCalculationResult = calculateSalesInvoice(enrichedInput)
  errors.push(...calculation.errors)
  warnings.push(...calculation.warnings)

  const costCentreIssues = await validateLineCostCentres(
    tenantId,
    input.legalEntityId,
    input.lines.map((l) => l.costCentreId),
  )
  for (const issue of costCentreIssues) {
    if (issue.severity === 'error') errors.push(issue)
    else warnings.push(issue)
  }

  const accountReadiness = await checkInvoiceAccountReadiness(
    tenantId,
    input.legalEntityId,
    calculation,
    input.lines.map((l) => l.revenueAccountId),
  )
  for (const item of accountReadiness) {
    errors.push(...item.issues.filter((i) => i.severity === 'error'))
    warnings.push(...item.issues.filter((i) => i.severity === 'warning'))
  }

  const periodReadiness = await resolvePeriodReadiness(
    tenantId,
    input.legalEntityId,
    enrichedInput.postingDate,
    errors,
    warnings,
  )

  return {
    valid: errors.length === 0,
    calculation,
    customerReadiness,
    accountReadiness,
    periodReadiness,
    errors,
    warnings,
  }
}

async function checkMultiCurrency(
  tenantId: string,
  legalEntityId: string,
  input: SalesInvoiceCalculationInput,
  errors: import('./sales-invoice-calculation.types.js').CalculationIssue[],
): Promise<void> {
  const settings = await prisma.financeSettings.findFirst({ where: { tenantId, legalEntityId } })
  const baseCurrency = settings?.baseCurrency ?? 'INR'
  const currencyCode = input.currencyCode ?? 'INR'
  const exchangeRate = input.exchangeRate ?? '1'
  const usesForeignCurrency = currencyCode !== baseCurrency
  const usesNonUnityRate = !toDecimal(exchangeRate).eq(1)

  if (!usesForeignCurrency && !usesNonUnityRate) return

  const enabled = await isMultiCurrencyEnabled(tenantId, legalEntityId)
  if (!enabled) {
    errors.push(
      calcError(
        'MULTI_CURRENCY_DISABLED',
        'Foreign currency or non-unity exchange rate requires MULTI_CURRENCY feature',
        'currencyCode',
      ),
    )
  }
}

async function resolveCustomerReadiness(
  tenantId: string,
  customerId: string | undefined,
  errors: import('./sales-invoice-calculation.types.js').CalculationIssue[],
  warnings: import('./sales-invoice-calculation.types.js').CalculationIssue[],
): Promise<CustomerReadiness> {
  if (!customerId) {
    warnings.push(calcWarning('CUSTOMER_NOT_SPECIFIED', 'Customer is not specified for validation'))
    return { found: false, active: false, party: null, issues: [] }
  }

  try {
    const party = await requireActiveCustomerParty(tenantId, customerId)
    return { found: true, active: true, party, issues: [] }
  } catch (e) {
    if (e instanceof CustomerPartyNotFoundError) {
      errors.push(calcError('CUSTOMER_NOT_FOUND', e.message, 'customerId'))
      return { found: false, active: false, party: null, issues: [] }
    }
    if (e instanceof InactiveCustomerPartyError) {
      errors.push(calcError('CUSTOMER_INACTIVE', e.message, 'customerId'))
      const party = await findCustomerParty(tenantId, customerId)
      return { found: party != null, active: false, party, issues: [] }
    }
    throw e
  }
}

async function resolvePeriodReadiness(
  tenantId: string,
  legalEntityId: string,
  postingDate: string | undefined,
  errors: import('./sales-invoice-calculation.types.js').CalculationIssue[],
  warnings: import('./sales-invoice-calculation.types.js').CalculationIssue[],
): Promise<PeriodReadiness | null> {
  if (!postingDate) return null

  const issues: import('./sales-invoice-calculation.types.js').CalculationIssue[] = []
  try {
    const resolved = await resolvePeriodByDate(tenantId, legalEntityId, postingDate)
    const financialYearActive = resolved.financialYear.status === 'ACTIVE'
    const periodOpen = resolved.period.status === 'OPEN' || resolved.period.status === 'REOPENED'

    if (!financialYearActive) {
      issues.push(calcError('FINANCIAL_YEAR_INACTIVE', 'Financial year is not active', 'postingDate'))
    }
    if (resolved.period.status === 'CLOSED') {
      warnings.push(calcWarning('ACCOUNTING_PERIOD_CLOSED', 'Accounting period is closed — draft can be saved but posting will be blocked', 'postingDate'))
    } else if (resolved.period.status === 'UNDER_REVIEW') {
      warnings.push(calcWarning('ACCOUNTING_PERIOD_UNDER_REVIEW', 'Accounting period is under review', 'postingDate'))
    } else if (!periodOpen) {
      issues.push(calcError('ACCOUNTING_PERIOD_NOT_OPEN', `Accounting period status ${resolved.period.status} does not allow posting`, 'postingDate'))
    }

    errors.push(...issues.filter((i) => i.severity === 'error'))
    warnings.push(...issues.filter((i) => i.severity === 'warning'))

    return {
      resolved: true,
      financialYearId: resolved.financialYear.id,
      periodId: resolved.period.id,
      financialYearActive,
      periodOpen,
      issues,
    }
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Could not resolve posting period'
    const issue = calcError('ACCOUNTING_PERIOD_NOT_FOUND', message, 'postingDate')
    issues.push(issue)
    errors.push(issue)
    return {
      resolved: false,
      financialYearId: null,
      periodId: null,
      financialYearActive: false,
      periodOpen: false,
      issues,
    }
  }
}

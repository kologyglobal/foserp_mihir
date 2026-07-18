import type { DefaultAccountMappingKey } from '@prisma/client'
import { prisma } from '../../../../config/database.js'
import {
  MAPPING_KEY_ACCOUNT_TYPES,
  MAPPING_KEY_CATEGORIES,
} from '../../shared/finance.constants.js'
import { assertAccountForMapping } from '../../shared/finance.helpers.js'
import type { CalculationIssue, SalesInvoiceCalculationResult } from '../calculation/sales-invoice-calculation.types.js'
import { calcError } from '../calculation/sales-invoice-calculation.errors.js'
import { needsRoundingAccount } from '../calculation/invoice-rounding.service.js'
import { isZero } from '../../shared/finance-decimal.js'
import type { AccountReadinessItem } from './invoice-validation.types.js'

const MAPPING_KEY_MISSING_CODES: Partial<Record<DefaultAccountMappingKey, string>> = {
  CUSTOMER_RECEIVABLE: 'CUSTOMER_RECEIVABLE_ACCOUNT_MISSING',
  SALES_REVENUE: 'SALES_REVENUE_ACCOUNT_MISSING',
  GST_OUTPUT_CGST: 'GST_OUTPUT_CGST_ACCOUNT_MISSING',
  GST_OUTPUT_SGST: 'GST_OUTPUT_SGST_ACCOUNT_MISSING',
  GST_OUTPUT_IGST: 'GST_OUTPUT_IGST_ACCOUNT_MISSING',
  GST_OUTPUT_CESS: 'GST_OUTPUT_CESS_ACCOUNT_MISSING',
  FREIGHT_OUTWARD: 'FREIGHT_ACCOUNT_MISSING',
  ROUNDING: 'ROUNDING_ACCOUNT_MISSING',
}

function mappingMissingCode(mappingKey: DefaultAccountMappingKey): string {
  return MAPPING_KEY_MISSING_CODES[mappingKey] ?? 'ACCOUNT_MAPPING_MISSING'
}

function assertMappingCompatibility(
  mappingKey: DefaultAccountMappingKey,
  account: { accountType: string; category: string },
): CalculationIssue | null {
  const allowedTypes = MAPPING_KEY_ACCOUNT_TYPES[mappingKey]
  if (allowedTypes?.length && !allowedTypes.includes(account.accountType as never)) {
    const allowedCategories = MAPPING_KEY_CATEGORIES[mappingKey]
    if (!allowedCategories?.includes(account.category as never)) {
      return calcError('ACCOUNT_TYPE_INCOMPATIBLE', `Account type incompatible with mapping key ${mappingKey}`, mappingKey)
    }
  }
  return null
}

async function checkMapping(
  tenantId: string,
  legalEntityId: string,
  mappingKey: DefaultAccountMappingKey,
  required: boolean,
): Promise<AccountReadinessItem> {
  const issues: CalculationIssue[] = []
  const mapping = await prisma.defaultAccountMapping.findFirst({
    where: { tenantId, legalEntityId, mappingKey },
    include: {
      account: {
        select: {
          id: true,
          accountCode: true,
          accountName: true,
          isGroup: true,
          isActive: true,
          accountType: true,
          category: true,
        },
      },
    },
  })

  if (!mapping?.account) {
    if (required) {
      issues.push(
        calcError(
          mappingMissingCode(mappingKey),
          `Default account mapping ${mappingKey} is not configured`,
          mappingKey,
        ),
      )
    }
    return {
      mappingKey,
      required,
      configured: false,
      accountId: null,
      accountCode: null,
      accountName: null,
      valid: !required,
      issues,
    }
  }

  const account = mapping.account
  try {
    assertAccountForMapping(account as import('@prisma/client').Account)
  } catch (e) {
    issues.push(calcError('ACCOUNT_NOT_POSTABLE', e instanceof Error ? e.message : 'Account not postable', mappingKey))
  }

  const compatIssue = assertMappingCompatibility(mappingKey, account)
  if (compatIssue) issues.push(compatIssue)

  return {
    mappingKey,
    required,
    configured: true,
    accountId: account.id,
    accountCode: account.accountCode,
    accountName: account.accountName,
    valid: issues.length === 0,
    issues,
  }
}

export async function checkInvoiceAccountReadiness(
  tenantId: string,
  legalEntityId: string,
  calculation: SalesInvoiceCalculationResult,
  lineRevenueAccountIds: Array<string | null | undefined>,
): Promise<AccountReadinessItem[]> {
  const hasCess = !isZero(calculation.cessAmount)
  const hasFreight = !isZero(calculation.freightAmount)
  const hasRounding = needsRoundingAccount(calculation.roundOffAmount)
  const hasFreightTax =
    !isZero(calculation.freightCgstAmount) ||
    !isZero(calculation.freightSgstAmount) ||
    !isZero(calculation.freightIgstAmount)

  const keys: Array<{ key: DefaultAccountMappingKey; required: boolean }> = [
    { key: 'CUSTOMER_RECEIVABLE', required: true },
    { key: 'SALES_REVENUE', required: true },
    { key: 'GST_OUTPUT_CGST', required: !isZero(calculation.cgstAmount) },
    { key: 'GST_OUTPUT_SGST', required: !isZero(calculation.sgstAmount) },
    { key: 'GST_OUTPUT_IGST', required: !isZero(calculation.igstAmount) },
    { key: 'GST_OUTPUT_CESS', required: hasCess },
    { key: 'FREIGHT_OUTWARD', required: hasFreight || hasFreightTax },
    { key: 'ROUNDING', required: hasRounding },
  ]

  const results: AccountReadinessItem[] = []
  for (const { key, required } of keys) {
    results.push(await checkMapping(tenantId, legalEntityId, key, required))
  }

  const uniqueRevenueIds = [...new Set(lineRevenueAccountIds.filter((id): id is string => Boolean(id)))]
  for (const accountId of uniqueRevenueIds) {
    const account = await prisma.account.findFirst({
      where: { id: accountId, tenantId, legalEntityId },
    })
    const issues: CalculationIssue[] = []
    if (!account) {
      issues.push(calcError('REVENUE_ACCOUNT_NOT_FOUND', `Revenue account ${accountId} not found`, 'revenueAccountId'))
    } else {
      try {
        assertAccountForMapping(account)
      } catch (e) {
        issues.push(calcError('REVENUE_ACCOUNT_NOT_POSTABLE', e instanceof Error ? e.message : 'Invalid revenue account', 'revenueAccountId'))
      }
    }
    results.push({
      mappingKey: `LINE_REVENUE:${accountId}`,
      required: true,
      configured: account != null,
      accountId: account?.id ?? accountId,
      accountCode: account?.accountCode ?? null,
      accountName: account?.accountName ?? null,
      valid: issues.length === 0,
      issues,
    })
  }

  return results
}

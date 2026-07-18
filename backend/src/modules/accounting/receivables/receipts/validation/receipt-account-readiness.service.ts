import type { Account, DefaultAccountMappingKey } from '@prisma/client'
import { prisma } from '../../../../../config/database.js'
import {
  MAPPING_KEY_ACCOUNT_TYPES,
  MAPPING_KEY_CATEGORIES,
} from '../../../shared/finance.constants.js'
import { assertAccountForMapping } from '../../../shared/finance.helpers.js'
import { isPositive, toDecimal } from '../../../shared/finance-decimal.js'
import type {
  CustomerReceiptCalculationInput,
  CustomerReceiptCalculationResult,
  MappingValidationResult,
  ReceiptValidationIssue,
} from '../calculation/customer-receipt-calculation.types.js'
import {
  RECEIPT_ERROR_CODES,
  receiptError,
} from '../calculation/customer-receipt-calculation.errors.js'

const BANK_CASH_TYPES = new Set(['BANK', 'CASH'])

function emptyMapping(mappingKey: string, required: boolean, issues: ReceiptValidationIssue[] = []): MappingValidationResult {
  return {
    mappingKey,
    required,
    configured: false,
    accountId: null,
    accountCode: null,
    accountName: null,
    valid: !required && issues.length === 0,
    issues,
  }
}

function assertMappingCompatibility(
  mappingKey: DefaultAccountMappingKey,
  account: { accountType: string; category: string },
): ReceiptValidationIssue | null {
  const allowedTypes = MAPPING_KEY_ACCOUNT_TYPES[mappingKey]
  if (allowedTypes?.length && !allowedTypes.includes(account.accountType as never)) {
    const allowedCategories = MAPPING_KEY_CATEGORIES[mappingKey]
    if (!allowedCategories?.includes(account.category as never)) {
      return receiptError(
        RECEIPT_ERROR_CODES.RECEIPT_RECEIVABLE_ACCOUNT_INVALID,
        `Account type incompatible with mapping key ${mappingKey}`,
        mappingKey,
      )
    }
  }
  return null
}

async function loadMapping(
  tenantId: string,
  legalEntityId: string,
  mappingKey: DefaultAccountMappingKey,
): Promise<{ account: Account | null }> {
  const mapping = await prisma.defaultAccountMapping.findFirst({
    where: { tenantId, legalEntityId, mappingKey },
    include: { account: true },
  })
  return { account: mapping?.account ?? null }
}

async function validateAccountById(
  tenantId: string,
  legalEntityId: string,
  accountId: string,
  field: string,
  invalidCode: string,
  options?: { allowedTypes?: string[]; allowedCategories?: string[]; cashOnly?: boolean },
): Promise<MappingValidationResult> {
  const issues: ReceiptValidationIssue[] = []
  const account = await prisma.account.findFirst({
    where: { id: accountId, tenantId, legalEntityId },
  })

  if (!account) {
    issues.push(receiptError(invalidCode, 'Account not found in this legal entity', field))
    return emptyMapping(field, true, issues)
  }

  try {
    assertAccountForMapping(account)
  } catch (e) {
    issues.push(
      receiptError(invalidCode, e instanceof Error ? e.message : 'Account not postable', field),
    )
  }

  if (options?.allowedTypes?.length && !options.allowedTypes.includes(account.accountType)) {
    if (
      !options.allowedCategories?.length ||
      !options.allowedCategories.includes(account.category)
    ) {
      issues.push(receiptError(invalidCode, `Account type ${account.accountType} is not compatible`, field))
    }
  }

  if (options?.cashOnly && account.accountType !== 'CASH') {
    issues.push(
      receiptError(
        RECEIPT_ERROR_CODES.RECEIPT_BANK_CASH_ACCOUNT_INVALID,
        'Cash payment method requires a CASH account',
        field,
      ),
    )
  }

  return {
    mappingKey: field,
    required: true,
    configured: true,
    accountId: account.id,
    accountCode: account.accountCode,
    accountName: account.accountName,
    valid: issues.length === 0,
    issues,
  }
}

async function resolveMappedOrInput(
  tenantId: string,
  legalEntityId: string,
  inputAccountId: string | null | undefined,
  mappingKey: DefaultAccountMappingKey,
  required: boolean,
  missingCode: string,
  invalidCode: string,
): Promise<MappingValidationResult> {
  if (inputAccountId) {
    const result = await validateAccountById(
      tenantId,
      legalEntityId,
      inputAccountId,
      mappingKey,
      invalidCode,
    )
    // Also check mapping-key compatibility when resolving TDS / BANK_CHARGES / receivable
    if (result.accountId) {
      const account = await prisma.account.findFirst({
        where: { id: result.accountId, tenantId, legalEntityId },
      })
      if (account) {
        const compat = assertMappingCompatibility(mappingKey, account)
        // For BANK_CHARGES, category EXPENSE is enough via MAPPING_KEY_CATEGORIES when type is GENERAL/EXPENSE
        if (compat && mappingKey !== 'BANK_CHARGES') {
          // CUSTOMER_RECEIVABLE and TDS_RECEIVABLE enforce types
          if (mappingKey === 'CUSTOMER_RECEIVABLE' || mappingKey === 'TDS_RECEIVABLE') {
            const allowedTypes = MAPPING_KEY_ACCOUNT_TYPES[mappingKey]
            if (allowedTypes?.length && !allowedTypes.includes(account.accountType as never)) {
              result.issues.push(
                receiptError(invalidCode, `Account must be type ${allowedTypes.join('|')}`, mappingKey),
              )
              result.valid = false
            }
          }
        }
        if (mappingKey === 'BANK_CHARGES' && account.category !== 'EXPENSE' && account.accountType !== 'EXPENSE') {
          result.issues.push(
            receiptError(invalidCode, 'Bank charge account must be an expense account', mappingKey),
          )
          result.valid = false
        }
      }
    }
    return { ...result, mappingKey, required }
  }

  const { account } = await loadMapping(tenantId, legalEntityId, mappingKey)
  if (!account) {
    const issues: ReceiptValidationIssue[] = []
    if (required) {
      issues.push(receiptError(missingCode, `Default account mapping ${mappingKey} is not configured`, mappingKey))
    }
    return emptyMapping(mappingKey, required, issues)
  }

  const issues: ReceiptValidationIssue[] = []
  try {
    assertAccountForMapping(account)
  } catch (e) {
    issues.push(receiptError(invalidCode, e instanceof Error ? e.message : 'Account not postable', mappingKey))
  }
  const compat = assertMappingCompatibility(mappingKey, account)
  if (compat) issues.push(compat)

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

export interface ReceiptAccountReadiness {
  bankCash: MappingValidationResult
  customerReceivable: MappingValidationResult
  customerTds: MappingValidationResult
  bankCharges: MappingValidationResult[]
  otherDeductions: MappingValidationResult[]
  resolved: {
    bankCashAccountId: string | null
    customerReceivableAccountId: string | null
    customerTdsAccountId: string | null
    bankChargeAccountIds: Array<string | null>
    otherDeductionAccountIds: Array<string | null>
  }
}

export async function checkReceiptAccountReadiness(
  tenantId: string,
  legalEntityId: string,
  input: CustomerReceiptCalculationInput,
  calculation: CustomerReceiptCalculationResult,
): Promise<ReceiptAccountReadiness> {
  const tdsRequired = isPositive(calculation.customerTdsAmount)
  const chargesRequired = isPositive(calculation.bankChargeAmount)

  // Bank/cash — must be explicit input (no mapping key for operational bank/cash)
  let bankCash: MappingValidationResult
  if (!input.bankCashAccountId) {
    bankCash = emptyMapping('BANK_CASH', true, [
      receiptError(
        RECEIPT_ERROR_CODES.RECEIPT_BANK_CASH_ACCOUNT_MISSING,
        'Bank/cash account is mandatory',
        'bankCashAccountId',
      ),
    ])
  } else {
    bankCash = await validateAccountById(
      tenantId,
      legalEntityId,
      input.bankCashAccountId,
      'bankCashAccountId',
      RECEIPT_ERROR_CODES.RECEIPT_BANK_CASH_ACCOUNT_INVALID,
      {
        allowedTypes: [...BANK_CASH_TYPES],
        cashOnly: input.paymentMethod === 'CASH',
      },
    )
    // Ensure BANK or CASH
    if (bankCash.accountId) {
      const acct = await prisma.account.findFirst({
        where: { id: bankCash.accountId, tenantId, legalEntityId },
      })
      if (acct && !BANK_CASH_TYPES.has(acct.accountType)) {
        bankCash.issues.push(
          receiptError(
            RECEIPT_ERROR_CODES.RECEIPT_BANK_CASH_ACCOUNT_INVALID,
            'Account must be BANK or CASH type',
            'bankCashAccountId',
          ),
        )
        bankCash.valid = false
      }
    }
  }

  const customerReceivable = await resolveMappedOrInput(
    tenantId,
    legalEntityId,
    input.customerReceivableAccountId,
    'CUSTOMER_RECEIVABLE',
    true,
    RECEIPT_ERROR_CODES.RECEIPT_RECEIVABLE_ACCOUNT_MISSING,
    RECEIPT_ERROR_CODES.RECEIPT_RECEIVABLE_ACCOUNT_INVALID,
  )

  const customerTds = await resolveMappedOrInput(
    tenantId,
    legalEntityId,
    input.customerTds?.accountId,
    'TDS_RECEIVABLE',
    tdsRequired,
    RECEIPT_ERROR_CODES.CUSTOMER_TDS_ACCOUNT_MISSING,
    RECEIPT_ERROR_CODES.CUSTOMER_TDS_ACCOUNT_MISSING,
  )

  const bankCharges: MappingValidationResult[] = []
  const bankChargeAccountIds: Array<string | null> = []
  const chargeInputs = input.bankCharges ?? []
  if (chargeInputs.length) {
    for (let i = 0; i < chargeInputs.length; i++) {
      const row = chargeInputs[i]!
      if (!isPositive(toDecimal(row.amount))) continue
      const resolved = await resolveMappedOrInput(
        tenantId,
        legalEntityId,
        row.accountId,
        'BANK_CHARGES',
        true,
        RECEIPT_ERROR_CODES.BANK_CHARGE_ACCOUNT_MISSING,
        RECEIPT_ERROR_CODES.BANK_CHARGE_ACCOUNT_MISSING,
      )
      bankCharges.push(resolved)
      bankChargeAccountIds.push(resolved.accountId)
    }
  } else if (chargesRequired) {
    const resolved = await resolveMappedOrInput(
      tenantId,
      legalEntityId,
      null,
      'BANK_CHARGES',
      true,
      RECEIPT_ERROR_CODES.BANK_CHARGE_ACCOUNT_MISSING,
      RECEIPT_ERROR_CODES.BANK_CHARGE_ACCOUNT_MISSING,
    )
    bankCharges.push(resolved)
    bankChargeAccountIds.push(resolved.accountId)
  }

  const otherDeductions: MappingValidationResult[] = []
  const otherDeductionAccountIds: Array<string | null> = []
  for (let i = 0; i < (input.otherDeductions ?? []).length; i++) {
    const row = input.otherDeductions![i]!
    if (!isPositive(toDecimal(row.amount))) continue
    if (!row.accountId) {
      const issues = [
        receiptError(
          RECEIPT_ERROR_CODES.OTHER_DEDUCTION_ACCOUNT_MISSING,
          'Other deduction account is required when amount is non-zero',
          'otherDeductions.accountId',
          { rowIndex: i },
        ),
      ]
      otherDeductions.push(emptyMapping(`OTHER_DEDUCTION:${i}`, true, issues))
      otherDeductionAccountIds.push(null)
      continue
    }
    const resolved = await validateAccountById(
      tenantId,
      legalEntityId,
      row.accountId,
      `otherDeductions[${i}].accountId`,
      RECEIPT_ERROR_CODES.OTHER_DEDUCTION_ACCOUNT_MISSING,
    )
    otherDeductions.push(resolved)
    otherDeductionAccountIds.push(resolved.accountId)
  }

  return {
    bankCash,
    customerReceivable,
    customerTds,
    bankCharges,
    otherDeductions,
    resolved: {
      bankCashAccountId: bankCash.accountId,
      customerReceivableAccountId: customerReceivable.accountId,
      customerTdsAccountId: customerTds.accountId,
      bankChargeAccountIds,
      otherDeductionAccountIds,
    },
  }
}

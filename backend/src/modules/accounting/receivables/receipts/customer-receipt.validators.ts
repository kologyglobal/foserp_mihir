import type { Account, ReceivableOpenItem } from '@prisma/client'
import { prisma } from '../../../../config/database.js'
import {
  CustomerReceiptAccountOwnershipError,
  CustomerReceiptAllocationCustomerMismatchError,
  CustomerReceiptAllocationSideMismatchError,
  CustomerReceiptInvalidBankCashAccountError,
} from './customer-receipt.errors.js'
import { assertCreditOpenItem, assertDebitOpenItem } from './receivable-open-item-side.validators.js'

const BANK_CASH_TYPES = new Set<Account['accountType']>(['BANK', 'CASH'])

export async function requireAccountInLegalEntity(
  tenantId: string,
  legalEntityId: string,
  accountId: string,
  field: string,
): Promise<Account> {
  const account = await prisma.account.findFirst({
    where: { id: accountId, tenantId, legalEntityId, isActive: true },
  })
  if (!account) {
    throw new CustomerReceiptAccountOwnershipError(field)
  }
  return account
}

export async function requireBankCashAccount(
  tenantId: string,
  legalEntityId: string,
  bankCashAccountId: string,
): Promise<Account> {
  const account = await requireAccountInLegalEntity(tenantId, legalEntityId, bankCashAccountId, 'bankCashAccountId')
  if (!BANK_CASH_TYPES.has(account.accountType)) {
    throw new CustomerReceiptInvalidBankCashAccountError()
  }
  return account
}

export function assertAllocationSameCustomer(
  receiptCustomerId: string,
  invoiceCustomerId: string,
  invoiceOpenItemCustomerId: string,
): void {
  if (receiptCustomerId !== invoiceCustomerId || receiptCustomerId !== invoiceOpenItemCustomerId) {
    throw new CustomerReceiptAllocationCustomerMismatchError()
  }
}

export function assertAllocationOpenItemSides(
  receiptOpenItem: Pick<ReceivableOpenItem, 'side' | 'customerId'>,
  invoiceOpenItem: Pick<ReceivableOpenItem, 'side' | 'customerId'>,
  receiptCustomerId: string,
): void {
  try {
    assertCreditOpenItem(receiptOpenItem.side)
  } catch {
    throw new CustomerReceiptAllocationSideMismatchError('Receipt open item must be side=CREDIT')
  }
  try {
    assertDebitOpenItem(invoiceOpenItem.side)
  } catch {
    throw new CustomerReceiptAllocationSideMismatchError('Invoice open item must be side=DEBIT')
  }
  assertAllocationSameCustomer(receiptCustomerId, invoiceOpenItem.customerId, receiptOpenItem.customerId)
}

import type { PaymentMethod } from '../../types/paymentMaster'

const now = () => new Date().toISOString()

export const seedPaymentMethods: PaymentMethod[] = [
  { id: 'pay-neft', code: 'NEFT', description: 'NEFT Bank Transfer', balAccountType: 'bank_account', balAccountNo: 'BANK-MAIN', directDebit: false, isActive: true, createdAt: now(), updatedAt: now() },
  { id: 'pay-rtgs', code: 'RTGS', description: 'RTGS Bank Transfer', balAccountType: 'bank_account', balAccountNo: 'BANK-MAIN', directDebit: false, isActive: true, createdAt: now(), updatedAt: now() },
  { id: 'pay-bank', code: 'BANK', description: 'Bank Transfer', balAccountType: 'bank_account', balAccountNo: 'BANK-MAIN', directDebit: false, isActive: true, createdAt: now(), updatedAt: now() },
  { id: 'pay-cheque', code: 'CHEQUE', description: 'Cheque Payment', balAccountType: 'bank_account', balAccountNo: 'BANK-MAIN', directDebit: false, isActive: true, createdAt: now(), updatedAt: now() },
  { id: 'pay-cash', code: 'CASH', description: 'Cash Payment', balAccountType: 'gl_account', balAccountNo: 'CASH-001', directDebit: false, isActive: true, createdAt: now(), updatedAt: now() },
  { id: 'pay-upi', code: 'UPI', description: 'UPI Payment', balAccountType: 'bank_account', balAccountNo: 'BANK-MAIN', directDebit: false, isActive: true, createdAt: now(), updatedAt: now() },
  { id: 'pay-dd', code: 'DD', description: 'Direct Debit', balAccountType: 'bank_account', balAccountNo: 'BANK-MAIN', directDebit: true, isActive: true, createdAt: now(), updatedAt: now() },
]

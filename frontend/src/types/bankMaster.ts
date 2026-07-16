import type { MasterRecordAudit } from './master'

/** BC Bank — lookup for bank account card */
export interface Bank extends MasterRecordAudit {
  id: string
  /** Bank code (max 10) */
  code: string
  name: string
  isActive: boolean
  createdAt: string
  updatedAt: string
}

/** BC Bank Account — company / vendor bank account register */
export interface BankAccount extends MasterRecordAudit {
  id: string
  /** Bank account code (max 20) */
  code: string
  bankId: string
  address: string
  address2?: string
  postCode: string
  city: string
  state: string
  country: string
  phone: string
  email: string
  /** ISO currency code */
  currencyCode: string
  bankAccountName: string
  bankAccountNo: string
  bankBranchCode: string
  ifscCode: string
  isActive: boolean
  createdAt: string
  updatedAt: string
}

export const CURRENCY_CODE_OPTIONS = [
  { code: 'INR', label: 'INR — Indian Rupee' },
  { code: 'USD', label: 'USD — US Dollar' },
  { code: 'EUR', label: 'EUR — Euro' },
  { code: 'GBP', label: 'GBP — British Pound' },
  { code: 'AED', label: 'AED — UAE Dirham' },
] as const

export type CurrencyCode = (typeof CURRENCY_CODE_OPTIONS)[number]['code']

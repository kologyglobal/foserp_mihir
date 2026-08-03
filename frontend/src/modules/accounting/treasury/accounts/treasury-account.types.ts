export type TreasuryAccountType = 'BANK' | 'CASH' | 'CLEARING'
export type TreasuryAccountStatus = 'ACTIVE' | 'INACTIVE' | 'CLOSED'
export type TreasuryBankAccountKind =
  | 'CURRENT'
  | 'SAVINGS'
  | 'OVERDRAFT'
  | 'CASH_CREDIT'
  | 'ESCROW'
  | 'VIRTUAL'
  | 'NOSTRO'
  | 'OTHER'

export interface TreasuryBankProfileDto {
  id: string
  bankName: string
  branchName?: string | null
  ifscCode?: string | null
  swiftCode?: string | null
  micrCode?: string | null
  bankAccountKind: TreasuryBankAccountKind
  accountNumberLast4?: string | null
  accountNumberMasked?: string | null
  accountHolderName?: string | null
  overdraftLimit?: string | null
  upiVpa?: string | null
}

export interface TreasuryCashProfileDto {
  id: string
  custodianName?: string | null
  custodianUserId?: string | null
  locationDescription?: string | null
  imprestLimit?: string | null
}

export interface TreasuryAccountDto {
  id: string
  tenantId: string
  legalEntityId: string
  branchId?: string | null
  code: string
  name: string
  accountType: TreasuryAccountType
  status: TreasuryAccountStatus
  glAccountId: string
  currencyCode: string
  description?: string | null
  activatedAt?: string | null
  deactivatedAt?: string | null
  deactivationReason?: string | null
  closedAt?: string | null
  closeReason?: string | null
  createdAt: string
  updatedAt: string
  bankProfile?: TreasuryBankProfileDto | null
  cashProfile?: TreasuryCashProfileDto | null
}

export interface CreateBankTreasuryAccountInput {
  legalEntityId: string
  branchId?: string | null
  code: string
  name: string
  accountType: 'BANK'
  glAccountId: string
  currencyCode: string
  description?: string
  bankProfile: {
    bankName: string
    branchName?: string
    ifscCode?: string
    swiftCode?: string
    micrCode?: string
    bankAccountKind: TreasuryBankAccountKind
    accountNumber?: string
    accountHolderName?: string
    overdraftLimit?: number
    upiVpa?: string
  }
}

export interface UpdateBankTreasuryAccountInput {
  name?: string
  branchId?: string | null
  glAccountId?: string
  currencyCode?: string
  description?: string | null
  expectedUpdatedAt: string
  bankProfile?: Partial<CreateBankTreasuryAccountInput['bankProfile']>
}

export interface CreateCashTreasuryAccountInput {
  legalEntityId: string
  branchId?: string | null
  code: string
  name: string
  accountType: 'CASH'
  glAccountId: string
  currencyCode: string
  description?: string
  cashProfile?: {
    custodianName?: string
    custodianUserId?: string
    locationDescription?: string
    imprestLimit?: number
  }
}

export type CreateTreasuryAccountInput =
  | CreateBankTreasuryAccountInput
  | CreateCashTreasuryAccountInput

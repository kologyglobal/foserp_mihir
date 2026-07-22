import type { Request } from 'express'
import { prisma } from '../../../../config/database.js'
import { auditFromRequest, createAuditLog } from '../../../../services/audit.service.js'
import { formatForPersistence } from '../../shared/finance-decimal.js'
import { assertAccountForMapping, getLegalEntityOrThrow } from '../../shared/finance.helpers.js'
import {
  deriveAccountNumberSecurityFields,
  isAccountNumberSecurityAvailable,
  redactTreasurySensitiveFields,
} from '../treasury-account-security.service.js'
import {
  TreasuryAccountGlAccountInvalidError,
  TreasuryAccountGlMappingConflictError,
  TreasuryAccountInvalidStateError,
  TreasuryBankAccountSecurityUnavailableError,
} from '../treasury.errors.js'
import * as repo from './treasury-account.repository.js'
import type {
  CreateTreasuryAccountInput,
  ListTreasuryAccountsQuery,
  TreasuryAccountLifecycleInput,
  UpdateTreasuryAccountInput,
} from './treasury-account.schemas.js'

/** GL account types compatible with each treasury account type (validated against Account.accountType + category). */
const GL_ACCOUNT_TYPE_RULES: Record<'BANK' | 'CASH' | 'CLEARING', { accountTypes: string[]; categories: string[] }> = {
  BANK: { accountTypes: ['BANK'], categories: ['ASSET'] },
  CASH: { accountTypes: ['CASH'], categories: ['ASSET'] },
  CLEARING: { accountTypes: ['BANK', 'CASH', 'GENERAL'], categories: ['ASSET', 'LIABILITY'] },
}

async function validateGlAccount(
  tenantId: string,
  legalEntityId: string,
  glAccountId: string,
  treasuryAccountType: 'BANK' | 'CASH' | 'CLEARING',
) {
  const account = await prisma.account.findFirst({ where: { id: glAccountId, tenantId, legalEntityId } })
  if (!account) throw new TreasuryAccountGlAccountInvalidError('GL account not found in this legal entity')
  assertAccountForMapping(account)
  const rule = GL_ACCOUNT_TYPE_RULES[treasuryAccountType]
  if (!rule.accountTypes.includes(account.accountType) || !rule.categories.includes(account.category)) {
    throw new TreasuryAccountGlAccountInvalidError(
      `GL account type/category is not valid for a ${treasuryAccountType} treasury account`,
    )
  }
  return account
}

async function assertGlAccountAvailable(
  tenantId: string,
  legalEntityId: string,
  glAccountId: string,
  excludeId?: string,
) {
  const existingActive = await repo.findActiveTreasuryAccountByGlAccount(tenantId, legalEntityId, glAccountId, excludeId)
  if (existingActive) throw new TreasuryAccountGlMappingConflictError()
}

function auditMeta(req: Request) {
  return auditFromRequest(req)
}

export async function listRecords(tenantId: string, query: ListTreasuryAccountsQuery) {
  if (query.legalEntityId) await getLegalEntityOrThrow(tenantId, query.legalEntityId)
  const result = await repo.listTreasuryAccounts(tenantId, query)
  return { ...result, items: result.items.map(redactAccount) }
}

export async function getRecord(tenantId: string, id: string) {
  const item = await repo.getTreasuryAccount(tenantId, id)
  return redactAccount(item)
}

export async function createRecord(req: Request, tenantId: string, input: CreateTreasuryAccountInput) {
  const audit = auditMeta(req)
  const userId = req.context?.userId ?? null
  await getLegalEntityOrThrow(tenantId, input.legalEntityId)
  await validateGlAccount(tenantId, input.legalEntityId, input.glAccountId, input.accountType)
  await assertGlAccountAvailable(tenantId, input.legalEntityId, input.glAccountId)

  let bankProfileData: repo.CreateTreasuryAccountData['bankProfile'] = null
  if (input.bankProfile) {
    if (input.bankProfile.accountNumber) {
      if (!isAccountNumberSecurityAvailable()) throw new TreasuryBankAccountSecurityUnavailableError()
      const security = deriveAccountNumberSecurityFields(input.bankProfile.accountNumber, tenantId, input.legalEntityId)
      bankProfileData = {
        bankName: input.bankProfile.bankName,
        branchName: input.bankProfile.branchName ?? null,
        ifscCode: input.bankProfile.ifscCode ?? null,
        swiftCode: input.bankProfile.swiftCode ?? null,
        micrCode: input.bankProfile.micrCode ?? null,
        bankAccountKind: input.bankProfile.bankAccountKind,
        accountNumberLast4: security.last4,
        accountNumberMasked: security.masked,
        accountNumberHash: security.hash,
        accountNumberEncrypted: security.encrypted,
        accountHolderName: input.bankProfile.accountHolderName ?? null,
        overdraftLimit: input.bankProfile.overdraftLimit ?? null,
        upiVpa: input.bankProfile.upiVpa ?? null,
      }
    } else {
      bankProfileData = {
        bankName: input.bankProfile.bankName,
        branchName: input.bankProfile.branchName ?? null,
        ifscCode: input.bankProfile.ifscCode ?? null,
        swiftCode: input.bankProfile.swiftCode ?? null,
        micrCode: input.bankProfile.micrCode ?? null,
        bankAccountKind: input.bankProfile.bankAccountKind,
        accountNumberLast4: null,
        accountNumberMasked: null,
        accountNumberHash: null,
        accountNumberEncrypted: null,
        accountHolderName: input.bankProfile.accountHolderName ?? null,
        overdraftLimit: input.bankProfile.overdraftLimit ?? null,
        upiVpa: input.bankProfile.upiVpa ?? null,
      }
    }
  }

  const cashProfileData: repo.CreateTreasuryAccountData['cashProfile'] = input.cashProfile
    ? {
        custodianName: input.cashProfile.custodianName ?? null,
        custodianUserId: input.cashProfile.custodianUserId ?? null,
        locationDescription: input.cashProfile.locationDescription ?? null,
        imprestLimit: input.cashProfile.imprestLimit ?? null,
      }
    : null

  const record = await repo.createTreasuryAccount({
    tenantId,
    legalEntityId: input.legalEntityId,
    branchId: input.branchId ?? null,
    code: input.code,
    name: input.name,
    accountType: input.accountType,
    glAccountId: input.glAccountId,
    currencyCode: input.currencyCode,
    description: input.description ?? null,
    createdBy: userId,
    bankProfile: bankProfileData,
    cashProfile: cashProfileData,
  })

  await createAuditLog({
    tenantId,
    userId: audit.userId,
    module: 'finance',
    entity: 'treasury_account',
    entityId: record.id,
    action: 'CREATE',
    newValues: redactTreasurySensitiveFields(record as unknown as Record<string, unknown>),
    ipAddress: audit.ipAddress,
    userAgent: audit.userAgent,
  })

  return redactAccount(record)
}

export async function updateRecord(req: Request, tenantId: string, id: string, input: UpdateTreasuryAccountInput) {
  const audit = auditMeta(req)
  const userId = req.context?.userId ?? null
  const before = await repo.getTreasuryAccount(tenantId, id)

  if (input.glAccountId && input.glAccountId !== before.glAccountId) {
    await validateGlAccount(tenantId, before.legalEntityId, input.glAccountId, before.accountType)
    await assertGlAccountAvailable(tenantId, before.legalEntityId, input.glAccountId, id)
  }

  let bankProfileUpdate: repo.UpdateTreasuryAccountData['bankProfile'] | undefined
  if (input.bankProfile) {
    if (before.accountType !== 'BANK' || !before.bankProfile) {
      throw new TreasuryAccountInvalidStateError('This treasury account has no bank profile to update')
    }
    bankProfileUpdate = {
      bankName: input.bankProfile.bankName ?? before.bankProfile.bankName,
      branchName: input.bankProfile.branchName ?? before.bankProfile.branchName,
      ifscCode: input.bankProfile.ifscCode ?? before.bankProfile.ifscCode,
      swiftCode: input.bankProfile.swiftCode ?? before.bankProfile.swiftCode,
      micrCode: input.bankProfile.micrCode ?? before.bankProfile.micrCode,
      bankAccountKind: input.bankProfile.bankAccountKind ?? before.bankProfile.bankAccountKind,
      accountHolderName: input.bankProfile.accountHolderName ?? before.bankProfile.accountHolderName,
      overdraftLimit: input.bankProfile.overdraftLimit ?? (before.bankProfile.overdraftLimit as unknown as number | null),
      upiVpa: input.bankProfile.upiVpa ?? before.bankProfile.upiVpa,
      accountNumberLast4: before.bankProfile.accountNumberLast4,
      accountNumberMasked: before.bankProfile.accountNumberMasked,
      accountNumberHash: before.bankProfile.accountNumberHash,
      accountNumberEncrypted: before.bankProfile.accountNumberEncrypted,
    }
    if (input.bankProfile.accountNumber) {
      if (!isAccountNumberSecurityAvailable()) throw new TreasuryBankAccountSecurityUnavailableError()
      const security = deriveAccountNumberSecurityFields(input.bankProfile.accountNumber, tenantId, before.legalEntityId)
      bankProfileUpdate.accountNumberLast4 = security.last4
      bankProfileUpdate.accountNumberMasked = security.masked
      bankProfileUpdate.accountNumberHash = security.hash
      bankProfileUpdate.accountNumberEncrypted = security.encrypted
    }
  }

  const cashProfileUpdate: repo.UpdateTreasuryAccountData['cashProfileUpdate'] = input.cashProfile
    ? {
        custodianName: input.cashProfile.custodianName ?? before.cashProfile?.custodianName ?? null,
        custodianUserId: input.cashProfile.custodianUserId ?? before.cashProfile?.custodianUserId ?? null,
        locationDescription: input.cashProfile.locationDescription ?? before.cashProfile?.locationDescription ?? null,
        imprestLimit:
          input.cashProfile.imprestLimit ?? (before.cashProfile?.imprestLimit as unknown as number | null) ?? null,
      }
    : undefined

  const record = await repo.updateTreasuryAccount(tenantId, id, {
    name: input.name,
    branchId: input.branchId,
    glAccountId: input.glAccountId,
    currencyCode: input.currencyCode,
    description: input.description,
    updatedBy: userId,
    expectedUpdatedAt: input.expectedUpdatedAt,
    bankProfile: bankProfileUpdate,
    cashProfileUpdate,
  })

  await createAuditLog({
    tenantId,
    userId: audit.userId,
    module: 'finance',
    entity: 'treasury_account',
    entityId: id,
    action: 'UPDATE',
    oldValues: redactTreasurySensitiveFields(before as unknown as Record<string, unknown>),
    newValues: redactTreasurySensitiveFields(record as unknown as Record<string, unknown>),
    ipAddress: audit.ipAddress,
    userAgent: audit.userAgent,
  })

  return redactAccount(record)
}

export async function activateRecord(req: Request, tenantId: string, id: string, input: TreasuryAccountLifecycleInput) {
  const audit = auditMeta(req)
  const userId = req.context?.userId ?? null
  const existing = await repo.getTreasuryAccount(tenantId, id)
  if (existing.status === 'CLOSED') throw new TreasuryAccountInvalidStateError('A closed treasury account cannot be reactivated')
  if (existing.status === 'ACTIVE') return redactAccount(existing)
  await assertGlAccountAvailable(tenantId, existing.legalEntityId, existing.glAccountId, id)
  const record = await repo.activateTreasuryAccount(tenantId, id, userId, input.expectedUpdatedAt)
  await createAuditLog({
    tenantId,
    userId: audit.userId,
    module: 'finance',
    entity: 'treasury_account',
    entityId: id,
    action: 'ACTIVATE',
    newValues: { status: record.status },
    ipAddress: audit.ipAddress,
    userAgent: audit.userAgent,
  })
  return redactAccount(record)
}

export async function deactivateRecord(req: Request, tenantId: string, id: string, input: TreasuryAccountLifecycleInput) {
  const audit = auditMeta(req)
  const userId = req.context?.userId ?? null
  const existing = await repo.getTreasuryAccount(tenantId, id)
  if (existing.status === 'CLOSED') throw new TreasuryAccountInvalidStateError('A closed treasury account cannot be deactivated')
  const record = await repo.deactivateTreasuryAccount(tenantId, id, userId, input.expectedUpdatedAt, input.reason ?? null)
  await createAuditLog({
    tenantId,
    userId: audit.userId,
    module: 'finance',
    entity: 'treasury_account',
    entityId: id,
    action: 'DEACTIVATE',
    newValues: { status: record.status, reason: input.reason ?? null },
    ipAddress: audit.ipAddress,
    userAgent: audit.userAgent,
  })
  return redactAccount(record)
}

export async function closeRecord(req: Request, tenantId: string, id: string, input: TreasuryAccountLifecycleInput) {
  const audit = auditMeta(req)
  const userId = req.context?.userId ?? null
  const existing = await repo.getTreasuryAccount(tenantId, id)
  if (existing.status === 'CLOSED') throw new TreasuryAccountInvalidStateError('Treasury account is already closed')
  if (existing.status === 'ACTIVE') {
    throw new TreasuryAccountInvalidStateError('Deactivate the treasury account before closing it')
  }
  const record = await repo.closeTreasuryAccount(tenantId, id, userId, input.expectedUpdatedAt, input.reason ?? null)
  await createAuditLog({
    tenantId,
    userId: audit.userId,
    module: 'finance',
    entity: 'treasury_account',
    entityId: id,
    action: 'CLOSE',
    newValues: { status: record.status, reason: input.reason ?? null },
    ipAddress: audit.ipAddress,
    userAgent: audit.userAgent,
  })
  return redactAccount(record)
}

/** Strips write-only security fields from a treasury account (+profiles) and applies fixed 4-decimal money formatting. */
function redactAccount<T extends repo.TreasuryAccountWithProfiles>(account: T): T {
  let result = account as unknown as Record<string, unknown>

  if (account.bankProfile) {
    const { accountNumberHash, accountNumberEncrypted, overdraftLimit, ...rest } = account.bankProfile as Record<string, unknown> & {
      accountNumberHash: unknown
      accountNumberEncrypted: unknown
      overdraftLimit: { toFixed?: (n: number) => string } | null
    }
    void accountNumberHash
    void accountNumberEncrypted
    result = { ...result, bankProfile: { ...rest, overdraftLimit: overdraftLimit != null ? formatForPersistence(overdraftLimit as never) : null } }
  }

  if (account.cashProfile) {
    const { imprestLimit, ...rest } = account.cashProfile as Record<string, unknown> & {
      imprestLimit: { toFixed?: (n: number) => string } | null
    }
    result = { ...result, cashProfile: { ...rest, imprestLimit: imprestLimit != null ? formatForPersistence(imprestLimit as never) : null } }
  }

  return result as T
}

import type { Prisma, TreasuryAccount, TreasuryAccountType } from '@prisma/client'
import { prisma } from '../../../../config/database.js'
import { formatForPersistence } from '../../shared/finance-decimal.js'
import { getPagination } from '../../../../utils/pagination.js'
import {
  TreasuryAccountCodeConflictError,
  TreasuryAccountGlMappingConflictError,
  TreasuryAccountNotFoundError,
  TreasuryAccountStaleVersionError,
  TreasuryBankAccountDuplicateNumberError,
} from '../treasury.errors.js'
import type { ListTreasuryAccountsQuery } from './treasury-account.schemas.js'

export type TreasuryAccountWithProfiles = TreasuryAccount & {
  bankProfile: Prisma.TreasuryBankProfileGetPayload<Record<string, never>> | null
  cashProfile: Prisma.TreasuryCashProfileGetPayload<Record<string, never>> | null
}

const WITH_PROFILES_INCLUDE = { bankProfile: true, cashProfile: true } as const

export async function listTreasuryAccounts(tenantId: string, query: ListTreasuryAccountsQuery) {
  if (!query.legalEntityId) throw new TreasuryAccountNotFoundError('legalEntityId query parameter is required')
  const { skip, take } = getPagination(query)
  const where: Prisma.TreasuryAccountWhereInput = {
    tenantId,
    legalEntityId: query.legalEntityId,
    ...(query.accountType ? { accountType: query.accountType } : {}),
    ...(query.status ? { status: query.status } : {}),
  }
  if (query.search) {
    where.OR = [{ code: { contains: query.search } }, { name: { contains: query.search } }]
  }
  const [items, total] = await Promise.all([
    prisma.treasuryAccount.findMany({
      where,
      skip,
      take,
      orderBy: { code: 'asc' },
      include: WITH_PROFILES_INCLUDE,
    }),
    prisma.treasuryAccount.count({ where }),
  ])
  return { items, total, page: query.page, limit: query.limit }
}

export async function getTreasuryAccount(tenantId: string, id: string): Promise<TreasuryAccountWithProfiles> {
  const item = await prisma.treasuryAccount.findFirst({
    where: { id, tenantId },
    include: WITH_PROFILES_INCLUDE,
  })
  if (!item) throw new TreasuryAccountNotFoundError()
  return item as TreasuryAccountWithProfiles
}

export async function findActiveTreasuryAccountByGlAccount(
  tenantId: string,
  legalEntityId: string,
  glAccountId: string,
  excludeId?: string,
): Promise<TreasuryAccount | null> {
  return prisma.treasuryAccount.findFirst({
    where: {
      tenantId,
      legalEntityId,
      glAccountId,
      status: 'ACTIVE',
      ...(excludeId ? { id: { not: excludeId } } : {}),
    },
  })
}

export interface CreateTreasuryAccountData {
  tenantId: string
  legalEntityId: string
  branchId: string | null
  code: string
  name: string
  accountType: TreasuryAccountType
  glAccountId: string
  currencyCode: string
  description: string | null
  createdBy: string | null
  bankProfile: {
    bankName: string
    branchName: string | null
    ifscCode: string | null
    swiftCode: string | null
    micrCode: string | null
    bankAccountKind: string
    accountNumberLast4: string | null
    accountNumberMasked: string | null
    accountNumberHash: string | null
    accountNumberEncrypted: string | null
    accountHolderName: string | null
    overdraftLimit: number | null
    upiVpa: string | null
  } | null
  cashProfile: {
    custodianName: string | null
    custodianUserId: string | null
    locationDescription: string | null
    imprestLimit: number | null
  } | null
}

export async function createTreasuryAccount(data: CreateTreasuryAccountData): Promise<TreasuryAccountWithProfiles> {
  try {
    const created = await prisma.$transaction(async (tx) => {
      const account = await tx.treasuryAccount.create({
        data: {
          tenantId: data.tenantId,
          legalEntityId: data.legalEntityId,
          branchId: data.branchId,
          code: data.code,
          name: data.name,
          accountType: data.accountType,
          status: 'ACTIVE',
          glAccountId: data.glAccountId,
          currencyCode: data.currencyCode,
          description: data.description,
          activatedAt: new Date(),
          activatedBy: data.createdBy,
          createdBy: data.createdBy,
          updatedBy: data.createdBy,
        },
      })

      if (data.bankProfile) {
        await tx.treasuryBankProfile.create({
          data: {
            tenantId: data.tenantId,
            legalEntityId: data.legalEntityId,
            treasuryAccountId: account.id,
            bankName: data.bankProfile.bankName,
            branchName: data.bankProfile.branchName,
            ifscCode: data.bankProfile.ifscCode,
            swiftCode: data.bankProfile.swiftCode,
            micrCode: data.bankProfile.micrCode,
            bankAccountKind: data.bankProfile.bankAccountKind as never,
            accountNumberLast4: data.bankProfile.accountNumberLast4,
            accountNumberMasked: data.bankProfile.accountNumberMasked,
            accountNumberHash: data.bankProfile.accountNumberHash,
            accountNumberEncrypted: data.bankProfile.accountNumberEncrypted,
            accountHolderName: data.bankProfile.accountHolderName,
            overdraftLimit: data.bankProfile.overdraftLimit != null ? formatForPersistence(data.bankProfile.overdraftLimit) : null,
            upiVpa: data.bankProfile.upiVpa,
            createdBy: data.createdBy,
            updatedBy: data.createdBy,
          },
        })
      }

      if (data.cashProfile) {
        await tx.treasuryCashProfile.create({
          data: {
            tenantId: data.tenantId,
            legalEntityId: data.legalEntityId,
            treasuryAccountId: account.id,
            custodianName: data.cashProfile.custodianName,
            custodianUserId: data.cashProfile.custodianUserId,
            locationDescription: data.cashProfile.locationDescription,
            imprestLimit: data.cashProfile.imprestLimit != null ? formatForPersistence(data.cashProfile.imprestLimit) : null,
            createdBy: data.createdBy,
            updatedBy: data.createdBy,
          },
        })
      }

      return account
    })
    return getTreasuryAccount(data.tenantId, created.id)
  } catch (err) {
    throw mapTreasuryAccountWriteError(err, data.code)
  }
}

export interface UpdateTreasuryAccountData {
  name?: string
  branchId?: string | null
  glAccountId?: string
  currencyCode?: string
  description?: string | null
  updatedBy: string | null
  expectedUpdatedAt: string
  bankProfile?: Partial<CreateTreasuryAccountData['bankProfile']> | null
  cashProfileUpdate?: CreateTreasuryAccountData['cashProfile']
}

export async function updateTreasuryAccount(
  tenantId: string,
  id: string,
  data: UpdateTreasuryAccountData,
): Promise<TreasuryAccountWithProfiles> {
  const existing = await getTreasuryAccount(tenantId, id)
  assertNotStale(existing, data.expectedUpdatedAt)

  try {
    await prisma.$transaction(async (tx) => {
      await tx.treasuryAccount.update({
        where: { id, tenantId },
        data: {
          name: data.name,
          branchId: data.branchId,
          glAccountId: data.glAccountId,
          currencyCode: data.currencyCode,
          description: data.description,
          updatedBy: data.updatedBy,
        },
      })

      if (data.bankProfile && existing.bankProfile) {
        await tx.treasuryBankProfile.update({
          where: { treasuryAccountId: id },
          data: {
            bankName: data.bankProfile.bankName,
            branchName: data.bankProfile.branchName,
            ifscCode: data.bankProfile.ifscCode,
            swiftCode: data.bankProfile.swiftCode,
            micrCode: data.bankProfile.micrCode,
            bankAccountKind: data.bankProfile.bankAccountKind as never,
            accountNumberLast4: data.bankProfile.accountNumberLast4,
            accountNumberMasked: data.bankProfile.accountNumberMasked,
            accountNumberHash: data.bankProfile.accountNumberHash,
            accountNumberEncrypted: data.bankProfile.accountNumberEncrypted,
            accountHolderName: data.bankProfile.accountHolderName,
            overdraftLimit: data.bankProfile.overdraftLimit != null ? formatForPersistence(data.bankProfile.overdraftLimit) : data.bankProfile.overdraftLimit,
            upiVpa: data.bankProfile.upiVpa,
            updatedBy: data.updatedBy,
          },
        })
      }

      if (data.cashProfileUpdate && existing.cashProfile) {
        await tx.treasuryCashProfile.update({
          where: { treasuryAccountId: id },
          data: {
            custodianName: data.cashProfileUpdate.custodianName,
            custodianUserId: data.cashProfileUpdate.custodianUserId,
            locationDescription: data.cashProfileUpdate.locationDescription,
            imprestLimit: data.cashProfileUpdate.imprestLimit != null ? formatForPersistence(data.cashProfileUpdate.imprestLimit) : data.cashProfileUpdate.imprestLimit,
            updatedBy: data.updatedBy,
          },
        })
      }
    })
  } catch (err) {
    throw mapTreasuryAccountWriteError(err)
  }

  return getTreasuryAccount(tenantId, id)
}

function assertNotStale(existing: TreasuryAccount, expectedUpdatedAt: string): void {
  if (existing.updatedAt.getTime() !== new Date(expectedUpdatedAt).getTime()) {
    throw new TreasuryAccountStaleVersionError()
  }
}

export async function activateTreasuryAccount(
  tenantId: string,
  id: string,
  userId: string | null,
  expectedUpdatedAt: string,
): Promise<TreasuryAccountWithProfiles> {
  const existing = await getTreasuryAccount(tenantId, id)
  assertNotStale(existing, expectedUpdatedAt)
  try {
    await prisma.treasuryAccount.update({
      where: { id, tenantId },
      data: { status: 'ACTIVE', activatedAt: new Date(), activatedBy: userId, updatedBy: userId },
    })
  } catch (err) {
    throw mapTreasuryAccountWriteError(err)
  }
  return getTreasuryAccount(tenantId, id)
}

export async function deactivateTreasuryAccount(
  tenantId: string,
  id: string,
  userId: string | null,
  expectedUpdatedAt: string,
  reason: string | null,
): Promise<TreasuryAccountWithProfiles> {
  const existing = await getTreasuryAccount(tenantId, id)
  assertNotStale(existing, expectedUpdatedAt)
  await prisma.treasuryAccount.update({
    where: { id, tenantId },
    data: {
      status: 'INACTIVE',
      deactivatedAt: new Date(),
      deactivatedBy: userId,
      deactivationReason: reason,
      updatedBy: userId,
    },
  })
  return getTreasuryAccount(tenantId, id)
}

export async function closeTreasuryAccount(
  tenantId: string,
  id: string,
  userId: string | null,
  expectedUpdatedAt: string,
  reason: string | null,
): Promise<TreasuryAccountWithProfiles> {
  const existing = await getTreasuryAccount(tenantId, id)
  assertNotStale(existing, expectedUpdatedAt)
  await prisma.treasuryAccount.update({
    where: { id, tenantId },
    data: {
      status: 'CLOSED',
      closedAt: new Date(),
      closedBy: userId,
      closeReason: reason,
      updatedBy: userId,
    },
  })
  return getTreasuryAccount(tenantId, id)
}

function mapTreasuryAccountWriteError(err: unknown, code?: string): never {
  if (err instanceof TreasuryAccountStaleVersionError) throw err
  const prismaErr = err as { code?: string; message?: string; meta?: { target?: string[] | string } }
  if (prismaErr?.code === 'P2002') {
    const target = Array.isArray(prismaErr.meta?.target)
      ? prismaErr.meta?.target.join(',')
      : `${String(prismaErr.meta?.target ?? '')} ${prismaErr.message ?? ''}`
    if (target.includes('hash')) throw new TreasuryBankAccountDuplicateNumberError()
    if (target.includes('code_key') || target.includes('tenant_le_code')) {
      throw new TreasuryAccountCodeConflictError(`Treasury account code ${code ?? ''} already exists for this legal entity`)
    }
    throw new TreasuryAccountCodeConflictError()
  }
  throw err
}

export function assertGlAccountNotAlreadyMapped(existingActive: TreasuryAccount | null): void {
  if (existingActive) throw new TreasuryAccountGlMappingConflictError()
}

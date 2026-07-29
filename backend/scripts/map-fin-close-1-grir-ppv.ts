/**
 * FIN-CLOSE-1 — map GRIR_CLEARING + PURCHASE_PRICE_VARIANCE on every active LE
 * that already has finance CoA leaf accounts (or create them when missing).
 *
 * Safe / idempotent. Does not enable INVENTORY_ACCOUNTING.
 */
import type { AccountCategory, AccountType, DefaultAccountMappingKey, NormalBalance } from '@prisma/client'
import { prisma } from '../src/config/database.js'

const TARGETS: Array<{
  mappingKey: DefaultAccountMappingKey
  accountCode: string
  accountName: string
  category: AccountCategory
  accountType: AccountType
  normalBalance: NormalBalance
}> = [
  {
    mappingKey: 'GRIR_CLEARING',
    accountCode: '2110',
    accountName: 'GR/IR Clearing',
    category: 'LIABILITY',
    accountType: 'GENERAL',
    normalBalance: 'CREDIT',
  },
  {
    mappingKey: 'PURCHASE_PRICE_VARIANCE',
    accountCode: '5510',
    accountName: 'Purchase Price Variance',
    category: 'EXPENSE',
    accountType: 'EXPENSE',
    normalBalance: 'DEBIT',
  },
]

async function ensureAccount(args: {
  tenantId: string
  legalEntityId: string
  accountCode: string
  accountName: string
  category: AccountCategory
  accountType: AccountType
  normalBalance: NormalBalance
}) {
  const existing = await prisma.account.findUnique({
    where: {
      legalEntityId_accountCode: {
        legalEntityId: args.legalEntityId,
        accountCode: args.accountCode,
      },
    },
  })
  if (existing) {
    if (
      !existing.isActive ||
      existing.isGroup ||
      existing.category !== args.category ||
      existing.accountType !== args.accountType
    ) {
      return prisma.account.update({
        where: { id: existing.id },
        data: {
          isActive: true,
          isGroup: false,
          accountName: args.accountName,
          category: args.category,
          accountType: args.accountType,
          normalBalance: args.normalBalance,
        },
      })
    }
    return existing
  }
  return prisma.account.create({
    data: {
      tenantId: args.tenantId,
      legalEntityId: args.legalEntityId,
      accountCode: args.accountCode,
      accountName: args.accountName,
      category: args.category,
      accountType: args.accountType,
      normalBalance: args.normalBalance,
      isGroup: false,
      isActive: true,
    },
  })
}

async function main() {
  const legalEntities = await prisma.legalEntity.findMany({
    where: { isActive: true },
    select: {
      id: true,
      code: true,
      displayName: true,
      isDefault: true,
      tenantId: true,
      tenant: { select: { slug: true, name: true } },
    },
    orderBy: [{ tenantId: 'asc' }, { isDefault: 'desc' }, { createdAt: 'asc' }],
  })

  if (legalEntities.length === 0) {
    console.log('No active legal entities found.')
    return
  }

  console.log(`Mapping GRIR_CLEARING + PURCHASE_PRICE_VARIANCE on ${legalEntities.length} legal entity(ies)\n`)

  for (const le of legalEntities) {
    // Skip LEs with no CoA at all — finance not set up.
    const leafCount = await prisma.account.count({
      where: { tenantId: le.tenantId, legalEntityId: le.id, isGroup: false },
    })
    if (leafCount === 0) {
      console.log(`SKIP  ${le.tenant.slug}/${le.code} — no chart of accounts`)
      continue
    }

    console.log(`LE    ${le.tenant.slug}/${le.code} (${le.displayName})${le.isDefault ? ' [default]' : ''}`)

    for (const target of TARGETS) {
      const account = await ensureAccount({
        tenantId: le.tenantId,
        legalEntityId: le.id,
        accountCode: target.accountCode,
        accountName: target.accountName,
        category: target.category,
        accountType: target.accountType,
        normalBalance: target.normalBalance,
      })

      const mapping = await prisma.defaultAccountMapping.upsert({
        where: {
          legalEntityId_mappingKey: {
            legalEntityId: le.id,
            mappingKey: target.mappingKey,
          },
        },
        create: {
          tenantId: le.tenantId,
          legalEntityId: le.id,
          mappingKey: target.mappingKey,
          accountId: account.id,
          isMandatory: false,
        },
        update: {
          accountId: account.id,
        },
      })

      console.log(
        `  ✓ ${target.mappingKey} → ${account.accountCode} ${account.accountName} (mapping ${mapping.id.slice(0, 8)}…)`,
      )
    }
  }

  console.log('\nDone.')
}

main()
  .catch((err) => {
    console.error(err)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })

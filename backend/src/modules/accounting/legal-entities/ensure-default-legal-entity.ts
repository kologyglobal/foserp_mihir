import { prisma } from '../../../config/prisma.js'

export type DefaultLegalEntitySeed = {
  code?: string
  legalName?: string
  displayName?: string
  tradeName?: string
  pan?: string
  gstin?: string
  registeredAddressJson?: Record<string, unknown>
  branchCode?: string
  branchName?: string
}

const DEFAULT_SEED: Required<
  Pick<
    DefaultLegalEntitySeed,
    | 'code'
    | 'legalName'
    | 'displayName'
    | 'tradeName'
    | 'pan'
    | 'gstin'
    | 'registeredAddressJson'
    | 'branchCode'
    | 'branchName'
  >
> = {
  code: 'LE-MAIN',
  legalName: 'Demo Legal Entity Private Limited',
  displayName: 'Demo Legal Entity',
  tradeName: 'Demo Legal Entity',
  pan: 'AABCV1234F',
  gstin: '27AABCV1234F1Z5',
  registeredAddressJson: {
    line1: 'Demo Industrial Estate',
    city: 'Pune',
    state: 'Maharashtra',
    postalCode: '411001',
    country: 'India',
    countryCode: 'IN',
    stateCode: '27',
  },
  branchCode: 'HO',
  branchName: 'Head Office',
}

/**
 * Ensures the tenant has at least one active default legal entity + FinanceSettings.
 * Used by purchase → AP handoff and local seed scripts when finance setup was skipped.
 */
export async function ensureDefaultLegalEntity(
  tenantId: string,
  seed: DefaultLegalEntitySeed = {},
): Promise<string> {
  const cfg = { ...DEFAULT_SEED, ...seed }

  const existing = await prisma.legalEntity.findFirst({
    where: { tenantId, isActive: true },
    orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }],
    select: { id: true },
  })

  let legalEntityId = existing?.id
  if (!legalEntityId) {
    const le = await prisma.legalEntity.create({
      data: {
        tenantId,
        code: cfg.code,
        legalName: cfg.legalName,
        displayName: cfg.displayName,
        tradeName: cfg.tradeName,
        entityType: 'PRIVATE_LIMITED',
        pan: cfg.pan,
        gstin: cfg.gstin,
        baseCurrency: 'INR',
        countryCode: 'IN',
        stateCode: '27',
        fiscalYearStartMonth: 4,
        isDefault: true,
        isActive: true,
        registeredAddressJson: cfg.registeredAddressJson,
        branches: {
          create: {
            tenantId,
            code: cfg.branchCode,
            name: cfg.branchName,
            branchType: 'HEAD_OFFICE',
            gstin: cfg.gstin,
            stateCode: '27',
            isHeadOffice: true,
            isDefault: true,
            isActive: true,
          },
        },
      },
    })
    legalEntityId = le.id
  }

  await prisma.financeSettings.upsert({
    where: { legalEntityId },
    create: {
      tenantId,
      legalEntityId,
      financeActivated: true,
      baseCurrency: 'INR',
    },
    update: {},
  })

  const fyExisting = await prisma.financialYear.findFirst({
    where: { tenantId, legalEntityId, isCurrent: true },
  })
  if (!fyExisting) {
    const now = new Date()
    const startYear = now.getUTCMonth() >= 3 ? now.getUTCFullYear() : now.getUTCFullYear() - 1
    const fy = await prisma.financialYear.create({
      data: {
        tenantId,
        legalEntityId,
        name: `FY ${startYear}-${String(startYear + 1).slice(-2)}`,
        startDate: new Date(`${startYear}-04-01`),
        endDate: new Date(`${startYear + 1}-03-31`),
        status: 'ACTIVE',
        isCurrent: true,
      },
    })
    await prisma.accountingPeriod.create({
      data: {
        tenantId,
        legalEntityId,
        financialYearId: fy.id,
        periodNumber: 1,
        name: 'Open',
        startDate: fy.startDate,
        endDate: fy.endDate,
        status: 'OPEN',
      },
    })
  }

  return legalEntityId
}

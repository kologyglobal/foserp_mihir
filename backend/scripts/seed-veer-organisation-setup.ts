/**
 * Configure organisation + finance primary module for Veer International
 * on the active demo tenant (default: vasant-trailers).
 *
 * Covers: Organisation, Legal Entity, Tax (GSTIN), CoA, Account Mapping,
 * Fiscal Year, Posting Periods, Number Series, Finance activation.
 *
 * Usage: npx tsx scripts/seed-veer-organisation-setup.ts
 * Optional: TENANT_SLUG=vasant-trailers
 */
import type { DefaultAccountMappingKey, FinanceDocumentType } from '@prisma/client'
import { prisma } from '../src/config/database.js'
import { applyCoaTemplate } from '../src/modules/accounting/accounts/account.repository.js'
import { computeSetupStatus, activateFinance } from '../src/modules/accounting/finance-settings/finance-settings.repository.js'
import { MANDATORY_MAPPING_KEYS, REQUIRED_NUMBER_SERIES_TYPES } from '../src/modules/accounting/shared/finance.constants.js'

const TENANT_SLUG = process.env.TENANT_SLUG ?? 'vasant-trailers'

const ORG = {
  name: 'Veer International',
  legalName: 'VEER INTERNATIONAL TANKS AND CONTAINERS PRIVATE LIMITED',
  email: 'admin@vasant-trailers.com',
  phone: '+91 9876543210',
  country: 'India',
  state: 'Gujarat',
  city: 'Chhapi',
  timezone: 'Asia/Kolkata',
  currency: 'INR',
} as const

const GSTIN = '24AAJCV7010P1ZZ'
const PAN = 'AAJCV7010P'
const STATE_CODE = '24'

const ADDRESS = {
  line1: 'Survey No.54 Paiki 1, Panchal Estate, Narsan Road',
  district: 'Banaskantha',
  city: 'Chhapi',
  state: 'Gujarat',
  postalCode: '385210',
  stateCode: STATE_CODE,
  country: 'India',
  countryCode: 'IN',
  gstin: GSTIN,
}

/** Mandatory mapping key → CoA account code (Manufacturing template). */
const MAPPING_BY_CODE: Partial<Record<DefaultAccountMappingKey, string>> = {
  CUSTOMER_RECEIVABLE: '110300',
  VENDOR_PAYABLE: '2100',
  SALES_REVENUE: '4100',
  PURCHASE: '5100',
  GST_INPUT_CGST: '520101',
  GST_INPUT_SGST: '520102',
  GST_INPUT_IGST: '520103',
  GST_OUTPUT_CGST: '220101',
  GST_OUTPUT_SGST: '220102',
  GST_OUTPUT_IGST: '220103',
  RETAINED_EARNINGS: '3100',
  // Manufacturing inventory / variance — mapped for readiness, but MANUFACTURING_ACCOUNTING stays OFF
  RAW_MATERIAL_INVENTORY: '130100',
  WIP_INVENTORY: '130200',
  FINISHED_GOODS_INVENTORY: '130300',
  PRODUCTION_VARIANCE: '5400',
  SCRAP_LOSS: '5400',
  /** Dispatch FG_DISPATCH inventory accounting (Dr COGS / Cr FG). */
  COST_OF_GOODS_SOLD: '5600',
}

const COST_CENTRES = [
  { code: 'CC-CUT', name: 'Cutting Shop' },
  { code: 'CC-FORM', name: 'Forming Shop' },
  { code: 'CC-WELD', name: 'Welding Shop' },
  { code: 'CC-ASSY', name: 'Assembly Shop' },
  { code: 'CC-PAINT', name: 'Paint Shop' },
  { code: 'CC-QC', name: 'Quality Bay' },
  { code: 'CC-ADMIN', name: 'Administration' },
] as const

/** Extra finance document series used by AP/AR documents (beyond voucher types). */
const EXTRA_SERIES: Array<{ documentType: FinanceDocumentType; prefix: string }> = [
  { documentType: 'VENDOR_INVOICE', prefix: 'PINV' },
  { documentType: 'SALES_INVOICE', prefix: 'SINV' },
  { documentType: 'VENDOR_PAYMENT', prefix: 'VPMT' },
  { documentType: 'CUSTOMER_RECEIPT', prefix: 'CRCT' },
]

const SERIES_PREFIX: Record<(typeof REQUIRED_NUMBER_SERIES_TYPES)[number], string> = {
  JOURNAL: 'JV',
  RECEIPT: 'RV',
  PAYMENT: 'PV',
  CONTRA: 'CV',
  CREDIT_NOTE: 'CN',
  DEBIT_NOTE: 'DN',
  OPENING_BALANCE: 'OB',
  REVERSAL: 'REV',
}

async function main() {
  console.log(`Configuring Veer organisation on tenant slug=${TENANT_SLUG}…`)

  const tenant = await prisma.tenant.findFirst({
    where: { slug: TENANT_SLUG, deletedAt: null },
  })
  if (!tenant) throw new Error(`Tenant not found: ${TENANT_SLUG}`)

  const admin = await prisma.user.findFirst({
    where: { tenantId: tenant.id, deletedAt: null, status: 'ACTIVE' },
    orderBy: { createdAt: 'asc' },
  })
  const userId = admin?.id ?? 'system'

  // ── 1. Organisation (Tenant) ──────────────────────────────────────────
  const updatedTenant = await prisma.tenant.update({
    where: { id: tenant.id },
    data: {
      name: ORG.name,
      legalName: ORG.legalName,
      email: ORG.email,
      phone: ORG.phone,
      country: ORG.country,
      state: ORG.state,
      city: ORG.city,
      timezone: ORG.timezone,
      currency: ORG.currency,
      status: 'ACTIVE',
    },
  })
  console.log(`✓ Organisation: ${updatedTenant.legalName} (${updatedTenant.city}, ${updatedTenant.state})`)

  // ── 2. Legal Entity + Tax Registration ────────────────────────────────
  let le = await prisma.legalEntity.findFirst({
    where: { tenantId: tenant.id },
    orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }],
  })

  if (!le) {
    le = await prisma.legalEntity.create({
      data: {
        tenantId: tenant.id,
        code: 'VIT-HO',
        legalName: ORG.legalName,
        displayName: ORG.name,
        tradeName: ORG.name,
        entityType: 'PRIVATE_LIMITED',
        pan: PAN,
        gstin: GSTIN,
        baseCurrency: 'INR',
        countryCode: 'IN',
        stateCode: STATE_CODE,
        registeredAddressJson: ADDRESS,
        billingAddressJson: ADDRESS,
        fiscalYearStartMonth: 4,
        isDefault: true,
        isActive: true,
        createdBy: userId,
        updatedBy: userId,
        branches: {
          create: {
            tenantId: tenant.id,
            code: 'HO',
            name: 'Head Office — Chhapi',
            branchType: 'HEAD_OFFICE',
            gstin: GSTIN,
            stateCode: STATE_CODE,
            addressJson: ADDRESS,
            isHeadOffice: true,
            isDefault: true,
            isActive: true,
            createdBy: userId,
            updatedBy: userId,
          },
        },
      },
    })
    console.log(`✓ Legal Entity created: ${le.code} (${le.entityType}) GSTIN ${le.gstin}`)
  } else {
    await prisma.legalEntity.updateMany({
      where: { tenantId: tenant.id, isDefault: true, NOT: { id: le.id } },
      data: { isDefault: false },
    })
    le = await prisma.legalEntity.update({
      where: { id: le.id },
      data: {
        code: le.code === 'VT-HO' ? 'VIT-HO' : le.code,
        legalName: ORG.legalName,
        displayName: ORG.name,
        tradeName: ORG.name,
        entityType: 'PRIVATE_LIMITED',
        pan: PAN,
        gstin: GSTIN,
        baseCurrency: 'INR',
        countryCode: 'IN',
        stateCode: STATE_CODE,
        registeredAddressJson: ADDRESS,
        billingAddressJson: ADDRESS,
        fiscalYearStartMonth: 4,
        isDefault: true,
        isActive: true,
        updatedBy: userId,
      },
    })
    console.log(`✓ Legal Entity updated: ${le.code} (${le.entityType}) GSTIN ${le.gstin}`)
  }

  let branch = await prisma.branch.findFirst({
    where: { tenantId: tenant.id, legalEntityId: le.id },
    orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }],
  })
  if (!branch) {
    branch = await prisma.branch.create({
      data: {
        tenantId: tenant.id,
        legalEntityId: le.id,
        code: 'HO',
        name: 'Head Office — Chhapi',
        branchType: 'HEAD_OFFICE',
        gstin: GSTIN,
        stateCode: STATE_CODE,
        addressJson: ADDRESS,
        isHeadOffice: true,
        isDefault: true,
        isActive: true,
        createdBy: userId,
        updatedBy: userId,
      },
    })
  } else {
    branch = await prisma.branch.update({
      where: { id: branch.id },
      data: {
        name: 'Head Office — Chhapi',
        gstin: GSTIN,
        stateCode: STATE_CODE,
        addressJson: ADDRESS,
        isHeadOffice: true,
        isDefault: true,
        isActive: true,
        updatedBy: userId,
      },
    })
  }
  console.log(`✓ Tax Registration / Branch: ${branch.name} · GSTIN ${branch.gstin}`)

  // ── 2b. Organisation Registration (GST) ───────────────────────────────
  const existingGstReg = await prisma.organisationRegistration.findFirst({
    where: {
      tenantId: tenant.id,
      legalEntityId: le.id,
      registrationType: 'GST',
      deletedAt: null,
    },
  })
  if (!existingGstReg) {
    await prisma.organisationRegistration.create({
      data: {
        tenantId: tenant.id,
        legalEntityId: le.id,
        registrationType: 'GST',
        registrationNumber: GSTIN,
        country: 'India',
        state: 'Gujarat',
        status: 'ACTIVE',
        createdBy: userId,
        updatedBy: userId,
      },
    })
    console.log(`✓ Organisation Registration: GST ${GSTIN}`)
  } else {
    await prisma.organisationRegistration.update({
      where: { id: existingGstReg.id },
      data: {
        registrationNumber: GSTIN,
        country: 'India',
        state: 'Gujarat',
        status: 'ACTIVE',
        updatedBy: userId,
      },
    })
    console.log(`✓ Organisation Registration updated: GST ${GSTIN}`)
  }

  // ── 3. Fiscal Year ────────────────────────────────────────────────────
  const now = new Date()
  const fyStartYear = now.getUTCMonth() + 1 >= 4 ? now.getUTCFullYear() : now.getUTCFullYear() - 1
  const fyStart = new Date(Date.UTC(fyStartYear, 3, 1))
  const fyEnd = new Date(Date.UTC(fyStartYear + 1, 2, 31))
  const fyName = `FY ${fyStartYear}-${String(fyStartYear + 1).slice(-2)}`

  await prisma.financialYear.updateMany({
    where: { tenantId: tenant.id, legalEntityId: le.id, isCurrent: true },
    data: { isCurrent: false },
  })

  let fy = await prisma.financialYear.findFirst({
    where: { tenantId: tenant.id, legalEntityId: le.id, name: fyName },
  })
  if (!fy) {
    fy = await prisma.financialYear.create({
      data: {
        tenantId: tenant.id,
        legalEntityId: le.id,
        name: fyName,
        startDate: fyStart,
        endDate: fyEnd,
        status: 'ACTIVE',
        isCurrent: true,
        createdBy: userId,
        updatedBy: userId,
      },
    })
  } else {
    fy = await prisma.financialYear.update({
      where: { id: fy.id },
      data: { status: 'ACTIVE', isCurrent: true, updatedBy: userId },
    })
  }
  console.log(`✓ Fiscal Year: ${fy.name} (${fy.status})`)

  // ── 4. Posting Periods ────────────────────────────────────────────────
  const existingPeriods = await prisma.accountingPeriod.count({
    where: { tenantId: tenant.id, legalEntityId: le.id, financialYearId: fy.id },
  })
  if (existingPeriods === 0) {
    const periods = []
    for (let m = 0; m < 12; m++) {
      const monthIndex = (3 + m) % 12
      const year = fyStartYear + (3 + m >= 12 ? 1 : 0)
      const start = new Date(Date.UTC(year, monthIndex, 1))
      const end = new Date(Date.UTC(year, monthIndex + 1, 0))
      periods.push({
        tenantId: tenant.id,
        legalEntityId: le.id,
        financialYearId: fy.id,
        periodNumber: m + 1,
        name: start.toLocaleString('en-IN', { month: 'short', year: 'numeric', timeZone: 'UTC' }),
        startDate: start,
        endDate: end,
        status: 'OPEN' as const,
      })
    }
    await prisma.accountingPeriod.createMany({ data: periods })
    console.log(`✓ Posting Periods: 12 OPEN months created`)
  } else {
    console.log(`✓ Posting Periods: ${existingPeriods} already present`)
  }

  // ── 5. Chart of Accounts ──────────────────────────────────────────────
  const accountCount = await prisma.account.count({
    where: { tenantId: tenant.id, legalEntityId: le.id },
  })
  if (accountCount === 0) {
    const created = await applyCoaTemplate(tenant.id, userId, {
      legalEntityId: le.id,
      templateId: 'MANUFACTURING',
    })
    console.log(`✓ Chart of Accounts: Manufacturing template (${created} accounts)`)
  } else {
    console.log(`✓ Chart of Accounts: ${accountCount} accounts already present`)
    // Additive: tenants that applied CoA before 5600 existed still need COGS leaf.
    const cogsExisting = await prisma.account.findFirst({
      where: { tenantId: tenant.id, legalEntityId: le.id, accountCode: '5600' },
    })
    if (!cogsExisting) {
      const expensesParent = await prisma.account.findFirst({
        where: { tenantId: tenant.id, legalEntityId: le.id, accountCode: '5000', isGroup: true },
        select: { id: true },
      })
      await prisma.account.create({
        data: {
          tenantId: tenant.id,
          legalEntityId: le.id,
          parentId: expensesParent?.id ?? null,
          accountCode: '5600',
          accountName: 'Cost of Goods Sold',
          category: 'EXPENSE',
          accountType: 'EXPENSE',
          normalBalance: 'DEBIT',
          isGroup: false,
          isActive: true,
          createdBy: userId,
          updatedBy: userId,
        },
      })
      console.log(`✓ Chart of Accounts: added leaf 5600 Cost of Goods Sold`)
    }
  }

  // ── 6. Account Mapping ────────────────────────────────────────────────
  const accounts = await prisma.account.findMany({
    where: { tenantId: tenant.id, legalEntityId: le.id, isActive: true, isGroup: false },
    select: { id: true, accountCode: true },
  })
  const byCode = new Map(accounts.map((a) => [a.accountCode, a.id]))

  let mapped = 0
  for (const key of MANDATORY_MAPPING_KEYS) {
    const code = MAPPING_BY_CODE[key]
    if (!code) continue
    const accountId = byCode.get(code)
    if (!accountId) {
      console.warn(`  ! Missing account ${code} for mapping ${key}`)
      continue
    }
    await prisma.defaultAccountMapping.upsert({
      where: { legalEntityId_mappingKey: { legalEntityId: le.id, mappingKey: key } },
      create: {
        tenantId: tenant.id,
        legalEntityId: le.id,
        mappingKey: key,
        accountId,
        isMandatory: true,
        createdBy: userId,
        updatedBy: userId,
      },
      update: { accountId, isMandatory: true, updatedBy: userId },
    })
    mapped += 1
  }
  // Also upsert manufacturing inventory / variance mappings (optional keys)
  let mfgMapped = 0
  for (const [key, code] of Object.entries(MAPPING_BY_CODE) as Array<[DefaultAccountMappingKey, string]>) {
    if ((MANDATORY_MAPPING_KEYS as readonly string[]).includes(key)) continue
    const accountId = byCode.get(code)
    if (!accountId) continue
    await prisma.defaultAccountMapping.upsert({
      where: { legalEntityId_mappingKey: { legalEntityId: le.id, mappingKey: key } },
      create: {
        tenantId: tenant.id,
        legalEntityId: le.id,
        mappingKey: key,
        accountId,
        isMandatory: false,
        createdBy: userId,
        updatedBy: userId,
      },
      update: { accountId, updatedBy: userId },
    })
    mfgMapped += 1
  }
  console.log(`✓ Account Mapping: ${mapped}/${MANDATORY_MAPPING_KEYS.length} mandatory + ${mfgMapped} mfg inventory/variance`)

  // ── 7. Cost Centres ───────────────────────────────────────────────────
  let ccCount = 0
  for (const cc of COST_CENTRES) {
    await prisma.costCentre.upsert({
      where: { legalEntityId_code: { legalEntityId: le.id, code: cc.code } },
      create: {
        tenantId: tenant.id,
        legalEntityId: le.id,
        code: cc.code,
        name: cc.name,
        isGroup: false,
        isActive: true,
      },
      update: {
        name: cc.name,
        isActive: true,
      },
    })
    ccCount += 1
  }
  console.log(`✓ Cost Centres: ${ccCount}`)

  // ── 8. Number Series ──────────────────────────────────────────────────
  for (const documentType of REQUIRED_NUMBER_SERIES_TYPES) {
    await prisma.financeNumberSeries.upsert({
      where: {
        legalEntityId_documentType: {
          legalEntityId: le.id,
          documentType: documentType as FinanceDocumentType,
        },
      },
      create: {
        tenantId: tenant.id,
        legalEntityId: le.id,
        documentType: documentType as FinanceDocumentType,
        financialYearId: fy.id,
        prefix: SERIES_PREFIX[documentType],
        currentValue: 0,
        padLength: 6,
        resetEachYear: true,
        isActive: true,
      },
      update: {
        financialYearId: fy.id,
        prefix: SERIES_PREFIX[documentType],
        isActive: true,
      },
    })
  }
  for (const series of EXTRA_SERIES) {
    await prisma.financeNumberSeries.upsert({
      where: {
        legalEntityId_documentType: {
          legalEntityId: le.id,
          documentType: series.documentType,
        },
      },
      create: {
        tenantId: tenant.id,
        legalEntityId: le.id,
        documentType: series.documentType,
        financialYearId: fy.id,
        prefix: series.prefix,
        currentValue: 0,
        padLength: 6,
        resetEachYear: true,
        isActive: true,
      },
      update: {
        financialYearId: fy.id,
        prefix: series.prefix,
        isActive: true,
      },
    })
  }
  console.log(
    `✓ Number Series: ${REQUIRED_NUMBER_SERIES_TYPES.length} voucher + ${EXTRA_SERIES.length} AP/AR document types`,
  )

  // ── 9. Activate Finance (core AP/AR/Journal) — NOT Manufacturing Accounting ─
  const status = await computeSetupStatus(tenant.id, le.id)
  if (status.financeActivated) {
    console.log('✓ Finance already activated')
  } else if (status.ready) {
    await activateFinance(tenant.id, userId, { legalEntityId: le.id })
    console.log('✓ Finance activated')
  } else {
    console.warn('! Finance not activated — still missing:')
    for (const m of status.missing) {
      console.warn(`  - ${m.key}: ${m.label} (${m.count})`)
    }
  }

  // Explicitly keep Manufacturing Accounting disabled until pilot sign-off checklist.
  await prisma.financeFeatureControl.upsert({
    where: {
      legalEntityId_featureKey: { legalEntityId: le.id, featureKey: 'MANUFACTURING_ACCOUNTING' },
    },
    create: {
      tenantId: tenant.id,
      legalEntityId: le.id,
      featureKey: 'MANUFACTURING_ACCOUNTING',
      isEnabled: false,
      configurationJson: {
        enableWhen: [
          'Inventory postings reconcile',
          'WIP account configured',
          'FG account configured',
          'Variance accounts configured',
          'Financial period open',
          'Pilot Finance user signs off',
        ],
      },
      updatedBy: userId,
    },
    update: {
      isEnabled: false,
      updatedBy: userId,
    },
  })
  console.log('✓ Manufacturing Accounting: DISABLED (pilot checklist required to enable)')

  console.log('\n=== Primary Module Setup ===')
  console.log('✓ Organisation')
  console.log('✓ Legal Entity (Private Limited Company)')
  console.log(`✓ Tax Registration (GSTIN ${GSTIN})`)
  console.log('✓ Fiscal Year')
  console.log('✓ Posting Periods')
  console.log('✓ Chart of Accounts')
  console.log('✓ Cost Centres')
  console.log('✓ Number Series')
  console.log('✓ Posting Mappings')
  console.log('\nManufacturing Accounting remains OFF until:')
  console.log('  · Inventory postings reconcile')
  console.log('  · WIP / FG / variance accounts configured')
  console.log('  · Financial period open')
  console.log('  · Pilot Finance user signs off (API enable requires confirmations)')
  console.log(`\nTenant slug (login org): ${TENANT_SLUG}`)
  console.log(`UI: /organisation  ·  /accounting/settings`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })

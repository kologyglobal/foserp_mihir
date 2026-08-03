/**
 * Configure organisation + finance primary module for Kology Global Groupe
 * on the SERVICES tenant (default slug: kology).
 *
 * Covers: Organisation, Legal Entity, Tax (GSTIN), CoA (SERVICE), Account Mapping,
 * Fiscal Year, Posting Periods, Number Series, Finance activation.
 *
 * Usage: npx tsx scripts/seed-kology-organisation-setup.ts
 * Optional: TENANT_SLUG=kology
 *
 * Seed/setup only — does not hardcode tenant slug in app runtime.
 */
import type { DefaultAccountMappingKey, FinanceDocumentType } from '@prisma/client'
import { prisma } from '../src/config/database.js'
import { applyCoaTemplate } from '../src/modules/accounting/accounts/account.repository.js'
import {
  computeSetupStatus,
  activateFinance,
} from '../src/modules/accounting/finance-settings/finance-settings.repository.js'
import {
  MANDATORY_MAPPING_KEYS,
  REQUIRED_NUMBER_SERIES_TYPES,
} from '../src/modules/accounting/shared/finance.constants.js'

const TENANT_SLUG = process.env.TENANT_SLUG ?? 'kology'

const ORG = {
  name: 'Kology',
  legalName: 'Kology Global Groupe Pvt. Ltd.',
  tradeName: 'Kology Global Groupe',
  email: 'office@kology.co',
  phone: '+91 9876500000',
  website: 'www.kology.co',
  country: 'India',
  state: 'Gujarat',
  city: 'Ahmedabad',
  timezone: 'Asia/Kolkata',
  currency: 'INR',
} as const

/** Demo GSTIN (Gujarat / 24) — replace with real registration when available. */
const GSTIN = '24AAACK1234A1Z5'
const PAN = 'AAACK1234A'
const STATE_CODE = '24'

/** Letterhead address — Proforma / Sales Order / Tax Invoice prints. */
const ADDRESS = {
  line1: 'Sharan Circle Business Hub, 312,313,314',
  line2: 'Chandkheda - Zundal Rd, Zundal',
  district: 'Ahmedabad',
  city: 'Ahmedabad',
  state: 'Gujarat',
  postalCode: '382424',
  stateCode: STATE_CODE,
  country: 'India',
  countryCode: 'IN',
  gstin: GSTIN,
}

/** Letterhead bank / remittance details — shown on Proforma, Sales Order and Tax Invoice prints. */
const BANK_DETAILS = {
  bankAccountName: ORG.legalName,
  bankName: 'IDFC FIRST Bank',
  bankAccountNumber: '51423051116',
  bankIfscCode: 'IDFB0040308',
  bankBranch: 'CHANDKHEDA',
} as const

/** Mandatory mapping key → CoA account code (SERVICE / base template). */
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
}

const COST_CENTRES = [
  { code: 'CC-SALES', name: 'Sales Operations' },
  { code: 'CC-MKT', name: 'Marketing' },
  { code: 'CC-CONSULT', name: 'Consulting' },
  { code: 'CC-ADMIN', name: 'Administration' },
] as const

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
  console.log(`Configuring Kology organisation on tenant slug=${TENANT_SLUG}…`)

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

  // ── 2. Legal Entity + Branch ──────────────────────────────────────────
  let le = await prisma.legalEntity.findFirst({
    where: { tenantId: tenant.id },
    orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }],
  })

  if (!le) {
    le = await prisma.legalEntity.create({
      data: {
        tenantId: tenant.id,
        code: 'KGG-HO',
        legalName: ORG.legalName,
        displayName: ORG.tradeName,
        tradeName: ORG.tradeName,
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
        email: ORG.email,
        phone: ORG.phone,
        website: ORG.website,
        ...BANK_DETAILS,
        createdBy: userId,
        updatedBy: userId,
        branches: {
          create: {
            tenantId: tenant.id,
            code: 'HO',
            name: 'Head Office — Ahmedabad',
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
    console.log(`✓ Legal Entity created: ${le.id} · ${le.code} · ${le.legalName}`)
  } else {
    await prisma.legalEntity.updateMany({
      where: { tenantId: tenant.id, isDefault: true, NOT: { id: le.id } },
      data: { isDefault: false },
    })
    le = await prisma.legalEntity.update({
      where: { id: le.id },
      data: {
        legalName: ORG.legalName,
        displayName: ORG.tradeName,
        tradeName: ORG.tradeName,
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
        email: ORG.email,
        phone: ORG.phone,
        website: ORG.website,
        ...BANK_DETAILS,
        updatedBy: userId,
      },
    })
    console.log(`✓ Legal Entity updated: ${le.id} · ${le.code} · ${le.legalName}`)
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
        name: 'Head Office — Ahmedabad',
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
        name: 'Head Office — Ahmedabad',
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
  console.log(`✓ Branch: ${branch.id} · ${branch.name} · GSTIN ${branch.gstin}`)

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
  console.log(`✓ Fiscal Year: ${fy.id} · ${fy.name} (${fy.status})`)

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

  // ── 5. Chart of Accounts (SERVICE template) ───────────────────────────
  const accountCount = await prisma.account.count({
    where: { tenantId: tenant.id, legalEntityId: le.id },
  })
  if (accountCount === 0) {
    const created = await applyCoaTemplate(tenant.id, userId, {
      legalEntityId: le.id,
      templateId: 'SERVICE',
    })
    console.log(`✓ Chart of Accounts: SERVICE template (${created} accounts)`)
  } else {
    console.log(`✓ Chart of Accounts: ${accountCount} accounts already present`)
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
  console.log(`✓ Account Mapping: ${mapped}/${MANDATORY_MAPPING_KEYS.length} mandatory`)

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

  // ── 9. Activate Finance ───────────────────────────────────────────────
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

  // Keep manufacturing accounting OFF for SERVICES packaging
  await prisma.financeFeatureControl.upsert({
    where: {
      legalEntityId_featureKey: { legalEntityId: le.id, featureKey: 'MANUFACTURING_ACCOUNTING' },
    },
    create: {
      tenantId: tenant.id,
      legalEntityId: le.id,
      featureKey: 'MANUFACTURING_ACCOUNTING',
      isEnabled: false,
      updatedBy: userId,
    },
    update: {
      isEnabled: false,
      updatedBy: userId,
    },
  })

  console.log('\n=== Kology Organisation Setup ===')
  console.log(`Tenant slug:     ${TENANT_SLUG}`)
  console.log(`Legal Entity:    ${le.id}`)
  console.log(`  name:          ${le.legalName}`)
  console.log(`  code:          ${le.code}`)
  console.log(`Branch:          ${branch.id} · ${branch.name}`)
  console.log(`Financial Year:  ${fy.id} · ${fy.name}`)
  console.log(`GSTIN:           ${GSTIN}`)
  console.log('\nUI: Accounting → Setup → Legal Entities')
  console.log('    Accounting → Organisation Setup')
  console.log('    Money In Overview (should resolve legal entity)')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })

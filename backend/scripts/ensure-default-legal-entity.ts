/**
 * Ensure tenant `vasant-trailers` has at least one active default Legal Entity
 * (and a current FY + open periods) so Receivables / Money In-Out stop 404ing
 * on the demo UUID persisted in fos-finance-setup-demo.
 *
 * Company tax SoT for this product: Vasant Trailers Pune — Maharashtra (27).
 *
 * Usage: npx tsx scripts/ensure-default-legal-entity.ts
 */
import { prisma } from '../src/config/prisma.js'

const TENANT_SLUG = process.env.TENANT_SLUG ?? 'vasant-trailers'

/** Pune plant — matches frontend COMPANY_STATE / seed-default-legal-entity. */
const LE_SEED = {
  code: 'VT-HO',
  legalName: 'Vasant Trailers Private Limited',
  displayName: 'Vasant Trailers',
  pan: 'AABCV1234E',
  gstin: '27AABCV1234E1Z9',
  stateCode: '27',
  registeredAddressJson: {
    line1: 'Plot 12, MIDC Chakan, Phase II',
    city: 'Pune',
    state: 'Maharashtra',
    postalCode: '410501',
    country: 'India',
    countryCode: 'IN',
    stateCode: '27',
  },
} as const

async function main() {
  const tenant = await prisma.tenant.findFirst({
    where: { slug: TENANT_SLUG, deletedAt: null },
  })
  if (!tenant) throw new Error(`Tenant not found: ${TENANT_SLUG}`)

  let le = await prisma.legalEntity.findFirst({
    where: { tenantId: tenant.id, isActive: true },
    orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }],
  })

  if (!le) {
    le = await prisma.legalEntity.create({
      data: {
        tenantId: tenant.id,
        code: LE_SEED.code,
        legalName: LE_SEED.legalName,
        displayName: LE_SEED.displayName,
        entityType: 'PRIVATE_LIMITED',
        pan: LE_SEED.pan,
        gstin: LE_SEED.gstin,
        baseCurrency: 'INR',
        countryCode: 'IN',
        stateCode: LE_SEED.stateCode,
        registeredAddressJson: LE_SEED.registeredAddressJson,
        fiscalYearStartMonth: 4,
        isDefault: true,
        isActive: true,
        branches: {
          create: {
            tenantId: tenant.id,
            code: 'HO',
            name: 'Pune Head Office',
            branchType: 'HEAD_OFFICE',
            gstin: LE_SEED.gstin,
            stateCode: LE_SEED.stateCode,
            isDefault: true,
            isActive: true,
            isHeadOffice: true,
          },
        },
      },
    })
    console.log(`Created legal entity ${le.id} (${le.code}) state=${le.stateCode} gstin=${le.gstin}`)
  } else {
    // Heal mis-seeded seller state for vasant-trailers product SoT (Pune / MH).
    // Legacy scripts seeded Veer Gujarat (24) on this tenant; user tax identity is Maharashtra (27).
    const isProductTenant = TENANT_SLUG === 'vasant-trailers' || TENANT_SLUG === 'trailer-erp'
    const needsHeal =
      isProductTenant &&
      (le.stateCode === '24' ||
        !le.gstin?.trim() ||
        le.gstin.startsWith('24') ||
        (le.stateCode ?? '').trim() === '')

    if (needsHeal) {
      le = await prisma.legalEntity.update({
        where: { id: le.id },
        data: {
          pan: LE_SEED.pan,
          gstin: LE_SEED.gstin,
          stateCode: LE_SEED.stateCode,
          registeredAddressJson: LE_SEED.registeredAddressJson,
          legalName: LE_SEED.legalName,
          displayName: LE_SEED.displayName,
          tradeName: LE_SEED.displayName,
          isDefault: true,
          isActive: true,
        },
      })
      // Align default branch GST registration with LE.
      await prisma.branch.updateMany({
        where: { tenantId: tenant.id, legalEntityId: le.id, isDefault: true },
        data: {
          gstin: LE_SEED.gstin,
          stateCode: LE_SEED.stateCode,
        },
      })
      console.log(`Healed legal entity ${le.id} → Maharashtra (27) gstin=${le.gstin}`)
    }

    if (!le.isDefault) {
      await prisma.legalEntity.updateMany({
        where: { tenantId: tenant.id, isDefault: true },
        data: { isDefault: false },
      })
      le = await prisma.legalEntity.update({
        where: { id: le.id },
        data: { isDefault: true },
      })
    }
    console.log(`Using legal entity ${le.id} (${le.code}) state=${le.stateCode} gstin=${le.gstin ?? '—'}`)
  }

  const now = new Date()
  const fyStartYear = now.getMonth() + 1 >= 4 ? now.getFullYear() : now.getFullYear() - 1
  const fyStart = new Date(Date.UTC(fyStartYear, 3, 1))
  const fyEnd = new Date(Date.UTC(fyStartYear + 1, 2, 31))

  let fy = await prisma.financialYear.findFirst({
    where: { tenantId: tenant.id, legalEntityId: le.id, isCurrent: true },
  })
  if (!fy) {
    fy = await prisma.financialYear.create({
      data: {
        tenantId: tenant.id,
        legalEntityId: le.id,
        name: `FY ${fyStartYear}-${String(fyStartYear + 1).slice(-2)}`,
        startDate: fyStart,
        endDate: fyEnd,
        status: 'ACTIVE',
        isCurrent: true,
      },
    })
    console.log(`Created financial year ${fy.id} (${fy.name})`)
  } else {
    console.log(`Using financial year ${fy.id} (${fy.name})`)
  }

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
        name: start.toLocaleString('en-IN', { month: 'short', year: 'numeric', timeZone: 'UTC' }),
        periodNumber: m + 1,
        startDate: start,
        endDate: end,
        status: 'OPEN' as const,
      })
    }
    await prisma.accountingPeriod.createMany({ data: periods })
    console.log(`Created ${periods.length} open accounting periods`)
  } else {
    console.log(`Periods already present: ${existingPeriods}`)
  }

  console.log('\nDone. Hard-refresh the app so Tax Invoice reloads seller state from LE.')
  console.log(`legalEntityId=${le.id} supplierStateCode=${le.stateCode}`)
}

main()
  .catch((err) => {
    console.error(err)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })

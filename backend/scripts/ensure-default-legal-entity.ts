/**
 * Ensure tenant `vasant-trailers` has at least one active default Legal Entity
 * (and a current FY + open periods) so Receivables / Money In-Out stop 404ing
 * on the demo UUID persisted in fos-finance-setup-demo.
 *
 * Usage: npx tsx scripts/ensure-default-legal-entity.ts
 */
import { prisma } from '../src/config/database.js'

const TENANT_SLUG = process.env.TENANT_SLUG ?? 'vasant-trailers'

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
        code: 'VT-HO',
        legalName: 'Vasant Trailers Private Limited',
        displayName: 'Vasant Trailers',
        entityType: 'PRIVATE_LIMITED',
        baseCurrency: 'INR',
        countryCode: 'IN',
        stateCode: '24',
        fiscalYearStartMonth: 4,
        isDefault: true,
        isActive: true,
        branches: {
          create: {
            tenantId: tenant.id,
            code: 'HO',
            name: 'Head Office',
            branchType: 'HEAD_OFFICE',
            isDefault: true,
            isActive: true,
          },
        },
      },
    })
    console.log(`Created legal entity ${le.id} (${le.code})`)
  } else {
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
    console.log(`Using existing legal entity ${le.id} (${le.code})`)
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

  console.log('\nDone. Refresh Receivables after clearing stale LE selection (or hard-refresh).')
  console.log(`legalEntityId=${le.id}`)
}

main()
  .catch((err) => {
    console.error(err)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
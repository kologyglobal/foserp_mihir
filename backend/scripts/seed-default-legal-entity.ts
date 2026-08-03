/**
 * Seed a default Legal Entity (+ Head Office branch, FinanceSettings, current FY)
 * for tenants that have none — unblocks Vendor Invoice / AP handoff.
 *
 * Usage:
 *   npx tsx scripts/seed-default-legal-entity.ts
 *   TENANT_SLUG=vasant-trailers npx tsx scripts/seed-default-legal-entity.ts
 */
import { prisma } from '../src/config/prisma.js'
import { ensureDefaultLegalEntity } from '../src/modules/accounting/legal-entities/ensure-default-legal-entity.js'

const TENANT_SLUG = process.env.TENANT_SLUG?.trim()

async function main() {
  const tenants = await prisma.tenant.findMany({
    where: {
      deletedAt: null,
      ...(TENANT_SLUG ? { slug: TENANT_SLUG } : {}),
    },
    select: { id: true, slug: true, name: true },
    orderBy: { createdAt: 'asc' },
  })

  if (tenants.length === 0) {
    console.error(TENANT_SLUG ? `No tenant found for slug=${TENANT_SLUG}` : 'No tenants found')
    process.exit(1)
  }

  for (const tenant of tenants) {
    const before = await prisma.legalEntity.count({ where: { tenantId: tenant.id } })
    const vasantSeed =
      tenant.slug === 'vasant-trailers'
        ? {
            code: 'LE-VTL',
            legalName: 'Vasant Trailers Private Limited',
            displayName: 'Vasant Trailers',
            tradeName: 'Vasant Trailers',
            registeredAddressJson: {
              line1: 'MIDC Chakan, Phase II',
              city: 'Pune',
              state: 'Maharashtra',
              postalCode: '410501',
              country: 'India',
              countryCode: 'IN',
              stateCode: '27',
            },
            branchCode: 'HO-PUNE',
            branchName: 'Pune Head Office',
          }
        : undefined
    const legalEntityId = await ensureDefaultLegalEntity(tenant.id, vasantSeed)
    const after = await prisma.legalEntity.findMany({
      where: { tenantId: tenant.id },
      select: { id: true, code: true, displayName: true, isDefault: true, gstin: true },
    })
    console.log(
      `✓ ${tenant.slug} (${tenant.name}): legalEntityId=${legalEntityId}` +
        (before === 0 ? ' [created]' : ' [existing]'),
    )
    for (const le of after) {
      console.log(`    - ${le.code} · ${le.displayName} · gstin=${le.gstin ?? '—'} · default=${le.isDefault}`)
    }
  }
}

main()
  .catch((err) => {
    console.error(err)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })

import { prisma } from '../src/config/database.js'
import { getReadiness } from '../src/modules/manufacturing/accounting/manufacturing-accounting-readiness.service.js'

async function main() {
  const t = await prisma.tenant.findFirst({ where: { slug: 'vasant-trailers' } })
  if (!t) throw new Error('tenant missing')
  const le = await prisma.legalEntity.findFirst({ where: { tenantId: t.id, isActive: true } })
  if (!le) throw new Error('LE missing')
  const r = await getReadiness({ tenantId: t.id, legalEntityId: le.id })
  console.log(
    JSON.stringify(
      {
        ready: r.ready,
        canEnable: r.canEnable,
        nextAction: r.nextAction,
        blockingCodes: r.blockingCodes.slice(0, 10),
        flag: r.featureFlag.enabled,
        checks: Object.fromEntries(Object.entries(r.checks).map(([k, v]) => [k, (v as { passed: boolean }).passed])),
      },
      null,
      2,
    ),
  )
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })

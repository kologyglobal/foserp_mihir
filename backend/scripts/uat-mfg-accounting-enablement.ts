/**
 * Live UAT smoke for Manufacturing Accounting enablement on a tenant (default: vasant-trailers).
 *
 * Does NOT enable the flag. Verifies:
 *   - login + permission keys present on the session
 *   - GET /manufacturing/accounting/gate
 *   - GET /manufacturing/accounting/readiness
 *   - GET feature-control status
 *   - prints nextAction / blockers for the UAT checklist
 *
 * Prereq: `npx tsx scripts/sync-permissions.ts` then re-login (this script logs in fresh).
 *
 * Usage:
 *   npx tsx scripts/uat-mfg-accounting-enablement.ts
 *   TENANT_SLUG=vasant-trailers npx tsx scripts/uat-mfg-accounting-enablement.ts
 */
import request from 'supertest'
import { createApp } from '../src/app.js'
import { prisma } from '../src/config/database.js'

const TENANT_SLUG = process.env.TENANT_SLUG ?? 'vasant-trailers'
const EMAIL = process.env.UAT_EMAIL ?? 'admin@vasant-trailers.com'
const PASSWORD = process.env.UAT_PASSWORD ?? 'Admin@123'

const REQUIRED_PERMS = [
  'manufacturing.accounting.view',
  'manufacturing.accounting.readiness',
  'manufacturing.accounting.reconcile_signoff',
  'manufacturing.accounting.finance_signoff',
  'manufacturing.accounting.enable',
  'manufacturing.accounting.disable',
  'manufacturing.accounting.failed_events.view',
  'finance.settings.manage',
] as const

const app = createApp()

function fail(msg: string): never {
  console.error(`\n✗ ${msg}`)
  process.exit(1)
}

function ok(step: string, detail = '') {
  console.log(`✓ ${step}${detail ? ` — ${detail}` : ''}`)
}

async function main() {
  const tenant = await prisma.tenant.findFirst({ where: { slug: TENANT_SLUG, deletedAt: null } })
  if (!tenant) fail(`Tenant ${TENANT_SLUG} not found`)

  const le = await prisma.legalEntity.findFirst({
    where: { tenantId: tenant!.id, isActive: true },
    orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }],
  })
  if (!le) fail('No active legal entity')

  const login = await request(app).post('/api/v1/auth/login').send({
    email: EMAIL,
    password: PASSWORD,
    tenantSlug: TENANT_SLUG,
  })
  if (login.status !== 200 || !login.body.data?.accessToken) {
    fail(`Login failed: ${login.status} ${JSON.stringify(login.body)}`)
  }
  const token = login.body.data.accessToken as string
  const sessionPerms: string[] = login.body.data.user?.permissions ?? []
  ok('login', EMAIL)

  const missingPerms = REQUIRED_PERMS.filter((p) => !sessionPerms.includes(p))
  if (missingPerms.length) {
    fail(
      `Session missing enablement permissions (run sync-permissions.ts + re-login): ${missingPerms.join(', ')}`,
    )
  }
  ok('session permissions', `${REQUIRED_PERMS.length} enablement keys present`)

  const base = `/api/v1/t/${TENANT_SLUG}/manufacturing/accounting`
  const auth = (req: request.Test) => req.set('Authorization', `Bearer ${token}`)

  const gate = await auth(request(app).get(`${base}/gate`))
  if (gate.status !== 200) fail(`GET gate → ${gate.status} ${JSON.stringify(gate.body)}`)
  ok('GET /gate', `enabled=${gate.body.data?.enabled} reason=${gate.body.data?.reason}`)

  const readiness = await auth(request(app).get(`${base}/readiness`).query({ legalEntityId: le!.id }))
  if (readiness.status !== 200) fail(`GET readiness → ${readiness.status} ${JSON.stringify(readiness.body)}`)
  const r = readiness.body.data
  ok(
    'GET /readiness',
    `canEnable=${r?.canEnable} nextAction=${r?.nextAction?.code ?? r?.nextAction} blockers=${(r?.blockingCodes ?? []).length}`,
  )

  const feature = await auth(
    request(app).get(`${base}/feature-controls/${le!.id}/MANUFACTURING_ACCOUNTING`),
  )
  if (feature.status !== 200) {
    fail(`GET feature-control → ${feature.status} ${JSON.stringify(feature.body)}`)
  }
  ok(
    'GET feature-control',
    `isEnabled=${feature.body.data?.isEnabled} enablement.ready=${feature.body.data?.enablement?.ready}`,
  )

  // Missing required sign-offs — Zod 400 or service 422 both prove the route is wired.
  const badEnable = await auth(request(app).post(`${base}/enable`)).send({
    legalEntityId: le!.id,
  })
  if (![400, 422].includes(badEnable.status)) {
    fail(`POST enable without sign-offs expected 400/422, got ${badEnable.status}`)
  }
  ok('POST /enable without sign-offs', `${badEnable.status} ${badEnable.body?.code ?? badEnable.body?.message ?? ''}`)

  console.log('\n── UAT snapshot (flag NOT enabled by this script) ──')
  console.log(
    JSON.stringify(
      {
        tenant: TENANT_SLUG,
        legalEntityId: le!.id,
        legalEntityCode: le!.code,
        flagEnabled: Boolean(gate.body.data?.enabled ?? feature.body.data?.isEnabled),
        canEnable: r?.canEnable ?? false,
        nextAction: r?.nextAction ?? null,
        blockingCodes: r?.blockingCodes ?? feature.body.data?.enablement?.blockers ?? [],
        mappingMissing: r?.checks?.accountMappings?.missing ?? r?.mappingKeys?.missing ?? null,
      },
      null,
      2,
    ),
  )
  console.log('\nManual UI path: Accounting → Manufacturing Accounting → Enable…')
  console.log('See docs/manufacturing/accounting/MANUFACTURING_ACCOUNTING_UAT_CHECKLIST.md')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })

/**
 * Focused readiness/enablement gate checks (no full WO fixture).
 * Usage: npx tsx scripts/test-mfg-accounting-enablement-gate.ts
 */
import { prisma } from '../src/config/database.js'
import { getManufacturingAccountingReadiness } from '../src/modules/manufacturing/costing/accounting-readiness.service.js'
import { setManufacturingAccountingFeature } from '../src/modules/manufacturing/accounting/manufacturing-feature-control.service.js'
import type { Request } from 'express'

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg)
}

async function main() {
  const slug = process.env.TENANT_SLUG ?? 'vasant-trailers'
  const tenant = await prisma.tenant.findFirst({ where: { slug, deletedAt: null } })
  if (!tenant) throw new Error(`Tenant ${slug} not found`)

  const le = await prisma.legalEntity.findFirst({
    where: { tenantId: tenant.id, isActive: true },
    orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }],
  })
  if (!le) throw new Error('No active legal entity')

  const readiness = await getManufacturingAccountingReadiness(tenant.id, undefined, le.id)
  assert(Boolean(readiness.enablementChecks), 'enablementChecks present')
  assert(typeof readiness.enablementChecks!.canEnable === 'boolean', 'canEnable boolean')
  assert(typeof readiness.unreconciledAccountingEventCount === 'number', 'unreconciled count')
  assert(Array.isArray(readiness.blockers), 'blockers array')
  assert(Array.isArray(readiness.mappingKeys?.required), 'mappingKeys.required')
  assert(Array.isArray(readiness.mappingKeys?.missing), 'mappingKeys.missing')
  assert(typeof readiness.postingDateChecked === 'string' || readiness.postingDateChecked === null, 'postingDateChecked')
  assert(readiness.eventIntegrity && Array.isArray(readiness.eventIntegrity.exceptions), 'eventIntegrity.exceptions')
  assert(typeof readiness.eventIntegrity.counts.failed === 'number', 'eventIntegrity.counts.failed')
  assert(typeof readiness.inventoryPostingsUnreconciledCount === 'number', 'inventoryPostingsUnreconciledCount')
  for (const ex of readiness.eventIntegrity.exceptions) {
    if (ex.failureReason) {
      assert(!/\bat\s+\S+/.test(ex.failureReason), 'UI exception must not include stack frames')
    }
  }
  if (readiness.openPeriod) {
    assert(typeof readiness.openPeriod.id === 'string', 'openPeriod.id')
    assert(typeof readiness.openPeriod.code === 'string', 'openPeriod.code')
    assert(typeof readiness.openPeriod.startDate === 'string', 'openPeriod.startDate')
    assert(typeof readiness.openPeriod.endDate === 'string', 'openPeriod.endDate')
    assert(typeof readiness.openPeriod.status === 'string', 'openPeriod.status')
  }
  if (!readiness.enablementChecks!.openFinancialPeriodExists) {
    assert(readiness.blockers.includes('NO_OPEN_ACCOUNTING_PERIOD'), 'NO_OPEN_ACCOUNTING_PERIOD when closed')
  }
  assert(
    readiness.mappingKeys.required.includes('WIP_INVENTORY') &&
      readiness.mappingKeys.required.includes('FINISHED_GOODS_INVENTORY') &&
      readiness.mappingKeys.required.includes('PRODUCTION_VARIANCE'),
    'core mapping keys required',
  )
  if (readiness.mappingKeys.missing.length > 0) {
    assert(
      readiness.blockers.includes('MISSING_ACCOUNT_MAPPINGS'),
      'missing keys imply MISSING_ACCOUNT_MAPPINGS',
    )
  }

  // Enable without sign-offs must fail with 422 product codes (authenticated + permitted).
  const stubReq = {
    context: {
      userId: 'gate-script-user',
      tenantId: tenant.id,
      roles: [],
      permissions: ['finance.settings.manage', 'manufacturing.accounting.reconcile'],
      isSuperAdmin: false,
    },
  } as Request
  let signOffRejected = false
  try {
    await setManufacturingAccountingFeature(stubReq, tenant.id, le.id, { isEnabled: true })
  } catch (e) {
    signOffRejected = true
    const err = e as { code?: string; message?: string }
    assert(
      err.code === 'INVENTORY_RECONCILE_NOT_SIGNED_OFF' ||
        /inventoryReconcileConfirmed|INVENTORY_RECONCILE/i.test(String(err.message ?? e)),
      `expected INVENTORY_RECONCILE_NOT_SIGNED_OFF, got: ${err.code ?? err.message ?? e}`,
    )
  }
  assert(signOffRejected, 'enable without sign-off rejected')

  // Unauthenticated enable must fail
  let authRejected = false
  try {
    await setManufacturingAccountingFeature(
      { context: { userId: null } } as Request,
      tenant.id,
      le.id,
      { isEnabled: true, inventoryReconcileConfirmed: true, pilotSignOff: true },
    )
  } catch {
    authRejected = true
  }
  assert(authRejected, 'enable without auth rejected')

  // Flag must remain off
  const control = await prisma.financeFeatureControl.findFirst({
    where: { tenantId: tenant.id, legalEntityId: le.id, featureKey: 'MANUFACTURING_ACCOUNTING' },
  })
  assert(!(control?.isEnabled ?? false), 'flag remains off after rejected enable')

  console.log('✓ enablementChecks payload OK')
  console.log(`  canEnable=${readiness.enablementChecks!.canEnable}`)
  console.log(`  failed=${readiness.failedEventCount} unreconciled=${readiness.unreconciledAccountingEventCount}`)
  console.log(`  mapping missing=${readiness.mappingKeys.missing.join(', ') || '(none)'}`)
  console.log(
    `  period=${readiness.openPeriod ? `${readiness.openPeriod.code}/${readiness.openPeriod.status}` : '(none)'} asOf=${readiness.postingDateChecked}`,
  )
  console.log(
    `  events failed=${readiness.failedEventCount} unreconciledInv=${readiness.inventoryPostingsUnreconciledCount} exceptions=${readiness.eventIntegrity.counts.totalExceptions}`,
  )
  console.log(`  blockers=${readiness.blockers.join(', ') || '(none)'}`)
  console.log('✓ enable without sign-off rejected; flag stays OFF')
  console.log('\nMANUFACTURING ACCOUNTING ENABLEMENT GATE — READY\n')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })

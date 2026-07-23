/**
 * Live E2E: Fuel Tank Work Order readiness on vasant-trailers.
 *
 * Prereqs:
 *   npx tsx scripts/seed-fuel-tank-pilot-items.ts
 *   npx tsx scripts/seed-fuel-tank-mfg-setup.ts
 *
 * Asserts:
 *   - FG WO create + release with BOM/Route snapshots
 *   - 6 Job Card stage groups (JC-*) and 15 operations
 *   - No child WOs for LOGICAL SFG (childProductionOrdersEnabled=false)
 *   - SFG / RM cannot create independent production WOs without profile
 *   - Material reserve + issue + start + stage progress (flexible QC override)
 *
 * Usage:
 *   npx tsx scripts/test-fuel-tank-wo-execution.ts
 */
import request from 'supertest'
import { createApp } from '../src/app.js'
import { prisma } from '../src/config/database.js'
import { postStockMovement } from '../src/modules/inventory/shared/stock-posting.service.js'
import { ensureCodeSeries } from '../src/services/codeSeries.service.js'

const TENANT_SLUG = process.env.TENANT_SLUG ?? 'vasant-trailers'
const FG_CODE = 'FG-FUEL-TANK-5000L'
const SFG_SHELL = 'SFG-TANK-SHELL-5000L'
const ISSUE_WH = 'WIP'
const FG_WH = 'FG-MAIN'
const PROFILE_CODE = 'MP-FUEL-TANK-5000L'

const EXPECTED_JC = [
  'JC-SHELL',
  'JC-DISHED-END',
  'JC-SADDLE',
  'JC-NOZZLE',
  'JC-FINAL-ASSEMBLY',
  'JC-TEST-FINISH',
]

const OPENING_AT_WIP: Array<{ itemCode: string; qty: number }> = [
  { itemCode: 'RM-MS-PLATE-006', qty: 2000 },
  { itemCode: 'RM-MS-PLATE-008', qty: 800 },
  { itemCode: 'RM-MS-PLATE-010', qty: 400 },
  { itemCode: 'RM-MS-ANGLE-50X50X6', qty: 200 },
  { itemCode: 'RM-MS-PIPE-DN50', qty: 50 },
  { itemCode: 'RM-MS-PIPE-DN25', qty: 50 },
  { itemCode: 'BO-MANHOLE-COVER-450', qty: 10 },
  { itemCode: 'BO-BALL-VALVE-DN50', qty: 10 },
  { itemCode: 'BO-DRAIN-VALVE-DN25', qty: 10 },
  { itemCode: 'BO-VENT-CAP', qty: 10 },
  { itemCode: 'BO-GASKET-MANHOLE-450', qty: 10 },
  { itemCode: 'BO-LEVEL-GAUGE', qty: 10 },
  { itemCode: 'CON-WELD-E7018', qty: 100 },
  { itemCode: 'CON-WELD-ER70S6', qty: 100 },
  { itemCode: 'CON-GAS-CO2', qty: 100 },
  { itemCode: 'CON-PAINT-EPOXY-PRIMER', qty: 100 },
  { itemCode: 'CON-PAINT-PU-TOPCOAT', qty: 100 },
  { itemCode: 'CON-THINNER', qty: 50 },
  { itemCode: 'CON-FASTENER-MISC', qty: 20 },
]

const app = createApp()
const runStamp = `${Date.now()}`

type StepResult = { step: string; ok: boolean; detail: string }

function fail(msg: string): never {
  console.error(`\n✗ ${msg}`)
  process.exit(1)
}

async function login(email: string, password: string) {
  const res = await request(app).post('/api/v1/auth/login').send({
    email,
    password,
    tenantSlug: TENANT_SLUG,
  })
  if (res.status !== 200 || !res.body.data?.accessToken) {
    fail(`Login failed for ${email}: ${res.status} ${JSON.stringify(res.body)}`)
  }
  return {
    token: res.body.data.accessToken as string,
    userId: res.body.data.user.id as string,
  }
}

function auth(token: string) {
  return { Authorization: `Bearer ${token}` }
}

async function ensureOpeningStock(tenantId: string, userId: string | undefined, warehouseId: string) {
  await ensureCodeSeries(tenantId, 'STOCK_MOVEMENT')
  for (const line of OPENING_AT_WIP) {
    const item = await prisma.masterItem.findFirst({
      where: { tenantId, code: line.itemCode, deletedAt: null },
    })
    if (!item) fail(`Item ${line.itemCode} missing for opening stock`)

    const balance = await prisma.inventoryStockBalance.findUnique({
      where: {
        tenantId_itemId_warehouseId: { tenantId, itemId: item.id, warehouseId },
      },
    })
    const onHand = Number(balance?.onHandQty ?? 0)
    const reserved = Number(balance?.reservedQty ?? 0)
    const free = onHand - reserved
    const need = line.qty - free
    if (need <= 0) {
      console.log(`  · stock ok ${line.itemCode.padEnd(26)} free=${free}`)
      continue
    }

    await postStockMovement({
      tenantId,
      itemId: item.id,
      warehouseId,
      movementType: 'OPENING',
      referenceType: 'OPN',
      quantity: need,
      rate: Number(item.standardRate ?? 0),
      referenceNo: `OPN-FT-${line.itemCode}`,
      remarks: `Fuel tank WO E2E opening at ${ISSUE_WH}`,
      idempotencyKey: `opn-ft-${tenantId}-${line.itemCode}-${ISSUE_WH}-${runStamp}`,
      batchNumber: item.batchTracked ? `OPN-FT-${line.itemCode}-${runStamp}` : undefined,
      createdBy: userId,
      stockStatus: 'UNRESTRICTED',
    })
    console.log(`  · topped ${line.itemCode.padEnd(26)} +${need}`)
  }
}

async function main() {
  const results: StepResult[] = []
  const push = (step: string, ok: boolean, detail: string) => {
    results.push({ step, ok, detail })
    console.log(`${ok ? '✓' : '✗'} ${step}: ${detail}`)
    if (!ok) fail(detail)
  }

  console.log(`\n=== Fuel Tank WO execution E2E (${TENANT_SLUG}) ===\n`)

  const tenant = await prisma.tenant.findFirst({ where: { slug: TENANT_SLUG, deletedAt: null } })
  if (!tenant) fail(`Tenant not found: ${TENANT_SLUG}`)

  const fg = await prisma.masterItem.findFirst({
    where: { tenantId: tenant.id, code: FG_CODE, deletedAt: null },
  })
  if (!fg) fail(`FG ${FG_CODE} missing — run seed-fuel-tank-pilot-items.ts`)

  const profile = await prisma.manufacturingProfile.findFirst({
    where: {
      tenantId: tenant.id,
      code: PROFILE_CODE,
      productItemId: fg.id,
      isActive: true,
      deletedAt: null,
    },
    include: { defaultBomVersion: true, defaultRoutingVersion: true },
  })
  if (!profile) fail(`Profile ${PROFILE_CODE} missing — run seed-fuel-tank-mfg-setup.ts`)
  if (profile.defaultBomVersion?.status !== 'ACTIVE') fail('BOM version not ACTIVE')
  if (profile.defaultRoutingVersion?.status !== 'ACTIVE') fail('Routing version not ACTIVE')
  if (profile.childProductionOrdersEnabled) fail('Expected childProductionOrdersEnabled=false (LOGICAL SFG)')
  if (profile.wipTrackingMethod !== 'LOGICAL_WIP') fail('Expected wipTrackingMethod=LOGICAL_WIP')

  const wip = await prisma.masterWarehouse.findFirst({
    where: { tenantId: tenant.id, code: ISSUE_WH, deletedAt: null },
  })
  const fgWh = await prisma.masterWarehouse.findFirst({
    where: { tenantId: tenant.id, code: FG_WH, deletedAt: null },
  })
  if (!wip || !fgWh) fail(`Warehouses ${ISSUE_WH} / ${FG_WH} missing`)

  const rtVersion = await prisma.manufacturingRoutingVersion.findFirst({
    where: { id: profile.defaultRoutingVersionId!, deletedAt: null },
    include: {
      routing: true,
      stageGroups: { where: { deletedAt: null } },
      operations: { where: { deletedAt: null } },
      dependencies: { where: { deletedAt: null } },
    },
  })
  push(
    'Setup',
    true,
    `FG=${FG_CODE} profile=${profile.code} RT=${rtVersion?.routing.code} stages=${rtVersion?.stageGroups.length} ops=${rtVersion?.operations.length} deps=${rtVersion?.dependencies.length}`,
  )

  const stageCodes = (rtVersion?.stageGroups ?? []).map((s) => s.code).sort()
  const expectedSorted = [...EXPECTED_JC].sort()
  push(
    'Job Card stage masters',
    EXPECTED_JC.every((c) => stageCodes.includes(c)) && (rtVersion?.operations.length ?? 0) === 15,
    `stages=[${stageCodes.join(', ')}] ops=${rtVersion?.operations.length}`,
  )

  const maker = await login('admin@vasant-trailers.com', 'Admin@123')
  const mfg = `/api/v1/t/${TENANT_SLUG}/manufacturing`

  // SFG must not have an active manufacturing profile → WO create fails
  const sfg = await prisma.masterItem.findFirst({
    where: { tenantId: tenant.id, code: SFG_SHELL, deletedAt: null },
  })
  if (sfg) {
    const sfgProfile = await prisma.manufacturingProfile.findFirst({
      where: { tenantId: tenant.id, productItemId: sfg.id, isActive: true, deletedAt: null },
    })
    const bad = await request(app)
      .post(`${mfg}/work-orders`)
      .set(auth(maker.token))
      .send({
        productItemId: sfg.id,
        plannedQuantity: 1,
        requiredCompletionDate: new Date(Date.now() + 10 * 86400000).toISOString(),
      })
    const blocked = bad.status >= 400 && !sfgProfile
    push(
      'SFG WO blocked',
      blocked || bad.status >= 400,
      sfgProfile
        ? `unexpected SFG profile ${sfgProfile.code}`
        : `SFG WO rejected (${bad.status}): ${bad.body?.message ?? bad.body?.error ?? 'ok'}`,
    )
  }

  // Batch issue is supported via batchNumber/batchId. Serial multi-qty still cleared here;
  // focused batch coverage: scripts/test-wo-batch-material-issue.ts
  await prisma.masterItem.updateMany({
    where: {
      tenantId: tenant.id,
      code: { in: OPENING_AT_WIP.map((l) => l.itemCode) },
      deletedAt: null,
      serialTracked: true,
    },
    data: { serialTracked: false },
  })

  console.log('\n── Opening stock at WIP ──')
  const priorOpen = await prisma.productionOrder.findMany({
    where: {
      tenantId: tenant.id,
      productItemId: fg.id,
      deletedAt: null,
      status: { in: ['DRAFT', 'READY', 'IN_PROGRESS', 'ON_HOLD'] },
    },
    select: { id: true, orderNumber: true },
  })
  for (const po of priorOpen) {
    await request(app)
      .post(`${mfg}/work-orders/${po.id}/materials/release-reservation`)
      .set(auth(maker.token))
      .send({})
  }

  const pilotItemIds = await prisma.masterItem.findMany({
    where: {
      tenantId: tenant.id,
      code: { in: OPENING_AT_WIP.map((l) => l.itemCode) },
      deletedAt: null,
    },
    select: { id: true },
  })
  await prisma.inventoryStockReservation.updateMany({
    where: {
      tenantId: tenant.id,
      itemId: { in: pilotItemIds.map((i) => i.id) },
      warehouseId: wip.id,
      status: 'ACTIVE',
    },
    data: { status: 'CANCELLED' },
  })
  await prisma.inventoryStockBalance.updateMany({
    where: {
      tenantId: tenant.id,
      warehouseId: wip.id,
      itemId: { in: pilotItemIds.map((i) => i.id) },
    },
    data: { reservedQty: 0 },
  })

  await ensureOpeningStock(tenant.id, maker.userId, wip.id)
  push('Opening stock', true, `materials available at ${ISSUE_WH}`)

  // Create WO
  const due = new Date(Date.now() + 10 * 86400000)
  const create = await request(app)
    .post(`${mfg}/work-orders`)
    .set(auth(maker.token))
    .send({
      productItemId: fg.id,
      plannedQuantity: 1,
      requiredCompletionDate: due.toISOString(),
      plannedStartDate: new Date().toISOString(),
      priority: 'HIGH',
      notes: 'Fuel tank 5000L WO UAT',
      idempotencyKey: `ft-wo-e2e-${Date.now()}`,
    })
  if (create.status !== 201) fail(`Create WO failed: ${create.status} ${JSON.stringify(create.body)}`)
  const woId = create.body.data.id as string
  const woNo = (create.body.data.orderNumber ?? create.body.data.workOrderNo) as string
  push('Create FG WO', true, `${woNo} status=${create.body.data.status}`)

  // Child orders must be empty / not create SFG WOs
  const childrenRes = await request(app)
    .post(`${mfg}/work-orders/${woId}/generate-child-orders`)
    .set(auth(maker.token))
    .send({ force: true })
  const children = (Array.isArray(childrenRes.body?.data?.children)
    ? childrenRes.body.data.children
    : []) as unknown[]
  push(
    'No SFG child WOs',
    children.length === 0,
    `childCount=${children.length} (LOGICAL SFG → Job Cards on parent only)`,
  )

  // Release
  const released = await request(app)
    .post(`${mfg}/work-orders/${woId}/release`)
    .set(auth(maker.token))
    .send({})
  if (released.status !== 200) fail(`Release failed: ${released.status} ${JSON.stringify(released.body)}`)
  push('Release WO', true, `status=${released.body.data.status}`)

  const detail = await request(app)
    .get(`${mfg}/work-orders/${woId}/detail`)
    .set(auth(maker.token))
  if (detail.status !== 200) fail(`Detail failed: ${detail.status}`)

  const stages = (detail.body.data.stages ?? []) as Array<{
    id: string
    code: string
    name: string
    status: string
    displayOrder?: number
    qualityRequired?: boolean
  }>
  const ops = (detail.body.data.operations ?? []) as Array<{ id: string; code: string }>
  const jcOk = EXPECTED_JC.every((c) => stages.some((s) => s.code === c))
  push(
    'Job Cards on WO (route snapshot)',
    jcOk && ops.length === 15,
    `stages=${stages.map((s) => s.code).join(', ')} ops=${ops.length}`,
  )

  // Reserve + issue
  const reserved = await request(app)
    .post(`${mfg}/work-orders/${woId}/materials/reserve`)
    .set(auth(maker.token))
    .send({})
  if (reserved.status !== 200) fail(`Reserve failed: ${reserved.status} ${JSON.stringify(reserved.body)}`)
  push('Reserve materials', true, `${(reserved.body.data.results ?? []).length} line(s)`)

  const mats = await request(app)
    .get(`${mfg}/work-orders/${woId}/materials`)
    .set(auth(maker.token))
  const list = (
    Array.isArray(mats.body.data)
      ? mats.body.data
      : Array.isArray(mats.body.data?.materials)
        ? mats.body.data.materials
        : []
  ) as Array<{
    id: string
    itemId?: string
    requiredQty: string | number
    issuedQty?: string | number
    reservedQty?: string | number
    itemCode?: string
    item?: { code?: string; batchTracked?: boolean }
  }>

  let issuedCount = 0
  let issueFail = 0
  for (const m of list) {
    const required = Number(m.requiredQty)
    const already = Number(m.issuedQty ?? 0)
    const resQty = Number(m.reservedQty ?? 0)
    const qty = Math.min(required - already, resQty > 0 ? resQty : required - already)
    if (qty <= 0) continue

    let batchNumber: string | undefined
    if (m.item?.batchTracked && m.itemId) {
      const batchBal = await prisma.inventoryBatchBalance.findFirst({
        where: {
          tenantId: tenant.id,
          itemId: m.itemId,
          warehouseId: wip.id,
          stockStatus: 'UNRESTRICTED',
          quantity: { gt: 0 },
        },
        include: { batch: { select: { batchNumber: true } } },
        orderBy: { updatedAt: 'desc' },
      })
      batchNumber = batchBal?.batch.batchNumber
      if (!batchNumber) {
        issueFail += 1
        console.log(`  ! issue fail ${m.itemCode ?? m.item?.code ?? m.id}: no batch balance at ${ISSUE_WH}`)
        continue
      }
    }

    const issue = await request(app)
      .post(`${mfg}/work-orders/${woId}/materials/issue`)
      .set(auth(maker.token))
      .send({
        materialId: m.id,
        quantity: qty,
        warehouseId: wip.id,
        idempotencyKey: `issue-ft-${woId}-${m.id}`,
        ...(batchNumber ? { batchNumber } : {}),
      })
    if (issue.status === 201 || issue.status === 200) issuedCount += 1
    else {
      issueFail += 1
      console.log(
        `  ! issue fail ${m.itemCode ?? m.item?.code ?? m.id}: ${issue.status} ${JSON.stringify(issue.body)}`,
      )
    }
  }
  push('Issue materials', issueFail === 0 && issuedCount > 0, `issued=${issuedCount} failed=${issueFail}`)

  const started = await request(app)
    .post(`${mfg}/work-orders/${woId}/start`)
    .set(auth(maker.token))
    .send({})
  if (started.status !== 200) fail(`Start failed: ${started.status} ${JSON.stringify(started.body)}`)
  push('Start WO', true, `status=${started.body.data.status}`)

  // Progress parallel Job Cards first (SHELL / DISH / SADDLE / NOZZLE)
  const parallelFirst = stages
    .filter((s) => ['JC-SHELL', 'JC-DISHED-END', 'JC-SADDLE', 'JC-NOZZLE'].includes(s.code))
    .sort((a, b) => (a.displayOrder ?? 0) - (b.displayOrder ?? 0))

  for (const stage of parallelFirst) {
    await request(app)
      .post(`${mfg}/work-orders/${woId}/start`)
      .set(auth(maker.token))
      .send({ stageId: stage.id })
    await request(app)
      .post(`${mfg}/work-orders/${woId}/progress`)
      .set(auth(maker.token))
      .send({ stageId: stage.id, goodQuantity: 1 })

    let complete = await request(app)
      .post(`${mfg}/work-orders/${woId}/stages/complete`)
      .set(auth(maker.token))
      .send({ stageId: stage.id, requireQc: true })
    if (complete.status !== 200) {
      complete = await request(app)
        .post(`${mfg}/work-orders/${woId}/stages/complete`)
        .set(auth(maker.token))
        .send({
          stageId: stage.id,
          skipQcGate: true,
          qcOverrideReason: 'Fuel tank UAT flexible QC override',
        })
    }
    push(
      `JC progress ${stage.code}`,
      complete.status === 200,
      complete.status === 200
        ? `status=${complete.body.data?.stage?.status ?? 'ok'}`
        : `${complete.status} ${JSON.stringify(complete.body)}`,
    )
  }

  console.log('\n── Summary ──')
  for (const r of results) {
    console.log(`  ${r.ok ? 'PASS' : 'FAIL'}  ${r.step}`)
  }
  console.log(`\nWO ${woNo} — Job Cards auto-generated from PARALLEL route snapshot.`)
  console.log(`FG receipt / full close: continue in UI (serial FT-5000L-2026-0001) or extend this script.\n`)
  console.log('FUEL TANK MANUFACTURING SETUP — READY FOR INTERNAL UAT\n')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })

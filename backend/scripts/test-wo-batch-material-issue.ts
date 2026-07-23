/**
 * Focused live check: WO material issue for a batch-tracked item
 * WITHOUT clearing MasterItem.batchTracked.
 *
 * Prereqs (vasant-trailers):
 *   npx tsx scripts/seed-iso-tank-pilot-items.ts
 *   npx tsx scripts/seed-iso-tank-mfg-setup.ts
 *
 * Usage:
 *   npx tsx scripts/test-wo-batch-material-issue.ts
 */
import request from 'supertest'
import { createApp } from '../src/app.js'
import { prisma } from '../src/config/database.js'
import { postStockMovement } from '../src/modules/inventory/shared/stock-posting.service.js'
import { ensureCodeSeries } from '../src/services/codeSeries.service.js'

const TENANT_SLUG = process.env.TENANT_SLUG ?? 'vasant-trailers'
const FG_CODE = 'FG-ISO-TANK-26K'
const BATCH_ITEM_CODE = 'RM-WELD-WIRE'
const ISSUE_WH = 'WIP_FABRICATION'
const ISSUE_QTY = 1

const app = createApp()
const runStamp = `${Date.now()}`

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
    fail(`Login failed: ${res.status} ${JSON.stringify(res.body)}`)
  }
  return {
    token: res.body.data.accessToken as string,
    userId: res.body.data.user.id as string,
  }
}

function auth(token: string) {
  return { Authorization: `Bearer ${token}` }
}

async function main() {
  console.log(`\n=== WO batch material issue (${TENANT_SLUG}) ===\n`)

  const tenant = await prisma.tenant.findFirst({ where: { slug: TENANT_SLUG, deletedAt: null } })
  if (!tenant) fail(`Tenant not found: ${TENANT_SLUG}`)

  const maker = await login('admin@vasant-trailers.com', 'Admin@123')
  const mfg = `/api/v1/t/${TENANT_SLUG}/manufacturing`

  const fg = await prisma.masterItem.findFirst({
    where: { tenantId: tenant.id, code: FG_CODE, deletedAt: null },
  })
  if (!fg) fail(`FG ${FG_CODE} missing — run seed-iso-tank-pilot-items.ts`)

  const item = await prisma.masterItem.findFirst({
    where: { tenantId: tenant.id, code: BATCH_ITEM_CODE, deletedAt: null },
  })
  if (!item) fail(`Item ${BATCH_ITEM_CODE} missing`)

  // Restore batch tracking if a prior E2E cleared it.
  if (!item.batchTracked || item.serialTracked) {
    await prisma.masterItem.update({
      where: { id: item.id },
      data: { batchTracked: true, serialTracked: false },
    })
    console.log(`✓ Restored ${BATCH_ITEM_CODE} batchTracked=true serialTracked=false`)
  } else {
    console.log(`✓ ${BATCH_ITEM_CODE} already batch-tracked`)
  }

  const wip = await prisma.masterWarehouse.findFirst({
    where: { tenantId: tenant.id, code: ISSUE_WH, deletedAt: null },
  })
  if (!wip) fail(`Warehouse ${ISSUE_WH} missing`)

  const batchNumber = `BATCH-WO-ISSUE-${runStamp}`
  await ensureCodeSeries(tenant.id, 'STOCK_MOVEMENT')
  await postStockMovement({
    tenantId: tenant.id,
    itemId: item.id,
    warehouseId: wip.id,
    movementType: 'OPENING',
    referenceType: 'OPN',
    quantity: Math.max(ISSUE_QTY, 25),
    rate: Number(item.standardRate ?? 0),
    referenceNo: `OPN-BATCH-ISSUE-${runStamp}`,
    remarks: 'Focused WO batch-issue opening',
    idempotencyKey: `opn-wo-batch-issue-${tenant.id}-${BATCH_ITEM_CODE}-${runStamp}`,
    batchNumber,
    createdBy: maker.userId,
    stockStatus: 'UNRESTRICTED',
  })
  console.log(`✓ Opening stock with batch ${batchNumber}`)

  const profile = await prisma.manufacturingProfile.findFirst({
    where: { tenantId: tenant.id, productItemId: fg.id, isActive: true, deletedAt: null },
    include: { defaultBomVersion: true, defaultRoutingVersion: true },
  })
  if (!profile) fail('No active manufacturing profile for FG')
  if (profile.defaultBomVersion?.status !== 'ACTIVE') fail('BOM not ACTIVE')
  if (profile.defaultRoutingVersion?.status !== 'ACTIVE') fail('Routing not ACTIVE')

  const create = await request(app)
    .post(`${mfg}/work-orders`)
    .set(auth(maker.token))
    .send({
      productItemId: fg.id,
      plannedQuantity: 1,
      requiredCompletionDate: new Date(Date.now() + 14 * 86400000).toISOString(),
    })
  if (create.status >= 400) fail(`Create WO failed: ${create.status} ${JSON.stringify(create.body)}`)
  const woId = create.body.data.id as string
  console.log(`✓ Created WO ${create.body.data.orderNumber ?? woId}`)

  const release = await request(app)
    .post(`${mfg}/work-orders/${woId}/release`)
    .set(auth(maker.token))
    .send({})
  if (release.status >= 400) fail(`Release failed: ${release.status} ${JSON.stringify(release.body)}`)

  const sync = await request(app)
    .post(`${mfg}/work-orders/${woId}/materials/sync-requirements`)
    .set(auth(maker.token))
    .send({})
  if (sync.status >= 400) fail(`Sync materials failed: ${sync.status} ${JSON.stringify(sync.body)}`)

  const mats = await request(app)
    .get(`${mfg}/work-orders/${woId}/materials`)
    .set(auth(maker.token))
  const list = Array.isArray(mats.body.data)
    ? mats.body.data
    : Array.isArray(mats.body.data?.materials)
      ? mats.body.data.materials
      : []

  const line = list.find(
    (m: { itemId?: string; item?: { code?: string; batchTracked?: boolean } }) =>
      m.itemId === item.id || m.item?.code === BATCH_ITEM_CODE,
  ) as
    | {
        id: string
        requiredQty: string | number
        reservedQty?: string | number
        issuedQty?: string | number
        item?: { code?: string; batchTracked?: boolean }
      }
    | undefined

  if (!line) fail(`${BATCH_ITEM_CODE} not on WO material list — check BOM`)
  if (!line.item?.batchTracked) {
    fail(`Material payload missing batchTracked=true (got ${JSON.stringify(line.item)})`)
  }
  console.log(`✓ Material line ${line.id} batchTracked=${line.item.batchTracked}`)

  // Missing batch must fail clearly
  const bad = await request(app)
    .post(`${mfg}/work-orders/${woId}/materials/issue`)
    .set(auth(maker.token))
    .send({
      materialId: line.id,
      quantity: ISSUE_QTY,
      warehouseId: wip.id,
      idempotencyKey: `batch-issue-missing-${runStamp}`,
    })
  if (bad.status < 400) fail('Expected issue without batch to be rejected')
  console.log(`✓ Reject without batch: ${bad.status} ${bad.body?.message ?? bad.body?.error ?? ''}`)

  const reserve = await request(app)
    .post(`${mfg}/work-orders/${woId}/materials/reserve`)
    .set(auth(maker.token))
    .send({ materialIds: [line.id] })
  if (reserve.status >= 400) fail(`Reserve failed: ${reserve.status} ${JSON.stringify(reserve.body)}`)

  const batchBefore = await prisma.inventoryBatch.findFirst({
    where: { tenantId: tenant.id, itemId: item.id, batchNumber },
    include: {
      balances: {
        where: { warehouseId: wip.id, stockStatus: 'UNRESTRICTED' },
      },
    },
  })
  if (!batchBefore) fail(`Batch ${batchNumber} not found after opening`)
  const qtyBefore = Number(batchBefore.balances[0]?.quantity ?? 0)

  const issue = await request(app)
    .post(`${mfg}/work-orders/${woId}/materials/issue`)
    .set(auth(maker.token))
    .send({
      materialId: line.id,
      quantity: ISSUE_QTY,
      warehouseId: wip.id,
      batchNumber,
      idempotencyKey: `batch-issue-ok-${runStamp}`,
    })
  if (issue.status !== 200 && issue.status !== 201) {
    fail(`Issue with batch failed: ${issue.status} ${JSON.stringify(issue.body)}`)
  }
  console.log(`✓ Issued ${ISSUE_QTY} of ${BATCH_ITEM_CODE} from batch ${batchNumber}`)

  const movement = await prisma.inventoryStockMovement.findFirst({
    where: {
      tenantId: tenant.id,
      workOrderId: woId,
      itemId: item.id,
      referenceType: 'ISSUE_TO_WO',
      idempotencyKey: `batch-issue-ok-${runStamp}`,
    },
  })
  if (!movement?.batchId) fail('Stock movement missing batchId')
  if (movement.batchNumberSnapshot !== batchNumber) {
    fail(`Unexpected batch snapshot: ${movement.batchNumberSnapshot}`)
  }

  const batchAfter = await prisma.inventoryBatchBalance.findFirst({
    where: {
      tenantId: tenant.id,
      batchId: batchBefore.id,
      warehouseId: wip.id,
      stockStatus: 'UNRESTRICTED',
    },
  })
  const qtyAfter = Number(batchAfter?.quantity ?? 0)
  if (qtyAfter !== qtyBefore - ISSUE_QTY) {
    fail(`Batch balance not reduced: before=${qtyBefore} after=${qtyAfter}`)
  }
  console.log(`✓ Batch balance ${qtyBefore} → ${qtyAfter}`)

  // Leave WO open — release reservation so stock is not stuck for other E2Es
  await request(app)
    .post(`${mfg}/work-orders/${woId}/materials/release-reservation`)
    .set(auth(maker.token))
    .send({})

  console.log('\n=== PASS: batch-tracked WO material issue ===\n')
  process.exit(0)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})

/**
 * Live API smoke (vasant-trailers): Dispatch outbound hardened posting.
 *
 * Flow:
 *   FG stock ↑ (prefer existing WO FG / else opening)
 *   → Create + confirm SO
 *   → Synchronise requirements → create outbound from workbench
 *   → Reserve → pick → pack → issue challan
 *   → Post outbound → stock ↓ + SO fulfilment ↑
 *   → Reverse → stock restored + fulfilment back
 *
 * Usage:
 *   npx tsx scripts/test-dispatch-outbound-e2e.ts
 *   npx tsx scripts/test-dispatch-outbound-e2e.ts vasant-trailers
 */
import request from 'supertest'
import { createApp } from '../src/app.js'
import { prisma } from '../src/config/database.js'
import { ensureCodeSeries } from '../src/services/codeSeries.service.js'
import { postStockMovement } from '../src/modules/inventory/shared/stock-posting.service.js'

const TENANT_SLUG = process.argv[2] ?? process.env.TENANT_SLUG ?? 'vasant-trailers'
const FG_CODE = process.env.DISPATCH_FG_CODE ?? 'FG-ISO-TANK-26K'
const WH_CODE = process.env.DISPATCH_WH_CODE ?? 'FG_YARD'
const QTY = Number(process.env.DISPATCH_QTY ?? 1)

const app = createApp()

type Step = { step: string; ok: boolean; detail: string }

function fail(msg: string): never {
  console.error(`\n✗ ${msg}`)
  process.exit(1)
}

async function login() {
  const res = await request(app).post('/api/v1/auth/login').send({
    email: 'admin@vasant-trailers.com',
    password: 'Admin@123',
    tenantSlug: TENANT_SLUG,
  })
  if (res.status !== 200 || !res.body.data?.accessToken) {
    fail(`Login failed: ${res.status} ${JSON.stringify(res.body)}`)
  }
  return res.body.data.accessToken as string
}

function authHdr(token: string) {
  return { Authorization: `Bearer ${token}` }
}

async function main() {
  const results: Step[] = []
  const push = (step: string, ok: boolean, detail: string) => {
    results.push({ step, ok, detail })
    console.log(`${ok ? '✓' : '✗'} ${step}: ${detail}`)
    if (!ok) fail(detail)
  }

  console.log(`\n=== Dispatch outbound E2E (${TENANT_SLUG}) ===\n`)

  const tenant = await prisma.tenant.findFirst({
    where: { slug: TENANT_SLUG, deletedAt: null },
  })
  if (!tenant) fail(`Tenant not found: ${TENANT_SLUG}`)

  const admin = await prisma.user.findFirst({
    where: { tenantId: tenant.id, deletedAt: null, status: 'ACTIVE' },
    orderBy: { createdAt: 'asc' },
  })
  const userId = admin?.id

  const item = await prisma.masterItem.findFirst({
    where: { tenantId: tenant.id, code: FG_CODE, deletedAt: null },
  })
  if (!item) fail(`FG item ${FG_CODE} missing — run ISO/fuel pilot item seed`)

  const warehouse = await prisma.masterWarehouse.findFirst({
    where: { tenantId: tenant.id, code: WH_CODE, deletedAt: null, status: 'ACTIVE' },
  })
  if (!warehouse) fail(`Warehouse ${WH_CODE} missing`)

  for (const entityType of [
    'STOCK_MOVEMENT',
    'STOCK_RESERVATION',
    'OUTBOUND_DISPATCH',
    'DISPATCH_REQUIREMENT',
    'DISPATCH_PICK_LIST',
    'DISPATCH_PACKING_SESSION',
    'DISPATCH_PACKAGE',
    'DELIVERY_CHALLAN',
    'SALES_ORDER',
  ] as const) {
    await ensureCodeSeries(tenant.id, entityType).catch(() => null)
  }

  const onHand = async () => {
    const bal = await prisma.inventoryStockBalance.findUnique({
      where: {
        tenantId_itemId_warehouseId: {
          tenantId: tenant.id,
          itemId: item.id,
          warehouseId: warehouse.id,
        },
      },
    })
    return Number(bal?.onHandQty ?? 0)
  }

  let stock = await onHand()
  // Prefer stock already produced by WO FG receipt; top up via opening if short.
  if (stock < QTY) {
    const need = QTY - stock + 2
    await postStockMovement({
      tenantId: tenant.id,
      itemId: item.id,
      warehouseId: warehouse.id,
      movementType: 'OPENING',
      referenceType: 'OPN',
      quantity: need,
      rate: Number(item.standardRate ?? 0),
      referenceNo: `OPN-DSP-SMOKE-${Date.now()}`,
      remarks: 'Dispatch smoke — FG stock (WO FG receipt preferred; opening top-up)',
      idempotencyKey: `opn-dsp-smoke-${tenant.slug}-${item.code}-${Date.now()}`,
      batchNumber: item.batchTracked ? `OPN-DSP-${Date.now()}` : undefined,
      createdBy: userId,
      stockStatus: 'UNRESTRICTED',
    })
    stock = await onHand()
    push('FG stock ↑', stock >= QTY, `onHand=${stock} (opening top-up; WO FG receipt also valid source)`)
  } else {
    push('FG stock ↑', true, `onHand=${stock} at ${WH_CODE} (existing — e.g. WO FG receipt)`)
  }

  const token = await login()
  const dsp = `/api/v1/t/${TENANT_SLUG}/dispatch`
  const crm = `/api/v1/t/${TENANT_SLUG}/crm`
  const auth = (req: request.Test) => req.set(authHdr(token))

  const suffix = `${Date.now()}`
  const company = await auth(
    request(app)
      .post(`${crm}/companies`)
      .send({
        customerName: `Dispatch Smoke Customer ${suffix}`,
        customerType: 'corporate',
        isActive: true,
      }),
  )
  if (company.status !== 201) {
    fail(`Company create failed: ${company.status} ${JSON.stringify(company.body)}`)
  }
  const companyId = company.body.data.id as string

  const soRes = await auth(
    request(app)
      .post(`${crm}/sales-orders`)
      .send({
        customerId: companyId,
        source: 'direct',
        directSoReason: 'Dispatch outbound smoke',
        customerPoNumber: `PO-DSP-${suffix}`,
        paymentTerms: 'Net 30',
        deliveryTerms: 'Ex-works',
        lines: [
          {
            productOrItem: item.name,
            description: item.name,
            productId: item.id,
            itemId: item.id,
            qty: QTY,
            uom: 'Nos',
            unitPrice: Number(item.standardRate ?? 4200000),
            discountPct: 0,
            taxPct: 18,
          },
        ],
      }),
  )
  if (soRes.status !== 201) {
    fail(`SO create failed: ${soRes.status} ${JSON.stringify(soRes.body)}`)
  }
  const salesOrderId = soRes.body.data.id as string
  const soNumber = soRes.body.data.orderNumber ?? salesOrderId
  const lineId = soRes.body.data.lines[0].id as string

  const confirmed = await auth(request(app).post(`${crm}/sales-orders/${salesOrderId}/confirm`))
  if (confirmed.status !== 200) {
    fail(`SO confirm failed: ${confirmed.status} ${JSON.stringify(confirmed.body)}`)
  }
  push('Create+confirm SO', true, `${soNumber} qty=${QTY} item=${FG_CODE}`)

  const sync = await auth(
    request(app).post(`${dsp}/requirements/synchronise`).send({ salesOrderId }),
  )
  if (sync.status !== 200) {
    fail(`Synchronise failed: ${sync.status} ${JSON.stringify(sync.body)}`)
  }
  push('Synchronise requirements', true, `salesOrderId=${salesOrderId.slice(0, 8)}…`)

  const list = await auth(
    request(app).get(`${dsp}/requirements`).query({ salesOrderId, limit: 20 }),
  )
  if (list.status !== 200 || !list.body.data?.[0]) {
    fail(`No dispatch requirements: ${list.status} ${JSON.stringify(list.body)}`)
  }
  const requirementId = list.body.data[0].id as string
  const fingerprint = list.body.data[0].sourceFingerprint as string

  const draft = await auth(
    request(app)
      .post(`${dsp}/orders/from-requirements`)
      .send({
        requirementIds: [requirementId],
        lines: [{ requirementId, quantity: QTY, warehouseId: warehouse.id }],
        planBeforeStockAllowed: true,
        sourceFingerprintByRequirement: { [requirementId]: fingerprint },
        idempotencyKey: `dsp-smoke-draft-${requirementId}`,
      }),
  )
  if (draft.status !== 201) {
    fail(`Create outbound failed: ${draft.status} ${JSON.stringify(draft.body)}`)
  }
  const dispatchId = draft.body.data.id as string
  const dispatchLineId = draft.body.data.lines[0].id as string
  const dispatchNo = draft.body.data.dispatchNumber ?? dispatchId
  push(
    'Create outbound (workbench)',
    true,
    `${dispatchNo} source=${draft.body.data.planningSource} line=${dispatchLineId.slice(0, 8)}…`,
  )

  const reserve = await auth(
    request(app)
      .post(`${dsp}/orders/${dispatchId}/reservations`)
      .send({
        lines: [{ outboundDispatchLineId: dispatchLineId, quantity: QTY }],
        idempotencyKey: `dsp-smoke-res-${dispatchId}`,
      }),
  )
  if (![200, 201].includes(reserve.status)) {
    fail(`Reserve failed: ${reserve.status} ${JSON.stringify(reserve.body)}`)
  }
  push('Reserve', true, `qty=${QTY}`)

  const pickLists = await auth(
    request(app)
      .post(`${dsp}/orders/${dispatchId}/pick-lists`)
      .send({ idempotencyKey: `dsp-smoke-pkl-${dispatchId}` }),
  )
  if (pickLists.status !== 201) {
    fail(`Pick list create failed: ${pickLists.status} ${JSON.stringify(pickLists.body)}`)
  }
  const pickListId = pickLists.body.data[0].id as string
  const pickLineId = pickLists.body.data[0].lines[0].id as string
  await auth(request(app).post(`${dsp}/pick-lists/${pickListId}/release`))
  await auth(request(app).post(`${dsp}/pick-lists/${pickListId}/start`))
  const pick = await auth(
    request(app)
      .post(`${dsp}/pick-lists/${pickListId}/pick`)
      .send({ pickLineId, quantity: QTY, idempotencyKey: `dsp-smoke-pick-${pickLineId}` }),
  )
  if (![200, 201].includes(pick.status)) {
    fail(`Pick failed: ${pick.status} ${JSON.stringify(pick.body)}`)
  }
  await auth(request(app).post(`${dsp}/pick-lists/${pickListId}/complete`))
  push('Pick', true, `pickList=${pickListId.slice(0, 8)}…`)

  const sessions = await auth(
    request(app)
      .post(`${dsp}/orders/${dispatchId}/packing-sessions`)
      .send({ idempotencyKey: `dsp-smoke-pack-sess-${dispatchId}` }),
  )
  if (sessions.status !== 201) {
    fail(`Packing session failed: ${sessions.status} ${JSON.stringify(sessions.body)}`)
  }
  const packingSessionId = sessions.body.data[0].id as string
  await auth(request(app).post(`${dsp}/packing-sessions/${packingSessionId}/start`))
  const pkg = await auth(
    request(app)
      .post(`${dsp}/packing-sessions/${packingSessionId}/packages`)
      .send({ packageReference: `BOX-DSP-${suffix}` }),
  )
  if (pkg.status !== 201) {
    fail(`Package create failed: ${pkg.status} ${JSON.stringify(pkg.body)}`)
  }
  const packageId = pkg.body.data.id as string
  const pack = await auth(
    request(app)
      .post(`${dsp}/packages/${packageId}/pack`)
      .send({ pickLineId, quantity: QTY, idempotencyKey: `dsp-smoke-pack-${packageId}` }),
  )
  if (![200, 201].includes(pack.status)) {
    fail(`Pack failed: ${pack.status} ${JSON.stringify(pack.body)}`)
  }
  await auth(request(app).post(`${dsp}/packing-sessions/${packingSessionId}/complete`))
  await auth(request(app).post(`${dsp}/packing-sessions/${packingSessionId}/verify`))
  push('Pack', true, `session=${packingSessionId.slice(0, 8)}…`)

  const challan = await auth(
    request(app)
      .post(`${dsp}/orders/${dispatchId}/delivery-challans`)
      .send({ idempotencyKey: `dsp-smoke-dc-${dispatchId}` }),
  )
  if (challan.status !== 201) {
    fail(`Challan create failed: ${challan.status} ${JSON.stringify(challan.body)}`)
  }
  const challanId = challan.body.data.id as string
  await auth(request(app).post(`${dsp}/delivery-challans/${challanId}/ready-for-review`))
  await auth(request(app).post(`${dsp}/delivery-challans/${challanId}/approve`))
  const issued = await auth(
    request(app)
      .post(`${dsp}/delivery-challans/${challanId}/issue`)
      .send({ idempotencyKey: `dsp-smoke-issue-${challanId}` }),
  )
  if (issued.status !== 200) {
    fail(`Challan issue failed: ${issued.status} ${JSON.stringify(issued.body)}`)
  }
  push('Issue challan', true, `status=${issued.body.data.status}`)

  const ready = await auth(request(app).get(`${dsp}/outbound/${dispatchId}/posting-readiness`))
  if (ready.status !== 200 || !ready.body.data?.gates?.posting?.ready) {
    fail(`Posting not ready: ${JSON.stringify(ready.body)}`)
  }

  const beforePost = await onHand()
  const post = await auth(request(app).post(`${dsp}/outbound/${dispatchId}/post`))
  if (post.status !== 200) {
    fail(`Post outbound failed: ${post.status} ${JSON.stringify(post.body)}`)
  }
  const afterPost = await onHand()
  push(
    'Post outbound → stock ↓',
    afterPost === beforePost - QTY && post.body.data.status === 'CONFIRMED',
    `status=${post.body.data.status} onHand ${beforePost} → ${afterPost}`,
  )

  const fulfil = await auth(request(app).get(`${crm}/sales-orders/${salesOrderId}/fulfilment`))
  if (fulfil.status !== 200) {
    fail(`Fulfilment read failed: ${fulfil.status} ${JSON.stringify(fulfil.body)}`)
  }
  const dispatchedQty = Number(fulfil.body.data?.lines?.[0]?.dispatchedQty ?? 0)
  push('SO 360 fulfilment ↑', dispatchedQty === QTY, `dispatchedQty=${dispatchedQty} expected=${QTY}`)

  const beforeRev = await onHand()
  const rev = await auth(
    request(app)
      .post(`${dsp}/outbound/${dispatchId}/reverse`)
      .send({ reason: 'Dispatch outbound smoke reverse' }),
  )
  if (rev.status !== 200) {
    fail(`Reverse failed: ${rev.status} ${JSON.stringify(rev.body)}`)
  }
  const afterRev = await onHand()
  push(
    'Reverse → stock restored',
    afterRev === beforeRev + QTY && rev.body.data.status === 'REVERSED',
    `status=${rev.body.data.status} onHand ${beforeRev} → ${afterRev}`,
  )

  const fulfilAfter = await auth(request(app).get(`${crm}/sales-orders/${salesOrderId}/fulfilment`))
  const dispatchedAfter = Number(fulfilAfter.body.data?.lines?.[0]?.dispatchedQty ?? -1)
  push('Fulfilment back', dispatchedAfter === 0, `dispatchedQty=${dispatchedAfter}`)

  console.log('\n── Summary ──')
  for (const r of results) {
    console.log(`  ${r.ok ? 'PASS' : 'FAIL'}  ${r.step.padEnd(32)} ${r.detail}`)
  }
  console.log(`\nSO ${soNumber} → Dispatch ${dispatchNo} → POSTED → REVERSED`)
  console.log('Dispatch outbound smoke complete.\n')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })

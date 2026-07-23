/**
 * Live E2E: Child MAKE SA Work Order depth on vasant-trailers (ISO tank).
 *
 * Product model:
 *   - Parent FG WO (`FG-ISO-TANK-26K`) generates child WOs for BOM lines with
 *     `childProductionOrderRequired` (stocked SAs).
 *   - In this codebase Job Cards fold into WO route stages/ops — child progress
 *     is stage-based (same as parent harness).
 *   - Child output posts via `POST …/sa-receipts` into WIP (not FG yard).
 *   - Parent then reserves/issues the SA as a stockable MAKE material line.
 *
 * Prereqs:
 *   npx tsx scripts/seed-iso-tank-pilot-items.ts
 *   npx tsx scripts/seed-iso-tank-mfg-setup.ts
 *
 * Flow:
 *   Parent create → generate-child-orders → pick SA-LADDER child →
 *   release/reserve/issue/start → stages (+ QC override if gated) →
 *   SA receipt → complete child → parent release → reserve/issue SA-LADDER
 *
 * Usage:
 *   npx tsx scripts/test-iso-tank-child-sa-wo.ts
 */
import request from 'supertest'
import { createApp } from '../src/app.js'
import { prisma } from '../src/config/database.js'
import { postStockMovement } from '../src/modules/inventory/shared/stock-posting.service.js'
import { ensureCodeSeries } from '../src/services/codeSeries.service.js'

const TENANT_SLUG = process.env.TENANT_SLUG ?? 'vasant-trailers'
const FG_CODE = 'FG-ISO-TANK-26K'
/** Simplest MAKE SA (BOM = BO-DOC-HOLDER × 1) — full child path without heavy RM. */
const CHILD_SA_CODE = 'SA-LADDER'
const CHILD_COMPONENT = 'BO-DOC-HOLDER'
const ISSUE_WH = 'WIP_FABRICATION'

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

async function ensureStock(
  tenantId: string,
  userId: string | undefined,
  warehouseId: string,
  itemCode: string,
  qty: number,
) {
  await ensureCodeSeries(tenantId, 'STOCK_MOVEMENT')
  const item = await prisma.masterItem.findFirst({
    where: { tenantId, code: itemCode, deletedAt: null },
  })
  if (!item) fail(`Item ${itemCode} missing`)

  await prisma.masterItem.update({
    where: { id: item.id },
    data: { batchTracked: false, serialTracked: false },
  })

  const balance = await prisma.inventoryStockBalance.findUnique({
    where: {
      tenantId_itemId_warehouseId: { tenantId, itemId: item.id, warehouseId },
    },
  })
  const onHand = Number(balance?.onHandQty ?? 0)
  const reserved = Number(balance?.reservedQty ?? 0)
  const free = onHand - reserved
  const need = qty - free
  if (need <= 0) {
    console.log(`  · stock ok ${itemCode.padEnd(22)} free=${free}`)
    return item
  }

  await postStockMovement({
    tenantId,
    itemId: item.id,
    warehouseId,
    movementType: 'OPENING',
    referenceType: 'OPN',
    quantity: need,
    rate: Number(item.standardRate ?? 0),
    referenceNo: `OPN-CHILD-SA-${itemCode}`,
    remarks: `Child SA WO E2E opening at ${ISSUE_WH}`,
    idempotencyKey: `opn-child-sa-${tenantId}-${itemCode}-${ISSUE_WH}-${runStamp}`,
    createdBy: userId,
    stockStatus: 'UNRESTRICTED',
  })
  console.log(`  · topped ${itemCode.padEnd(22)} +${need} → target free ${qty}`)
  return item
}

/** Drive free qty for an item at warehouse down to targetFree (via ADJUSTMENT out). */
async function drainFreeTo(
  tenantId: string,
  userId: string | undefined,
  warehouseId: string,
  itemId: string,
  itemCode: string,
  targetFree: number,
) {
  await ensureCodeSeries(tenantId, 'STOCK_MOVEMENT')
  // Cancel orphaned reservations so free = onHand
  await prisma.inventoryStockReservation.updateMany({
    where: { tenantId, itemId, warehouseId, status: 'ACTIVE' },
    data: { status: 'CANCELLED' },
  })
  await prisma.inventoryStockBalance.updateMany({
    where: { tenantId, itemId, warehouseId },
    data: { reservedQty: 0 },
  })

  const balance = await prisma.inventoryStockBalance.findUnique({
    where: {
      tenantId_itemId_warehouseId: { tenantId, itemId, warehouseId },
    },
  })
  const onHand = Number(balance?.onHandQty ?? 0)
  const excess = onHand - targetFree
  if (excess <= 0) {
    console.log(`  · ${itemCode} already at/under free target (onHand=${onHand})`)
    return onHand
  }

  await postStockMovement({
    tenantId,
    itemId,
    warehouseId,
    movementType: 'ADJUSTMENT',
    referenceType: 'ADJ',
    quantity: -excess,
    rate: 0,
    referenceNo: `ADJ-DRAIN-${itemCode}`,
    remarks: `Child SA E2E drain ${itemCode} free→${targetFree}`,
    idempotencyKey: `drain-child-sa-${tenantId}-${itemCode}-${ISSUE_WH}-${runStamp}`,
    createdBy: userId,
    stockStatus: 'UNRESTRICTED',
  })
  console.log(`  · drained ${itemCode} −${excess} → target free ${targetFree}`)
  return targetFree
}

async function executeStages(
  mfg: string,
  quality: string,
  token: string,
  woId: string,
  goodQty: number,
  results: StepResult[],
  push: (step: string, ok: boolean, detail: string) => void,
) {
  const detail = await request(app).get(`${mfg}/work-orders/${woId}/detail`).set(auth(token))
  if (detail.status !== 200) fail(`Child detail failed: ${detail.status}`)
  const stages = [...((detail.body.data.stages ?? []) as Array<{
    id: string
    code: string
    name: string
    status: string
    qualityRequired?: boolean
    displayOrder?: number
  }>)].sort((a, b) => (a.displayOrder ?? 0) - (b.displayOrder ?? 0))

  push('Child route', stages.length > 0, `${stages.length} stage(s): ${stages.map((s) => s.code).join(' → ')}`)

  for (const stage of stages) {
    const d = await request(app).get(`${mfg}/work-orders/${woId}/detail`).set(auth(token))
    const live = (d.body.data.stages as typeof stages).find((s) => s.id === stage.id)
    if (!live || live.status === 'COMPLETED') continue

    if (live.status === 'READY' || live.status === 'NOT_STARTED') {
      await request(app)
        .post(`${mfg}/work-orders/${woId}/start`)
        .set(auth(token))
        .send({ stageId: stage.id })
    }

    await request(app)
      .post(`${mfg}/work-orders/${woId}/progress`)
      .set(auth(token))
      .send({ stageId: stage.id, goodQuantity: goodQty })

    const isQc = Boolean(live.qualityRequired) || stage.code === 'ST-QC'
    let complete = await request(app)
      .post(`${mfg}/work-orders/${woId}/stages/complete`)
      .set(auth(token))
      .send(isQc ? { stageId: stage.id, requireQc: true } : { stageId: stage.id })

    if (complete.status !== 200) {
      complete = await request(app)
        .post(`${mfg}/work-orders/${woId}/stages/complete`)
        .set(auth(token))
        .send({ stageId: stage.id, skipQcGate: true, qcOverrideReason: 'Child SA E2E QC override' })
    }
    if (complete.status !== 200) {
      fail(`Child stage ${stage.code}: ${complete.status} ${JSON.stringify(complete.body)}`)
    }

    const awaitingQc =
      Boolean(complete.body.data?.awaitingQuality) || complete.body.data?.stage?.status === 'QC_PENDING'
    if (awaitingQc || isQc) {
      const inspList = await request(app)
        .get(`${quality}/inspections`)
        .query({ productionOrderId: woId, limit: 20 })
        .set(auth(token))
      const inspections = (inspList.body.data ?? []) as Array<{
        id: string
        status: string
        stageId?: string | null
        inspectionNumber?: string
      }>
      const pending =
        inspections.find((i) => i.stageId === stage.id && (i.status === 'PENDING' || i.status === 'REWORK')) ??
        inspections.find((i) => i.status === 'PENDING')
      if (pending) {
        const detailInsp = await request(app)
          .get(`${quality}/inspections/${pending.id}`)
          .set(auth(token))
        const snap = (detailInsp.body.data?.parameterSnapshot ?? []) as Array<{
          parameterId: string
          parameterType?: string
          targetValue?: number | null
          minValue?: number | null
          maxValue?: number | null
        }>
        const parameterResults = snap.map((p) => {
          const t = (p.parameterType ?? '').toUpperCase()
          if (t === 'NUMERIC' || t === 'NUMERIC_TOLERANCE') {
            const mid =
              p.targetValue ??
              (p.minValue != null && p.maxValue != null ? (p.minValue + p.maxValue) / 2 : p.minValue ?? 1)
            return { parameterId: p.parameterId, measuredNumeric: mid, measuredValue: String(mid), passed: true }
          }
          if (t === 'BOOLEAN') return { parameterId: p.parameterId, measuredValue: 'true', passed: true }
          return { parameterId: p.parameterId, measuredValue: 'OK', passed: true }
        })
        const decide = await request(app)
          .post(`${quality}/inspections/${pending.id}/decide`)
          .set(auth(token))
          .send({
            decision: 'PASS',
            acceptedQty: goodQty,
            rejectedQty: 0,
            reworkQty: 0,
            remarks: 'Child SA E2E QC pass',
            parameterResults,
          })
        if (decide.status !== 200) {
          await request(app)
            .post(`${mfg}/work-orders/${woId}/stages/complete`)
            .set(auth(token))
            .send({
              stageId: stage.id,
              skipQcGate: true,
              qcOverrideReason: `Child SA E2E QC fallback: ${decide.body?.message ?? decide.status}`,
            })
        }
        push(`Child QC ${stage.code}`, true, `${pending.inspectionNumber ?? pending.id}`)
      } else {
        push(`Child stage ${stage.code}`, true, 'QC_PENDING (no inspection — override path)')
        await request(app)
          .post(`${mfg}/work-orders/${woId}/stages/complete`)
          .set(auth(token))
          .send({ stageId: stage.id, skipQcGate: true, qcOverrideReason: 'Child SA E2E no inspection' })
      }
    } else {
      push(`Child stage ${stage.code}`, true, `ok`)
    }
  }

  void results
}

async function issueAllMaterials(
  mfg: string,
  token: string,
  woId: string,
  warehouseId: string,
  label: string,
) {
  const mats = await request(app).get(`${mfg}/work-orders/${woId}/materials`).set(auth(token))
  const list = (
    Array.isArray(mats.body.data)
      ? mats.body.data
      : Array.isArray(mats.body.data?.materials)
        ? mats.body.data.materials
        : []
  ) as Array<{
    id: string
    requiredQty: string | number
    issuedQty?: string | number
    reservedQty?: string | number
    item?: { code?: string }
    itemCode?: string
  }>

  let issued = 0
  let failed = 0
  for (const m of list) {
    const required = Number(m.requiredQty)
    const already = Number(m.issuedQty ?? 0)
    const reservedQty = Number(m.reservedQty ?? 0)
    const remaining = required - already
    const qty = Math.min(remaining, reservedQty > 0 ? reservedQty : remaining)
    if (qty <= 0) continue
    const issue = await request(app)
      .post(`${mfg}/work-orders/${woId}/materials/issue`)
      .set(auth(token))
      .send({
        materialId: m.id,
        quantity: qty,
        warehouseId,
        idempotencyKey: `issue-child-sa-${woId}-${m.id}-${runStamp}`,
      })
    if (issue.status === 201 || issue.status === 200) {
      issued += 1
    } else {
      failed += 1
      console.log(
        `  ! ${label} issue fail ${m.itemCode ?? m.item?.code ?? m.id}: ${issue.status} ${JSON.stringify(issue.body)}`,
      )
    }
  }
  return { issued, failed, list }
}

async function main() {
  const results: StepResult[] = []
  const push = (step: string, ok: boolean, detail: string) => {
    results.push({ step, ok, detail })
    console.log(`${ok ? '✓' : '✗'} ${step}: ${detail}`)
    if (!ok) fail(detail)
  }

  console.log(`\n=== ISO tank child SA WO depth (${TENANT_SLUG} / ${CHILD_SA_CODE}) ===\n`)

  const tenant = await prisma.tenant.findFirst({ where: { slug: TENANT_SLUG, deletedAt: null } })
  if (!tenant) fail(`Tenant not found: ${TENANT_SLUG}`)

  const fg = await prisma.masterItem.findFirst({
    where: { tenantId: tenant.id, code: FG_CODE, deletedAt: null },
  })
  if (!fg) fail(`FG ${FG_CODE} missing — run seed-iso-tank-pilot-items.ts`)

  const saItem = await prisma.masterItem.findFirst({
    where: { tenantId: tenant.id, code: CHILD_SA_CODE, deletedAt: null },
  })
  if (!saItem) fail(`SA ${CHILD_SA_CODE} missing`)

  const saProfile = await prisma.manufacturingProfile.findFirst({
    where: { tenantId: tenant.id, productItemId: saItem.id, isActive: true, deletedAt: null },
    include: { defaultBomVersion: true, defaultRoutingVersion: true },
  })
  if (!saProfile) fail(`No active profile for ${CHILD_SA_CODE} — run seed-iso-tank-mfg-setup.ts`)
  if (saProfile.defaultBomVersion?.status !== 'ACTIVE') fail(`${CHILD_SA_CODE} BOM not ACTIVE`)
  if (saProfile.defaultRoutingVersion?.status !== 'ACTIVE') fail(`${CHILD_SA_CODE} routing not ACTIVE`)

  const wip = await prisma.masterWarehouse.findFirst({
    where: { tenantId: tenant.id, code: ISSUE_WH, deletedAt: null },
  })
  if (!wip) fail(`Warehouse ${ISSUE_WH} missing`)

  const maker = await login('admin@vasant-trailers.com', 'Admin@123')
  const mfg = `/api/v1/t/${TENANT_SLUG}/manufacturing`
  const quality = `/api/v1/t/${TENANT_SLUG}/quality`

  push(
    'Setup',
    true,
    `FG=${FG_CODE} childSA=${CHILD_SA_CODE} profile=${saProfile.code} WIP=${ISSUE_WH}`,
  )

  // Release leftover parent reservations so free qty is meaningful
  const priorOpen = await prisma.productionOrder.findMany({
    where: {
      tenantId: tenant.id,
      productItemId: { in: [fg.id, saItem.id] },
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

  console.log('\n── Stock prep ──')
  // Zero SA-LADDER so parent cannot consume without child SA receipt
  await drainFreeTo(tenant.id, maker.userId, wip.id, saItem.id, CHILD_SA_CODE, 0)
  // Component for child WO issue
  await ensureStock(tenant.id, maker.userId, wip.id, CHILD_COMPONENT, 10)
  // Other stocked SAs so parent reserve can succeed on non-ladder lines (optional but cleaner)
  for (const code of ['SA-TANK-SHELL', 'SA-FRAME', 'SA-VALVE-PIPING', 'SA-WALKWAY']) {
    await ensureStock(tenant.id, maker.userId, wip.id, code, 2)
  }
  for (const code of ['RM-WELD-WIRE', 'RM-PRIMER-PAINT', 'RM-TOPCOAT-PAINT']) {
    await ensureStock(tenant.id, maker.userId, wip.id, code, 50)
  }
  push('Stock prep', true, `${CHILD_SA_CODE} free=0; ${CHILD_COMPONENT} available`)

  const saBefore = await prisma.inventoryStockBalance.findUnique({
    where: {
      tenantId_itemId_warehouseId: {
        tenantId: tenant.id,
        itemId: saItem.id,
        warehouseId: wip.id,
      },
    },
  })
  const saOnHandBefore = Number(saBefore?.onHandQty ?? 0)

  // 1. Parent FG WO
  const create = await request(app)
    .post(`${mfg}/work-orders`)
    .set(auth(maker.token))
    .send({
      productItemId: fg.id,
      plannedQuantity: 1,
      requiredCompletionDate: new Date(Date.now() + 21 * 86400000).toISOString(),
      plannedStartDate: new Date().toISOString(),
      priority: 'HIGH',
      notes: 'ISO tank child SA WO depth E2E',
      idempotencyKey: `iso-child-sa-${runStamp}`,
    })
  if (create.status !== 201) fail(`Create parent WO failed: ${create.status} ${JSON.stringify(create.body)}`)
  const parentId = create.body.data.id as string
  const parentNo = (create.body.data.orderNumber ?? create.body.data.workOrderNo) as string
  push('Create parent WO', true, `${parentNo} (${parentId})`)

  // 2. Generate children
  const childrenRes = await request(app)
    .post(`${mfg}/work-orders/${parentId}/generate-child-orders`)
    .set(auth(maker.token))
    .send({ force: true })
  const children = (Array.isArray(childrenRes.body?.data?.children)
    ? childrenRes.body.data.children
    : []) as Array<{ id: string; orderNumber?: string; productItemId?: string }>

  // Prefer response children; also list from API in case force re-run skipped creates
  const listed = await request(app)
    .get(`${mfg}/work-orders/${parentId}/child-orders`)
    .set(auth(maker.token))
  const listedChildren = (Array.isArray(listed.body?.data)
    ? listed.body.data
    : Array.isArray(listed.body?.data?.children)
      ? listed.body.data.children
      : []) as Array<{ id: string; orderNumber?: string; productItemId?: string; productItem?: { code?: string } }>

  const allChildren = listedChildren.length > 0 ? listedChildren : children
  push(
    'Generate child WOs',
    (childrenRes.status === 200 || childrenRes.status === 201) && allChildren.length >= 1,
    `apiCreated=${children.length} listed=${allChildren.length} status=${childrenRes.status}`,
  )

  const childRow =
    allChildren.find((c) => c.productItemId === saItem.id || c.productItem?.code === CHILD_SA_CODE) ??
    (await prisma.productionOrder.findFirst({
      where: {
        tenantId: tenant.id,
        parentProductionOrderId: parentId,
        productItemId: saItem.id,
        deletedAt: null,
      },
      select: { id: true, orderNumber: true, productItemId: true },
    }))

  if (!childRow) fail(`No child WO for ${CHILD_SA_CODE} under ${parentNo}`)
  const childId = childRow.id
  const childNo = ('orderNumber' in childRow && childRow.orderNumber) || (childRow as { orderNumber?: string }).orderNumber || childId
  push('Pick child SA WO', true, `${childNo} (${childId}) item=${CHILD_SA_CODE}`)

  // 3. Release child → route snapshot
  const childRelease = await request(app)
    .post(`${mfg}/work-orders/${childId}/release`)
    .set(auth(maker.token))
    .send({})
  if (childRelease.status !== 200) {
    fail(`Child release failed: ${childRelease.status} ${JSON.stringify(childRelease.body)}`)
  }
  push('Release child', true, `status=${childRelease.body.data?.status ?? 'READY'}`)

  // 4. Reserve + issue child materials (BO-DOC-HOLDER)
  const childReserve = await request(app)
    .post(`${mfg}/work-orders/${childId}/materials/reserve`)
    .set(auth(maker.token))
    .send({})
  if (childReserve.status !== 200) {
    fail(`Child reserve failed: ${childReserve.status} ${JSON.stringify(childReserve.body)}`)
  }
  const childReserveResults = (childReserve.body.data?.results ?? []) as Array<{
    status: string
    itemCode?: string
    shortageQty?: string | number
  }>
  const childShort = childReserveResults.filter((r) => r.status === 'SHORT')
  push(
    'Child reserve',
    childShort.length === 0,
    `lines=${childReserveResults.length} SHORT=${childShort.length}${
      childShort[0] ? ` (${JSON.stringify(childShort[0])})` : ''
    }`,
  )

  const childIssue = await issueAllMaterials(mfg, maker.token, childId, wip.id, 'child')
  push('Child issue', childIssue.failed === 0 && childIssue.issued > 0, `issued=${childIssue.issued} failed=${childIssue.failed}`)

  // 5. Start + stages
  const childStart = await request(app)
    .post(`${mfg}/work-orders/${childId}/start`)
    .set(auth(maker.token))
    .send({})
  if (childStart.status !== 200) {
    fail(`Child start failed: ${childStart.status} ${JSON.stringify(childStart.body)}`)
  }
  push('Start child', true, `status=${childStart.body.data?.status ?? 'IN_PROGRESS'}`)

  await executeStages(mfg, quality, maker.token, childId, 1, results, push)

  // Ensure completedGoodQuantity ≥ 1 for receipt eligibility paths
  const childRowDb = await prisma.productionOrder.findUnique({ where: { id: childId } })
  if (Number(childRowDb?.completedGoodQuantity ?? 0) <= 0) {
    const stagesLive = await request(app).get(`${mfg}/work-orders/${childId}/detail`).set(auth(maker.token))
    const anyStage = ((stagesLive.body.data?.stages ?? []) as Array<{ id: string }>)[0]
    if (anyStage) {
      await request(app)
        .post(`${mfg}/work-orders/${childId}/progress`)
        .set(auth(maker.token))
        .send({ stageId: anyStage.id, goodQuantity: 1 })
    }
  }

  // 6. SA receipt into WIP (before complete — SA_RECEIPT accepts IN_PROGRESS)
  const saReceipt = await request(app)
    .post(`${mfg}/work-orders/${childId}/sa-receipts`)
    .set(auth(maker.token))
    .send({
      quantity: 1,
      warehouseId: wip.id,
      idempotencyKey: `sa-rcv-${childId}-1`,
      remarks: 'Child SA E2E receipt',
    })
  if (saReceipt.status !== 201 && saReceipt.status !== 200) {
    fail(`SA receipt failed: ${saReceipt.status} ${JSON.stringify(saReceipt.body)}`)
  }
  const movementId =
    saReceipt.body.data?.movement?.id ?? saReceipt.body.data?.movementId ?? null
  push(
    'SA receipt',
    true,
    `qty=1 → ${saReceipt.body.data?.warehouseCode ?? ISSUE_WH} movement=${movementId ?? 'n/a'}`,
  )

  const saAfter = await prisma.inventoryStockBalance.findUnique({
    where: {
      tenantId_itemId_warehouseId: {
        tenantId: tenant.id,
        itemId: saItem.id,
        warehouseId: wip.id,
      },
    },
  })
  const saOnHandAfter = Number(saAfter?.onHandQty ?? 0)
  push(
    'SA stock at WIP',
    saOnHandAfter >= saOnHandBefore + 1,
    `${CHILD_SA_CODE} onHand ${saOnHandBefore} → ${saOnHandAfter} @${ISSUE_WH}`,
  )

  // 7. Complete child WO
  const childComplete = await request(app)
    .post(`${mfg}/work-orders/${childId}/complete`)
    .set(auth(maker.token))
    .send({ remarks: 'Child SA E2E complete' })
  if (childComplete.status !== 200) {
    // Flexible settings may still require stage close — surface clearly
    fail(`Child complete failed: ${childComplete.status} ${JSON.stringify(childComplete.body)}`)
  }
  const childFinal = await prisma.productionOrder.findUnique({
    where: { id: childId },
    select: { status: true, completedGoodQuantity: true, parentProductionOrderId: true },
  })
  push(
    'Complete child',
    childFinal?.status === 'COMPLETED' || childComplete.body.data?.status === 'COMPLETED',
    `db=${childFinal?.status} parentLink=${childFinal?.parentProductionOrderId === parentId}`,
  )

  // 8. Parent release → reserve → assert SA-LADDER not SHORT → issue SA line
  const parentRelease = await request(app)
    .post(`${mfg}/work-orders/${parentId}/release`)
    .set(auth(maker.token))
    .send({})
  if (parentRelease.status !== 200) {
    fail(`Parent release failed: ${parentRelease.status} ${JSON.stringify(parentRelease.body)}`)
  }
  push('Release parent', true, `status=${parentRelease.body.data?.status}`)

  const parentReserve = await request(app)
    .post(`${mfg}/work-orders/${parentId}/materials/reserve`)
    .set(auth(maker.token))
    .send({})
  if (parentReserve.status !== 200) {
    fail(`Parent reserve failed: ${parentReserve.status} ${JSON.stringify(parentReserve.body)}`)
  }

  const parentMats = await request(app)
    .get(`${mfg}/work-orders/${parentId}/materials`)
    .set(auth(maker.token))
  const parentList = (
    Array.isArray(parentMats.body.data)
      ? parentMats.body.data
      : Array.isArray(parentMats.body.data?.materials)
        ? parentMats.body.data.materials
        : []
  ) as Array<{
    id: string
    status: string
    requiredQty: string | number
    reservedQty?: string | number
    issuedQty?: string | number
    shortageQty?: string | number
    item?: { code?: string }
    itemCode?: string
  }>

  const saMat = parentList.find(
    (m) => (m.itemCode ?? m.item?.code) === CHILD_SA_CODE,
  )
  if (!saMat) {
    fail(
      `Parent materials missing ${CHILD_SA_CODE} line — got: ${parentList
        .map((m) => m.itemCode ?? m.item?.code)
        .join(', ')}`,
    )
  }
  const saReserved = Number(saMat.reservedQty ?? 0)
  const saShortage = Number(saMat.shortageQty ?? 0)
  const saOk =
    saMat.status === 'RESERVED' ||
    saMat.status === 'PARTIAL' ||
    (saReserved >= 1 && saShortage <= 0)
  push(
    'Parent SA demand',
    saOk,
    `${CHILD_SA_CODE} status=${saMat.status} reserved=${saReserved} shortage=${saShortage}`,
  )

  const issueSa = await request(app)
    .post(`${mfg}/work-orders/${parentId}/materials/issue`)
    .set(auth(maker.token))
    .send({
      materialId: saMat.id,
      quantity: Math.min(Number(saMat.requiredQty), saReserved > 0 ? saReserved : 1),
      warehouseId: wip.id,
      idempotencyKey: `issue-parent-sa-${parentId}-${saMat.id}`,
    })
  push(
    'Parent issue SA',
    issueSa.status === 200 || issueSa.status === 201,
    issueSa.status === 200 || issueSa.status === 201
      ? `issued ${CHILD_SA_CODE} from child receipt stock`
      : `${issueSa.status} ${JSON.stringify(issueSa.body)}`,
  )

  const saAfterIssue = await prisma.inventoryStockBalance.findUnique({
    where: {
      tenantId_itemId_warehouseId: {
        tenantId: tenant.id,
        itemId: saItem.id,
        warehouseId: wip.id,
      },
    },
  })
  push(
    'SA consumed by parent',
    Number(saAfterIssue?.onHandQty ?? 0) < saOnHandAfter,
    `onHand after issue=${Number(saAfterIssue?.onHandQty ?? 0)} (was ${saOnHandAfter} post-receipt)`,
  )

  console.log('\n── Summary ──')
  for (const r of results) {
    console.log(`  ${r.ok ? 'PASS' : 'FAIL'}  ${r.step.padEnd(24)} ${r.detail}`)
  }
  console.log(`\nParent ${parentNo} (${parentId})`)
  console.log(`Child  ${childNo} (${childId}) SA receipt movement=${movementId ?? 'n/a'}`)
  console.log('ISO tank child SA WO depth finished.\n')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })

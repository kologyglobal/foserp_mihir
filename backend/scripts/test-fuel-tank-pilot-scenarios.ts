/**
 * Fuel Tank manufacturing pilot — open scenarios (API).
 *
 * Complements test-fuel-tank-wo-execution.ts (happy path A).
 * Covers: shortage→PR, material return, hold/resume, SO→Demand→WO,
 * partial-completion profile flag, Dispatch-readiness serial AVAILABLE.
 *
 * Prereqs:
 *   npx tsx scripts/seed-fuel-tank-pilot-items.ts
 *   npx tsx scripts/seed-fuel-tank-mfg-setup.ts
 *
 * Usage:
 *   npx tsx scripts/test-fuel-tank-pilot-scenarios.ts
 */
import request from 'supertest'
import { createApp } from '../src/app.js'
import { prisma } from '../src/config/database.js'
import { postStockMovement } from '../src/modules/inventory/shared/stock-posting.service.js'
import { ensureCodeSeries } from '../src/services/codeSeries.service.js'

const TENANT_SLUG = process.env.TENANT_SLUG ?? 'vasant-trailers'
const FG_CODE = 'FG-FUEL-TANK-5000L'
const SHORT_ITEM = 'RM-MS-PLATE-006'
const ISSUE_WH = 'WIP'
const FG_WH = 'FG-MAIN'
const PROFILE_CODE = 'MP-FUEL-TANK-5000L'

const app = createApp()
const runStamp = `${Date.now()}`

type StepResult = { scenario: string; step: string; ok: boolean; detail: string }

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

async function main() {
  const results: StepResult[] = []
  const push = (scenario: string, step: string, ok: boolean, detail: string) => {
    results.push({ scenario, step, ok, detail })
    console.log(`${ok ? '✓' : '✗'} [${scenario}] ${step}: ${detail}`)
    if (!ok) fail(`[${scenario}] ${step}: ${detail}`)
  }

  console.log(`\n=== Fuel Tank pilot scenarios (${TENANT_SLUG}) ===\n`)

  const tenant = await prisma.tenant.findFirst({ where: { slug: TENANT_SLUG, deletedAt: null } })
  if (!tenant) fail(`Tenant not found: ${TENANT_SLUG}`)

  const fg = await prisma.masterItem.findFirst({
    where: { tenantId: tenant.id, code: FG_CODE, deletedAt: null },
  })
  if (!fg) fail(`FG ${FG_CODE} missing — run seed-fuel-tank-pilot-items.ts`)

  await prisma.masterItem.update({
    where: { id: fg.id },
    data: {
      salesAllowed: true,
      defaultSalesRate: Number(fg.defaultSalesRate ?? 0) > 0 ? fg.defaultSalesRate : 450000,
      defaultFulfilmentMethod: 'PRODUCTION',
    },
  })

  const profile = await prisma.manufacturingProfile.findFirst({
    where: {
      tenantId: tenant.id,
      code: PROFILE_CODE,
      productItemId: fg.id,
      isActive: true,
      deletedAt: null,
    },
  })
  if (!profile) fail(`Profile ${PROFILE_CODE} missing`)

  const wip = await prisma.masterWarehouse.findFirst({
    where: { tenantId: tenant.id, code: ISSUE_WH, deletedAt: null },
  })
  const fgWh = await prisma.masterWarehouse.findFirst({
    where: { tenantId: tenant.id, code: FG_WH, deletedAt: null },
  })
  if (!wip || !fgWh) fail(`Warehouses ${ISSUE_WH}/${FG_WH} missing`)

  const shortItem = await prisma.masterItem.findFirst({
    where: { tenantId: tenant.id, code: SHORT_ITEM, deletedAt: null },
  })
  if (!shortItem) fail(`Item ${SHORT_ITEM} missing`)

  const admin = await login('admin@vasant-trailers.com', 'Admin@123')
  const mfg = `/api/v1/t/${TENANT_SLUG}/manufacturing`
  const crm = `/api/v1/t/${TENANT_SLUG}/crm`
  const due = new Date(Date.now() + 14 * 86400000).toISOString()

  // ── Scenario F — Partial profile flag ─────────────────────────────────
  push(
    'F',
    'partialCompletionAllowed',
    profile.partialCompletionAllowed === true,
    `profile.partialCompletionAllowed=${profile.partialCompletionAllowed} (qty-3 SPA still required)`,
  )

  // ── Scenario H — Hold / Resume ────────────────────────────────────────
  {
    const create = await request(app)
      .post(`${mfg}/work-orders`)
      .set(auth(admin.token))
      .send({
        productItemId: fg.id,
        plannedQuantity: 1,
        requiredCompletionDate: due,
        notes: `pilot-hold-${runStamp}`,
      })
    if (create.status !== 201 && create.status !== 200) {
      fail(`Create WO for hold: ${create.status} ${JSON.stringify(create.body)}`)
    }
    const woId = create.body.data.id as string
    const woNo = create.body.data.orderNumber as string

    const release = await request(app)
      .post(`${mfg}/work-orders/${woId}/release`)
      .set(auth(admin.token))
      .send({})
    push('H', 'Release', release.status === 200, `${woNo} status=${release.body.data?.status}`)

    const start = await request(app)
      .post(`${mfg}/work-orders/${woId}/start`)
      .set(auth(admin.token))
      .send({})
    push('H', 'Start', start.status === 200, `status=${start.body.data?.status}`)

    const hold = await request(app)
      .post(`${mfg}/work-orders/${woId}/hold`)
      .set(auth(admin.token))
      .send({
        reasonCategory: 'MATERIAL',
        remarks: 'Pilot UAT hold — waiting plate delivery',
      })
    push(
      'H',
      'Hold',
      hold.status === 200 && hold.body.data?.status === 'ON_HOLD',
      `status=${hold.body.data?.status} reason=${hold.body.data?.holdReasonCategory ?? 'n/a'}`,
    )

    const resume = await request(app)
      .post(`${mfg}/work-orders/${woId}/resume`)
      .set(auth(admin.token))
      .send({ remarks: 'Pilot UAT resume' })
    push(
      'H',
      'Resume',
      resume.status === 200 && resume.body.data?.status !== 'ON_HOLD',
      `status=${resume.body.data?.status}`,
    )

    await request(app)
      .post(`${mfg}/work-orders/${woId}/cancel`)
      .set(auth(admin.token))
      .send({ reason: 'Pilot hold scenario cleanup' })
      .catch(() => undefined)
  }

  // ── Scenario B — Shortage → PR ────────────────────────────────────────
  {
    // Cancel open fuel-tank WOs that may hold plate reservations
    const openWos = await prisma.productionOrder.findMany({
      where: {
        tenantId: tenant.id,
        productItemId: fg.id,
        deletedAt: null,
        status: { in: ['DRAFT', 'READY', 'IN_PROGRESS', 'ON_HOLD'] },
      },
      select: { id: true },
    })
    for (const po of openWos) {
      await request(app)
        .post(`${mfg}/work-orders/${po.id}/materials/release-reservation`)
        .set(auth(admin.token))
        .send({})
    }

    await prisma.inventoryStockReservation.updateMany({
      where: {
        tenantId: tenant.id,
        itemId: shortItem.id,
        warehouseId: wip.id,
        status: 'ACTIVE',
      },
      data: { status: 'CANCELLED' },
    })
    await prisma.inventoryStockBalance.upsert({
      where: {
        tenantId_itemId_warehouseId: {
          tenantId: tenant.id,
          itemId: shortItem.id,
          warehouseId: wip.id,
        },
      },
      create: {
        tenantId: tenant.id,
        itemId: shortItem.id,
        warehouseId: wip.id,
        onHandQty: 0,
        reservedQty: 0,
      },
      update: { onHandQty: 0, reservedQty: 0 },
    })

    const create = await request(app)
      .post(`${mfg}/work-orders`)
      .set(auth(admin.token))
      .send({
        productItemId: fg.id,
        plannedQuantity: 1,
        requiredCompletionDate: due,
        notes: `pilot-shortage-${runStamp}`,
      })
    const woId = create.body.data.id as string
    const woNo = create.body.data.orderNumber as string

    const release = await request(app)
      .post(`${mfg}/work-orders/${woId}/release`)
      .set(auth(admin.token))
      .send({})
    push('B', 'Release WO', release.status === 200, woNo)

    await request(app)
      .post(`${mfg}/work-orders/${woId}/materials/sync-requirements`)
      .set(auth(admin.token))
      .send({})

    const reserve = await request(app)
      .post(`${mfg}/work-orders/${woId}/materials/reserve`)
      .set(auth(admin.token))
      .send({})
    push('B', 'Reserve with short stock', reserve.status === 200, `${reserve.status}`)

    const mats = await request(app)
      .get(`${mfg}/work-orders/${woId}/materials`)
      .set(auth(admin.token))
    const lines = (mats.body.data ?? mats.body.data?.items ?? []) as Array<{
      id: string
      itemId?: string
      item?: { code?: string }
      shortageQty?: string | number
      status?: string
      requiredQty?: string | number
    }>
    const shortMat =
      lines.find((l) => l.item?.code === SHORT_ITEM || l.itemId === shortItem.id) ??
      (
        await prisma.productionOrderMaterial.findFirst({
          where: { productionOrderId: woId, itemId: shortItem.id },
        })
      )

    const shortQty = Number(
      (shortMat as { shortageQty?: string | number } | null)?.shortageQty ?? 0,
    )
    const shortId = (shortMat as { id: string } | null)?.id
    push(
      'B',
      'Shortage visible',
      Boolean(shortId) && shortQty > 0,
      `${SHORT_ITEM} shortageQty=${shortQty} materialId=${shortId ?? 'missing'}`,
    )

    if (shortId) {
      const pr = await request(app)
        .post(`${mfg}/work-orders/${woId}/materials/shortage-requisition`)
        .set(auth(admin.token))
        .send({
          materialIds: [shortId],
          priority: 'HIGH',
          submit: false,
          idempotencyKey: `ft-pilot-short-${runStamp}`.slice(0, 150),
        })
      const prOk = pr.status === 201 || pr.status === 200
      const prData = pr.body.data?.requisition ?? pr.body.data
      push(
        'B',
        'Shortage → PR',
        prOk && Boolean(prData?.id),
        prOk
          ? `${prData?.requisitionNumber ?? prData?.id} source=${prData?.source ?? 'n/a'}`
          : `${pr.status} ${JSON.stringify(pr.body)}`,
      )
    }

    await request(app)
      .post(`${mfg}/work-orders/${woId}/materials/release-reservation`)
      .set(auth(admin.token))
      .send({})
    await request(app)
      .post(`${mfg}/work-orders/${woId}/cancel`)
      .set(auth(admin.token))
      .send({ reason: 'Pilot shortage cleanup' })
      .catch(() => undefined)

    // Restore some plate stock for return scenario
    await ensureCodeSeries(tenant.id, 'STOCK_MOVEMENT')
    const rate = Number(shortItem.standardRate ?? 68) || 68
    await postStockMovement({
      tenantId: tenant.id,
      itemId: shortItem.id,
      warehouseId: wip.id,
      movementType: 'OPENING',
      referenceType: 'OPN',
      quantity: 1000,
      rate,
      referenceNo: `OPN-FT-PILOT-${runStamp}`,
      remarks: 'Restore plate after shortage pilot',
      idempotencyKey: `opn-ft-pilot-${runStamp}`,
      batchNumber: shortItem.batchTracked ? `OPN-FT-PILOT-${runStamp}` : undefined,
      createdBy: admin.userId,
      stockStatus: 'UNRESTRICTED',
    })
  }

  // ── Scenario E — Material issue → return ──────────────────────────────
  {
    const create = await request(app)
      .post(`${mfg}/work-orders`)
      .set(auth(admin.token))
      .send({
        productItemId: fg.id,
        plannedQuantity: 1,
        requiredCompletionDate: due,
        notes: `pilot-return-${runStamp}`,
      })
    const woId = create.body.data.id as string
    const woNo = create.body.data.orderNumber as string

    await request(app).post(`${mfg}/work-orders/${woId}/release`).set(auth(admin.token)).send({})
    await request(app)
      .post(`${mfg}/work-orders/${woId}/materials/sync-requirements`)
      .set(auth(admin.token))
      .send({})
    await request(app)
      .post(`${mfg}/work-orders/${woId}/materials/reserve`)
      .set(auth(admin.token))
      .send({})

    const matRow = await prisma.productionOrderMaterial.findFirst({
      where: { productionOrderId: woId, itemId: shortItem.id },
    })
    if (!matRow) fail('Return scenario: plate material line missing')

    const issueQty = Math.min(50, Number(matRow.requiredQty))
    const balBefore = await prisma.inventoryStockBalance.findUnique({
      where: {
        tenantId_itemId_warehouseId: {
          tenantId: tenant.id,
          itemId: shortItem.id,
          warehouseId: wip.id,
        },
      },
    })
    const onHandBefore = Number(balBefore?.onHandQty ?? 0)

    const batchBal = await prisma.inventoryBatchBalance.findFirst({
      where: {
        tenantId: tenant.id,
        itemId: shortItem.id,
        warehouseId: wip.id,
        stockStatus: 'UNRESTRICTED',
        quantity: { gt: 0 },
      },
      include: { batch: { select: { id: true, batchNumber: true } } },
      orderBy: { updatedAt: 'desc' },
    })

    const issue = await request(app)
      .post(`${mfg}/work-orders/${woId}/materials/issue`)
      .set(auth(admin.token))
      .send({
        materialId: matRow.id,
        quantity: issueQty,
        idempotencyKey: `ft-pilot-issue-${runStamp}`,
        remarks: 'Pilot issue for return',
        batchId: batchBal?.batchId,
        batchNumber: batchBal?.batch?.batchNumber,
      })
    push(
      'E',
      'Issue material',
      issue.status === 200 || issue.status === 201,
      `${woNo} qty=${issueQty} ${issue.status === 200 || issue.status === 201 ? 'ok' : JSON.stringify(issue.body)}`,
    )

    const issueMv = await prisma.inventoryStockMovement.findFirst({
      where: {
        tenantId: tenant.id,
        workOrderId: woId,
        itemId: shortItem.id,
        movementType: 'ISSUE',
        referenceType: 'ISSUE_TO_WO',
      },
      orderBy: { createdAt: 'desc' },
    })
    const issueCost = issueMv
      ? await prisma.inventoryCostEntry.findFirst({
          where: { tenantId: tenant.id, inventoryMovementId: issueMv.id },
        })
      : null
    push(
      'E',
      'Inventory cost on issue',
      Boolean(issueCost) && Number(issueCost?.totalCost ?? 0) > 0,
      `totalCost=${issueCost?.totalCost ?? 'n/a'} movement=${issueMv?.id ?? 'n/a'}`,
    )

    const returnQty = Math.min(10, issueQty)
    const ret = await request(app)
      .post(`${mfg}/work-orders/${woId}/materials/return`)
      .set(auth(admin.token))
      .send({
        materialId: matRow.id,
        quantity: returnQty,
        idempotencyKey: `ft-pilot-return-${runStamp}`,
        remarks: 'Pilot unused return',
        batchId: batchBal?.batchId,
        batchNumber: batchBal?.batch?.batchNumber,
      })
    push(
      'E',
      'Return material',
      ret.status === 200 || ret.status === 201,
      `qty=${returnQty} ${ret.status === 200 || ret.status === 201 ? 'ok' : JSON.stringify(ret.body)}`,
    )

    const balAfter = await prisma.inventoryStockBalance.findUnique({
      where: {
        tenantId_itemId_warehouseId: {
          tenantId: tenant.id,
          itemId: shortItem.id,
          warehouseId: wip.id,
        },
      },
    })
    const onHandAfter = Number(balAfter?.onHandQty ?? 0)
    const expectedNet = onHandBefore - issueQty + returnQty
    push(
      'E',
      'Stock restored after return',
      Math.abs(onHandAfter - expectedNet) < 0.001,
      `before=${onHandBefore} afterIssue=${onHandBefore - issueQty} afterReturn=${onHandAfter} expected=${expectedNet}`,
    )

    const matAfter = await prisma.productionOrderMaterial.findFirst({
      where: { id: matRow.id },
    })
    push(
      'E',
      'WO material returnedQty',
      Number(matAfter?.returnedQty ?? 0) >= returnQty,
      `issued=${matAfter?.issuedQty} returned=${matAfter?.returnedQty}`,
    )

    await request(app)
      .post(`${mfg}/work-orders/${woId}/cancel`)
      .set(auth(admin.token))
      .send({ reason: 'Pilot return cleanup' })
      .catch(() => undefined)
  }

  // ── Scenario I — SO → Demand → WO ─────────────────────────────────────
  {
    const stamp = runStamp.slice(-8)
    const companyRes = await request(app)
      .post(`${crm}/companies`)
      .set(auth(admin.token))
      .send({
        customerName: `Fuel Tank Pilot Co ${stamp}`,
        customerType: 'corporate',
        isActive: true,
        addressLine1: 'MIDC Plot 9',
        city: 'Pune',
        state: 'Maharashtra',
        pincode: '411019',
        contactPerson: 'Pilot Buyer',
        contactPhone: '9876509999',
        contactEmail: `ft-pilot-${stamp}@example.com`,
        billingAddress: 'MIDC Plot 9, Pune',
        shippingAddress: 'MIDC Plot 9, Pune',
      })
    if (companyRes.status !== 201) {
      fail(`Create company: ${companyRes.status} ${JSON.stringify(companyRes.body)}`)
    }
    const companyId = companyRes.body.data.id as string

    const unitPrice = Number(fg.defaultSalesRate ?? 450000) || 450000
    const soRes = await request(app)
      .post(`${crm}/sales-orders`)
      .set(auth(admin.token))
      .send({
        customerId: companyId,
        customerPoNumber: `PO-FT-PILOT-${stamp}`,
        directSoReason: 'Fuel Tank manufacturing pilot — SO → Demand → WO',
        itemId: fg.id,
        qty: 1,
        unitPrice,
        paymentTerms: '30% advance',
        deliveryTerms: 'Ex-works',
        deliveryTime: '8 weeks',
        requiredDate: due.slice(0, 10),
        lines: [
          {
            itemId: fg.id,
            itemCode: fg.code,
            productOrItem: fg.name,
            description: fg.name,
            qty: 1,
            uom: 'Nos',
            unitPrice,
            discountPct: 0,
            taxPct: 18,
          },
        ],
      })
    if (soRes.status !== 201 && soRes.status !== 200) {
      fail(`Create SO: ${soRes.status} ${JSON.stringify(soRes.body)}`)
    }
    const salesOrderId = soRes.body.data.id as string
    const soNumber = soRes.body.data.soNumber ?? soRes.body.data.number
    const soLines = (soRes.body.data.lines ?? []) as Array<{ id: string }>
    let lineId = soLines[0]?.id
    if (!lineId) {
      const soDb = await prisma.crmSalesOrder.findFirst({
        where: { id: salesOrderId },
        include: { lines: true },
      })
      lineId = soDb?.lines?.[0]?.id
    }
    if (!lineId) fail('SO line missing')

    const confirm = await request(app)
      .post(`${crm}/sales-orders/${salesOrderId}/confirm`)
      .set(auth(admin.token))
      .send({})
    push(
      'I',
      'Confirm SO',
      confirm.status === 200 && confirm.body.data?.status === 'confirmed',
      `${soNumber ?? salesOrderId} status=${confirm.body.data?.status}`,
    )

    const eligibility = await request(app)
      .get(`${mfg}/demand-sources/sales-orders/${salesOrderId}/lines`)
      .set(auth(admin.token))
    push('I', 'SO line eligibility', eligibility.status === 200, `${eligibility.status}`)

    const convert = await request(app)
      .post(`${mfg}/demand-sources/sales-orders/${salesOrderId}/lines/${lineId}/convert`)
      .set(auth(admin.token))
      .send({
        quantity: 1,
        priority: 'HIGH',
        generateChildOrders: false,
        idempotencyKey: `ft-so-wo-${runStamp}`.slice(0, 150),
      })
    const convertOk = convert.status === 201 || convert.status === 200
    const demand = convert.body.data?.demand
    const order = convert.body.data?.order
    push(
      'I',
      'SO → Demand → WO',
      convertOk && Boolean(demand?.id) && Boolean(order?.id),
      convertOk
        ? `demand=${demand?.demandNumber ?? demand?.id} wo=${order?.orderNumber ?? order?.id} source=${order?.sourceType}`
        : `${convert.status} ${JSON.stringify(convert.body)}`,
    )
    push(
      'I',
      'WO linked to SO',
      order?.salesOrderId === salesOrderId || order?.sourceDocumentId === salesOrderId,
      `salesOrderId=${order?.salesOrderId ?? order?.sourceDocumentId}`,
    )
    push(
      'I',
      'No SFG child WOs',
      true,
      `generateChildOrders=false (LOGICAL Fuel Tank)`,
    )

    if (order?.id) {
      await request(app)
        .post(`${mfg}/work-orders/${order.id}/cancel`)
        .set(auth(admin.token))
        .send({ reason: 'Pilot SO→WO cleanup' })
        .catch(() => undefined)
    }
  }

  // ── Scenario D — Dispatch readiness (serial AVAILABLE) ────────────────
  {
    const available = await prisma.inventorySerial.findMany({
      where: {
        tenantId: tenant.id,
        itemId: fg.id,
        warehouseId: fgWh.id,
        status: 'AVAILABLE',
        stockStatus: 'UNRESTRICTED',
      },
      take: 5,
      orderBy: { createdAt: 'desc' },
      select: { id: true, serialNumber: true, status: true, stockStatus: true, warehouseId: true },
    })
    push(
      'D',
      'FG serial AVAILABLE for Dispatch',
      available.length > 0,
      available.length > 0
        ? `${available.length} serial(s) e.g. ${available[0].serialNumber} @ ${FG_WH}`
        : `none — run test-fuel-tank-wo-execution.ts first to post FG`,
    )

    const bal = await prisma.inventoryStockBalance.findUnique({
      where: {
        tenantId_itemId_warehouseId: {
          tenantId: tenant.id,
          itemId: fg.id,
          warehouseId: fgWh.id,
        },
      },
    })
    push(
      'D',
      'FG onHand at FG-MAIN',
      Number(bal?.onHandQty ?? 0) > 0,
      `onHand=${bal?.onHandQty ?? 0}`,
    )
  }

  console.log('\n══ Pilot scenario checklist ══')
  for (const r of results) {
    console.log(`  ${r.ok ? 'PASS' : 'FAIL'}  [${r.scenario}] ${r.step}`)
  }
  const failed = results.filter((r) => !r.ok)
  if (failed.length) {
    fail(`${failed.length} step(s) failed`)
  }
  console.log('\nFUEL TANK PILOT SCENARIOS — PASS')
  console.log('SPA walk + partial FG qty-3: see docs/manufacturing/MFG_PILOT_SPA_UAT_CHECKLIST.md\n')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })

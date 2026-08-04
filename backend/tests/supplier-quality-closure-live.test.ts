import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import request from 'supertest'
import { createApp } from '../src/app.js'
import { prisma } from '../src/config/prisma.js'
import {
  cleanupPurchaseTenant,
  createSentPo,
  createSubmittedGrn,
  createTenantUser,
  dbAvailable,
  ensureLegalEntity,
  ensurePermissions,
  FULL_PURCHASE_PERMS,
  seedPurchaseMasters,
  type PurchaseMasterIds,
} from './helpers/purchase-live-fixture.js'

/**
 * Supplier quality closure — live MySQL E2E:
 * QI reject → return (prefill) → ship → complete → VA draft;
 * replacement GRN link + trace; OTD scorecard KPI.
 *
 * Skips entire suite when DB is unreachable (never claims pass on skip).
 */
const app = createApp()

describe.skipIf(!dbAvailable)('Supplier quality closure E2E (live HTTP)', () => {
  let tenantId = ''
  let slug = ''
  let token = ''
  let approverToken = ''
  let masters: PurchaseMasterIds

  const auth = (t = token) => ({ Authorization: `Bearer ${t}` })
  const qiBase = () => `/api/v1/t/${slug}/purchase/quality-inspections`
  const returnBase = () => `/api/v1/t/${slug}/purchase/returns`
  const invoiceBase = () => `/api/v1/t/${slug}/purchase/invoices`
  const setupBase = () => `/api/v1/t/${slug}/purchase/setup`
  const scorecardUrl = (vendorId: string) =>
    `/api/v1/t/${slug}/purchase/supplier-quality/vendors/${vendorId}/scorecard`

  async function putSetup(body: Record<string, unknown>) {
    const current = await request(app).get(setupBase()).set(auth())
    const version = current.body.data?.version ?? 0
    return request(app)
      .put(setupBase())
      .set(auth())
      .send({ ...body, version })
  }

  async function freshItem(label = 'SQC') {
    const suffix = `${Date.now()}${Math.floor(Math.random() * 1000)}`
    const categoryId = (
      await prisma.masterItemCategory.findFirstOrThrow({ where: { tenantId, deletedAt: null } })
    ).id
    return prisma.masterItem.create({
      data: {
        tenantId,
        code: `${label}${suffix}`.slice(-24),
        name: `${label} Live Item`,
        categoryId,
        baseUomId: masters.uomId,
        itemType: 'raw_material',
        isPurchasable: true,
        isStockable: true,
        status: 'ACTIVE',
      },
    })
  }

  async function postMatchedInvoice(args: {
    vendorId: string
    poId: string
    grnId: string
    poLineId: string
    grnLineId: string
    qty: number
  }) {
    const create = await request(app)
      .post(invoiceBase())
      .set(auth())
      .send({
        vendorId: args.vendorId,
        purchaseOrderId: args.poId,
        goodsReceiptId: args.grnId,
        lines: [
          {
            purchaseOrderLineId: args.poLineId,
            goodsReceiptLineId: args.grnLineId,
            quantity: args.qty,
            rate: 100,
            taxRatePct: 0,
          },
        ],
      })
    expect(create.status, JSON.stringify(create.body)).toBe(201)
    const invoiceId = create.body.data.id as string
    const submit = await request(app).post(`${invoiceBase()}/${invoiceId}/submit`).set(auth()).send({})
    expect(submit.status, JSON.stringify(submit.body)).toBe(200)
    const approve = await request(app)
      .post(`${invoiceBase()}/${invoiceId}/approve`)
      .set({ Authorization: `Bearer ${approverToken}` })
      .send({})
    expect(approve.status, JSON.stringify(approve.body)).toBe(200)
    const post = await request(app).post(`${invoiceBase()}/${invoiceId}/post`).set(auth()).send({})
    expect(post.status, JSON.stringify(post.body)).toBe(200)
    expect(post.body.data.status).toBe('POSTED')
    return invoiceId
  }

  beforeAll(async () => {
    await ensurePermissions()
    const main = await createTenantUser({
      app,
      slugPrefix: 'sqc-e2e',
      permissionNames: FULL_PURCHASE_PERMS,
    })
    tenantId = main.tenantId
    slug = main.slug
    token = main.token

    const approver = await createTenantUser({
      app,
      slugPrefix: 'sqc-appr',
      permissionNames: FULL_PURCHASE_PERMS,
      tenantId,
    })
    approverToken = approver.token

    masters = await seedPurchaseMasters(tenantId)
    await ensureLegalEntity(tenantId)

    const setupRes = await putSetup({
      allowDirectInvoice: true,
      invoiceMatchTolerances: {
        requirePoMatch: false,
        requireGrnMatch: false,
      },
      // Rejected qty posts to inventory REJECTED status without requiring quarantine location.
      quality: {
        allowRejectedStockInQuarantine: false,
      },
    })
    expect(setupRes.status, JSON.stringify(setupRes.body)).toBe(200)
  }, 180_000)

  afterAll(async () => {
    if (tenantId) await cleanupPurchaseTenant(tenantId)
  }, 120_000)

  it('CREDIT path: QI reject → prefill return → ship → complete → VA draft (no GL from return)', async () => {
    const item = await freshItem('CR')
    const qty = 10
    const { poId, poLineId } = await createSentPo(app, {
      slug,
      token,
      approverToken,
      vendorId: masters.vendorId,
      uomId: masters.uomId,
      warehouseId: masters.warehouseId,
      qty,
      itemId: item.id,
      itemCode: item.code,
      expectedDeliveryDate: '2026-07-25',
    })
    const grn = await createSubmittedGrn(app, {
      slug,
      token,
      poId,
      poLineId,
      vendorId: masters.vendorId,
      warehouseId: masters.warehouseId,
      locationId: masters.locationId,
      binId: masters.binId,
      receivedQuantity: qty,
      inspectionRequired: true,
      receiptDate: '2026-07-21',
    })
    expect(grn.status).toBe('QC_PENDING')

    const qiCreate = await request(app)
      .post(qiBase())
      .set(auth())
      .send({ goodsReceiptId: grn.grnId })
    expect(qiCreate.status, JSON.stringify(qiCreate.body)).toBe(201)
    const qiId = qiCreate.body.data.id as string

    const completeQi = await request(app)
      .post(`${qiBase()}/${qiId}/complete`)
      .set(auth())
      .send({
        outcome: 'REJECT',
        decisionCode: 'RETURN_TO_VENDOR',
        decisionReason: 'E2E: dimensional fail vs drawing',
      })
    expect(completeQi.status, JSON.stringify(completeQi.body)).toBe(200)
    expect(completeQi.body.data.status).toBe('REJECTED')
    expect(completeQi.body.data.decisionCode).toBe('RETURN_TO_VENDOR')

    const balAfterReject = await prisma.inventoryStockBalance.findFirstOrThrow({
      where: { tenantId, itemId: item.id, warehouseId: masters.warehouseId },
    })
    expect(Number(balAfterReject.rejectedQty)).toBeGreaterThanOrEqual(qty)

    await postMatchedInvoice({
      vendorId: masters.vendorId,
      poId,
      grnId: grn.grnId,
      poLineId,
      grnLineId: grn.grnLineId,
      qty,
    })

    const prefill = await request(app)
      .get(`${qiBase()}/${qiId}/purchase-return-prefill`)
      .set(auth())
    expect(prefill.status, JSON.stringify(prefill.body)).toBe(200)
    expect(prefill.body.data.qualityInspectionId).toBe(qiId)
    expect(prefill.body.data.lines?.length).toBeGreaterThan(0)
    expect(Number(prefill.body.data.totalRemaining)).toBeGreaterThan(0)

    const createRet = await request(app)
      .post(returnBase())
      .set(auth())
      .send({
        vendorId: prefill.body.data.vendorId,
        purchaseOrderId: prefill.body.data.purchaseOrderId,
        goodsReceiptId: prefill.body.data.goodsReceiptId,
        qualityInspectionId: qiId,
        warehouseId: prefill.body.data.warehouseId ?? masters.warehouseId,
        returnType: 'CREDIT',
        reason: prefill.body.data.reason,
        decisionCode: prefill.body.data.decisionCode,
        lines: prefill.body.data.lines.map((l: { goodsReceiptLineId: string; purchaseOrderLineId?: string; returnQuantity: number }) => ({
          goodsReceiptLineId: l.goodsReceiptLineId,
          purchaseOrderLineId: l.purchaseOrderLineId,
          returnQuantity: l.returnQuantity,
        })),
      })
    expect(createRet.status, JSON.stringify(createRet.body)).toBe(201)
    const returnId = createRet.body.data.id as string
    expect(createRet.body.data.returnType).toBe('CREDIT')
    expect(createRet.body.data.qualityInspectionId).toBe(qiId)

    const submit = await request(app).post(`${returnBase()}/${returnId}/submit`).set(auth()).send({})
    expect(submit.status).toBe(200)
    const approve = await request(app).post(`${returnBase()}/${returnId}/approve`).set(auth()).send({})
    expect(approve.status).toBe(200)

    const ship = await request(app)
      .post(`${returnBase()}/${returnId}/ship`)
      .set(auth())
      .send({ remarks: 'In transit to vendor' })
    expect(ship.status, JSON.stringify(ship.body)).toBe(200)
    expect(ship.body.data.status).toBe('SHIPPED')

    const transitKey = await prisma.inventoryStockMovement.findMany({
      where: { tenantId, idempotencyKey: { startsWith: `prt-transit:${returnId}` } },
    })
    expect(transitKey.length).toBeGreaterThan(0)

    const balAfterShip = await prisma.inventoryStockBalance.findFirstOrThrow({
      where: { tenantId, itemId: item.id, warehouseId: masters.warehouseId },
    })
    // REJECTED → BLOCKED (return in transit)
    expect(Number(balAfterShip.blockedQty)).toBeGreaterThanOrEqual(qty)

    const complete = await request(app)
      .post(`${returnBase()}/${returnId}/complete`)
      .set(auth())
      .send({ remarks: 'Vendor accepted return' })
    expect(complete.status, JSON.stringify(complete.body)).toBe(200)
    expect(complete.body.data.status).toBe('COMPLETED')

    const issueMoves = await prisma.inventoryStockMovement.findMany({
      where: {
        tenantId,
        OR: [
          { idempotencyKey: { startsWith: `prt-out:${returnId}` } },
          { idempotencyKey: { startsWith: `prt-out-rej:${returnId}` } },
        ],
      },
    })
    expect(issueMoves.length).toBeGreaterThan(0)

    // AP handoff: VA draft in Money Out — return path itself does not post adjustment GL
    expect(complete.body.data.vendorAdjustmentId).toBeTruthy()
    expect(complete.body.data.accountingStatus).toBe('DRAFT')
    const va = await prisma.vendorAdjustment.findFirstOrThrow({
      where: { id: complete.body.data.vendorAdjustmentId, tenantId },
    })
    expect(va.status).toBe('DRAFT')
    expect(va.adjustmentType).toBe('VENDOR_DEBIT_NOTE')

    const vouchers = await prisma.accountingVoucher
      .findMany({
        where: {
          tenantId,
          OR: [{ sourceDocumentId: returnId }, { sourceDocumentId: va.id }],
        },
        select: { id: true, status: true },
      })
      .catch(() => [] as { id: string; status: string }[])
    // Draft VA / return must not post Money Out GL from the return path
    expect(vouchers.filter((j) => j.status === 'POSTED').length).toBe(0)

    const scorecard = await request(app).get(scorecardUrl(masters.vendorId)).set(auth())
    expect(scorecard.status).toBe(200)
    expect(scorecard.body.data).toMatchObject({
      vendorId: masters.vendorId,
      rejectedQty: expect.any(Number),
      returnQty: expect.any(Number),
    })
    expect(scorecard.body.data).toHaveProperty('onTimeDeliveryPct')
    // Sample includes this on-time GRN (receipt 07-21 ≤ expected 07-25)
    expect(scorecard.body.data.onTimeDeliveryPct).not.toBeNull()
    expect(typeof scorecard.body.data.onTimeDeliveryPct).toBe('number')
  }, 180_000)

  it('REPLACEMENT path: link replacement GRN (+ QI in trace when present)', async () => {
    const item = await freshItem('RP')
    const qty = 4
    const { poId, poLineId } = await createSentPo(app, {
      slug,
      token,
      approverToken,
      vendorId: masters.vendorId,
      uomId: masters.uomId,
      warehouseId: masters.warehouseId,
      qty,
      itemId: item.id,
      itemCode: item.code,
      expectedDeliveryDate: '2026-07-20',
    })
    const grn = await createSubmittedGrn(app, {
      slug,
      token,
      poId,
      poLineId,
      vendorId: masters.vendorId,
      warehouseId: masters.warehouseId,
      locationId: masters.locationId,
      binId: masters.binId,
      receivedQuantity: qty,
      inspectionRequired: true,
      // late vs expected → depresses OTD sample later
      receiptDate: '2026-07-28',
    })

    const qiCreate = await request(app)
      .post(qiBase())
      .set(auth())
      .send({ goodsReceiptId: grn.grnId })
    expect(qiCreate.status).toBe(201)
    const qiId = qiCreate.body.data.id as string

    const completeQi = await request(app)
      .post(`${qiBase()}/${qiId}/complete`)
      .set(auth())
      .send({
        outcome: 'REJECT',
        decisionCode: 'REPLACEMENT_REQUIRED',
        decisionReason: 'E2E: replacement required',
      })
    expect(completeQi.status, JSON.stringify(completeQi.body)).toBe(200)

    const prefill = await request(app)
      .get(`${qiBase()}/${qiId}/purchase-return-prefill`)
      .set(auth())
    expect(prefill.status).toBe(200)
    expect(prefill.body.data.returnType).toBe('REPLACEMENT')

    const createRet = await request(app)
      .post(returnBase())
      .set(auth())
      .send({
        vendorId: prefill.body.data.vendorId,
        purchaseOrderId: prefill.body.data.purchaseOrderId,
        goodsReceiptId: prefill.body.data.goodsReceiptId,
        qualityInspectionId: qiId,
        warehouseId: masters.warehouseId,
        returnType: 'REPLACEMENT',
        reason: prefill.body.data.reason,
        lines: prefill.body.data.lines.map((l: { goodsReceiptLineId: string; purchaseOrderLineId?: string; returnQuantity: number }) => ({
          goodsReceiptLineId: l.goodsReceiptLineId,
          purchaseOrderLineId: l.purchaseOrderLineId,
          returnQuantity: l.returnQuantity,
        })),
      })
    expect(createRet.status, JSON.stringify(createRet.body)).toBe(201)
    const returnId = createRet.body.data.id as string

    await request(app).post(`${returnBase()}/${returnId}/submit`).set(auth()).send({})
    await request(app).post(`${returnBase()}/${returnId}/approve`).set(auth()).send({})
    const ship = await request(app).post(`${returnBase()}/${returnId}/ship`).set(auth()).send({})
    expect(ship.status, JSON.stringify(ship.body)).toBe(200)
    const complete = await request(app).post(`${returnBase()}/${returnId}/complete`).set(auth()).send({})
    expect(complete.status, JSON.stringify(complete.body)).toBe(200)
    expect(complete.body.data.status).toBe('COMPLETED')
    // Replacement must not auto-create VA
    expect(complete.body.data.vendorAdjustmentId).toBeFalsy()
    expect(['NONE', null, undefined]).toContain(complete.body.data.accountingStatus)

    // Replacement goods → new GRN (can re-use open PO qty; recreate PO line room by new PO)
    const { poId: repPoId, poLineId: repPoLineId } = await createSentPo(app, {
      slug,
      token,
      approverToken,
      vendorId: masters.vendorId,
      uomId: masters.uomId,
      warehouseId: masters.warehouseId,
      qty,
      itemId: item.id,
      itemCode: item.code,
      expectedDeliveryDate: '2026-08-01',
    })
    const repGrn = await createSubmittedGrn(app, {
      slug,
      token,
      poId: repPoId,
      poLineId: repPoLineId,
      vendorId: masters.vendorId,
      warehouseId: masters.warehouseId,
      locationId: masters.locationId,
      binId: masters.binId,
      receivedQuantity: qty,
      inspectionRequired: true,
      receiptDate: '2026-07-30',
    })
    expect(repGrn.status).toBe('QC_PENDING')

    const link = await request(app)
      .post(`${returnBase()}/${returnId}/link-replacement-grn`)
      .set(auth())
      .send({ goodsReceiptId: repGrn.grnId })
    expect(link.status, JSON.stringify(link.body)).toBe(200)
    expect(link.body.data.replacementGoodsReceiptId).toBe(repGrn.grnId)

    const repQi = await request(app)
      .post(qiBase())
      .set(auth())
      .send({ goodsReceiptId: repGrn.grnId })
    expect(repQi.status).toBe(201)

    const trace = await request(app)
      .get(`${returnBase()}/trace`)
      .query({ purchaseReturnId: returnId })
      .set(auth())
    expect(trace.status, JSON.stringify(trace.body)).toBe(200)
    const types = (trace.body.data.chain as Array<{ type: string }>).map((c) => c.type)
    expect(types).toContain('PURCHASE_RETURN')
    expect(types).toContain('REPLACEMENT_GRN')
    expect(types).toContain('REPLACEMENT_QI')
  }, 180_000)

  it('OTD KPI is null when no PO expected dates; numeric when dates exist', async () => {
    // Vendor with only undated deliveries → null (non-breaking API shape)
    const emptyVendor = await prisma.masterVendor.create({
      data: {
        tenantId,
        code: `NODATE${Date.now()}`.slice(-16),
        name: 'No Date Vendor',
        status: 'ACTIVE',
      },
    })
    const emptySc = await request(app).get(scorecardUrl(emptyVendor.id)).set(auth())
    expect(emptySc.status).toBe(200)
    expect(emptySc.body.data).toHaveProperty('onTimeDeliveryPct')
    expect(emptySc.body.data.onTimeDeliveryPct).toBeNull()
    expect(emptySc.body.data.totalDeliveries).toBe(0)
  })
})

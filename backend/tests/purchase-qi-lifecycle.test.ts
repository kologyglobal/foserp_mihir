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
  ensurePermissions,
  FULL_PURCHASE_PERMS,
  seedPurchaseMasters,
  type PurchaseMasterIds,
} from './helpers/purchase-live-fixture.js'

/**
 * Purchase Quality Inspection — live DB integration.
 * Create QI from GRN (QC_PENDING) → complete → tenant isolation + RBAC.
 */
const app = createApp()

describe.skipIf(!dbAvailable)('Purchase quality inspection lifecycle (live HTTP)', () => {
  let tenantId = ''
  let slug = ''
  let token = ''
  let approverToken = ''
  let viewerToken = ''
  let otherSlug = ''
  let otherToken = ''
  let otherTenantId = ''
  let masters: PurchaseMasterIds

  const qiBase = (s = slug) => `/api/v1/t/${s}/purchase/quality-inspections`
  const auth = (t = token) => ({ Authorization: `Bearer ${t}` })

  async function freshQcPendingGrn() {
    const suffix = `${Date.now()}${Math.floor(Math.random() * 1000)}`
    const item = await prisma.masterItem.create({
      data: {
        tenantId,
        code: `QI${suffix}`.slice(-24),
        name: 'QI Live Item',
        categoryId: (
          await prisma.masterItemCategory.findFirstOrThrow({ where: { tenantId, deletedAt: null } })
        ).id,
        baseUomId: masters.uomId,
        itemType: 'raw_material',
        isPurchasable: true,
        isStockable: true,
        status: 'ACTIVE',
      },
    })
    const { poId, poLineId } = await createSentPo(app, {
      slug,
      token,
      approverToken,
      vendorId: masters.vendorId,
      uomId: masters.uomId,
      warehouseId: masters.warehouseId,
      qty: 10,
      itemId: item.id,
      itemCode: item.code,
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
      receivedQuantity: 10,
      inspectionRequired: true,
    })
    return { ...grn, itemId: item.id }
  }

  beforeAll(async () => {
    await ensurePermissions()
    const main = await createTenantUser({
      app,
      slugPrefix: 'qi-life',
      permissionNames: FULL_PURCHASE_PERMS,
    })
    tenantId = main.tenantId
    slug = main.slug
    token = main.token

    const approver = await createTenantUser({
      app,
      slugPrefix: 'qi-appr',
      permissionNames: FULL_PURCHASE_PERMS,
      tenantId,
    })
    approverToken = approver.token

    const viewer = await createTenantUser({
      app,
      slugPrefix: 'qi-view',
      permissionNames: ['purchase.qi.view'],
      tenantId,
    })
    viewerToken = viewer.token

    const other = await createTenantUser({
      app,
      slugPrefix: 'qi-other',
      permissionNames: FULL_PURCHASE_PERMS,
    })
    otherSlug = other.slug
    otherToken = other.token
    otherTenantId = other.tenantId

    masters = await seedPurchaseMasters(tenantId)
  }, 180_000)

  afterAll(async () => {
    if (tenantId) await cleanupPurchaseTenant(tenantId)
    if (otherTenantId) await cleanupPurchaseTenant(otherTenantId)
  }, 120_000)

  it('creates a QI from a QC_PENDING GRN', async () => {
    const grn = await freshQcPendingGrn()
    expect(grn.status).toBe('QC_PENDING')
    const grnLine = await prisma.goodsReceiptLine.findFirstOrThrow({
      where: { id: grn.grnLineId, tenantId },
    })
    expect(grnLine.itemId).toBe(grn.itemId)
    const held = await prisma.inventoryStockBalance.findFirstOrThrow({
      where: { tenantId, itemId: grn.itemId, warehouseId: masters.warehouseId },
    })
    expect(held.onHandQty.toString()).toBe('10')
    expect(held.qcHoldQty.toString()).toBe('10')

    const res = await request(app)
      .post(qiBase())
      .set(auth())
      .send({ goodsReceiptId: grn.grnId })
    expect(res.status).toBe(201)
    expect(res.body.data.status).toBe('DRAFT')
    expect(res.body.data.inspectionNumber).toMatch(/^QI-/)
    expect(res.body.data.lines.length).toBeGreaterThan(0)
    const row = await prisma.purchaseQualityInspection.findFirst({
      where: { id: res.body.data.id, tenantId },
    })
    expect(row?.goodsReceiptId).toBe(grn.grnId)
  })

  it('completes a QI with ACCEPT outcome', async () => {
    const grn = await freshQcPendingGrn()
    const created = await request(app)
      .post(qiBase())
      .set(auth())
      .send({ goodsReceiptId: grn.grnId })
    expect(created.status).toBe(201)
    const qiId = created.body.data.id as string

    const complete = await request(app)
      .post(`${qiBase()}/${qiId}/complete`)
      .set(auth())
      .send({ outcome: 'ACCEPT', decisionReason: 'Accepted per incoming inspection checklist.' })
    expect(complete.status).toBe(200)
    expect(complete.body.data.status).toBe('ACCEPTED')

    const grnRow = await prisma.goodsReceipt.findFirst({
      where: { id: grn.grnId, tenantId },
    })
    expect(grnRow?.status).toBe('INVENTORY_POSTED')
    const released = await prisma.inventoryStockBalance.findFirstOrThrow({
      where: { tenantId, itemId: grn.itemId, warehouseId: masters.warehouseId },
    })
    expect(released.onHandQty.toString()).toBe('10')
    expect(released.qcHoldQty.toString()).toBe('0')
    expect(released.rejectedQty.toString()).toBe('0')

    const releaseMoves = await prisma.inventoryStockMovement.findMany({
      where: {
        tenantId,
        idempotencyKey: { startsWith: `qi-release:${qiId}` },
      },
    })
    expect(releaseMoves.length).toBeGreaterThan(0)
  })

  it('persists parameter checklist on create and update', async () => {
    const grn = await freshQcPendingGrn()
    const created = await request(app)
      .post(qiBase())
      .set(auth())
      .send({ goodsReceiptId: grn.grnId })
    expect(created.status).toBe(201)
    const qiId = created.body.data.id as string
    expect(created.body.data.inspectionPlan).toMatch(/Incoming inspection/)
    expect(created.body.data.parameters).toHaveLength(2)
    expect(created.body.data.parameters[0].parameter).toBe('Visual / dimensions')
    expect(created.body.data.parameters[0].result).toBe('na')

    const patched = await request(app)
      .patch(`${qiBase()}/${qiId}`)
      .set(auth())
      .send({
        inspectionPlan: 'Incoming plate — thickness / surface',
        parameters: [
          {
            parameter: 'Thickness',
            specification: '10 ± 0.5 mm',
            minValue: 9.5,
            maxValue: 10.5,
            observedValue: 10.1,
            unit: 'mm',
            result: 'pass',
            remarks: 'OK',
          },
          {
            parameter: 'Surface condition',
            specification: 'No rust / pits',
            observedValue: null,
            unit: '',
            result: 'fail',
            remarks: 'Light rust on edge',
          },
        ],
      })
    expect(patched.status).toBe(200)
    expect(patched.body.data.inspectionPlan).toBe('Incoming plate — thickness / surface')
    expect(patched.body.data.parameters).toHaveLength(2)
    expect(patched.body.data.parameters[0]).toMatchObject({
      parameter: 'Thickness',
      observedValue: 10.1,
      result: 'pass',
    })
    expect(patched.body.data.parameters[1]).toMatchObject({
      parameter: 'Surface condition',
      result: 'fail',
    })

    const get = await request(app).get(`${qiBase()}/${qiId}`).set(auth())
    expect(get.status).toBe(200)
    expect(get.body.data.parameters).toHaveLength(2)
    expect(get.body.data.parameters[0].specification).toBe('10 ± 0.5 mm')

    const rows = await prisma.purchaseQualityInspectionParameter.findMany({
      where: { tenantId, qualityInspectionId: qiId },
      orderBy: { lineNumber: 'asc' },
    })
    expect(rows).toHaveLength(2)
    expect(rows[0].parameterName).toBe('Thickness')
    expect(Number(rows[0].observedValue)).toBeCloseTo(10.1)
    expect(rows[1].result).toBe('fail')
  })

  it('allows checklist edit after hold (DEVIATION_PENDING)', async () => {
    const grn = await freshQcPendingGrn()
    const created = await request(app)
      .post(qiBase())
      .set(auth())
      .send({ goodsReceiptId: grn.grnId })
    expect(created.status).toBe(201)
    const qiId = created.body.data.id as string

    const held = await request(app)
      .post(`${qiBase()}/${qiId}/hold`)
      .set(auth())
      .send({ remarks: 'Awaiting mill TC' })
    expect(held.status).toBe(200)
    expect(held.body.data.status).toBe('DEVIATION_PENDING')

    const patched = await request(app)
      .patch(`${qiBase()}/${qiId}`)
      .set(auth())
      .send({
        parameters: [
          {
            parameter: 'Documentation',
            specification: 'TC / COA present',
            result: 'pass',
            remarks: 'TC received',
          },
        ],
      })
    expect(patched.status).toBe(200)
    expect(patched.body.data.parameters).toHaveLength(1)
    expect(patched.body.data.parameters[0].result).toBe('pass')
  })

  it('denies create without permission', async () => {
    const grn = await freshQcPendingGrn()
    const res = await request(app)
      .post(qiBase())
      .set(auth(viewerToken))
      .send({ goodsReceiptId: grn.grnId })
    expect(res.status).toBe(403)
  })

  it('enforces tenant isolation on GET', async () => {
    const grn = await freshQcPendingGrn()
    const created = await request(app)
      .post(qiBase())
      .set(auth())
      .send({ goodsReceiptId: grn.grnId })
    expect(created.status).toBe(201)
    const other = await request(app)
      .get(`${qiBase(otherSlug)}/${created.body.data.id}`)
      .set({ Authorization: `Bearer ${otherToken}` })
    expect(other.status).toBe(404)
  })
})

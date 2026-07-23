/**
 * Proof of Delivery — no stock movement; IN_TRANSIT after CONFIRMED shell + capture DELIVERED.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { randomUUID } from 'node:crypto'
import request from 'supertest'
import { createApp } from '../src/app.js'
import { prisma } from '../src/config/database.js'
import type { PermissionName } from '../src/constants/permissions.js'
import {
  cleanupTenant,
  createManufacturingAdminTenant,
  createUserWithPerms,
  ensurePermissions,
} from './manufacturing/helpers/manufacturing-fixture.js'
import { ensurePodInTransitAfterPost } from '../src/modules/dispatch/pod/dispatch-pod.service.js'

const app = createApp()
const dbAvailable = await prisma.$queryRaw`SELECT 1`.then(() => true).catch(() => false)

const PERMS = [
  'dispatch.view',
  'dispatch.post',
  'dispatch.pod.view',
  'dispatch.pod.record',
] as PermissionName[]

describe.skipIf(!dbAvailable)('Dispatch POD — Proof of Delivery', () => {
  let tenantId: string
  let slug: string
  let token: string
  let outboundId: string
  let lineId: string
  let itemId: string
  let warehouseId: string

  beforeAll(async () => {
    await ensurePermissions()
    const tenant = await createManufacturingAdminTenant(app, 'pod')
    tenantId = tenant.tenantId
    slug = tenant.slug
    const user = await createUserWithPerms(app, tenantId, slug, PERMS, 'pod-user')
    token = user.token

    const uom = await prisma.masterUom.create({
      data: {
        tenantId,
        code: `EA${Date.now()}`.slice(-16),
        name: 'Each',
        uomType: 'integer',
        isBaseUnit: true,
      },
    })
    const wh = await prisma.masterWarehouse.create({
      data: { tenantId, code: `FG${Date.now()}`.slice(-16), name: 'FG POD' },
    })
    warehouseId = wh.id
    const cat = await prisma.masterItemCategory.create({
      data: { tenantId, code: `C${Date.now()}`.slice(-16), name: 'POD Cat' },
    })
    const item = await prisma.masterItem.create({
      data: {
        tenantId,
        code: `IT${Date.now()}`.slice(-24),
        name: 'POD Tank',
        categoryId: cat.id,
        baseUomId: uom.id,
        itemType: 'finished_good',
        status: 'ACTIVE',
      },
    })
    itemId = item.id

    outboundId = randomUUID()
    lineId = randomUUID()
    await prisma.outboundDispatch.create({
      data: {
        id: outboundId,
        tenantId,
        dispatchNo: `OB-POD-${Date.now()}`,
        status: 'CONFIRMED',
        confirmedAt: new Date(),
        shipToAddress: 'Customer Gate',
        lines: {
          create: {
            id: lineId,
            tenantId,
            lineNo: 1,
            itemId,
            warehouseId,
            quantity: 2,
          },
        },
      },
    })
  }, 120_000)

  afterAll(async () => {
    if (!tenantId) return
    await prisma.dispatchPodAttachment?.deleteMany({ where: { tenantId } }).catch(() => {})
    await prisma.dispatchPodLine?.deleteMany({ where: { tenantId } }).catch(() => {})
    await prisma.dispatchProofOfDelivery?.deleteMany({ where: { tenantId } }).catch(() => {})
    await prisma.outboundDispatchLine.deleteMany({ where: { tenantId } }).catch(() => {})
    await prisma.outboundDispatch.deleteMany({ where: { tenantId } }).catch(() => {})
    await prisma.masterItem.deleteMany({ where: { tenantId } }).catch(() => {})
    await prisma.masterItemCategory.deleteMany({ where: { tenantId } }).catch(() => {})
    await prisma.masterWarehouse.deleteMany({ where: { tenantId } }).catch(() => {})
    await prisma.masterUom.deleteMany({ where: { tenantId } }).catch(() => {})
    await cleanupTenant(tenantId).catch(() => {})
  })

  it('creates IN_TRANSIT POD without inventory movements', async () => {
    const movesBefore = await prisma.inventoryStockMovement.count({ where: { tenantId } })
    await ensurePodInTransitAfterPost(tenantId, outboundId, null)
    const movesAfter = await prisma.inventoryStockMovement.count({ where: { tenantId } })
    expect(movesAfter).toBe(movesBefore)

    const pod = await prisma.dispatchProofOfDelivery.findFirst({
      where: { tenantId, outboundDispatchId: outboundId },
      include: { lines: true },
    })
    expect(pod?.status).toBe('IN_TRANSIT')
    expect(pod?.lines.length).toBe(1)
    expect(Number(pod?.lines[0]?.dispatchedQty)).toBe(2)

    const ob = await prisma.outboundDispatch.findFirstOrThrow({ where: { id: outboundId } })
    expect(ob.status).toBe('CONFIRMED')
    expect(ob.deliveryStatus).toBe('IN_TRANSIT')
  })

  it('captures DELIVERED via API and stays stock-neutral', async () => {
    const movesBefore = await prisma.inventoryStockMovement.count({ where: { tenantId } })
    const res = await request(app)
      .post(`/api/v1/t/${slug}/dispatch/outbound/${outboundId}/pod/capture`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        status: 'DELIVERED',
        receiverName: 'Site Supervisor',
        receiverContact: '9999999999',
        lines: [{ outboundDispatchLineId: lineId, deliveredQty: 2, damagedQty: 0, shortQty: 0 }],
      })
    expect(res.status).toBe(200)
    expect(res.body.data.status).toBe('DELIVERED')
    expect(res.body.data.quantityDelivered).toBe(2)
    expect(res.body.data.receiverName).toBe('Site Supervisor')

    const movesAfter = await prisma.inventoryStockMovement.count({ where: { tenantId } })
    expect(movesAfter).toBe(movesBefore)

    const ob = await prisma.outboundDispatch.findFirstOrThrow({ where: { id: outboundId } })
    expect(ob.status).toBe('CONFIRMED')
    expect(ob.deliveryStatus).toBe('DELIVERED')
  })
})

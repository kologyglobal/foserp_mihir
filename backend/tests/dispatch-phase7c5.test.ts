/**
 * Dispatch Phase 7C5 — hardened posting via DispatchPostingService,
 * policy gates, fulfilment, reverse, readiness, reconciliation.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { randomUUID } from 'node:crypto'
import request from 'supertest'
import { createApp } from '../src/app.js'
import { prisma } from '../src/config/database.js'
import { PERMISSIONS, type PermissionName } from '../src/constants/permissions.js'
import {
  bootstrapManufacturingFixture,
  cleanupTenant,
  createUserWithPerms,
  ensurePermissions,
  type ManufacturingFixture,
} from './manufacturing/helpers/manufacturing-fixture.js'
import { createConfirmedSalesOrderWithLine } from './manufacturing/helpers/production-fixture.js'

const app = createApp()

const dbAvailable = await prisma
  .$queryRaw`SELECT 1`
  .then(() => true)
  .catch(() => false)

const DISPATCH_PERMS = PERMISSIONS.filter(
  (p) =>
    p.startsWith('dispatch.') ||
    p.startsWith('inventory.') ||
    p.startsWith('crm.sales_order.') ||
    p.startsWith('crm.company.') ||
    p.startsWith('master.'),
) as PermissionName[]

function dsp(slug: string) {
  return `/api/v1/t/${slug}/dispatch`
}
function crm(slug: string) {
  return `/api/v1/t/${slug}/crm`
}
function inv(slug: string) {
  return `/api/v1/t/${slug}/inventory`
}

async function cleanupDispatchTenant(tenantId: string): Promise<void> {
  await prisma.dispatchDomainEvent.deleteMany({ where: { tenantId } }).catch(() => {})
  await prisma.dispatchReversalLine.deleteMany({ where: { tenantId } }).catch(() => {})
  await prisma.dispatchReversal.deleteMany({ where: { tenantId } }).catch(() => {})
  await prisma.dispatchPostingLine.deleteMany({ where: { tenantId } }).catch(() => {})
  await prisma.dispatchPosting.deleteMany({ where: { tenantId } }).catch(() => {})
  await prisma.inventoryAccountingEvent.deleteMany({ where: { tenantId } }).catch(() => {})
  await prisma.salesInvoiceSourceLink.deleteMany({ where: { tenantId } }).catch(() => {})
  await prisma.salesInvoiceLine.deleteMany({ where: { tenantId } }).catch(() => {})
  await prisma.salesInvoice.deleteMany({ where: { tenantId } }).catch(() => {})
  await prisma.deliveryChallanTrackingAllocation.deleteMany({ where: { tenantId } }).catch(() => {})
  await prisma.deliveryChallanPackage.deleteMany({ where: { tenantId } }).catch(() => {})
  await prisma.deliveryChallanLine.deleteMany({ where: { tenantId } }).catch(() => {})
  await prisma.deliveryChallan.deleteMany({ where: { tenantId } }).catch(() => {})
  await prisma.dispatchPackingEvent.deleteMany({ where: { tenantId } }).catch(() => {})
  await prisma.dispatchPackageLine.deleteMany({ where: { tenantId } }).catch(() => {})
  await prisma.dispatchPackage.deleteMany({ where: { tenantId } }).catch(() => {})
  await prisma.dispatchPackingSession.deleteMany({ where: { tenantId } }).catch(() => {})
  await prisma.dispatchPackageType.deleteMany({ where: { tenantId } }).catch(() => {})
  await prisma.dispatchPickEvent.deleteMany({ where: { tenantId } }).catch(() => {})
  await prisma.dispatchPickLine.deleteMany({ where: { tenantId } }).catch(() => {})
  await prisma.dispatchPickList.deleteMany({ where: { tenantId } }).catch(() => {})
  await prisma.dispatchTrackingAllocation.deleteMany({ where: { tenantId } }).catch(() => {})
  await prisma.outboundDispatchLine.deleteMany({ where: { tenantId } }).catch(() => {})
  await prisma.outboundDispatch.deleteMany({ where: { tenantId } }).catch(() => {})
  await prisma.dispatchRequirement.deleteMany({ where: { tenantId } }).catch(() => {})
  await prisma.salesOrderLineFulfilment.deleteMany({ where: { tenantId } }).catch(() => {})
  await prisma.inventoryStockMovement.deleteMany({ where: { tenantId } }).catch(() => {})
  await prisma.inventoryStockReservation.deleteMany({ where: { tenantId } }).catch(() => {})
  await prisma.inventoryStockBalance.deleteMany({ where: { tenantId } }).catch(() => {})
  await prisma.crmSalesOrder.deleteMany({ where: { tenantId } }).catch(() => {})
  await prisma.crmCompany.deleteMany({ where: { tenantId } }).catch(() => {})
  await prisma.accountingPeriod.deleteMany({ where: { tenantId } }).catch(() => {})
  await prisma.financialYear.deleteMany({ where: { tenantId } }).catch(() => {})
  await prisma.legalEntity.deleteMany({ where: { tenantId } }).catch(() => {})
  await prisma.codeSeries
    .deleteMany({
      where: {
        tenantId,
        entityType: {
          in: [
            'STOCK_MOVEMENT',
            'STOCK_RESERVATION',
            'OUTBOUND_DISPATCH',
            'DISPATCH_REQUIREMENT',
            'DISPATCH_PICK_LIST',
            'DISPATCH_PACKING_SESSION',
            'DISPATCH_PACKAGE',
            'DELIVERY_CHALLAN',
            'DISPATCH_POSTING',
            'DISPATCH_REVERSAL',
            'SALES_ORDER',
          ],
        },
      },
    })
    .catch(() => {})
  await cleanupTenant(tenantId).catch(() => {})
}

describe.skipIf(!dbAvailable)('Dispatch Phase 7C5 — hardened posting governance', () => {
  let fx: ManufacturingFixture
  let token: string
  let salesOrderId: string
  let lineId: string
  let requirementId: string
  let fingerprint: string
  let dispatchId: string
  let dispatchLineId: string
  let pickListId: string
  let pickLineId: string
  let packingSessionId: string
  let packageId: string
  let challanId: string

  beforeAll(async () => {
    await ensurePermissions()
    const slug = `dsp-7c5-${Date.now()}-${Math.floor(Math.random() * 1000)}`
    const tenant = await prisma.tenant.create({
      data: { name: 'Dispatch 7C5 Co', slug, email: `${slug}@test.com`, status: 'ACTIVE' },
    })
    const admin = await createUserWithPerms(app, tenant.id, slug, DISPATCH_PERMS, 'dsp7c5-admin')
    fx = await bootstrapManufacturingFixture({
      tenantId: tenant.id,
      slug,
      token: admin.token,
      userId: admin.userId,
    })
    token = admin.token

    await prisma.legalEntity.create({
      data: {
        tenantId: tenant.id,
        code: `LE7C5${Date.now()}`.slice(0, 16),
        legalName: 'Dispatch 7C5 Legal Entity',
        displayName: 'Dispatch 7C5 LE',
        stateCode: '27',
        isDefault: true,
        isActive: true,
      },
    }).then(async (le) => {
      const fy = await prisma.financialYear.create({
        data: {
          tenantId: tenant.id,
          legalEntityId: le.id,
          name: 'FY 2026-27',
          startDate: new Date('2026-04-01'),
          endDate: new Date('2027-03-31'),
          status: 'ACTIVE',
          isCurrent: true,
        },
      })
      await prisma.accountingPeriod.create({
        data: {
          tenantId: tenant.id,
          legalEntityId: le.id,
          financialYearId: fy.id,
          periodNumber: 1,
          name: 'FY span',
          startDate: new Date('2026-04-01'),
          endDate: new Date('2027-03-31'),
          status: 'OPEN',
        },
      })
    })

    const so = await createConfirmedSalesOrderWithLine(app, fx, token, {
      productId: fx.itemId,
      qty: 10,
      unitPrice: 5000,
    })
    salesOrderId = so.salesOrderId
    lineId = so.lineId

    await request(app)
      .post(`${inv(fx.slug)}/movements/opening`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        itemId: fx.itemId,
        warehouseId: fx.warehouseId,
        quantity: 50,
        referenceNo: 'OPN-7C5',
      })

    const sync = await request(app)
      .post(`${dsp(fx.slug)}/requirements/synchronise`)
      .set('Authorization', `Bearer ${token}`)
      .send({ salesOrderId })
    expect(sync.status).toBe(200)

    const list = await request(app)
      .get(`${dsp(fx.slug)}/requirements`)
      .query({ salesOrderId, limit: 20 })
      .set('Authorization', `Bearer ${token}`)
    expect(list.status).toBe(200)
    requirementId = list.body.data[0].id
    fingerprint = list.body.data[0].sourceFingerprint

    const draft = await request(app)
      .post(`${dsp(fx.slug)}/orders/from-requirements`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        requirementIds: [requirementId],
        lines: [{ requirementId, quantity: 3, warehouseId: fx.warehouseId }],
        planBeforeStockAllowed: true,
        sourceFingerprintByRequirement: { [requirementId]: fingerprint },
        idempotencyKey: `7c5-draft-${requirementId}`,
      })
    expect(draft.status).toBe(201)
    expect(draft.body.data.planningSource).toBe('WORKBENCH_7C1')
    dispatchId = draft.body.data.id
    dispatchLineId = draft.body.data.lines[0].id
  }, 180_000)

  afterAll(async () => {
    if (fx?.tenantId) await cleanupDispatchTenant(fx.tenantId)
  })

  function auth(req: request.Test) {
    return req.set('Authorization', `Bearer ${token}`)
  }

  async function onHandQty(): Promise<number> {
    const bal = await prisma.inventoryStockBalance.findFirst({
      where: { tenantId: fx.tenantId, itemId: fx.itemId, warehouseId: fx.warehouseId },
    })
    return Number(bal?.onHandQty ?? 0)
  }

  it('blocks post without reservation / pick / pack / challan', async () => {
    const res = await auth(request(app).post(`${dsp(fx.slug)}/outbound/${dispatchId}/post`))
    expect(res.status).toBe(409)
    expect(String(res.body.message ?? res.body.error ?? '')).toMatch(/reserv|pick|pack|challan|post/i)
  })

  it('confirm on WORKBENCH is also gated when hardened flag default ON', async () => {
    const res = await auth(request(app).post(`${dsp(fx.slug)}/outbound/${dispatchId}/confirm`))
    expect(res.status).toBe(409)
  })

  it('posting-readiness reports blockers and denies POST', async () => {
    const res = await auth(request(app).get(`${dsp(fx.slug)}/outbound/${dispatchId}/posting-readiness`))
    expect(res.status).toBe(200)
    expect(res.body.data.gates.posting.ready).toBe(false)
    expect(res.body.data.hardBlockers.length).toBeGreaterThan(0)
    expect(res.body.data.allowedActions).not.toContain('POST')
  })

  it('happy path: reserve → pick → pack → issue challan → post', async () => {
    await auth(
      request(app)
        .post(`${dsp(fx.slug)}/orders/${dispatchId}/reservations`)
        .send({
          lines: [{ outboundDispatchLineId: dispatchLineId, quantity: 3 }],
          idempotencyKey: `7c5-res-${dispatchId}`,
        }),
    )

    const stillBlocked = await auth(request(app).post(`${dsp(fx.slug)}/outbound/${dispatchId}/post`))
    expect(stillBlocked.status).toBe(409)

    const pickLists = await auth(
      request(app)
        .post(`${dsp(fx.slug)}/orders/${dispatchId}/pick-lists`)
        .send({ idempotencyKey: `7c5-pkl-${dispatchId}` }),
    )
    expect(pickLists.status).toBe(201)
    pickListId = pickLists.body.data[0].id
    pickLineId = pickLists.body.data[0].lines[0].id

    await auth(request(app).post(`${dsp(fx.slug)}/pick-lists/${pickListId}/release`))
    await auth(request(app).post(`${dsp(fx.slug)}/pick-lists/${pickListId}/start`))
    await auth(
      request(app)
        .post(`${dsp(fx.slug)}/pick-lists/${pickListId}/pick`)
        .send({ pickLineId, quantity: 3, idempotencyKey: `7c5-pick-${pickLineId}` }),
    )
    await auth(request(app).post(`${dsp(fx.slug)}/pick-lists/${pickListId}/complete`))

    const sessions = await auth(
      request(app)
        .post(`${dsp(fx.slug)}/orders/${dispatchId}/packing-sessions`)
        .send({ idempotencyKey: `7c5-pack-sess-${dispatchId}` }),
    )
    packingSessionId = sessions.body.data[0].id
    await auth(request(app).post(`${dsp(fx.slug)}/packing-sessions/${packingSessionId}/start`))
    const pkg = await auth(
      request(app)
        .post(`${dsp(fx.slug)}/packing-sessions/${packingSessionId}/packages`)
        .send({ packageReference: 'BOX-7C5' }),
    )
    packageId = pkg.body.data.id
    await auth(
      request(app)
        .post(`${dsp(fx.slug)}/packages/${packageId}/pack`)
        .send({ pickLineId, quantity: 3, idempotencyKey: `7c5-pack-${packageId}` }),
    )
    await auth(request(app).post(`${dsp(fx.slug)}/packing-sessions/${packingSessionId}/complete`))
    await auth(request(app).post(`${dsp(fx.slug)}/packing-sessions/${packingSessionId}/verify`))

    const challan = await auth(
      request(app)
        .post(`${dsp(fx.slug)}/orders/${dispatchId}/delivery-challans`)
        .send({ idempotencyKey: `7c5-dc-${dispatchId}` }),
    )
    expect(challan.status).toBe(201)
    challanId = challan.body.data.id

    const draftBlock = await auth(request(app).post(`${dsp(fx.slug)}/outbound/${dispatchId}/post`))
    expect(draftBlock.status).toBe(409)

    await auth(request(app).post(`${dsp(fx.slug)}/delivery-challans/${challanId}/ready-for-review`))
    await auth(request(app).post(`${dsp(fx.slug)}/delivery-challans/${challanId}/approve`))
    const issued = await auth(
      request(app)
        .post(`${dsp(fx.slug)}/delivery-challans/${challanId}/issue`)
        .send({ idempotencyKey: `7c5-issue-${challanId}` }),
    )
    expect(issued.status).toBe(200)
    expect(issued.body.data.status).toBe('ISSUED')

    // Issue must not move stock
    const movementsBefore = await prisma.inventoryStockMovement.count({
      where: { tenantId: fx.tenantId, referenceType: 'FG_DISPATCH', movementType: 'ISSUE' },
    })
    expect(movementsBefore).toBe(0)

    const ready = await auth(request(app).get(`${dsp(fx.slug)}/outbound/${dispatchId}/posting-readiness`))
    expect(ready.status).toBe(200)
    expect(ready.body.data.gates.posting.ready).toBe(true)
    expect(ready.body.data.allowedActions).toContain('POST')

    const before = await onHandQty()
    const post = await auth(request(app).post(`${dsp(fx.slug)}/outbound/${dispatchId}/post`))
    expect(post.status).toBe(200)
    expect(post.body.data.status).toBe('CONFIRMED')
    expect(await onHandQty()).toBe(before - 3)

    const fulfil = await auth(request(app).get(`${crm(fx.slug)}/sales-orders/${salesOrderId}/fulfilment`))
    expect(fulfil.status).toBe(200)
    expect(fulfil.body.data.lines[0].dispatchedQty).toBe(3)

    const issues = await prisma.inventoryStockMovement.count({
      where: { tenantId: fx.tenantId, referenceType: 'FG_DISPATCH', movementType: 'ISSUE' },
    })
    expect(issues).toBe(1)

    const posting = await prisma.dispatchPosting.findFirst({
      where: { tenantId: fx.tenantId, outboundDispatchId: dispatchId },
      include: { lines: true },
    })
    expect(posting).toBeTruthy()
    expect(posting!.status).toBe('POSTED')
    expect(posting!.postingNumber).toMatch(/^DPO-/)
    expect(posting!.lines.length).toBe(1)
    expect(posting!.lines[0]!.inventoryMovementId).toBeTruthy()

    // Auto DRAFT SI from DISPATCH_POSTED / INVOICE_READY outbox (flag ON outside production).
    const { createDraftSalesInvoiceFromDispatchPosting } = await import(
      '../src/modules/dispatch/posting/dispatch-auto-sales-invoice.service.js'
    )
    const created = await createDraftSalesInvoiceFromDispatchPosting(fx.tenantId, posting!.id)
    expect(['created', 'existing']).toContain(created.status)
    const autoSi = await prisma.salesInvoice.findFirst({
      where: {
        tenantId: fx.tenantId,
        sourceType: 'OUTBOUND_DISPATCH',
        sourceDocumentId: dispatchId,
        status: 'DRAFT',
      },
      include: { lines: true, sourceLinks: true },
    })
    expect(autoSi).toBeTruthy()
    expect(autoSi!.invoiceNumber).toBeNull()
    expect(Number(autoSi!.lines[0]?.quantity ?? 0)).toBe(3)
    expect(autoSi!.sourceLinks?.some((l) => l.sourceType === 'OUTBOUND_DISPATCH')).toBe(true)
    const snap = autoSi!.sourceDocumentSnapshot as { autoFromDispatchPostingId?: string } | null
    expect(snap?.autoFromDispatchPostingId).toBe(posting!.id)

    const again = await createDraftSalesInvoiceFromDispatchPosting(fx.tenantId, posting!.id)
    expect(again.status).toBe('existing')
    expect(again.status === 'existing' && again.salesInvoiceId).toBe(autoSi!.id)
  }, 180_000)

  it('idempotent re-post returns confirmed without duplicate stock move', async () => {
    const before = await onHandQty()
    const again = await auth(request(app).post(`${dsp(fx.slug)}/outbound/${dispatchId}/post`))
    expect(again.status).toBe(200)
    expect(again.body.data.status).toBe('CONFIRMED')
    expect(await onHandQty()).toBe(before)
    const issues = await prisma.inventoryStockMovement.count({
      where: { tenantId: fx.tenantId, referenceType: 'FG_DISPATCH', movementType: 'ISSUE' },
    })
    expect(issues).toBe(1)
  })

  it('reverse restores stock and reduces fulfilment; original posting immutable', async () => {
    // Happy path may have created a DRAFT SI linked to this outbound — release for reverse UAT.
    await prisma.salesInvoiceSourceLink.updateMany({
      where: { tenantId: fx.tenantId, sourceDocumentId: dispatchId, status: 'ACTIVE' },
      data: { status: 'RELEASED' },
    })
    await prisma.salesInvoice.updateMany({
      where: { tenantId: fx.tenantId, sourceDocumentId: dispatchId, status: 'DRAFT' },
      data: { status: 'CANCELLED' },
    })
    const before = await onHandQty()
    const lineBefore = await prisma.outboundDispatchLine.findFirst({
      where: { id: dispatchLineId, tenantId: fx.tenantId },
    })
    expect(lineBefore?.inventoryMovementId).toBeTruthy()

    const rev = await auth(
      request(app)
        .post(`${dsp(fx.slug)}/outbound/${dispatchId}/reverse`)
        .send({ reason: '7C5 UAT reverse' }),
    )
    expect(rev.status).toBe(200)
    expect(rev.body.data.awaitingApproval).toBe(false)
    expect(rev.body.data.reversal?.status).toBe('APPLIED')
    expect(rev.body.data.outbound?.status).toBe('REVERSED')
    expect(await onHandQty()).toBe(before + 3)

    const lineAfter = await prisma.outboundDispatchLine.findFirst({
      where: { id: dispatchLineId, tenantId: fx.tenantId },
    })
    expect(lineAfter?.inventoryMovementId).toBe(lineBefore?.inventoryMovementId)
    expect(lineAfter?.reverseInventoryMovementId).toBeTruthy()

    const posting = await prisma.dispatchPosting.findFirst({
      where: { tenantId: fx.tenantId, outboundDispatchId: dispatchId },
    })
    expect(posting?.status).toBe('REVERSED')
    const reversalRow = await prisma.dispatchReversal.findFirst({
      where: { tenantId: fx.tenantId, outboundDispatchId: dispatchId, status: 'APPLIED' },
      include: { lines: true },
    })
    expect(reversalRow).toBeTruthy()
    expect(reversalRow!.reversalNumber).toMatch(/^DRV-/)
    expect(reversalRow!.lines.length).toBe(1)

    const revEvents = await prisma.dispatchDomainEvent.findMany({
      where: { tenantId: fx.tenantId, eventType: 'DISPATCH_REVERSED' },
    })
    expect(revEvents.length).toBeGreaterThanOrEqual(1)
    expect(revEvents.every((e) => e.status === 'PUBLISHED')).toBe(true)

    const fulfil = await auth(request(app).get(`${crm(fx.slug)}/sales-orders/${salesOrderId}/fulfilment`))
    expect(fulfil.body.data.lines[0].dispatchedQty).toBe(0)

    const position = await auth(
      request(app).get(`${crm(fx.slug)}/sales-orders/${salesOrderId}/fulfilment-summary`),
    )
    if (position.status === 200 && position.body.data?.lines?.[0]?.reversedDispatchQty != null) {
      expect(position.body.data.lines[0].reversedDispatchQty).toBeGreaterThanOrEqual(3)
    }
  })

  it('reconciliation scans without unexplained missing movements on reversed doc', async () => {
    const res = await auth(request(app).get(`${dsp(fx.slug)}/reconciliation`).query({ salesOrderId }))
    expect(res.status).toBe(200)
    expect(res.body.data.scanned).toBeGreaterThanOrEqual(1)
    const missing = (res.body.data.exceptions as Array<{ code: string }>).filter(
      (e) => e.code === 'MISSING_INVENTORY_MOVEMENT',
    )
    expect(missing.length).toBe(0)
  })

  it('BASIC_7C0 confirm still works without pick/pack when no challan (legacy soft)', async () => {
    const draft = await auth(
      request(app)
        .post(`${dsp(fx.slug)}/outbound`)
        .send({
          salesOrderId,
          lines: [{ itemId: fx.itemId, warehouseId: fx.warehouseId, quantity: 1, salesOrderLineId: lineId }],
        }),
    )
    expect(draft.status).toBe(201)
    expect(draft.body.data.planningSource).toBe('BASIC_7C0')
    const id = draft.body.data.id as string
    const before = await onHandQty()
    const confirm = await auth(request(app).post(`${dsp(fx.slug)}/outbound/${id}/confirm`))
    expect(confirm.status).toBe(200)
    expect(await onHandQty()).toBe(before - 1)

    const posting = await prisma.dispatchPosting.findFirst({
      where: { tenantId: fx.tenantId, outboundDispatchId: id },
    })
    expect(posting?.status).toBe('LEGACY_POSTED')
    expect(posting?.mode).toBe('confirm')
  })

  it('partial line reverse + approval workflow (request → submit → approve → apply)', async () => {
    const draft = await auth(
      request(app)
        .post(`${dsp(fx.slug)}/outbound`)
        .send({
          salesOrderId,
          lines: [{ itemId: fx.itemId, warehouseId: fx.warehouseId, quantity: 4, salesOrderLineId: lineId }],
        }),
    )
    expect(draft.status).toBe(201)
    const obId = draft.body.data.id as string
    const obLineId = draft.body.data.lines[0].id as string
    const confirmed = await auth(request(app).post(`${dsp(fx.slug)}/outbound/${obId}/confirm`))
    expect(confirmed.status).toBe(200)

    const stockBefore = await onHandQty()

    // Over-reversal blocked at request
    const over = await auth(
      request(app)
        .post(`${dsp(fx.slug)}/outbound/${obId}/reversals`)
        .send({
          reason: 'too much',
          lines: [{ outboundDispatchLineId: obLineId, quantity: 99 }],
        }),
    )
    expect(over.status).toBe(409)

    // Request-only partial reverse (qty 1 of 4)
      const reqOnly = await auth(
      request(app)
        .post(`${dsp(fx.slug)}/outbound/${obId}/reverse`)
        .send({
          reason: 'partial UAT',
          requestOnly: true,
          lines: [{ outboundDispatchLineId: obLineId, quantity: 1 }],
        }),
    )
    if (reqOnly.status !== 200) {
      // eslint-disable-next-line no-console
      console.error('approval workflow requestOnly failed', reqOnly.status, reqOnly.body)
    }
    expect(reqOnly.status).toBe(200)
    expect(reqOnly.body.data.awaitingApproval).toBe(true)
    expect(reqOnly.body.data.reversal.status).toBe('SUBMITTED')
    expect(await onHandQty()).toBe(stockBefore)

    const reversalId = reqOnly.body.data.reversal.id as string

    const approved = await auth(request(app).post(`${dsp(fx.slug)}/reversals/${reversalId}/approve`))
    expect(approved.status).toBe(200)
    expect(approved.body.data.status).toBe('APPROVED')

    const applied = await auth(request(app).post(`${dsp(fx.slug)}/reversals/${reversalId}/apply`))
    expect(applied.status).toBe(200)
    expect(applied.body.data.status).toBe('APPLIED')
    expect(await onHandQty()).toBe(stockBefore + 1)

    const posting = await prisma.dispatchPosting.findFirst({
      where: { tenantId: fx.tenantId, outboundDispatchId: obId },
      include: { lines: true },
    })
    expect(posting?.status).toBe('PARTIALLY_REVERSED')
    expect(Number(posting?.lines[0]?.reversedQuantity ?? 0)).toBe(1)

    const outbound = await prisma.outboundDispatch.findFirst({
      where: { id: obId, tenantId: fx.tenantId },
    })
    expect(outbound?.status).toBe('CONFIRMED')

    // Remaining qty can still reverse to completion
    const rest = await auth(
      request(app)
        .post(`${dsp(fx.slug)}/outbound/${obId}/reverse`)
        .send({ reason: 'finish reverse', lines: [{ outboundDispatchLineId: obLineId, quantity: 3 }] }),
    )
    expect(rest.status).toBe(200)
    expect(rest.body.data.awaitingApproval).toBe(false)
    expect(rest.body.data.outbound?.status).toBe('REVERSED')
    expect(await onHandQty()).toBe(stockBefore + 4)
  }, 120_000)

  it('emits DISPATCH_POSTED + invoice-ready outbox events on hardened post', async () => {
    const events = await prisma.dispatchDomainEvent.findMany({
      where: {
        tenantId: fx.tenantId,
        eventType: { in: ['DISPATCH_POSTED', 'SALES_ORDER_INVOICE_READY', 'SALES_ORDER_DISPATCH_FULFILMENT_CHANGED'] },
      },
    })
    expect(events.some((e) => e.eventType === 'DISPATCH_POSTED')).toBe(true)
    expect(events.some((e) => e.eventType === 'SALES_ORDER_INVOICE_READY')).toBe(true)
    expect(events.some((e) => e.eventType === 'SALES_ORDER_DISPATCH_FULFILMENT_CHANGED')).toBe(true)
    // Post-commit drain publishes handlers (signal-only — no auto invoice).
    expect(events.every((e) => e.status === 'PUBLISHED')).toBe(true)
    expect(events.every((e) => e.publishedAt != null)).toBe(true)

    const listed = await auth(
      request(app).get(`${dsp(fx.slug)}/domain-events`).query({ eventType: 'DISPATCH_POSTED', limit: 5 }),
    )
    expect(listed.status).toBe(200)
    expect(listed.body.data.length).toBeGreaterThanOrEqual(1)
  })

  async function prepareWorkbenchReady(
    qty: number,
    key: string,
    options?: {
      post?: boolean
      pickRefs?: Array<{ quantity: number; serialRef?: string | null; lotRef?: string | null }>
    },
  ) {
    const so = await createConfirmedSalesOrderWithLine(app, fx, token, {
      productId: fx.itemId,
      qty: qty + 5,
      unitPrice: 1000,
    })
    await auth(request(app).post(`${dsp(fx.slug)}/requirements/synchronise`).send({ salesOrderId: so.salesOrderId }))
    const reqList = await auth(
      request(app).get(`${dsp(fx.slug)}/requirements`).query({ salesOrderId: so.salesOrderId, limit: 5 }),
    )
    const reqId = reqList.body.data[0].id as string
    const fp = reqList.body.data[0].sourceFingerprint as string
    const draft = await auth(
      request(app)
        .post(`${dsp(fx.slug)}/orders/from-requirements`)
        .send({
          requirementIds: [reqId],
          lines: [{ requirementId: reqId, quantity: qty, warehouseId: fx.warehouseId }],
          planBeforeStockAllowed: true,
          sourceFingerprintByRequirement: { [reqId]: fp },
          idempotencyKey: `7c5-${key}-draft-${reqId}`,
        }),
    )
    expect(draft.status).toBe(201)
    const obId = draft.body.data.id as string
    const obLineId = draft.body.data.lines[0].id as string
    const dispatchNo = draft.body.data.dispatchNo as string

    await auth(
      request(app)
        .post(`${dsp(fx.slug)}/orders/${obId}/reservations`)
        .send({
          lines: [{ outboundDispatchLineId: obLineId, quantity: qty }],
          idempotencyKey: `7c5-${key}-res-${obId}`,
        }),
    )
    const pickLists = await auth(
      request(app)
        .post(`${dsp(fx.slug)}/orders/${obId}/pick-lists`)
        .send({ idempotencyKey: `7c5-${key}-pkl-${obId}` }),
    )
    const pklId = pickLists.body.data[0].id as string
    const pickLineIdLocal = pickLists.body.data[0].lines[0].id as string
    await auth(request(app).post(`${dsp(fx.slug)}/pick-lists/${pklId}/release`))
    await auth(request(app).post(`${dsp(fx.slug)}/pick-lists/${pklId}/start`))

    const pickRefs = options?.pickRefs?.length
      ? options.pickRefs
      : [{ quantity: qty, serialRef: null, lotRef: null }]
    for (let i = 0; i < pickRefs.length; i++) {
      const ref = pickRefs[i]!
      await auth(
        request(app)
          .post(`${dsp(fx.slug)}/pick-lists/${pklId}/pick`)
          .send({
            pickLineId: pickLineIdLocal,
            quantity: ref.quantity,
            serialRef: ref.serialRef ?? undefined,
            lotRef: ref.lotRef ?? undefined,
            idempotencyKey: `7c5-${key}-pick-${pickLineIdLocal}-${i}`,
          }),
      )
    }
    await auth(request(app).post(`${dsp(fx.slug)}/pick-lists/${pklId}/complete`))

    const sessions = await auth(
      request(app)
        .post(`${dsp(fx.slug)}/orders/${obId}/packing-sessions`)
        .send({ idempotencyKey: `7c5-${key}-pack-${obId}` }),
    )
    const sessionId = sessions.body.data[0].id as string
    await auth(request(app).post(`${dsp(fx.slug)}/packing-sessions/${sessionId}/start`))
    const pkg = await auth(
      request(app)
        .post(`${dsp(fx.slug)}/packing-sessions/${sessionId}/packages`)
        .send({ packageReference: `BOX-${key}` }),
    )
    const packageIdLocal = pkg.body.data.id as string
    await auth(
      request(app)
        .post(`${dsp(fx.slug)}/packages/${packageIdLocal}/pack`)
        .send({ pickLineId: pickLineIdLocal, quantity: qty, idempotencyKey: `7c5-${key}-pkline-${packageIdLocal}` }),
    )
    await auth(request(app).post(`${dsp(fx.slug)}/packing-sessions/${sessionId}/complete`))
    await auth(request(app).post(`${dsp(fx.slug)}/packing-sessions/${sessionId}/verify`))

    const challan = await auth(
      request(app)
        .post(`${dsp(fx.slug)}/orders/${obId}/delivery-challans`)
        .send({ idempotencyKey: `7c5-${key}-dc-${obId}` }),
    )
    const challanIdLocal = challan.body.data.id as string
    await auth(request(app).post(`${dsp(fx.slug)}/delivery-challans/${challanIdLocal}/ready-for-review`))
    await auth(request(app).post(`${dsp(fx.slug)}/delivery-challans/${challanIdLocal}/approve`))
    await auth(
      request(app)
        .post(`${dsp(fx.slug)}/delivery-challans/${challanIdLocal}/issue`)
        .send({ idempotencyKey: `7c5-${key}-issue-${challanIdLocal}` }),
    )

    if (options?.post !== false) {
      const posted = await auth(request(app).post(`${dsp(fx.slug)}/outbound/${obId}/post`).send({}))
      expect(posted.status).toBe(200)
    }

    return {
      obId,
      obLineId,
      dispatchNo,
      salesOrderId: so.salesOrderId,
      lineId: so.lineId,
      qty,
      pickListId: pklId,
      pickLineId: pickLineIdLocal,
    }
  }

  async function prepareWorkbenchPosted(qty: number, key: string) {
    return prepareWorkbenchReady(qty, key, { post: true })
  }

  it('partial reverse leaves outbound CONFIRMED and nets fulfilment', async () => {
    const prepared = await prepareWorkbenchPosted(4, 'partial')
    const before = await onHandQty()
    const rev = await auth(
      request(app)
        .post(`${dsp(fx.slug)}/outbound/${prepared.obId}/reverse`)
        .send({
          reason: 'partial reverse UAT',
          lines: [{ outboundDispatchLineId: prepared.obLineId, quantity: 1 }],
          idempotencyKey: `7c5-partial-rev-${prepared.obId}`,
        }),
    )
    expect(rev.status).toBe(200)
    expect(rev.body.data.awaitingApproval).toBe(false)
    expect(rev.body.data.outbound?.status).toBe('CONFIRMED')
    expect(await onHandQty()).toBe(before + 1)

    const posting = await prisma.dispatchPosting.findFirst({
      where: { tenantId: fx.tenantId, outboundDispatchId: prepared.obId },
      include: { lines: true },
    })
    expect(posting?.status).toBe('PARTIALLY_REVERSED')
    expect(Number(posting?.lines[0]?.reversedQuantity ?? 0)).toBe(1)

    const fulfil = await auth(
      request(app).get(`${crm(fx.slug)}/sales-orders/${prepared.salesOrderId}/fulfilment`),
    )
    expect(fulfil.body.data.lines[0].dispatchedQty).toBe(3)
  }, 180_000)

  it('blocks reverse when posted inventory accounting event exists (COGS proxy)', async () => {
    const prepared = await prepareWorkbenchPosted(1, 'cogs')
    await prisma.inventoryAccountingEvent.create({
      data: {
        id: randomUUID(),
        tenantId: fx.tenantId,
        eventType: 'FG_DISPATCH',
        status: 'POSTED',
        idempotencyKey: `cogs-block-${prepared.obId}`,
        sourceDocumentType: 'OUTBOUND_DISPATCH',
        sourceDocumentId: prepared.obId,
        quantity: 1,
        voucherId: randomUUID(),
      },
    })

    const blocked = await auth(
      request(app).post(`${dsp(fx.slug)}/outbound/${prepared.obId}/reverse`).send({ reason: 'should block' }),
    )
    expect(blocked.status).toBe(409)
    expect(String(blocked.body.message ?? '')).toMatch(/COGS_OR_INV_ACCT_POSTED|accounting|COGS/i)

    const deps = await auth(request(app).get(`${dsp(fx.slug)}/outbound/${prepared.obId}/reversal-dependencies`))
    expect(deps.status).toBe(200)
    expect(
      deps.body.data.dependencies.some((d: { code: string }) => d.code === 'COGS_OR_INV_ACCT_POSTED'),
    ).toBe(true)
  }, 180_000)

  it('blocks reverse when posted Sales Invoice source-links the outbound', async () => {
    const prepared = await prepareWorkbenchPosted(1, 'si-block')
    let legalEntity = await prisma.legalEntity.findFirst({ where: { tenantId: fx.tenantId } })
    if (!legalEntity) {
      legalEntity = await prisma.legalEntity.create({
        data: {
          tenantId: fx.tenantId,
          code: `LE${Date.now()}`.slice(-16),
          legalName: 'Dispatch SI Block LE',
          displayName: 'Dispatch SI Block LE',
          isActive: true,
        },
      })
    }
    const so = await prisma.crmSalesOrder.findFirst({
      where: { id: prepared.salesOrderId, tenantId: fx.tenantId },
      select: { companyId: true },
    })
    const customerId = so?.companyId ?? randomUUID()
    const fakeInvoiceId = randomUUID()
    await prisma.salesInvoice.create({
      data: {
        id: fakeInvoiceId,
        tenantId: fx.tenantId,
        legalEntityId: legalEntity.id,
        status: 'POSTED',
        customerId,
        customerNameSnapshot: 'Dep Block Co',
        invoiceDate: new Date(),
        invoiceNumber: `SI-BLK-${Date.now()}`,
        sourceType: 'OUTBOUND_DISPATCH',
        sourceDocumentId: prepared.obId,
        postedAt: new Date(),
      },
    })
    await prisma.salesInvoiceSourceLink.create({
      data: {
        id: randomUUID(),
        tenantId: fx.tenantId,
        legalEntityId: legalEntity.id,
        salesInvoiceId: fakeInvoiceId,
        sourceType: 'OUTBOUND_DISPATCH',
        sourceDocumentId: prepared.obId,
        sourceLineId: prepared.obLineId,
        status: 'ACTIVE',
        quantity: 1,
      },
    })

    const blocked = await auth(
      request(app).post(`${dsp(fx.slug)}/outbound/${prepared.obId}/reverse`).send({ reason: 'should block' }),
    )
    expect(blocked.status).toBe(409)
    expect(String(blocked.body.message ?? '')).toMatch(/SALES_INVOICE_POSTED|invoice/i)

    const deps = await auth(request(app).get(`${dsp(fx.slug)}/outbound/${prepared.obId}/reversal-dependencies`))
    expect(deps.status).toBe(200)
    expect(deps.body.data.dependencies.some((d: { code: string }) => d.code === 'SALES_INVOICE_POSTED')).toBe(
      true,
    )

    // force without override still blocked for users who lack override? Test user has all dispatch perms including override.
    const forced = await auth(
      request(app)
        .post(`${dsp(fx.slug)}/outbound/${prepared.obId}/reverse`)
        .send({ reason: 'supervisor force', force: true }),
    )
    expect(forced.status).toBe(200)
    expect(forced.body.data.awaitingApproval).toBe(false)
  }, 180_000)

  it('concurrent double-post: only one ISSUE movement', async () => {
    const so = await createConfirmedSalesOrderWithLine(app, fx, token, {
      productId: fx.itemId,
      qty: 2,
      unitPrice: 1000,
    })
    await auth(request(app).post(`${dsp(fx.slug)}/requirements/synchronise`).send({ salesOrderId: so.salesOrderId }))
    const reqList = await auth(
      request(app).get(`${dsp(fx.slug)}/requirements`).query({ salesOrderId: so.salesOrderId, limit: 5 }),
    )
    const reqId = reqList.body.data[0].id as string
    const fp = reqList.body.data[0].sourceFingerprint as string
    const draft = await auth(
      request(app)
        .post(`${dsp(fx.slug)}/orders/from-requirements`)
        .send({
          requirementIds: [reqId],
          lines: [{ requirementId: reqId, quantity: 1, warehouseId: fx.warehouseId }],
          planBeforeStockAllowed: true,
          sourceFingerprintByRequirement: { [reqId]: fp },
          idempotencyKey: `7c5-race-draft-${reqId}`,
        }),
    )
    const obId = draft.body.data.id as string
    const obLineId = draft.body.data.lines[0].id as string
    const dispatchNo = draft.body.data.dispatchNo as string

    await auth(
      request(app)
        .post(`${dsp(fx.slug)}/orders/${obId}/reservations`)
        .send({
          lines: [{ outboundDispatchLineId: obLineId, quantity: 1 }],
          idempotencyKey: `7c5-race-res-${obId}`,
        }),
    )
    const pickLists = await auth(
      request(app).post(`${dsp(fx.slug)}/orders/${obId}/pick-lists`).send({ idempotencyKey: `7c5-race-pkl-${obId}` }),
    )
    const pklId = pickLists.body.data[0].id as string
    const pickLineIdLocal = pickLists.body.data[0].lines[0].id as string
    await auth(request(app).post(`${dsp(fx.slug)}/pick-lists/${pklId}/release`))
    await auth(request(app).post(`${dsp(fx.slug)}/pick-lists/${pklId}/start`))
    await auth(
      request(app)
        .post(`${dsp(fx.slug)}/pick-lists/${pklId}/pick`)
        .send({ pickLineId: pickLineIdLocal, quantity: 1, idempotencyKey: `7c5-race-pick-${pickLineIdLocal}` }),
    )
    await auth(request(app).post(`${dsp(fx.slug)}/pick-lists/${pklId}/complete`))
    const sessions = await auth(
      request(app)
        .post(`${dsp(fx.slug)}/orders/${obId}/packing-sessions`)
        .send({ idempotencyKey: `7c5-race-pack-${obId}` }),
    )
    const sessionId = sessions.body.data[0].id as string
    await auth(request(app).post(`${dsp(fx.slug)}/packing-sessions/${sessionId}/start`))
    const pkg = await auth(
      request(app)
        .post(`${dsp(fx.slug)}/packing-sessions/${sessionId}/packages`)
        .send({ packageReference: 'BOX-RACE' }),
    )
    await auth(
      request(app)
        .post(`${dsp(fx.slug)}/packages/${pkg.body.data.id}/pack`)
        .send({ pickLineId: pickLineIdLocal, quantity: 1, idempotencyKey: `7c5-race-pkline` }),
    )
    await auth(request(app).post(`${dsp(fx.slug)}/packing-sessions/${sessionId}/complete`))
    await auth(request(app).post(`${dsp(fx.slug)}/packing-sessions/${sessionId}/verify`))
    const challan = await auth(
      request(app)
        .post(`${dsp(fx.slug)}/orders/${obId}/delivery-challans`)
        .send({ idempotencyKey: `7c5-race-dc-${obId}` }),
    )
    const challanIdLocal = challan.body.data.id as string
    await auth(request(app).post(`${dsp(fx.slug)}/delivery-challans/${challanIdLocal}/ready-for-review`))
    await auth(request(app).post(`${dsp(fx.slug)}/delivery-challans/${challanIdLocal}/approve`))
    await auth(
      request(app)
        .post(`${dsp(fx.slug)}/delivery-challans/${challanIdLocal}/issue`)
        .send({ idempotencyKey: `7c5-race-issue-${challanIdLocal}` }),
    )

    await Promise.all([
      auth(request(app).post(`${dsp(fx.slug)}/outbound/${obId}/post`)),
      auth(request(app).post(`${dsp(fx.slug)}/outbound/${obId}/post`)),
    ])
    const issues = await prisma.inventoryStockMovement.count({
      where: {
        tenantId: fx.tenantId,
        referenceType: 'FG_DISPATCH',
        movementType: 'ISSUE',
        referenceNo: dispatchNo,
      },
    })
    expect(issues).toBe(1)
  }, 180_000)

  it('emergency override posts workbench draft without pick/pack/challan', async () => {
    const so = await createConfirmedSalesOrderWithLine(app, fx, token, {
      productId: fx.itemId,
      qty: 3,
      unitPrice: 1000,
    })
    await auth(request(app).post(`${dsp(fx.slug)}/requirements/synchronise`).send({ salesOrderId: so.salesOrderId }))
    const reqList = await auth(
      request(app).get(`${dsp(fx.slug)}/requirements`).query({ salesOrderId: so.salesOrderId, limit: 5 }),
    )
    const reqId = reqList.body.data[0].id as string
    const fp = reqList.body.data[0].sourceFingerprint as string
    const draft = await auth(
      request(app)
        .post(`${dsp(fx.slug)}/orders/from-requirements`)
        .send({
          requirementIds: [reqId],
          lines: [{ requirementId: reqId, quantity: 1, warehouseId: fx.warehouseId }],
          planBeforeStockAllowed: true,
          sourceFingerprintByRequirement: { [reqId]: fp },
          idempotencyKey: `7c5-emerg-draft-${reqId}`,
        }),
    )
    expect(draft.status).toBe(201)
    const obId = draft.body.data.id as string

    const blocked = await auth(request(app).post(`${dsp(fx.slug)}/outbound/${obId}/post`).send({}))
    expect(blocked.status).toBe(409)

    const noOverridePerms = DISPATCH_PERMS.filter((p) => p !== 'dispatch.override' && p !== 'tenant.manage')
    const limited = await createUserWithPerms(app, fx.tenantId, fx.slug, noOverridePerms, 'dsp7c5-no-ovr')
    const denied = await request(app)
      .post(`${dsp(fx.slug)}/outbound/${obId}/post`)
      .set('Authorization', `Bearer ${limited.token}`)
      .send({ emergency: true, overrideReason: 'should deny' })
    expect([401, 403]).toContain(denied.status)

    const before = await onHandQty()
    const emerg = await auth(
      request(app)
        .post(`${dsp(fx.slug)}/outbound/${obId}/post`)
        .send({ emergency: true, overrideReason: 'customer emergency ship' }),
    )
    expect(emerg.status).toBe(200)
    expect(emerg.body.data.status).toBe('CONFIRMED')
    expect(await onHandQty()).toBe(before - 1)

    const posting = await prisma.dispatchPosting.findFirst({
      where: { tenantId: fx.tenantId, outboundDispatchId: obId },
    })
    expect(posting?.mode).toBe('emergency')
    expect(String(posting?.remarks ?? '')).toMatch(/EMERGENCY/i)
  }, 120_000)

  it('serial/lot matrix: block incomplete; pass with seeded serial; reject duplicate serial', async () => {
    const { DISPATCH_POSTING_POLICY_DEFAULTS } = await import(
      '../src/modules/dispatch/posting/dispatch-policy.js'
    )
    const prevSerial = DISPATCH_POSTING_POLICY_DEFAULTS.requireSerialAllocation
    const prevLot = DISPATCH_POSTING_POLICY_DEFAULTS.requireLotAllocation

    try {
      // Build workbench docs first (item not serial-tracked yet — packing stays simple).
      const missing = await prepareWorkbenchReady(1, 'trk-miss', { post: false })
      const okReady = await prepareWorkbenchReady(1, 'trk-ok', { post: false })
      const dupReady = await prepareWorkbenchReady(2, 'trk-dup', { post: false })

      DISPATCH_POSTING_POLICY_DEFAULTS.requireSerialAllocation = true
      DISPATCH_POSTING_POLICY_DEFAULTS.requireLotAllocation = true
      await prisma.masterItem.update({
        where: { id: fx.itemId },
        data: { serialTracked: true, batchTracked: true },
      })

      const blocked = await auth(request(app).post(`${dsp(fx.slug)}/outbound/${missing.obId}/post`).send({}))
      expect(blocked.status).toBe(409)
      expect(String(blocked.body.message ?? '')).toMatch(/serial|lot|batch/i)

      // Seed serial master + soft allocation, then pass serial-only gate
      DISPATCH_POSTING_POLICY_DEFAULTS.requireLotAllocation = false
      await prisma.masterItem.update({
        where: { id: fx.itemId },
        data: { serialTracked: true, batchTracked: false },
      })
      const reservation = await prisma.inventoryStockReservation.findFirst({
        where: {
          tenantId: fx.tenantId,
          outboundDispatchLineId: okReady.obLineId,
          status: 'ACTIVE',
        },
      })
      expect(reservation).toBeTruthy()
      await prisma.inventorySerial.create({
        data: {
          id: randomUUID(),
          tenantId: fx.tenantId,
          itemId: fx.itemId,
          serialNumber: 'SN-OK-1',
          warehouseId: fx.warehouseId,
          status: 'AVAILABLE',
          stockStatus: 'UNRESTRICTED',
        },
      })
      await prisma.dispatchTrackingAllocation.create({
        data: {
          id: randomUUID(),
          tenantId: fx.tenantId,
          inventoryReservationId: reservation!.id,
          outboundDispatchId: okReady.obId,
          outboundDispatchLineId: okReady.obLineId,
          itemId: fx.itemId,
          warehouseId: fx.warehouseId,
          serialRef: 'SN-OK-1',
          allocatedQuantity: 1,
          status: 'PICKED',
        },
      })
      const posted = await auth(request(app).post(`${dsp(fx.slug)}/outbound/${okReady.obId}/post`).send({}))
      if (posted.status !== 200) {
        // eslint-disable-next-line no-console
        console.error('serial pass post failed', posted.status, posted.body)
      }
      expect(posted.status).toBe(200)

      // Duplicate active serial is rejected by unique index (cannot seed two ACTIVE rows).
      const dupRes = await prisma.inventoryStockReservation.findFirst({
        where: {
          tenantId: fx.tenantId,
          outboundDispatchLineId: dupReady.obLineId,
          status: 'ACTIVE',
        },
      })
      expect(dupRes).toBeTruthy()
      await expect(
        prisma.dispatchTrackingAllocation.create({
          data: {
            id: randomUUID(),
            tenantId: fx.tenantId,
            inventoryReservationId: dupRes!.id,
            outboundDispatchId: dupReady.obId,
            outboundDispatchLineId: dupReady.obLineId,
            itemId: fx.itemId,
            warehouseId: fx.warehouseId,
            serialRef: 'SN-DUP-UNIQUE',
            allocatedQuantity: 1,
            status: 'PICKED',
          },
        }),
      ).resolves.toBeTruthy()
      await expect(
        prisma.dispatchTrackingAllocation.create({
          data: {
            id: randomUUID(),
            tenantId: fx.tenantId,
            inventoryReservationId: dupRes!.id,
            outboundDispatchId: dupReady.obId,
            outboundDispatchLineId: dupReady.obLineId,
            itemId: fx.itemId,
            warehouseId: fx.warehouseId,
            serialRef: 'SN-DUP-UNIQUE',
            allocatedQuantity: 1,
            status: 'PICKED',
          },
        }),
      ).rejects.toThrow(/Unique constraint|unique/i)
    } finally {
      DISPATCH_POSTING_POLICY_DEFAULTS.requireSerialAllocation = prevSerial
      DISPATCH_POSTING_POLICY_DEFAULTS.requireLotAllocation = prevLot
      await prisma.masterItem.update({
        where: { id: fx.itemId },
        data: { serialTracked: false, batchTracked: false },
      })
    }
  }, 300_000)

  it('concurrency stress: N parallel posts yield one ISSUE; concurrent reverse apply once', async () => {
    const ready = await prepareWorkbenchReady(1, 'stress-post', { post: false })
    const results = await Promise.all(
      Array.from({ length: 8 }, (_, i) =>
        auth(
          request(app)
            .post(`${dsp(fx.slug)}/outbound/${ready.obId}/post`)
            .send({ idempotencyKey: `7c5-stress-post-${ready.obId}-${i}` }),
        ),
      ),
    )
    const successes = results.filter((r) => r.status === 200)
    expect(successes.length).toBeGreaterThanOrEqual(1)
    const issues = await prisma.inventoryStockMovement.count({
      where: {
        tenantId: fx.tenantId,
        referenceType: 'FG_DISPATCH',
        movementType: 'ISSUE',
        referenceNo: ready.dispatchNo,
      },
    })
    expect(issues).toBe(1)

    const revReady = await prepareWorkbenchPosted(1, 'stress-rev')
    const revResults = await Promise.all([
      auth(
        request(app)
          .post(`${dsp(fx.slug)}/outbound/${revReady.obId}/reverse`)
          .send({ reason: 'race-a', force: true }),
      ),
      auth(
        request(app)
          .post(`${dsp(fx.slug)}/outbound/${revReady.obId}/reverse`)
          .send({ reason: 'race-b', force: true }),
      ),
      auth(
        request(app)
          .post(`${dsp(fx.slug)}/outbound/${revReady.obId}/reverse`)
          .send({ reason: 'race-c', force: true }),
      ),
    ])
    const revOk = revResults.filter((r) => r.status === 200 && r.body.data?.awaitingApproval === false)
    expect(revOk.length).toBeGreaterThanOrEqual(1)
    const applied = await prisma.dispatchReversal.count({
      where: { tenantId: fx.tenantId, outboundDispatchId: revReady.obId, status: 'APPLIED' },
    })
    expect(applied).toBeGreaterThanOrEqual(1)
    expect(applied).toBeLessThanOrEqual(1)
    const outbound = await prisma.outboundDispatch.findFirst({
      where: { id: revReady.obId, tenantId: fx.tenantId },
    })
    expect(outbound?.status).toBe('REVERSED')
    const inwards = await prisma.inventoryStockMovement.count({
      where: {
        tenantId: fx.tenantId,
        referenceType: 'FG_DISPATCH',
        movementType: 'INWARD',
        referenceNo: revReady.dispatchNo,
      },
    })
    expect(inwards).toBe(1)
  }, 300_000)
})

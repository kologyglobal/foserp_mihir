import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import request from 'supertest'
import { createApp } from '../src/app.js'
import { prisma } from '../src/config/database.js'
import { PERMISSIONS, type PermissionName } from '../src/constants/permissions.js'

/**
 * Phase 1 — Purchase Order lifecycle (live DB integration).
 * Create / update / submit / approve / reject / send-back / send-to-vendor /
 * cancel / close / reopen + tenant isolation + RBAC + audit logs.
 */
const app = createApp()

const dbAvailable = await prisma
  .$queryRaw`SELECT 1`
  .then(() => true)
  .catch(() => false)

async function ensurePermissions() {
  for (const name of PERMISSIONS) {
    const [module] = name.split('.')
    await prisma.permission
      .upsert({
        where: { name },
        create: { name, module, description: name },
        update: {},
      })
      .catch(() => {})
  }
}

async function createTenantUser(opts: {
  slugPrefix: string
  permissionNames: PermissionName[]
  tenantId?: string
}) {
  const { hashPassword } = await import('../src/utils/password.js')
  const pw = await hashPassword('Test@123')
  const suffix = `${Date.now()}-${Math.floor(Math.random() * 10000)}`
  let tenantId = opts.tenantId
  let slug = ''
  if (!tenantId) {
    slug = `${opts.slugPrefix}-${suffix}`
    const tenant = await prisma.tenant.create({
      data: { name: 'PO Lifecycle', slug, email: `${slug}@test.com`, status: 'ACTIVE' },
    })
    tenantId = tenant.id
  } else {
    const tenant = await prisma.tenant.findUniqueOrThrow({ where: { id: tenantId } })
    slug = tenant.slug
  }
  const user = await prisma.user.create({
    data: {
      tenantId,
      firstName: 'Po',
      lastName: 'Tester',
      email: `user-${suffix}@test.com`,
      passwordHash: pw,
      status: 'ACTIVE',
      emailVerified: true,
    },
  })
  const perms = await prisma.permission.findMany({
    where: { name: { in: opts.permissionNames } },
  })
  const role = await prisma.role.create({
    data: {
      tenantId,
      name: `Role ${suffix}`,
      rolePermissions: { create: perms.map((p) => ({ permissionId: p.id })) },
    },
  })
  await prisma.userRole.create({ data: { userId: user.id, roleId: role.id, tenantId } })
  const loginRes = await request(app).post('/api/v1/auth/login').send({
    email: user.email,
    password: 'Test@123',
    tenantSlug: slug,
  })
  return {
    tenantId,
    userId: user.id,
    slug,
    token: loginRes.body.data?.accessToken as string,
  }
}

async function cleanupTenant(tenantId: string) {
  await prisma.purchaseOrderLine.deleteMany({ where: { tenantId } })
  await prisma.purchaseOrder.deleteMany({ where: { tenantId } })
  await prisma.purchaseApproval.deleteMany({ where: { tenantId } })
  await prisma.purchaseStatusHistory.deleteMany({ where: { tenantId } })
  await prisma.purchasePlantSettings.deleteMany({ where: { tenantId } })
  await prisma.purchaseSettings.deleteMany({ where: { tenantId } })
  await prisma.masterLocation.deleteMany({ where: { tenantId } })
  await prisma.masterWarehouse.deleteMany({ where: { tenantId } })
  await prisma.masterPlant.deleteMany({ where: { tenantId } })
  await prisma.masterVendor.deleteMany({ where: { tenantId } })
  await prisma.masterUom.deleteMany({ where: { tenantId } })
  await prisma.auditLog.deleteMany({ where: { tenantId } })
  await prisma.codeSeries.deleteMany({ where: { tenantId } })
  await prisma.userRole.deleteMany({ where: { tenantId } })
  await prisma.rolePermission.deleteMany({ where: { role: { tenantId } } })
  await prisma.role.deleteMany({ where: { tenantId } })
  await prisma.user.deleteMany({ where: { tenantId } })
  await prisma.tenant.delete({ where: { id: tenantId } }).catch(() => {})
}

const FULL_PURCHASE_PERMS = PERMISSIONS.filter((p) => p.startsWith('purchase.')) as PermissionName[]

describe.skipIf(!dbAvailable)('Purchase order lifecycle (Phase 1)', () => {
  let tenantId = ''
  let slug = ''
  let token = ''
  let approverToken = ''
  let viewerToken = ''
  let otherTenantId = ''
  let otherSlug = ''
  let otherToken = ''
  let vendorId = ''
  let uomId = ''
  let warehouseId = ''
  let warehouse2Id = ''

  const poBase = (s = slug) => `/api/v1/t/${s}/purchase/orders`
  const setupBase = (s = slug) => `/api/v1/t/${s}/purchase/setup`
  const auth = (t = token) => ({ Authorization: `Bearer ${t}` })

  function draftPayload(overrides: Record<string, unknown> = {}) {
    return {
      vendorId,
      orderDate: '2026-07-21',
      expectedDeliveryDate: '2026-07-30',
      paymentTerms: 'Net 30',
      remarks: 'Lifecycle test PO',
      lines: [
        {
          itemCode: 'ITM-PO-1',
          itemName: 'Lifecycle Item 1',
          quantity: 10,
          uomId,
          rate: 25.5,
          requiredDate: '2026-07-30',
        },
        {
          itemCode: 'ITM-PO-2',
          itemName: 'Lifecycle Item 2',
          quantity: 4,
          uomId,
          rate: 100,
        },
      ],
      ...overrides,
    }
  }

  async function createDraft(): Promise<string> {
    const res = await request(app).post(poBase()).set(auth()).send(draftPayload())
    expect(res.status).toBe(201)
    return res.body.data.id as string
  }

  async function createSubmitted(): Promise<string> {
    const id = await createDraft()
    const res = await request(app).post(`${poBase()}/${id}/submit`).set(auth()).send({})
    expect(res.status).toBe(200)
    expect(res.body.data.status).toBe('PENDING_APPROVAL')
    return id
  }

  beforeAll(async () => {
    await ensurePermissions()
    const ctx = await createTenantUser({
      slugPrefix: 'polc',
      permissionNames: FULL_PURCHASE_PERMS,
    })
    tenantId = ctx.tenantId
    slug = ctx.slug
    token = ctx.token
    expect(token).toBeTruthy()

    const approver = await createTenantUser({
      slugPrefix: 'polc-approver',
      permissionNames: FULL_PURCHASE_PERMS,
      tenantId,
    })
    approverToken = approver.token

    const viewer = await createTenantUser({
      slugPrefix: 'polc-view',
      permissionNames: ['purchase.po.view'] as PermissionName[],
      tenantId,
    })
    viewerToken = viewer.token

    const other = await createTenantUser({
      slugPrefix: 'polc-other',
      permissionNames: FULL_PURCHASE_PERMS,
    })
    otherTenantId = other.tenantId
    otherSlug = other.slug
    otherToken = other.token

    const uom = await prisma.masterUom.create({
      data: { tenantId, code: `U-${Date.now()}`, name: 'EA', status: 'ACTIVE' },
    })
    uomId = uom.id
    const vendor = await prisma.masterVendor.create({
      data: { tenantId, code: `V-${Date.now()}`, name: 'PO Lifecycle Vendor', status: 'ACTIVE' },
    })
    vendorId = vendor.id

    const plant = await prisma.masterPlant.create({
      data: { tenantId, code: 'PL-PO', name: 'PO Plant', status: 'ACTIVE' },
    })
    const wh = await prisma.masterWarehouse.create({
      data: {
        tenantId,
        plantId: plant.id,
        code: 'WH-PO1',
        name: 'PO Warehouse 1',
        warehouseType: 'receiving',
        status: 'ACTIVE',
      },
    })
    warehouseId = wh.id
    const wh2 = await prisma.masterWarehouse.create({
      data: {
        tenantId,
        plantId: plant.id,
        code: 'WH-PO2',
        name: 'PO Warehouse 2',
        warehouseType: 'storage',
        status: 'ACTIVE',
      },
    })
    warehouse2Id = wh2.id
  }, 120_000)

  afterAll(async () => {
    if (tenantId) await cleanupTenant(tenantId)
    if (otherTenantId) await cleanupTenant(otherTenantId)
  })

  it('creates a draft PO persisted in MySQL with server-side number and totals', async () => {
    const res = await request(app).post(poBase()).set(auth()).send(draftPayload())
    expect(res.status).toBe(201)
    const po = res.body.data
    expect(po.status).toBe('DRAFT')
    expect(po.orderNumber).toBeTruthy()
    expect(po.subtotalAmount).toBeCloseTo(655, 2) // 10*25.5 + 4*100
    expect(po.totalAmount).toBeCloseTo(655, 2)
    expect(po.lines).toHaveLength(2)
    expect(po.lines[0].openQuantity).toBe(10)
    expect(po.allowedActions.canSubmit).toBe(true)
    expect(po.allowedActions.canApprove).toBe(false)

    const dbRow = await prisma.purchaseOrder.findFirst({
      where: { id: po.id, tenantId },
      include: { lines: true },
    })
    expect(dbRow).not.toBeNull()
    expect(dbRow?.lines).toHaveLength(2)
  })

  it('updates a draft PO and recomputes totals', async () => {
    const id = await createDraft()
    const res = await request(app)
      .patch(`${poBase()}/${id}`)
      .set(auth())
      .send({
        remarks: 'Updated remarks',
        lines: [
          { itemCode: 'ITM-PO-1', itemName: 'Lifecycle Item 1', quantity: 2, uomId, rate: 50 },
        ],
      })
    expect(res.status).toBe(200)
    expect(res.body.data.remarks).toBe('Updated remarks')
    expect(res.body.data.subtotalAmount).toBeCloseTo(100, 2)
    expect(res.body.data.lines).toHaveLength(1)
  })

  it('submits a draft PO and creates a pending approval', async () => {
    const id = await createSubmitted()
    const approval = await prisma.purchaseApproval.findFirst({
      where: { tenantId, purchaseOrderId: id, status: 'PENDING' },
    })
    expect(approval).not.toBeNull()
  })

  it('blocks editing a submitted PO', async () => {
    const id = await createSubmitted()
    const res = await request(app)
      .patch(`${poBase()}/${id}`)
      .set(auth())
      .send({ remarks: 'should fail' })
    expect(res.status).toBe(422)
    expect(res.body.code ?? res.body.error?.code).toBe('PO_NOT_EDITABLE')
  })

  it('approves a pending PO and resolves the approval', async () => {
    const id = await createSubmitted()
    const res = await request(app)
      .post(`${poBase()}/${id}/approve`)
      .set(auth(approverToken))
      .send({})
    expect(res.status).toBe(200)
    expect(res.body.data.status).toBe('APPROVED')
    const approval = await prisma.purchaseApproval.findFirst({
      where: { tenantId, purchaseOrderId: id },
      orderBy: { createdAt: 'desc' },
    })
    expect(approval?.status).toBe('APPROVED')
  })

  it('blocks approving a draft PO (invalid transition)', async () => {
    const id = await createDraft()
    const res = await request(app).post(`${poBase()}/${id}/approve`).set(auth()).send({})
    expect(res.status).toBe(422)
    expect(res.body.code ?? res.body.error?.code).toBe('PO_NOT_APPROVABLE')
  })

  it('requires a reason to reject and rejects with reason', async () => {
    const id = await createSubmitted()
    const missing = await request(app).post(`${poBase()}/${id}/reject`).set(auth()).send({})
    expect(missing.status).toBe(400)
    const res = await request(app)
      .post(`${poBase()}/${id}/reject`)
      .set(auth())
      .send({ reason: 'Price too high' })
    expect(res.status).toBe(200)
    expect(res.body.data.status).toBe('REJECTED')
    expect(res.body.data.rejectionReason).toBe('Price too high')
  })

  it('sends back with reason, allows rework edit, and resubmits', async () => {
    const id = await createSubmitted()
    const missing = await request(app).post(`${poBase()}/${id}/send-back`).set(auth()).send({})
    expect(missing.status).toBe(400)

    const sentBack = await request(app)
      .post(`${poBase()}/${id}/send-back`)
      .set(auth())
      .send({ reason: 'Fix delivery date' })
    expect(sentBack.status).toBe(200)
    expect(sentBack.body.data.status).toBe('SENT_BACK')
    expect(sentBack.body.data.sendBackReason).toBe('Fix delivery date')
    expect(sentBack.body.data.allowedActions.canEdit).toBe(true)

    const edit = await request(app)
      .patch(`${poBase()}/${id}`)
      .set(auth())
      .send({ expectedDeliveryDate: '2026-08-05' })
    expect(edit.status).toBe(200)

    const resubmit = await request(app).post(`${poBase()}/${id}/submit`).set(auth()).send({})
    expect(resubmit.status).toBe(200)
    expect(resubmit.body.data.status).toBe('PENDING_APPROVAL')
  })

  it('sends an approved PO to vendor; blocks sending unapproved', async () => {
    const id = await createSubmitted()
    const early = await request(app).post(`${poBase()}/${id}/send-to-vendor`).set(auth()).send({})
    expect(early.status).toBe(422)

    await request(app).post(`${poBase()}/${id}/approve`).set(auth(approverToken)).send({})
    const res = await request(app).post(`${poBase()}/${id}/send-to-vendor`).set(auth()).send({})
    expect(res.status).toBe(200)
    expect(res.body.data.status).toBe('SENT_TO_VENDOR')
    expect(res.body.data.allowedActions.canReceive).toBe(true)
  })

  it('cancels an unreceived PO and reopens it back to draft', async () => {
    const id = await createDraft()
    const cancel = await request(app).post(`${poBase()}/${id}/cancel`).set(auth()).send({})
    expect(cancel.status).toBe(200)
    expect(cancel.body.data.status).toBe('CANCELLED')
    expect(cancel.body.data.allowedActions.canReceive).toBe(false)

    const reopen = await request(app).post(`${poBase()}/${id}/reopen`).set(auth()).send({})
    expect(reopen.status).toBe(200)
    expect(reopen.body.data.status).toBe('DRAFT')
  })

  it('blocks cancelling a PO with receipts', async () => {
    const id = await createSubmitted()
    await request(app).post(`${poBase()}/${id}/approve`).set(auth(approverToken)).send({})
    await request(app).post(`${poBase()}/${id}/send-to-vendor`).set(auth()).send({})
    await prisma.purchaseOrderLine.updateMany({
      where: { tenantId, purchaseOrderId: id },
      data: { receivedQuantity: 1 },
    })
    const res = await request(app).post(`${poBase()}/${id}/cancel`).set(auth()).send({})
    expect(res.status).toBe(422)
    expect(res.body.code ?? res.body.error?.code).toBe('PO_CANNOT_CANCEL_RECEIVED')
  })

  it('closes a sent PO; closed PO cannot be edited; reopen restores receipt state', async () => {
    const id = await createSubmitted()
    await request(app).post(`${poBase()}/${id}/approve`).set(auth(approverToken)).send({})
    await request(app).post(`${poBase()}/${id}/send-to-vendor`).set(auth()).send({})

    const close = await request(app).post(`${poBase()}/${id}/close`).set(auth()).send({})
    expect(close.status).toBe(200)
    expect(close.body.data.status).toBe('CLOSED')

    const edit = await request(app)
      .patch(`${poBase()}/${id}`)
      .set(auth())
      .send({ remarks: 'nope' })
    expect(edit.status).toBe(422)

    const reopen = await request(app).post(`${poBase()}/${id}/reopen`).set(auth()).send({})
    expect(reopen.status).toBe(200)
    expect(reopen.body.data.status).toBe('SENT_TO_VENDOR')
  })

  it('enforces tenant isolation on GET/actions', async () => {
    const id = await createDraft()
    const res = await request(app)
      .get(`${poBase(otherSlug)}/${id}`)
      .set(auth(otherToken))
    expect(res.status).toBe(404)

    const action = await request(app)
      .post(`${poBase(otherSlug)}/${id}/submit`)
      .set(auth(otherToken))
      .send({})
    expect(action.status).toBe(404)
  })

  it('denies lifecycle actions without permission', async () => {
    const id = await createSubmitted()
    const res = await request(app)
      .post(`${poBase()}/${id}/approve`)
      .set(auth(viewerToken))
      .send({})
    expect(res.status).toBe(403)

    const create = await request(app).post(poBase()).set(auth(viewerToken)).send(draftPayload())
    expect(create.status).toBe(403)
  })

  it('writes audit logs and status history for lifecycle actions', async () => {
    const id = await createSubmitted()
    await request(app).post(`${poBase()}/${id}/approve`).set(auth(approverToken)).send({})

    const audits = await prisma.auditLog.findMany({
      where: { tenantId, entity: 'PurchaseOrder', entityId: id },
      select: { action: true },
    })
    const actions = audits.map((a) => a.action)
    expect(actions).toContain('PO_CREATED')
    expect(actions).toContain('PO_SUBMITTED')
    expect(actions).toContain('PO_APPROVED')

    const history = await prisma.purchaseStatusHistory.findMany({
      where: { tenantId, documentType: 'PURCHASE_ORDER', documentId: id },
      select: { action: true, toStatus: true },
    })
    expect(history.map((h) => h.action)).toEqual(
      expect.arrayContaining(['CREATED', 'SUBMITTED', 'APPROVED']),
    )
  })

  it('list and detail return the same persisted data (refresh-safe)', async () => {
    const id = await createDraft()
    const detail = await request(app).get(`${poBase()}/${id}`).set(auth())
    expect(detail.status).toBe(200)
    const list = await request(app).get(poBase()).set(auth())
    expect(list.status).toBe(200)
    const found = (list.body.data as Array<{ id: string; orderNumber: string }>).find(
      (o) => o.id === id,
    )
    expect(found?.orderNumber).toBe(detail.body.data.orderNumber)
  })

  it('rejects invalid payloads (no lines / zero quantity)', async () => {
    const noLines = await request(app)
      .post(poBase())
      .set(auth())
      .send({ ...draftPayload(), lines: [] })
    expect(noLines.status).toBe(400)

    const zeroQty = await request(app)
      .post(poBase())
      .set(auth())
      .send(draftPayload({ lines: [{ itemCode: 'X', itemName: 'X', quantity: 0, rate: 10 }] }))
    expect(zeroQty.status).toBe(400)
  })

  it('resolves deliveryWarehouseId from Purchase Setup default when omitted', async () => {
    const current = await request(app).get(setupBase()).set(auth())
    const setup = await request(app)
      .put(setupBase())
      .set(auth())
      .send({
        defaultWarehouseId: warehouseId,
        requirePoWarehouse: false,
        version: current.body.data.version,
      })
    expect(setup.status).toBe(200)

    const res = await request(app).post(poBase()).set(auth()).send(draftPayload())
    expect(res.status).toBe(201)
    expect(res.body.data.deliveryWarehouseId).toBe(warehouseId)
  })

  it('enforces requirePoWarehouse when no warehouse can be resolved', async () => {
    const current = await request(app).get(setupBase()).set(auth())
    await request(app)
      .put(setupBase())
      .set(auth())
      .send({
        defaultWarehouseId: null,
        requirePoWarehouse: true,
        version: current.body.data.version,
      })

    const res = await request(app).post(poBase()).set(auth()).send(draftPayload())
    expect(res.status).toBe(400)
    expect(res.body.error?.code || res.body.code).toMatch(/PO_WAREHOUSE_REQUIRED|VALIDATION/)

    const ok = await request(app)
      .post(poBase())
      .set(auth())
      .send(draftPayload({ deliveryWarehouseId: warehouseId }))
    expect(ok.status).toBe(201)
    expect(ok.body.data.deliveryWarehouseId).toBe(warehouseId)
  })

  it('keeps existing PO deliveryWarehouseId after setup default changes', async () => {
    const created = await request(app)
      .post(poBase())
      .set(auth())
      .send(draftPayload({ deliveryWarehouseId: warehouseId }))
    expect(created.status).toBe(201)
    const poId = created.body.data.id as string

    const current = await request(app).get(setupBase()).set(auth())
    await request(app)
      .put(setupBase())
      .set(auth())
      .send({
        defaultWarehouseId: warehouse2Id,
        requirePoWarehouse: false,
        version: current.body.data.version,
      })

    const detail = await request(app).get(`${poBase()}/${poId}`).set(auth())
    expect(detail.status).toBe(200)
    expect(detail.body.data.deliveryWarehouseId).toBe(warehouseId)
  })
})

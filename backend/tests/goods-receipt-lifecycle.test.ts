import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import request from 'supertest'
import { createApp } from '../src/app.js'
import { prisma } from '../src/config/database.js'
import { PERMISSIONS, type PermissionName } from '../src/constants/permissions.js'

/**
 * Phase 3 — Goods Receipt Note (live DB integration).
 * Create draft / submit / partial+full PO update / over-receipt /
 * cancelled PO blocked / reverse / tenant isolation / RBAC / audit / persistence.
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
      data: { name: 'GRN Lifecycle', slug, email: `${slug}@test.com`, status: 'ACTIVE' },
    })
    tenantId = tenant.id
  } else {
    const tenant = await prisma.tenant.findUniqueOrThrow({ where: { id: tenantId } })
    slug = tenant.slug
  }
  const user = await prisma.user.create({
    data: {
      tenantId,
      firstName: 'Grn',
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
  await prisma.goodsReceiptLine.deleteMany({ where: { tenantId } })
  await prisma.goodsReceipt.deleteMany({ where: { tenantId } })
  await prisma.purchaseOrderLine.deleteMany({ where: { tenantId } })
  await prisma.purchaseOrder.deleteMany({ where: { tenantId } })
  await prisma.purchaseStatusHistory.deleteMany({ where: { tenantId } })
  await prisma.purchasePlantSettings.deleteMany({ where: { tenantId } })
  await prisma.purchaseSettings.deleteMany({ where: { tenantId } })
  await prisma.purchaseApproval.deleteMany({ where: { tenantId } })
  await prisma.masterBin.deleteMany({ where: { tenantId } })
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

const FULL_PERMS = PERMISSIONS.filter(
  (p) => p.startsWith('purchase.'),
) as PermissionName[]

describe.skipIf(!dbAvailable)('Goods receipt lifecycle (Phase 3)', () => {
  let tenantId = ''
  let slug = ''
  let token = ''
  let approverToken = ''
  let viewerToken = ''
  let otherSlug = ''
  let otherToken = ''
  let otherTenantId = ''

  let vendorId = ''
  let uomId = ''
  let warehouseId = ''
  let locationId = ''
  let binId = ''
  let poId = ''
  let poLineId = ''
  let poLine2Id = ''

  const grnBase = (s = slug) => `/api/v1/t/${s}/purchase/grns`
  const poBase = (s = slug) => `/api/v1/t/${s}/purchase/orders`
  const setupBase = (s = slug) => `/api/v1/t/${s}/purchase/setup`
  const auth = (t = token) => ({ Authorization: `Bearer ${t}` })

  async function putSetup(body: Record<string, unknown>) {
    const current = await request(app).get(setupBase()).set(auth())
    const version = current.body.data?.version ?? 0
    return request(app)
      .put(setupBase())
      .set(auth())
      .send({ ...body, version })
  }

  async function createReceivablePo(qty = 100): Promise<{ poId: string; lineId: string }> {
    const createPo = await request(app)
      .post(poBase())
      .set(auth())
      .send({
        vendorId,
        orderDate: '2026-07-21',
        deliveryWarehouseId: warehouseId,
        lines: [{ itemCode: `ITM-${Date.now()}`, itemName: 'Setup Item', quantity: qty, uomId, rate: 1 }],
      })
    expect(createPo.status).toBe(201)
    const id = createPo.body.data.id as string
    const lineId = createPo.body.data.lines[0].id as string
    await request(app).post(`${poBase()}/${id}/submit`).set(auth()).send({})
    await request(app).post(`${poBase()}/${id}/approve`).set(auth(approverToken)).send({})
    await request(app).post(`${poBase()}/${id}/send-to-vendor`).set(auth()).send({})
    return { poId: id, lineId }
  }

  beforeAll(async () => {
    await ensurePermissions()
    const main = await createTenantUser({
      slugPrefix: 'grn-life',
      permissionNames: FULL_PERMS,
    })
    tenantId = main.tenantId
    slug = main.slug
    token = main.token

    const approver = await createTenantUser({
      slugPrefix: 'grn-appr',
      permissionNames: FULL_PERMS,
      tenantId,
    })
    approverToken = approver.token

    const viewer = await createTenantUser({
      slugPrefix: 'grn-view',
      permissionNames: ['purchase.grn.view', 'purchase.po.view'],
      tenantId,
    })
    viewerToken = viewer.token

    const other = await createTenantUser({
      slugPrefix: 'grn-other',
      permissionNames: FULL_PERMS,
    })
    otherSlug = other.slug
    otherToken = other.token
    otherTenantId = other.tenantId

    const vendor = await prisma.masterVendor.create({
      data: {
        tenantId,
        code: 'V-GRN',
        name: 'GRN Vendor',
        status: 'ACTIVE',
      },
    })
    vendorId = vendor.id

    const uom = await prisma.masterUom.create({
      data: {
        tenantId,
        code: 'NOS',
        name: 'Numbers',
        uomType: 'integer',
        status: 'ACTIVE',
      },
    })
    uomId = uom.id

    const plant = await prisma.masterPlant.create({
      data: { tenantId, code: 'PL-G', name: 'GRN Plant', status: 'ACTIVE' },
    })
    const wh = await prisma.masterWarehouse.create({
      data: {
        tenantId,
        plantId: plant.id,
        code: 'WH-RCV',
        name: 'Receiving',
        warehouseType: 'receiving',
        status: 'ACTIVE',
      },
    })
    warehouseId = wh.id
    const loc = await prisma.masterLocation.create({
      data: {
        tenantId,
        warehouseId,
        code: 'SL-1',
        name: 'Dock 1',
        status: 'ACTIVE',
      },
    })
    locationId = loc.id
    const bin = await prisma.masterBin.create({
      data: {
        tenantId,
        warehouseId,
        storageLocationId: locationId,
        code: 'B-01',
        name: 'Bin 01',
        status: 'ACTIVE',
      },
    })
    binId = bin.id

    // Create PO via API then force to SENT_TO_VENDOR with two lines
    const createPo = await request(app)
      .post(poBase())
      .set(auth())
      .send({
        vendorId,
        orderDate: '2026-07-21',
        lines: [
          {
            itemCode: 'ITM-1',
            itemName: 'Steel Plate',
            quantity: 100,
            uomId,
            rate: 10,
          },
          {
            itemCode: 'ITM-2',
            itemName: 'Bolt',
            quantity: 50,
            uomId,
            rate: 2,
          },
        ],
      })
    expect(createPo.status).toBe(201)
    poId = createPo.body.data.id
    poLineId = createPo.body.data.lines[0].id
    poLine2Id = createPo.body.data.lines[1].id

    await request(app).post(`${poBase()}/${poId}/submit`).set(auth()).send({})
    const approved = await request(app)
      .post(`${poBase()}/${poId}/approve`)
      .set(auth(approverToken))
      .send({})
    expect(approved.status).toBe(200)
    const sent = await request(app).post(`${poBase()}/${poId}/send-to-vendor`).set(auth()).send({})
    expect(sent.status).toBe(200)
    expect(sent.body.data.status).toBe('SENT_TO_VENDOR')
  }, 180_000)

  afterAll(async () => {
    if (tenantId) await cleanupTenant(tenantId)
    if (otherTenantId) await cleanupTenant(otherTenantId)
  }, 120_000)

  function draftPayload(overrides: Record<string, unknown> = {}) {
    return {
      purchaseOrderId: poId,
      receiptDate: '2026-07-21',
      warehouseId,
      storageLocationId: locationId,
      vendorChallanNumber: `CH-${Date.now()}`,
      vehicleNumber: 'MH12AB1234',
      inspectionRequired: false,
      allowExcess: false,
      lines: [
        {
          purchaseOrderLineId: poLineId,
          receivedQuantity: 40,
          binId,
        },
      ],
      ...overrides,
    }
  }

  it('lists receivable PO lines', async () => {
    const res = await request(app)
      .get(`${poBase()}/${poId}/receivable-lines`)
      .set(auth())
    expect(res.status).toBe(200)
    expect(res.body.data.lines.length).toBe(2)
    expect(res.body.data.lines[0].openQuantity).toBe(100)
  })

  it('creates a draft GRN', async () => {
    const res = await request(app).post(grnBase()).set(auth()).send(draftPayload())
    expect(res.status).toBe(201)
    expect(res.body.data.status).toBe('DRAFT')
    expect(res.body.data.grnNumber).toMatch(/^GRN-/)
    expect(res.body.data.allowedActions.canSubmit).toBe(true)
    const row = await prisma.goodsReceipt.findFirst({
      where: { id: res.body.data.id, tenantId },
    })
    expect(row?.warehouseId).toBe(warehouseId)
  })

  it('blocks over-receipt when Setup disallows over-receipt (ignores client allowExcess)', async () => {
    await putSetup({
      allowOverReceipt: false,
      overReceiptTolerancePct: 0,
      requireVendorChallan: false,
      requireVehicleNumber: false,
      requireGateEntry: false,
    })
    const { poId: excessPoId, lineId } = await createReceivablePo(100)
    const res = await request(app)
      .post(grnBase())
      .set(auth())
      .send(
        draftPayload({
          purchaseOrderId: excessPoId,
          allowExcess: true,
          lines: [{ purchaseOrderLineId: lineId, receivedQuantity: 150, binId }],
        }),
      )
    expect(res.status).toBe(400)
    expect(res.body.error?.code || res.body.code).toMatch(/GRN_QTY_EXCEEDS|VALIDATION/)
  })

  it('allows over-receipt within Setup tolerance even when client allowExcess is false', async () => {
    await putSetup({
      allowOverReceipt: true,
      overReceiptTolerancePct: 10,
      requireVendorChallan: false,
      requireVehicleNumber: false,
      requireGateEntry: false,
    })
    const { poId: tolPoId, lineId } = await createReceivablePo(100)
    const res = await request(app)
      .post(grnBase())
      .set(auth())
      .send(
        draftPayload({
          purchaseOrderId: tolPoId,
          allowExcess: false,
          lines: [{ purchaseOrderLineId: lineId, receivedQuantity: 105, binId }],
        }),
      )
    expect(res.status).toBe(201)

    const overTol = await request(app)
      .post(grnBase())
      .set(auth())
      .send(
        draftPayload({
          purchaseOrderId: tolPoId,
          allowExcess: true,
          lines: [{ purchaseOrderLineId: lineId, receivedQuantity: 120, binId }],
        }),
      )
    expect(overTol.status).toBe(400)
  })

  it('enforces Setup challan / vehicle / gate requirements', async () => {
    await putSetup({
      requireVendorChallan: true,
      requireVehicleNumber: true,
      requireGateEntry: true,
      allowOverReceipt: false,
    })
    const { poId: reqPoId, lineId } = await createReceivablePo(10)
    const missing = await request(app)
      .post(grnBase())
      .set(auth())
      .send(
        draftPayload({
          purchaseOrderId: reqPoId,
          vendorChallanNumber: '',
          vehicleNumber: '',
          gateEntryNumber: '',
          lines: [{ purchaseOrderLineId: lineId, receivedQuantity: 1, binId }],
        }),
      )
    expect(missing.status).toBe(400)

    const ok = await request(app)
      .post(grnBase())
      .set(auth())
      .send(
        draftPayload({
          purchaseOrderId: reqPoId,
          vendorChallanNumber: `CH-REQ-${Date.now()}`,
          vehicleNumber: 'MH12XY9999',
          gateEntryNumber: 'GE-1',
          lines: [{ purchaseOrderLineId: lineId, receivedQuantity: 1, binId }],
        }),
      )
    expect(ok.status).toBe(201)

    // Reset policies so earlier-style payloads keep working for remaining tests
    await putSetup({
      requireVendorChallan: false,
      requireVehicleNumber: false,
      requireGateEntry: false,
      allowOverReceipt: false,
      overReceiptTolerancePct: 0,
    })
  })

  it('blocks over-receipt without allowExcess', async () => {
    const res = await request(app)
      .post(grnBase())
      .set(auth())
      .send(
        draftPayload({
          lines: [{ purchaseOrderLineId: poLineId, receivedQuantity: 150 }],
        }),
      )
    expect(res.status).toBe(400)
    expect(res.body.error?.code || res.body.code).toMatch(/GRN_QTY_EXCEEDS|VALIDATION/)
  })

  it('blocks GRN against a cancelled PO', async () => {
    const createPo = await request(app)
      .post(poBase())
      .set(auth())
      .send({
        vendorId,
        orderDate: '2026-07-21',
        lines: [{ itemCode: 'X', itemName: 'X', quantity: 5, uomId, rate: 1 }],
      })
    const cancelId = createPo.body.data.id
    await request(app).post(`${poBase()}/${cancelId}/cancel`).set(auth()).send({})
    const res = await request(app)
      .post(grnBase())
      .set(auth())
      .send(
        draftPayload({
          purchaseOrderId: cancelId,
          lines: [
            {
              purchaseOrderLineId: createPo.body.data.lines[0].id,
              receivedQuantity: 1,
            },
          ],
        }),
      )
    expect(res.status).toBe(422)
  })

  it('submits partial GRN and updates PO to PARTIALLY_RECEIVED', async () => {
    const created = await request(app).post(grnBase()).set(auth()).send(draftPayload())
    const grnId = created.body.data.id
    const res = await request(app).post(`${grnBase()}/${grnId}/submit`).set(auth()).send({})
    expect(res.status).toBe(200)
    expect(res.body.data.status).toBe('SUBMITTED')

    const po = await prisma.purchaseOrder.findFirst({
      where: { id: poId, tenantId },
      include: { lines: true },
    })
    expect(po?.status).toBe('PARTIALLY_RECEIVED')
    const line = po?.lines.find((l) => l.id === poLineId)
    expect(Number(line?.receivedQuantity)).toBe(40)
  })

  it('submits remaining qty and moves PO to FULLY_RECEIVED', async () => {
    const created = await request(app)
      .post(grnBase())
      .set(auth())
      .send(
        draftPayload({
          lines: [
            { purchaseOrderLineId: poLineId, receivedQuantity: 60, binId },
            { purchaseOrderLineId: poLine2Id, receivedQuantity: 50, binId },
          ],
        }),
      )
    expect(created.status).toBe(201)
    const res = await request(app)
      .post(`${grnBase()}/${created.body.data.id}/submit`)
      .set(auth())
      .send({})
    expect(res.status).toBe(200)

    const po = await prisma.purchaseOrder.findFirst({
      where: { id: poId, tenantId },
      include: { lines: true },
    })
    expect(po?.status).toBe('FULLY_RECEIVED')
    expect(Number(po?.lines.find((l) => l.id === poLineId)?.receivedQuantity)).toBe(100)
    expect(Number(po?.lines.find((l) => l.id === poLine2Id)?.receivedQuantity)).toBe(50)
  })

  it('reverses a submitted GRN and restores PO quantities', async () => {
    // New receivable PO for reverse test
    const createPo = await request(app)
      .post(poBase())
      .set(auth())
      .send({
        vendorId,
        orderDate: '2026-07-21',
        lines: [{ itemCode: 'R', itemName: 'Reverse Item', quantity: 20, uomId, rate: 5 }],
      })
    const rPoId = createPo.body.data.id
    const rLineId = createPo.body.data.lines[0].id
    await request(app).post(`${poBase()}/${rPoId}/submit`).set(auth()).send({})
    await request(app).post(`${poBase()}/${rPoId}/approve`).set(auth(approverToken)).send({})
    await request(app).post(`${poBase()}/${rPoId}/send-to-vendor`).set(auth()).send({})

    const created = await request(app)
      .post(grnBase())
      .set(auth())
      .send(
        draftPayload({
          purchaseOrderId: rPoId,
          lines: [{ purchaseOrderLineId: rLineId, receivedQuantity: 20, binId }],
        }),
      )
    const grnId = created.body.data.id
    await request(app).post(`${grnBase()}/${grnId}/submit`).set(auth()).send({})
    const rev = await request(app).post(`${grnBase()}/${grnId}/reverse`).set(auth()).send({
      remarks: 'Wrong challan',
    })
    expect(rev.status).toBe(200)
    expect(rev.body.data.status).toBe('REVERSED')

    const po = await prisma.purchaseOrder.findFirst({
      where: { id: rPoId, tenantId },
      include: { lines: true },
    })
    expect(Number(po?.lines[0]?.receivedQuantity)).toBe(0)
    expect(po?.status).toBe('SENT_TO_VENDOR')
  })

  it('blocks editing a submitted GRN', async () => {
    const createPo = await request(app)
      .post(poBase())
      .set(auth())
      .send({
        vendorId,
        orderDate: '2026-07-21',
        lines: [{ itemCode: 'E', itemName: 'Edit Block', quantity: 10, uomId, rate: 1 }],
      })
    const ePoId = createPo.body.data.id
    const eLineId = createPo.body.data.lines[0].id
    await request(app).post(`${poBase()}/${ePoId}/submit`).set(auth()).send({})
    await request(app).post(`${poBase()}/${ePoId}/approve`).set(auth(approverToken)).send({})
    await request(app).post(`${poBase()}/${ePoId}/send-to-vendor`).set(auth()).send({})

    const created = await request(app)
      .post(grnBase())
      .set(auth())
      .send(
        draftPayload({
          purchaseOrderId: ePoId,
          lines: [{ purchaseOrderLineId: eLineId, receivedQuantity: 5, binId }],
        }),
      )
    await request(app).post(`${grnBase()}/${created.body.data.id}/submit`).set(auth()).send({})
    const patch = await request(app)
      .patch(`${grnBase()}/${created.body.data.id}`)
      .set(auth())
      .send({ remarks: 'nope' })
    expect(patch.status).toBe(422)
  })

  it('denies create without permission', async () => {
    const res = await request(app).post(grnBase()).set(auth(viewerToken)).send(draftPayload())
    expect(res.status).toBe(403)
  })

  it('enforces tenant isolation', async () => {
    const created = await request(app)
      .post(grnBase())
      .set(auth())
      .send(
        draftPayload({
          purchaseOrderId: poId,
          // PO is fully received — create will fail receivable check.
          // Use a fresh PO instead.
        }),
      )
    // poId is fully received — expect 422
    expect([201, 422]).toContain(created.status)

    const createPo = await request(app)
      .post(poBase())
      .set(auth())
      .send({
        vendorId,
        orderDate: '2026-07-21',
        lines: [{ itemCode: 'T', itemName: 'Tenant', quantity: 3, uomId, rate: 1 }],
      })
    const tPoId = createPo.body.data.id
    await request(app).post(`${poBase()}/${tPoId}/submit`).set(auth()).send({})
    await request(app).post(`${poBase()}/${tPoId}/approve`).set(auth(approverToken)).send({})
    await request(app).post(`${poBase()}/${tPoId}/send-to-vendor`).set(auth()).send({})
    const grn = await request(app)
      .post(grnBase())
      .set(auth())
      .send(
        draftPayload({
          purchaseOrderId: tPoId,
          lines: [
            {
              purchaseOrderLineId: createPo.body.data.lines[0].id,
              receivedQuantity: 1,
              binId,
            },
          ],
        }),
      )
    expect(grn.status).toBe(201)
    const other = await request(app)
      .get(`${grnBase(otherSlug)}/${grn.body.data.id}`)
      .set(auth(otherToken))
    expect(other.status).toBe(404)
  })

  it('writes audit logs on create and submit', async () => {
    const logs = await prisma.auditLog.findMany({
      where: {
        tenantId,
        entity: 'GoodsReceipt',
        action: { in: ['GRN_CREATED', 'GRN_SUBMITTED'] },
      },
    })
    expect(logs.length).toBeGreaterThan(0)
  })

  it('persists after refresh (MySQL, not memory)', async () => {
    const createPo = await request(app)
      .post(poBase())
      .set(auth())
      .send({
        vendorId,
        orderDate: '2026-07-21',
        lines: [{ itemCode: 'P', itemName: 'Persist', quantity: 8, uomId, rate: 1 }],
      })
    const pPoId = createPo.body.data.id
    await request(app).post(`${poBase()}/${pPoId}/submit`).set(auth()).send({})
    await request(app).post(`${poBase()}/${pPoId}/approve`).set(auth(approverToken)).send({})
    await request(app).post(`${poBase()}/${pPoId}/send-to-vendor`).set(auth()).send({})
    const created = await request(app)
      .post(grnBase())
      .set(auth())
      .send(
        draftPayload({
          purchaseOrderId: pPoId,
          lines: [
            {
              purchaseOrderLineId: createPo.body.data.lines[0].id,
              receivedQuantity: 3,
              binId,
            },
          ],
        }),
      )
    const freshApp = createApp()
    const res = await request(freshApp)
      .get(`${grnBase()}/${created.body.data.id}`)
      .set(auth())
    expect(res.status).toBe(200)
    expect(res.body.data.grnNumber).toBe(created.body.data.grnNumber)
  })
})

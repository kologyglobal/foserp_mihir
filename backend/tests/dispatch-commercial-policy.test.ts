/**
 * Dispatch commercial O2C policy — settings API + partial / multi / invoice / POD gates.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import request from 'supertest'
import { createApp } from '../src/app.js'
import { prisma } from '../src/config/prisma.js'
import { PERMISSIONS, type PermissionName } from '../src/constants/permissions.js'
import {
  bootstrapManufacturingFixture,
  cleanupTenant,
  createUserWithPerms,
  ensurePermissions,
  type ManufacturingFixture,
} from './manufacturing/helpers/manufacturing-fixture.js'
import { createConfirmedSalesOrderWithLine } from './manufacturing/helpers/production-fixture.js'
import {
  assertDispatchInvoiceCommercialPolicy,
  assertMultipleDispatchesAllowed,
  assertPartialDispatchAllowed,
  shouldAutoCreateSalesInvoice,
} from '../src/modules/dispatch/settings/dispatch-commercial-enforcement.js'
import { assertPodAllowsInvoice } from '../src/modules/dispatch/pod/dispatch-pod.service.js'
import { resolveDispatchPostingPolicy } from '../src/modules/dispatch/posting/dispatch-policy.js'

const app = createApp()

const dbAvailable = await prisma
  .$queryRaw`SELECT 1`
  .then(() => true)
  .catch(() => false)

const PERMS = PERMISSIONS.filter(
  (p) =>
    p.startsWith('dispatch.') ||
    p.startsWith('inventory.') ||
    p.startsWith('crm.sales_order.') ||
    p.startsWith('crm.company.') ||
    p.startsWith('master.') ||
    p.startsWith('finance.'),
) as PermissionName[]

function dsp(slug: string) {
  return `/api/v1/t/${slug}/dispatch`
}
function inv(slug: string) {
  return `/api/v1/t/${slug}/inventory`
}

async function cleanupPolicyTenant(tenantId: string): Promise<void> {
  await prisma.dispatchSettings.deleteMany({ where: { tenantId } }).catch(() => {})
  await prisma.outboundDispatchLine
    .updateMany({ where: { tenantId }, data: { inventoryMovementId: null } })
    .catch(() => {})
  await prisma.outboundDispatchLine.deleteMany({ where: { tenantId } }).catch(() => {})
  await prisma.outboundDispatch.deleteMany({ where: { tenantId } }).catch(() => {})
  await prisma.dispatchRequirement.deleteMany({ where: { tenantId } }).catch(() => {})
  await prisma.salesOrderLineFulfilment.deleteMany({ where: { tenantId } }).catch(() => {})
  await prisma.inventoryStockReservation.deleteMany({ where: { tenantId } }).catch(() => {})
  await prisma.inventoryStockMovement.deleteMany({ where: { tenantId } }).catch(() => {})
  await prisma.inventoryStockBalance.deleteMany({ where: { tenantId } }).catch(() => {})
  await prisma.crmSalesOrder.deleteMany({ where: { tenantId } }).catch(() => {})
  await prisma.crmCompany.deleteMany({ where: { tenantId } }).catch(() => {})
  await prisma.codeSeries.deleteMany({ where: { tenantId } }).catch(() => {})
  await cleanupTenant(tenantId).catch(() => {})
}

async function upsertSettings(
  tenantId: string,
  patch: {
    allowPartialDispatch?: boolean
    allowMultipleDispatches?: boolean
    invoiceMode?: 'ONE_PER_DISPATCH' | 'CONSOLIDATED' | 'MANUAL_ONLY'
    requirePodBeforeInvoice?: boolean
  },
) {
  const existing = await prisma.dispatchSettings.findUnique({ where: { tenantId } })
  if (existing) {
    return prisma.dispatchSettings.update({
      where: { tenantId },
      data: {
        version: existing.version + 1,
        allowPartialDispatch: patch.allowPartialDispatch ?? existing.allowPartialDispatch,
        allowMultipleDispatches: patch.allowMultipleDispatches ?? existing.allowMultipleDispatches,
        invoiceMode: patch.invoiceMode ?? existing.invoiceMode,
        requirePodBeforeInvoice: patch.requirePodBeforeInvoice ?? existing.requirePodBeforeInvoice,
      },
    })
  }
  return prisma.dispatchSettings.create({
    data: {
      tenantId,
      version: 1,
      allowPartialDispatch: patch.allowPartialDispatch ?? true,
      allowMultipleDispatches: patch.allowMultipleDispatches ?? true,
      allowOverDispatch: false,
      invoiceMode: patch.invoiceMode ?? 'ONE_PER_DISPATCH',
      requirePodBeforeInvoice: patch.requirePodBeforeInvoice ?? false,
    },
  })
}

describe.skipIf(!dbAvailable)('Dispatch commercial O2C policy', () => {
  let fx: ManufacturingFixture
  let token: string
  let salesOrderId: string
  let lineId: string
  let requirementId: string
  let fingerprint: string

  beforeAll(async () => {
    await ensurePermissions()
    const slug = `dsp-policy-${Date.now()}-${Math.floor(Math.random() * 1000)}`
    const tenant = await prisma.tenant.create({
      data: { name: 'Dispatch Policy Co', slug, email: `${slug}@test.com`, status: 'ACTIVE' },
    })
    const admin = await createUserWithPerms(app, tenant.id, slug, PERMS, 'policy-admin')
    fx = await bootstrapManufacturingFixture({
      tenantId: tenant.id,
      slug,
      token: admin.token,
      userId: admin.userId,
    })
    token = admin.token

    await prisma.masterItem.update({
      where: { id: fx.itemId },
      data: { salesAllowed: true },
    })

    await request(app)
      .post(`${inv(fx.slug)}/movements/opening`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        itemId: fx.itemId,
        warehouseId: fx.warehouseId,
        quantity: 50,
        referenceNo: 'OPN-POLICY',
      })

    const so = await createConfirmedSalesOrderWithLine(app, fx, token, {
      productId: fx.itemId,
      qty: 10,
      unitPrice: 1000,
    })
    salesOrderId = so.salesOrderId
    lineId = so.lineId

    await request(app)
      .post(`${dsp(fx.slug)}/requirements/synchronise`)
      .set('Authorization', `Bearer ${token}`)
      .send({ salesOrderId })
      .expect(200)

    const reqList = await request(app)
      .get(`${dsp(fx.slug)}/requirements`)
      .query({ salesOrderId, limit: 5 })
      .set('Authorization', `Bearer ${token}`)
      .expect(200)
    requirementId = reqList.body.data[0]?.id
    fingerprint = reqList.body.data[0]?.sourceFingerprint
    expect(requirementId).toBeTruthy()
  }, 180_000)

  afterAll(async () => {
    if (fx?.tenantId) await cleanupPolicyTenant(fx.tenantId)
  })

  function auth(req: request.Test) {
    return req.set('Authorization', `Bearer ${token}`)
  }

  it('GET/PUT /dispatch/settings persists commercial flags', async () => {
    const get0 = await auth(request(app).get(`${dsp(fx.slug)}/settings`)).expect(200)
    expect(get0.body.data.allowPartialDispatch).toBe(true)
    expect(get0.body.data.invoiceMode).toBe('ONE_PER_DISPATCH')

    const put = await auth(request(app).put(`${dsp(fx.slug)}/settings`))
      .send({
        version: get0.body.data.version,
        allowPartialDispatch: false,
        allowMultipleDispatches: false,
        allowOverDispatch: false,
        invoiceMode: 'CONSOLIDATED',
        requirePodBeforeInvoice: true,
      })
      .expect(200)

    expect(put.body.data.allowPartialDispatch).toBe(false)
    expect(put.body.data.allowMultipleDispatches).toBe(false)
    expect(put.body.data.invoiceMode).toBe('CONSOLIDATED')
    expect(put.body.data.requirePodBeforeInvoice).toBe(true)
    expect(put.body.data.effectivePolicy.invoiceMode).toBe('CONSOLIDATED')

    const conflict = await auth(request(app).put(`${dsp(fx.slug)}/settings`))
      .send({
        version: get0.body.data.version,
        allowPartialDispatch: true,
        allowMultipleDispatches: true,
        allowOverDispatch: false,
        invoiceMode: 'ONE_PER_DISPATCH',
        requirePodBeforeInvoice: false,
      })
    expect(conflict.status).toBe(409)

    await auth(request(app).put(`${dsp(fx.slug)}/settings`))
      .send({
        version: put.body.data.version,
        allowPartialDispatch: true,
        allowMultipleDispatches: true,
        allowOverDispatch: false,
        invoiceMode: 'ONE_PER_DISPATCH',
        requirePodBeforeInvoice: false,
      })
      .expect(200)
  })

  it('blocks partial draft when allowPartialDispatch=false', async () => {
    await upsertSettings(fx.tenantId, { allowPartialDispatch: false, allowMultipleDispatches: true })

    await expect(assertPartialDispatchAllowed(fx.tenantId, 5, 10, 'line')).rejects.toMatchObject({
      code: 'VALIDATION_ERROR',
    })

    const draft = await auth(request(app).post(`${dsp(fx.slug)}/orders/from-requirements`)).send({
      requirementIds: [requirementId],
      lines: [{ requirementId, quantity: 5, warehouseId: fx.warehouseId }],
      planBeforeStockAllowed: true,
      sourceFingerprintByRequirement: { [requirementId]: fingerprint },
      idempotencyKey: `policy-partial-${requirementId}`,
    })
    expect(draft.status).toBe(400)
    expect(String(draft.body.message ?? '')).toMatch(/Partial dispatch/i)

    await upsertSettings(fx.tenantId, { allowPartialDispatch: true })
  })

  it('blocks second open outbound when allowMultipleDispatches=false', async () => {
    await upsertSettings(fx.tenantId, {
      allowPartialDispatch: true,
      allowMultipleDispatches: false,
      invoiceMode: 'ONE_PER_DISPATCH',
    })

    const first = await auth(request(app).post(`${dsp(fx.slug)}/orders/from-requirements`))
      .send({
        requirementIds: [requirementId],
        lines: [{ requirementId, quantity: 4, warehouseId: fx.warehouseId }],
        planBeforeStockAllowed: true,
        sourceFingerprintByRequirement: { [requirementId]: fingerprint },
        idempotencyKey: `policy-multi-a-${requirementId}`,
      })
      .expect(201)

    await expect(assertMultipleDispatchesAllowed(fx.tenantId, lineId)).rejects.toMatchObject({
      code: 'VALIDATION_ERROR',
    })

    await auth(request(app).post(`${dsp(fx.slug)}/requirements/synchronise`)).send({ salesOrderId })
    const refreshed = await auth(
      request(app).get(`${dsp(fx.slug)}/requirements`).query({ salesOrderId, limit: 5 }),
    )
    const reqId2 = refreshed.body.data[0]?.id as string
    const fp2 = refreshed.body.data[0]?.sourceFingerprint as string

    const second = await auth(request(app).post(`${dsp(fx.slug)}/orders/from-requirements`)).send({
      requirementIds: [reqId2],
      lines: [{ requirementId: reqId2, quantity: 3, warehouseId: fx.warehouseId }],
      planBeforeStockAllowed: true,
      sourceFingerprintByRequirement: { [reqId2]: fp2 },
      idempotencyKey: `policy-multi-b-${reqId2}`,
    })
    expect([400, 422]).toContain(second.status)
    expect(String(second.body.message ?? '')).toMatch(/Multiple dispatches/i)

    await prisma.outboundDispatch.update({
      where: { id: first.body.data.id },
      data: { status: 'CANCELLED', cancelledAt: new Date() },
    })
    await upsertSettings(fx.tenantId, { allowMultipleDispatches: true })
  })

  it('invoiceMode CONSOLIDATED/MANUAL_ONLY disables auto SI; ONE_PER_DISPATCH allows', async () => {
    await upsertSettings(fx.tenantId, { invoiceMode: 'CONSOLIDATED' })
    expect((await shouldAutoCreateSalesInvoice(fx.tenantId)).allowed).toBe(false)

    await upsertSettings(fx.tenantId, { invoiceMode: 'MANUAL_ONLY' })
    expect((await shouldAutoCreateSalesInvoice(fx.tenantId)).allowed).toBe(false)

    await upsertSettings(fx.tenantId, { invoiceMode: 'ONE_PER_DISPATCH' })
    expect((await shouldAutoCreateSalesInvoice(fx.tenantId)).allowed).toBe(true)

    const policy = await resolveDispatchPostingPolicy(fx.tenantId, { forceHardened: true })
    expect(policy.invoiceMode).toBe('ONE_PER_DISPATCH')
  })

  it('ONE_PER_DISPATCH rejects multi-dispatch invoice; CONSOLIDATED allows; POD gates', async () => {
    await upsertSettings(fx.tenantId, {
      invoiceMode: 'ONE_PER_DISPATCH',
      requirePodBeforeInvoice: false,
    })
    await expect(
      assertDispatchInvoiceCommercialPolicy(fx.tenantId, ['d1', 'd2']),
    ).rejects.toMatchObject({ code: 'INVOICE_MODE_ONE_PER_DISPATCH' })

    await upsertSettings(fx.tenantId, { invoiceMode: 'CONSOLIDATED' })
    await expect(assertDispatchInvoiceCommercialPolicy(fx.tenantId, ['d1', 'd2'])).resolves.toBeUndefined()

    await upsertSettings(fx.tenantId, {
      invoiceMode: 'MANUAL_ONLY',
      requirePodBeforeInvoice: true,
    })
    await expect(assertPodAllowsInvoice(fx.tenantId, 'missing-dispatch')).rejects.toMatchObject({
      code: 'POD_REQUIRED_BEFORE_INVOICE',
    })

    await upsertSettings(fx.tenantId, {
      invoiceMode: 'ONE_PER_DISPATCH',
      requirePodBeforeInvoice: false,
      allowPartialDispatch: true,
      allowMultipleDispatches: true,
    })
  })
})

/**
 * Wave 6 — AP master reuse over MasterVendor (soft links, no FinanceVendor).
 *
 * Covers: MasterVendor resolve / unknown / cross-tenant / CrmCompany-as-vendor
 * rejection, snapshot stability + refresh-from-master, DIRECT vs PO/GRN source
 * modes with real document validation (existence, vendor match), and the
 * accounting vendor / purchase-order / GRN lookup endpoints.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import request from 'supertest'
import { randomUUID } from 'node:crypto'
import { createApp } from '../../src/app.js'
import { prisma } from '../../src/config/database.js'
import {
  bootstrapApAllocFixture,
  cleanupTenant,
  createFinanceAdminTenant,
  ensurePermissions,
  type ApAllocFixture,
} from './helpers/ap-allocation-fixture.js'

const app = createApp()

const dbAvailable = await prisma
  .$queryRaw`SELECT 1`
  .then(() => true)
  .catch(() => false)

let supplierSeq = 0
function nextSupplierNumber(): string {
  supplierSeq += 1
  return `SUP/MR/${Date.now()}/${supplierSeq}`
}

function draftPayload(fx: ApAllocFixture, overrides: Record<string, unknown> = {}) {
  return {
    legalEntityId: fx.legalEntityId,
    vendorId: fx.vendorId,
    invoiceType: 'EXPENSE',
    supplierInvoiceNumber: nextSupplierNumber(),
    supplierInvoiceDate: fx.documentDate,
    documentDate: fx.documentDate,
    postingDate: fx.postingDate,
    currencyCode: 'INR',
    exchangeRate: '1',
    taxTreatment: 'REGULAR',
    itcEligibility: 'ELIGIBLE',
    tdsRecognitionMode: 'NOT_APPLICABLE',
    supplyType: 'INTRA_STATE',
    companyStateCode: '27',
    vendorStateCode: '27',
    placeOfSupply: '27',
    configuration: { roundingMode: 'NONE' },
    approvalRequiredOverride: false,
    lines: [
      {
        lineNumber: 1,
        lineType: 'EXPENSE',
        description: 'Master reuse expense',
        quantity: '1',
        unitPrice: '1000',
        gstRate: '0',
        debitAccountId: fx.purchaseAccountId,
      },
    ],
    ...overrides,
  }
}

async function createDraft(fx: ApAllocFixture, overrides: Record<string, unknown> = {}) {
  return request(app)
    .post(`/api/v1/t/${fx.slug}/accounting/payables/vendor-invoices`)
    .set('Authorization', `Bearer ${fx.token}`)
    .send(draftPayload(fx, overrides))
}

async function deleteInvoice(id: string) {
  await prisma.vendorInvoiceLine.deleteMany({ where: { vendorInvoiceId: id } }).catch(() => {})
  await prisma.vendorInvoiceSourceLink.deleteMany({ where: { vendorInvoiceId: id } }).catch(() => {})
  await prisma.vendorInvoice.delete({ where: { id } }).catch(() => {})
}

describe.skipIf(!dbAvailable)('Wave 6 — AP master reuse (MasterVendor + PO/GRN soft links)', () => {
  let fx: ApAllocFixture
  let foreign: { tenantId: string; vendorId: string }
  let warehouseId: string

  beforeAll(async () => {
    await ensurePermissions()
    const ctx = await createFinanceAdminTenant(app, 'ap-master-reuse')
    fx = await bootstrapApAllocFixture(app, ctx)

    const foreignTenant = await prisma.tenant.create({
      data: {
        name: 'AP Foreign Tenant',
        slug: `ap-foreign-${Date.now()}`,
        email: `ap-foreign-${Date.now()}@test.com`,
        status: 'ACTIVE',
      },
    })
    const foreignVendor = await prisma.masterVendor.create({
      data: {
        tenantId: foreignTenant.id,
        code: `FV${Date.now()}`.slice(-8),
        name: 'Foreign Vendor Pvt Ltd',
        status: 'ACTIVE',
        isBlocked: false,
      },
    })
    foreign = { tenantId: foreignTenant.id, vendorId: foreignVendor.id }

    const warehouse = await prisma.masterWarehouse.create({
      data: {
        tenantId: fx.tenantId,
        code: `WH${Date.now()}`.slice(-8),
        name: 'Master Reuse Warehouse',
        status: 'ACTIVE',
      },
    })
    warehouseId = warehouse.id
  })

  afterAll(async () => {
    if (foreign?.tenantId) {
      await prisma.masterVendor.deleteMany({ where: { tenantId: foreign.tenantId } }).catch(() => {})
      await prisma.tenant.delete({ where: { id: foreign.tenantId } }).catch(() => {})
    }
    if (fx?.tenantId) {
      await prisma.goodsReceipt.deleteMany({ where: { tenantId: fx.tenantId } }).catch(() => {})
      await prisma.purchaseOrder.deleteMany({ where: { tenantId: fx.tenantId } }).catch(() => {})
      await prisma.masterWarehouse.deleteMany({ where: { tenantId: fx.tenantId } }).catch(() => {})
      await prisma.crmCompany.deleteMany({ where: { tenantId: fx.tenantId } }).catch(() => {})
      await cleanupTenant(fx.tenantId)
    }
  })

  it('resolves MasterVendor on draft create with DIRECT source mode and vendor snapshot', async () => {
    const res = await createDraft(fx)
    expect(res.status).toBe(201)
    expect(res.body.data.sourceMode).toBe('DIRECT')

    const row = await prisma.vendorInvoice.findUniqueOrThrow({ where: { id: res.body.data.id } })
    expect(row.vendorId).toBe(fx.vendorId)
    expect(row.vendorNameSnapshot).toBe('AP Alloc Vendor Pvt Ltd')
    expect(row.vendorCodeSnapshot).toBeTruthy()

    await deleteInvoice(res.body.data.id)
  })

  it('rejects an unknown vendorId', async () => {
    const res = await createDraft(fx, { vendorId: randomUUID() })
    expect([404, 422]).toContain(res.status)
  })

  it('rejects a cross-tenant vendorId (tenant isolation)', async () => {
    const res = await createDraft(fx, { vendorId: foreign.vendorId })
    expect([404, 422]).toContain(res.status)
  })

  it('rejects a CrmCompany id used as vendorId (masters are not interchangeable)', async () => {
    const company = await prisma.crmCompany.create({
      data: {
        tenantId: fx.tenantId,
        companyCode: `CC-${Date.now()}`.slice(-8),
        name: 'Customer Not A Vendor',
        status: 'active',
        isActive: true,
      },
    })
    const res = await createDraft(fx, { vendorId: company.id })
    expect([404, 422]).toContain(res.status)
    await prisma.crmCompany.delete({ where: { id: company.id } })
  })

  it('rejects a blocked vendor', async () => {
    const blocked = await prisma.masterVendor.create({
      data: {
        tenantId: fx.tenantId,
        code: `BV${Date.now()}`.slice(-8),
        name: 'Blocked Vendor Pvt Ltd',
        status: 'ACTIVE',
        isBlocked: true,
      },
    })
    const res = await createDraft(fx, { vendorId: blocked.id })
    expect(res.status).toBe(422)
    await prisma.masterVendor.delete({ where: { id: blocked.id } })
  })

  it('rejects a fabricated purchase order source UUID', async () => {
    const res = await createDraft(fx, {
      sourceLinks: [{ sourceType: 'PURCHASE_ORDER', sourceDocumentId: randomUUID() }],
    })
    expect([404, 422]).toContain(res.status)
  })

  it('rejects a purchase order belonging to a different vendor', async () => {
    const po = await prisma.purchaseOrder.create({
      data: {
        tenantId: fx.tenantId,
        orderNumber: `PO-MM-${Date.now()}`,
        orderDate: new Date(fx.documentDate),
        vendorId: fx.otherVendorId,
        status: 'APPROVED',
      },
    })
    const res = await createDraft(fx, {
      sourceLinks: [{ sourceType: 'PURCHASE_ORDER', sourceDocumentId: po.id }],
    })
    expect(res.status).toBe(422)
    expect(res.body.code).toBe('SOURCE_DOCUMENT_PARTY_MISMATCH')
    await prisma.purchaseOrder.delete({ where: { id: po.id } })
  })

  it('accepts an eligible matching PO, derives PURCHASE_ORDER mode and enriches the snapshot', async () => {
    const po = await prisma.purchaseOrder.create({
      data: {
        tenantId: fx.tenantId,
        orderNumber: `PO-OK-${Date.now()}`,
        orderDate: new Date(fx.documentDate),
        vendorId: fx.vendorId,
        status: 'APPROVED',
      },
    })
    const res = await createDraft(fx, {
      sourceLinks: [{ sourceType: 'PURCHASE_ORDER', sourceDocumentId: po.id }],
    })
    expect(res.status).toBe(201)
    expect(res.body.data.sourceMode).toBe('PURCHASE_ORDER')

    const link = await prisma.vendorInvoiceSourceLink.findFirstOrThrow({
      where: { vendorInvoiceId: res.body.data.id, sourceType: 'PURCHASE_ORDER' },
    })
    expect(link.sourceDocumentId).toBe(po.id)
    expect(link.sourceDocumentNumberSnapshot).toBe(po.orderNumber)

    await deleteInvoice(res.body.data.id)
    await prisma.purchaseOrder.delete({ where: { id: po.id } })
  })

  it('validates GRN vendor match and accepts an eligible matching GRN', async () => {
    const po = await prisma.purchaseOrder.create({
      data: {
        tenantId: fx.tenantId,
        orderNumber: `PO-GRN-${Date.now()}`,
        orderDate: new Date(fx.documentDate),
        vendorId: fx.vendorId,
        status: 'FULLY_RECEIVED',
      },
    })
    const otherPo = await prisma.purchaseOrder.create({
      data: {
        tenantId: fx.tenantId,
        orderNumber: `PO-GRN-O-${Date.now()}`,
        orderDate: new Date(fx.documentDate),
        vendorId: fx.otherVendorId,
        status: 'FULLY_RECEIVED',
      },
    })
    const mismatchGrn = await prisma.goodsReceipt.create({
      data: {
        tenantId: fx.tenantId,
        grnNumber: `GRN-MM-${Date.now()}`,
        receiptDate: new Date(fx.documentDate),
        purchaseOrderId: otherPo.id,
        purchaseOrderNumber: otherPo.orderNumber,
        vendorId: fx.otherVendorId,
        warehouseId,
        status: 'FULLY_ACCEPTED',
      },
    })
    const matchingGrn = await prisma.goodsReceipt.create({
      data: {
        tenantId: fx.tenantId,
        grnNumber: `GRN-OK-${Date.now()}`,
        receiptDate: new Date(fx.documentDate),
        purchaseOrderId: po.id,
        purchaseOrderNumber: po.orderNumber,
        vendorId: fx.vendorId,
        warehouseId,
        status: 'FULLY_ACCEPTED',
      },
    })

    const mismatch = await createDraft(fx, {
      sourceLinks: [{ sourceType: 'GOODS_RECEIPT', sourceDocumentId: mismatchGrn.id }],
    })
    expect(mismatch.status).toBe(422)
    expect(mismatch.body.code).toBe('SOURCE_DOCUMENT_PARTY_MISMATCH')

    const ok = await createDraft(fx, {
      sourceLinks: [{ sourceType: 'GOODS_RECEIPT', sourceDocumentId: matchingGrn.id }],
    })
    expect(ok.status).toBe(201)
    expect(ok.body.data.sourceMode).toBe('GRN')

    await deleteInvoice(ok.body.data.id)
    await prisma.goodsReceipt.deleteMany({ where: { id: { in: [mismatchGrn.id, matchingGrn.id] } } })
    await prisma.purchaseOrder.deleteMany({ where: { id: { in: [po.id, otherPo.id] } } })
  })

  it('keeps the vendor snapshot stable after a master edit, then refresh-from-master applies it', async () => {
    const created = await createDraft(fx)
    expect(created.status).toBe(201)
    const id = created.body.data.id as string

    await prisma.masterVendor.update({
      where: { id: fx.vendorId },
      data: { name: 'AP Alloc Vendor RENAMED Pvt Ltd' },
    })

    const afterEdit = await prisma.vendorInvoice.findUniqueOrThrow({ where: { id } })
    expect(afterEdit.vendorNameSnapshot).toBe('AP Alloc Vendor Pvt Ltd')

    const preview = await request(app)
      .post(`/api/v1/t/${fx.slug}/accounting/payables/vendor-invoices/${id}/refresh-from-master/preview`)
      .set('Authorization', `Bearer ${fx.token}`)
    expect(preview.status).toBe(200)
    expect(preview.body.data.changedFields).toContain('vendorNameSnapshot')
    expect(preview.body.data.proposed.vendorNameSnapshot).toBe('AP Alloc Vendor RENAMED Pvt Ltd')

    const apply = await request(app)
      .post(`/api/v1/t/${fx.slug}/accounting/payables/vendor-invoices/${id}/refresh-from-master`)
      .set('Authorization', `Bearer ${fx.token}`)
    expect(apply.status).toBe(200)

    const afterApply = await prisma.vendorInvoice.findUniqueOrThrow({ where: { id } })
    expect(afterApply.vendorNameSnapshot).toBe('AP Alloc Vendor RENAMED Pvt Ltd')

    await prisma.masterVendor.update({
      where: { id: fx.vendorId },
      data: { name: 'AP Alloc Vendor Pvt Ltd' },
    })
    await deleteInvoice(id)
  })

  it('rejects refresh-from-master on a non-DRAFT vendor invoice', async () => {
    const created = await createDraft(fx)
    const id = created.body.data.id as string
    const ready = await request(app)
      .post(`/api/v1/t/${fx.slug}/accounting/payables/vendor-invoices/${id}/mark-ready`)
      .set('Authorization', `Bearer ${fx.token}`)
      .send({ expectedUpdatedAt: created.body.data.updatedAt })
    expect(ready.status).toBe(200)

    const preview = await request(app)
      .post(`/api/v1/t/${fx.slug}/accounting/payables/vendor-invoices/${id}/refresh-from-master/preview`)
      .set('Authorization', `Bearer ${fx.token}`)
    expect(preview.status).toBe(422)

    await deleteInvoice(id)
  })

  it('lists tenant-scoped active vendors via the accounting lookup endpoint', async () => {
    const blocked = await prisma.masterVendor.create({
      data: {
        tenantId: fx.tenantId,
        code: `LB${Date.now()}`.slice(-8),
        name: 'Lookup Blocked Vendor',
        status: 'ACTIVE',
        isBlocked: true,
      },
    })

    const res = await request(app)
      .get(`/api/v1/t/${fx.slug}/accounting/lookups/vendors`)
      .query({ limit: 100 })
      .set('Authorization', `Bearer ${fx.token}`)
    expect(res.status).toBe(200)
    const ids = (res.body.data as Array<{ id: string }>).map((r) => r.id)
    expect(ids).toContain(fx.vendorId)
    expect(ids).not.toContain(blocked.id)
    expect(ids).not.toContain(foreign.vendorId)

    await prisma.masterVendor.delete({ where: { id: blocked.id } })
  })

  it('filters PO/GRN lookups to invoice-eligible documents and checks eligibility', async () => {
    const draftPo = await prisma.purchaseOrder.create({
      data: {
        tenantId: fx.tenantId,
        orderNumber: `PO-DR-${Date.now()}`,
        orderDate: new Date(fx.documentDate),
        vendorId: fx.vendorId,
        status: 'DRAFT',
      },
    })
    const approvedPo = await prisma.purchaseOrder.create({
      data: {
        tenantId: fx.tenantId,
        orderNumber: `PO-AP-${Date.now()}`,
        orderDate: new Date(fx.documentDate),
        vendorId: fx.vendorId,
        status: 'APPROVED',
      },
    })

    const list = await request(app)
      .get(`/api/v1/t/${fx.slug}/accounting/lookups/purchase-orders`)
      .query({ eligibleOnly: 'true', limit: 100 })
      .set('Authorization', `Bearer ${fx.token}`)
    expect(list.status).toBe(200)
    const ids = (list.body.data as Array<{ id: string }>).map((r) => r.id)
    expect(ids).toContain(approvedPo.id)
    expect(ids).not.toContain(draftPo.id)

    const mismatch = await request(app)
      .get(`/api/v1/t/${fx.slug}/accounting/lookups/purchase-orders/${approvedPo.id}/invoice-eligibility`)
      .query({ vendorId: fx.otherVendorId })
      .set('Authorization', `Bearer ${fx.token}`)
    expect(mismatch.status).toBe(200)
    expect(mismatch.body.data.eligible).toBe(false)
    expect(
      (mismatch.body.data.errors as Array<{ code: string }>).some((e) => e.code === 'PURCHASE_ORDER_VENDOR_MISMATCH'),
    ).toBe(true)

    const notFound = await request(app)
      .get(`/api/v1/t/${fx.slug}/accounting/lookups/grns/${randomUUID()}/invoice-eligibility`)
      .set('Authorization', `Bearer ${fx.token}`)
    expect(notFound.status).toBe(404)

    await prisma.purchaseOrder.deleteMany({ where: { id: { in: [draftPo.id, approvedPo.id] } } })
  })
})

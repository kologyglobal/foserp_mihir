import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import request from 'supertest'
import { createApp } from '../../src/app.js'
import { prisma } from '../../src/config/database.js'
import { PERMISSIONS } from '../../src/constants/permissions.js'
import {
  bootstrapApAllocFixture,
  cleanupTenant,
  createFinanceAdminTenant,
  createUserWithPerms,
  ensurePermissions,
  FINANCE_PERMS,
  type ApAllocFixture,
} from './helpers/ap-allocation-fixture.js'

const app = createApp()

const dbAvailable = await prisma
  .$queryRaw`SELECT 1`
  .then(() => true)
  .catch(() => false)

let supplierRefSeq = 0
function nextSupplierRef(): string {
  supplierRefSeq += 1
  return `SUP/FOUND/${Date.now()}/${supplierRefSeq}`
}

function debitNoteBody(fx: ApAllocFixture, overrides: Record<string, unknown> = {}) {
  return {
    legalEntityId: fx.legalEntityId,
    vendorId: fx.vendorId,
    adjustmentType: 'VENDOR_DEBIT_NOTE',
    reason: 'PURCHASE_RETURN',
    supplierReferenceNumber: nextSupplierRef(),
    supplierReferenceDate: fx.documentDate,
    documentDate: fx.documentDate,
    postingDate: fx.postingDate,
    currencyCode: 'INR',
    exchangeRate: '1',
    taxEffect: 'REVERSE_RECOVERABLE_INPUT_TAX',
    itcTreatment: 'FULL_ITC_REVERSAL',
    tdsTreatment: 'NO_TDS_CHANGE',
    purchaseTaxTreatment: 'REGULAR',
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
        description: 'Purchase return',
        quantity: '1',
        unitPrice: '10000',
        gstRate: '18',
        offsetAccountId: fx.purchaseAccountId,
      },
    ],
    ...overrides,
  }
}

describe.skipIf(!dbAvailable)('Phase 4C2 — vendor adjustment foundation', () => {
  let fx: ApAllocFixture

  beforeAll(async () => {
    await ensurePermissions()
    const ctx = await createFinanceAdminTenant(app, 'ap-vadj-found')
    fx = await bootstrapApAllocFixture(app, ctx)
  }, 180_000)

  afterAll(async () => {
    if (fx?.tenantId) await cleanupTenant(fx.tenantId)
  })

  it('permission constants include finance.ap.adjustment.* and finance.ap.corrections.view', () => {
    const required = [
      'finance.ap.adjustment.view',
      'finance.ap.adjustment.create',
      'finance.ap.adjustment.edit',
      'finance.ap.adjustment.submit',
      'finance.ap.adjustment.approve',
      'finance.ap.adjustment.post',
      'finance.ap.adjustment.cancel',
      'finance.ap.adjustment.reverse',
      'finance.ap.adjustment.mark_ready',
      'finance.ap.corrections.view',
    ]
    for (const perm of required) {
      expect(PERMISSIONS).toContain(perm)
    }
  })

  it('creates a DRAFT debit note, computes totals, and lists it', async () => {
    const created = await request(app)
      .post(`/api/v1/t/${fx.slug}/accounting/payables/vendor-adjustments`)
      .set('Authorization', `Bearer ${fx.token}`)
      .send(debitNoteBody(fx))
    expect(created.status).toBe(201)
    expect(created.body.data.status).toBe('DRAFT')
    expect(created.body.data.adjustmentType).toBe('VENDOR_DEBIT_NOTE')
    expect(Number(created.body.data.vendorPayableAmount)).toBe(11800)
    expect(created.body.data.validation?.isValid).toBe(true)
    const id = created.body.data.id as string

    const got = await request(app)
      .get(`/api/v1/t/${fx.slug}/accounting/payables/vendor-adjustments/${id}`)
      .set('Authorization', `Bearer ${fx.token}`)
    expect(got.status).toBe(200)
    expect(got.body.data.id).toBe(id)
    expect(got.body.data.lines).toHaveLength(1)

    const list = await request(app)
      .get(`/api/v1/t/${fx.slug}/accounting/payables/vendor-adjustments`)
      .query({ legalEntityId: fx.legalEntityId })
      .set('Authorization', `Bearer ${fx.token}`)
    expect(list.status).toBe(200)
    expect(list.body.data.some((item: { id: string }) => item.id === id)).toBe(true)
  }, 60_000)

  it('updates a draft debit note and recalculates totals', async () => {
    const created = await request(app)
      .post(`/api/v1/t/${fx.slug}/accounting/payables/vendor-adjustments`)
      .set('Authorization', `Bearer ${fx.token}`)
      .send(debitNoteBody(fx))
    expect(created.status).toBe(201)
    const id = created.body.data.id as string

    const patched = await request(app)
      .patch(`/api/v1/t/${fx.slug}/accounting/payables/vendor-adjustments/${id}`)
      .set('Authorization', `Bearer ${fx.token}`)
      .send(
        debitNoteBody(fx, {
          expectedUpdatedAt: created.body.data.updatedAt,
          lines: [
            {
              lineNumber: 1,
              lineType: 'EXPENSE',
              description: 'Purchase return revised',
              quantity: '1',
              unitPrice: '5000',
              gstRate: '18',
              offsetAccountId: fx.purchaseAccountId,
            },
          ],
        }),
      )
    expect(patched.status).toBe(200)
    expect(Number(patched.body.data.vendorPayableAmount)).toBe(5900)
  }, 60_000)

  it('marks a draft debit note ready and cancels it', async () => {
    const created = await request(app)
      .post(`/api/v1/t/${fx.slug}/accounting/payables/vendor-adjustments`)
      .set('Authorization', `Bearer ${fx.token}`)
      .send(debitNoteBody(fx))
    expect(created.status).toBe(201)
    const id = created.body.data.id as string

    const ready = await request(app)
      .post(`/api/v1/t/${fx.slug}/accounting/payables/vendor-adjustments/${id}/mark-ready`)
      .set('Authorization', `Bearer ${fx.token}`)
      .send({ expectedUpdatedAt: created.body.data.updatedAt })
    expect(ready.status).toBe(200)
    expect(ready.body.data.status).toBe('READY_TO_POST')

    const cancel = await request(app)
      .post(`/api/v1/t/${fx.slug}/accounting/payables/vendor-adjustments/${id}/cancel`)
      .set('Authorization', `Bearer ${fx.token}`)
      .send({ expectedUpdatedAt: ready.body.data.updatedAt, reason: 'No longer needed' })
    expect(cancel.status).toBe(200)
    expect(cancel.body.data.status).toBe('CANCELLED')
  }, 60_000)

  it('submits an approval-required adjustment, rejects it, then revises back to draft', async () => {
    const created = await request(app)
      .post(`/api/v1/t/${fx.slug}/accounting/payables/vendor-adjustments`)
      .set('Authorization', `Bearer ${fx.token}`)
      .send(debitNoteBody(fx, { approvalRequiredOverride: true }))
    expect(created.status).toBe(201)
    const id = created.body.data.id as string
    expect(created.body.data.approvalRequired).toBe(true)

    const submitted = await request(app)
      .post(`/api/v1/t/${fx.slug}/accounting/payables/vendor-adjustments/${id}/submit`)
      .set('Authorization', `Bearer ${fx.token}`)
      .send({ expectedUpdatedAt: created.body.data.updatedAt })
    expect(submitted.status).toBe(200)
    expect(submitted.body.data.status).toBe('PENDING_APPROVAL')

    const rejected = await request(app)
      .post(`/api/v1/t/${fx.slug}/accounting/payables/vendor-adjustments/${id}/reject`)
      .set('Authorization', `Bearer ${fx.token}`)
      .send({ expectedUpdatedAt: submitted.body.data.updatedAt, reason: 'Needs more supporting documents' })
    expect(rejected.status).toBe(200)
    expect(rejected.body.data.status).toBe('REJECTED')

    const revised = await request(app)
      .post(`/api/v1/t/${fx.slug}/accounting/payables/vendor-adjustments/${id}/revise`)
      .set('Authorization', `Bearer ${fx.token}`)
      .send({ expectedUpdatedAt: rejected.body.data.updatedAt, reason: 'Adding documents' })
    expect(revised.status).toBe(200)
    expect(revised.body.data.status).toBe('DRAFT')
  }, 60_000)

  it('blocks mark-ready when line amounts fail validation', async () => {
    const created = await request(app)
      .post(`/api/v1/t/${fx.slug}/accounting/payables/vendor-adjustments`)
      .set('Authorization', `Bearer ${fx.token}`)
      .send(
        debitNoteBody(fx, {
          lines: [
            {
              lineNumber: 1,
              lineType: 'EXPENSE',
              description: 'Invalid line',
              quantity: '1',
              unitPrice: '-500',
              gstRate: '18',
              offsetAccountId: fx.purchaseAccountId,
            },
          ],
        }),
      )
    expect(created.status).toBe(201)
    expect(created.body.data.validation?.isValid).toBe(false)
    const id = created.body.data.id as string

    const ready = await request(app)
      .post(`/api/v1/t/${fx.slug}/accounting/payables/vendor-adjustments/${id}/mark-ready`)
      .set('Authorization', `Bearer ${fx.token}`)
      .send({ expectedUpdatedAt: created.body.data.updatedAt })
    expect(ready.status).toBe(422)
    expect(ready.body.error?.code ?? ready.body.code).toBe('VENDOR_ADJUSTMENT_NOT_READY')
  }, 60_000)

  it('rejects create without required permission', async () => {
    const restrictedPerms = FINANCE_PERMS.filter((p) => !p.startsWith('finance.ap.adjustment.'))
    const restricted = await createUserWithPerms(app, fx.tenantId, fx.slug, restrictedPerms, 'vadj-restricted')

    const created = await request(app)
      .post(`/api/v1/t/${fx.slug}/accounting/payables/vendor-adjustments`)
      .set('Authorization', `Bearer ${restricted.token}`)
      .send(debitNoteBody(fx))
    expect(created.status).toBe(403)
  }, 60_000)

  it('enforces tenant isolation on vendor adjustment reads', async () => {
    const created = await request(app)
      .post(`/api/v1/t/${fx.slug}/accounting/payables/vendor-adjustments`)
      .set('Authorization', `Bearer ${fx.token}`)
      .send(debitNoteBody(fx))
    expect(created.status).toBe(201)
    const id = created.body.data.id as string

    const otherCtx = await createFinanceAdminTenant(app, 'ap-vadj-found-other')
    const otherFx = await bootstrapApAllocFixture(app, otherCtx)
    try {
      const got = await request(app)
        .get(`/api/v1/t/${otherFx.slug}/accounting/payables/vendor-adjustments/${id}`)
        .set('Authorization', `Bearer ${otherFx.token}`)
      expect(got.status).toBe(404)
    } finally {
      await cleanupTenant(otherFx.tenantId)
    }
  }, 60_000)
})

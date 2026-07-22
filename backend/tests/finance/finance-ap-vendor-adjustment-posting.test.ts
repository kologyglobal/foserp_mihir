import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import request from 'supertest'
import { createApp } from '../../src/app.js'
import { prisma } from '../../src/config/database.js'
import { buildVendorAdjustmentPostEventKey } from '../../src/modules/accounting/payables/vendor-adjustments/posting/vendor-adjustment-posting.types.js'
import {
  bootstrapApAllocFixture,
  cleanupTenant,
  createFinanceAdminTenant,
  createPostedCreditAdjustment,
  createPostedDebitNote,
  ensurePermissions,
  type ApAllocFixture,
} from './helpers/ap-allocation-fixture.js'

const app = createApp()

const dbAvailable = await prisma
  .$queryRaw`SELECT 1`
  .then(() => true)
  .catch(() => false)

describe.skipIf(!dbAvailable)('Phase 4C2 — vendor adjustment posting', () => {
  let fx: ApAllocFixture

  beforeAll(async () => {
    await ensurePermissions()
    const ctx = await createFinanceAdminTenant(app, 'ap-vadj-post')
    fx = await bootstrapApAllocFixture(app, ctx)
  }, 180_000)

  afterAll(async () => {
    if (fx?.tenantId) await cleanupTenant(fx.tenantId)
  })

  it('posts a debit note with ITC reversal and creates a DEBIT payable open item', async () => {
    const dn = await createPostedDebitNote(app, fx, { taxableAmount: '10000' })

    expect(Number(dn.vendorPayableAmount)).toBe(11800)

    const adjustment = await prisma.vendorAdjustment.findFirstOrThrow({
      where: { id: dn.documentId, tenantId: fx.tenantId },
    })
    expect(adjustment.status).toBe('POSTED')
    expect(adjustment.adjustmentType).toBe('VENDOR_DEBIT_NOTE')
    expect(adjustment.vendorAdjustmentNumber).toBeTruthy()

    const openItem = await prisma.payableOpenItem.findFirstOrThrow({
      where: { tenantId: fx.tenantId, sourceVendorAdjustmentId: dn.documentId },
    })
    expect(openItem.side).toBe('DEBIT')
    expect(openItem.documentType).toBe('VENDOR_DEBIT_NOTE')
    expect(Number(openItem.originalAmount)).toBe(11800)
    expect(Number(openItem.outstandingAmount)).toBe(11800)
    expect(Number(openItem.allocatedAmount)).toBe(0)

    const event = await prisma.postingEvent.findFirst({
      where: {
        tenantId: fx.tenantId,
        eventKey: buildVendorAdjustmentPostEventKey(dn.documentId),
      },
    })
    expect(event).toBeTruthy()

    const gl = await prisma.generalLedgerEntry.findMany({
      where: { tenantId: fx.tenantId, voucherId: adjustment.accountingVoucherId! },
    })
    const debitByAccount = new Map<string, number>()
    const creditByAccount = new Map<string, number>()
    for (const row of gl) {
      if (Number(row.baseDebitAmount) > 0) {
        debitByAccount.set(row.accountId, (debitByAccount.get(row.accountId) ?? 0) + Number(row.baseDebitAmount))
      }
      if (Number(row.baseCreditAmount) > 0) {
        creditByAccount.set(row.accountId, (creditByAccount.get(row.accountId) ?? 0) + Number(row.baseCreditAmount))
      }
    }
    expect(debitByAccount.get(fx.payableAccountId)).toBe(11800)
    expect(creditByAccount.get(fx.purchaseAccountId)).toBe(10000)
    const gstInCgst = await prisma.account.findFirst({
      where: { tenantId: fx.tenantId, legalEntityId: fx.legalEntityId, accountCode: '520101' },
    })
    const gstInSgst = await prisma.account.findFirst({
      where: { tenantId: fx.tenantId, legalEntityId: fx.legalEntityId, accountCode: '520102' },
    })
    expect(creditByAccount.get(gstInCgst!.id)).toBe(900)
    expect(creditByAccount.get(gstInSgst!.id)).toBe(900)
  }, 120_000)

  it('posts a credit adjustment with ITC addition and creates a CREDIT payable open item', async () => {
    const ca = await createPostedCreditAdjustment(app, fx, { taxableAmount: '5000' })

    expect(Number(ca.vendorPayableAmount)).toBe(5900)

    const adjustment = await prisma.vendorAdjustment.findFirstOrThrow({
      where: { id: ca.documentId, tenantId: fx.tenantId },
    })
    expect(adjustment.status).toBe('POSTED')
    expect(adjustment.adjustmentType).toBe('VENDOR_CREDIT_ADJUSTMENT')

    const openItem = await prisma.payableOpenItem.findFirstOrThrow({
      where: { tenantId: fx.tenantId, sourceVendorAdjustmentId: ca.documentId },
    })
    expect(openItem.side).toBe('CREDIT')
    expect(openItem.documentType).toBe('VENDOR_CREDIT_ADJUSTMENT')
    expect(Number(openItem.originalAmount)).toBe(5900)
    expect(Number(openItem.outstandingAmount)).toBe(5900)

    const gl = await prisma.generalLedgerEntry.findMany({
      where: { tenantId: fx.tenantId, voucherId: adjustment.accountingVoucherId! },
    })
    const debitByAccount = new Map<string, number>()
    const creditByAccount = new Map<string, number>()
    for (const row of gl) {
      if (Number(row.baseDebitAmount) > 0) {
        debitByAccount.set(row.accountId, (debitByAccount.get(row.accountId) ?? 0) + Number(row.baseDebitAmount))
      }
      if (Number(row.baseCreditAmount) > 0) {
        creditByAccount.set(row.accountId, (creditByAccount.get(row.accountId) ?? 0) + Number(row.baseCreditAmount))
      }
    }
    expect(creditByAccount.get(fx.payableAccountId)).toBe(5900)
    expect(debitByAccount.get(fx.purchaseAccountId)).toBe(5000)
  }, 120_000)

  it('rejects duplicate post (idempotent replay returns same result)', async () => {
    const created = await request(app)
      .post(`/api/v1/t/${fx.slug}/accounting/payables/vendor-adjustments`)
      .set('Authorization', `Bearer ${fx.token}`)
      .send({
        legalEntityId: fx.legalEntityId,
        vendorId: fx.vendorId,
        adjustmentType: 'VENDOR_DEBIT_NOTE',
        reason: 'OTHER',
        supplierReferenceNumber: `DUP/${Date.now()}`,
        supplierReferenceDate: fx.documentDate,
        documentDate: fx.documentDate,
        postingDate: fx.postingDate,
        taxEffect: 'NONE',
        itcTreatment: 'NO_ITC_CHANGE',
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
            description: 'Round-off',
            quantity: '1',
            unitPrice: '100',
            gstRate: '0',
            offsetAccountId: fx.purchaseAccountId,
          },
        ],
      })
    expect(created.status).toBe(201)
    const id = created.body.data.id as string
    const ready = await request(app)
      .post(`/api/v1/t/${fx.slug}/accounting/payables/vendor-adjustments/${id}/mark-ready`)
      .set('Authorization', `Bearer ${fx.token}`)
      .send({ expectedUpdatedAt: created.body.data.updatedAt })
    expect(ready.status).toBe(200)

    const post1 = await request(app)
      .post(`/api/v1/t/${fx.slug}/accounting/payables/vendor-adjustments/${id}/post`)
      .set('Authorization', `Bearer ${fx.token}`)
      .send({ expectedUpdatedAt: ready.body.data.updatedAt })
    expect(post1.status).toBe(200)

    const post2 = await request(app)
      .post(`/api/v1/t/${fx.slug}/accounting/payables/vendor-adjustments/${id}/post`)
      .set('Authorization', `Bearer ${fx.token}`)
      .send({ expectedUpdatedAt: ready.body.data.updatedAt })
    expect(post2.status).toBe(200)
    expect(post2.body.data.idempotentReplay).toBe(true)
    expect(post2.body.data.accountingVoucherId).toBe(post1.body.data.accountingVoucherId)
  }, 120_000)
})

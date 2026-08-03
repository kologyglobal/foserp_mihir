/**
 * O2C close slice: Confirmed Dispatch → invoice-ready → create SI → post → allocate.
 * Exercises HTTP invoice-ready / prefill-from-dispatch (manual path), not auto-draft alone.
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
function ar(slug: string) {
  return `/api/v1/t/${slug}/accounting/receivables`
}
function acct(slug: string) {
  return `/api/v1/t/${slug}/accounting`
}

async function cleanupO2cTenant(tenantId: string): Promise<void> {
  await prisma.customerReceiptAllocation.deleteMany({ where: { tenantId } }).catch(() => {})
  await prisma.customerReceiptAllocationBatch.deleteMany({ where: { tenantId } }).catch(() => {})
  await prisma.receivableOpenItem.deleteMany({ where: { tenantId } }).catch(() => {})
  await prisma.customerReceiptDeductionLine.deleteMany({ where: { tenantId } }).catch(() => {})
  await prisma.customerReceipt.deleteMany({ where: { tenantId } }).catch(() => {})
  await prisma.salesInvoiceSourceLink.deleteMany({ where: { tenantId } }).catch(() => {})
  await prisma.salesInvoiceLine.deleteMany({ where: { tenantId } }).catch(() => {})
  await prisma.salesInvoice.deleteMany({ where: { tenantId } }).catch(() => {})
  await prisma.dispatchDomainEvent.deleteMany({ where: { tenantId } }).catch(() => {})
  await prisma.dispatchReversalLine.deleteMany({ where: { tenantId } }).catch(() => {})
  await prisma.dispatchReversal.deleteMany({ where: { tenantId } }).catch(() => {})
  await prisma.dispatchPostingLine.deleteMany({ where: { tenantId } }).catch(() => {})
  await prisma.dispatchPosting.deleteMany({ where: { tenantId } }).catch(() => {})
  await prisma.inventoryAccountingEvent.deleteMany({ where: { tenantId } }).catch(() => {})
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
  await prisma.outboundDispatchLine
    .updateMany({ where: { tenantId }, data: { inventoryMovementId: null } })
    .catch(() => {})
  await prisma.outboundDispatchLine.deleteMany({ where: { tenantId } }).catch(() => {})
  await prisma.outboundDispatch.deleteMany({ where: { tenantId } }).catch(() => {})
  await prisma.dispatchRequirement.deleteMany({ where: { tenantId } }).catch(() => {})
  await prisma.salesOrderLineFulfilment.deleteMany({ where: { tenantId } }).catch(() => {})
  await prisma.generalLedgerEntry.deleteMany({ where: { tenantId } }).catch(() => {})
  await prisma.accountingVoucherLine.deleteMany({ where: { tenantId } }).catch(() => {})
  await prisma.postingEvent.deleteMany({ where: { tenantId } }).catch(() => {})
  await prisma.accountingVoucher.deleteMany({ where: { tenantId } }).catch(() => {})
  await prisma.inventoryStockMovement.deleteMany({ where: { tenantId } }).catch(() => {})
  await prisma.inventoryStockReservation.deleteMany({ where: { tenantId } }).catch(() => {})
  await prisma.inventoryStockBalance.deleteMany({ where: { tenantId } }).catch(() => {})
  await prisma.defaultAccountMapping.deleteMany({ where: { tenantId } }).catch(() => {})
  await prisma.financeNumberSeries.deleteMany({ where: { tenantId } }).catch(() => {})
  await prisma.financeSettings.deleteMany({ where: { tenantId } }).catch(() => {})
  await prisma.account.deleteMany({ where: { tenantId } }).catch(() => {})
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

describe.skipIf(!dbAvailable)('Dispatch O2C — invoice-ready → SI post → allocate', () => {
  let fx: ManufacturingFixture
  let token: string
  let legalEntityId: string
  let bankAccountId: string
  let postingDate: string

  beforeAll(async () => {
    await ensurePermissions()
    const slug = `o2c-si-${Date.now()}-${Math.floor(Math.random() * 1000)}`
    const tenant = await prisma.tenant.create({
      data: { name: 'O2C Invoice Allocate Co', slug, email: `${slug}@test.com`, status: 'ACTIVE' },
    })
    const admin = await createUserWithPerms(app, tenant.id, slug, PERMS, 'o2c-admin')
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

    const now = new Date()
    postingDate = now.toISOString().slice(0, 10)
    const fyStartYear = now.getUTCMonth() >= 3 ? now.getUTCFullYear() : now.getUTCFullYear() - 1
    const fyStart = `${fyStartYear}-04-01`
    const fyEnd = `${fyStartYear + 1}-03-31`

    const leRes = await request(app)
      .post(`${acct(fx.slug)}/legal-entities`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        code: `LE${Date.now()}`.slice(-8),
        legalName: 'O2C Invoice LE Pvt Ltd',
        displayName: 'O2C Invoice LE',
        stateCode: '27',
      })
    expect(leRes.status).toBe(201)
    legalEntityId = leRes.body.data.id as string

    const fyRes = await request(app)
      .post(`${acct(fx.slug)}/financial-years`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        legalEntityId,
        name: `FY ${fyStartYear}-${String(fyStartYear + 1).slice(-2)}`,
        startDate: fyStart,
        endDate: fyEnd,
        isCurrent: true,
      })
    expect(fyRes.status).toBe(201)
    await request(app)
      .post(`${acct(fx.slug)}/financial-years/${fyRes.body.data.id}/activate`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200)

    await request(app)
      .post(`${acct(fx.slug)}/accounts/apply-template`)
      .set('Authorization', `Bearer ${token}`)
      .send({ legalEntityId, templateId: 'TRADING' })
      .expect(201)

    const sales = await prisma.account.findFirst({
      where: { tenantId: fx.tenantId, legalEntityId, accountType: 'SALES', isGroup: false },
    })
    const receivable = await prisma.account.findFirst({
      where: { tenantId: fx.tenantId, legalEntityId, accountType: 'CUSTOMER_RECEIVABLE', isGroup: false },
    })
    const payable = await prisma.account.findFirst({
      where: { tenantId: fx.tenantId, legalEntityId, accountType: 'VENDOR_PAYABLE', isGroup: false },
    })
    const purchase = await prisma.account.findFirst({
      where: { tenantId: fx.tenantId, legalEntityId, accountType: 'PURCHASE', isGroup: false },
    })
    const retained = await prisma.account.findFirst({
      where: { tenantId: fx.tenantId, legalEntityId, accountType: 'RETAINED_EARNINGS', isGroup: false },
    })
    const bank = await prisma.account.findFirst({
      where: { tenantId: fx.tenantId, legalEntityId, accountType: 'BANK', isGroup: false },
    })
    expect(sales && receivable && payable && purchase && retained && bank).toBeTruthy()
    bankAccountId = bank!.id

    const gstInCgst = await prisma.account.findFirst({
      where: { tenantId: fx.tenantId, legalEntityId, accountCode: '520101' },
    })
    const gstInSgst = await prisma.account.findFirst({
      where: { tenantId: fx.tenantId, legalEntityId, accountCode: '520102' },
    })
    const gstInIgst = await prisma.account.findFirst({
      where: { tenantId: fx.tenantId, legalEntityId, accountCode: '520103' },
    })
    const gstOutCgst = await prisma.account.findFirst({
      where: { tenantId: fx.tenantId, legalEntityId, accountCode: '220101' },
    })
    const gstOutSgst = await prisma.account.findFirst({
      where: { tenantId: fx.tenantId, legalEntityId, accountCode: '220102' },
    })
    const gstOutIgst = await prisma.account.findFirst({
      where: { tenantId: fx.tenantId, legalEntityId, accountCode: '220103' },
    })

    await request(app)
      .put(`${acct(fx.slug)}/default-mappings`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        legalEntityId,
        mappings: [
          { mappingKey: 'CUSTOMER_RECEIVABLE', accountId: receivable!.id },
          { mappingKey: 'VENDOR_PAYABLE', accountId: payable!.id },
          { mappingKey: 'SALES_REVENUE', accountId: sales!.id },
          { mappingKey: 'PURCHASE', accountId: purchase!.id },
          { mappingKey: 'GST_INPUT_CGST', accountId: gstInCgst!.id },
          { mappingKey: 'GST_INPUT_SGST', accountId: gstInSgst!.id },
          { mappingKey: 'GST_INPUT_IGST', accountId: gstInIgst!.id },
          { mappingKey: 'GST_OUTPUT_CGST', accountId: gstOutCgst!.id },
          { mappingKey: 'GST_OUTPUT_SGST', accountId: gstOutSgst!.id },
          { mappingKey: 'GST_OUTPUT_IGST', accountId: gstOutIgst!.id },
          { mappingKey: 'RETAINED_EARNINGS', accountId: retained!.id },
        ],
      })
      .expect(200)

    await request(app)
      .put(`${acct(fx.slug)}/number-series`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        legalEntityId,
        series: ['JOURNAL', 'RECEIPT', 'PAYMENT', 'CONTRA', 'CREDIT_NOTE', 'DEBIT_NOTE', 'OPENING_BALANCE', 'REVERSAL'].map(
          (documentType) => ({
            documentType,
            prefix: `${documentType.slice(0, 2)}-`,
            padLength: 5,
            resetEachYear: true,
            isActive: true,
          }),
        ),
      })
      .expect(200)

    await request(app)
      .post(`${acct(fx.slug)}/activate`)
      .set('Authorization', `Bearer ${token}`)
      .send({ legalEntityId })
      .expect(200)

    await prisma.financeNumberSeries.create({
      data: {
        tenantId: fx.tenantId,
        legalEntityId,
        documentType: 'SALES_INVOICE',
        prefix: 'SINV-',
        currentValue: 0,
        padLength: 6,
        isActive: true,
      },
    })
    await prisma.financeNumberSeries.create({
      data: {
        tenantId: fx.tenantId,
        legalEntityId,
        documentType: 'CUSTOMER_RECEIPT',
        prefix: 'RCPT-',
        currentValue: 0,
        padLength: 6,
        isActive: true,
      },
    })

    await request(app)
      .post(`${inv(fx.slug)}/movements/opening`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        itemId: fx.itemId,
        warehouseId: fx.warehouseId,
        quantity: 50,
        referenceNo: 'OPN-O2C',
      })
  }, 180_000)

  afterAll(async () => {
    if (fx?.tenantId) await cleanupO2cTenant(fx.tenantId)
  })

  function auth(req: request.Test) {
    return req.set('Authorization', `Bearer ${token}`)
  }

  async function preparePostedDispatch(qty: number, key: string) {
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
          idempotencyKey: `o2c-${key}-draft-${reqId}`,
        }),
    )
    expect(draft.status).toBe(201)
    const obId = draft.body.data.id as string
    const obLineId = draft.body.data.lines[0].id as string

    await auth(
      request(app)
        .post(`${dsp(fx.slug)}/orders/${obId}/reservations`)
        .send({
          lines: [{ outboundDispatchLineId: obLineId, quantity: qty }],
          idempotencyKey: `o2c-${key}-res-${obId}`,
        }),
    )
    const pickLists = await auth(
      request(app)
        .post(`${dsp(fx.slug)}/orders/${obId}/pick-lists`)
        .send({ idempotencyKey: `o2c-${key}-pkl-${obId}` }),
    )
    const pklId = pickLists.body.data[0].id as string
    const pickLineId = pickLists.body.data[0].lines[0].id as string
    await auth(request(app).post(`${dsp(fx.slug)}/pick-lists/${pklId}/release`))
    await auth(request(app).post(`${dsp(fx.slug)}/pick-lists/${pklId}/start`))
    await auth(
      request(app)
        .post(`${dsp(fx.slug)}/pick-lists/${pklId}/pick`)
        .send({
          pickLineId,
          quantity: qty,
          idempotencyKey: `o2c-${key}-pick-${pickLineId}`,
        }),
    )
    await auth(request(app).post(`${dsp(fx.slug)}/pick-lists/${pklId}/complete`))

    const sessions = await auth(
      request(app)
        .post(`${dsp(fx.slug)}/orders/${obId}/packing-sessions`)
        .send({ idempotencyKey: `o2c-${key}-pack-${obId}` }),
    )
    const sessionId = sessions.body.data[0].id as string
    await auth(request(app).post(`${dsp(fx.slug)}/packing-sessions/${sessionId}/start`))
    const pkg = await auth(
      request(app)
        .post(`${dsp(fx.slug)}/packing-sessions/${sessionId}/packages`)
        .send({ packageReference: `BOX-${key}` }),
    )
    const packageId = pkg.body.data.id as string
    await auth(
      request(app)
        .post(`${dsp(fx.slug)}/packages/${packageId}/pack`)
        .send({ pickLineId, quantity: qty, idempotencyKey: `o2c-${key}-pkline-${packageId}` }),
    )
    await auth(request(app).post(`${dsp(fx.slug)}/packing-sessions/${sessionId}/complete`))
    await auth(request(app).post(`${dsp(fx.slug)}/packing-sessions/${sessionId}/verify`))

    const challan = await auth(
      request(app)
        .post(`${dsp(fx.slug)}/orders/${obId}/delivery-challans`)
        .send({ idempotencyKey: `o2c-${key}-dc-${obId}` }),
    )
    const challanId = challan.body.data.id as string
    await auth(request(app).post(`${dsp(fx.slug)}/delivery-challans/${challanId}/ready-for-review`))
    await auth(request(app).post(`${dsp(fx.slug)}/delivery-challans/${challanId}/approve`))
    await auth(
      request(app)
        .post(`${dsp(fx.slug)}/delivery-challans/${challanId}/issue`)
        .send({ idempotencyKey: `o2c-${key}-issue-${challanId}` }),
    )

    const posted = await auth(request(app).post(`${dsp(fx.slug)}/outbound/${obId}/post`).send({}))
    expect(posted.status).toBe(200)
    expect(posted.body.data.status).toBe('CONFIRMED')

    return { obId, obLineId, salesOrderId: so.salesOrderId, customerId: so.companyId, qty }
  }

  async function releaseAutoDraftInvoices(outboundDispatchId: string) {
    await prisma.salesInvoiceSourceLink.updateMany({
      where: { tenantId: fx.tenantId, sourceDocumentId: outboundDispatchId, status: 'ACTIVE' },
      data: { status: 'RELEASED' },
    })
    await prisma.salesInvoice.updateMany({
      where: {
        tenantId: fx.tenantId,
        sourceDocumentId: outboundDispatchId,
        status: { in: ['DRAFT', 'READY_TO_POST'] },
      },
      data: { status: 'CANCELLED', cancellationReason: 'o2c UAT release for manual path' },
    })
  }

  it(
    'post → invoice-ready → prefill → create SI (sourceLinks) → post → allocate',
    async () => {
      const prepared = await preparePostedDispatch(2, 'close')
      await releaseAutoDraftInvoices(prepared.obId)

      const ready = await auth(
        request(app)
          .get(`${ar(fx.slug)}/invoices/invoice-ready`)
          .query({ outboundDispatchId: prepared.obId, readyOnly: true, limit: 50 }),
      )
      expect(ready.status).toBe(200)
      expect(Array.isArray(ready.body.data)).toBe(true)
      expect(ready.body.data.length).toBeGreaterThan(0)
      const lineIds = (ready.body.data as Array<{ outboundDispatchLineId: string; invoiceReadyQty: string }>).map(
        (r) => r.outboundDispatchLineId,
      )
      expect(lineIds).toContain(prepared.obLineId)
      const readyQty = Number(
        (ready.body.data as Array<{ outboundDispatchLineId: string; invoiceReadyQty: string }>).find(
          (r) => r.outboundDispatchLineId === prepared.obLineId,
        )?.invoiceReadyQty ?? 0,
      )
      expect(readyQty).toBe(prepared.qty)

      const prefill = await auth(
        request(app)
          .post(`${ar(fx.slug)}/invoices/prefill-from-dispatch`)
          .send({ outboundDispatchLineIds: lineIds }),
      )
      expect(prefill.status).toBe(200)
      expect(prefill.body.data.sourceType).toBe('OUTBOUND_DISPATCH')
      expect(prefill.body.data.sourceDocumentId).toBe(prepared.obId)
      expect(prefill.body.data.sourceLinks?.length).toBeGreaterThan(0)

      const company = await prisma.crmCompany.findFirstOrThrow({
        where: { id: prepared.customerId, tenantId: fx.tenantId },
      })
      await prisma.crmCompany.update({
        where: { id: company.id },
        data: {
          gstin: '27AAAAA0000A1Z5',
          pan: 'AAAAA0000A',
          state: '27',
        },
      })

      const created = await auth(
        request(app)
          .post(`${ar(fx.slug)}/invoices`)
          .send({
            legalEntityId,
            customerId: prepared.customerId,
            sourceType: 'OUTBOUND_DISPATCH',
            sourceDocumentId: prepared.obId,
            invoiceDate: postingDate,
            postingDate,
            placeOfSupply: '27',
            taxTreatment: 'REGISTERED',
            currencyCode: 'INR',
            freightAmount: prefill.body.data.freightAmount ?? '0',
            customerPoNumber: prefill.body.data.customerPoNumber,
            narration: `O2C from dispatch ${prepared.obId}`,
            lines: prefill.body.data.lines.map(
              (l: {
                lineNumber: number
                itemId: string
                itemCode: string | null
                itemName: string | null
                description: string
                quantity: string
                unitPrice: string
                discountPct: number
                taxPct: number
                sourceLineId: string
                uom: string | null
                hsnCode: string | null
              }) => ({
                lineNumber: l.lineNumber,
                itemId: l.itemId,
                itemCode: l.itemCode,
                itemName: l.itemName,
                description: l.description,
                quantity: l.quantity,
                unitPrice: l.unitPrice,
                discountType: l.discountPct > 0 ? 'PERCENTAGE' : undefined,
                discountValue: l.discountPct > 0 ? String(l.discountPct) : undefined,
                gstRate: l.taxPct > 0 ? String(l.taxPct) : '18',
                uom: l.uom,
                hsnCode: l.hsnCode ?? '87089990',
                sourceLineId: l.sourceLineId,
              }),
            ),
            sourceLinks: prefill.body.data.sourceLinks,
          }),
      )
      if (created.status !== 201) {
        throw new Error(`SI create failed: ${created.status} ${JSON.stringify(created.body)}`)
      }
      const invoiceId = created.body.data.id as string
      const links = await prisma.salesInvoiceSourceLink.findMany({
        where: { tenantId: fx.tenantId, salesInvoiceId: invoiceId, status: 'ACTIVE' },
      })
      expect(links.some((l) => l.sourceType === 'OUTBOUND_DISPATCH' && l.sourceLineId === prepared.obLineId)).toBe(
        true,
      )

      const readyAfter = await auth(
        request(app)
          .get(`${ar(fx.slug)}/invoices/invoice-ready`)
          .query({ outboundDispatchId: prepared.obId, readyOnly: true, limit: 50 }),
      )
      expect(readyAfter.status).toBe(200)
      expect(readyAfter.body.data.length).toBe(0)

      await auth(request(app).post(`${ar(fx.slug)}/invoices/${invoiceId}/mark-ready`)).expect(200)
      const postedSi = await auth(request(app).post(`${ar(fx.slug)}/invoices/${invoiceId}/post`).send({}))
      expect(postedSi.status).toBe(200)
      expect(postedSi.body.data.invoice.status).toBe('POSTED')

      const openItem = await prisma.receivableOpenItem.findFirstOrThrow({
        where: { tenantId: fx.tenantId, salesInvoiceId: invoiceId, side: 'DEBIT' },
      })
      const outstanding = openItem.openAmount.toFixed(4)

      const receipt = await auth(
        request(app)
          .post(`${ar(fx.slug)}/receipts`)
          .send({
            legalEntityId,
            customerId: prepared.customerId,
            sourceType: 'DIRECT',
            receiptDate: postingDate,
            postingDate,
            paymentMethod: 'BANK_TRANSFER',
            currencyCode: 'INR',
            bankCashAmount: outstanding,
            bankCashAccountId: bankAccountId,
            transactionReference: `O2C-TXN-${Date.now()}`,
          }),
      )
      expect(receipt.status).toBe(201)
      const receiptId = receipt.body.data.id as string
      await auth(request(app).post(`${ar(fx.slug)}/receipts/${receiptId}/mark-ready`)).expect(200)
      const postedRcpt = await auth(request(app).post(`${ar(fx.slug)}/receipts/${receiptId}/post`).send({}))
      expect(postedRcpt.status).toBe(200)

      const alloc = await auth(
        request(app)
          .post(`${ar(fx.slug)}/receipts/${receiptId}/allocations`)
          .set('Idempotency-Key', `o2c-alloc-${receiptId}`)
          .send({
            allocationDate: postingDate,
            allocations: [
              {
                invoiceId,
                invoiceOpenItemId: openItem.id,
                amount: outstanding,
              },
            ],
          }),
      )
      expect(alloc.status).toBe(200)

      const debitAfter = await prisma.receivableOpenItem.findFirstOrThrow({ where: { id: openItem.id } })
      expect(Number(debitAfter.openAmount)).toBe(0)
      expect(Number(debitAfter.allocatedAmount)).toBe(Number(outstanding))
    },
    240_000,
  )
})

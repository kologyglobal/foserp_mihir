import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  defaults: vi.fn(),
  nextCode: vi.fn(),
  vendor: vi.fn(),
  po: vi.fn(),
  grn: vi.fn(),
  create: vi.fn(),
  findById: vi.fn(),
  update: vi.fn(),
  history: vi.fn(),
}))

vi.mock('../src/modules/purchase/shared/purchase-defaults.js', () => ({
  resolveEffectivePurchaseDefaults: mocks.defaults,
}))
vi.mock('../src/services/codeSeries.service.js', () => ({ nextCode: mocks.nextCode }))
vi.mock('../src/modules/purchase/invoices/purchase-invoice.repository.js', () => ({
  includePurchaseInvoice: { lines: true },
  findPurchaseInvoiceById: mocks.findById,
  updatePurchaseInvoice: mocks.update,
  addInvoiceHistory: mocks.history,
  findPurchaseInvoices: vi.fn(),
  replacePurchaseInvoiceLines: vi.fn(),
}))
vi.mock('../src/config/database.js', () => ({
  prisma: {
    masterVendor: { findFirst: mocks.vendor },
    purchaseOrder: { findFirst: mocks.po },
    goodsReceipt: { findFirst: mocks.grn },
    purchaseInvoice: { create: mocks.create },
    $transaction: vi.fn(async (arg: unknown) => typeof arg === 'function'
      ? (arg as (tx: unknown) => unknown)({
          purchaseInvoice: { create: mocks.create },
          purchaseStatusHistory: { create: vi.fn() },
        })
      : Promise.all(arg as Promise<unknown>[])),
  },
}))

import {
  createPurchaseInvoice,
  submitPurchaseInvoice,
} from '../src/modules/purchase/invoices/purchase-invoice.service.js'

const defaults = (overrides: Record<string, unknown> = {}) => ({
  allowDirectInvoice: true,
  requirePoMatch: false,
  requireGrnMatch: false,
  quantityTolerancePct: 0,
  rateTolerancePct: 0,
  amountToleranceInr: 0,
  amountTolerancePct: 0,
  taxToleranceInr: 0,
  taxTolerancePct: 0,
  allowAuthorizedOverride: true,
  defaultCurrencyCode: 'INR',
  defaultGstScheme: 'CGST_SGST',
  placeOfSupplyState: null,
  placeOfSupplyStateCode: null,
  reverseChargeDefault: false,
  ...overrides,
})

const input = {
  vendorId: '10000000-0000-4000-8000-000000000001',
  lines: [{ quantity: 10, rate: 100, taxRatePct: 0 }],
}

describe('Purchase invoice lifecycle policy', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.defaults.mockResolvedValue(defaults())
    mocks.nextCode.mockResolvedValue('PI-000001')
    mocks.vendor.mockResolvedValue({ id: input.vendorId })
    mocks.po.mockResolvedValue(null)
    mocks.grn.mockResolvedValue(null)
    mocks.create.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({
      id: '20000000-0000-4000-8000-000000000001',
      ...data,
      invoiceDate: new Date('2026-07-21'),
      createdAt: new Date(),
      updatedAt: new Date(),
      deletedAt: null,
      submittedAt: null,
      approvedAt: null,
      postedAt: null,
      cancelledAt: null,
      lines: (data.lines as { create: unknown[] }).create.map((line, index) => ({ id: `line-${index}`, ...line })),
    }))
  })

  it('creates a direct invoice with the configured code series', async () => {
    const result = await createPurchaseInvoice('tenant-1', 'actor-1', input)
    expect(result.invoiceNumber).toBe('PI-000001')
    expect(result.isDirectInvoice).toBe(true)
    expect(mocks.nextCode).toHaveBeenCalledWith('tenant-1', 'PURCHASE_INVOICE')
  })

  it('blocks direct invoices when allowDirectInvoice is false', async () => {
    mocks.defaults.mockResolvedValue(defaults({ allowDirectInvoice: false }))
    await expect(createPurchaseInvoice('tenant-1', 'actor-1', input)).rejects.toThrow('Invoice matching requirements are not met')
    expect(mocks.create).not.toHaveBeenCalled()
  })

  it('requires both PO and GRN references when matching flags are enabled', async () => {
    mocks.defaults.mockResolvedValue(defaults({ requirePoMatch: true, requireGrnMatch: true }))
    await expect(createPurchaseInvoice('tenant-1', 'actor-1', input)).rejects.toMatchObject({
      errors: expect.arrayContaining([
        expect.objectContaining({ field: 'purchaseOrderId' }),
        expect.objectContaining({ field: 'goodsReceiptId' }),
      ]),
    })
  })

  it('allows an authorized, remarked tolerance override on submit', async () => {
    const poId = '30000000-0000-4000-8000-000000000001'
    const grnId = '40000000-0000-4000-8000-000000000001'
    const poLineId = '50000000-0000-4000-8000-000000000001'
    const grnLineId = '60000000-0000-4000-8000-000000000001'
    const invoice = {
      id: '20000000-0000-4000-8000-000000000001', tenantId: 'tenant-1', invoiceNumber: 'PI-000001',
      invoiceDate: new Date(), vendorInvoiceNumber: null, vendorInvoiceDate: null, vendorId: input.vendorId,
      purchaseOrderId: poId, goodsReceiptId: grnId, status: 'DRAFT', isDirectInvoice: false,
      currencyCode: 'INR', gstScheme: 'CGST_SGST', placeOfSupplyState: null, placeOfSupplyStateCode: null,
      reverseCharge: false, subtotalAmount: 1200, taxAmount: 0, roundOffAmount: 0, totalAmount: 1200,
      matchingStatus: null, matchingRemarks: null, overrideAuthorized: false, overrideRemarks: null,
      remarks: null, submittedAt: null, approvedAt: null, postedAt: null, cancelledAt: null,
      createdById: 'actor-1', updatedById: 'actor-1', createdAt: new Date(), updatedAt: new Date(), deletedAt: null,
      lines: [{
        id: 'line-1', tenantId: 'tenant-1', purchaseInvoiceId: 'invoice-1', lineNumber: 1,
        purchaseOrderLineId: poLineId, goodsReceiptLineId: grnLineId, itemId: null,
        itemCodeSnapshot: '', itemNameSnapshot: '', description: null, quantity: 12,
        uomCodeSnapshot: 'EA', rate: 100, amount: 1200, taxRatePct: 0, taxAmount: 0,
        lineTotal: 1200, remarks: null, createdAt: new Date(), updatedAt: new Date(),
      }],
    }
    mocks.defaults.mockResolvedValue(defaults({ requirePoMatch: true, requireGrnMatch: true }))
    mocks.po.mockResolvedValue({ id: poId, vendorId: input.vendorId, lines: [{ id: poLineId, quantity: 10, rate: 100 }] })
    mocks.grn.mockResolvedValue({ id: grnId, purchaseOrderId: poId, vendorId: input.vendorId, lines: [{ id: grnLineId, purchaseOrderLineId: poLineId, receivedQuantity: 10 }] })
    mocks.findById.mockResolvedValue(invoice)
    await expect(submitPurchaseInvoice('tenant-1', invoice.id, 'actor-2')).rejects.toThrow('tolerances exceeded')
    await expect(submitPurchaseInvoice('tenant-1', invoice.id, 'actor-2', {
      overrideAuthorized: true, overrideRemarks: 'Approved price/quantity variance',
    })).resolves.toBeTruthy()
    expect(mocks.update).toHaveBeenCalledWith('tenant-1', invoice.id, expect.objectContaining({
      status: 'PENDING_APPROVAL', overrideAuthorized: true,
    }), expect.anything())
  })
})

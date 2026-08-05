import { Prisma } from '@prisma/client'
import { createAuditLog } from '../../../services/audit.service.js'
import { NotFoundError, ValidationError } from '../../../utils/errors.js'
import {
  assertCrmTaxInvoiceAllowsCommercialAllocation,
} from '../../accounting/receivables/source/crm-payment-receipt-ar.service.js'
import * as repo from './commercial.repository.js'
import type {
  AllocatePaymentsInput,
  CreateInvoiceInput,
  CreateProformaInput,
  CreateReceiptInput,
  ListAllocationsQuery,
  ListInvoicesQuery,
  ListProformasQuery,
  ListReceiptsQuery,
  UpdateInvoiceInput,
  UpdateProformaInput,
} from './commercial.validation.js'
import {
  computePaymentStatus,
  invoiceStatusFromPayment,
  mapAllocationDto,
  mapProformaDto,
  mapReceiptDto,
} from './commercial.types.js'
import { resolveGstStateCode } from '../../accounting/receivables/validation/state-code.validator.js'
import { resolveEffectivePurchaseDefaults } from '../../purchase/shared/purchase-defaults.js'

/** Fallback when tenant setup has no billing state configured. */
const FALLBACK_COMPANY_STATE_CODE = '27'

async function resolveTenantBillingStateCode(tenantId: string): Promise<string | null> {
  const defaults = await resolveEffectivePurchaseDefaults(tenantId)
  return (
    resolveGstStateCode(defaults.placeOfSupplyStateCode) ??
    resolveGstStateCode(defaults.placeOfSupplyState) ??
    FALLBACK_COMPANY_STATE_CODE
  )
}

function resolveCustomerPlaceOfSupplyCode(
  customerState: string | null | undefined,
  customerGstin: string | null | undefined,
  explicitPlaceOfSupply?: string | null,
): string | null {
  return (
    resolveGstStateCode(explicitPlaceOfSupply) ??
    resolveGstStateCode(customerState) ??
    resolveGstStateCode(customerGstin)
  )
}

function parseDate(dateStr: string): Date {
  return new Date(`${dateStr.slice(0, 10)}T00:00:00.000Z`)
}

function addDays(dateStr: string, days: number): string {
  const d = new Date(`${dateStr.slice(0, 10)}T00:00:00.000Z`)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

function computeLine(input: CreateInvoiceInput['lines'][number] | CreateProformaInput['lines'][number], lineNo: number) {
  const discountPct = input.discountPct ?? 0
  // Require explicit tax from client (resolved via tax masters). Do not invent 18%.
  if (input.taxPct == null || Number.isNaN(Number(input.taxPct))) {
    throw new ValidationError(
      `Line ${lineNo}: taxPct is required — resolve GST from item HSN/rate masters (no silent default)`,
    )
  }
  const taxPct = Number(input.taxPct)
  const gross = input.qty * input.unitPrice
  const taxableValue = Math.round(gross * (1 - discountPct / 100) * 100) / 100
  const gstAmount = Math.round(taxableValue * (taxPct / 100) * 100) / 100
  const lineTotal = Math.round((taxableValue + gstAmount) * 100) / 100
  if (input.maxQty != null && input.qty > input.maxQty + 0.0001) {
    throw new ValidationError(`Qty for ${input.itemCode} exceeds remaining ${input.maxQty}`)
  }
  return {
    lineNo,
    itemId: input.itemId,
    itemCode: input.itemCode,
    description: input.description,
    hsnCode: input.hsnCode ?? null,
    qty: new Prisma.Decimal(input.qty),
    uom: input.uom ?? 'NOS',
    unitPrice: new Prisma.Decimal(input.unitPrice),
    discountPct: new Prisma.Decimal(discountPct),
    taxPct: new Prisma.Decimal(taxPct),
    taxableValue: new Prisma.Decimal(taxableValue),
    gstAmount: new Prisma.Decimal(gstAmount),
    lineTotal: new Prisma.Decimal(lineTotal),
    sourceLineId: input.sourceLineId ?? null,
    maxQty: input.maxQty != null ? new Prisma.Decimal(input.maxQty) : null,
    taxableNumber: taxableValue,
    gstNumber: gstAmount,
    taxPctNumber: taxPct,
  }
}

function buildGst(
  companyStateCode: string | null,
  customerPlaceOfSupplyCode: string | null,
  lines: Array<{ taxableNumber: number; gstNumber: number; taxPctNumber: number }>,
) {
  const taxable = lines.reduce((s, l) => s + l.taxableNumber, 0)
  const totalTax = lines.reduce((s, l) => s + l.gstNumber, 0)
  const intra =
    companyStateCode && customerPlaceOfSupplyCode
      ? companyStateCode === customerPlaceOfSupplyCode
      : true
  if (intra) {
    const half = Math.round((totalTax / 2) * 100) / 100
    return {
      gstScheme: 'cgst_sgst',
      taxableAmount: taxable,
      cgstAmount: half,
      sgstAmount: Math.round((totalTax - half) * 100) / 100,
      igstAmount: 0,
      totalTaxAmount: totalTax,
      grandTotal: Math.round((taxable + totalTax) * 100) / 100,
    }
  }
  return {
    gstScheme: 'igst',
    taxableAmount: taxable,
    cgstAmount: 0,
    sgstAmount: 0,
    igstAmount: totalTax,
    totalTaxAmount: totalTax,
    grandTotal: Math.round((taxable + totalTax) * 100) / 100,
  }
}

export async function listReceipts(tenantId: string, query: ListReceiptsQuery) {
  const result = await repo.findReceipts(tenantId, query)
  return { ...result, items: result.items.map(mapReceiptDto) }
}

export async function getReceipt(tenantId: string, id: string) {
  const row = await repo.findReceiptById(tenantId, id)
  if (!row) throw new NotFoundError('Payment receipt not found')
  return mapReceiptDto(row)
}

export async function createReceipt(
  tenantId: string,
  userId: string,
  input: CreateReceiptInput,
  audit?: { ipAddress?: string | null; userAgent?: string | null },
) {
  const company = await repo.findCompany(tenantId, input.companyId)
  if (!company) throw new NotFoundError('Customer not found')

  if (input.proformaInvoiceId) {
    const proforma = await repo.findProformaById(tenantId, input.proformaInvoiceId)
    if (proforma) {
      if (proforma.status !== 'issued') {
        throw new ValidationError('Payments can only be received against issued proformas')
      }
      const grandTotal = Number(proforma.grandTotal)
      const received = await repo.sumProformaReceipts(tenantId, input.proformaInvoiceId)
      const balance = Math.max(0, grandTotal - received)
      if (input.amount > balance + 0.009) {
        throw new ValidationError(`Amount exceeds proforma balance of ${balance.toFixed(2)}`)
      }
    } else if (input.proformaGrandTotal != null) {
      const received = await repo.sumProformaReceipts(tenantId, input.proformaInvoiceId)
      const balance = Math.max(0, input.proformaGrandTotal - received)
      if (input.amount > balance + 0.009) {
        throw new ValidationError(`Amount exceeds proforma balance of ${balance.toFixed(2)}`)
      }
    }
  }

  const receiptNo = await repo.nextDocumentNo(tenantId, 'RCPT-', 'receipt')
  const row = await repo.createReceipt(tenantId, userId, {
    receiptNo,
    receiptDate: parseDate(input.receiptDate),
    companyId: company.id,
    customerNameSnapshot: company.name,
    proformaInvoiceId: input.proformaInvoiceId ?? null,
    proformaNo: input.proformaNo ?? null,
    paymentMode: input.paymentMode,
    transactionRef: input.transactionRef ?? null,
    amount: new Prisma.Decimal(input.amount),
    unallocatedAmount: new Prisma.Decimal(input.amount),
    remarks: input.remarks ?? null,
    attachmentName: input.attachmentName ?? null,
  })

  await createAuditLog({
    tenantId,
    userId,
    module: 'crm',
    entity: 'crmPaymentReceipt',
    entityId: row.id,
    action: 'CREATE',
    newValues: { receiptNo: row.receiptNo, amount: input.amount, paymentMode: input.paymentMode },
    ipAddress: audit?.ipAddress,
    userAgent: audit?.userAgent,
  })

  return mapReceiptDto(row)
}

export async function listProformas(tenantId: string, query: ListProformasQuery) {
  const result = await repo.findProformas(tenantId, query)
  return { ...result, items: result.items.map(mapProformaDto) }
}

export async function getProforma(tenantId: string, id: string) {
  const row = await repo.findProformaById(tenantId, id)
  if (!row) throw new NotFoundError('Proforma invoice not found')
  return mapProformaDto(row)
}

async function buildProformaPayload(
  tenantId: string,
  input: CreateProformaInput | UpdateProformaInput,
  existing?: Awaited<ReturnType<typeof repo.findProformaById>>,
) {
  const companyId = input.companyId ?? existing?.companyId
  if (!companyId) throw new ValidationError('Customer is required')
  const company = await repo.findCompany(tenantId, companyId)
  if (!company) throw new NotFoundError('Customer not found')

  const linesInput = input.lines ?? []
  if (!linesInput.length && !existing) throw new ValidationError('At least one line is required')

  const computedLines = linesInput.length
    ? linesInput.map((l, idx) => computeLine(l, idx + 1))
    : (existing?.lines ?? []).map((l, idx) => ({
        lineNo: idx + 1,
        itemId: l.itemId,
        itemCode: l.itemCode,
        description: l.description,
        hsnCode: l.hsnCode,
        qty: l.qty,
        uom: l.uom,
        unitPrice: l.unitPrice,
        discountPct: l.discountPct,
        taxPct: l.taxPct,
        taxableValue: l.taxableValue,
        gstAmount: l.gstAmount,
        lineTotal: l.lineTotal,
        sourceLineId: l.sourceLineId,
        maxQty: l.maxQty,
        taxableNumber: Number(l.taxableValue),
        gstNumber: Number(l.gstAmount),
        taxPctNumber: Number(l.taxPct),
      }))

  const customerState = input.customerState ?? company.state ?? ''
  const customerGstin = company.gstin ?? null
  const companyStateCode = await resolveTenantBillingStateCode(tenantId)
  const placeOfSupplyCode = resolveCustomerPlaceOfSupplyCode(
    customerState,
    customerGstin,
    existing?.placeOfSupply ?? null,
  )
  const gst = buildGst(companyStateCode, placeOfSupplyCode, computedLines)
  const address = [company.addressLine1, company.city, company.state, company.pincode].filter(Boolean).join(', ')
  const proformaDate = (input.proformaDate ?? existing?.proformaDate.toISOString().slice(0, 10) ?? new Date().toISOString().slice(0, 10)).slice(0, 10)
  const validUntil = (input.validUntil ?? existing?.validUntil.toISOString().slice(0, 10) ?? addDays(proformaDate, 30)).slice(0, 10)

  let salesOrderId = input.salesOrderId ?? existing?.salesOrderId ?? null
  let salesOrderNo = input.salesOrderNo ?? existing?.salesOrderNo ?? null
  let quotationId = input.quotationId ?? existing?.quotationId ?? null
  let quotationNo = input.quotationNo ?? existing?.quotationNo ?? null
  let source = input.source ?? existing?.source ?? 'direct'

  if (salesOrderId) {
    const so = await repo.findSalesOrder(tenantId, salesOrderId)
    if (!so) throw new NotFoundError('Sales order not found')
    if (['closed', 'cancelled'].includes(so.status)) {
      throw new ValidationError('Cannot create proforma for a closed sales order')
    }
    source = 'sales_order'
    salesOrderNo = salesOrderNo ?? so.salesOrderNo
    quotationId = quotationId ?? so.quotationId
    quotationNo = quotationNo ?? so.quotationNo
  }

  return {
    company,
    customerState,
    placeOfSupplyCode,
    companyStateCode,
    gst,
    address,
    proformaDate,
    validUntil,
    salesOrderId,
    salesOrderNo,
    quotationId,
    quotationNo,
    source,
    computedLines,
  }
}

export async function createProforma(
  tenantId: string,
  userId: string,
  input: CreateProformaInput,
  audit?: { ipAddress?: string | null; userAgent?: string | null },
) {
  if (input.salesOrderId) {
    const existing = await repo.findActiveProformaForSalesOrder(tenantId, input.salesOrderId)
    if (existing) {
      throw new ValidationError(`Active proforma ${existing.proformaNo} already exists for this sales order`)
    }
  }

  const payload = await buildProformaPayload(tenantId, input)
  const proformaNo = await repo.nextDocumentNo(tenantId, 'PI-', 'proforma')

  const row = await repo.createProformaWithLines(
    tenantId,
    userId,
    {
      proformaNo,
      proformaDate: parseDate(payload.proformaDate),
      validUntil: parseDate(payload.validUntil),
      status: 'draft',
      source: payload.source,
      companyId: payload.company.id,
      customerNameSnapshot: payload.company.name,
      customerGstin: payload.company.gstin,
      customerState: payload.customerState,
      customerAddress: payload.address,
      placeOfSupply: payload.placeOfSupplyCode ?? payload.customerState,
      billingAddress: input.billingAddress ?? payload.address,
      shippingAddress: input.shippingAddress ?? payload.address,
      deliveryTerms: input.deliveryTerms ?? null,
      paymentTerms: input.paymentTerms ?? null,
      customerPoNumber: input.customerPoNumber ?? null,
      salesOrderId: payload.salesOrderId,
      salesOrderNo: payload.salesOrderNo,
      quotationId: payload.quotationId,
      quotationNo: payload.quotationNo,
      locationId: input.locationId ?? null,
      remarks: input.remarks ?? null,
      taxableAmount: new Prisma.Decimal(payload.gst.taxableAmount),
      cgstAmount: new Prisma.Decimal(payload.gst.cgstAmount),
      sgstAmount: new Prisma.Decimal(payload.gst.sgstAmount),
      igstAmount: new Prisma.Decimal(payload.gst.igstAmount),
      totalTaxAmount: new Prisma.Decimal(payload.gst.totalTaxAmount),
      grandTotal: new Prisma.Decimal(payload.gst.grandTotal),
      gstScheme: payload.gst.gstScheme,
    },
    payload.computedLines.map(({ taxableNumber: _t, gstNumber: _g, taxPctNumber: _p, ...line }) => line),
  )

  await createAuditLog({
    tenantId,
    userId,
    module: 'crm',
    entity: 'crmProformaInvoice',
    entityId: row.id,
    action: 'CREATE',
    newValues: { proformaNo: row.proformaNo, grandTotal: payload.gst.grandTotal, source: payload.source },
    ipAddress: audit?.ipAddress,
    userAgent: audit?.userAgent,
  })

  return mapProformaDto(row)
}

export async function updateProforma(
  tenantId: string,
  id: string,
  userId: string,
  input: UpdateProformaInput,
  audit?: { ipAddress?: string | null; userAgent?: string | null },
) {
  const existing = await repo.findProformaById(tenantId, id)
  if (!existing) throw new NotFoundError('Proforma invoice not found')
  if (existing.status !== 'draft') throw new ValidationError('Only draft proforma invoices can be edited')

  const payload = await buildProformaPayload(tenantId, input, existing)
  const row = await repo.updateProformaWithLines(
    tenantId,
    id,
    userId,
    {
      proformaDate: parseDate(payload.proformaDate),
      validUntil: parseDate(payload.validUntil),
      companyId: payload.company.id,
      customerNameSnapshot: payload.company.name,
      customerGstin: payload.company.gstin,
      customerState: payload.customerState,
      customerAddress: payload.address,
      placeOfSupply: payload.placeOfSupplyCode ?? payload.customerState,
      billingAddress: input.billingAddress ?? existing.billingAddress ?? payload.address,
      shippingAddress: input.shippingAddress ?? existing.shippingAddress ?? payload.address,
      deliveryTerms: input.deliveryTerms ?? existing.deliveryTerms,
      paymentTerms: input.paymentTerms ?? existing.paymentTerms,
      customerPoNumber: input.customerPoNumber ?? existing.customerPoNumber,
      salesOrderId: payload.salesOrderId,
      salesOrderNo: payload.salesOrderNo,
      quotationId: payload.quotationId,
      quotationNo: payload.quotationNo,
      locationId: input.locationId !== undefined ? input.locationId : existing.locationId,
      remarks: input.remarks ?? existing.remarks,
      source: payload.source,
      taxableAmount: new Prisma.Decimal(payload.gst.taxableAmount),
      cgstAmount: new Prisma.Decimal(payload.gst.cgstAmount),
      sgstAmount: new Prisma.Decimal(payload.gst.sgstAmount),
      igstAmount: new Prisma.Decimal(payload.gst.igstAmount),
      totalTaxAmount: new Prisma.Decimal(payload.gst.totalTaxAmount),
      grandTotal: new Prisma.Decimal(payload.gst.grandTotal),
      gstScheme: payload.gst.gstScheme,
    },
    input.lines
      ? payload.computedLines.map(({ taxableNumber: _t, gstNumber: _g, taxPctNumber: _p, ...line }) => line)
      : undefined,
  )

  await createAuditLog({
    tenantId,
    userId,
    module: 'crm',
    entity: 'crmProformaInvoice',
    entityId: id,
    action: 'UPDATE',
    newValues: { proformaNo: existing.proformaNo },
    ipAddress: audit?.ipAddress,
    userAgent: audit?.userAgent,
  })

  return mapProformaDto(row)
}

export async function issueProforma(
  tenantId: string,
  id: string,
  userId: string,
  audit?: { ipAddress?: string | null; userAgent?: string | null },
) {
  const row = await repo.findProformaById(tenantId, id)
  if (!row) throw new NotFoundError('Proforma invoice not found')
  if (row.status !== 'draft') throw new ValidationError('Only draft proforma invoices can be issued')

  const updated = await repo.updateProforma(tenantId, id, userId, {
    status: 'issued',
    issuedAt: new Date(),
  })
  await createAuditLog({
    tenantId,
    userId,
    module: 'crm',
    entity: 'crmProformaInvoice',
    entityId: id,
    action: 'ISSUE',
    newValues: { proformaNo: row.proformaNo },
    ipAddress: audit?.ipAddress,
    userAgent: audit?.userAgent,
  })
  return mapProformaDto(updated!)
}

export async function cancelProforma(
  tenantId: string,
  id: string,
  userId: string,
  audit?: { ipAddress?: string | null; userAgent?: string | null },
) {
  const row = await repo.findProformaById(tenantId, id)
  if (!row) throw new NotFoundError('Proforma invoice not found')
  if (row.status === 'cancelled') throw new ValidationError('Proforma invoice is already cancelled')

  const updated = await repo.updateProforma(tenantId, id, userId, {
    status: 'cancelled',
    cancelledAt: new Date(),
  })
  await createAuditLog({
    tenantId,
    userId,
    module: 'crm',
    entity: 'crmProformaInvoice',
    entityId: id,
    action: 'CANCEL',
    newValues: { proformaNo: row.proformaNo },
    ipAddress: audit?.ipAddress,
    userAgent: audit?.userAgent,
  })
  return mapProformaDto(updated!)
}

export async function listInvoices(tenantId: string, query: ListInvoicesQuery) {
  const { listUnifiedInvoices } = await import(
    '../../accounting/receivables/source/crm-unified-sales-invoice.service.js'
  )
  return listUnifiedInvoices(tenantId, query)
}

export async function getInvoice(tenantId: string, id: string) {
  const { getUnifiedInvoice } = await import(
    '../../accounting/receivables/source/crm-unified-sales-invoice.service.js'
  )
  return getUnifiedInvoice(tenantId, id)
}

export async function createInvoice(
  tenantId: string,
  userId: string,
  input: CreateInvoiceInput,
  audit?: { ipAddress?: string | null; userAgent?: string | null },
) {
  const { createUnifiedInvoice } = await import(
    '../../accounting/receivables/source/crm-unified-sales-invoice.service.js'
  )
  return createUnifiedInvoice(tenantId, userId, input, audit)
}

export async function updateInvoice(
  tenantId: string,
  id: string,
  userId: string,
  input: UpdateInvoiceInput,
  audit?: { ipAddress?: string | null; userAgent?: string | null },
) {
  const { updateUnifiedInvoice } = await import(
    '../../accounting/receivables/source/crm-unified-sales-invoice.service.js'
  )
  return updateUnifiedInvoice(tenantId, id, userId, input, audit)
}

export async function postInvoice(
  tenantId: string,
  id: string,
  userId: string,
  audit?: { ipAddress?: string | null; userAgent?: string | null },
  opts?: { canGlPost?: boolean; req?: import('express').Request },
) {
  const { postUnifiedInvoice } = await import(
    '../../accounting/receivables/source/crm-unified-sales-invoice.service.js'
  )
  return postUnifiedInvoice(tenantId, id, userId, {
    ...audit,
    canGlPost: opts?.canGlPost,
    req: opts?.req,
  })
}

export async function cancelDraftInvoice(
  tenantId: string,
  id: string,
  userId: string,
  audit?: { ipAddress?: string | null; userAgent?: string | null },
) {
  const { cancelUnifiedInvoice } = await import(
    '../../accounting/receivables/source/crm-unified-sales-invoice.service.js'
  )
  return cancelUnifiedInvoice(tenantId, id, userId, audit)
}

export async function listAllocations(tenantId: string, query: ListAllocationsQuery) {
  const result = await repo.findAllocations(tenantId, query)
  return { ...result, items: result.items.map(mapAllocationDto) }
}

export async function allocatePayments(
  tenantId: string,
  userId: string,
  input: AllocatePaymentsInput,
  audit?: { ipAddress?: string | null; userAgent?: string | null },
) {
  const receipt = await repo.findReceiptById(tenantId, input.receiptId)
  if (!receipt) throw new NotFoundError('Payment receipt not found')

  let remaining = Number(receipt.unallocatedAmount)
  const invoicePatches: Array<{
    invoiceId: string
    amountPaid: number
    balanceDue: number
    paymentStatus: 'unpaid' | 'partially_paid' | 'paid'
    status: 'posted' | 'partially_paid' | 'paid'
  }> = []
  const allocationRows: Array<{
    receiptId: string
    invoiceId: string
    receiptNo: string
    invoiceNo: string
    companyId: string
    customerName: string
    amount: Prisma.Decimal
    allocationDate: Date
    remarks: string | null
  }> = []
  const allocationDate = parseDate(input.allocationDate ?? new Date().toISOString().slice(0, 10))
  const queued = new Map<string, number>()

  for (const row of input.allocations) {
    const { findUnifiedInvoiceById } = await import(
      '../../accounting/receivables/source/crm-unified-sales-invoice.service.js'
    )
    const unified = await findUnifiedInvoiceById(tenantId, row.invoiceId)
    if (unified) {
      throw new ValidationError(
        'This invoice is the unified Accounting Sales Invoice. Allocate payments in Money In (Receipts → Allocate), not CRM commercial allocation.',
      )
    }
    const inv = await repo.findInvoiceById(tenantId, row.invoiceId)
    if (!inv) throw new NotFoundError('Tax invoice not found')
    if (inv.companyId !== receipt.companyId) {
      throw new ValidationError('Receipt and invoice must belong to the same customer')
    }
    if (inv.status === 'draft' || inv.status === 'cancelled') {
      throw new ValidationError(`Invoice ${inv.invoiceNo} is not open for allocation`)
    }
    assertCrmTaxInvoiceAllowsCommercialAllocation(inv)
    const already = queued.get(inv.id) ?? 0
    const balance = Number(inv.balanceDue) - already
    if (row.amount > balance + 0.009) {
      throw new ValidationError(`Amount exceeds outstanding on ${inv.invoiceNo}`)
    }
    if (row.amount > remaining + 0.009) {
      throw new ValidationError('Allocation exceeds unallocated receipt balance')
    }
    remaining = Math.round((remaining - row.amount) * 100) / 100
    queued.set(inv.id, already + row.amount)
    const amountPaid = Number(inv.amountPaid) + already + row.amount
    const grandTotal = Number(inv.grandTotal)
    const balanceDue = Math.max(0, Math.round((grandTotal - amountPaid) * 100) / 100)
    const paymentStatus = computePaymentStatus(grandTotal, amountPaid)
    invoicePatches.push({
      invoiceId: inv.id,
      amountPaid,
      balanceDue,
      paymentStatus,
      status: invoiceStatusFromPayment(paymentStatus, inv.status) as 'posted' | 'partially_paid' | 'paid',
    })
    allocationRows.push({
      receiptId: receipt.id,
      invoiceId: inv.id,
      receiptNo: receipt.receiptNo,
      invoiceNo: inv.invoiceNo,
      companyId: receipt.companyId,
      customerName: receipt.customerNameSnapshot,
      amount: new Prisma.Decimal(row.amount),
      allocationDate,
      remarks: input.remarks ?? null,
    })
  }

  // Deduplicate invoice patches — keep last cumulative per invoice
  const patchById = new Map(invoicePatches.map((p) => [p.invoiceId, p]))
  const created = await repo.allocateInTransaction({
    tenantId,
    userId,
    receiptId: receipt.id,
    remainingUnallocated: remaining,
    invoicePatches: [...patchById.values()],
    allocations: allocationRows,
  })

  for (const alloc of created) {
    await createAuditLog({
      tenantId,
      userId,
      module: 'crm',
      entity: 'crmPaymentAllocation',
      entityId: alloc.id,
      action: 'CREATE',
      newValues: {
        receiptNo: alloc.receiptNo,
        invoiceNo: alloc.invoiceNo,
        amount: Number(alloc.amount),
      },
      ipAddress: audit?.ipAddress,
      userAgent: audit?.userAgent,
    })
  }

  return created.map(mapAllocationDto)
}

export async function reverseAllocation(
  tenantId: string,
  id: string,
  userId: string,
  audit?: { ipAddress?: string | null; userAgent?: string | null },
) {
  const alloc = await repo.findAllocationById(tenantId, id)
  if (!alloc) throw new NotFoundError('Allocation not found')
  if (alloc.reversedAt) throw new ValidationError('Allocation already reversed')

  const receipt = await repo.findReceiptById(tenantId, alloc.receiptId)
  const invoice = await repo.findInvoiceById(tenantId, alloc.invoiceId)
  if (!receipt || !invoice) throw new NotFoundError('Linked receipt or invoice not found')

  if (invoice.salesInvoiceId || invoice.accountingStatus === 'converted' || invoice.accountingStatus === 'pending_review') {
    await createAuditLog({
      tenantId,
      userId,
      module: 'crm',
      entity: 'crmPaymentAllocation',
      entityId: id,
      action: 'CRM_ALLOCATION_BLOCKED_ACCOUNTING_CONTROL',
      newValues: {
        invoiceNo: invoice.invoiceNo,
        salesInvoiceId: invoice.salesInvoiceId,
        accountingStatus: invoice.accountingStatus,
      },
      ipAddress: audit?.ipAddress,
      userAgent: audit?.userAgent,
    })
    assertCrmTaxInvoiceAllowsCommercialAllocation(invoice)
  }

  const amount = Number(alloc.amount)
  const amountPaid = Math.max(0, Number(invoice.amountPaid) - amount)
  const grandTotal = Number(invoice.grandTotal)
  const balanceDue = Math.max(0, Math.round((grandTotal - amountPaid) * 100) / 100)
  const paymentStatus = computePaymentStatus(grandTotal, amountPaid)
  const status = invoiceStatusFromPayment(paymentStatus, invoice.status) as 'posted' | 'partially_paid' | 'paid'

  const updated = await repo.reverseAllocationInTransaction({
    tenantId,
    userId,
    allocationId: alloc.id,
    receiptId: receipt.id,
    newUnallocated: Math.round((Number(receipt.unallocatedAmount) + amount) * 100) / 100,
    invoiceId: invoice.id,
    amountPaid,
    balanceDue,
    paymentStatus,
    status,
  })

  await createAuditLog({
    tenantId,
    userId,
    module: 'crm',
    entity: 'crmPaymentAllocation',
    entityId: id,
    action: 'REVERSE',
    newValues: { receiptNo: alloc.receiptNo, invoiceNo: alloc.invoiceNo, amount },
    ipAddress: audit?.ipAddress,
    userAgent: audit?.userAgent,
  })

  return mapAllocationDto(updated)
}

export async function syncBundle(tenantId: string, companyId?: string) {
  const { listUnifiedInvoices } = await import(
    '../../accounting/receivables/source/crm-unified-sales-invoice.service.js'
  )
  const [receipts, invoices, allocations, proformas] = await Promise.all([
    repo.findReceipts(tenantId, { page: 1, limit: 500, companyId, sortOrder: 'desc' }),
    listUnifiedInvoices(tenantId, { page: 1, limit: 500, companyId, sortOrder: 'desc' }),
    repo.findAllocations(tenantId, {
      page: 1,
      limit: 500,
      companyId,
      includeReversed: true,
      sortOrder: 'desc',
    }),
    repo.findProformas(tenantId, { page: 1, limit: 500, companyId, sortOrder: 'desc' }),
  ])
  return {
    receipts: receipts.items.map(mapReceiptDto),
    invoices: invoices.items,
    allocations: allocations.items.map(mapAllocationDto),
    proformas: proformas.items.map(mapProformaDto),
  }
}

import { Prisma } from '@prisma/client'
import { createAuditLog } from '../../../services/audit.service.js'
import { NotFoundError, ValidationError } from '../../../utils/errors.js'
import * as repo from './commercial.repository.js'
import {
  computePaymentStatus,
  invoiceStatusFromPayment,
  mapAllocationDto,
  mapInvoiceDto,
  mapReceiptDto,
} from './commercial.types.js'
import type {
  AllocatePaymentsInput,
  CreateInvoiceInput,
  CreateReceiptInput,
  ListAllocationsQuery,
  ListInvoicesQuery,
  ListReceiptsQuery,
} from './commercial.validation.js'

const COMPANY_STATE = 'Maharashtra'

function parseDate(dateStr: string): Date {
  return new Date(`${dateStr.slice(0, 10)}T00:00:00.000Z`)
}

function addDays(dateStr: string, days: number): string {
  const d = new Date(`${dateStr.slice(0, 10)}T00:00:00.000Z`)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

function computeLine(input: CreateInvoiceInput['lines'][number], lineNo: number) {
  const discountPct = input.discountPct ?? 0
  const taxPct = input.taxPct ?? 18
  const gross = input.qty * input.unitPrice
  const taxableValue = Math.round(gross * (1 - discountPct / 100) * 100) / 100
  const gstAmount = Math.round(taxableValue * (taxPct / 100) * 100) / 100
  const lineTotal = Math.round((taxableValue + gstAmount) * 100) / 100
  if (input.maxQty != null && input.qty > input.maxQty + 0.0001) {
    throw new ValidationError(`Qty for ${input.itemCode} exceeds remaining ${input.maxQty}`)
  }
  return {
    lineNo,
    productId: input.productId ?? null,
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

function buildGst(customerState: string, lines: Array<{ taxableNumber: number; gstNumber: number; taxPctNumber: number }>) {
  const taxable = lines.reduce((s, l) => s + l.taxableNumber, 0)
  const totalTax = lines.reduce((s, l) => s + l.gstNumber, 0)
  const intra = (customerState || COMPANY_STATE).toLowerCase() === COMPANY_STATE.toLowerCase()
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

  if (input.proformaInvoiceId && input.proformaGrandTotal != null) {
    const received = await repo.sumProformaReceipts(tenantId, input.proformaInvoiceId)
    const balance = Math.max(0, input.proformaGrandTotal - received)
    if (input.amount > balance + 0.009) {
      throw new ValidationError(`Amount exceeds proforma balance of ${balance.toFixed(2)}`)
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

export async function listInvoices(tenantId: string, query: ListInvoicesQuery) {
  const result = await repo.findInvoices(tenantId, query)
  return { ...result, items: result.items.map(mapInvoiceDto) }
}

export async function getInvoice(tenantId: string, id: string) {
  const row = await repo.findInvoiceById(tenantId, id)
  if (!row) throw new NotFoundError('Tax invoice not found')
  return mapInvoiceDto(row)
}

export async function createInvoice(
  tenantId: string,
  userId: string,
  input: CreateInvoiceInput,
  audit?: { ipAddress?: string | null; userAgent?: string | null },
) {
  const company = await repo.findCompany(tenantId, input.companyId)
  if (!company) throw new NotFoundError('Customer not found')

  const computedLines = input.lines.map((l, idx) => computeLine(l, idx + 1))
  const customerState = input.customerState ?? company.state ?? COMPANY_STATE
  const gst = buildGst(customerState, computedLines)
  const invoiceDate = (input.invoiceDate ?? new Date().toISOString().slice(0, 10)).slice(0, 10)
  const dueDate = (input.dueDate ?? addDays(invoiceDate, company.creditDays || 30)).slice(0, 10)
  const invoiceNo = await repo.nextDocumentNo(tenantId, 'INV-', 'invoice')

  const address = [company.addressLine1, company.city, company.state, company.pincode].filter(Boolean).join(', ')

  const row = await repo.createInvoiceWithLines(
    tenantId,
    userId,
    {
      invoiceNo,
      invoiceDate: parseDate(invoiceDate),
      dueDate: parseDate(dueDate),
      status: 'draft',
      paymentStatus: 'unpaid',
      source: input.source ?? 'direct',
      companyId: company.id,
      customerNameSnapshot: company.name,
      customerGstin: company.gstin,
      customerState,
      customerAddress: address,
      placeOfSupply: customerState,
      billingAddress: input.billingAddress ?? address,
      shippingAddress: input.shippingAddress ?? address,
      deliveryTerms: input.deliveryTerms ?? null,
      paymentTerms: input.paymentTerms ?? null,
      customerPoNumber: input.customerPoNumber ?? null,
      salesOrderId: input.salesOrderId ?? null,
      salesOrderNo: input.salesOrderNo ?? null,
      quotationId: input.quotationId ?? null,
      quotationNo: input.quotationNo ?? null,
      proformaInvoiceId: input.proformaInvoiceId ?? null,
      proformaNo: input.proformaNo ?? null,
      remarks: input.remarks ?? null,
      taxableAmount: new Prisma.Decimal(gst.taxableAmount),
      cgstAmount: new Prisma.Decimal(gst.cgstAmount),
      sgstAmount: new Prisma.Decimal(gst.sgstAmount),
      igstAmount: new Prisma.Decimal(gst.igstAmount),
      totalTaxAmount: new Prisma.Decimal(gst.totalTaxAmount),
      grandTotal: new Prisma.Decimal(gst.grandTotal),
      amountPaid: new Prisma.Decimal(0),
      balanceDue: new Prisma.Decimal(gst.grandTotal),
      gstScheme: gst.gstScheme,
    },
    computedLines.map(({ taxableNumber: _t, gstNumber: _g, taxPctNumber: _p, ...line }) => line),
  )

  await createAuditLog({
    tenantId,
    userId,
    module: 'crm',
    entity: 'crmTaxInvoice',
    entityId: row.id,
    action: 'CREATE',
    newValues: { invoiceNo: row.invoiceNo, grandTotal: gst.grandTotal, source: input.source },
    ipAddress: audit?.ipAddress,
    userAgent: audit?.userAgent,
  })

  return mapInvoiceDto(row)
}

export async function postInvoice(
  tenantId: string,
  id: string,
  userId: string,
  audit?: { ipAddress?: string | null; userAgent?: string | null },
) {
  const row = await repo.findInvoiceById(tenantId, id)
  if (!row) throw new NotFoundError('Tax invoice not found')
  if (row.status !== 'draft') throw new ValidationError('Only draft invoices can be posted')

  const updated = await repo.updateInvoice(tenantId, id, userId, {
    status: 'posted',
    postedAt: new Date(),
  })
  await createAuditLog({
    tenantId,
    userId,
    module: 'crm',
    entity: 'crmTaxInvoice',
    entityId: id,
    action: 'POST',
    newValues: { invoiceNo: row.invoiceNo },
    ipAddress: audit?.ipAddress,
    userAgent: audit?.userAgent,
  })
  return mapInvoiceDto(updated!)
}

export async function cancelDraftInvoice(
  tenantId: string,
  id: string,
  userId: string,
  audit?: { ipAddress?: string | null; userAgent?: string | null },
) {
  const row = await repo.findInvoiceById(tenantId, id)
  if (!row) throw new NotFoundError('Tax invoice not found')
  if (row.status !== 'draft') throw new ValidationError('Only draft invoices can be cancelled')

  const updated = await repo.updateInvoice(tenantId, id, userId, {
    status: 'cancelled',
    cancelledAt: new Date(),
    balanceDue: new Prisma.Decimal(0),
  })
  await createAuditLog({
    tenantId,
    userId,
    module: 'crm',
    entity: 'crmTaxInvoice',
    entityId: id,
    action: 'CANCEL',
    newValues: { invoiceNo: row.invoiceNo },
    ipAddress: audit?.ipAddress,
    userAgent: audit?.userAgent,
  })
  return mapInvoiceDto(updated!)
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
    const inv = await repo.findInvoiceById(tenantId, row.invoiceId)
    if (!inv) throw new NotFoundError('Tax invoice not found')
    if (inv.companyId !== receipt.companyId) {
      throw new ValidationError('Receipt and invoice must belong to the same customer')
    }
    if (inv.status === 'draft' || inv.status === 'cancelled') {
      throw new ValidationError(`Invoice ${inv.invoiceNo} is not open for allocation`)
    }
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
  try {
    const [receipts, invoices, allocations] = await Promise.all([
      repo.findReceipts(tenantId, { page: 1, limit: 500, companyId, sortOrder: 'desc' }),
      repo.findInvoices(tenantId, { page: 1, limit: 500, companyId, sortOrder: 'desc' }),
      repo.findAllocations(tenantId, {
        page: 1,
        limit: 500,
        companyId,
        includeReversed: true,
        sortOrder: 'desc',
      }),
    ])
    return {
      receipts: receipts.items.map(mapReceiptDto),
      invoices: invoices.items.map(mapInvoiceDto),
      allocations: allocations.items.map(mapAllocationDto),
    }
  } catch (err) {
    // Stage DBs may lag commercial schema; never block CRM shell hydrate.
    if (
      err instanceof Prisma.PrismaClientKnownRequestError ||
      err instanceof Prisma.PrismaClientUnknownRequestError ||
      err instanceof Prisma.PrismaClientValidationError
    ) {
      return { receipts: [], invoices: [], allocations: [] }
    }
    throw err
  }
}

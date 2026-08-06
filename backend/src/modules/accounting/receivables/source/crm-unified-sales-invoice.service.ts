/**
 * CRM Tax Invoice facade over canonical SalesInvoice.
 * CRM commercial invoice APIs create/read/update the same sales_invoices row as Money In.
 */
import type { Prisma, SalesInvoice, SalesInvoiceLine } from '@prisma/client'
import { prisma } from '../../../../config/prisma.js'
import { createAuditLog } from '../../../../services/audit.service.js'
import { NotFoundError, ValidationError } from '../../../../utils/errors.js'
import { getPagination } from '../../../../utils/pagination.js'
import { calculateSalesInvoice } from '../calculation/sales-invoice-calculation.service.js'
import { requireActiveCustomerParty } from '../customer-party/customer-party.service.js'
import { loadProformaInvoiceSource } from '../source/proforma-invoice-source.service.js'
import { loadSalesOrderSource } from '../source/sales-order-source.service.js'
import * as siRepo from '../sales-invoices/sales-invoice.repository.js'
import { validateAndEnrichSalesInvoiceSourceLinks } from '../sales-invoices/sales-invoice-source-validation.service.js'
import {
  buildCalculationInputFromRequest,
} from '../sales-invoices/sales-invoice-validation.service.js'
import type { CreateSalesInvoiceInput, UpdateSalesInvoiceInput } from '../sales-invoices/sales-invoice.schemas.js'
import type {
  CreateInvoiceInput,
  ListInvoicesQuery,
  UpdateInvoiceInput,
} from '../../../crm/commercial/commercial.validation.js'
import { computePaymentStatus } from '../../../crm/commercial/commercial.types.js'
import { resolveGstStateCode } from '../validation/state-code.validator.js'

type AuditBits = { ipAddress?: string | null; userAgent?: string | null }

type SiWithLines = SalesInvoice & { lines: SalesInvoiceLine[] }

function dec(v: Prisma.Decimal | number | string | null | undefined): number {
  if (v == null) return 0
  if (typeof v === 'number') return v
  if (typeof v === 'string') return Number(v)
  return v.toNumber()
}

function dateOnly(d: Date | string): string {
  if (typeof d === 'string') return d.slice(0, 10)
  return d.toISOString().slice(0, 10)
}

async function resolveDefaultLegalEntityId(tenantId: string): Promise<string> {
  const first = await prisma.legalEntity.findFirst({
    where: { tenantId, isActive: true },
    orderBy: { createdAt: 'asc' },
    select: { id: true },
  })
  if (!first) throw new ValidationError('No active legal entity configured for Accounting — required for unified invoices')
  return first.id
}

async function resolveUserDisplayName(tenantId: string, userId: string | null | undefined): Promise<string> {
  if (!userId) return ''
  const user = await prisma.user.findFirst({
    where: { id: userId, tenantId },
    select: { firstName: true, lastName: true, email: true },
  })
  if (!user) return ''
  const name = `${user.firstName} ${user.lastName}`.trim()
  return name || user.email || ''
}

function mapSiStatusToCrm(status: string): 'draft' | 'posted' | 'partially_paid' | 'paid' | 'cancelled' {
  if (status === 'DRAFT') return 'draft'
  if (status === 'CANCELLED' || status === 'REVERSED') return 'cancelled'
  return 'posted'
}

function mapSiAccountingStatus(status: string): 'none' | 'pending_review' | 'converted' | 'rejected' {
  if (status === 'DRAFT') return 'none'
  if (status === 'READY_TO_POST') return 'pending_review'
  if (status === 'POSTED') return 'converted'
  if (status === 'CANCELLED' || status === 'REVERSED') return 'rejected'
  return 'none'
}

function mapSource(row: SalesInvoice): 'sales_order' | 'proforma' | 'direct' | 'customer' {
  if (row.sourceType === 'SALES_ORDER' || row.salesOrderId) return 'sales_order'
  if (row.sourceType === 'PROFORMA_INVOICE' || row.proformaInvoiceId) return 'proforma'
  return 'direct'
}

/** Prefer upstream commercial PoS (input → SO → PI) over party billing state alone. */
async function resolveUnifiedPlaceOfSupply(
  tenantId: string,
  input: {
    placeOfSupply?: string | null
    placeOfSupplyStateCode?: string | null
    customerState?: string | null
    salesOrderId?: string | null
    proformaInvoiceId?: string | null
  },
  partyStateCode: string | null | undefined,
  existingPlaceOfSupply?: string | null,
): Promise<string | null> {
  const fromInput =
    resolveGstStateCode(input.placeOfSupplyStateCode) ?? resolveGstStateCode(input.placeOfSupply)
  if (fromInput) return fromInput

  if (input.salesOrderId) {
    const so = await prisma.crmSalesOrder.findFirst({
      where: { id: input.salesOrderId, tenantId, deletedAt: null },
      select: { placeOfSupplyStateCode: true, placeOfSupply: true },
    })
    const fromSo =
      resolveGstStateCode(so?.placeOfSupplyStateCode) ?? resolveGstStateCode(so?.placeOfSupply)
    if (fromSo) return fromSo
  }

  if (input.proformaInvoiceId) {
    const pi = await prisma.crmProformaInvoice.findFirst({
      where: { id: input.proformaInvoiceId, tenantId, deletedAt: null },
      select: { placeOfSupply: true },
    })
    const fromPi = resolveGstStateCode(pi?.placeOfSupply)
    if (fromPi) return fromPi
  }

  return (
    resolveGstStateCode(input.customerState) ??
    resolveGstStateCode(partyStateCode) ??
    resolveGstStateCode(existingPlaceOfSupply) ??
    partyStateCode ??
    existingPlaceOfSupply ??
    null
  )
}

async function loadOpenItemAmounts(tenantId: string, salesInvoiceId: string) {
  const items = await prisma.receivableOpenItem.findMany({
    where: { tenantId, salesInvoiceId, side: 'DEBIT' },
    select: { originalAmount: true, openAmount: true, allocatedAmount: true },
  })
  if (!items.length) return { amountPaid: 0, balanceDue: 0, hasOpenItem: false }
  const original = items.reduce((s, i) => s + dec(i.originalAmount), 0)
  const open = items.reduce((s, i) => s + dec(i.openAmount), 0)
  const allocated = items.reduce((s, i) => s + dec(i.allocatedAmount), 0)
  return {
    amountPaid: allocated > 0 ? allocated : Math.max(0, original - open),
    balanceDue: Math.max(0, open),
    hasOpenItem: true,
  }
}

export async function mapSalesInvoiceToCrmDto(row: SiWithLines) {
  const taxable = dec(row.taxableAmount)
  const cgst = dec(row.cgstAmount)
  const sgst = dec(row.sgstAmount)
  const igst = dec(row.igstAmount)
  const grandTotal = dec(row.totalAmount)
  const open = await loadOpenItemAmounts(row.tenantId, row.id)
  const amountPaid = open.hasOpenItem ? open.amountPaid : 0
  const balanceDue = open.hasOpenItem ? open.balanceDue : row.status === 'CANCELLED' || row.status === 'REVERSED' ? 0 : grandTotal
  let paymentStatus = computePaymentStatus(grandTotal, amountPaid)
  let status = mapSiStatusToCrm(row.status)
  if (status === 'posted') {
    if (paymentStatus === 'paid') status = 'paid'
    else if (paymentStatus === 'partially_paid') status = 'partially_paid'
  }

  const invoiceNo =
    row.invoiceNumber ||
    row.legacyCrmInvoiceNo ||
    row.draftReference ||
    row.referenceNumber ||
    row.id.slice(0, 8)

  const billing =
    row.customerBillingAddressSnapshot && typeof row.customerBillingAddressSnapshot === 'object'
      ? JSON.stringify(row.customerBillingAddressSnapshot)
      : ''
  const shipping =
    row.customerShippingAddressSnapshot && typeof row.customerShippingAddressSnapshot === 'object'
      ? JSON.stringify(row.customerShippingAddressSnapshot)
      : billing

  const meta =
    row.commercialMetadata && typeof row.commercialMetadata === 'object'
      ? (row.commercialMetadata as Record<string, unknown>)
      : {}

  return {
    id: row.id,
    invoiceNo,
    invoiceDate: dateOnly(row.invoiceDate),
    dueDate: row.dueDate ? dateOnly(row.dueDate) : dateOnly(row.invoiceDate),
    status,
    paymentStatus,
    source: mapSource(row),
    customerId: row.customerId,
    customerName: row.customerNameSnapshot,
    customerGstin: row.customerGstinSnapshot ?? '',
    customerState: row.customerStateCodeSnapshot ?? '',
    customerAddress: billing,
    placeOfSupply: row.placeOfSupply ?? row.customerStateCodeSnapshot ?? '',
    billingAddress: typeof meta.billingAddress === 'string' ? meta.billingAddress : billing,
    shippingAddress: typeof meta.shippingAddress === 'string' ? meta.shippingAddress : shipping,
    deliveryTerms: row.deliveryTerms ?? '',
    paymentTerms: row.paymentTerms ?? '',
    customerPoNumber: row.customerPoNumber,
    salesOrderId: row.salesOrderId,
    salesOrderNo: row.salesOrderNo,
    quotationId: row.quotationId,
    quotationNo: row.quotationNo,
    proformaInvoiceId: row.proformaInvoiceId,
    proformaNo: row.proformaNo,
    remarks: row.narration ?? '',
    lines: row.lines.map((line) => {
      const taxAmt = dec(line.cgstAmount) + dec(line.sgstAmount) + dec(line.igstAmount)
      const taxPct =
        dec(line.igstRate) > 0
          ? dec(line.igstRate)
          : dec(line.cgstRate) + dec(line.sgstRate)
      return {
        id: line.id,
        lineNo: line.lineNumber,
        itemId: line.itemId ?? '',
        itemCode: line.itemCodeSnapshot ?? '',
        description: line.description ?? line.itemNameSnapshot ?? '',
        hsnCode: line.hsnCodeSnapshot ?? '',
        qty: dec(line.quantity),
        uom: line.uomSnapshot ?? 'NOS',
        unitPrice: dec(line.unitRate),
        discountPct: dec(line.discountPercent),
        taxPct,
        taxableValue: dec(line.taxableAmount),
        gstAmount: taxAmt,
        lineTotal: dec(line.lineTotal),
        sourceLineId: line.sourceLineId,
        maxQty: null as number | null,
      }
    }),
    gst: {
      scheme: igst > 0 && cgst + sgst <= 0 ? 'igst' : 'cgst_sgst',
      taxableAmount: taxable,
      cgstRate: taxable > 0 && cgst > 0 ? Math.round((cgst / taxable) * 10000) / 100 : 0,
      cgstAmount: cgst,
      sgstRate: taxable > 0 && sgst > 0 ? Math.round((sgst / taxable) * 10000) / 100 : 0,
      sgstAmount: sgst,
      igstRate: taxable > 0 && igst > 0 ? Math.round((igst / taxable) * 10000) / 100 : 0,
      igstAmount: igst,
      totalTax: dec(row.totalTaxAmount),
      grandTotal,
    },
    amountPaid,
    balanceDue,
    accountingStatus: mapSiAccountingStatus(row.status),
    salesInvoiceId: row.id,
    salesInvoiceNumber: row.invoiceNumber ?? row.draftReference,
    accountingSubmittedAt:
      row.status === 'READY_TO_POST' || row.status === 'POSTED' ? row.updatedAt.toISOString() : null,
    accountingConvertedAt: row.postedAt?.toISOString() ?? null,
    lastPaymentDate: null as string | null,
    createdByName: typeof meta.createdByNameSnapshot === 'string' ? meta.createdByNameSnapshot : '',
    postedAt: row.postedAt?.toISOString() ?? null,
    cancelledAt: row.cancelledAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    createdBy: row.createdBy ?? '',
    createdChannel: row.createdChannel,
    legalEntityId: row.legalEntityId,
    siStatus: row.status,
  }
}

export async function findUnifiedInvoiceById(tenantId: string, id: string): Promise<SiWithLines | null> {
  const byId = await prisma.salesInvoice.findFirst({
    where: { id, tenantId },
    include: { lines: { orderBy: { lineNumber: 'asc' } } },
  })
  if (byId) return byId
  return prisma.salesInvoice.findFirst({
    where: { tenantId, legacyCrmTaxInvoiceId: id },
    include: { lines: { orderBy: { lineNumber: 'asc' } } },
  })
}

function mapCrmListStatusToSi(status?: string): Prisma.EnumSalesInvoiceStatusFilter | undefined {
  if (!status) return undefined
  if (status === 'draft') return { in: ['DRAFT'] }
  if (status === 'cancelled') return { in: ['CANCELLED', 'REVERSED'] }
  if (status === 'posted' || status === 'partially_paid' || status === 'paid') {
    return { in: ['READY_TO_POST', 'POSTED'] }
  }
  return undefined
}

export async function listUnifiedInvoices(tenantId: string, query: ListInvoicesQuery) {
  const { skip, take, page, limit } = getPagination(query)
  const where: Prisma.SalesInvoiceWhereInput = {
    tenantId,
    ...(query.companyId ? { customerId: query.companyId } : {}),
    ...(query.salesOrderId ? { salesOrderId: query.salesOrderId } : {}),
    ...(mapCrmListStatusToSi(query.status) ? { status: mapCrmListStatusToSi(query.status) } : {}),
    ...(query.openOnly
      ? {
          status: 'POSTED',
          receivableOpenItems: { some: { side: 'DEBIT', openAmount: { gt: 0 } } },
        }
      : {}),
  }
  const [total, rows] = await Promise.all([
    prisma.salesInvoice.count({ where }),
    prisma.salesInvoice.findMany({
      where,
      include: { lines: { orderBy: { lineNumber: 'asc' } } },
      orderBy: [{ invoiceDate: 'desc' }, { createdAt: 'desc' }],
      skip,
      take,
    }),
  ])
  const items = await Promise.all(rows.map((r) => mapSalesInvoiceToCrmDto(r)))
  return { items, total, page, limit }
}

export async function getUnifiedInvoice(tenantId: string, id: string) {
  const row = await findUnifiedInvoiceById(tenantId, id)
  if (!row) throw new NotFoundError('Tax invoice not found')
  return mapSalesInvoiceToCrmDto(row)
}

function resolveSourceType(input: CreateInvoiceInput | UpdateInvoiceInput): {
  sourceType: 'DIRECT' | 'SALES_ORDER' | 'PROFORMA_INVOICE'
  sourceDocumentId: string | null
} {
  if (input.salesOrderId) return { sourceType: 'SALES_ORDER', sourceDocumentId: input.salesOrderId }
  if (input.proformaInvoiceId) {
    return { sourceType: 'PROFORMA_INVOICE', sourceDocumentId: input.proformaInvoiceId }
  }
  return { sourceType: 'DIRECT', sourceDocumentId: null }
}

export async function createUnifiedInvoice(
  tenantId: string,
  userId: string,
  input: CreateInvoiceInput,
  audit?: AuditBits,
) {
  const legalEntityId = await resolveDefaultLegalEntityId(tenantId)
  const party = await requireActiveCustomerParty(tenantId, input.companyId)
  const legalEntity = await prisma.legalEntity.findFirstOrThrow({
    where: { id: legalEntityId, tenantId },
    select: { id: true, stateCode: true },
  })

  const invoiceDate = (input.invoiceDate ?? new Date().toISOString().slice(0, 10)).slice(0, 10)
  const dueDate = (
    input.dueDate ??
    new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10)
  ).slice(0, 10)
  const { sourceType, sourceDocumentId } = resolveSourceType(input)

  let sourceSnapshot: unknown = null
  if (sourceType === 'SALES_ORDER' && sourceDocumentId) {
    const source = await loadSalesOrderSource(tenantId, sourceDocumentId, input.companyId)
    sourceSnapshot = source.snapshot
  }
  if (sourceType === 'PROFORMA_INVOICE' && sourceDocumentId) {
    const source = await loadProformaInvoiceSource(tenantId, sourceDocumentId, input.companyId)
    sourceSnapshot = source.snapshot
  }

  const lines = input.lines.map((l, idx) => ({
    lineNumber: idx + 1,
    itemId: l.itemId,
    itemCode: l.itemCode,
    itemName: l.description,
    description: l.description,
    hsnCode: l.hsnCode ?? null,
    uom: l.uom ?? 'NOS',
    quantity: String(l.qty),
    unitPrice: String(l.unitPrice),
    lineDiscountType: 'PERCENTAGE' as const,
    lineDiscountValue: String(l.discountPct ?? 0),
    gstRate: String(l.taxPct ?? 0),
    sourceLineId: l.sourceLineId ?? null,
  }))

  const placeOfSupply = await resolveUnifiedPlaceOfSupply(
    tenantId,
    {
      placeOfSupply: input.placeOfSupply,
      placeOfSupplyStateCode: input.placeOfSupplyStateCode,
      customerState: input.customerState,
      salesOrderId: input.salesOrderId,
      proformaInvoiceId: input.proformaInvoiceId,
    },
    party.stateCode,
  )

  const draftInput = {
    legalEntityId,
    branchId: null as string | null,
    customerId: input.companyId,
    sourceType,
    sourceDocumentId,
    invoiceDate,
    postingDate: invoiceDate,
    dueDate,
    placeOfSupply,
    taxTreatment: (party.gstin ? 'REGISTERED' : 'UNREGISTERED') as 'REGISTERED' | 'UNREGISTERED',
    currencyCode: 'INR',
    exchangeRate: '1',
    taxPricingMode: 'EXCLUSIVE' as const,
    freightMode: 'NON_TAXABLE' as const,
    freightAmount: '0',
    otherChargesAmount: '0',
    roundingMode: 'NONE' as const,
    referenceNumber: null as string | null,
    customerPoNumber: input.customerPoNumber ?? null,
    narration: input.remarks ?? null,
    lines,
  }

  const sourceLinksInput =
    sourceType === 'SALES_ORDER' && sourceDocumentId
      ? input.lines
          .filter((l) => l.sourceLineId)
          .map((l) => ({
            sourceType: 'SALES_ORDER' as const,
            sourceDocumentId,
            sourceLineId: l.sourceLineId!,
            salesOrderId: sourceDocumentId,
            salesOrderLineId: l.sourceLineId!,
            quantity: String(l.qty),
            itemId: l.itemId,
            itemCodeSnapshot: l.itemCode,
            itemNameSnapshot: l.description,
            sourceDocumentNumberSnapshot: input.salesOrderNo ?? null,
          }))
      : []

  const enrichedLinks = await validateAndEnrichSalesInvoiceSourceLinks({
    tenantId,
    customerId: input.companyId,
    sourceType,
    sourceDocumentId,
    sourceLinks: sourceLinksInput.length ? sourceLinksInput : undefined,
  })

  const calcInput = buildCalculationInputFromRequest(
    draftInput as unknown as CreateSalesInvoiceInput,
    legalEntity.stateCode,
  )
  const calc = calculateSalesInvoice(calcInput)
  if (!calc.valid) {
    throw new ValidationError(calc.errors[0]?.message ?? 'Invoice calculation failed')
  }

  const createdByName = await resolveUserDisplayName(tenantId, userId)
  const invoice = await siRepo.createSalesInvoiceDraft(
    tenantId,
    draftInput as unknown as CreateSalesInvoiceInput,
    calc,
    party,
    userId,
    {
    sourceDocumentSnapshot: sourceSnapshot,
    sourceLinks: enrichedLinks.sourceLinks,
    commercial: {
      quotationId: input.quotationId ?? null,
      quotationNo: input.quotationNo ?? null,
      proformaInvoiceId: input.proformaInvoiceId ?? null,
      proformaNo: input.proformaNo ?? null,
      salesOrderId: input.salesOrderId ?? null,
      salesOrderNo: input.salesOrderNo ?? null,
      deliveryTerms: input.deliveryTerms ?? null,
      paymentTerms: input.paymentTerms ?? null,
      createdChannel: 'CRM',
      commercialMetadata: {
        createdByNameSnapshot: createdByName,
        billingAddress: input.billingAddress ?? null,
        shippingAddress: input.shippingAddress ?? null,
        customerState: input.customerState ?? party.stateCode,
        crmSource: input.source ?? 'direct',
      },
    },
  })

  await createAuditLog({
    tenantId,
    userId,
    module: 'crm',
    entity: 'salesInvoice',
    entityId: invoice.id,
    action: 'CREATE',
    newValues: {
      draftReference: invoice.draftReference,
      totalAmount: dec(invoice.totalAmount),
      createdChannel: 'CRM',
    },
    ipAddress: audit?.ipAddress,
    userAgent: audit?.userAgent,
  })

  return mapSalesInvoiceToCrmDto(invoice)
}

export async function updateUnifiedInvoice(
  tenantId: string,
  id: string,
  userId: string,
  input: UpdateInvoiceInput,
  audit?: AuditBits,
) {
  const existing = await findUnifiedInvoiceById(tenantId, id)
  if (!existing) throw new NotFoundError('Tax invoice not found')
  if (existing.status !== 'DRAFT' && existing.status !== 'READY_TO_POST') {
    throw new ValidationError('Only draft invoices can be edited')
  }

  const companyId = input.companyId ?? existing.customerId
  const party = await requireActiveCustomerParty(tenantId, companyId)
  const legalEntity = await prisma.legalEntity.findFirstOrThrow({
    where: { id: existing.legalEntityId, tenantId },
    select: { id: true, stateCode: true },
  })

  const invoiceDate = (input.invoiceDate ?? dateOnly(existing.invoiceDate)).slice(0, 10)
  const dueDate = (input.dueDate ?? (existing.dueDate ? dateOnly(existing.dueDate) : invoiceDate)).slice(0, 10)
  const { sourceType, sourceDocumentId } = resolveSourceType({
    ...input,
    salesOrderId: input.salesOrderId !== undefined ? input.salesOrderId : existing.salesOrderId,
    proformaInvoiceId:
      input.proformaInvoiceId !== undefined ? input.proformaInvoiceId : existing.proformaInvoiceId,
  } as UpdateInvoiceInput)

  const lineSource = input.lines?.length
    ? input.lines
    : existing.lines.map((l) => ({
        itemId: l.itemId ?? '',
        itemCode: l.itemCodeSnapshot ?? '',
        description: l.description ?? '',
        hsnCode: l.hsnCodeSnapshot,
        qty: dec(l.quantity),
        uom: l.uomSnapshot ?? 'NOS',
        unitPrice: dec(l.unitRate),
        discountPct: dec(l.discountPercent),
        taxPct: dec(l.igstRate) > 0 ? dec(l.igstRate) : dec(l.cgstRate) + dec(l.sgstRate),
        sourceLineId: l.sourceLineId,
        maxQty: null as number | null,
      }))

  if (!lineSource.length) throw new ValidationError('At least one line is required')

  const lines = lineSource.map((l, idx) => ({
    lineNumber: idx + 1,
    itemId: l.itemId || null,
    itemCode: l.itemCode,
    itemName: l.description,
    description: l.description,
    hsnCode: l.hsnCode ?? null,
    uom: l.uom ?? 'NOS',
    quantity: String(l.qty),
    unitPrice: String(l.unitPrice),
    lineDiscountType: 'PERCENTAGE' as const,
    lineDiscountValue: String(l.discountPct ?? 0),
    gstRate: String(l.taxPct ?? 0),
    sourceLineId: l.sourceLineId ?? null,
  }))

  const placeOfSupply = await resolveUnifiedPlaceOfSupply(
    tenantId,
    {
      placeOfSupply: input.placeOfSupply,
      placeOfSupplyStateCode: input.placeOfSupplyStateCode,
      customerState: input.customerState,
      salesOrderId:
        input.salesOrderId !== undefined ? input.salesOrderId : existing.salesOrderId,
      proformaInvoiceId:
        input.proformaInvoiceId !== undefined
          ? input.proformaInvoiceId
          : existing.proformaInvoiceId,
    },
    party.stateCode,
    existing.placeOfSupply,
  )

  const draftInput = {
    legalEntityId: existing.legalEntityId,
    branchId: existing.branchId,
    customerId: companyId,
    sourceType,
    sourceDocumentId,
    invoiceDate,
    postingDate: invoiceDate,
    dueDate,
    placeOfSupply,
    taxTreatment: existing.taxTreatment,
    currencyCode: existing.currencyCode,
    exchangeRate: String(dec(existing.exchangeRate) || 1),
    taxPricingMode: 'EXCLUSIVE' as const,
    freightMode: 'NON_TAXABLE' as const,
    freightAmount: '0',
    otherChargesAmount: '0',
    roundingMode: 'NONE' as const,
    referenceNumber: existing.referenceNumber,
    customerPoNumber:
      input.customerPoNumber !== undefined ? input.customerPoNumber : existing.customerPoNumber,
    narration: input.remarks !== undefined ? input.remarks : existing.narration,
    lines,
    updatedAt: existing.updatedAt.toISOString(),
  }

  const calcInput = buildCalculationInputFromRequest(
    draftInput as unknown as CreateSalesInvoiceInput,
    legalEntity.stateCode,
  )
  const calc = calculateSalesInvoice(calcInput)
  if (!calc.valid) {
    throw new ValidationError(calc.errors[0]?.message ?? 'Invoice calculation failed')
  }

  const reopenFromReady = existing.status === 'READY_TO_POST'
  const invoice = await siRepo.replaceEditableInvoiceLines(
    tenantId,
    existing.id,
    draftInput as unknown as UpdateSalesInvoiceInput,
    calc,
    party,
    userId,
    { reopenFromReady },
  )

  const prevMeta =
    existing.commercialMetadata && typeof existing.commercialMetadata === 'object'
      ? (existing.commercialMetadata as Record<string, unknown>)
      : {}

  await prisma.salesInvoice.update({
    where: { id: existing.id },
    data: {
      quotationId: input.quotationId !== undefined ? input.quotationId : existing.quotationId,
      quotationNo: input.quotationNo !== undefined ? input.quotationNo : existing.quotationNo,
      proformaInvoiceId:
        input.proformaInvoiceId !== undefined ? input.proformaInvoiceId : existing.proformaInvoiceId,
      proformaNo: input.proformaNo !== undefined ? input.proformaNo : existing.proformaNo,
      salesOrderId: input.salesOrderId !== undefined ? input.salesOrderId : existing.salesOrderId,
      salesOrderNo: input.salesOrderNo !== undefined ? input.salesOrderNo : existing.salesOrderNo,
      deliveryTerms: input.deliveryTerms !== undefined ? input.deliveryTerms : existing.deliveryTerms,
      paymentTerms: input.paymentTerms !== undefined ? input.paymentTerms : existing.paymentTerms,
      sourceType,
      sourceDocumentId,
      commercialMetadata: {
        ...prevMeta,
        billingAddress:
          input.billingAddress !== undefined ? input.billingAddress : prevMeta.billingAddress,
        shippingAddress:
          input.shippingAddress !== undefined ? input.shippingAddress : prevMeta.shippingAddress,
        customerState: input.customerState ?? prevMeta.customerState,
        crmSource: input.source ?? prevMeta.crmSource,
      } as Prisma.InputJsonValue,
    },
  })

  await createAuditLog({
    tenantId,
    userId,
    module: 'crm',
    entity: 'salesInvoice',
    entityId: existing.id,
    action: 'UPDATE',
    newValues: { totalAmount: dec(invoice.totalAmount) },
    ipAddress: audit?.ipAddress,
    userAgent: audit?.userAgent,
  })

  const refreshed = await findUnifiedInvoiceById(tenantId, existing.id)
  return mapSalesInvoiceToCrmDto(refreshed!)
}

export async function postUnifiedInvoice(
  tenantId: string,
  id: string,
  userId: string,
  opts?: { canGlPost?: boolean; req?: import('express').Request } & AuditBits,
) {
  const existing = await findUnifiedInvoiceById(tenantId, id)
  if (!existing) throw new NotFoundError('Tax invoice not found')
  if (existing.status !== 'DRAFT' && existing.status !== 'READY_TO_POST') {
    throw new ValidationError('Only draft invoices can be posted')
  }

  // Mark Ready (Money In lifecycle) — CRM "post" always reaches at least READY_TO_POST
  if (existing.status === 'DRAFT') {
    await siRepo.markSalesInvoiceReady(tenantId, existing.id, userId)
  }

  let glPosted = false
  if (opts?.canGlPost && opts.req) {
    try {
      const { postSalesInvoice } = await import('../posting/sales-invoice-posting.service.js')
      await postSalesInvoice(
        {
          tenantId,
          invoiceId: existing.id,
          userId,
          ipAddress: opts.ipAddress,
          userAgent: opts.userAgent,
        },
        opts.req,
      )
      glPosted = true
    } catch {
      glPosted = false
    }
  }

  await createAuditLog({
    tenantId,
    userId,
    module: 'crm',
    entity: 'salesInvoice',
    entityId: existing.id,
    action: 'POST',
    newValues: {
      markReady: true,
      glPosted,
    },
    ipAddress: opts?.ipAddress,
    userAgent: opts?.userAgent,
  })

  const refreshed = await findUnifiedInvoiceById(tenantId, existing.id)
  return mapSalesInvoiceToCrmDto(refreshed!)
}

export async function cancelUnifiedInvoice(
  tenantId: string,
  id: string,
  userId: string,
  audit?: AuditBits,
) {
  const existing = await findUnifiedInvoiceById(tenantId, id)
  if (!existing) throw new NotFoundError('Tax invoice not found')
  if (existing.status !== 'DRAFT' && existing.status !== 'READY_TO_POST') {
    throw new ValidationError('Only draft invoices can be cancelled')
  }

  await siRepo.cancelSalesInvoiceDraft(tenantId, existing.id, 'Cancelled from CRM', userId)

  await createAuditLog({
    tenantId,
    userId,
    module: 'crm',
    entity: 'salesInvoice',
    entityId: existing.id,
    action: 'CANCEL',
    ipAddress: audit?.ipAddress,
    userAgent: audit?.userAgent,
  })

  const refreshed = await findUnifiedInvoiceById(tenantId, existing.id)
  return mapSalesInvoiceToCrmDto(refreshed!)
}

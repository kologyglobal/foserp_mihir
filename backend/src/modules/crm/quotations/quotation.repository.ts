import type { Prisma } from '@prisma/client'
import { prisma } from '../../../config/prisma.js'
import { tenantActiveFilter } from '../../../shared/index.js'
import { ValidationError } from '../../../utils/errors.js'
import { normalizeSalesLineForWrite } from '../shared/crm-item-resolver.js'
import { DEFAULT_GST_PCT } from './quotation.constants.js'
import { syncLineTotals, resolveDocumentCharges } from './quotation.workflow.js'
import type {
  CreateQuotationInput,
  ListQuotationsQuery,
  UpdateQuotationDocumentInput,
  UpdateQuotationInput,
} from './quotation.validation.js'
import { computePricing } from './quotation.types.js'

const includeRelations = {
  documents: { where: { deletedAt: null }, orderBy: { revisionNo: 'desc' as const } },
  opportunity: { select: { opportunityCode: true } },
  company: { select: { id: true, name: true, companyCode: true } },
}

export { includeRelations }

function parseDate(value: string | null | undefined): Date | null | undefined {
  if (value === undefined) return undefined
  if (value === null) return null
  return new Date(value)
}

export async function findQuotations(
  tenantId: string,
  query: ListQuotationsQuery,
  orgScope: Prisma.CrmQuotationWhereInput = {},
) {
  const { getPagination } = await import('../../../utils/pagination.js')
  const { skip, take } = getPagination(query)

  const where: Prisma.CrmQuotationWhereInput = {
    ...tenantActiveFilter(tenantId),
    ...orgScope,
    ...(query.customerId ? { companyId: query.customerId } : {}),
    ...(query.opportunityId ? { opportunityId: query.opportunityId } : {}),
    ...(query.ownerId ? { salesOwnerId: query.ownerId } : {}),
    ...(query.status ? { status: query.status } : {}),
    ...(query.search
      ? {
          OR: [
            { quotationCode: { contains: query.search } },
            { company: { name: { contains: query.search } } },
          ],
        }
      : {}),
  }

  const [items, total] = await Promise.all([
    prisma.crmQuotation.findMany({ where, skip, take, include: includeRelations, orderBy: { createdAt: query.sortOrder } }),
    prisma.crmQuotation.count({ where }),
  ])

  return { items, total, page: query.page, limit: query.limit }
}

export async function findQuotationById(tenantId: string, id: string) {
  return prisma.crmQuotation.findFirst({
    where: { id, ...tenantActiveFilter(tenantId) },
    include: includeRelations,
  })
}

export async function findQuotationDocumentById(tenantId: string, quotationId: string, docId: string) {
  return prisma.crmQuotationDocument.findFirst({
    where: { id: docId, quotationId, ...tenantActiveFilter(tenantId) },
  })
}

export async function countQuotationsForOpportunity(tenantId: string, opportunityId: string) {
  return prisma.crmQuotation.count({
    where: { tenantId, opportunityId, deletedAt: null },
  })
}

export async function createQuotation(
  tenantId: string,
  userId: string,
  userName: string,
  data: CreateQuotationInput & { quotationCode: string },
) {
  const qty = data.qty ?? 1
  const unitPrice = data.unitPrice ?? 0
  const discountPct = data.discountPct ?? 0
  const gstPct = data.gstPct ?? DEFAULT_GST_PCT
  const pricing = computePricing(qty, unitPrice, discountPct, gstPct)
  const priceLinesRaw = syncLineTotals(data.priceLines ?? [])
  const priceLines = await Promise.all(priceLinesRaw.map((line) => normalizeSalesLineForWrite(tenantId, line)))
  const headerItemId = data.itemId?.trim() || priceLines[0]?.itemId
  if (!headerItemId) {
    throw new ValidationError('Quotation requires an Item (header itemId or price line itemId)')
  }
  const chargeFields = {
    freightAmount: data.freightAmount ?? 0,
    installationAmount: data.installationAmount ?? 0,
    customCharges: data.customCharges ?? 0,
    orderDiscountCalcType: data.orderDiscountCalcType,
    orderDiscountValue: data.orderDiscountValue,
    freightCalcType: data.freightCalcType,
    freightValue: data.freightValue ?? data.freightAmount ?? 0,
    freightIsTaxable: data.freightIsTaxable,
    freightTaxRate: data.freightTaxRate,
    installationCalcType: data.installationCalcType,
    installationValue: data.installationValue ?? data.installationAmount ?? 0,
    installationIsTaxable: data.installationIsTaxable,
    installationTaxRate: data.installationTaxRate,
    customChargesCalcType: data.customChargesCalcType,
    customChargesValue: data.customChargesValue ?? data.customCharges ?? 0,
    customChargesIsTaxable: data.customChargesIsTaxable,
    customChargesTaxRate: data.customChargesTaxRate,
  }
  const { persist: chargePersist } = data.priceLines?.length
    ? resolveDocumentCharges(priceLines, chargeFields)
    : {
        persist: {
          ...chargeFields,
          freightAmount: chargeFields.freightAmount,
          installationAmount: chargeFields.installationAmount,
          customCharges: chargeFields.customCharges,
          totalAmount: pricing.grandTotal,
          orderDiscountCalcType: (data.orderDiscountCalcType ?? 'FLAT') as string,
          orderDiscountValue: data.orderDiscountValue ?? 0,
          orderDiscountAmount: 0,
          freightCalcType: (data.freightCalcType ?? 'FLAT') as string,
          freightValue: chargeFields.freightValue,
          freightIsTaxable: Boolean(data.freightIsTaxable),
          freightTaxRate: data.freightTaxRate ?? 0,
          freightTaxAmount: 0,
          installationCalcType: (data.installationCalcType ?? 'FLAT') as string,
          installationValue: chargeFields.installationValue,
          installationIsTaxable: Boolean(data.installationIsTaxable),
          installationTaxRate: data.installationTaxRate ?? 0,
          installationTaxAmount: 0,
          customChargesCalcType: (data.customChargesCalcType ?? 'FLAT') as string,
          customChargesValue: chargeFields.customChargesValue,
          customChargesIsTaxable: Boolean(data.customChargesIsTaxable),
          customChargesTaxRate: data.customChargesTaxRate ?? 0,
          customChargesTaxAmount: 0,
        },
      }
  const freightAmount = chargePersist.freightAmount
  const installationAmount = chargePersist.installationAmount
  const customCharges = chargePersist.customCharges
  const totalAmount = chargePersist.totalAmount

  return prisma.$transaction(async (tx) => {
    const { defaultOrgDimsForUser } = await import('../shared/crm-org-scope.js')
    const org = await defaultOrgDimsForUser(tenantId, userId)
    const quotation = await tx.crmQuotation.create({
      data: {
        tenantId,
        quotationCode: data.quotationCode,
        companyId: data.customerId,
        opportunityId: data.opportunityId ?? null,
        itemId: headerItemId,
        qty,
        validityDate: parseDate(data.validityDate),
        salesOwnerId: data.salesOwnerId ?? userId,
        salesOwnerName: data.salesOwnerName ?? userName,
        status: 'draft',
        revisionNo: 1,
        locked: false,
        terms: data.terms ?? '',
        paymentTerms: data.paymentTerms ?? '',
        deliveryTerms: data.deliveryTerms ?? '',
        deliveryTime: data.deliveryTime ?? '',
        locationId: data.locationId ?? null,
        legalEntityId: org.legalEntityId ?? null,
        branchId: org.branchId ?? null,
        pricing: pricing as unknown as Prisma.InputJsonValue,
        changeHistory: [
          {
            revisionNo: 1,
            changedAt: new Date().toISOString(),
            changedByName: userName,
            summary: data.summary ?? 'Initial quotation created',
          },
        ],
        customerApproval: 'pending',
        createdBy: userId,
        updatedBy: userId,
      },
    })

    await tx.crmQuotationDocument.create({
      data: {
        tenantId,
        quotationId: quotation.id,
        revisionNo: 1,
        templateId: data.templateId ?? null,
        opportunityId: data.opportunityId ?? null,
        status: 'draft',
        totalAmount,
        freightAmount,
        installationAmount,
        customCharges,
        orderDiscountCalcType: chargePersist.orderDiscountCalcType,
        orderDiscountValue: chargePersist.orderDiscountValue,
        orderDiscountAmount: chargePersist.orderDiscountAmount,
        freightCalcType: chargePersist.freightCalcType,
        freightValue: chargePersist.freightValue,
        freightIsTaxable: chargePersist.freightIsTaxable,
        freightTaxRate: chargePersist.freightTaxRate,
        freightTaxAmount: chargePersist.freightTaxAmount,
        installationCalcType: chargePersist.installationCalcType,
        installationValue: chargePersist.installationValue,
        installationIsTaxable: chargePersist.installationIsTaxable,
        installationTaxRate: chargePersist.installationTaxRate,
        installationTaxAmount: chargePersist.installationTaxAmount,
        customChargesCalcType: chargePersist.customChargesCalcType,
        customChargesValue: chargePersist.customChargesValue,
        customChargesIsTaxable: chargePersist.customChargesIsTaxable,
        customChargesTaxRate: chargePersist.customChargesTaxRate,
        customChargesTaxAmount: chargePersist.customChargesTaxAmount,
        sections: data.sections ?? [],
        priceLines,
        commercialNotes: data.commercialNotes ?? null,
        technicalNotes: data.technicalNotes ?? null,
        contactId: data.contactId ?? null,
        salesOwnerId: data.salesOwnerId ?? userId,
        salesOwnerName: data.salesOwnerName ?? userName,
        locationId: data.locationId ?? null,
        approvalHistory: [],
        locked: false,
        createdBy: userId,
        createdByName: userName,
        updatedBy: userId,
      },
    })

    return tx.crmQuotation.findUniqueOrThrow({ where: { id: quotation.id }, include: includeRelations })
  })
}

export async function updateQuotation(tenantId: string, id: string, userId: string, data: UpdateQuotationInput) {
  return prisma.$transaction(async (tx) => {
    const existing = await tx.crmQuotation.findFirst({ where: { id, tenantId, deletedAt: null } })
    if (!existing) throw new Error('Not found')

    let pricing: Prisma.InputJsonValue = existing.pricing ?? {}
    if (data.unitPrice !== undefined || data.discountPct !== undefined || data.gstPct !== undefined || data.qty !== undefined) {
      const qty = data.qty ?? Number(existing.qty)
      const current = (existing.pricing && typeof existing.pricing === 'object' ? existing.pricing : {}) as {
        unitPrice?: number
        discountPct?: number
        gstPct?: number
      }
      pricing = computePricing(
        qty,
        data.unitPrice ?? current.unitPrice ?? 0,
        data.discountPct ?? current.discountPct ?? 0,
        data.gstPct ?? current.gstPct ?? DEFAULT_GST_PCT,
      ) as unknown as Prisma.InputJsonValue
    }

    const updateData: Prisma.CrmQuotationUpdateInput = {
      ...(data.customerId !== undefined ? { company: { connect: { id: data.customerId } } } : {}),
      ...(data.opportunityId !== undefined ? { opportunityId: data.opportunityId } : {}),
      ...(data.itemId !== undefined && data.itemId !== null ? { itemId: data.itemId } : {}),
      ...(data.qty !== undefined ? { qty: data.qty } : {}),
      ...(data.validityDate !== undefined ? { validityDate: parseDate(data.validityDate) } : {}),
      ...(data.salesOwnerId !== undefined ? { salesOwnerId: data.salesOwnerId } : {}),
      ...(data.salesOwnerName !== undefined ? { salesOwnerName: data.salesOwnerName } : {}),
      ...(data.status !== undefined ? { status: data.status } : {}),
      ...(data.terms !== undefined ? { terms: data.terms } : {}),
      ...(data.paymentTerms !== undefined ? { paymentTerms: data.paymentTerms } : {}),
      ...(data.deliveryTerms !== undefined ? { deliveryTerms: data.deliveryTerms } : {}),
      ...(data.deliveryTime !== undefined ? { deliveryTime: data.deliveryTime } : {}),
      ...(data.locationId !== undefined ? { locationId: data.locationId } : {}),
      ...(data.customerApproval !== undefined ? { customerApproval: data.customerApproval } : {}),
      ...(data.unitPrice !== undefined || data.discountPct !== undefined || data.gstPct !== undefined || data.qty !== undefined
        ? { pricing }
        : {}),
      updatedBy: userId,
    }

    await tx.crmQuotation.update({
      where: { id, tenantId },
      data: updateData,
    })

    return tx.crmQuotation.findUniqueOrThrow({ where: { id }, include: includeRelations })
  })
}

export async function updateQuotationDocument(
  tenantId: string,
  quotationId: string,
  docId: string,
  userId: string,
  data: UpdateQuotationDocumentInput,
) {
  return prisma.$transaction(async (tx) => {
    const doc = await tx.crmQuotationDocument.findFirst({
      where: { id: docId, quotationId, tenantId, deletedAt: null },
    })
    if (!doc) throw new Error('Not found')

    const priceLines = data.priceLines
      ? await Promise.all(syncLineTotals(data.priceLines).map((line) => normalizeSalesLineForWrite(tenantId, line)))
      : undefined
    const linesRaw =
      priceLines ??
      (Array.isArray(doc.priceLines)
        ? (doc.priceLines as Array<{ qty?: number; unitPrice?: number; discountPct?: number; taxPct?: number }>)
        : [])
    const mergedFields = {
      freightAmount: data.freightAmount ?? Number(doc.freightAmount),
      installationAmount: data.installationAmount ?? Number(doc.installationAmount),
      customCharges: data.customCharges ?? Number(doc.customCharges),
      orderDiscountCalcType: data.orderDiscountCalcType ?? (doc as { orderDiscountCalcType?: string }).orderDiscountCalcType,
      orderDiscountValue: data.orderDiscountValue ?? Number((doc as { orderDiscountValue?: unknown }).orderDiscountValue ?? 0),
      freightCalcType: data.freightCalcType ?? (doc as { freightCalcType?: string }).freightCalcType,
      freightValue: data.freightValue ?? Number((doc as { freightValue?: unknown }).freightValue ?? doc.freightAmount),
      freightIsTaxable: data.freightIsTaxable ?? Boolean((doc as { freightIsTaxable?: boolean }).freightIsTaxable),
      freightTaxRate: data.freightTaxRate ?? Number((doc as { freightTaxRate?: unknown }).freightTaxRate ?? 0),
      installationCalcType: data.installationCalcType ?? (doc as { installationCalcType?: string }).installationCalcType,
      installationValue:
        data.installationValue ?? Number((doc as { installationValue?: unknown }).installationValue ?? doc.installationAmount),
      installationIsTaxable:
        data.installationIsTaxable ?? Boolean((doc as { installationIsTaxable?: boolean }).installationIsTaxable),
      installationTaxRate:
        data.installationTaxRate ?? Number((doc as { installationTaxRate?: unknown }).installationTaxRate ?? 0),
      customChargesCalcType: data.customChargesCalcType ?? (doc as { customChargesCalcType?: string }).customChargesCalcType,
      customChargesValue:
        data.customChargesValue ?? Number((doc as { customChargesValue?: unknown }).customChargesValue ?? doc.customCharges),
      customChargesIsTaxable:
        data.customChargesIsTaxable ?? Boolean((doc as { customChargesIsTaxable?: boolean }).customChargesIsTaxable),
      customChargesTaxRate:
        data.customChargesTaxRate ?? Number((doc as { customChargesTaxRate?: unknown }).customChargesTaxRate ?? 0),
    }
    const { persist } = resolveDocumentCharges(linesRaw, mergedFields)
    const totalAmount = data.totalAmount ?? persist.totalAmount

    await tx.crmQuotationDocument.update({
      where: { id: docId },
      data: {
        ...(data.sections !== undefined ? { sections: data.sections } : {}),
        ...(priceLines !== undefined ? { priceLines } : {}),
        freightAmount: persist.freightAmount,
        installationAmount: persist.installationAmount,
        customCharges: persist.customCharges,
        orderDiscountCalcType: persist.orderDiscountCalcType,
        orderDiscountValue: persist.orderDiscountValue,
        orderDiscountAmount: persist.orderDiscountAmount,
        freightCalcType: persist.freightCalcType,
        freightValue: persist.freightValue,
        freightIsTaxable: persist.freightIsTaxable,
        freightTaxRate: persist.freightTaxRate,
        freightTaxAmount: persist.freightTaxAmount,
        installationCalcType: persist.installationCalcType,
        installationValue: persist.installationValue,
        installationIsTaxable: persist.installationIsTaxable,
        installationTaxRate: persist.installationTaxRate,
        installationTaxAmount: persist.installationTaxAmount,
        customChargesCalcType: persist.customChargesCalcType,
        customChargesValue: persist.customChargesValue,
        customChargesIsTaxable: persist.customChargesIsTaxable,
        customChargesTaxRate: persist.customChargesTaxRate,
        customChargesTaxAmount: persist.customChargesTaxAmount,
        ...(data.commercialNotes !== undefined ? { commercialNotes: data.commercialNotes } : {}),
        ...(data.technicalNotes !== undefined ? { technicalNotes: data.technicalNotes } : {}),
        ...(data.contactId !== undefined ? { contactId: data.contactId } : {}),
        ...(data.salesOwnerId !== undefined ? { salesOwnerId: data.salesOwnerId } : {}),
        ...(data.salesOwnerName !== undefined ? { salesOwnerName: data.salesOwnerName } : {}),
        ...(data.locationId !== undefined ? { locationId: data.locationId } : {}),
        ...(data.status !== undefined ? { status: data.status } : {}),
        totalAmount,
        updatedBy: userId,
      },
    })

    return tx.crmQuotation.findUniqueOrThrow({ where: { id: quotationId }, include: includeRelations })
  })
}

export async function createQuotationRevision(
  tenantId: string,
  quotationId: string,
  userId: string,
  userName: string,
  reason: string,
) {
  return prisma.$transaction(async (tx) => {
    const quotation = await tx.crmQuotation.findFirst({ where: { id: quotationId, tenantId, deletedAt: null } })
    if (!quotation) throw new Error('Not found')

    const latest = await tx.crmQuotationDocument.findFirst({
      where: { quotationId, tenantId, deletedAt: null },
      orderBy: { revisionNo: 'desc' },
    })
    if (!latest) throw new Error('No document')

    await tx.crmQuotationDocument.update({
      where: { id: latest.id },
      data: { locked: true, updatedBy: userId },
    })

    const nextRev = latest.revisionNo + 1
    await tx.crmQuotationDocument.create({
      data: {
        tenantId,
        quotationId,
        revisionNo: nextRev,
        templateId: latest.templateId,
        opportunityId: latest.opportunityId,
        status: 'draft',
        totalAmount: latest.totalAmount,
        freightAmount: latest.freightAmount,
        installationAmount: latest.installationAmount,
        customCharges: latest.customCharges,
        orderDiscountCalcType: (latest as { orderDiscountCalcType?: string }).orderDiscountCalcType ?? 'FLAT',
        orderDiscountValue: (latest as { orderDiscountValue?: unknown }).orderDiscountValue ?? 0,
        orderDiscountAmount: (latest as { orderDiscountAmount?: unknown }).orderDiscountAmount ?? 0,
        freightCalcType: (latest as { freightCalcType?: string }).freightCalcType ?? 'FLAT',
        freightValue: (latest as { freightValue?: unknown }).freightValue ?? latest.freightAmount,
        freightIsTaxable: Boolean((latest as { freightIsTaxable?: boolean }).freightIsTaxable),
        freightTaxRate: (latest as { freightTaxRate?: unknown }).freightTaxRate ?? 0,
        freightTaxAmount: (latest as { freightTaxAmount?: unknown }).freightTaxAmount ?? 0,
        installationCalcType: (latest as { installationCalcType?: string }).installationCalcType ?? 'FLAT',
        installationValue: (latest as { installationValue?: unknown }).installationValue ?? latest.installationAmount,
        installationIsTaxable: Boolean((latest as { installationIsTaxable?: boolean }).installationIsTaxable),
        installationTaxRate: (latest as { installationTaxRate?: unknown }).installationTaxRate ?? 0,
        installationTaxAmount: (latest as { installationTaxAmount?: unknown }).installationTaxAmount ?? 0,
        customChargesCalcType: (latest as { customChargesCalcType?: string }).customChargesCalcType ?? 'FLAT',
        customChargesValue: (latest as { customChargesValue?: unknown }).customChargesValue ?? latest.customCharges,
        customChargesIsTaxable: Boolean((latest as { customChargesIsTaxable?: boolean }).customChargesIsTaxable),
        customChargesTaxRate: (latest as { customChargesTaxRate?: unknown }).customChargesTaxRate ?? 0,
        customChargesTaxAmount: (latest as { customChargesTaxAmount?: unknown }).customChargesTaxAmount ?? 0,
        sections: latest.sections ?? [],
        priceLines: latest.priceLines ?? [],
        commercialNotes: latest.commercialNotes,
        technicalNotes: latest.technicalNotes,
        contactId: latest.contactId,
        salesOwnerId: latest.salesOwnerId,
        salesOwnerName: latest.salesOwnerName,
        locationId: latest.locationId,
        revisionReason: reason,
        approvalHistory: [],
        locked: false,
        createdBy: userId,
        createdByName: userName,
        updatedBy: userId,
      },
    })

    const history = Array.isArray(quotation.changeHistory) ? [...(quotation.changeHistory as object[])] : []
    history.push({
      revisionNo: nextRev,
      changedAt: new Date().toISOString(),
      changedByName: userName,
      summary: reason,
    })

    await tx.crmQuotation.update({
      where: { id: quotationId },
      data: {
        revisionNo: nextRev,
        status: 'draft',
        locked: false,
        customerApproval: 'pending',
        changeHistory: history,
        updatedBy: userId,
      },
    })

    return tx.crmQuotation.findUniqueOrThrow({ where: { id: quotationId }, include: includeRelations })
  })
}

export async function submitDocumentForApproval(
  tenantId: string,
  quotationId: string,
  docId: string,
  userId: string,
  approvalHistory: Prisma.InputJsonValue,
) {
  return prisma.$transaction(async (tx) => {
    await tx.crmQuotationDocument.update({
      where: { id: docId },
      data: {
        status: 'pending_approval',
        approvalHistory,
        updatedBy: userId,
      },
    })
    await tx.crmQuotation.update({
      where: { id: quotationId, tenantId },
      data: { status: 'pending_approval', updatedBy: userId },
    })
    return tx.crmQuotation.findUniqueOrThrow({ where: { id: quotationId }, include: includeRelations })
  })
}

export async function approveDocument(
  tenantId: string,
  quotationId: string,
  docId: string,
  userId: string,
  approvalHistory: Prisma.InputJsonValue,
) {
  return prisma.$transaction(async (tx) => {
    await tx.crmQuotationDocument.update({
      where: { id: docId },
      data: {
        status: 'approved',
        locked: true,
        approvalHistory,
        updatedBy: userId,
      },
    })
    // Internal approval only — customerApproval stays pending until customer-approve after send.
    await tx.crmQuotation.update({
      where: { id: quotationId, tenantId },
      data: {
        status: 'approved',
        locked: true,
        updatedBy: userId,
      },
    })
    return tx.crmQuotation.findUniqueOrThrow({ where: { id: quotationId }, include: includeRelations })
  })
}

export async function rejectDocument(
  tenantId: string,
  quotationId: string,
  docId: string,
  userId: string,
  _remarks: string | undefined,
  approvalHistory: Prisma.InputJsonValue,
) {
  return prisma.$transaction(async (tx) => {
    await tx.crmQuotationDocument.update({
      where: { id: docId },
      data: {
        status: 'rejected',
        locked: false,
        approvalHistory,
        updatedBy: userId,
      },
    })
    await tx.crmQuotation.update({
      where: { id: quotationId, tenantId },
      data: {
        status: 'rejected',
        locked: false,
        updatedBy: userId,
      },
    })
    return tx.crmQuotation.findUniqueOrThrow({ where: { id: quotationId }, include: includeRelations })
  })
}

export async function markDocumentSent(
  tenantId: string,
  quotationId: string,
  docId: string,
  userId: string,
  approvalHistory: Prisma.InputJsonValue,
) {
  return prisma.$transaction(async (tx) => {
    await tx.crmQuotationDocument.update({
      where: { id: docId },
      data: { status: 'sent', locked: true, approvalHistory, updatedBy: userId },
    })
    await tx.crmQuotation.update({
      where: { id: quotationId, tenantId },
      data: { status: 'sent', locked: true, updatedBy: userId },
    })
    return tx.crmQuotation.findUniqueOrThrow({ where: { id: quotationId }, include: includeRelations })
  })
}

export async function recordCustomerApproval(
  tenantId: string,
  quotationId: string,
  docId: string,
  userId: string,
  decision: 'approved' | 'rejected',
  remarks: string | undefined,
  approvalHistory: Prisma.InputJsonValue,
) {
  return prisma.$transaction(async (tx) => {
    await tx.crmQuotationDocument.update({
      where: { id: docId },
      data: {
        approvalHistory,
        updatedBy: userId,
      },
    })
    await tx.crmQuotation.update({
      where: { id: quotationId, tenantId },
      data: {
        customerApproval: decision,
        customerApprovalAt: new Date(),
        customerApprovalBy: userId,
        customerRejectionReason: decision === 'rejected' ? (remarks ?? null) : null,
        updatedBy: userId,
      },
    })
    return tx.crmQuotation.findUniqueOrThrow({ where: { id: quotationId }, include: includeRelations })
  })
}

export async function softDeleteQuotation(tenantId: string, id: string, userId: string) {
  return prisma.$transaction(async (tx) => {
    await tx.crmQuotationDocument.updateMany({
      where: { quotationId: id, tenantId },
      data: { deletedAt: new Date(), updatedBy: userId },
    })
    await tx.crmQuotation.update({
      where: { id, tenantId },
      data: { deletedAt: new Date(), updatedBy: userId, status: 'cancelled' },
    })
  })
}

export async function autoApproveDocument(
  tenantId: string,
  quotationId: string,
  docId: string,
  userId: string,
  userName: string,
  remarks: string | undefined,
) {
  const history = [
    {
      id: crypto.randomUUID(),
      action: 'submitted' as const,
      byId: userId,
      byName: userName,
      at: new Date().toISOString(),
      remarks: 'Submitted for approval',
    },
    {
      id: crypto.randomUUID(),
      action: 'approved' as const,
      byId: userId,
      byName: userName,
      at: new Date().toISOString(),
      remarks: remarks ?? 'Auto-approved within limit',
    },
  ]
  return approveDocument(tenantId, quotationId, docId, userId, history as unknown as Prisma.InputJsonValue)
}

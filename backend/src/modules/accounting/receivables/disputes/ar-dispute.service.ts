import type { ArDisputeStatus, Prisma } from '@prisma/client'
import type { Request } from 'express'
import { prisma } from '../../../../config/database.js'
import { isPositive, toDecimal } from '../../shared/finance-decimal.js'
import {
  ArDisputeAmountInvalidError,
  ArDisputeInvoiceNotFoundError,
  ArDisputeNotFoundError,
  ArDisputeOpenItemRequiredError,
  ArDisputeTerminalError,
} from './ar-dispute.errors.js'
import * as repo from './ar-dispute.repository.js'
import type {
  CreateArDisputeInput,
  ListArDisputesQueryInput,
  TransitionArDisputeInput,
  UpdateArDisputeInput,
} from './ar-dispute.schemas.js'
import {
  mapArDispute,
  TERMINAL_DISPUTE_STATUSES,
  type ArDisputeDto,
  type ArDisputeSourceContext,
} from './ar-dispute.types.js'

function parseAmount(raw: string) {
  const d = toDecimal(raw)
  if (!isPositive(d)) throw new ArDisputeAmountInvalidError()
  return d
}

function toDate(ymd: string): Date {
  return new Date(`${ymd}T00:00:00.000Z`)
}

function actorId(req: Request): string | null {
  return req.context?.userId ?? null
}

async function loadSourceContexts(
  tenantId: string,
  salesInvoiceIds: string[],
): Promise<Map<string, ArDisputeSourceContext>> {
  if (salesInvoiceIds.length === 0) return new Map()
  const invoices = await prisma.salesInvoice.findMany({
    where: { tenantId, id: { in: [...new Set(salesInvoiceIds)] } },
    select: {
      id: true,
      sourceType: true,
      sourceDocumentId: true,
      sourceLinks: {
        where: { status: 'ACTIVE' },
        select: {
          sourceType: true,
          sourceDocumentId: true,
          sourceDocumentNumberSnapshot: true,
          salesOrderId: true,
        },
      },
    },
  })
  const salesOrderIds = [
    ...new Set(
      invoices.flatMap((invoice) => [
        ...(invoice.sourceType === 'SALES_ORDER' && invoice.sourceDocumentId ? [invoice.sourceDocumentId] : []),
        ...invoice.sourceLinks.flatMap((link) => (link.salesOrderId ? [link.salesOrderId] : [])),
      ]),
    ),
  ]
  const salesOrders = salesOrderIds.length
    ? await prisma.crmSalesOrder.findMany({
        where: { tenantId, id: { in: salesOrderIds }, deletedAt: null },
        select: { id: true, salesOrderNo: true },
      })
    : []
  const salesOrderNumbers = new Map(salesOrders.map((row) => [row.id, row.salesOrderNo]))

  return new Map(
    invoices.map((invoice) => {
      const orderIds = [
        ...new Set([
          ...(invoice.sourceType === 'SALES_ORDER' && invoice.sourceDocumentId ? [invoice.sourceDocumentId] : []),
          ...invoice.sourceLinks.flatMap((link) => (link.salesOrderId ? [link.salesOrderId] : [])),
        ]),
      ]
      const dispatches = [
        ...new Map(
          invoice.sourceLinks
            .filter((link) => link.sourceType === 'OUTBOUND_DISPATCH')
            .map((link) => [
              link.sourceDocumentId,
              { id: link.sourceDocumentId, number: link.sourceDocumentNumberSnapshot },
            ]),
        ).values(),
      ]
      return [
        invoice.id,
        {
          invoiceSourceType: invoice.sourceType,
          sourceDocumentId: invoice.sourceDocumentId,
          salesOrders: orderIds.map((id) => ({ id, number: salesOrderNumbers.get(id) ?? id })),
          dispatches,
        },
      ]
    }),
  )
}

async function syncOpenItemDisputeFlag(
  tx: Prisma.TransactionClient,
  args: {
    tenantId: string
    salesInvoiceId: string
    openItemId: string | null
    stillDisputed: boolean
  },
) {
  if (!args.openItemId) return
  const openItem = await tx.receivableOpenItem.findFirst({
    where: { id: args.openItemId, tenantId: args.tenantId, salesInvoiceId: args.salesInvoiceId },
  })
  if (!openItem) return

  if (args.stillDisputed) {
    const locked: string[] = ['DISPUTED', 'SETTLED', 'WRITTEN_OFF']
    if (!locked.includes(openItem.status)) {
      await tx.receivableOpenItem.update({
        where: { id: openItem.id },
        data: { status: 'DISPUTED' },
      })
    }
    return
  }

  if (openItem.status !== 'DISPUTED') return
  let next: 'OPEN' | 'PARTIALLY_SETTLED' | 'SETTLED' = 'OPEN'
  if (openItem.openAmount.lte(0)) next = 'SETTLED'
  else if (openItem.allocatedAmount.gt(0)) next = 'PARTIALLY_SETTLED'
  await tx.receivableOpenItem.update({
    where: { id: openItem.id },
    data: { status: next, settledAt: next === 'SETTLED' ? openItem.settledAt ?? new Date() : null },
  })
}

export async function listArDisputes(
  _req: Request,
  tenantId: string,
  query: ListArDisputesQueryInput,
): Promise<{ items: ArDisputeDto[]; total: number; page: number; limit: number }> {
  const limit = query.limit ?? query.pageSize ?? 20
  const result = await repo.listArDisputes({
    tenantId,
    legalEntityId: query.legalEntityId,
    status: query.status,
    customerId: query.customerId,
    salesInvoiceId: query.salesInvoiceId,
    salesOrderId: query.salesOrderId,
    search: query.search,
    page: query.page,
    limit,
    sortOrder: query.sortOrder,
  })
  const contexts = await loadSourceContexts(tenantId, result.items.map((row) => row.salesInvoiceId))
  return {
    items: result.items.map((row) => mapArDispute(row, contexts.get(row.salesInvoiceId))),
    total: result.total,
    page: query.page,
    limit,
  }
}

export async function getArDispute(_req: Request, tenantId: string, id: string): Promise<ArDisputeDto> {
  const row = await repo.findArDisputeById(tenantId, id)
  if (!row) throw new ArDisputeNotFoundError()
  const contexts = await loadSourceContexts(tenantId, [row.salesInvoiceId])
  return mapArDispute(row, contexts.get(row.salesInvoiceId))
}

export async function createArDispute(req: Request, tenantId: string, input: CreateArDisputeInput): Promise<ArDisputeDto> {
  const actor = actorId(req)
  const amount = parseAmount(input.disputedAmount)

  const invoice = await prisma.salesInvoice.findFirst({
    where: { id: input.salesInvoiceId, tenantId, legalEntityId: input.legalEntityId },
  })
  if (!invoice) throw new ArDisputeInvoiceNotFoundError()
  if (invoice.status !== 'POSTED') {
    throw new ArDisputeOpenItemRequiredError('Only posted sales invoices can be disputed')
  }

  const openItem = await prisma.receivableOpenItem.findFirst({
    where: {
      tenantId,
      legalEntityId: input.legalEntityId,
      salesInvoiceId: invoice.id,
      side: 'DEBIT',
    },
  })
  if (!openItem) throw new ArDisputeOpenItemRequiredError()

  const year = Number.parseInt(input.disputeDate.slice(0, 4), 10)
  const seq = await repo.nextDisputeSequence(tenantId, input.legalEntityId, year)
  const disputeNumber = `DSP-${year}-${String(seq).padStart(5, '0')}`

  const created = await prisma.$transaction(async (tx) => {
    const row = await tx.arDispute.create({
      data: {
        tenantId,
        legalEntityId: input.legalEntityId,
        disputeNumber,
        customerId: invoice.customerId,
        customerNameSnapshot: invoice.customerNameSnapshot,
        salesInvoiceId: invoice.id,
        openItemId: openItem.id,
        invoiceNumberSnapshot: invoice.invoiceNumber ?? invoice.draftReference ?? '—',
        disputeDate: toDate(input.disputeDate),
        disputeType: input.disputeType,
        disputedAmount: amount,
        description: input.description,
        ownerName: input.ownerName,
        responsibleDepartment: input.responsibleDepartment,
        priority: input.priority,
        targetResolutionDate: input.targetResolutionDate ? toDate(input.targetResolutionDate) : null,
        status: 'OPEN',
        creditNoteRequired: input.creditNoteRequired,
        collectionHold: input.collectionHold,
        supportingDocuments: input.supportingDocuments ?? [],
        createdBy: actor,
        updatedBy: actor,
      },
    })
    await syncOpenItemDisputeFlag(tx, {
      tenantId,
      salesInvoiceId: invoice.id,
      openItemId: openItem.id,
      stillDisputed: true,
    })
    return row
  })

  const contexts = await loadSourceContexts(tenantId, [created.salesInvoiceId])
  return mapArDispute(created, contexts.get(created.salesInvoiceId))
}

export async function updateArDispute(
  req: Request,
  tenantId: string,
  id: string,
  input: UpdateArDisputeInput,
): Promise<ArDisputeDto> {
  const actor = actorId(req)
  const existing = await repo.findArDisputeById(tenantId, id)
  if (!existing) throw new ArDisputeNotFoundError()
  if (TERMINAL_DISPUTE_STATUSES.includes(existing.status)) throw new ArDisputeTerminalError()

  const data: Prisma.ArDisputeUpdateInput = { updatedBy: actor }
  if (input.disputeDate !== undefined) data.disputeDate = toDate(input.disputeDate)
  if (input.disputeType !== undefined) data.disputeType = input.disputeType
  if (input.disputedAmount !== undefined) data.disputedAmount = parseAmount(input.disputedAmount)
  if (input.description !== undefined) data.description = input.description
  if (input.ownerName !== undefined) data.ownerName = input.ownerName
  if (input.responsibleDepartment !== undefined) data.responsibleDepartment = input.responsibleDepartment
  if (input.priority !== undefined) data.priority = input.priority
  if (input.targetResolutionDate !== undefined) {
    data.targetResolutionDate = input.targetResolutionDate ? toDate(input.targetResolutionDate) : null
  }
  if (input.creditNoteRequired !== undefined) data.creditNoteRequired = input.creditNoteRequired
  if (input.collectionHold !== undefined) data.collectionHold = input.collectionHold
  if (input.supportingDocuments !== undefined) data.supportingDocuments = input.supportingDocuments

  const updated = await repo.updateArDispute(id, data)
  const contexts = await loadSourceContexts(tenantId, [updated.salesInvoiceId])
  return mapArDispute(updated, contexts.get(updated.salesInvoiceId))
}

export async function transitionArDispute(
  req: Request,
  tenantId: string,
  id: string,
  input: TransitionArDisputeInput,
): Promise<ArDisputeDto> {
  const actor = actorId(req)
  const existing = await repo.findArDisputeById(tenantId, id)
  if (!existing) throw new ArDisputeNotFoundError()

  const nextStatus = input.status as ArDisputeStatus
  const becomingTerminal = TERMINAL_DISPUTE_STATUSES.includes(nextStatus)

  const updated = await prisma.$transaction(async (tx) => {
    const row = await tx.arDispute.update({
      where: { id },
      data: {
        status: nextStatus,
        resolution: input.resolution === undefined ? existing.resolution : input.resolution,
        updatedBy: actor,
      },
    })

    const activeCount = await tx.arDispute.count({
      where: {
        tenantId,
        salesInvoiceId: existing.salesInvoiceId,
        deletedAt: null,
        status: { notIn: ['RESOLVED', 'REJECTED', 'CLOSED'] },
      },
    })
    await syncOpenItemDisputeFlag(tx, {
      tenantId,
      salesInvoiceId: existing.salesInvoiceId,
      openItemId: existing.openItemId,
      stillDisputed: becomingTerminal ? activeCount > 0 : true,
    })

    return row
  })

  const contexts = await loadSourceContexts(tenantId, [updated.salesInvoiceId])
  return mapArDispute(updated, contexts.get(updated.salesInvoiceId))
}

export async function softDeleteArDispute(req: Request, tenantId: string, id: string): Promise<ArDisputeDto> {
  const actor = actorId(req)
  const existing = await repo.findArDisputeById(tenantId, id)
  if (!existing) throw new ArDisputeNotFoundError()

  const deleted = await prisma.$transaction(async (tx) => {
    const row = await tx.arDispute.update({
      where: { id },
      data: { deletedAt: new Date(), updatedBy: actor, status: 'CLOSED' },
    })
    const activeCount = await tx.arDispute.count({
      where: {
        tenantId,
        salesInvoiceId: existing.salesInvoiceId,
        deletedAt: null,
        status: { notIn: ['RESOLVED', 'REJECTED', 'CLOSED'] },
      },
    })
    await syncOpenItemDisputeFlag(tx, {
      tenantId,
      salesInvoiceId: existing.salesInvoiceId,
      openItemId: existing.openItemId,
      stillDisputed: activeCount > 0,
    })
    return row
  })
  const contexts = await loadSourceContexts(tenantId, [deleted.salesInvoiceId])
  return mapArDispute(deleted, contexts.get(deleted.salesInvoiceId))
}

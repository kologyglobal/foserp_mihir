import type { ApDisputeStatus, Prisma } from '@prisma/client'
import type { Request } from 'express'
import { prisma } from '../../../../config/database.js'
import { getLegalEntityOrThrow } from '../../shared/finance.helpers.js'
import { isPositive, toDecimal } from '../../shared/finance-decimal.js'
import {
  ApDisputeAmountInvalidError,
  ApDisputeInvoiceNotFoundError,
  ApDisputeNotFoundError,
  ApDisputeOpenItemRequiredError,
  ApDisputeTerminalError,
} from './ap-dispute.errors.js'
import * as repo from './ap-dispute.repository.js'
import type {
  CreateApDisputeInput,
  ListApDisputesQueryInput,
  TransitionApDisputeInput,
  UpdateApDisputeInput,
} from './ap-dispute.schemas.js'
import {
  mapApDispute,
  TERMINAL_AP_DISPUTE_STATUSES,
  type ApDisputeDto,
} from './ap-dispute.types.js'

function parseAmount(raw: string) {
  const amount = toDecimal(raw)
  if (!isPositive(amount)) throw new ApDisputeAmountInvalidError()
  return amount
}

function assertWithinOpenAmount(amount: Prisma.Decimal, openAmount: Prisma.Decimal): void {
  if (amount.gt(openAmount)) {
    throw new ApDisputeAmountInvalidError(
      `Disputed amount cannot exceed the payable open amount of ${openAmount.toFixed(4)}`,
    )
  }
}

function toDate(ymd: string): Date {
  return new Date(`${ymd}T00:00:00.000Z`)
}

function actorId(req: Request): string | null {
  return req.context?.userId ?? null
}

async function syncOpenItemDisputeState(
  tx: Prisma.TransactionClient,
  args: {
    tenantId: string
    legalEntityId: string
    vendorInvoiceId: string
    payableOpenItemId: string | null
    stillDisputed: boolean
  },
): Promise<void> {
  if (!args.payableOpenItemId) return
  const openItem = await tx.payableOpenItem.findFirst({
    where: {
      id: args.payableOpenItemId,
      tenantId: args.tenantId,
      legalEntityId: args.legalEntityId,
      sourceVendorInvoiceId: args.vendorInvoiceId,
    },
  })
  if (!openItem) return

  if (args.stillDisputed) {
    await tx.payableOpenItem.update({
      where: { id: openItem.id },
      data: { status: 'DISPUTED', isDisputed: true },
    })
    return
  }

  let next: 'OPEN' | 'PARTIALLY_SETTLED' | 'SETTLED' = 'OPEN'
  if (openItem.outstandingAmount.lte(0)) {
    next = 'SETTLED'
  } else if (
    openItem.allocatedAmount.gt(0) ||
    openItem.adjustedAmount.gt(0) ||
    openItem.writtenOffAmount.gt(0)
  ) {
    next = 'PARTIALLY_SETTLED'
  }
  await tx.payableOpenItem.update({
    where: { id: openItem.id },
    data: {
      status: next,
      isDisputed: false,
      settledAt: next === 'SETTLED' ? openItem.settledAt ?? new Date() : null,
    },
  })
}

export async function listApDisputes(
  _req: Request,
  tenantId: string,
  query: ListApDisputesQueryInput,
): Promise<{ items: ApDisputeDto[]; total: number; page: number; limit: number }> {
  await getLegalEntityOrThrow(tenantId, query.legalEntityId)
  const limit = query.limit ?? query.pageSize ?? 20
  const result = await repo.listApDisputes({
    tenantId,
    legalEntityId: query.legalEntityId,
    status: query.status,
    vendorId: query.vendorId,
    vendorInvoiceId: query.vendorInvoiceId,
    purchaseOrderId: query.purchaseOrderId,
    search: query.search,
    page: query.page,
    limit,
    sortOrder: query.sortOrder,
  })
  return {
    items: result.items.map(mapApDispute),
    total: result.total,
    page: query.page,
    limit,
  }
}

export async function getApDispute(_req: Request, tenantId: string, id: string): Promise<ApDisputeDto> {
  const row = await repo.findApDisputeById(tenantId, id)
  if (!row) throw new ApDisputeNotFoundError()
  return mapApDispute(row)
}

export async function createApDispute(
  req: Request,
  tenantId: string,
  input: CreateApDisputeInput,
): Promise<ApDisputeDto> {
  const actor = actorId(req)
  const amount = parseAmount(input.disputedAmount)
  await getLegalEntityOrThrow(tenantId, input.legalEntityId)

  const invoice = await prisma.vendorInvoice.findFirst({
    where: { id: input.vendorInvoiceId, tenantId, legalEntityId: input.legalEntityId },
  })
  if (!invoice) throw new ApDisputeInvoiceNotFoundError()
  if (invoice.status !== 'POSTED') {
    throw new ApDisputeOpenItemRequiredError('Only posted vendor invoices can be disputed')
  }

  const openItem = await prisma.payableOpenItem.findFirst({
    where: {
      tenantId,
      legalEntityId: input.legalEntityId,
      sourceVendorInvoiceId: invoice.id,
      side: 'CREDIT',
    },
  })
  if (!openItem) throw new ApDisputeOpenItemRequiredError()
  assertWithinOpenAmount(amount, openItem.outstandingAmount)

  const year = Number.parseInt(input.disputeDate.slice(0, 4), 10)
  const seq = await repo.nextDisputeSequence(tenantId, input.legalEntityId, year)
  const disputeNumber = `APDSP-${year}-${String(seq).padStart(5, '0')}`

  const created = await prisma.$transaction(async (tx) => {
    const row = await tx.apDispute.create({
      data: {
        tenantId,
        legalEntityId: input.legalEntityId,
        disputeNumber,
        vendorId: invoice.vendorId,
        vendorCodeSnapshot: invoice.vendorCodeSnapshot,
        vendorNameSnapshot: invoice.vendorNameSnapshot,
        vendorInvoiceId: invoice.id,
        payableOpenItemId: openItem.id,
        vendorInvoiceNumberSnapshot: invoice.vendorInvoiceNumber ?? invoice.draftReference,
        supplierInvoiceNumberSnapshot: invoice.supplierInvoiceNumber,
        disputeDate: toDate(input.disputeDate),
        disputeType: input.disputeType,
        disputedAmount: amount,
        description: input.description,
        ownerName: input.ownerName,
        responsibleDepartment: input.responsibleDepartment,
        priority: input.priority,
        targetResolutionDate: input.targetResolutionDate ? toDate(input.targetResolutionDate) : null,
        status: 'OPEN',
        debitNoteRequired: input.debitNoteRequired,
        paymentHold: input.paymentHold,
        supportingDocuments: input.supportingDocuments ?? [],
        createdBy: actor,
        updatedBy: actor,
      },
      include: { vendorInvoice: { include: { sourceLinks: { orderBy: { createdAt: 'asc' } } } } },
    })
    await syncOpenItemDisputeState(tx, {
      tenantId,
      legalEntityId: input.legalEntityId,
      vendorInvoiceId: invoice.id,
      payableOpenItemId: openItem.id,
      stillDisputed: true,
    })
    return row
  })

  return mapApDispute(created)
}

export async function updateApDispute(
  req: Request,
  tenantId: string,
  id: string,
  input: UpdateApDisputeInput,
): Promise<ApDisputeDto> {
  const actor = actorId(req)
  const existing = await repo.findApDisputeById(tenantId, id)
  if (!existing) throw new ApDisputeNotFoundError()
  if (TERMINAL_AP_DISPUTE_STATUSES.includes(existing.status)) throw new ApDisputeTerminalError()

  const data: Prisma.ApDisputeUpdateInput = { updatedBy: actor }
  if (input.disputeDate !== undefined) data.disputeDate = toDate(input.disputeDate)
  if (input.disputeType !== undefined) data.disputeType = input.disputeType
  if (input.disputedAmount !== undefined) {
    const amount = parseAmount(input.disputedAmount)
    const openItem = await prisma.payableOpenItem.findFirst({
      where: {
        id: existing.payableOpenItemId ?? undefined,
        tenantId,
        legalEntityId: existing.legalEntityId,
        sourceVendorInvoiceId: existing.vendorInvoiceId,
      },
    })
    if (!openItem) throw new ApDisputeOpenItemRequiredError()
    assertWithinOpenAmount(amount, openItem.outstandingAmount)
    data.disputedAmount = amount
  }
  if (input.description !== undefined) data.description = input.description
  if (input.ownerName !== undefined) data.ownerName = input.ownerName
  if (input.responsibleDepartment !== undefined) data.responsibleDepartment = input.responsibleDepartment
  if (input.priority !== undefined) data.priority = input.priority
  if (input.targetResolutionDate !== undefined) {
    data.targetResolutionDate = input.targetResolutionDate ? toDate(input.targetResolutionDate) : null
  }
  if (input.debitNoteRequired !== undefined) data.debitNoteRequired = input.debitNoteRequired
  if (input.paymentHold !== undefined) data.paymentHold = input.paymentHold
  if (input.supportingDocuments !== undefined) data.supportingDocuments = input.supportingDocuments

  await prisma.apDispute.update({ where: { id }, data })
  const updated = await repo.findApDisputeById(tenantId, id)
  if (!updated) throw new ApDisputeNotFoundError()
  return mapApDispute(updated)
}

export async function transitionApDispute(
  req: Request,
  tenantId: string,
  id: string,
  input: TransitionApDisputeInput,
): Promise<ApDisputeDto> {
  const actor = actorId(req)
  const existing = await repo.findApDisputeById(tenantId, id)
  if (!existing) throw new ApDisputeNotFoundError()
  const nextStatus = input.status as ApDisputeStatus

  await prisma.$transaction(async (tx) => {
    await tx.apDispute.update({
      where: { id },
      data: {
        status: nextStatus,
        resolution: input.resolution === undefined ? existing.resolution : input.resolution,
        updatedBy: actor,
      },
    })
    const activeCount = await tx.apDispute.count({
      where: {
        tenantId,
        vendorInvoiceId: existing.vendorInvoiceId,
        deletedAt: null,
        status: { notIn: ['RESOLVED', 'REJECTED', 'CLOSED'] },
      },
    })
    await syncOpenItemDisputeState(tx, {
      tenantId,
      legalEntityId: existing.legalEntityId,
      vendorInvoiceId: existing.vendorInvoiceId,
      payableOpenItemId: existing.payableOpenItemId,
      stillDisputed: activeCount > 0,
    })
  })

  const updated = await repo.findApDisputeById(tenantId, id)
  if (!updated) throw new ApDisputeNotFoundError()
  return mapApDispute(updated)
}

export async function softDeleteApDispute(req: Request, tenantId: string, id: string): Promise<ApDisputeDto> {
  const actor = actorId(req)
  const existing = await repo.findApDisputeById(tenantId, id)
  if (!existing) throw new ApDisputeNotFoundError()

  const deleted = await prisma.$transaction(async (tx) => {
    const row = await tx.apDispute.update({
      where: { id },
      data: { deletedAt: new Date(), updatedBy: actor, status: 'CLOSED' },
      include: { vendorInvoice: { include: { sourceLinks: { orderBy: { createdAt: 'asc' } } } } },
    })
    const activeCount = await tx.apDispute.count({
      where: {
        tenantId,
        vendorInvoiceId: existing.vendorInvoiceId,
        deletedAt: null,
        status: { notIn: ['RESOLVED', 'REJECTED', 'CLOSED'] },
      },
    })
    await syncOpenItemDisputeState(tx, {
      tenantId,
      legalEntityId: existing.legalEntityId,
      vendorInvoiceId: existing.vendorInvoiceId,
      payableOpenItemId: existing.payableOpenItemId,
      stillDisputed: activeCount > 0,
    })
    return row
  })
  return mapApDispute(deleted)
}

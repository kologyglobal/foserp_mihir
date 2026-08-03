/**
 * Period Close ops — checklist templates, calendar events, reopen-request approval.
 * Direct `POST …/periods/:id/reopen` remains available for privileged emergency reopen.
 */
import type { Request } from 'express'
import type {
  PeriodCloseCalendarEventStatus,
  PeriodCloseChecklistTemplate,
  PeriodReopenRequest,
  Prisma,
} from '@prisma/client'
import { prisma } from '../../../config/prisma.js'
import { createAuditLog } from '../../../services/audit.service.js'
import { NotFoundError } from '../../../utils/errors.js'
import { getPagination } from '../../../utils/pagination.js'
import { reopenPeriod } from '../accounting-periods/accounting-period.repository.js'
import { parseDateOnly } from '../shared/finance.helpers.js'
import { PERIOD_CLOSE_OPS_ERROR_CODES as CODES, PeriodCloseOpsError, unprocessable } from './period-close-ops.errors.js'
import type {
  ApproveReopenRequestInput,
  CreateCalendarEventInput,
  CreateReopenRequestInput,
  CreateTemplateInput,
  ListReopenRequestsQuery,
  ListTemplatesQuery,
  RejectReopenRequestInput,
  UpdateCalendarEventInput,
  UpdateChecklistTaskInput,
  UpdateTemplateInput,
} from './period-close-ops.schemas.js'

function toIsoDate(value: Date): string {
  return value.toISOString().slice(0, 10)
}

function startOfUtcDay(value: Date): Date {
  return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()))
}

function addUtcDays(value: Date, days: number): Date {
  const next = new Date(value)
  next.setUTCDate(next.getUTCDate() + days)
  return next
}

/** Derive calendar status from due date vs today. */
export function deriveCalendarStatus(dueDate: Date, explicit?: PeriodCloseCalendarEventStatus | null): PeriodCloseCalendarEventStatus {
  if (explicit === 'COMPLETED' || explicit === 'NOT_APPLICABLE') return explicit
  const today = startOfUtcDay(new Date())
  const due = startOfUtcDay(dueDate)
  const diffDays = Math.round((due.getTime() - today.getTime()) / (24 * 60 * 60 * 1000))
  if (diffDays < 0) return 'OVERDUE'
  if (diffDays === 0) return 'DUE_TODAY'
  if (diffDays <= 3) return 'DUE_SOON'
  return 'UPCOMING'
}

async function audit(req: Request, tenantId: string, entity: string, entityId: string, action: string, values?: Record<string, unknown>) {
  await createAuditLog({
    tenantId,
    userId: req.context?.userId,
    module: 'ACCOUNTING',
    entity,
    entityId,
    action,
    newValues: values,
    ipAddress: req.ip,
    userAgent: req.headers?.['user-agent'] as string | undefined,
  })
}

async function loadPeriodOrThrow(tenantId: string, periodId: string) {
  const period = await prisma.accountingPeriod.findFirst({ where: { id: periodId, tenantId } })
  if (!period) throw new NotFoundError('Accounting period not found')
  return period
}

function serializeTemplate(row: PeriodCloseChecklistTemplate) {
  return {
    id: row.id,
    legalEntityId: row.legalEntityId,
    code: row.code,
    title: row.title,
    module: row.module,
    defaultOwnerRole: row.defaultOwnerRole,
    defaultDueOffsetDays: row.defaultDueOffsetDays,
    sortOrder: row.sortOrder,
    isActive: row.isActive,
    blocksClose: row.blocksClose,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }
}

export async function listTemplates(tenantId: string, query: ListTemplatesQuery) {
  const { skip, take, page, limit } = getPagination(query)
  const where: Prisma.PeriodCloseChecklistTemplateWhereInput = {
    tenantId,
    legalEntityId: query.legalEntityId,
    deletedAt: null,
    ...(query.includeInactive ? {} : { isActive: true }),
  }
  const [items, total] = await Promise.all([
    prisma.periodCloseChecklistTemplate.findMany({
      where,
      orderBy: [{ sortOrder: 'asc' }, { code: 'asc' }],
      skip,
      take,
    }),
    prisma.periodCloseChecklistTemplate.count({ where }),
  ])
  return { items: items.map(serializeTemplate), total, page, limit }
}

export async function createTemplate(req: Request, tenantId: string, input: CreateTemplateInput) {
  const le = await prisma.legalEntity.findFirst({ where: { id: input.legalEntityId, tenantId }, select: { id: true } })
  if (!le) throw new NotFoundError('Legal entity not found')

  try {
    const created = await prisma.periodCloseChecklistTemplate.create({
      data: {
        tenantId,
        legalEntityId: input.legalEntityId,
        code: input.code,
        title: input.title,
        module: input.module,
        defaultOwnerRole: input.defaultOwnerRole ?? null,
        defaultDueOffsetDays: input.defaultDueOffsetDays ?? 0,
        sortOrder: input.sortOrder ?? 0,
        blocksClose: input.blocksClose ?? false,
        createdBy: req.context?.userId ?? null,
      },
    })
    await audit(req, tenantId, 'PeriodCloseChecklistTemplate', created.id, 'TEMPLATE_CREATED', { code: created.code })
    return serializeTemplate(created)
  } catch (error) {
    if (typeof error === 'object' && error !== null && (error as { code?: string }).code === 'P2002') {
      throw new PeriodCloseOpsError(409, `Template code ${input.code} already exists for this legal entity`, CODES.TEMPLATE_CODE_EXISTS)
    }
    throw error
  }
}

export async function updateTemplate(req: Request, tenantId: string, id: string, input: UpdateTemplateInput) {
  const existing = await prisma.periodCloseChecklistTemplate.findFirst({ where: { id, tenantId, deletedAt: null } })
  if (!existing) throw new NotFoundError('Checklist template not found')
  const updated = await prisma.periodCloseChecklistTemplate.update({
    where: { id },
    data: {
      ...(input.title !== undefined ? { title: input.title } : {}),
      ...(input.module !== undefined ? { module: input.module } : {}),
      ...(input.defaultOwnerRole !== undefined ? { defaultOwnerRole: input.defaultOwnerRole } : {}),
      ...(input.defaultDueOffsetDays !== undefined ? { defaultDueOffsetDays: input.defaultDueOffsetDays } : {}),
      ...(input.sortOrder !== undefined ? { sortOrder: input.sortOrder } : {}),
      ...(input.blocksClose !== undefined ? { blocksClose: input.blocksClose } : {}),
      ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
      updatedBy: req.context?.userId ?? null,
    },
  })
  await audit(req, tenantId, 'PeriodCloseChecklistTemplate', id, 'TEMPLATE_UPDATED')
  return serializeTemplate(updated)
}

export async function archiveTemplate(req: Request, tenantId: string, id: string) {
  const existing = await prisma.periodCloseChecklistTemplate.findFirst({ where: { id, tenantId, deletedAt: null } })
  if (!existing) throw new NotFoundError('Checklist template not found')
  const updated = await prisma.periodCloseChecklistTemplate.update({
    where: { id },
    data: { isActive: false, deletedAt: new Date(), updatedBy: req.context?.userId ?? null },
  })
  await audit(req, tenantId, 'PeriodCloseChecklistTemplate', id, 'TEMPLATE_ARCHIVED')
  return serializeTemplate(updated)
}

function serializeTask(row: {
  id: string
  periodId: string
  templateId: string | null
  title: string
  module: string
  ownerLabel: string | null
  reviewerLabel: string | null
  dueDate: Date
  status: string
  completionPct: number
  evidence: string | null
  comments: string | null
  sortOrder: number
  createdAt: Date
  updatedAt: Date
}) {
  return {
    id: row.id,
    periodId: row.periodId,
    templateId: row.templateId,
    title: row.title,
    module: row.module,
    ownerLabel: row.ownerLabel,
    reviewerLabel: row.reviewerLabel,
    dueDate: toIsoDate(row.dueDate),
    status: row.status,
    completionPct: row.completionPct,
    evidence: row.evidence,
    comments: row.comments,
    sortOrder: row.sortOrder,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }
}

export async function listChecklistTasks(tenantId: string, periodId: string) {
  await loadPeriodOrThrow(tenantId, periodId)
  const items = await prisma.periodCloseChecklistTask.findMany({
    where: { tenantId, periodId, deletedAt: null },
    orderBy: [{ sortOrder: 'asc' }, { title: 'asc' }],
  })
  return items.map(serializeTask)
}

/** Copy active LE templates onto a period (idempotent if tasks already exist for a template). */
export async function instantiateChecklist(req: Request, tenantId: string, periodId: string) {
  const period = await loadPeriodOrThrow(tenantId, periodId)
  const templates = await prisma.periodCloseChecklistTemplate.findMany({
    where: { tenantId, legalEntityId: period.legalEntityId, deletedAt: null, isActive: true },
    orderBy: [{ sortOrder: 'asc' }, { code: 'asc' }],
  })
  if (templates.length === 0) {
    throw unprocessable('No active checklist templates for this legal entity', CODES.NOT_EDITABLE)
  }

  const existing = await prisma.periodCloseChecklistTask.findMany({
    where: { tenantId, periodId, deletedAt: null, templateId: { not: null } },
    select: { templateId: true },
  })
  const existingIds = new Set(existing.map((e) => e.templateId))
  const toCreate = templates.filter((t) => !existingIds.has(t.id))
  if (toCreate.length === 0) {
    return listChecklistTasks(tenantId, periodId)
  }

  await prisma.periodCloseChecklistTask.createMany({
    data: toCreate.map((t, index) => ({
      tenantId,
      legalEntityId: period.legalEntityId,
      periodId,
      templateId: t.id,
      title: t.title,
      module: t.module,
      ownerLabel: t.defaultOwnerRole,
      dueDate: addUtcDays(period.endDate, t.defaultDueOffsetDays),
      sortOrder: t.sortOrder || index + 1,
      createdBy: req.context?.userId ?? null,
    })),
  })
  await audit(req, tenantId, 'AccountingPeriod', periodId, 'CHECKLIST_INSTANTIATED', { created: toCreate.length })
  return listChecklistTasks(tenantId, periodId)
}

export async function updateChecklistTask(
  req: Request,
  tenantId: string,
  id: string,
  input: UpdateChecklistTaskInput,
) {
  const existing = await prisma.periodCloseChecklistTask.findFirst({ where: { id, tenantId, deletedAt: null } })
  if (!existing) throw new NotFoundError('Checklist task not found')
  const updated = await prisma.periodCloseChecklistTask.update({
    where: { id },
    data: {
      ...(input.status !== undefined ? { status: input.status } : {}),
      ...(input.ownerLabel !== undefined ? { ownerLabel: input.ownerLabel } : {}),
      ...(input.reviewerLabel !== undefined ? { reviewerLabel: input.reviewerLabel } : {}),
      ...(input.dueDate !== undefined ? { dueDate: parseDateOnly(input.dueDate) } : {}),
      ...(input.completionPct !== undefined ? { completionPct: input.completionPct } : {}),
      ...(input.evidence !== undefined ? { evidence: input.evidence } : {}),
      ...(input.comments !== undefined ? { comments: input.comments } : {}),
      updatedBy: req.context?.userId ?? null,
    },
  })
  await audit(req, tenantId, 'PeriodCloseChecklistTask', id, 'CHECKLIST_TASK_UPDATED', { status: updated.status })
  return serializeTask(updated)
}

function serializeCalendarEvent(row: {
  id: string
  periodId: string
  title: string
  category: string
  dueDate: Date
  ownerLabel: string | null
  status: PeriodCloseCalendarEventStatus
  sortOrder: number
  createdAt: Date
  updatedAt: Date
}) {
  const status = deriveCalendarStatus(row.dueDate, row.status)
  return {
    id: row.id,
    periodId: row.periodId,
    title: row.title,
    category: row.category,
    dueDate: toIsoDate(row.dueDate),
    ownerLabel: row.ownerLabel,
    status,
    sortOrder: row.sortOrder,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }
}

export async function listCalendarEvents(tenantId: string, periodId: string) {
  await loadPeriodOrThrow(tenantId, periodId)
  const items = await prisma.periodCloseCalendarEvent.findMany({
    where: { tenantId, periodId, deletedAt: null },
    orderBy: [{ dueDate: 'asc' }, { sortOrder: 'asc' }],
  })
  return items.map(serializeCalendarEvent)
}

export async function createCalendarEvent(
  req: Request,
  tenantId: string,
  periodId: string,
  input: CreateCalendarEventInput,
) {
  const period = await loadPeriodOrThrow(tenantId, periodId)
  const dueDate = parseDateOnly(input.dueDate)
  const status = input.status ?? deriveCalendarStatus(dueDate)
  const created = await prisma.periodCloseCalendarEvent.create({
    data: {
      tenantId,
      legalEntityId: period.legalEntityId,
      periodId,
      title: input.title,
      category: input.category,
      dueDate,
      ownerLabel: input.ownerLabel ?? null,
      status,
      sortOrder: input.sortOrder ?? 0,
      createdBy: req.context?.userId ?? null,
    },
  })
  await audit(req, tenantId, 'PeriodCloseCalendarEvent', created.id, 'CALENDAR_EVENT_CREATED')
  return serializeCalendarEvent(created)
}

export async function updateCalendarEvent(
  req: Request,
  tenantId: string,
  id: string,
  input: UpdateCalendarEventInput,
) {
  const existing = await prisma.periodCloseCalendarEvent.findFirst({ where: { id, tenantId, deletedAt: null } })
  if (!existing) throw new NotFoundError('Calendar event not found')
  const dueDate = input.dueDate ? parseDateOnly(input.dueDate) : existing.dueDate
  const status =
    input.status ??
    (input.dueDate ? deriveCalendarStatus(dueDate, existing.status) : existing.status)
  const updated = await prisma.periodCloseCalendarEvent.update({
    where: { id },
    data: {
      ...(input.title !== undefined ? { title: input.title } : {}),
      ...(input.category !== undefined ? { category: input.category } : {}),
      ...(input.dueDate !== undefined ? { dueDate } : {}),
      ...(input.ownerLabel !== undefined ? { ownerLabel: input.ownerLabel } : {}),
      status,
      ...(input.sortOrder !== undefined ? { sortOrder: input.sortOrder } : {}),
      updatedBy: req.context?.userId ?? null,
    },
  })
  await audit(req, tenantId, 'PeriodCloseCalendarEvent', id, 'CALENDAR_EVENT_UPDATED')
  return serializeCalendarEvent(updated)
}

export async function deleteCalendarEvent(req: Request, tenantId: string, id: string) {
  const existing = await prisma.periodCloseCalendarEvent.findFirst({ where: { id, tenantId, deletedAt: null } })
  if (!existing) throw new NotFoundError('Calendar event not found')
  await prisma.periodCloseCalendarEvent.update({
    where: { id },
    data: { deletedAt: new Date(), updatedBy: req.context?.userId ?? null },
  })
  await audit(req, tenantId, 'PeriodCloseCalendarEvent', id, 'CALENDAR_EVENT_DELETED')
  return { id, deleted: true }
}

/** Seed calendar from checklist tasks + period lock milestone. */
export async function generateCalendar(req: Request, tenantId: string, periodId: string) {
  const period = await loadPeriodOrThrow(tenantId, periodId)
  const tasks = await prisma.periodCloseChecklistTask.findMany({
    where: { tenantId, periodId, deletedAt: null },
    orderBy: { sortOrder: 'asc' },
  })

  const existingCount = await prisma.periodCloseCalendarEvent.count({
    where: { tenantId, periodId, deletedAt: null },
  })
  if (existingCount > 0) {
    return listCalendarEvents(tenantId, periodId)
  }

  const rows: Prisma.PeriodCloseCalendarEventCreateManyInput[] = tasks.map((t, index) => ({
    tenantId,
    legalEntityId: period.legalEntityId,
    periodId,
    title: t.title,
    category: 'CHECKLIST' as const,
    dueDate: t.dueDate,
    ownerLabel: t.ownerLabel,
    status: deriveCalendarStatus(t.dueDate),
    sortOrder: index + 1,
    createdBy: req.context?.userId ?? null,
  }))

  rows.push({
    tenantId,
    legalEntityId: period.legalEntityId,
    periodId,
    title: `Lock period ${period.name}`,
    category: 'LOCK',
    dueDate: period.endDate,
    ownerLabel: 'Finance',
    status: deriveCalendarStatus(period.endDate),
    sortOrder: rows.length + 1,
    createdBy: req.context?.userId ?? null,
  })

  await prisma.periodCloseCalendarEvent.createMany({ data: rows })
  await audit(req, tenantId, 'AccountingPeriod', periodId, 'CALENDAR_GENERATED', { count: rows.length })
  return listCalendarEvents(tenantId, periodId)
}

const reopenInclude = {
  period: { select: { id: true, name: true, status: true, endDate: true } },
  events: { orderBy: { at: 'asc' as const } },
} satisfies Prisma.PeriodReopenRequestInclude

type ReopenWithRelations = Prisma.PeriodReopenRequestGetPayload<{ include: typeof reopenInclude }>

function serializeReopen(row: ReopenWithRelations) {
  return {
    id: row.id,
    requestNumber: row.requestNumber,
    status: row.status,
    legalEntityId: row.legalEntityId,
    periodId: row.periodId,
    periodName: row.period.name,
    periodStatus: row.period.status,
    moduleLabel: row.moduleLabel,
    reasonCode: row.reasonCode,
    reasonDetail: row.reasonDetail,
    documentRef: row.documentRef,
    riskExplanation: row.riskExplanation,
    requestedUntil: toIsoDate(row.requestedUntil),
    requestedBy: row.requestedBy,
    requestedAt: row.requestedAt?.toISOString() ?? null,
    approvedBy: row.approvedBy,
    approvedAt: row.approvedAt?.toISOString() ?? null,
    rejectedBy: row.rejectedBy,
    rejectedAt: row.rejectedAt?.toISOString() ?? null,
    rejectReason: row.rejectReason,
    openedAt: row.openedAt?.toISOString() ?? null,
    expiredAt: row.expiredAt?.toISOString() ?? null,
    closedAt: row.closedAt?.toISOString() ?? null,
    audit: row.events.map((e) => ({
      at: e.at.toISOString(),
      by: e.byLabel ?? e.byUserId ?? 'System',
      action: e.action,
      note: e.note ?? undefined,
    })),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }
}

async function nextRequestNumber(tenantId: string): Promise<string> {
  const latest = await prisma.periodReopenRequest.findFirst({
    where: { tenantId, requestNumber: { startsWith: 'ROR-' } },
    orderBy: { requestNumber: 'desc' },
    select: { requestNumber: true },
  })
  const last = latest ? Number.parseInt(latest.requestNumber.slice(4), 10) : 0
  const next = Number.isFinite(last) ? last + 1 : 1
  return `ROR-${String(next).padStart(5, '0')}`
}

async function appendEvent(
  tenantId: string,
  requestId: string,
  action: string,
  userId: string | null | undefined,
  note?: string | null,
  byLabel?: string | null,
) {
  await prisma.periodReopenRequestEvent.create({
    data: {
      tenantId,
      requestId,
      action,
      byUserId: userId ?? null,
      byLabel: byLabel ?? null,
      note: note ?? null,
    },
  })
}

async function maybeExpire(request: PeriodReopenRequest): Promise<PeriodReopenRequest> {
  if (request.status !== 'OPEN_TEMPORARILY') return request
  const today = startOfUtcDay(new Date())
  if (startOfUtcDay(request.requestedUntil) >= today) return request
  return prisma.periodReopenRequest.update({
    where: { id: request.id },
    data: { status: 'EXPIRED', expiredAt: new Date() },
  })
}

export async function listReopenRequests(tenantId: string, query: ListReopenRequestsQuery) {
  const { skip, take, page, limit } = getPagination(query)
  const where: Prisma.PeriodReopenRequestWhereInput = {
    tenantId,
    deletedAt: null,
    ...(query.legalEntityId ? { legalEntityId: query.legalEntityId } : {}),
    ...(query.periodId ? { periodId: query.periodId } : {}),
    ...(query.status ? { status: query.status } : {}),
  }
  const [raw, total] = await Promise.all([
    prisma.periodReopenRequest.findMany({
      where,
      include: reopenInclude,
      orderBy: { createdAt: 'desc' },
      skip,
      take,
    }),
    prisma.periodReopenRequest.count({ where }),
  ])

  // Lazy-expire open windows past requestedUntil
  const items = []
  for (const row of raw) {
    const refreshed = await maybeExpire(row)
    if (refreshed.status !== row.status) {
      items.push(
        serializeReopen(
          await prisma.periodReopenRequest.findFirstOrThrow({ where: { id: row.id }, include: reopenInclude }),
        ),
      )
    } else {
      items.push(serializeReopen(row))
    }
  }
  return { items, total, page, limit }
}

export async function getReopenRequest(tenantId: string, id: string) {
  const row = await prisma.periodReopenRequest.findFirst({
    where: { id, tenantId, deletedAt: null },
    include: reopenInclude,
  })
  if (!row) throw new NotFoundError('Reopen request not found')
  await maybeExpire(row)
  return serializeReopen(
    await prisma.periodReopenRequest.findFirstOrThrow({ where: { id, tenantId }, include: reopenInclude }),
  )
}

export async function createReopenRequest(req: Request, tenantId: string, input: CreateReopenRequestInput) {
  const period = await loadPeriodOrThrow(tenantId, input.periodId)
  if (period.legalEntityId !== input.legalEntityId) {
    throw unprocessable('periodId does not belong to the given legal entity', CODES.PERIOD_NOT_FOUND)
  }
  if (period.status !== 'CLOSED' && period.status !== 'UNDER_REVIEW') {
    throw unprocessable(
      `Period ${period.name} is ${period.status}; reopen requests require a CLOSED or UNDER_REVIEW period`,
      CODES.PERIOD_NOT_LOCKED,
    )
  }

  const requestedUntil = parseDateOnly(input.requestedUntil)
  if (startOfUtcDay(requestedUntil) < startOfUtcDay(new Date())) {
    throw unprocessable('requestedUntil must be today or a future date', CODES.NOT_EDITABLE)
  }

  const userId = req.context?.userId ?? null
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const requestNumber = await nextRequestNumber(tenantId)
    try {
      const created = await prisma.periodReopenRequest.create({
        data: {
          tenantId,
          legalEntityId: input.legalEntityId,
          periodId: input.periodId,
          requestNumber,
          status: input.submit ? 'PENDING_APPROVAL' : 'DRAFT',
          moduleLabel: input.moduleLabel,
          reasonCode: input.reasonCode,
          reasonDetail: input.reasonDetail ?? null,
          documentRef: input.documentRef ?? null,
          riskExplanation: input.riskExplanation,
          requestedUntil,
          requestedBy: userId,
          requestedAt: input.submit ? new Date() : null,
          createdBy: userId,
        },
        include: reopenInclude,
      })
      await appendEvent(
        tenantId,
        created.id,
        input.submit ? 'Submitted' : 'Created',
        userId,
        input.submit ? 'Submitted for approval' : 'Draft created',
      )
      await audit(req, tenantId, 'PeriodReopenRequest', created.id, input.submit ? 'REOPEN_REQUEST_SUBMITTED' : 'REOPEN_REQUEST_CREATED', {
        requestNumber,
      })
      return getReopenRequest(tenantId, created.id)
    } catch (error) {
      const isCollision =
        typeof error === 'object' && error !== null && (error as { code?: string }).code === 'P2002'
      if (!isCollision || attempt === 7) throw error
    }
  }
  throw unprocessable('Could not allocate a reopen request number', CODES.NOT_EDITABLE)
}

export async function submitReopenRequest(req: Request, tenantId: string, id: string) {
  const existing = await prisma.periodReopenRequest.findFirst({ where: { id, tenantId, deletedAt: null } })
  if (!existing) throw new NotFoundError('Reopen request not found')
  if (existing.status !== 'DRAFT') {
    throw unprocessable(`Request ${existing.requestNumber} is ${existing.status}; only DRAFT can be submitted`, CODES.INVALID_STATUS)
  }
  const userId = req.context?.userId ?? null
  await prisma.periodReopenRequest.update({
    where: { id },
    data: { status: 'PENDING_APPROVAL', requestedAt: new Date(), requestedBy: userId, updatedBy: userId },
  })
  await appendEvent(tenantId, id, 'Submitted', userId, 'Submitted for approval')
  await audit(req, tenantId, 'PeriodReopenRequest', id, 'REOPEN_REQUEST_SUBMITTED')
  return getReopenRequest(tenantId, id)
}

export async function approveReopenRequest(
  req: Request,
  tenantId: string,
  id: string,
  input: ApproveReopenRequestInput,
) {
  const existing = await prisma.periodReopenRequest.findFirst({
    where: { id, tenantId, deletedAt: null },
    include: { period: true },
  })
  if (!existing) throw new NotFoundError('Reopen request not found')
  if (existing.status !== 'PENDING_APPROVAL' && existing.status !== 'APPROVED') {
    throw unprocessable(
      `Request ${existing.requestNumber} is ${existing.status}; only PENDING_APPROVAL can be approved`,
      CODES.INVALID_STATUS,
    )
  }

  const userId = req.context?.userId ?? null
  const activate = input.activate !== false

  if (existing.status === 'PENDING_APPROVAL') {
    await prisma.periodReopenRequest.update({
      where: { id },
      data: {
        status: activate ? 'OPEN_TEMPORARILY' : 'APPROVED',
        approvedBy: userId,
        approvedAt: new Date(),
        openedAt: activate ? new Date() : null,
        updatedBy: userId,
      },
    })
    await appendEvent(tenantId, id, 'Approved', userId, input.note ?? null)
  }

  if (activate && (existing.status === 'PENDING_APPROVAL' || existing.status === 'APPROVED')) {
    if (existing.period.status === 'CLOSED' || existing.period.status === 'UNDER_REVIEW') {
      await reopenPeriod(tenantId, existing.periodId, userId ?? 'system', {
        reason: `Reopen request ${existing.requestNumber}: ${existing.riskExplanation}`.slice(0, 500),
      })
    }
    if (existing.status === 'APPROVED') {
      await prisma.periodReopenRequest.update({
        where: { id },
        data: { status: 'OPEN_TEMPORARILY', openedAt: new Date(), updatedBy: userId },
      })
    }
    await appendEvent(tenantId, id, 'Opened', userId, `Period reopened until ${toIsoDate(existing.requestedUntil)}`)
  }

  await audit(req, tenantId, 'PeriodReopenRequest', id, 'REOPEN_REQUEST_APPROVED', { activate })
  return getReopenRequest(tenantId, id)
}

export async function rejectReopenRequest(
  req: Request,
  tenantId: string,
  id: string,
  input: RejectReopenRequestInput,
) {
  const existing = await prisma.periodReopenRequest.findFirst({ where: { id, tenantId, deletedAt: null } })
  if (!existing) throw new NotFoundError('Reopen request not found')
  if (existing.status !== 'PENDING_APPROVAL') {
    throw unprocessable(`Request ${existing.requestNumber} is ${existing.status}; only PENDING_APPROVAL can be rejected`, CODES.INVALID_STATUS)
  }
  const userId = req.context?.userId ?? null
  await prisma.periodReopenRequest.update({
    where: { id },
    data: {
      status: 'REJECTED',
      rejectedBy: userId,
      rejectedAt: new Date(),
      rejectReason: input.reason,
      updatedBy: userId,
    },
  })
  await appendEvent(tenantId, id, 'Rejected', userId, input.reason)
  await audit(req, tenantId, 'PeriodReopenRequest', id, 'REOPEN_REQUEST_REJECTED')
  return getReopenRequest(tenantId, id)
}

export async function cancelReopenRequest(req: Request, tenantId: string, id: string) {
  const existing = await prisma.periodReopenRequest.findFirst({ where: { id, tenantId, deletedAt: null } })
  if (!existing) throw new NotFoundError('Reopen request not found')
  if (existing.status !== 'DRAFT' && existing.status !== 'PENDING_APPROVAL') {
    throw unprocessable(`Request ${existing.requestNumber} is ${existing.status}; cannot cancel`, CODES.INVALID_STATUS)
  }
  const userId = req.context?.userId ?? null
  await prisma.periodReopenRequest.update({
    where: { id },
    data: { status: 'CANCELLED', updatedBy: userId },
  })
  await appendEvent(tenantId, id, 'Cancelled', userId)
  await audit(req, tenantId, 'PeriodReopenRequest', id, 'REOPEN_REQUEST_CANCELLED')
  return getReopenRequest(tenantId, id)
}

export async function closeReopenRequest(req: Request, tenantId: string, id: string) {
  const existing = await prisma.periodReopenRequest.findFirst({ where: { id, tenantId, deletedAt: null } })
  if (!existing) throw new NotFoundError('Reopen request not found')
  if (existing.status !== 'OPEN_TEMPORARILY' && existing.status !== 'EXPIRED' && existing.status !== 'APPROVED') {
    throw unprocessable(`Request ${existing.requestNumber} is ${existing.status}; cannot close`, CODES.INVALID_STATUS)
  }
  const userId = req.context?.userId ?? null
  await prisma.periodReopenRequest.update({
    where: { id },
    data: { status: 'CLOSED', closedAt: new Date(), updatedBy: userId },
  })
  await appendEvent(tenantId, id, 'Closed', userId)
  await audit(req, tenantId, 'PeriodReopenRequest', id, 'REOPEN_REQUEST_CLOSED')
  return getReopenRequest(tenantId, id)
}

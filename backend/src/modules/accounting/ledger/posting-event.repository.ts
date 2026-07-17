import type { PostingEvent, PostingEventStatus, Prisma } from '@prisma/client'
import { prisma } from '../../../config/database.js'
import { ConflictError, InvalidStateError, NotFoundError, ValidationError } from '../../../utils/errors.js'
import { getLegalEntityOrThrow } from '../shared/finance.helpers.js'
import { hashPayload } from '../shared/payload-hash.js'
import type { PostingEventInput } from './ledger.types.js'

const ALLOWED_TRANSITIONS: Record<PostingEventStatus, PostingEventStatus[]> = {
  RECEIVED: ['VALIDATING', 'FAILED', 'IGNORED'],
  VALIDATING: ['VALIDATED', 'FAILED'],
  VALIDATED: ['PROCESSING', 'FAILED'],
  PROCESSING: ['POSTED', 'FAILED'],
  POSTED: ['REVERSED'],
  FAILED: ['VALIDATING'],
  REVERSED: [],
  IGNORED: [],
}

function assertTransition(from: PostingEventStatus, to: PostingEventStatus): void {
  const allowed = ALLOWED_TRANSITIONS[from] ?? []
  if (!allowed.includes(to)) {
    throw new InvalidStateError(`Invalid posting event transition from ${from} to ${to}`)
  }
}

export interface CreateReceivedEventInput extends PostingEventInput {
  createdBy?: string
}

export async function createReceivedEvent(
  tenantId: string,
  input: CreateReceivedEventInput,
): Promise<PostingEvent> {
  await getLegalEntityOrThrow(tenantId, input.legalEntityId)
  const payloadHash = hashPayload(input.payload)

  const existing = await prisma.postingEvent.findFirst({
    where: { tenantId, legalEntityId: input.legalEntityId, eventKey: input.eventKey },
  })
  if (existing) {
    if (existing.payloadHash !== payloadHash) {
      throw new ValidationError('Duplicate event key with different payload hash')
    }
    return existing
  }

  return prisma.postingEvent.create({
    data: {
      tenantId,
      legalEntityId: input.legalEntityId,
      eventKey: input.eventKey,
      eventType: input.eventType,
      eventVersion: input.eventVersion ?? 1,
      status: 'RECEIVED',
      sourceModule: input.sourceModule ?? null,
      sourceDocumentType: input.sourceDocumentType ?? null,
      sourceDocumentId: input.sourceDocumentId ?? null,
      sourceDocumentLineId: input.sourceDocumentLineId ?? null,
      payloadHash,
      payloadJson: input.payload as Prisma.InputJsonValue,
      createdBy: input.createdBy ?? null,
    },
  })
}

export async function findByEventKey(
  tenantId: string,
  legalEntityId: string,
  eventKey: string,
): Promise<PostingEvent | null> {
  return prisma.postingEvent.findFirst({ where: { tenantId, legalEntityId, eventKey } })
}

async function transitionStatus(
  tenantId: string,
  id: string,
  to: PostingEventStatus,
  extra?: Prisma.PostingEventUpdateInput,
): Promise<PostingEvent> {
  const event = await prisma.postingEvent.findFirst({ where: { id, tenantId } })
  if (!event) throw new NotFoundError('Posting event not found')
  assertTransition(event.status, to)
  return prisma.postingEvent.update({
    where: { id, tenantId },
    data: { status: to, ...extra },
  })
}

export async function markValidating(tenantId: string, id: string): Promise<PostingEvent> {
  return transitionStatus(tenantId, id, 'VALIDATING', { lastAttemptAt: new Date() })
}

export async function markValidated(tenantId: string, id: string): Promise<PostingEvent> {
  return transitionStatus(tenantId, id, 'VALIDATED')
}

export async function markProcessing(tenantId: string, id: string): Promise<PostingEvent> {
  return transitionStatus(tenantId, id, 'PROCESSING')
}

export async function markPosted(tenantId: string, id: string, voucherId?: string): Promise<PostingEvent> {
  return transitionStatus(tenantId, id, 'POSTED', {
    ...(voucherId ? { voucher: { connect: { id: voucherId } } } : {}),
    processedAt: new Date(),
  })
}

export async function markFailed(
  tenantId: string,
  id: string,
  errorCode?: string,
  errorMessage?: string,
): Promise<PostingEvent> {
  return transitionStatus(tenantId, id, 'FAILED', {
    errorCode: errorCode ?? null,
    errorMessage: errorMessage ?? null,
    lastAttemptAt: new Date(),
  })
}

export async function incrementAttempt(tenantId: string, id: string): Promise<PostingEvent> {
  const event = await prisma.postingEvent.findFirst({ where: { id, tenantId } })
  if (!event) throw new NotFoundError('Posting event not found')
  return prisma.postingEvent.update({
    where: { id, tenantId },
    data: {
      attemptCount: { increment: 1 },
      lastAttemptAt: new Date(),
    },
  })
}

export async function createReceivedEventStrict(
  tenantId: string,
  input: CreateReceivedEventInput,
): Promise<PostingEvent> {
  try {
    return await createReceivedEvent(tenantId, input)
  } catch (error) {
    if (error instanceof ValidationError) throw error
    if (error && typeof error === 'object' && 'code' in error && (error as { code: string }).code === 'P2002') {
      const existing = await findByEventKey(tenantId, input.legalEntityId, input.eventKey)
      const payloadHash = hashPayload(input.payload)
      if (existing && existing.payloadHash !== payloadHash) {
        throw new ValidationError('Duplicate event key with different payload hash')
      }
      if (existing) return existing
      throw new ConflictError('Duplicate posting event key')
    }
    throw error
  }
}

import type { PostingEvent } from '@prisma/client'
import { hashPayload } from '../shared/payload-hash.js'
import * as postingEventRepo from '../ledger/posting-event.repository.js'
import type { PostingRequest } from './posting.types.js'
import { PostingError } from './posting.errors.js'

const IN_PROGRESS_STATUSES = new Set(['VALIDATING', 'VALIDATED', 'PROCESSING'])

export interface IdempotencyOutcome {
  event: PostingEvent
  idempotentReplay: boolean
  isRetry: boolean
}

function buildEventPayload(request: PostingRequest): Record<string, unknown> {
  return { ...request }
}

export async function beginIdempotentPosting(
  tenantId: string,
  request: PostingRequest,
  createdBy?: string | null,
): Promise<IdempotencyOutcome> {
  const payload = buildEventPayload(request)
  const payloadHash = hashPayload(payload)

  const existing = await postingEventRepo.findByEventKey(tenantId, request.legalEntityId, request.eventKey)
  if (existing) {
    if (existing.payloadHash !== payloadHash) {
      throw new PostingError('IDEMPOTENCY_PAYLOAD_MISMATCH', 'Duplicate event key with different payload')
    }
    if (existing.status === 'POSTED' && existing.voucherId) {
      return { event: existing, idempotentReplay: true, isRetry: false }
    }
    if (IN_PROGRESS_STATUSES.has(existing.status)) {
      const refreshed = await postingEventRepo.findByEventKey(tenantId, request.legalEntityId, request.eventKey)
      if (refreshed?.status === 'POSTED' && refreshed.voucherId) {
        return { event: refreshed, idempotentReplay: true, isRetry: false }
      }
      throw new PostingError('POSTING_EVENT_IN_PROGRESS', 'A posting with this event key is already in progress')
    }
    if (existing.status === 'FAILED') {
      const event = await postingEventRepo.markValidating(tenantId, existing.id)
      await postingEventRepo.incrementAttempt(tenantId, event.id)
      return { event, idempotentReplay: false, isRetry: true }
    }
    if (existing.status === 'RECEIVED') {
      const event = await postingEventRepo.markValidating(tenantId, existing.id)
      await postingEventRepo.incrementAttempt(tenantId, event.id)
      return { event, idempotentReplay: false, isRetry: false }
    }
    throw new PostingError('POSTING_EVENT_IN_PROGRESS', `Posting event is in status ${existing.status}`)
  }

  const created = await postingEventRepo.createReceivedEventStrict(tenantId, {
    legalEntityId: request.legalEntityId,
    eventKey: request.eventKey,
    eventType: request.eventType,
    eventVersion: request.eventVersion,
    sourceModule: request.sourceModule,
    sourceDocumentType: request.sourceDocumentType,
    sourceDocumentId: request.sourceDocumentId,
    sourceDocumentLineId: request.sourceDocumentLineId,
    payload,
    createdBy: createdBy ?? undefined,
  })

  const event = await postingEventRepo.markValidating(tenantId, created.id)
  await postingEventRepo.incrementAttempt(tenantId, event.id)
  return { event, idempotentReplay: false, isRetry: false }
}

export function buildReplayResult(event: PostingEvent): {
  postingEventId: string
  voucherId: string
  voucherNumber?: string
} {
  if (!event.voucherId) {
    throw new PostingError('POSTING_TRANSACTION_FAILED', 'Posted event is missing voucher reference')
  }
  return {
    postingEventId: event.id,
    voucherId: event.voucherId,
    voucherNumber: event.reservedVoucherNumber ?? undefined,
  }
}

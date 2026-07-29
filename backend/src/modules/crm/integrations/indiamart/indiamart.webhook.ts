import { createHash, randomBytes } from 'node:crypto'
import { prisma } from '../../../../config/prisma.js'
import { createAuditLog } from '../../../../services/audit.service.js'
import { IndiaMartError } from './indiamart.errors.js'
import { extractPushLeadPayload, ingestIndiaMartEnquiry } from './indiamart.ingest.js'
import { importEnquiryAsLead } from './indiamart.lead-import.js'
import * as repo from './indiamart.repository.js'
import { upsertAlert } from './indiamart.alerts.js'
import type { IndiaMartConfigurationJson } from './indiamart.types.js'

export function hashWebhookToken(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}

export function generateWebhookToken(): { token: string; hash: string; prefix: string } {
  const token = randomBytes(24).toString('base64url')
  return {
    token,
    hash: hashWebhookToken(token),
    prefix: token.slice(0, 8),
  }
}

export function buildWebhookUrl(opts: {
  publicBaseUrl: string
  tenantSlug: string
  token: string
}): string {
  const base = opts.publicBaseUrl.replace(/\/$/, '')
  return `${base}/api/v1/webhooks/indiamart/${encodeURIComponent(opts.tenantSlug)}/${encodeURIComponent(opts.token)}`
}

export async function enablePushWebhook(tenantId: string, userId: string, publicBaseUrl: string) {
  const connection = await repo.findConnectionByTenant(tenantId)
  if (!connection) throw new IndiaMartError('NOT_CONFIGURED', 'Save connection settings first')

  const generated = generateWebhookToken()
  const updated = await prisma.indiaMartConnection.update({
    where: { id: connection.id },
    data: {
      pushWebhookEnabled: true,
      pushWebhookTokenHash: generated.hash,
      pushWebhookTokenPrefix: generated.prefix,
      updatedById: userId,
    },
  })

  await createAuditLog({
    tenantId,
    userId,
    module: 'crm',
    entity: 'indiamart_connection',
    entityId: connection.id,
    action: 'PUSH_WEBHOOK_ENABLED',
    newValues: { prefix: generated.prefix },
  })

  return {
    enabled: true,
    webhookUrl: buildWebhookUrl({
      publicBaseUrl,
      tenantSlug: (await prisma.tenant.findUnique({ where: { id: tenantId }, select: { slug: true } }))!.slug,
      token: generated.token,
    }),
    tokenPrefix: generated.prefix,
    // Token shown once — never returned again
    webhookToken: generated.token,
    connectionId: updated.id,
  }
}

export async function rotatePushWebhook(tenantId: string, userId: string, publicBaseUrl: string) {
  return enablePushWebhook(tenantId, userId, publicBaseUrl)
}

export async function disablePushWebhook(tenantId: string, userId: string) {
  const connection = await repo.findConnectionByTenant(tenantId)
  if (!connection) throw new IndiaMartError('NOT_CONFIGURED', 'Connection not configured')
  await prisma.indiaMartConnection.update({
    where: { id: connection.id },
    data: {
      pushWebhookEnabled: false,
      pushWebhookTokenHash: null,
      pushWebhookTokenPrefix: null,
      updatedById: userId,
    },
  })
  await createAuditLog({
    tenantId,
    userId,
    module: 'crm',
    entity: 'indiamart_connection',
    entityId: connection.id,
    action: 'PUSH_WEBHOOK_DISABLED',
  })
  return { enabled: false }
}

/**
 * Public Push API handler. Must return HTTP 200 when the payload is accepted
 * (IndiaMART deactivates Push after 48h of non-200 responses).
 */
export async function handleIndiaMartPushWebhook(input: {
  tenantSlug: string
  webhookToken: string
  body: unknown
}) {
  const tenant = await prisma.tenant.findFirst({
    where: { slug: input.tenantSlug, deletedAt: null },
    select: { id: true, slug: true },
  })
  if (!tenant) {
    throw new IndiaMartError('AUTHENTICATION', 'Unknown tenant', 401)
  }

  const tokenHash = hashWebhookToken(input.webhookToken)
  const connection = await prisma.indiaMartConnection.findFirst({
    where: {
      tenantId: tenant.id,
      pushWebhookEnabled: true,
      pushWebhookTokenHash: tokenHash,
    },
  })
  if (!connection) {
    throw new IndiaMartError('AUTHENTICATION', 'Invalid webhook token', 401)
  }

  const leadPayload = extractPushLeadPayload(input.body)
  const syncRun = await repo.createSyncRun({
    tenantId: tenant.id,
    connectionId: connection.id,
    triggerType: 'PUSH',
    triggeredById: null,
  })

  try {
    const cfg = (connection.configurationJson ?? {}) as IndiaMartConfigurationJson
    const result = await ingestIndiaMartEnquiry({
      tenantId: tenant.id,
      connection,
      syncRunId: syncRun.id,
      raw: leadPayload,
      fieldMap: cfg.responseFieldMap,
    })

    let leadsCreated = 0
    let leadsLinked = 0
    if (
      !result.duplicated &&
      connection.autoCreateLead &&
      result.enquiry.processingStatus === 'READY' &&
      result.enquiry.importStatus === 'NOT_IMPORTED'
    ) {
      if (!(connection.duplicateBehaviour === 'SEND_TO_REVIEW' && result.enquiry.matchedLeadId)) {
        const imported = await importEnquiryAsLead({
          tenantId: tenant.id,
          userId: connection.updatedById ?? connection.createdById ?? 'system',
          connection,
          enquiry: result.enquiry,
          mode: 'AUTO',
        })
        if (imported.linked) leadsLinked = 1
        else leadsCreated = 1
      }
    }

    await repo.completeSyncRun(syncRun.id, {
      status: 'COMPLETED',
      completedAt: new Date(),
      durationMs: Date.now() - syncRun.startedAt.getTime(),
      recordsFetched: 1,
      recordsInserted: result.inserted ? 1 : 0,
      recordsUpdated: result.duplicated ? 1 : 0,
      recordsDuplicated: result.duplicated ? 1 : 0,
      leadsCreated,
      leadsLinked,
      recordsFailed: 0,
    })

    await repo.updateConnectionSyncMeta(connection.id, {
      status: 'CONNECTED',
      lastSuccessfulSyncAt: new Date(),
      lastAttemptedSyncAt: new Date(),
      lastExternalTimestamp: new Date(),
    })

    return {
      accepted: true,
      duplicated: result.duplicated,
      enquiryId: result.enquiry.id,
      externalEnquiryId: result.enquiry.externalEnquiryId,
      leadsCreated,
      leadsLinked,
    }
  } catch (err) {
    const message = (err as Error).message
    await repo.completeSyncRun(syncRun.id, {
      status: 'FAILED',
      completedAt: new Date(),
      durationMs: Date.now() - syncRun.startedAt.getTime(),
      recordsFetched: 1,
      recordsFailed: 1,
      errorCode: err instanceof IndiaMartError ? err.code : 'INTERNAL',
      errorMessage: message,
    })
    await upsertAlert({
      tenantId: tenant.id,
      connectionId: connection.id,
      syncRunId: syncRun.id,
      alertType: 'SYNC_FAILED',
      severity: 'CRITICAL',
      title: 'IndiaMART push ingest failed',
      message,
      href: '/crm/integrations/indiamart/sync-history',
      dedupeKey: `push-fail:${syncRun.id}`,
    })
    // Still return 200 for payload_invalid duplicates-style issues after we recorded failure?
    // Spec: IndiaMART needs 200 to keep Push active. For auth we already threw 401.
    // For processing errors, return 200 with accepted:false so retries don't flood,
    // but IndiaMART considers 200 = success. Prefer rethrow for true failures so they retry.
    if (err instanceof IndiaMartError && err.code === 'PAYLOAD_INVALID') {
      return { accepted: false, error: message }
    }
    throw err
  }
}

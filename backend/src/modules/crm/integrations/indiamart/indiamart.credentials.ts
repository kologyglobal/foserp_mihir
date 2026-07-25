import type { IndiaMartConnection } from '@prisma/client'
import {
  decryptFieldSecret,
  encryptFieldSecret,
  isFieldEncryptionConfigured,
  assertFieldEncryptionConfigured,
} from '../../../../utils/fieldEncryption.js'
import { IndiaMartError } from './indiamart.errors.js'
import { maskEmail, maskMobile, maskSecret } from './indiamart.normalizer.js'
import type {
  IndiaMartConfigurationJson,
  IndiaMartConnectionConfig,
} from './indiamart.types.js'
import {
  DEFAULT_INDIAMART_API_BASE_URL,
  DEFAULT_INDIAMART_LEAD_FETCH_ENDPOINT,
} from './indiamart.types.js'

export type StoredCredentials = {
  apiKey: string
  registeredMobile?: string
  registeredEmail?: string
}

export function encryptCredentials(creds: StoredCredentials): string {
  assertFieldEncryptionConfigured()
  return encryptFieldSecret(JSON.stringify(creds))
}

export function decryptCredentials(encrypted: string): StoredCredentials | null {
  if (!encrypted) return null
  if (!isFieldEncryptionConfigured()) return null
  const plain = decryptFieldSecret(encrypted)
  if (!plain) return null
  try {
    const parsed = JSON.parse(plain) as StoredCredentials
    if (!parsed.apiKey) return null
    return parsed
  } catch {
    return null
  }
}

export function buildConnectionConfig(connection: IndiaMartConnection): IndiaMartConnectionConfig {
  const creds = decryptCredentials(connection.encryptedCredentials)
  if (!creds?.apiKey) {
    throw new IndiaMartError('NOT_CONFIGURED', 'IndiaMART credentials are not configured', 400)
  }
  const cfg = (connection.configurationJson ?? {}) as IndiaMartConfigurationJson
  return {
    apiBaseUrl: connection.apiBaseUrl || DEFAULT_INDIAMART_API_BASE_URL,
    leadFetchEndpoint: connection.leadFetchEndpoint || DEFAULT_INDIAMART_LEAD_FETCH_ENDPOINT,
    authenticationType: connection.authenticationType,
    credentials: {
      apiKey: creds.apiKey,
      registeredMobile: creds.registeredMobile,
      registeredEmail: creds.registeredEmail,
    },
    queryParamNames: cfg.queryParamNames,
    headerNames: cfg.headerNames,
    responseFieldMap: cfg.responseFieldMap,
    requestTimeoutMs: cfg.requestTimeoutMs ?? 30_000,
    maxPageSize: cfg.maxPageSize ?? 500,
  }
}

export function mapConnectionSettingsDto(
  connection: IndiaMartConnection | null,
  opts?: { includeRawPayloadAccess?: boolean },
) {
  if (!connection) {
    return {
      configured: false,
      status: 'NOT_CONFIGURED' as const,
      hasCredentials: false,
      apiKeyMasked: null,
      registeredMobileMasked: null,
      registeredEmailMasked: null,
      syncEnabled: false,
      autoCreateLead: true,
      apiBaseUrl: DEFAULT_INDIAMART_API_BASE_URL,
      leadFetchEndpoint: DEFAULT_INDIAMART_LEAD_FETCH_ENDPOINT,
      authenticationType: 'QUERY_PARAMETER' as const,
      syncIntervalMinutes: 15,
      initialLookbackDays: 7,
      maxRecordsPerRun: 500,
      duplicateBehaviour: 'CREATE_ACTIVITY_ON_EXISTING_LEAD' as const,
      assignmentMode: 'DEFAULT_OWNER' as const,
      configurationJson: {},
      lastSuccessfulSyncAt: null,
      lastAttemptedSyncAt: null,
      nextScheduledSyncAt: null,
      fieldEncryptionConfigured: isFieldEncryptionConfigured(),
      pushWebhookEnabled: false,
      pushWebhookTokenPrefix: null,
    }
  }

  const creds = decryptCredentials(connection.encryptedCredentials)
  const cfg = (connection.configurationJson ?? {}) as IndiaMartConfigurationJson

  return {
    id: connection.id,
    configured: Boolean(creds?.apiKey),
    status: connection.status,
    hasCredentials: Boolean(creds?.apiKey),
    accountName: connection.accountName,
    apiKeyMasked: creds?.apiKey ? maskSecret(creds.apiKey) : null,
    registeredMobileMasked: connection.registeredMobileMasked ?? maskMobile(creds?.registeredMobile),
    registeredEmailMasked: connection.registeredEmailMasked ?? maskEmail(creds?.registeredEmail),
    apiBaseUrl: connection.apiBaseUrl,
    leadFetchEndpoint: connection.leadFetchEndpoint,
    authenticationType: connection.authenticationType,
    syncEnabled: connection.syncEnabled,
    autoCreateLead: connection.autoCreateLead,
    defaultLeadSourceId: connection.defaultLeadSourceId,
    defaultLeadOwnerId: connection.defaultLeadOwnerId,
    defaultTerritoryId: connection.defaultTerritoryId,
    defaultPriority: connection.defaultPriority,
    defaultIndustryId: connection.defaultIndustryId,
    duplicateBehaviour: connection.duplicateBehaviour,
    assignmentMode: connection.assignmentMode,
    syncIntervalMinutes: connection.syncIntervalMinutes,
    initialLookbackDays: connection.initialLookbackDays,
    maxRecordsPerRun: connection.maxRecordsPerRun,
    lastSuccessfulSyncAt: connection.lastSuccessfulSyncAt?.toISOString() ?? null,
    lastAttemptedSyncAt: connection.lastAttemptedSyncAt?.toISOString() ?? null,
    nextScheduledSyncAt: connection.nextScheduledSyncAt?.toISOString() ?? null,
    lastExternalTimestamp: connection.lastExternalTimestamp?.toISOString() ?? null,
    configurationJson: {
      ...cfg,
      apiKey: undefined,
      credentials: undefined,
    },
    fieldEncryptionConfigured: isFieldEncryptionConfigured(),
    includeRawPayloadAccess: opts?.includeRawPayloadAccess ?? false,
    pushWebhookEnabled: connection.pushWebhookEnabled,
    pushWebhookTokenPrefix: connection.pushWebhookTokenPrefix,
    updatedAt: connection.updatedAt.toISOString(),
  }
}

import { z } from 'zod'
import { paginationSchema } from '../../../../utils/pagination.js'
import {
  BANK_CONNECTOR_EXPECTED_FORMATS,
  BANK_CONNECTOR_PROVIDERS,
  BANK_CONNECTOR_STATUSES,
  bankConnectorEnvKeySchema,
} from './bank-connector.enums.js'

const configJsonSchema = z
  .object({
    mode: z.enum(['SANDBOX', 'LIVE']).optional(),
    expectedFormat: z.enum(BANK_CONNECTOR_EXPECTED_FORMATS).optional(),
    remotePath: z.string().trim().max(500).optional(),
    fileNamePattern: z.string().trim().max(200).optional(),
    sandboxRoot: z.string().trim().max(500).optional(),
    credentialEnvKey: bankConnectorEnvKeySchema.optional(),
    listUrl: z.string().trim().url().max(500).optional(),
    host: z.string().trim().max(253).optional(),
    port: z.coerce.number().int().min(1).max(65535).optional(),
    hostKeyFingerprint: z.string().trim().max(200).optional(),
    usernameEnvKey: bankConnectorEnvKeySchema.optional(),
    passwordEnvKey: bankConnectorEnvKeySchema.optional(),
    privateKeyEnvKey: bankConnectorEnvKeySchema.optional(),
    passphraseEnvKey: bankConnectorEnvKeySchema.optional(),
    authorizeUrl: z.string().trim().url().max(500).optional(),
    notes: z.string().trim().max(500).optional(),
  })
  .strict()
  .optional()
  .nullable()

export const listBankConnectorsQuerySchema = paginationSchema.extend({
  legalEntityId: z.string().uuid().optional(),
  treasuryAccountId: z.string().uuid().optional(),
  provider: z.enum(BANK_CONNECTOR_PROVIDERS).optional(),
  status: z.enum(BANK_CONNECTOR_STATUSES).optional(),
  search: z.string().trim().max(100).optional(),
})

export const createBankConnectorSchema = z.object({
  legalEntityId: z.string().uuid(),
  treasuryAccountId: z.string().uuid(),
  code: z
    .string()
    .trim()
    .min(2)
    .max(32)
    .regex(/^[A-Z0-9_-]+$/i, 'code must be alphanumeric with _ or -'),
  name: z.string().trim().min(2).max(200),
  provider: z.enum(BANK_CONNECTOR_PROVIDERS),
  baseUrl: z.string().trim().max(500).nullable().optional(),
  scheduleCron: z.string().trim().max(64).nullable().optional(),
  configJson: configJsonSchema,
})

export const updateBankConnectorSchema = z.object({
  name: z.string().trim().min(2).max(200).optional(),
  treasuryAccountId: z.string().uuid().optional(),
  baseUrl: z.string().trim().max(500).nullable().optional(),
  scheduleCron: z.string().trim().max(64).nullable().optional(),
  configJson: configJsonSchema,
  expectedUpdatedAt: z.string().datetime(),
})

export const bankConnectorLifecycleSchema = z.object({
  expectedUpdatedAt: z.string().datetime(),
})

export const startBankConnectorConsentSchema = z.object({
  redirectUri: z.string().trim().url().max(500),
  expectedUpdatedAt: z.string().datetime().optional(),
})

export const bankConnectorConsentCallbackSchema = z.object({
  state: z.string().trim().min(8).max(200),
  code: z.string().trim().min(1).max(2000).optional(),
  error: z.string().trim().max(500).optional(),
  /** Simulated access token for scaffold tests only — encrypted at rest when FIELD_ENCRYPTION_KEY set. */
  accessToken: z.string().trim().min(1).max(4000).optional(),
  expiresInSeconds: z.coerce.number().int().positive().max(86_400 * 90).optional(),
})

export const revokeBankConnectorConsentSchema = z.object({
  expectedUpdatedAt: z.string().datetime().optional(),
  reason: z.string().trim().max(500).optional(),
})

export type ListBankConnectorsQuery = z.infer<typeof listBankConnectorsQuerySchema>
export type CreateBankConnectorInput = z.infer<typeof createBankConnectorSchema>
export type UpdateBankConnectorInput = z.infer<typeof updateBankConnectorSchema>
export type BankConnectorLifecycleInput = z.infer<typeof bankConnectorLifecycleSchema>
export type StartBankConnectorConsentInput = z.infer<typeof startBankConnectorConsentSchema>
export type BankConnectorConsentCallbackInput = z.infer<typeof bankConnectorConsentCallbackSchema>
export type RevokeBankConnectorConsentInput = z.infer<typeof revokeBankConnectorConsentSchema>

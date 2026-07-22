import { config as loadEnv } from 'dotenv'
import { z } from 'zod'

loadEnv()

function buildDatabaseUrl(): string {
  if (process.env.DATABASE_URL) {
    return process.env.DATABASE_URL
  }
  const host = process.env.DB_HOST ?? 'localhost'
  const port = process.env.DB_PORT ?? '3306'
  const name = process.env.DB_NAME ?? 'fos_erp'
  const user = process.env.DB_USER ?? 'root'
  const pass = encodeURIComponent(process.env.DB_PASS ?? '')
  return `mysql://${user}:${pass}@${host}:${port}/${name}`
}

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().default(5000),
  DB_HOST: z.string().default('localhost'),
  DB_PORT: z.coerce.number().default(3306),
  DB_NAME: z.string().default('fos_erp'),
  DB_USER: z.string().default('root'),
  DB_PASS: z.string().default(''),
  JWT_ACCESS_SECRET: z.string().min(32),
  JWT_REFRESH_SECRET: z.string().min(32),
  JWT_ACCESS_EXPIRES_IN: z.string().default('15m'),
  JWT_REFRESH_EXPIRES_IN: z.string().default('7d'),
  FRONTEND_URL: z.string().url().default('http://localhost:5173'),
  CRM_UPLOAD_DIR: z.string().optional(),
  /** Phase 5A2 — directory for uploaded bank statement import files. */
  TREASURY_STATEMENT_UPLOAD_DIR: z.string().optional(),
  /** Decoded file size cap for CRM attachments (default 25MB). JSON body limit is sized for base64. */
  CRM_MAX_UPLOAD_BYTES: z.coerce.number().default(25 * 1024 * 1024),
  /** Phase 5A1 — HMAC key for treasury bank account number duplicate-detection hashing. */
  TREASURY_ACCOUNT_HMAC_SECRET: z.string().min(16).optional(),
  /** Phase 5A1 — AES-256-GCM key (32 bytes, base64 or hex) for at-rest bank account number encryption. Shared name with any future field-level encryption use. */
  FIELD_ENCRYPTION_KEY: z.string().optional(),
  /**
   * Phase 5D2 — allow sandbox filesystem connectors.
   * unset = enabled outside production; true/false force.
   */
  BANK_CONNECTOR_SANDBOX_ENABLED: z
    .enum(['true', 'false'])
    .optional()
    .transform((v) => (v === undefined ? undefined : v === 'true')),
  /** Comma-separated absolute roots allowed for sandboxRoot (required in production when sandbox is on). */
  BANK_CONNECTOR_SANDBOX_ROOTS: z.string().optional(),
  /** Comma-separated hostnames allowed for GENERIC_REST baseUrl (default localhost in non-prod). */
  BANK_CONNECTOR_ALLOWED_HOSTS: z.string().optional(),
  /** Comma-separated hostnames allowed for live SFTP (default localhost in non-prod). */
  BANK_CONNECTOR_SFTP_ALLOWED_HOSTS: z.string().optional(),
  /**
   * O2C Wave 3 — post Dr COGS / Cr FINISHED_GOODS_INVENTORY on sales invoice post when FG cost
   * is available from dispatch inventory movements. Default OFF.
   */
  ENABLE_SI_COGS_POSTING: z
    .enum(['true', 'false'])
    .optional()
    .transform((v) => v === 'true'),
})

const parsed = envSchema.safeParse(process.env)

if (!parsed.success) {
  console.error('Invalid environment variables:', parsed.error.flatten().fieldErrors)
  process.exit(1)
}

export const env = {
  ...parsed.data,
  DATABASE_URL: buildDatabaseUrl(),
  isDev: parsed.data.NODE_ENV === 'development',
  isTest: parsed.data.NODE_ENV === 'test',
  isProd: parsed.data.NODE_ENV === 'production',
}

process.env.DATABASE_URL = env.DATABASE_URL

/**
 * Runtime environment — public configuration only.
 * Never embed JWT secrets, DB credentials, or SMTP keys.
 */

export type AppEnvironment = 'development' | 'uat' | 'production'

function readPublic(key: string): string | undefined {
  const value = process.env[key]
  if (value == null || value === '') return undefined
  return value
}

function normalizeApiBaseUrl(raw: string): string {
  const trimmed = raw.trim().replace(/\/+$/, '')
  if (!trimmed) return ''
  return trimmed
}

const appEnvRaw = (readPublic('EXPO_PUBLIC_APP_ENV') ?? 'development').toLowerCase()
const appEnv: AppEnvironment =
  appEnvRaw === 'uat' || appEnvRaw === 'production' || appEnvRaw === 'development'
    ? appEnvRaw
    : 'development'

const apiBaseUrl = normalizeApiBaseUrl(readPublic('EXPO_PUBLIC_API_BASE_URL') ?? '')

export const env = {
  appEnv,
  isDev: appEnv === 'development',
  isUat: appEnv === 'uat',
  isProd: appEnv === 'production',
  /** Base including `/api/v1` — no trailing slash */
  apiBaseUrl,
  defaultTenantSlug: readPublic('EXPO_PUBLIC_DEFAULT_TENANT_SLUG') ?? '',
  appVersion: readPublic('EXPO_PUBLIC_APP_VERSION') ?? '1.0.0',
  buildNumber: readPublic('EXPO_PUBLIC_BUILD_NUMBER') ?? '1',
  /** Request timeout ms */
  apiTimeoutMs: 30_000,
  /** Access token proactive refresh skew */
  accessTokenSkewMs: 60_000,
  clientName: 'fos-mobile',
} as const

export function assertApiConfigured(): void {
  if (!env.apiBaseUrl) {
    throw new Error(
      'EXPO_PUBLIC_API_BASE_URL is not set. Copy mobile/.env.example to mobile/.env and set your API URL.',
    )
  }
  if (env.isProd && !env.apiBaseUrl.startsWith('https://')) {
    throw new Error('Production builds must use an HTTPS API base URL.')
  }
}

export function getClientHeaders(): Record<string, string> {
  return {
    'X-Client': `${env.clientName}/${env.appVersion}`,
    'X-App-Build': env.buildNumber,
    'X-App-Env': env.appEnv,
  }
}

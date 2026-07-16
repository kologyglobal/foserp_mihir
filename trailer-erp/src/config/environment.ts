/**
 * Raw Vite / Node environment access — business code should use config/appConfig.ts.
 */
function readEnv(key: string): string | undefined {
  if (typeof import.meta !== 'undefined' && import.meta.env && key in import.meta.env) {
    return String(import.meta.env[key as keyof ImportMetaEnv])
  }
  if (typeof process !== 'undefined' && process.env[key] != null) {
    return String(process.env[key])
  }
  return undefined
}

export const environment = {
  apiBaseUrl: readEnv('VITE_API_BASE_URL') ?? 'http://localhost:5000/api/v1',
  useApi: readEnv('VITE_USE_API') === 'true',
  tenantSlug: readEnv('VITE_TENANT_SLUG') ?? 'vasant-trailers',
  mode: readEnv('MODE') ?? 'development',
  isDev: readEnv('DEV') === 'true' || readEnv('MODE') === 'development',
} as const

export function readAppEnv(key: string): string | undefined {
  return readEnv(key)
}

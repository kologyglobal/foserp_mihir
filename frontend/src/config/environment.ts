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

/** Keep API host in sync with the page host (localhost vs 127.0.0.1) to avoid failed fetches. */
function resolveApiBaseUrl(): string {
  const configured = readEnv('VITE_API_BASE_URL') ?? 'http://127.0.0.1:5000/api/v1'
  if (typeof window === 'undefined') return configured
  const pageHost = window.location.hostname
  if (pageHost !== 'localhost' && pageHost !== '127.0.0.1') return configured
  try {
    const url = new URL(configured)
    if (url.hostname === 'localhost' || url.hostname === '127.0.0.1') {
      url.hostname = pageHost
      return url.toString().replace(/\/$/, '')
    }
  } catch {
    /* keep configured */
  }
  return configured
}

export const environment = {
  get apiBaseUrl() {
    return resolveApiBaseUrl()
  },
  useApi: readEnv('VITE_USE_API') === 'true',
  tenantSlug: readEnv('VITE_TENANT_SLUG') ?? 'vasant-trailers',
  mode: readEnv('MODE') ?? 'development',
  isDev: readEnv('DEV') === 'true' || readEnv('MODE') === 'development',
}

export function readAppEnv(key: string): string | undefined {
  return readEnv(key)
}

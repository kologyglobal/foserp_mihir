import { API_CONFIG, isApiMode } from './apiConfig'
import { environment } from './environment'
import { featureFlags } from './featureFlags'

export const appConfig = {
  apiMode: environment.useApi,
  apiBaseUrl: environment.apiBaseUrl,
  tenantSlug: environment.tenantSlug,
  isDev: environment.isDev,
  featureFlags,
} as const

export type AppConfig = typeof appConfig

/** Legacy alias — prefer appConfig */
export { API_CONFIG, isApiMode, environment, featureFlags }

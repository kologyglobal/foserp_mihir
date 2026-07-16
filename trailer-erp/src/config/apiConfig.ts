import { environment } from './environment'

/** @deprecated Use appConfig — kept for backward compatibility */
export const API_CONFIG = {
  baseUrl: environment.apiBaseUrl,
  useApi: environment.useApi,
  tenantSlug: environment.tenantSlug,
} as const

export function isApiMode(): boolean {
  return environment.useApi
}

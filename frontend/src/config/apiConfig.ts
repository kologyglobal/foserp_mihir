import { environment } from './environment'

/**
 * @deprecated Prefer appConfig — kept for backward compatibility.
 * Use getters so same-origin `/api/v1` (and host rewrite) always resolve at call time.
 */
export const API_CONFIG = {
  get baseUrl() {
    return environment.apiBaseUrl
  },
  get useApi() {
    return environment.useApi
  },
  get tenantSlug() {
    return environment.tenantSlug
  },
}

export function isApiMode(): boolean {
  return environment.useApi
}

import { isApiMode } from '../../config/apiConfig'
import { apiRequest, getStoredSession, tenantPath } from './client'

export interface UiPreferenceDto {
  prefKey: string
  value: unknown
  updatedAt?: string
}

/** Server sync only makes sense in API mode with an authenticated session. */
export function canSyncUiPreferences(): boolean {
  return isApiMode() && Boolean(getStoredSession()?.accessToken)
}

export async function listUiPreferences(): Promise<UiPreferenceDto[]> {
  const res = await apiRequest<UiPreferenceDto[]>(tenantPath('/me/ui-preferences'))
  return Array.isArray(res.data) ? res.data : []
}

export async function putUiPreference(prefKey: string, value: unknown): Promise<void> {
  await apiRequest(tenantPath(`/me/ui-preferences/${encodeURIComponent(prefKey)}`), {
    method: 'PUT',
    body: JSON.stringify({ value }),
  })
}

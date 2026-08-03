import { apiClient, tenantPath } from '@/api/client'
import type { AuthMe, ModuleStatus } from '@/types/api'

export async function fetchMe(): Promise<AuthMe> {
  const res = await apiClient.get<AuthMe>('/auth/me')
  return res.data
}

export async function fetchModuleFlags(tenantSlug?: string): Promise<ModuleStatus[]> {
  const res = await apiClient.get<{
    modules?: Array<{
      key: string
      name: string
      description?: string
      isEnabled?: boolean
      enabled?: boolean
      alwaysOn?: boolean
      dependsOn?: string[]
    }>
    enabledKeys?: string[]
  }>(tenantPath('/modules', tenantSlug))

  const data = res.data
  if (data?.modules && Array.isArray(data.modules)) {
    return data.modules.map((m) => ({
      key: m.key,
      name: m.name,
      description: m.description,
      enabled: m.isEnabled ?? m.enabled ?? true,
      alwaysOn: m.alwaysOn,
      dependsOn: m.dependsOn,
    }))
  }
  return []
}

export async function fetchHealth(): Promise<{ database?: string; environment?: string }> {
  const res = await apiClient.get<{ database?: string; environment?: string }>('/health', {
    skipAuth: true,
    retries: 0,
  })
  return res.data
}

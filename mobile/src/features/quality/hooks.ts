import { useQuery, useQueryClient, type UseQueryResult } from '@tanstack/react-query'
import { isModuleEnabled } from '@/auth/modules'
import { useSessionStore } from '@/store/sessionStore'
import {
  getQcKioskInspection,
  getQcKioskQueue,
  type QcKioskQueueItem,
} from '@/features/quality/api'

export const qualityKeys = {
  all: ['quality'] as const,
  queue: () => [...qualityKeys.all, 'queue'] as const,
  inspection: (id: string) => [...qualityKeys.all, 'inspection', id] as const,
}

function canViewQuality(perms: string[] | null): boolean {
  if (!perms) return false
  return (
    perms.includes('quality.view') ||
    perms.includes('manufacturing.quality.view') ||
    perms.includes('quality.incoming.view')
  )
}

export function useQualityAccess() {
  const profile = useSessionStore((s) => s.profile)
  const perms = profile?.permissions ?? null
  const enabled =
    perms != null && isModuleEnabled('quality', profile?.modules) && canViewQuality(perms)
  return { enabled, perms }
}

export function useQcQueue(): UseQueryResult<
  { items: QcKioskQueueItem[]; summary?: { openCount: number; pendingCount: number; reworkCount: number } },
  Error
> {
  const { enabled } = useQualityAccess()
  return useQuery({
    queryKey: qualityKeys.queue(),
    queryFn: () => getQcKioskQueue({ limit: 50 }),
    enabled,
    staleTime: 15_000,
    retry: 1,
  })
}

export function useQcInspection(id: string): UseQueryResult<Record<string, unknown>, Error> {
  const { enabled } = useQualityAccess()
  return useQuery({
    queryKey: qualityKeys.inspection(id),
    queryFn: () => getQcKioskInspection(id),
    enabled: enabled && Boolean(id),
    staleTime: 10_000,
    retry: 1,
  })
}

export function useInvalidateQuality() {
  const qc = useQueryClient()
  return () => {
    void qc.invalidateQueries({ queryKey: qualityKeys.all })
  }
}

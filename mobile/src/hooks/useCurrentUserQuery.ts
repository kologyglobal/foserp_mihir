import { useQuery } from '@tanstack/react-query'
import { fetchMe } from '@/api/authApi'
import { useSessionStore } from '@/store/sessionStore'

export function useCurrentUserQuery(enabled: boolean) {
  const setProfile = useSessionStore((s) => s.setProfile)
  const profile = useSessionStore((s) => s.profile)
  const session = useSessionStore((s) => s.session)

  return useQuery({
    queryKey: ['auth', 'me', session?.tenantId],
    enabled: enabled && !!session?.accessToken,
    queryFn: async () => {
      const me = await fetchMe()
      if (profile) {
        setProfile({
          ...profile,
          user: me,
          tenant: me.tenant,
          permissions: me.permissions ?? [],
          roles: me.roles ?? [],
          department: me.department ?? null,
        })
      }
      return me
    },
    staleTime: 60_000,
  })
}

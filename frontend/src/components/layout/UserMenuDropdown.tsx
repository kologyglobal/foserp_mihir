import { useEffect, useMemo, useRef, useState } from 'react'
import { ChevronDown, LogOut, Settings, User } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useAuth, useOptionalAuth } from '../../context/AuthProvider'
import { isApiMode } from '../../config/apiConfig'
import { getSessionUser, getSessionUserRoleLabel } from '../../utils/permissions'
import { cn } from '../../utils/cn'

export function UserMenuDropdown({
  variant = 'default',
  className,
}: {
  variant?: 'default' | 'suite'
  className?: string
}) {
  const navigate = useNavigate()
  const auth = useOptionalAuth()
  const { logout } = useAuth()
  const [open, setOpen] = useState(false)
  const [signingOut, setSigningOut] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  const profile = useMemo(() => {
    const apiUser = auth?.session?.user
    if (apiUser) {
      return {
        name: `${apiUser.firstName} ${apiUser.lastName}`.trim() || apiUser.email,
        email: apiUser.email,
        roleLabel: apiUser.roles?.[0] ?? getSessionUserRoleLabel(),
      }
    }
    const local = getSessionUser()
    return {
      name: local.name,
      email: undefined as string | undefined,
      roleLabel: getSessionUserRoleLabel(),
    }
  }, [auth?.session])

  const { name, email, roleLabel } = profile

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [])

  const initials = name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()

  async function handleSignOut() {
    setSigningOut(true)
    try {
      if (isApiMode()) {
        await logout()
      }
      navigate('/login', { replace: true })
    } finally {
      setSigningOut(false)
      setOpen(false)
    }
  }

  const isSuite = variant === 'suite'

  return (
    <div ref={ref} className={cn('relative', className)}>
      <button
        type="button"
        className={cn(isSuite ? 'd365-suite-user' : 'flex h-8 items-center gap-2 rounded-[4px] border border-erp-border bg-erp-surface pl-1 pr-2 transition-colors hover:border-erp-border-strong hover:bg-erp-surface-alt')}
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label="User menu"
      >
        <span className={cn(isSuite ? 'd365-suite-avatar' : 'flex h-6 w-6 items-center justify-center rounded-[4px] bg-erp-primary text-white')}>
          {initials || <User className="h-3.5 w-3.5" />}
        </span>
        <span className={cn('hidden text-left lg:block', !isSuite && 'sm:block')}>
          <span className={cn(isSuite ? 'd365-suite-user-name block' : 'erp-type-caption-strong block leading-tight')}>
            {name}
          </span>
          <span className={cn(isSuite ? 'd365-suite-user-role' : 'erp-type-micro')}>
            {roleLabel}
          </span>
        </span>
        <ChevronDown
          className={cn(
            'hidden h-3 w-3 transition-transform lg:block',
            isSuite ? 'd365-suite-user-chevron' : 'text-erp-muted sm:block',
            open && 'rotate-180',
          )}
          aria-hidden
        />
      </button>

      {open && (
        <div
          className={cn(
            'absolute right-0 top-full z-50 mt-1 w-56 overflow-hidden rounded-lg border py-1 shadow-erp-lg',
            isSuite ? 'd365-user-menu border-[var(--d365-border)] bg-white' : 'border-erp-border bg-white',
          )}
          role="menu"
        >
          <div className={cn(isSuite ? 'd365-user-menu-header' : 'border-b border-erp-border px-3 py-2.5')}>
            <p className={cn(isSuite ? 'd365-user-menu-name' : 'text-[13px] font-semibold text-erp-text')}>
              {name}
            </p>
            {email ? (
              <p className={cn(isSuite ? 'd365-user-menu-email' : 'text-[11px] text-erp-muted')}>{email}</p>
            ) : null}
            <p className={cn(isSuite ? 'd365-user-menu-role' : 'mt-0.5 text-[11px] text-erp-muted')}>{roleLabel}</p>
          </div>

          <button
            type="button"
            role="menuitem"
            className={cn(isSuite ? 'd365-user-menu-item' : 'flex w-full items-center gap-2 px-3 py-2 text-left text-[13px] text-erp-text hover:bg-erp-surface-alt')}
            onClick={() => {
              setOpen(false)
              navigate('/settings')
            }}
          >
            <Settings className="h-4 w-4 shrink-0 text-erp-muted" />
            Settings
          </button>

          <button
            type="button"
            role="menuitem"
            className={cn(
              isSuite ? 'd365-user-menu-item d365-user-menu-item-danger' : 'flex w-full items-center gap-2 px-3 py-2 text-left text-[13px] text-red-600 hover:bg-red-50',
            )}
            onClick={handleSignOut}
            disabled={signingOut}
          >
            <LogOut className="h-4 w-4 shrink-0" />
            {signingOut ? 'Signing out…' : 'Sign out'}
          </button>
        </div>
      )}
    </div>
  )
}

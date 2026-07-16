import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronDown } from 'lucide-react'
import { ALL_EXPERIENCE_ROLES } from '../../config/roleExperience'
import { EXPERIENCE_ROLE_LABELS, type ExperienceRole } from '../../types/roleExperience'
import { getExperienceRole, getExperienceRoleLabel, getSessionUser, getSessionUserRoleLabel, setExperienceRole } from '../../utils/permissions'
import { cn } from '../../utils/cn'

export const EXPERIENCE_ROLE_CHANGE = 'erp-experience-role-change'

export function RoleSwitcher({ className, variant = 'default' }: { className?: string; variant?: 'default' | 'suite' }) {
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const current = getExperienceRole()
  const user = getSessionUser()

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [])

  function pick(role: ExperienceRole) {
    setExperienceRole(role)
    setOpen(false)
    window.dispatchEvent(new Event(EXPERIENCE_ROLE_CHANGE))
    navigate('/home')
  }

  return (
    <div ref={ref} className={cn('relative', className)}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={cn(
          variant === 'suite'
            ? 'd365-role-trigger'
            : 'flex h-9 items-center gap-2 rounded-lg border border-erp-border bg-erp-surface px-2.5 text-[12px] shadow-sm hover:border-erp-accent',
        )}
      >
        <span className={cn(variant === 'suite' ? '' : 'font-semibold text-erp-text')}>{getExperienceRoleLabel()}</span>
        <ChevronDown className={cn('h-3.5 w-3.5 transition-transform', variant === 'suite' ? 'text-white/80' : 'text-erp-muted', open && 'rotate-180')} />
      </button>
      {open && (
        <div className={cn(
          'absolute right-0 top-full z-50 mt-1 w-52 rounded-lg border py-1 shadow-erp-lg',
          variant === 'suite' ? 'd365-role-menu border-[var(--d365-border)] bg-white' : 'border-erp-border bg-white',
        )}>
          <p className={variant === 'suite' ? 'd365-role-menu-label' : 'px-3 py-2 text-[10px] font-semibold uppercase tracking-wide text-erp-muted'}>Experience role</p>
          {ALL_EXPERIENCE_ROLES.map((role) => (
            <button
              key={role}
              type="button"
              onClick={() => pick(role)}
              className={cn(
                variant === 'suite' ? 'd365-role-menu-item' : 'block w-full px-3 py-2 text-left text-[13px] hover:bg-erp-surface-alt',
                role === current && (variant === 'suite' ? 'd365-role-menu-item-active' : 'bg-erp-primary-soft font-semibold text-erp-primary'),
              )}
            >
              {EXPERIENCE_ROLE_LABELS[role]}
            </button>
          ))}
          <p className={variant === 'suite' ? 'd365-role-menu-footer' : 'border-t border-erp-border px-3 py-2 text-[10px] text-erp-muted'}>
            Signed in as {user.name} · {getSessionUserRoleLabel()}
          </p>
        </div>
      )}
    </div>
  )
}

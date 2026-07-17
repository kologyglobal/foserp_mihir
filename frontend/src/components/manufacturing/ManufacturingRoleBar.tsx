import { ShieldCheck } from 'lucide-react'
import { cn } from '@/utils/cn'
import type { ManufacturingUiRole } from '@/types/manufacturingRoles'
import {
  MANUFACTURING_UI_ROLES,
  MANUFACTURING_UI_ROLE_DESCRIPTIONS,
  MANUFACTURING_UI_ROLE_LABELS,
  MANUFACTURING_UI_ROLE_SHORT,
  MANUFACTURING_UI_ROLE_TONE,
} from '@/types/manufacturingRoles'
import { setManufacturingUiRole, useManufacturingUiRole } from '@/utils/manufacturing/uiRoleStore'
import { isManufacturingUiReadOnly } from '@/utils/permissions/manufacturing'

export function ManufacturingRoleBadge({
  role,
  className,
  short,
}: {
  role?: ManufacturingUiRole
  className?: string
  short?: boolean
}) {
  const current = useManufacturingUiRole()
  const active = role ?? current
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold ring-1',
        MANUFACTURING_UI_ROLE_TONE[active],
        className,
      )}
      title={MANUFACTURING_UI_ROLE_DESCRIPTIONS[active]}
    >
      {short ? MANUFACTURING_UI_ROLE_SHORT[active] : MANUFACTURING_UI_ROLE_LABELS[active]}
    </span>
  )
}

/** Demo role switcher for manufacturing UI planning — does not affect other modules. */
export function ManufacturingRoleBar({ className }: { className?: string }) {
  const role = useManufacturingUiRole()
  const readOnly = isManufacturingUiReadOnly(role)

  return (
    <div
      className={cn(
        'flex flex-wrap items-center gap-2 rounded-xl border border-erp-border bg-white px-3 py-2 text-[12px] shadow-sm',
        className,
      )}
    >
      <ShieldCheck className="h-3.5 w-3.5 shrink-0 text-erp-primary" aria-hidden />
      <span className="text-erp-muted">Viewing as</span>
      <select
        value={role}
        onChange={(e) => setManufacturingUiRole(e.target.value as ManufacturingUiRole)}
        className="h-8 min-w-[11rem] rounded-lg border border-erp-border bg-erp-surface px-2 text-[12px] font-medium text-erp-text"
        aria-label="Manufacturing demo role"
      >
        {MANUFACTURING_UI_ROLES.map((r) => (
          <option key={r} value={r}>
            {MANUFACTURING_UI_ROLE_LABELS[r]}
          </option>
        ))}
      </select>
      <ManufacturingRoleBadge role={role} />
      {readOnly ? (
        <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-900 ring-1 ring-amber-200">
          Read-only role
        </span>
      ) : null}
      <span className="w-full text-[11px] text-erp-muted sm:w-auto sm:flex-1">
        {MANUFACTURING_UI_ROLE_DESCRIPTIONS[role]} — UI placeholder only, no backend RBAC yet.
      </span>
    </div>
  )
}

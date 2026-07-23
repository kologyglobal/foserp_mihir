/**
 * Phase 2 shell for Role Builder (full guided wizard = Phase 5).
 * Today: identity fields + module permission matrix.
 */
import type { ReactNode } from 'react'
import { AdminPermissionMatrix, type AdminPermissionPreset } from './AdminPermissionMatrix'
import type { AdminPermission } from '../../types/admin'

export function AdminRoleBuilder({
  catalog,
  selected,
  onToggle,
  onToggleModule,
  onApplyPreset,
  identitySlot,
  footer,
  readOnly,
}: {
  catalog: AdminPermission[]
  selected: Set<string>
  onToggle: (name: string) => void
  onToggleModule: (names: string[], checked: boolean) => void
  onApplyPreset?: (module: string, names: string[], preset: AdminPermissionPreset) => void
  identitySlot?: ReactNode
  footer?: ReactNode
  readOnly?: boolean
}) {
  return (
    <div className="space-y-4">
      {identitySlot}
      <div>
        <h3 className="text-sm font-semibold text-erp-text">Module permissions</h3>
        <p className="mt-0.5 text-xs text-erp-muted">
          Grouped by module. Use View Only / No Access presets, then refine. Business labels show first; technical keys
          remain in the detail line.
        </p>
      </div>
      <AdminPermissionMatrix
        catalog={catalog}
        selected={selected}
        onToggle={onToggle}
        onToggleModule={onToggleModule}
        onApplyPreset={onApplyPreset}
        readOnly={readOnly}
      />
      {footer}
    </div>
  )
}

/**
 * Phase 2 placeholder — prefer AdminEffectiveAccessPanel on user detail (Phase 7).
 */
export function AdminEffectiveAccessPlaceholder({ userName }: { userName?: string }) {
  return (
    <div className="rounded-xl border border-dashed border-erp-border bg-erp-surface-alt/50 px-4 py-6 text-center">
      <p className="text-sm font-medium text-erp-text">
        Effective access{userName ? ` for ${userName}` : ''}
      </p>
      <p className="mt-1 text-xs text-erp-muted">
        Open the user detail Effective Access panel for role + scope + responsibility explain (API mode).
      </p>
    </div>
  )
}

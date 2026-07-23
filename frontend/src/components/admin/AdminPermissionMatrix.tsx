import { useMemo, useState } from 'react'
import { Checkbox } from '../forms/Inputs'
import { ErpCardSection } from '../erp/card-form'
import { Badge } from '../ui/Badge'
import type { AdminPermission } from '../../types/admin'
import { AdminSensitivePermissionBadge } from './AdminStatusBadge'
import { cn } from '../../utils/cn'

/** Permission names treated as sensitive for Role Builder warnings (Phase 2 labels). */
export const ADMIN_SENSITIVE_PERMISSION_PREFIXES = [
  'tenant.manage',
  'tenant.create',
  'tenant.delete',
  'user.delete',
  'role.delete',
  'finance.',
  'accounting.',
] as const

export function isAdminSensitivePermission(name: string): boolean {
  return ADMIN_SENSITIVE_PERMISSION_PREFIXES.some(
    (p) => name === p || (p.endsWith('.') && name.startsWith(p)) || name.includes('.reverse') || name.includes('.post'),
  )
}

function groupPermissionsByModule(catalog: AdminPermission[]) {
  const groups = new Map<string, AdminPermission[]>()
  for (const perm of catalog) {
    const list = groups.get(perm.module) ?? []
    list.push(perm)
    groups.set(perm.module, list)
  }
  return [...groups.entries()]
    .map(([module, permissions]) => ({
      module,
      permissions: permissions.slice().sort((a, b) => a.name.localeCompare(b.name)),
    }))
    .sort((a, b) => a.module.localeCompare(b.module))
}

export function adminModuleLabel(module: string): string {
  const labels: Record<string, string> = {
    tenant: 'Tenant Administration',
    user: 'User Administration',
    role: 'Role Administration',
    organisation: 'Organisation',
    department: 'Departments',
    scope: 'Data Scopes',
    responsibility: 'Responsibilities',
    access: 'Access Review',
    security: 'Security',
    module: 'Module Access',
    crm: 'CRM',
    master: 'Master Data',
    purchase: 'Purchase',
    inventory: 'Inventory',
    manufacturing: 'Manufacturing',
    finance: 'Accounting',
    quality: 'Quality',
    dispatch: 'Dispatch',
    settings: 'Settings',
  }
  return labels[module] ?? module.charAt(0).toUpperCase() + module.slice(1)
}

/** Friendly label for a technical permission key. */
export function adminPermissionDisplayLabel(name: string, description?: string | null): string {
  if (description?.trim()) return description.trim()
  const parts = name.split('.')
  if (parts.length < 2) return name
  return parts
    .slice(1)
    .map((p) => p.replace(/_/g, ' '))
    .join(' · ')
    .replace(/\b\w/g, (c) => c.toUpperCase())
}

export type AdminPermissionPreset = 'none' | 'view' | 'custom'

export function AdminPermissionMatrix({
  catalog,
  selected,
  onToggle,
  onToggleModule,
  onApplyPreset,
  readOnly,
  className,
}: {
  catalog: AdminPermission[]
  selected: Set<string>
  onToggle: (name: string) => void
  onToggleModule: (names: string[], checked: boolean) => void
  /** Optional: apply module preset (none / view-only). */
  onApplyPreset?: (module: string, names: string[], preset: AdminPermissionPreset) => void
  readOnly?: boolean
  className?: string
}) {
  const groups = useMemo(() => groupPermissionsByModule(catalog), [catalog])
  const [expandedSensitive, setExpandedSensitive] = useState(true)
  const sensitiveSelected = useMemo(
    () => [...selected].filter(isAdminSensitivePermission),
    [selected],
  )

  if (groups.length === 0) {
    return <p className="text-sm text-erp-muted">No permissions available.</p>
  }

  return (
    <div className={cn('space-y-3', className)}>
      {sensitiveSelected.length > 0 ? (
        <div className="rounded-xl border border-red-200 bg-red-50/80 px-4 py-3">
          <button
            type="button"
            className="flex w-full items-center justify-between text-left"
            onClick={() => setExpandedSensitive((v) => !v)}
          >
            <div>
              <p className="text-sm font-semibold text-red-800">Sensitive access</p>
              <p className="text-xs text-red-700/90">
                {sensitiveSelected.length} permission{sensitiveSelected.length === 1 ? '' : 's'} can change security,
                postings, or platform scope.
              </p>
            </div>
            <AdminSensitivePermissionBadge />
          </button>
          {expandedSensitive ? (
            <ul className="mt-2 space-y-1 border-t border-red-200/80 pt-2">
              {sensitiveSelected.map((name) => (
                <li key={name} className="font-mono text-xs text-red-900">
                  {name}
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}

      {groups.map((group) => {
        const names = group.permissions.map((p) => p.name)
        const selectedCount = names.filter((n) => selected.has(n)).length
        const allChecked = names.length > 0 && names.every((n) => selected.has(n))
        const someChecked = !allChecked && selectedCount > 0
        const sensitiveCount = names.filter((n) => selected.has(n) && isAdminSensitivePermission(n)).length
        return (
          <ErpCardSection
            key={group.module}
            title={adminModuleLabel(group.module)}
            subtitle={`${selectedCount} of ${names.length} selected`}
            collapsible
            defaultOpen={group.module === 'user' || group.module === 'role' || group.module === 'organisation'}
            columns={1}
          >
            <div className="mb-3 flex flex-wrap items-center gap-2">
              {!readOnly && (
                <label className="inline-flex items-center gap-2 text-sm text-erp-text">
                  <Checkbox
                    checked={allChecked}
                    indeterminate={someChecked}
                    onChange={(e) => onToggleModule(names, e.target.checked)}
                  />
                  Select all in module
                </label>
              )}
              {!readOnly && onApplyPreset ? (
                <div className="ml-auto flex flex-wrap gap-1.5">
                  {(
                    [
                      ['none', 'No Access'],
                      ['view', 'View Only'],
                    ] as const
                  ).map(([preset, label]) => (
                    <button
                      key={preset}
                      type="button"
                      className="rounded-md border border-erp-border bg-erp-surface px-2 py-1 text-xs font-medium text-erp-text hover:bg-erp-surface-alt"
                      onClick={() => onApplyPreset(group.module, names, preset)}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              ) : null}
              {sensitiveCount > 0 ? <Badge color="red">{sensitiveCount} sensitive</Badge> : null}
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              {group.permissions.map((perm) => {
                const checked = selected.has(perm.name)
                const sensitive = isAdminSensitivePermission(perm.name)
                return (
                  <label
                    key={perm.id}
                    className={cn(
                      'flex items-start gap-2 rounded-lg border border-erp-border/80 px-3 py-2 text-sm',
                      checked ? 'bg-erp-primary-soft/30' : 'bg-erp-surface',
                      readOnly && 'opacity-80',
                    )}
                  >
                    {!readOnly ? (
                      <Checkbox
                        className="mt-0.5"
                        checked={checked}
                        onChange={() => onToggle(perm.name)}
                      />
                    ) : null}
                    <span className="min-w-0">
                      <span className="flex flex-wrap items-center gap-1.5 font-medium text-erp-text">
                        {adminPermissionDisplayLabel(perm.name, perm.description)}
                        {sensitive ? <AdminSensitivePermissionBadge /> : null}
                      </span>
                      <span className="mt-0.5 block font-mono text-[11px] text-erp-muted" title={perm.name}>
                        {perm.name}
                      </span>
                    </span>
                  </label>
                )
              })}
            </div>
          </ErpCardSection>
        )
      })}
    </div>
  )
}

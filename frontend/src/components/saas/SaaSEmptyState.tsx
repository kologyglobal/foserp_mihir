import type { LucideIcon } from 'lucide-react'

export function SaaSEmptyState({
  icon: Icon,
  title,
  insight,
  healthNote,
}: {
  icon?: LucideIcon
  title: string
  insight: string
  healthNote?: string
}) {
  return (
    <div className="saas-empty">
      {Icon && (
        <div className="mx-auto mb-2 flex h-10 w-10 items-center justify-center rounded-full bg-[var(--saas-primary-soft)] text-[var(--saas-primary)]">
          <Icon className="h-5 w-5" />
        </div>
      )}
      <p className="saas-empty-title">{title}</p>
      <p className="saas-empty-insight">{insight}</p>
      {healthNote && <p className="mt-2 text-xs font-medium text-[var(--saas-success)]">{healthNote}</p>}
    </div>
  )
}

import type { ReactNode } from 'react'
import { OperationalPageShell } from '@/components/design-system/OperationalPageShell'
import { ErpCommandBar, type ErpCommandAction } from '@/components/erp/ErpCommandBar'
import type { EnterpriseKpiItem } from '@/design-system/enterprise/enterpriseKpiTypes'

export type ProductionPageHeaderProps = {
  title: string
  description?: string
  breadcrumbs?: { label: string; to?: string }[]
  favoritePath?: string
  primaryAction?: ErpCommandAction
  secondaryActions?: ErpCommandAction[]
  /** Extra actions slot (e.g. custom buttons beside command bar) */
  actions?: ReactNode
  kpiStrip?: EnterpriseKpiItem[]
  filterBar?: ReactNode
  children: ReactNode
  className?: string
  backLink?: { to: string; label: string }
  /** Header badge text — defaults to "Manufacturing"; override for cross-module ops pages that reuse this shell. */
  badge?: string
}

/**
 * Thin Production list/ops page wrapper — composes OperationalPageShell + ErpCommandBar.
 * Does not invent Card/Button/Badge primitives.
 */
export function ProductionPageHeader({
  title,
  description,
  breadcrumbs,
  favoritePath,
  primaryAction,
  secondaryActions,
  actions,
  kpiStrip,
  filterBar,
  children,
  className,
  backLink,
  badge = 'Manufacturing',
}: ProductionPageHeaderProps) {
  const commandBar =
    primaryAction || (secondaryActions && secondaryActions.length > 0) ? (
      <ErpCommandBar inline sticky={false} primaryAction={primaryAction} secondaryActions={secondaryActions} />
    ) : undefined

  return (
    <OperationalPageShell
      variant="dynamics"
      layout="enterprise"
      badge={badge}
      title={title}
      description={description}
      showDescription={Boolean(description)}
      breadcrumbs={breadcrumbs ?? [{ label: 'Manufacturing & Production', to: '/manufacturing' }, { label: title }]}
      autoBreadcrumbs={false}
      favoritePath={favoritePath}
      actions={actions}
      commandBar={commandBar}
      kpiStrip={kpiStrip}
      filterBar={filterBar}
      backLink={backLink}
      className={className}
    >
      {children}
    </OperationalPageShell>
  )
}

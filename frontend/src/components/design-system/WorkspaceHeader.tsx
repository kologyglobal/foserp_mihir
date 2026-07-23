import type { ReactNode } from 'react'
import { useEffect, useMemo } from 'react'
import { useLocation } from 'react-router-dom'
import { useWorkspacePageHeaderSetters } from '../../context/WorkspacePageHeaderContext'
import { cn } from '../../utils/cn'

interface WorkspaceHeaderProps {
  title: string
  subtitle?: string
  breadcrumbs?: { label: string; to?: string }[]
  traffic?: 'green' | 'amber' | 'red'
  actions?: ReactNode
  commandBar?: ReactNode
  className?: string
  badge?: string
}

/**
 * Legacy workspace header — publishes into sticky chrome; no in-page title band.
 */
export function WorkspaceHeader({
  title,
  subtitle: _subtitle,
  breadcrumbs,
  traffic: _traffic,
  actions,
  commandBar,
  className,
  badge,
}: WorkspaceHeaderProps) {
  const { pathname } = useLocation()
  const setHeader = useWorkspacePageHeaderSetters()?.setHeader

  const headerMeta = useMemo(
    () => ({
      breadcrumbs,
      title,
      badge,
      favoritePath: pathname,
    }),
    [breadcrumbs, title, badge, pathname],
  )

  useEffect(() => {
    if (!setHeader) return
    setHeader({
      meta: headerMeta,
      commandBar: commandBar ?? null,
      actions: actions ?? null,
    })
  }, [setHeader, headerMeta, commandBar, actions])

  useEffect(() => {
    if (!setHeader) return
    return () => setHeader({ meta: null, commandBar: null, actions: null })
  }, [setHeader])

  if (!commandBar || setHeader) {
    // Actions/title live in WorkspaceUnifiedHeader; nothing local unless no provider
    if (setHeader) return null
  }

  return (
    <div className={cn('erp-page-hero erp-page-hero--workspace-merged', className)}>
      {commandBar ? (
        <div className="border-b border-erp-border px-2.5 py-1">{commandBar}</div>
      ) : null}
      {actions && !setHeader ? (
        <div className="flex flex-wrap items-center justify-end gap-1.5 px-2.5 py-1">{actions}</div>
      ) : null}
    </div>
  )
}

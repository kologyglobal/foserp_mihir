import { ArrowLeft } from 'lucide-react'
import { Link } from 'react-router-dom'
import { cn } from '../../utils/cn'
import { useWorkspacePageHeader } from '../../context/WorkspacePageHeaderContext'

export type PageBackLinkProps = {
  /** Register / parent list route */
  to: string
  /** e.g. "Back to RFQs" */
  label: string
  className?: string
  /** Render even when the workspace header already shows navigable breadcrumbs. */
  force?: boolean
}

/**
 * In-page back control — place at the top of view/detail content.
 * Prefer this over burying Back inside the command bar / footer actions.
 * Self-suppresses when the workspace unified header chrome is active
 * (breadcrumbs / sticky record header), so pages never show a duplicate
 * Back control. Standalone surfaces (e.g. print previews) keep it.
 */
export function PageBackLink({ to, label, className, force = false }: PageBackLinkProps) {
  const header = useWorkspacePageHeader()
  if (header?.meta && !force) return null
  return (
    <div className={cn('erp-page-back print:hidden', className)}>
      <Link to={to} className="erp-page-back__link">
        <ArrowLeft className="erp-page-back__icon" aria-hidden />
        <span>{label}</span>
      </Link>
    </div>
  )
}

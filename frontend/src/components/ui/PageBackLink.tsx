import { ArrowLeft } from 'lucide-react'
import { Link } from 'react-router-dom'
import { cn } from '../../utils/cn'

export type PageBackLinkProps = {
  /** Register / parent list route */
  to: string
  /** e.g. "Back to RFQs" */
  label: string
  className?: string
}

/**
 * In-page back control — place at the top of view/detail content.
 * Prefer this over burying Back inside the command bar / footer actions.
 */
export function PageBackLink({ to, label, className }: PageBackLinkProps) {
  return (
    <div className={cn('erp-page-back print:hidden', className)}>
      <Link to={to} className="erp-page-back__link">
        <ArrowLeft className="erp-page-back__icon" aria-hidden />
        <span>{label}</span>
      </Link>
    </div>
  )
}

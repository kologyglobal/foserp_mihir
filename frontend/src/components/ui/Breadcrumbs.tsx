import { ChevronRight } from 'lucide-react'
import { Link } from 'react-router-dom'
import { cn } from '../../utils/cn'

export interface BreadcrumbItem {
  label: string
  to?: string
}

interface BreadcrumbsProps {
  items: BreadcrumbItem[]
  className?: string
}

export function Breadcrumbs({ items, className }: BreadcrumbsProps) {
  return (
    <nav aria-label="Breadcrumb" className={cn('flex items-center gap-1 text-[12px]', className)}>
      {items.map((item, i) => {
        const isLast = i === items.length - 1
        return (
          <span key={`${item.label}-${i}`} className="flex items-center gap-1">
            {i > 0 && <ChevronRight className="h-3 w-3 text-erp-muted/70" />}
            {item.to && !isLast ? (
              <Link
                to={item.to}
                className="font-medium text-erp-muted transition-colors hover:text-erp-primary"
              >
                {item.label}
              </Link>
            ) : (
              <span className={cn(isLast ? 'font-semibold text-erp-text' : 'font-medium text-erp-muted')}>
                {item.label}
              </span>
            )}
          </span>
        )
      })}
    </nav>
  )
}

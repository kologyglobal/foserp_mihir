import { Lightbulb } from 'lucide-react'
import type { CompanyPortfolioInsight } from '../../utils/crmCompaniesPortfolio'
import { cn } from '../../utils/cn'

interface CrmCompaniesInsightStripProps {
  insights: CompanyPortfolioInsight[]
  onInsightClick: (insight: CompanyPortfolioInsight) => void
  className?: string
}

/** Clickable portfolio insights below the filter bar */
export function CrmCompaniesInsightStrip({ insights, onInsightClick, className }: CrmCompaniesInsightStripProps) {
  if (insights.length === 0) return null

  return (
    <div className={cn('crm-companies-insight-strip', className)} role="region" aria-label="Portfolio insights">
      <Lightbulb className="crm-companies-insight-strip__icon" aria-hidden />
      <div className="crm-companies-insight-strip__items">
        {insights.map((insight) => (
          <button
            key={insight.id}
            type="button"
            className="crm-companies-insight-strip__item"
            onClick={() => onInsightClick(insight)}
          >
            {insight.message}
          </button>
        ))}
      </div>
    </div>
  )
}

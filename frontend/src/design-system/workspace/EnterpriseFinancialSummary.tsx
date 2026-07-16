import { cn } from '../../utils/cn'
import type { EnterpriseFinancialLine } from './types'

/** Sticky financial summary for quotation / SO / opportunity workspaces */
export function EnterpriseFinancialSummary({
  title = 'Summary',
  lines,
}: {
  title?: string
  lines: EnterpriseFinancialLine[]
}) {
  if (!lines.length) return null

  return (
    <div className="ent-ws-financial" aria-label={title}>
      <p className="ent-ws-financial__title">{title}</p>
      <dl className="ent-ws-financial__list">
        {lines.map((line) => (
          <div
            key={line.label}
            className={cn(
              'ent-ws-financial__row',
              line.highlight && 'ent-ws-financial__row--highlight',
            )}
          >
            <dt>{line.label}</dt>
            <dd className={cn(line.negative && 'ent-ws-financial__neg')}>{line.value}</dd>
          </div>
        ))}
      </dl>
    </div>
  )
}

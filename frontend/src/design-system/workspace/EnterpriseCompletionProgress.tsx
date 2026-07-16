import type { EnterpriseCompletionItem } from './types'

export function EnterpriseCompletionProgress({
  percent,
  items,
  label = 'Completion',
}: {
  percent: number
  items: EnterpriseCompletionItem[]
  label?: string
}) {
  const remaining = items.filter((i) => !i.done)
  const clamped = Math.max(0, Math.min(100, percent))

  return (
    <div className="ent-ws-completion" aria-label={`${label} ${clamped}%`}>
      <div className="ent-ws-completion__head">
        <span className="ent-ws-completion__label">{label}</span>
        <span className="ent-ws-completion__pct">{clamped}%</span>
      </div>
      <div className="ent-ws-completion__track" role="progressbar" aria-valuenow={clamped} aria-valuemin={0} aria-valuemax={100}>
        <div className="ent-ws-completion__bar" style={{ width: `${clamped}%` }} />
      </div>
      {remaining.length > 0 ? (
        <div className="ent-ws-completion__remaining">
          <p className="ent-ws-completion__remaining-label">Remaining</p>
          <ul className="ent-ws-completion__list">
            {remaining.slice(0, 4).map((item) => (
              <li key={item.id}>
                {item.onClick ? (
                  <button type="button" className="ent-ws-completion__item ent-ws-completion__item--action" onClick={item.onClick}>
                    {item.label}
                  </button>
                ) : (
                  <span className="ent-ws-completion__item">{item.label}</span>
                )}
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <p className="ent-ws-completion__done">All essential fields complete</p>
      )}
    </div>
  )
}

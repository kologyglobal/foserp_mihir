import { Link } from 'react-router-dom'
import type { EnterpriseRelatedRecord } from './types'

export function EnterpriseRelatedRecords({
  title,
  records,
  emptyMessage = 'No related records',
}: {
  title: string
  records: EnterpriseRelatedRecord[]
  emptyMessage?: string
}) {
  return (
    <div className="ent-ws-related">
      <p className="ent-ws-related__title">{title}</p>
      {records.length === 0 ? (
        <p className="ent-ws-related__empty">{emptyMessage}</p>
      ) : (
        <ul className="ent-ws-related__list">
          {records.map((record) => (
            <li key={record.id} className="ent-ws-related__item">
              {record.href ? (
                <Link to={record.href} className="ent-ws-related__link">
                  <span className="ent-ws-related__label">{record.label}</span>
                  {record.subtitle ? <span className="ent-ws-related__sub">{record.subtitle}</span> : null}
                </Link>
              ) : (
                <div>
                  <span className="ent-ws-related__label">{record.label}</span>
                  {record.subtitle ? <span className="ent-ws-related__sub">{record.subtitle}</span> : null}
                </div>
              )}
              {record.value ? <span className="ent-ws-related__value">{record.value}</span> : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

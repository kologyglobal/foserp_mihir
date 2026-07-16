import { cn } from '../../utils/cn'
import type {
  EnterpriseDocumentFact,
  EnterpriseDocumentIdentity,
  EnterpriseWorkspaceMetaItem,
} from './types'

const toneClass: Record<NonNullable<EnterpriseWorkspaceMetaItem['tone']>, string> = {
  neutral: 'ent-ws-doc-header__status--neutral',
  info: 'ent-ws-doc-header__status--info',
  success: 'ent-ws-doc-header__status--success',
  warning: 'ent-ws-doc-header__status--warning',
  critical: 'ent-ws-doc-header__status--critical',
}

export interface EnterpriseDocumentHeaderProps {
  identity: EnterpriseDocumentIdentity
  facts?: EnterpriseDocumentFact[]
  metaChips?: string[]
  className?: string
}

/**
 * Dense BC-inspired document hierarchy — module label, title + status,
 * primary label:value facts, and secondary metadata chips.
 * Prefer this over fragmented `EnterpriseDocumentStrip` highlight boxes.
 */
export function EnterpriseDocumentHeader({
  identity,
  facts = [],
  metaChips = [],
  className,
}: EnterpriseDocumentHeaderProps) {
  const statusTone = identity.statusTone ?? 'info'

  return (
    <section
      className={cn('ent-ws-doc-header', className)}
      role="region"
      aria-label="Document header"
    >
      <div className="ent-ws-doc-header__identity">
        {identity.moduleLabel ? (
          <p className="ent-ws-doc-header__module">{identity.moduleLabel}</p>
        ) : null}
        <div className="ent-ws-doc-header__title-row">
          <h2 className="ent-ws-doc-header__title">{identity.title}</h2>
          {identity.status ? (
            <span className={cn('ent-ws-doc-header__status', toneClass[statusTone])}>
              {identity.status}
            </span>
          ) : null}
        </div>
      </div>

      {facts.length > 0 ? (
        <dl className="ent-ws-doc-header__facts">
          {facts.map((fact) => (
            <div key={fact.label} className="ent-ws-doc-header__fact">
              <dt className="ent-ws-doc-header__fact-label">{fact.label}</dt>
              <dd
                className={cn(
                  'ent-ws-doc-header__fact-value',
                  fact.muted && 'ent-ws-doc-header__fact-value--muted',
                  fact.emphasize && 'ent-ws-doc-header__fact-value--emphasize',
                )}
              >
                {fact.value || '—'}
              </dd>
            </div>
          ))}
        </dl>
      ) : null}

      {metaChips.length > 0 ? (
        <ul className="ent-ws-doc-header__chips" aria-label="Document metadata">
          {metaChips.filter(Boolean).map((chip) => (
            <li key={chip} className="ent-ws-doc-header__chip">
              {chip}
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  )
}

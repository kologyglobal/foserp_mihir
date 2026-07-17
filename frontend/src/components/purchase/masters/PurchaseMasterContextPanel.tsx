import { Link } from 'react-router-dom'
import { Lightbulb, Sparkles } from 'lucide-react'
import type { PurchaseMasterCatalogItem, PurchaseMasterEntry } from '../../../types/purchaseMasters'
import { countPurchaseMasterUsage, usedInRoutes } from '../../../utils/purchaseMasterUtils'
import { formatDateTime } from '../../../utils/dates/format'
import { PurchaseAiInsightsShell } from '../PurchaseAiInsightsPanel'

interface PurchaseMasterContextPanelProps {
  catalog: PurchaseMasterCatalogItem
  entry?: PurchaseMasterEntry
  pendingCreatedBy?: string
}

export function PurchaseMasterContextPanel({
  catalog,
  entry,
  pendingCreatedBy,
}: PurchaseMasterContextPanelProps) {
  const staticUsedIn = usedInRoutes(catalog.usedIn)
  const usageCount = entry ? countPurchaseMasterUsage(entry) : 0

  return (
    <aside className="min-w-0" aria-label={`${catalog.title} insights`}>
      <PurchaseAiInsightsShell
        title="Master Insights"
        subtitle="AI suggested context for this purchase master."
      >
        <section className="purchase-ai-panel__section">
          <p className="purchase-ai-panel__section-title">Purpose</p>
          <p className="purchase-ai-panel__prose">{catalog.purpose ?? catalog.description}</p>
        </section>

        <section className="purchase-ai-panel__section">
          <p className="purchase-ai-panel__section-title">Used in</p>
          <ul className="purchase-ai-panel__link-list">
            {staticUsedIn.map((u) => (
              <li key={u.route}>
                <Link to={u.route} className="purchase-ai-panel__link">
                  {u.label}
                </Link>
              </li>
            ))}
          </ul>
          {usageCount > 0 ? (
            <p className="purchase-ai-panel__callout purchase-ai-panel__callout--warning">
              Referenced in {usageCount} purchase document(s).
            </p>
          ) : null}
        </section>

        {entry || pendingCreatedBy ? (
          <section className="purchase-ai-panel__section">
            <p className="purchase-ai-panel__section-title">Record info</p>
            <dl className="purchase-ai-panel__metrics">
              <div className="purchase-ai-panel__metric">
                <dt>Created on</dt>
                <dd>
                  {entry ? formatDateTime(entry.createdAt) : formatDateTime(new Date().toISOString())}
                </dd>
              </div>
              <div className="purchase-ai-panel__metric">
                <dt>Created by</dt>
                <dd>{entry?.createdBy ?? pendingCreatedBy ?? '—'}</dd>
              </div>
              {entry?.updatedAt ? (
                <div className="purchase-ai-panel__metric">
                  <dt>Last modified</dt>
                  <dd>
                    {formatDateTime(entry.updatedAt)}
                    {entry.modifiedBy ? ` · ${entry.modifiedBy}` : ''}
                  </dd>
                </div>
              ) : null}
            </dl>
          </section>
        ) : (
          <section className="purchase-ai-panel__section">
            <p className="purchase-ai-panel__section-title">Setup tip</p>
            <div className="purchase-ai-panel__tip">
              <span className="purchase-ai-panel__tip-icon" aria-hidden>
                <Lightbulb className="h-4 w-4" />
              </span>
              <p>
                Active values appear in PR, RFQ, PO, and GRN forms. Use Import for bulk CSV setup.
              </p>
            </div>
          </section>
        )}

        <div className="purchase-ai-panel__footer-hint">
          <Sparkles className="h-3.5 w-3.5 shrink-0" aria-hidden />
          Keep codes stable — changing active values can affect open documents.
        </div>
      </PurchaseAiInsightsShell>
    </aside>
  )
}

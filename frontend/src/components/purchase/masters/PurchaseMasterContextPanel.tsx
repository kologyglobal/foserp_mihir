import { Link } from 'react-router-dom'
import type { PurchaseMasterCatalogItem, PurchaseMasterEntry } from '../../../types/purchaseMasters'
import { countPurchaseMasterUsage, usedInRoutes } from '../../../utils/purchaseMasterUtils'
import { formatDateTime } from '../../../utils/dates/format'
interface PurchaseMasterContextPanelProps {
  catalog: PurchaseMasterCatalogItem
  entry?: PurchaseMasterEntry
  pendingCreatedBy?: string
}

export function PurchaseMasterContextPanel({ catalog, entry, pendingCreatedBy }: PurchaseMasterContextPanelProps) {
  const staticUsedIn = usedInRoutes(catalog.usedIn)
  const usageCount = entry ? countPurchaseMasterUsage(entry) : 0

  return (
    <aside className="space-y-4">
      <section className="rounded-lg border border-erp-border bg-erp-surface p-4">
        <h3 className="text-[11px] font-semibold uppercase tracking-wide text-erp-muted">Purpose</h3>
        <p className="mt-2 text-[13px] leading-relaxed text-erp-text">
          {catalog.purpose ?? catalog.description}
        </p>
      </section>

      <section className="rounded-lg border border-erp-border bg-erp-surface p-4">
        <h3 className="text-[11px] font-semibold uppercase tracking-wide text-erp-muted">Used In</h3>
        <ul className="mt-2 space-y-1.5">
          {staticUsedIn.map((u) => (
            <li key={u.route}>
              <Link to={u.route} className="text-[13px] font-medium text-erp-primary hover:underline">{u.label}</Link>
            </li>
          ))}
        </ul>
        {usageCount > 0 ? (
          <p className="mt-3 border-t border-erp-border pt-3 text-[12px] text-amber-800">
            Referenced in {usageCount} purchase document(s).
          </p>
        ) : null}
      </section>

      {entry || pendingCreatedBy ? (
        <section className="rounded-lg border border-erp-border bg-erp-surface p-4">
          <h3 className="text-[11px] font-semibold uppercase tracking-wide text-erp-muted">Record Info</h3>
          <dl className="mt-2 space-y-2 text-[12px]">
            <div className="flex justify-between gap-2">
              <dt className="text-erp-muted">Created on</dt>
              <dd className="font-medium text-erp-text">
                {entry ? formatDateTime(entry.createdAt) : formatDateTime(new Date().toISOString())}
              </dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-erp-muted">Created by</dt>
              <dd className="font-medium text-erp-text">{entry?.createdBy ?? pendingCreatedBy ?? '—'}</dd>
            </div>
            {entry?.updatedAt ? (
              <div className="flex justify-between gap-2">
                <dt className="text-erp-muted">Last modified</dt>
                <dd className="text-right font-medium text-erp-text">
                  {formatDateTime(entry.updatedAt)}
                  {entry.modifiedBy ? ` · ${entry.modifiedBy}` : ''}
                </dd>
              </div>
            ) : null}
          </dl>
        </section>
      ) : (
        <section className="rounded-lg border border-erp-border bg-erp-surface-alt/50 p-4">
          <h3 className="text-[11px] font-semibold uppercase tracking-wide text-erp-muted">Setup Tip</h3>
          <p className="mt-2 text-[12px] text-erp-muted">
            Active values appear in PR, RFQ, PO, and GRN forms. Use Import for bulk CSV setup.
          </p>
        </section>
      )}
    </aside>
  )
}

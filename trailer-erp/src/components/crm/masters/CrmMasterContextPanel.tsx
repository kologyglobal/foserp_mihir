import { Link } from 'react-router-dom'
import type { CrmMasterCatalogItem, CrmMasterEntry } from '@/types/crmMasters'
import { getMasterUsageLinks, usedInRoutes, type CrmMasterUsageLink } from '@/utils/crmMasterUtils'
import { resolveAuditActorName } from '@/utils/masterAudit'
import { formatDateTime } from '@/utils/dates/format'

interface CrmMasterContextPanelProps {
  catalog: CrmMasterCatalogItem
  entry?: CrmMasterEntry
}

export function CrmMasterContextPanel({ catalog, entry }: CrmMasterContextPanelProps) {
  const usageLinks = entry ? getMasterUsageLinks(entry) : []
  const staticUsedIn = usedInRoutes(catalog.usedIn)

  return (
    <aside className="crm-master-context-panel space-y-4">
      <section className="rounded-lg border border-erp-border bg-erp-surface p-4">
        <h3 className="text-[11px] font-semibold uppercase tracking-wide text-erp-muted">Purpose</h3>
        <p className="mt-2 text-[13px] leading-relaxed text-erp-text">
          {catalog.purpose ?? catalog.description}
        </p>
      </section>

      <section className="rounded-lg border border-erp-border bg-erp-surface p-4">
        <h3 className="text-[11px] font-semibold uppercase tracking-wide text-erp-muted">Used In</h3>
        <ul className="mt-2 space-y-1.5">
          {staticUsedIn.map((u: { label: string; route: string }) => (
            <li key={u.route}>
              <Link to={u.route} className="text-[13px] font-medium text-erp-primary hover:underline">{u.label}</Link>
            </li>
          ))}
        </ul>
        {usageLinks.length > 0 ? (
          <div className="mt-3 border-t border-erp-border pt-3">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-erp-muted">Live usage</p>
            <ul className="mt-1.5 space-y-1">
              {usageLinks.map((l: CrmMasterUsageLink) => (
                <li key={l.route}>
                  <Link to={l.route} className="text-[12px] text-erp-primary hover:underline">
                    {l.label} <span className="font-semibold">({l.count})</span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </section>

      {entry ? (
        <>
          <section className="rounded-lg border border-erp-border bg-erp-surface p-4">
            <h3 className="text-[11px] font-semibold uppercase tracking-wide text-erp-muted">Record Info</h3>
            <dl className="mt-2 space-y-2 text-[12px]">
              <div className="flex justify-between gap-2">
                <dt className="text-erp-muted">Created By</dt>
                <dd className="font-medium text-erp-text">
                  {resolveAuditActorName(entry.createdByName, entry.createdBy)}
                </dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-erp-muted">Modified By</dt>
                <dd className="font-medium text-erp-text">
                  {resolveAuditActorName(entry.modifiedByName, entry.modifiedBy, entry.createdByName, entry.createdBy)}
                </dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-erp-muted">Last Modified</dt>
                <dd className="font-medium text-erp-text">{formatDateTime(entry.updatedAt)}</dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-erp-muted">Created</dt>
                <dd className="font-medium text-erp-text">{formatDateTime(entry.createdAt)}</dd>
              </div>
            </dl>
          </section>

          <section id="crm-master-audit" className="rounded-lg border border-erp-border bg-erp-surface p-4">
            <h3 className="text-[11px] font-semibold uppercase tracking-wide text-erp-muted">Audit History</h3>
            {(entry.auditHistory?.length ?? 0) > 0 ? (
              <ul className="mt-2 max-h-48 space-y-2 overflow-y-auto">
                {[...(entry.auditHistory ?? [])].reverse().slice(0, 8).map((ev, i) => (
                  <li key={`${ev.at}-${i}`} className="text-[11px] text-erp-muted">
                    <span className="font-semibold capitalize text-erp-text">{ev.action}</span>
                    {' · '}{formatDateTime(ev.at)}
                    {ev.detail ? <span className="block text-erp-muted">{ev.detail}</span> : null}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-2 text-[12px] text-erp-muted">No audit events recorded yet.</p>
            )}
          </section>
        </>
      ) : (
        <section className="rounded-lg border border-erp-border bg-erp-surface-alt/50 p-4">
          <h3 className="text-[11px] font-semibold uppercase tracking-wide text-erp-muted">Next Flow</h3>
          <p className="mt-2 text-[12px] text-erp-muted">
            Save the record to activate it in CRM transactions. Use Import for bulk setup from CSV.
          </p>
        </section>
      )}
    </aside>
  )
}

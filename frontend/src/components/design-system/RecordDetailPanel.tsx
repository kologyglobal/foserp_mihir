import { Link } from 'react-router-dom'
import { MessageSquare, X } from 'lucide-react'
import { useUIStore } from '../../store/uiStore'
import { cn } from '../../utils/cn'

/** Right-side record detail panel — no route change */
export function RecordDetailPanel() {
  const open = useUIStore((s) => s.detailPanelOpen)
  const panel = useUIStore((s) => s.detailPanel)
  const closeDetailPanel = useUIStore((s) => s.closeDetailPanel)

  if (!open || !panel) return null

  return (
    <>
      <div
        className="erp-detail-scrim fixed inset-0 z-40 bg-erp-shell/30 backdrop-blur-[1px] transition-opacity"
        onClick={closeDetailPanel}
        aria-hidden
      />
      <aside className="erp-detail-panel fixed right-0 top-[var(--d365-suite-height)] z-50 flex h-[calc(100vh-var(--d365-suite-height))] w-full max-w-md flex-col border-l border-erp-border bg-erp-surface shadow-erp-lg">
        <div className="flex items-start justify-between gap-3 border-b border-erp-border bg-gradient-to-r from-erp-surface-alt/90 to-erp-surface px-4 py-3">
          <div className="min-w-0">
            <p className="text-[11px] font-bold uppercase tracking-widest text-erp-muted">Quick View</p>
            <h2 className="truncate text-[16px] font-semibold text-erp-text">{panel.title}</h2>
            {panel.subtitle && <p className="mt-0.5 text-[12px] text-erp-muted">{panel.subtitle}</p>}
          </div>
          <button
            type="button"
            onClick={closeDetailPanel}
            className="rounded-md p-1.5 text-erp-muted transition-colors hover:bg-erp-surface-alt hover:text-erp-text"
            aria-label="Close panel"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          <section className="border-b border-erp-border px-4 py-4">
            <h3 className="mb-3 text-[12px] font-bold uppercase tracking-wide text-erp-muted">Summary</h3>
            <dl className="space-y-2">
              {panel.fields.map((f) => (
                <div key={f.label} className="grid grid-cols-[38%_1fr] gap-2 text-[13px]">
                  <dt className="font-medium text-erp-muted">{f.label}</dt>
                  <dd className="font-medium text-erp-text">{f.value}</dd>
                </div>
              ))}
            </dl>
          </section>

          {panel.timeline.length > 0 && (
            <section className="border-b border-erp-border px-4 py-4">
              <h3 className="mb-3 text-[12px] font-bold uppercase tracking-wide text-erp-muted">Activity Timeline</h3>
              <ol className="space-y-3">
                {panel.timeline.map((ev, idx) => (
                  <li key={ev.id} className="relative flex gap-3 pl-1">
                    <span
                      className={cn(
                        'mt-1.5 h-2 w-2 shrink-0 rounded-full ring-2 ring-white',
                        ev.status === 'current' && 'bg-erp-primary shadow-[0_0_0_3px_rgb(29_78_216_/_0.15)]',
                        ev.status === 'done' && 'bg-erp-success',
                        (!ev.status || ev.status === 'pending') && 'bg-erp-border-strong',
                      )}
                    />
                    <div className="min-w-0 flex-1">
                      <p className="text-[13px] font-semibold text-erp-text">{ev.label}</p>
                      <p className="text-[11px] text-erp-muted">{ev.time}{ev.actor ? ` · ${ev.actor}` : ''}</p>
                    </div>
                    {idx < panel.timeline.length - 1 && (
                      <span className="absolute left-[5px] top-5 h-[calc(100%+4px)] w-px bg-erp-border" />
                    )}
                  </li>
                ))}
              </ol>
            </section>
          )}

          {panel.links.length > 0 && (
            <section className="border-b border-erp-border px-4 py-4">
              <h3 className="mb-3 text-[12px] font-bold uppercase tracking-wide text-erp-muted">Related Documents</h3>
              <ul className="space-y-2">
                {panel.links.map((link) => (
                  <li key={`${link.label}-${link.href}`}>
                    <Link
                      to={link.href}
                      onClick={closeDetailPanel}
                      className="block rounded-md border border-erp-border px-3 py-2 text-[13px] font-medium text-erp-primary transition-all hover:border-erp-primary/30 hover:bg-erp-primary-soft"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {panel.aiSummary ? (
            <section className="border-b border-erp-border px-4 py-4">
              <h3 className="mb-2 text-[12px] font-bold uppercase tracking-wide text-erp-muted">AI Summary</h3>
              <p className="rounded-lg border border-erp-border bg-erp-surface-alt px-3 py-3 text-[13px] leading-relaxed text-erp-text">
                {panel.aiSummary}
              </p>
            </section>
          ) : null}

          {panel.attachments && panel.attachments.length > 0 ? (
            <section className="border-b border-erp-border px-4 py-4">
              <h3 className="mb-3 text-[12px] font-bold uppercase tracking-wide text-erp-muted">Attachments</h3>
              <ul className="space-y-2">
                {panel.attachments.map((file) => (
                  <li key={file.name} className="rounded-md border border-erp-border px-3 py-2 text-[13px] text-erp-text">
                    {file.name}
                    {file.size ? <span className="ml-2 text-erp-muted">({file.size})</span> : null}
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          <section className="px-4 py-4">
            <h3 className="mb-2 flex items-center gap-1.5 text-[12px] font-bold uppercase tracking-wide text-erp-muted">
              <MessageSquare className="h-3.5 w-3.5" /> Comments
            </h3>
            <p className="rounded-md border border-dashed border-erp-border bg-erp-surface-alt px-3 py-3 text-[13px] text-erp-muted">
              {panel.comments || 'No comments on this record yet.'}
            </p>
          </section>
        </div>

        {panel.actions && panel.actions.length > 0 ? (
          <div className="border-t border-erp-border bg-erp-surface-alt px-4 py-3">
            <div className="flex flex-wrap gap-2">
              {panel.actions.map((action) => (
                <button
                  key={action.label}
                  type="button"
                  className={cn(
                    'rounded-lg px-3 py-2 text-[13px] font-semibold transition-colors',
                    action.primary
                      ? 'bg-erp-primary text-white hover:opacity-90'
                      : 'border border-erp-border bg-white text-erp-text hover:bg-erp-surface',
                  )}
                  onClick={action.onClick}
                >
                  {action.label}
                </button>
              ))}
            </div>
          </div>
        ) : null}
      </aside>
    </>
  )
}

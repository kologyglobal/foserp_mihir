import type { PageHelpContent } from '../constants/status'
import { ErpPageGuide } from '../../components/erp/ErpPageGuide'
import { cn } from '../../utils/cn'

export interface HelpPanelProps extends PageHelpContent {
  className?: string
  collapsed?: boolean
}

/** Universal help panel — purpose, fields, next process, shortcuts */
export function HelpPanel({
  purpose,
  businessUse,
  requiredFields,
  nextProcess,
  tips,
  bestPractices,
  shortcuts,
  relatedPages,
  className,
}: HelpPanelProps) {
  return (
    <aside className={cn('ds-help-panel rounded-lg border border-[var(--dyn-border)] bg-[var(--dyn-primary-soft)]/40 p-4', className)}>
      <ErpPageGuide
        purpose={purpose}
        nextStep={nextProcess}
        className="border-0 bg-transparent p-0 shadow-none"
      />
      {businessUse ? (
        <p className="ds-type-caption mt-3 text-[var(--dyn-text-secondary)]">
          <span className="font-semibold">Business use: </span>
          {businessUse}
        </p>
      ) : null}
      {requiredFields?.length ? (
        <div className="mt-3">
          <p className="ds-type-caption font-semibold text-[var(--dyn-text)]">Required fields</p>
          <ul className="ds-type-helper mt-1 list-inside list-disc text-[var(--dyn-text-muted)]">
            {requiredFields.map((f) => (
              <li key={f}>{f}</li>
            ))}
          </ul>
        </div>
      ) : null}
      {tips?.length ? (
        <div className="mt-3">
          <p className="ds-type-caption font-semibold text-[var(--dyn-text)]">Tips</p>
          <ul className="ds-type-helper mt-1 list-inside list-disc text-[var(--dyn-text-muted)]">
            {tips.map((t) => (
              <li key={t}>{t}</li>
            ))}
          </ul>
        </div>
      ) : null}
      {bestPractices?.length ? (
        <div className="mt-3">
          <p className="ds-type-caption font-semibold text-[var(--dyn-text)]">Best practices</p>
          <ul className="ds-type-helper mt-1 list-inside list-disc text-[var(--dyn-text-muted)]">
            {bestPractices.map((b) => (
              <li key={b}>{b}</li>
            ))}
          </ul>
        </div>
      ) : null}
      {shortcuts?.length ? (
        <div className="mt-3">
          <p className="ds-type-caption font-semibold text-[var(--dyn-text)]">Keyboard shortcuts</p>
          <dl className="ds-type-helper mt-1 space-y-1 text-[var(--dyn-text-muted)]">
            {shortcuts.map((s) => (
              <div key={s.keys} className="flex justify-between gap-4">
                <dt className="font-mono">{s.keys}</dt>
                <dd>{s.action}</dd>
              </div>
            ))}
          </dl>
        </div>
      ) : null}
      {relatedPages?.length ? (
        <div className="mt-3">
          <p className="ds-type-caption font-semibold text-[var(--dyn-text)]">Related pages</p>
          <ul className="ds-type-helper mt-1 space-y-1">
            {relatedPages.map((p) => (
              <li key={p.path}>
                <a href={p.path} className="text-[var(--dyn-primary)] hover:underline">
                  {p.label}
                </a>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </aside>
  )
}

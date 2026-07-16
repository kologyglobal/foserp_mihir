import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { cn } from '../../utils/cn'

export interface Enterprise360ShellProps {
  children: ReactNode
  stickySummary?: ReactNode
  className?: string
}

/** Universal 360° detail workspace layout — hero, KPIs, two-column body, sticky summary. */
export function Enterprise360Shell({ children, stickySummary, className }: Enterprise360ShellProps) {
  return (
    <div className={cn('ent-360-shell', className)}>
      {stickySummary}
      <div className="ent-360-shell__body">{children}</div>
    </div>
  )
}

export function Enterprise360MainGrid({
  left,
  right,
  className,
}: {
  left: ReactNode
  right: ReactNode
  className?: string
}) {
  return (
    <div className={cn('ent-360-grid', className)}>
      <div className="ent-360-grid__left">{left}</div>
      <div className="ent-360-grid__right">{right}</div>
    </div>
  )
}

export function Enterprise360BusinessInsights({
  title = 'Business Insights',
  metrics,
}: {
  title?: string
  metrics: { label: string; value: string; hint?: string }[]
}) {
  if (!metrics.length) return null
  return (
    <section className="ent-360-insights" aria-label={title}>
      <h2 className="ent-360-insights__title">{title}</h2>
      <div className="ent-360-insights__grid">
        {metrics.map((m) => (
          <div key={m.label} className="ent-360-insights__metric">
            <span className="ent-360-insights__label">{m.label}</span>
            <span className="ent-360-insights__value">{m.value}</span>
            {m.hint ? <span className="ent-360-insights__hint">{m.hint}</span> : null}
          </div>
        ))}
      </div>
    </section>
  )
}

export function Enterprise360RelatedRecords({
  title,
  items,
}: {
  title: string
  items: { id: string; label: string; href?: string; meta?: string }[]
}) {
  if (!items.length) return null
  return (
    <section className="ent-360-related" aria-label={title}>
      <h2 className="ent-360-related__title">{title}</h2>
      <ul className="ent-360-related__list">
        {items.map((item) => (
          <li key={item.id}>
            {item.href ? (
              <Link to={item.href} className="ent-360-related__link">
                <span>{item.label}</span>
                {item.meta ? <span className="ent-360-related__meta">{item.meta}</span> : null}
              </Link>
            ) : (
              <span className="ent-360-related__link ent-360-related__link--static">
                <span>{item.label}</span>
                {item.meta ? <span className="ent-360-related__meta">{item.meta}</span> : null}
              </span>
            )}
          </li>
        ))}
      </ul>
    </section>
  )
}

export function Enterprise360Documents({
  title = 'Documents & Attachments',
  documents,
  onUpload,
}: {
  title?: string
  documents: { id: string; name: string; type?: string; date?: string }[]
  onUpload?: () => void
}) {
  return (
    <section className="ent-360-docs" aria-label={title}>
      <div className="ent-360-docs__head">
        <h2 className="ent-360-docs__title">{title}</h2>
        {onUpload ? (
          <button type="button" className="ent-360-docs__upload" onClick={onUpload}>
            Upload
          </button>
        ) : null}
      </div>
      {documents.length === 0 ? (
        <div
          className="ent-360-docs__dropzone"
          onClick={onUpload}
          onKeyDown={(e) => e.key === 'Enter' && onUpload?.()}
          role={onUpload ? 'button' : undefined}
          tabIndex={onUpload ? 0 : undefined}
        >
          <p className="font-medium text-erp-text">No documents yet</p>
          <p className="text-[13px] text-erp-muted">Drag and drop files here or click to upload</p>
        </div>
      ) : (
        <ul className="ent-360-docs__list">
          {documents.map((doc) => (
            <li key={doc.id} className="ent-360-docs__item">
              <span className="ent-360-docs__name">{doc.name}</span>
              {doc.type ? <span className="ent-360-docs__type">{doc.type}</span> : null}
              {doc.date ? <span className="ent-360-docs__date">{doc.date}</span> : null}
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

import type { ReactNode } from 'react'
import { DynamicsStatusChip } from './DynamicsStatusChip'

export function DynamicsRecordHeader({
  title,
  code,
  status,
  owner,
  updated,
  actions,
}: {
  title: string
  code?: string
  status?: { label: string; tone?: 'success' | 'warning' | 'critical' | 'info' | 'neutral' | 'pending' }
  owner?: string
  updated?: string
  actions?: ReactNode
}) {
  return (
    <header className="dyn-record-header">
      <div className="dyn-record-header-main">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="dyn-record-title">{title}</h1>
            {code && <span className="dyn-record-code">{code}</span>}
            {status && <DynamicsStatusChip label={status.label} tone={status.tone} />}
          </div>
          <p className="dyn-record-meta">
            {owner && <span>Owner: {owner}</span>}
            {owner && updated && <span className="dyn-live-sep"> · </span>}
            {updated && <span>Updated {updated}</span>}
          </p>
        </div>
        {actions && <div className="dyn-record-actions">{actions}</div>}
      </div>
    </header>
  )
}

import { QrCode, UserRound } from 'lucide-react'
import type { VisitorVisit } from '../types/gate.types'
import { GateStatusBadge } from './GateStatusBadge'
import { formatDateTime } from '@/utils/dates/format'

/**
 * Printable visitor pass. Wrap in a `print:` friendly container — callers use
 * window.print() with the .gate-pass-print root visible.
 */
export function VisitorPassPreview({ visit }: { visit: VisitorVisit }) {
  return (
    <div className="gate-pass-print mx-auto w-full max-w-sm rounded-lg border border-erp-border bg-white p-4 print:border-black">
      <header className="flex items-center justify-between border-b border-dashed border-erp-border pb-2">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-erp-muted">FOS Trailers — Visitor Pass</p>
          <p className="text-[15px] font-bold tabular-nums text-erp-text">{visit.entryNumber}</p>
        </div>
        <GateStatusBadge status={visit.status} />
      </header>
      <div className="flex gap-3 py-3">
        <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-md border border-dashed border-erp-border bg-erp-surface-alt">
          {visit.photoUrl ? (
            <img src={visit.photoUrl} alt={visit.visitorName} className="h-full w-full rounded-md object-cover" />
          ) : (
            <UserRound className="h-9 w-9 text-erp-muted" aria-label="Photo placeholder" />
          )}
        </div>
        <dl className="min-w-0 flex-1 space-y-0.5 text-[12.5px]">
          <div>
            <dt className="sr-only">Visitor</dt>
            <dd className="truncate text-[14px] font-semibold text-erp-text">{visit.visitorName}</dd>
          </div>
          {visit.company ? <dd className="truncate text-erp-muted">{visit.company}</dd> : null}
          <dd className="text-erp-text">
            <span className="text-erp-muted">Host:</span> {visit.hostName}
          </dd>
          <dd className="text-erp-text">
            <span className="text-erp-muted">Dept:</span> {visit.department}
          </dd>
        </dl>
      </div>
      <div className="grid grid-cols-[1fr_auto] items-end gap-3 border-t border-dashed border-erp-border pt-2">
        <dl className="space-y-0.5 text-[12px]">
          <div className="flex gap-1.5">
            <dt className="text-erp-muted">Entry:</dt>
            <dd className="font-medium text-erp-text">{visit.entryTime ? formatDateTime(visit.entryTime) : 'Not yet entered'}</dd>
          </div>
          <div className="flex gap-1.5">
            <dt className="text-erp-muted">Gate:</dt>
            <dd className="font-medium text-erp-text">{visit.gate}</dd>
          </div>
          <div className="flex gap-1.5">
            <dt className="text-erp-muted">Purpose:</dt>
            <dd className="truncate font-medium text-erp-text">{visit.purpose}</dd>
          </div>
        </dl>
        <div className="flex h-16 w-16 items-center justify-center rounded-md border border-dashed border-erp-border" title="QR placeholder — scanner integration pending">
          <QrCode className="h-10 w-10 text-erp-muted" aria-label="QR placeholder" />
        </div>
      </div>
      <p className="mt-2 border-t border-dashed border-erp-border pt-1.5 text-center text-[10.5px] text-erp-muted">
        Pass must be returned at exit · Valid for the date of issue only
      </p>
    </div>
  )
}

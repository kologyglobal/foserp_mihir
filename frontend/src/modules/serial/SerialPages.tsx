import { useState } from 'react'
import { useMemo } from 'react'
import { Link, useParams } from 'react-router-dom'
import { OperationalPageShell } from '../../components/design-system/OperationalPageShell'
import { DataGrid } from '../../components/design-system/DataGrid'
import { Timeline } from '../../components/design-system/Timeline'
import { Button } from '../../components/ui/Button'
import { StatusBadge } from '../../components/ui/StatusBadge'
import { useSerialStore } from '../../store/serialStore'
import {
  SERIAL_STATUS_LABELS,
  SERIAL_TYPE_LABELS,
  type SerialType,
} from '../../types/serialNumber'
import { PermissionGate } from '../../components/auth/ProtectedRoute'
import { formatDate } from '../../utils/dates/format'
import { EntityQrToolbar } from '../../components/qr/EntityQrToolbar'
import { useQrStore } from '../../store/qrStore'

export function SerialNumberMasterPage() {
  const serials = useSerialStore((s) => s.listSerials())
  const registerSerial = useSerialStore((s) => s.registerSerial)
  const [message, setMessage] = useState('')

  function handleRegister(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    const result = registerSerial({
      serialNo: fd.get('serialNo') as string,
      serialType: fd.get('serialType') as SerialType,
      itemCode: (fd.get('itemCode') as string) || null,
      batchLot: (fd.get('batchLot') as string) || null,
    })
    setMessage(result.ok ? 'Serial registered' : result.error ?? 'Failed')
    if (result.ok) e.currentTarget.reset()
  }

  return (
    <OperationalPageShell
      title="Serial Number Master"
      description="Trailer, chassis, and component serial registry with uniqueness enforcement."
      badge={`${serials.length} serials`}
      actions={
        <Link to="/traceability/trailers">
          <Button size="sm" variant="outline">
            Trailer Genealogy
          </Button>
        </Link>
      }
    >
      {message && <p className="mb-4 text-sm text-slate-600">{message}</p>}

      <PermissionGate module="masters" action="create">
        <form onSubmit={handleRegister} className="mb-6 grid max-w-4xl gap-3 rounded-lg border bg-white p-4 md:grid-cols-5">
          <input name="serialNo" required placeholder="Serial No" className="rounded border px-3 py-2 text-sm" />
          <select name="serialType" className="rounded border px-3 py-2 text-sm">
            {Object.entries(SERIAL_TYPE_LABELS).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
          <input name="itemCode" placeholder="Item Code" className="rounded border px-3 py-2 text-sm" />
          <input name="batchLot" placeholder="Batch / Lot" className="rounded border px-3 py-2 text-sm" />
          <Button type="submit" size="sm">
            Register
          </Button>
        </form>
      </PermissionGate>

      <DataGrid
        data={serials}
        columns={[
          {
            accessorKey: 'serialNo',
            header: 'Serial No',
            cell: ({ row }) => (
              <Link to={`/serials/${row.original.id}`} className="font-medium text-blue-600">
                {row.original.serialNo}
              </Link>
            ),
          },
          { accessorKey: 'serialType', header: 'Type', cell: ({ row }) => SERIAL_TYPE_LABELS[row.original.serialType] },
          { accessorKey: 'itemCode', header: 'Item', cell: ({ row }) => row.original.itemCode ?? '—' },
          { accessorKey: 'woNo', header: 'WO', cell: ({ row }) => row.original.woNo ?? '—' },
          { accessorKey: 'grnNo', header: 'GRN', cell: ({ row }) => row.original.grnNo ?? '—' },
          { accessorKey: 'customerName', header: 'Customer', cell: ({ row }) => row.original.customerName ?? '—' },
          {
            accessorKey: 'status',
            header: 'Status',
            cell: ({ row }) => <StatusBadge status={SERIAL_STATUS_LABELS[row.original.status] ?? row.original.status} />,
          },
          { accessorKey: 'createdAt', header: 'Created', cell: ({ row }) => formatDate(row.original.createdAt) },
        ]}
        compact
      />
    </OperationalPageShell>
  )
}

export function SerialDetailPage() {
  const { id } = useParams()
  const serial = useSerialStore((s) => s.getSerial(id!))
  const componentGenealogy = useMemo(
    () => (serial ? useSerialStore.getState().buildComponentGenealogy(serial.serialNo) : null),
    [serial],
  )

  if (!serial) {
    return (
      <OperationalPageShell title="Serial Not Found" description="">
        <p className="text-sm text-slate-600">Serial record not found.</p>
      </OperationalPageShell>
    )
  }

  return (
    <OperationalPageShell
      title={serial.serialNo}
      description={SERIAL_TYPE_LABELS[serial.serialType]}
      badge={SERIAL_STATUS_LABELS[serial.status] ?? serial.status}
      actions={
        <Link to="/serials">
          <Button size="sm" variant="secondary">
            Back to Register
          </Button>
        </Link>
      }
    >
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-lg border bg-white p-4 text-sm">
          <dl className="grid gap-2">
            <div className="flex justify-between"><dt className="text-slate-500">Item</dt><dd>{serial.itemCode ?? '—'}</dd></div>
            <div className="flex justify-between"><dt className="text-slate-500">WO</dt><dd>{serial.woNo ?? '—'}</dd></div>
            <div className="flex justify-between"><dt className="text-slate-500">GRN</dt><dd>{serial.grnNo ?? '—'}</dd></div>
            <div className="flex justify-between"><dt className="text-slate-500">Vendor</dt><dd>{serial.vendorName ?? '—'}</dd></div>
            <div className="flex justify-between"><dt className="text-slate-500">Customer</dt><dd>{serial.customerName ?? '—'}</dd></div>
            <div className="flex justify-between"><dt className="text-slate-500">Installed Trailer</dt><dd>{serial.installedTrailerNo ?? '—'}</dd></div>
            <div className="flex justify-between"><dt className="text-slate-500">Created By</dt><dd>{serial.createdBy ?? '—'}</dd></div>
          </dl>
          {serial.qrCode && (
            <div className="mt-4">
              <p className="mb-2 text-xs font-semibold uppercase text-erp-muted">Linked QR</p>
              <code className="text-xs">{serial.qrCode}</code>
            </div>
          )}
        </div>
        {componentGenealogy && (
          <div className="rounded-lg border bg-white p-4">
            <h3 className="mb-3 text-sm font-semibold">Component Trace</h3>
            <Timeline
              events={componentGenealogy.timeline.map((t, i) => ({
                id: `${t.refId}-${i}`,
                label: t.label,
                timestamp: formatDate(t.date),
                description: t.details,
                status: 'done' as const,
              }))}
            />
          </div>
        )}
      </div>
    </OperationalPageShell>
  )
}

export function TrailerGenealogyPage() {
  const [query, setQuery] = useState('')
  const buildGenealogy = useSerialStore((s) => s.buildGenealogy)
  const result = query.trim() ? buildGenealogy(query) : null
  const trailerQr = useQrStore((s) =>
    result?.trailerNo
      ? s.records.find(
          (r) =>
            r.entityType === 'FINISHED_TRAILER' &&
            (r.displayCode === result.trailerNo || r.metadata.trailerNo === result.trailerNo),
        )
      : undefined,
  )

  return (
    <OperationalPageShell
      title="Trailer Genealogy"
      description="Search by trailer no, chassis no, QR code, work order, sales order, or customer."
      actions={
        <Link to="/traceability/warranty">
          <Button size="sm" variant="outline">
            Warranty Investigation
          </Button>
        </Link>
      }
    >
      <div className="mb-6 flex gap-2">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Trailer / Chassis / QR / WO / SO / Customer"
          className="flex-1 rounded border px-3 py-2 text-sm"
        />
        <Button size="sm" onClick={() => setQuery(query.trim())}>
          Search
        </Button>
      </div>

      {result && (
        <div className="space-y-4">
          <div className="grid gap-3 rounded-lg border bg-white p-4 text-sm md:grid-cols-3">
            <div>Trailer: {result.trailerNo ?? '—'}</div>
            <div>Chassis: {result.chassisNo ?? '—'}</div>
            <div>WO: {result.woNo ?? '—'}</div>
            <div>SO: {result.salesOrderNo ?? '—'}</div>
            <div>Customer: {result.customerName ?? '—'}</div>
            <div>QR: {result.qrCode ?? '—'}</div>
          </div>
          {trailerQr && (
            <div className="rounded-lg border bg-white p-4">
              <p className="mb-2 text-xs font-semibold uppercase text-erp-muted">QR Traceability</p>
              <EntityQrToolbar
                entityType="FINISHED_TRAILER"
                entityId={trailerQr.entityId}
                displayCode={trailerQr.displayCode}
                metadata={trailerQr.metadata as never}
              />
            </div>
          )}
          {result.components.length > 0 && (
            <div className="rounded-lg border bg-white p-4">
              <h3 className="mb-3 text-sm font-semibold">Installed Components</h3>
              <div className="flex flex-wrap gap-2">
                {result.components.map((c) => (
                  <Link
                    key={c.id}
                    to={`/traceability/components/${encodeURIComponent(c.serialNo)}`}
                    className="rounded border px-2 py-1 text-xs hover:border-blue-300"
                  >
                    {c.serialNo} ({SERIAL_TYPE_LABELS[c.serialType]})
                  </Link>
                ))}
              </div>
            </div>
          )}
          <div className="rounded-lg border bg-white p-4">
            <h3 className="mb-3 text-sm font-semibold">Genealogy Timeline</h3>
            <Timeline
              events={result.timeline.map((t, i) => ({
                id: `${t.refId}-${i}`,
                label: `${t.label} — ${t.refNo}`,
                timestamp: formatDate(t.date),
                description: t.details,
                status: i === result.timeline.length - 1 ? 'current' : 'done',
              }))}
            />
          </div>
        </div>
      )}
    </OperationalPageShell>
  )
}

export function ComponentGenealogyPage() {
  const { serialNo } = useParams()
  const decoded = serialNo ? decodeURIComponent(serialNo) : ''
  const result = decoded ? useSerialStore.getState().buildComponentGenealogy(decoded) : null

  if (!result) {
    return (
      <OperationalPageShell title="Component Not Found" description="">
        <p className="text-sm text-slate-600">No serial record found for {decoded || '—'}.</p>
      </OperationalPageShell>
    )
  }

  return (
    <OperationalPageShell
      title={result.serial.serialNo}
      description={`${SERIAL_TYPE_LABELS[result.serial.serialType]} component genealogy`}
      badge={SERIAL_STATUS_LABELS[result.serial.status]}
    >
      <div className="mb-4 grid gap-3 rounded-lg border bg-white p-4 text-sm md:grid-cols-2">
        <div>Vendor: {result.serial.vendorName ?? '—'}</div>
        <div>GRN: {result.serial.grnNo ?? '—'}</div>
        <div>WO: {result.serial.woNo ?? '—'}</div>
        <div>Installed Trailer: {result.installedTrailerNo ?? '—'}</div>
        <div>Customer: {result.customerName ?? '—'}</div>
      </div>
      <div className="rounded-lg border bg-white p-4">
        <Timeline
          events={result.timeline.map((t, i) => ({
            id: `${t.refId}-${i}`,
            label: t.label,
            timestamp: formatDate(t.date),
            description: `${t.refNo} — ${t.details}`,
            status: 'done' as const,
          }))}
        />
      </div>
    </OperationalPageShell>
  )
}

export function WarrantyInvestigationPage() {
  const [query, setQuery] = useState('')
  const result = query.trim() ? useSerialStore.getState().buildWarrantyInvestigation(query) : null

  return (
    <OperationalPageShell title="Warranty Investigation" description="Search trailer serial for full complaint support data.">
      <div className="mb-6 flex gap-2">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Trailer serial number"
          className="flex-1 rounded border px-3 py-2 text-sm"
        />
        <Button size="sm" onClick={() => setQuery(query.trim())}>
          Investigate
        </Button>
      </div>

      {result && (
        <div className="space-y-4">
          <div className="grid gap-3 rounded-lg border bg-white p-4 text-sm md:grid-cols-3">
            <div>Trailer: {result.trailerNo}</div>
            <div>Chassis: {result.chassisNo ?? '—'}</div>
            <div>Customer: {result.customerName ?? '—'}</div>
            <div>Dispatch: {result.dispatchDate ? formatDate(result.dispatchDate) : '—'}</div>
            <div>Invoice: {result.invoiceNo ?? '—'}</div>
          </div>
          <Section title="Components" rows={result.components.map((c) => `${c.serialNo} (${SERIAL_TYPE_LABELS[c.serialType]})`)} />
          <Section title="QC Records" rows={result.qcRecords.map((r) => `${r.refNo} — ${r.details}`)} />
          <Section title="Rework History" rows={result.reworkRecords.map((r) => `${r.refNo} — ${r.details}`)} />
          <Section title="NCR History" rows={result.ncrRecords.map((r) => `${r.refNo} — ${r.details}`)} />
          <Section title="Vendor Sources" rows={result.vendorSources.map((r) => `${r.refNo} — ${r.details}`)} />
        </div>
      )}
    </OperationalPageShell>
  )
}

function Section({ title, rows }: { title: string; rows: string[] }) {
  return (
    <div className="rounded-lg border bg-white p-4">
      <h3 className="mb-2 text-sm font-semibold">{title}</h3>
      {rows.length === 0 ? (
        <p className="text-sm text-slate-500">None recorded.</p>
      ) : (
        <ul className="space-y-1 text-sm text-slate-700">
          {rows.map((r) => (
            <li key={r}>{r}</li>
          ))}
        </ul>
      )}
    </div>
  )
}

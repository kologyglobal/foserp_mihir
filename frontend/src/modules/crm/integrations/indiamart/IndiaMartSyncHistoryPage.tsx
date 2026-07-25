import { useEffect, useState } from 'react'
import { fetchIndiaMartSyncRuns, type IndiaMartSyncRun } from '@/services/api/indiaMartApi'
import { notify } from '@/store/toastStore'

export function IndiaMartSyncHistoryPage() {
  const [rows, setRows] = useState<IndiaMartSyncRun[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    void (async () => {
      try {
        const res = await fetchIndiaMartSyncRuns({ page: 1, limit: 50 })
        setRows(res.data ?? [])
      } catch (err) {
        notify.error((err as Error).message )
      } finally {
        setLoading(false)
      }
    })()
  }, [])

  return (
    <div className="overflow-auto rounded-lg border border-erp-border bg-white">
      <table className="min-w-full text-left text-sm">
        <thead className="bg-erp-surface text-[11px] uppercase text-erp-muted">
          <tr>
            <th className="px-3 py-2">Started</th>
            <th className="px-3 py-2">Trigger</th>
            <th className="px-3 py-2">Status</th>
            <th className="px-3 py-2">Fetched</th>
            <th className="px-3 py-2">Inserted</th>
            <th className="px-3 py-2">Leads</th>
            <th className="px-3 py-2">Linked</th>
            <th className="px-3 py-2">Failed</th>
            <th className="px-3 py-2">Duration</th>
            <th className="px-3 py-2">Error</th>
          </tr>
        </thead>
        <tbody>
          {loading ? (
            <tr>
              <td colSpan={10} className="px-3 py-8 text-center text-erp-muted">
                Loading…
              </td>
            </tr>
          ) : rows.length === 0 ? (
            <tr>
              <td colSpan={10} className="px-3 py-8 text-center text-erp-muted">
                No sync runs yet.
              </td>
            </tr>
          ) : (
            rows.map((row) => (
              <tr key={row.id} className="border-t border-erp-border">
                <td className="px-3 py-2 whitespace-nowrap text-[12px]">
                  {new Date(row.startedAt).toLocaleString()}
                </td>
                <td className="px-3 py-2">{row.triggerType}</td>
                <td className="px-3 py-2">{row.status}</td>
                <td className="px-3 py-2">{row.recordsFetched}</td>
                <td className="px-3 py-2">{row.recordsInserted}</td>
                <td className="px-3 py-2">{row.leadsCreated}</td>
                <td className="px-3 py-2">{row.leadsLinked}</td>
                <td className="px-3 py-2">{row.recordsFailed}</td>
                <td className="px-3 py-2">{row.durationMs != null ? `${row.durationMs} ms` : '—'}</td>
                <td className="px-3 py-2 max-w-[240px] truncate text-red-700" title={row.errorMessage ?? ''}>
                  {row.errorMessage ?? '—'}
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  )
}

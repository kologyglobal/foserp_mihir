import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  bulkCreateIndiaMartLeads,
  createLeadFromIndiaMartEnquiry,
  fetchIndiaMartDashboard,
  fetchIndiaMartEnquiries,
  ignoreIndiaMartEnquiry,
  retryIndiaMartEnquiry,
  type IndiaMartEnquiry,
} from '@/services/api/indiaMartApi'
import { canCrmPermission } from '@/utils/permissions'
import { notify } from '@/store/toastStore'
import { SELECT_PLACEHOLDER } from '@/components/forms/selectStandards'
import { Select } from '@/components/forms/Inputs'

function StatusBadge({ value }: { value: string }) {
  const tone =
    value.includes('FAIL') || value === 'OVERDUE'
      ? 'bg-red-50 text-red-700'
      : value.includes('IMPORT') || value === 'PROCESSED' || value === 'WITHIN_SLA'
        ? 'bg-emerald-50 text-emerald-700'
        : value.includes('DUPLICATE') || value === 'DUE_SOON'
          ? 'bg-amber-50 text-amber-800'
          : 'bg-slate-100 text-slate-700'
  return <span className={`inline-flex rounded px-2 py-0.5 text-[11px] font-medium ${tone}`}>{value}</span>
}

export function IndiaMartInboxPage() {
  const navigate = useNavigate()
  const [rows, setRows] = useState<IndiaMartEnquiry[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [importStatus, setImportStatus] = useState('')
  const [matchStatus, setMatchStatus] = useState('')
  const [selected, setSelected] = useState<string[]>([])
  const [metrics, setMetrics] = useState<Record<string, number> | null>(null)
  const [detail, setDetail] = useState<IndiaMartEnquiry | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [listRes, dashRes] = await Promise.all([
        fetchIndiaMartEnquiries({
          page: 1,
          limit: 50,
          search: search || undefined,
          importStatus: importStatus || undefined,
          matchStatus: matchStatus || undefined,
        }),
        fetchIndiaMartDashboard().catch(() => null),
      ])
      setRows(listRes.data ?? [])
      setTotal(listRes.meta?.total ?? listRes.data?.length ?? 0)
      if (dashRes?.data) setMetrics(dashRes.data as unknown as Record<string, number>)
    } catch (err) {
      notify.error((err as Error).message || 'Failed to load enquiries' )
    } finally {
      setLoading(false)
    }
  }, [search, importStatus, matchStatus])

  useEffect(() => {
    void load()
  }, [load])

  async function onCreateLead(id: string) {
    try {
      const res = await createLeadFromIndiaMartEnquiry(id)
      notify.success('Lead created' )
      if (res.data?.leadId) navigate(`/crm/leads/${res.data.leadId}`)
      else void load()
    } catch (err) {
      notify.error((err as Error).message )
    }
  }

  async function onBulkCreate() {
    if (!selected.length) return
    try {
      await bulkCreateIndiaMartLeads(selected)
      notify.success(`Processed ${selected.length} enquiries`)
      setSelected([])
      void load()
    } catch (err) {
      notify.error((err as Error).message )
    }
  }

  return (
    <div className="space-y-4">
      {metrics && (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
          {[
            ['New today', metrics.newEnquiriesToday],
            ['Leads today', metrics.leadsCreatedToday],
            ['Pending review', metrics.pendingReview],
            ['Duplicates', metrics.possibleDuplicates],
            ['Failed', metrics.failedImports],
            ['Overdue', metrics.overdueEnquiries],
          ].map(([label, value]) => (
            <div key={String(label)} className="rounded-lg border border-erp-border bg-white px-3 py-2">
              <div className="text-[11px] text-erp-muted">{label}</div>
              <div className="text-lg font-semibold text-erp-text">{value ?? 0}</div>
            </div>
          ))}
        </div>
      )}

      <div className="flex flex-wrap items-end gap-3">
        <label className="text-sm">
          Search
          <input
            className="mt-1 block w-56 rounded border border-erp-border px-2 py-1.5 text-sm"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buyer, mobile, product…"
          />
        </label>
        <label className="text-sm">
          Import status
          <Select value={importStatus} onChange={(e) => setImportStatus(e.target.value)}>
            <option value="">{SELECT_PLACEHOLDER}</option>
            <option value="NOT_IMPORTED">Not imported</option>
            <option value="AUTO_IMPORTED">Auto imported</option>
            <option value="MANUALLY_IMPORTED">Manually imported</option>
            <option value="LINKED_TO_EXISTING">Linked</option>
            <option value="DUPLICATE_SKIPPED">Duplicate skipped</option>
            <option value="IGNORED">Ignored</option>
            <option value="IMPORT_FAILED">Failed</option>
          </Select>
        </label>
        <label className="text-sm">
          Match status
          <Select value={matchStatus} onChange={(e) => setMatchStatus(e.target.value)}>
            <option value="">{SELECT_PLACEHOLDER}</option>
            <option value="NO_MATCH">No match</option>
            <option value="EXISTING_LEAD">Existing lead</option>
            <option value="POSSIBLE_DUPLICATE">Possible duplicate</option>
            <option value="EXACT_DUPLICATE">Exact duplicate</option>
          </Select>
        </label>
        <button type="button" className="rounded bg-erp-primary px-3 py-1.5 text-sm text-white" onClick={() => void load()}>
          Refresh
        </button>
        {canCrmPermission('crm.indiamart.enquiry.bulk_manage') && selected.length > 0 && (
          <button type="button" className="rounded border border-erp-border px-3 py-1.5 text-sm" onClick={() => void onBulkCreate()}>
            Create leads ({selected.length})
          </button>
        )}
      </div>

      <div className="overflow-auto rounded-lg border border-erp-border bg-white">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-erp-surface text-[11px] uppercase text-erp-muted">
            <tr>
              <th className="px-3 py-2">
                <input
                  type="checkbox"
                  checked={selected.length > 0 && selected.length === rows.length}
                  onChange={(e) => setSelected(e.target.checked ? rows.map((r) => r.id) : [])}
                />
              </th>
              <th className="px-3 py-2">Received</th>
              <th className="px-3 py-2">Buyer</th>
              <th className="px-3 py-2">Company</th>
              <th className="px-3 py-2">Mobile</th>
              <th className="px-3 py-2">City</th>
              <th className="px-3 py-2">Product</th>
              <th className="px-3 py-2">Match</th>
              <th className="px-3 py-2">Import</th>
              <th className="px-3 py-2">SLA</th>
              <th className="px-3 py-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={11} className="px-3 py-8 text-center text-erp-muted">
                  Loading…
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={11} className="px-3 py-8 text-center text-erp-muted">
                  No enquiries yet. Configure settings and run sync.
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr key={row.id} className="border-t border-erp-border hover:bg-erp-surface/60">
                  <td className="px-3 py-2">
                    <input
                      type="checkbox"
                      checked={selected.includes(row.id)}
                      onChange={(e) =>
                        setSelected((prev) =>
                          e.target.checked ? [...prev, row.id] : prev.filter((id) => id !== row.id),
                        )
                      }
                    />
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap text-[12px]">
                    {row.enquiryDate ? new Date(row.enquiryDate).toLocaleString() : '—'}
                  </td>
                  <td className="px-3 py-2">{row.buyerName ?? '—'}</td>
                  <td className="px-3 py-2">{row.buyerCompanyName ?? '—'}</td>
                  <td className="px-3 py-2">{row.buyerMobile ?? '—'}</td>
                  <td className="px-3 py-2">{row.buyerCity ?? '—'}</td>
                  <td className="px-3 py-2 max-w-[180px] truncate" title={row.productName ?? ''}>
                    {row.productName ?? '—'}
                  </td>
                  <td className="px-3 py-2">
                    <StatusBadge value={row.matchStatus} />
                  </td>
                  <td className="px-3 py-2">
                    <StatusBadge value={row.importStatus} />
                  </td>
                  <td className="px-3 py-2">{row.slaStatus ? <StatusBadge value={row.slaStatus} /> : '—'}</td>
                  <td className="px-3 py-2">
                    <div className="flex flex-wrap gap-1">
                      <button type="button" className="text-xs text-erp-primary underline" onClick={() => setDetail(row)}>
                        View
                      </button>
                      {canCrmPermission('crm.indiamart.enquiry.import') && row.importStatus === 'NOT_IMPORTED' && (
                        <button type="button" className="text-xs text-erp-primary underline" onClick={() => void onCreateLead(row.id)}>
                          Create lead
                        </button>
                      )}
                      {row.createdLeadId && (
                        <button
                          type="button"
                          className="text-xs text-erp-primary underline"
                          onClick={() => navigate(`/crm/leads/${row.createdLeadId}`)}
                        >
                          Open lead
                        </button>
                      )}
                      {canCrmPermission('crm.indiamart.enquiry.ignore') && row.importStatus === 'NOT_IMPORTED' && (
                        <button
                          type="button"
                          className="text-xs text-erp-muted underline"
                          onClick={() =>
                            void ignoreIndiaMartEnquiry(row.id, 'Ignored from inbox').then(() => load())
                          }
                        >
                          Ignore
                        </button>
                      )}
                      {row.importStatus === 'IMPORT_FAILED' && (
                        <button
                          type="button"
                          className="text-xs text-amber-700 underline"
                          onClick={() => void retryIndiaMartEnquiry(row.id).then(() => load())}
                        >
                          Retry
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      <div className="text-xs text-erp-muted">{total} enquiries</div>

      {detail && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/30" onClick={() => setDetail(null)}>
          <aside
            className="h-full w-full max-w-lg overflow-auto bg-white p-5 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold">Enquiry detail</h2>
              <button type="button" onClick={() => setDetail(null)} className="text-sm text-erp-muted">
                Close
              </button>
            </div>
            <dl className="space-y-2 text-sm">
              {[
                ['External ID', detail.externalEnquiryId],
                ['Buyer', detail.buyerName],
                ['Company', detail.buyerCompanyName],
                ['Mobile', detail.buyerMobile],
                ['Email', detail.buyerEmail],
                ['City / State', [detail.buyerCity, detail.buyerState].filter(Boolean).join(', ')],
                ['Product', detail.productName],
                ['Requirement', detail.requirementText],
                ['Quantity', detail.quantityText],
                ['Match', detail.matchStatus],
                ['Import', detail.importStatus],
                ['Failure', detail.failureMessage],
              ].map(([k, v]) => (
                <div key={String(k)}>
                  <dt className="text-[11px] uppercase text-erp-muted">{k}</dt>
                  <dd className="whitespace-pre-wrap text-erp-text">{v || '—'}</dd>
                </div>
              ))}
            </dl>
            {detail.rawPayload != null && (
              <pre className="mt-4 max-h-64 overflow-auto rounded bg-slate-50 p-2 text-[11px]">
                {JSON.stringify(detail.rawPayload, null, 2)}
              </pre>
            )}
          </aside>
        </div>
      )}
    </div>
  )
}

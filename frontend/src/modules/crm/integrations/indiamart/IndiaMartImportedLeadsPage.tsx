import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { fetchIndiaMartEnquiries, type IndiaMartEnquiry } from '@/services/api/indiaMartApi'
import { notify } from '@/store/toastStore'

export function IndiaMartImportedLeadsPage() {
  const navigate = useNavigate()
  const [rows, setRows] = useState<IndiaMartEnquiry[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    void (async () => {
      try {
        const res = await fetchIndiaMartEnquiries({
          page: 1,
          limit: 100,
          createdLeadOnly: true,
        })
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
            <th className="px-3 py-2">Imported</th>
            <th className="px-3 py-2">Buyer</th>
            <th className="px-3 py-2">Company</th>
            <th className="px-3 py-2">Product</th>
            <th className="px-3 py-2">Import status</th>
            <th className="px-3 py-2">Lead</th>
          </tr>
        </thead>
        <tbody>
          {loading ? (
            <tr>
              <td colSpan={6} className="px-3 py-8 text-center text-erp-muted">
                Loading…
              </td>
            </tr>
          ) : rows.length === 0 ? (
            <tr>
              <td colSpan={6} className="px-3 py-8 text-center text-erp-muted">
                No imported leads yet.
              </td>
            </tr>
          ) : (
            rows.map((row) => (
              <tr key={row.id} className="border-t border-erp-border">
                <td className="px-3 py-2 text-[12px]">
                  {row.enquiryDate ? new Date(row.enquiryDate).toLocaleString() : '—'}
                </td>
                <td className="px-3 py-2">{row.buyerName ?? '—'}</td>
                <td className="px-3 py-2">{row.buyerCompanyName ?? '—'}</td>
                <td className="px-3 py-2">{row.productName ?? '—'}</td>
                <td className="px-3 py-2">{row.importStatus}</td>
                <td className="px-3 py-2">
                  {row.createdLeadId ? (
                    <button
                      type="button"
                      className="text-erp-primary underline"
                      onClick={() => navigate(`/crm/leads/${row.createdLeadId}`)}
                    >
                      Open lead
                    </button>
                  ) : (
                    '—'
                  )}
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  )
}

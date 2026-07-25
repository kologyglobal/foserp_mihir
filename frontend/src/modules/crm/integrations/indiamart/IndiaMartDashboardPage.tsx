import { useEffect, useState } from 'react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import {
  fetchIndiaMartAlerts,
  fetchIndiaMartDashboard,
  markAllIndiaMartAlertsRead,
  markIndiaMartAlertRead,
  type IndiaMartAlert,
  type IndiaMartDashboard,
} from '@/services/api/indiaMartApi'
import { notify } from '@/store/toastStore'

export function IndiaMartDashboardPage() {
  const [data, setData] = useState<IndiaMartDashboard | null>(null)
  const [alerts, setAlerts] = useState<IndiaMartAlert[]>([])
  const [loading, setLoading] = useState(true)

  async function load() {
    setLoading(true)
    try {
      const [dash, alertRes] = await Promise.all([
        fetchIndiaMartDashboard(),
        fetchIndiaMartAlerts({ unreadOnly: false }),
      ])
      setData(dash.data)
      setAlerts(alertRes.data ?? [])
    } catch (err) {
      notify.error((err as Error).message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [])

  if (loading || !data) {
    return <div className="text-sm text-erp-muted">Loading dashboard…</div>
  }

  const kpis = [
    ['New today', data.newEnquiriesToday],
    ['Leads today', data.leadsCreatedToday],
    ['Pending review', data.pendingReview],
    ['Duplicates', data.possibleDuplicates],
    ['Failed', data.failedImports],
    ['Overdue', data.overdueEnquiries],
    ['Unread alerts', data.unreadAlerts ?? 0],
    ['Avg first response (min)', data.averageFirstResponseMinutes ?? '—'],
    ['Lead conversion %', data.conversionToLeadPercent ?? 0],
  ] as const

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-5">
        {kpis.map(([label, value]) => (
          <div key={label} className="rounded-lg border border-erp-border bg-white px-3 py-2">
            <div className="text-[11px] text-erp-muted">{label}</div>
            <div className="text-lg font-semibold text-erp-text">{value}</div>
          </div>
        ))}
      </div>

      <section className="rounded-lg border border-erp-border bg-white p-4">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="font-semibold">SLA & sync alerts</h3>
          {alerts.some((a) => !a.isRead) && (
            <button
              type="button"
              className="text-xs text-erp-primary underline"
              onClick={() => void markAllIndiaMartAlertsRead().then(load)}
            >
              Mark all read
            </button>
          )}
        </div>
        {alerts.length === 0 ? (
          <div className="text-sm text-erp-muted">No alerts.</div>
        ) : (
          <ul className="space-y-2">
            {alerts.slice(0, 12).map((a) => (
              <li
                key={a.id}
                className={`rounded border px-3 py-2 text-sm ${a.isRead ? 'border-erp-border bg-erp-surface/40' : 'border-amber-200 bg-amber-50'}`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="font-medium">
                      [{a.severity}] {a.title}
                    </div>
                    <div className="text-erp-muted">{a.message}</div>
                    <div className="text-[11px] text-erp-muted">{new Date(a.createdAt).toLocaleString()}</div>
                  </div>
                  {!a.isRead && (
                    <button
                      type="button"
                      className="shrink-0 text-xs underline"
                      onClick={() => void markIndiaMartAlertRead(a.id).then(load)}
                    >
                      Mark read
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <ChartCard title="Enquiries by day (14d)">
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={data.enquiriesByDay ?? []}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" tick={{ fontSize: 10 }} />
              <YAxis allowDecimals={false} tick={{ fontSize: 10 }} />
              <Tooltip />
              <Line type="monotone" dataKey="enquiries" stroke="#2563eb" strokeWidth={2} name="Enquiries" />
              <Line type="monotone" dataKey="leads" stroke="#059669" strokeWidth={2} name="Leads" />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="By product">
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={data.enquiriesByProduct ?? []} layout="vertical" margin={{ left: 8 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis type="number" allowDecimals={false} tick={{ fontSize: 10 }} />
              <YAxis type="category" dataKey="name" width={110} tick={{ fontSize: 10 }} />
              <Tooltip />
              <Bar dataKey="count" fill="#2563eb" name="Enquiries" />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="By city / state">
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={data.enquiriesByCity ?? []}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" tick={{ fontSize: 10 }} />
              <YAxis allowDecimals={false} tick={{ fontSize: 10 }} />
              <Tooltip />
              <Bar dataKey="count" fill="#0f766e" name="Enquiries" />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Funnel (14d)">
          <ResponsiveContainer width="100%" height={220}>
            <BarChart
              data={[
                { name: 'Enquiries', count: data.funnel?.enquiries ?? 0 },
                { name: 'Imported', count: data.funnel?.imported ?? 0 },
                { name: 'Pending', count: data.funnel?.pendingReview ?? 0 },
                { name: 'Overdue', count: data.funnel?.overdue ?? 0 },
              ]}
            >
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" tick={{ fontSize: 10 }} />
              <YAxis allowDecimals={false} tick={{ fontSize: 10 }} />
              <Tooltip />
              <Bar dataKey="count" fill="#0f766e" name="Count" />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>
    </div>
  )
}

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-lg border border-erp-border bg-white p-4">
      <h3 className="mb-3 font-semibold">{title}</h3>
      {children}
    </section>
  )
}

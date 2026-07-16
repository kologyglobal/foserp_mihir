import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Phone } from 'lucide-react'
import { useCrmStore } from '../../store/crmStore'
import { useSalesStore } from '../../store/salesStore'
import { useMrpStore } from '../../store/mrpStore'
import { useOpenOpportunities } from '../../hooks/useStableStoreData'
import { useMasterStore } from '../../store/masterStore'
import { opportunityStageLabel } from '../../utils/opportunityUtils'
import { formatCrmCurrency } from '../../utils/crmMetrics'
import { normalizeLead } from '../../utils/leadUtils'
import { getSessionUser } from '../../utils/permissions'
import { MobilePageTitle } from '../../components/mobile'
import { MobileCrmPipelineNav } from '../../components/mobile/MobileCrmPipelineNav'
import { entity360CustomerPath } from '../../config/entity360Routes'
import { resolveSalesOrderDetailPath } from '../../utils/crmSalesOrderNavigation'

function MobileCrmEmpty({ message }: { message: string }) {
  return <div className="mob-card text-center text-sm text-[#605e5c]">{message}</div>
}

export function MobileCrmFollowUpsPage() {
  const followUps = useCrmStore((s) => s.followUps)
  const completeFollowUp = useCrmStore((s) => s.completeFollowUp)
  const today = new Date().toISOString().slice(0, 10)
  const due = useMemo(
    () => followUps.filter((f) => f.dueDate.slice(0, 10) <= today && (f.status === 'pending' || f.status === 'overdue')),
    [followUps, today],
  )

  return (
    <div className="mobile-page space-y-3 p-4">
      <MobilePageTitle title="Today's Follow-ups" subtitle={`${due.length} due`} />
      <MobileCrmPipelineNav />
      {due.length === 0 ? (
        <MobileCrmEmpty message="No follow-ups due today." />
      ) : (
        due.map((f) => (
          <article key={f.id} className="rounded-lg border p-3 bg-card">
            <p className="font-medium capitalize">{f.followUpType.replace(/_/g, ' ')}</p>
            <p className="text-sm text-muted-foreground">{f.notes}</p>
            <p className="text-xs mt-1">{f.dueDate} {f.dueTime} · {f.status}</p>
            <button type="button" className="mt-2 text-sm text-primary" onClick={() => completeFollowUp(f.id, 'Completed on mobile')}>Mark done</button>
          </article>
        ))
      )}
    </div>
  )
}

export function MobileCrmOpportunitiesPage() {
  const opps = useOpenOpportunities()
  const navigate = useNavigate()
  return (
    <div className="mobile-page space-y-3 p-4">
      <MobilePageTitle title="Open Opportunities" subtitle={`${opps.length} open`} />
      <MobileCrmPipelineNav />
      {opps.length === 0 ? (
        <MobileCrmEmpty message="No open opportunities." />
      ) : (
        opps.slice(0, 20).map((o) => (
          <button key={o.id} type="button" className="w-full text-left rounded-lg border p-3" onClick={() => navigate(`/crm/opportunities/${o.id}`)}>
            <p className="font-medium">{o.opportunityName}</p>
            <p className="text-sm text-muted-foreground">{opportunityStageLabel(o.stage)} · {formatCrmCurrency(o.value)}</p>
          </button>
        ))
      )}
    </div>
  )
}

export function MobileCrmLeadsPage() {
  const leads = useSalesStore((s) => s.leads)
  const navigate = useNavigate()
  const rows = useMemo(
    () => leads.map((l) => normalizeLead(l)).filter((l) => l.lifecycleStatus !== 'closed').slice(0, 25),
    [leads],
  )

  return (
    <div className="mobile-page space-y-3 p-4">
      <MobilePageTitle title="CRM Leads" subtitle={`${rows.length} active leads`} />
      <MobileCrmPipelineNav />
      {rows.length === 0 ? (
        <MobileCrmEmpty message="No active leads." />
      ) : (
        rows.map((l) => (
          <button
            key={l.id}
            type="button"
            className="w-full text-left rounded-lg border p-3"
            onClick={() => navigate(`/crm/leads/${l.id}`)}
          >
            <p className="font-medium">{l.prospectName}</p>
            <p className="text-sm text-muted-foreground capitalize">{l.stage.replace(/_/g, ' ')} · {l.leadOwnerName}</p>
          </button>
        ))
      )}
    </div>
  )
}

export function MobileCrmQuotationsPage() {
  const navigate = useNavigate()
  const docs = useCrmStore((s) => s.quotationDocuments)
  const salesQuotations = useSalesStore((s) => s.quotations)
  const rows = useMemo(() => {
    const latest = new Map<string, (typeof docs)[number]>()
    for (const d of docs) {
      const prev = latest.get(d.quotationId)
      if (!prev || d.revisionNo > prev.revisionNo) latest.set(d.quotationId, d)
    }
    return [...latest.values()]
      .sort((a, b) => (b.modifiedAt ?? b.createdAt).localeCompare(a.modifiedAt ?? a.createdAt))
      .slice(0, 25)
      .map((d) => ({
        doc: d,
        salesNo: salesQuotations.find((q) => q.id === d.quotationId)?.quotationNo ?? d.quotationId,
      }))
  }, [docs, salesQuotations])

  return (
    <div className="mobile-page space-y-3 p-4">
      <MobilePageTitle title="CRM Quotations" subtitle="Latest revision per quotation" />
      <MobileCrmPipelineNav />
      {rows.length === 0 ? (
        <MobileCrmEmpty message="No quotations yet." />
      ) : (
        rows.map(({ doc, salesNo }) => (
          <button
            key={doc.id}
            type="button"
            className="w-full text-left rounded-lg border p-3"
            onClick={() => navigate(`/crm/quotations/${doc.id}`)}
          >
            <p className="font-medium">{salesNo}</p>
            <p className="text-sm text-muted-foreground capitalize">
              Rev {doc.revisionNo} · {doc.status.replace(/_/g, ' ')} · {formatCrmCurrency(doc.totalAmount)}
            </p>
          </button>
        ))
      )}
    </div>
  )
}

export function MobileCrmSalesOrdersPage() {
  const navigate = useNavigate()
  const salesOrders = useMrpStore((s) => s.salesOrders)
  const customers = useMasterStore((s) => s.customers)
  const rows = useMemo(
    () =>
      [...salesOrders]
        .filter((so) => so.opportunityId || so.quotationId)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        .slice(0, 25),
    [salesOrders],
  )

  return (
    <div className="mobile-page space-y-3 p-4">
      <MobilePageTitle title="CRM Sales Orders" subtitle="Pipeline-linked orders" />
      <MobileCrmPipelineNav />
      {rows.length === 0 ? (
        <MobileCrmEmpty message="No CRM-linked sales orders." />
      ) : (
        rows.map((so) => {
          const customer = customers.find((c) => c.id === so.customerId)
          return (
            <button
              key={so.id}
              type="button"
              className="w-full text-left rounded-lg border p-3"
              onClick={() => navigate(resolveSalesOrderDetailPath(so.id, true))}
            >
              <p className="font-medium">{so.salesOrderNo}</p>
              <p className="text-sm text-muted-foreground">
                {customer?.customerName ?? so.customerId} · {so.status.replace(/_/g, ' ')} · {formatCrmCurrency(so.grandTotal ?? 0)}
              </p>
            </button>
          )
        })
      )}
    </div>
  )
}

export function MobileCrmCustomersPage() {
  const customers = useMasterStore((s) => s.customers)
  const contacts = useCrmStore((s) => s.contacts)
  return (
    <div className="mobile-page space-y-3 p-4">
      <MobilePageTitle title="CRM Companies" subtitle={`${customers.length} accounts`} />
      <MobileCrmPipelineNav />
      {customers.length === 0 ? (
        <MobileCrmEmpty message="No companies in master data." />
      ) : (
        customers.slice(0, 15).map((c) => {
          const contact = contacts.find((x) => x.customerId === c.id && x.isPrimary)
          return (
            <article key={c.id} className="rounded-lg border p-3">
              <Link to={entity360CustomerPath(c.id)} className="font-medium">{c.customerName}</Link>
              <p className="text-sm text-muted-foreground">{c.city}</p>
              {contact && (
                <a href={`tel:${contact.phone}`} className="inline-flex items-center gap-1 mt-2 text-sm text-primary">
                  <Phone className="h-4 w-4" /> {contact.name}
                </a>
              )}
            </article>
          )
        })
      )}
    </div>
  )
}

export function MobileCrmActivitiesPage() {
  const [note, setNote] = useState('')
  const session = getSessionUser()
  const createActivity = useCrmStore((s) => s.createActivity)
  const activities = useCrmStore((s) => s.activities)
  return (
    <div className="mobile-page space-y-3 p-4">
      <MobilePageTitle title="Activities" subtitle="Log calls and meetings" />
      <MobileCrmPipelineNav />
      <div className="space-y-2">
        <textarea className="w-full border rounded p-2 text-sm min-h-[80px]" placeholder="Call or meeting note..." value={note} onChange={(e) => setNote(e.target.value)} />
        <button
          type="button"
          className="w-full rounded bg-primary text-primary-foreground py-2 text-sm"
          onClick={() => {
            if (!note.trim()) return
            createActivity({
              type: 'call',
              subject: 'Mobile note',
              description: note,
              ownerId: session.id,
              ownerName: session.name,
            })
            setNote('')
          }}
        >
          Add call note
        </button>
      </div>
      {activities.length === 0 ? (
        <MobileCrmEmpty message="No activities logged yet." />
      ) : (
        <ul className="space-y-2">
          {activities.slice(0, 15).map((a) => (
            <li key={a.id} className="text-sm border rounded p-2">
              <p className="font-medium">{a.subject}</p>
              <p className="text-muted-foreground">{a.description}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

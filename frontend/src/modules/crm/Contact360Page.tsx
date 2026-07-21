import { useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  Activity,
  Building2,
  Calendar,
  Handshake,
  Mail,
  Paperclip,
  Pencil,
  Phone,
  StickyNote,
  User,
} from 'lucide-react'
import { ErpCardCommandBar } from '../../components/erp/card-form/ErpCardCommandBar'
import { CrmCardFormShell } from '@/components/crm/CrmCardFormShell'
import { ContactSummaryCard } from '@/components/crm/ContactSummaryCard'
import { ENTERPRISE_FORM_DETAIL_CLASS } from '../../design-system/workspace'
import { ErpCardSection } from '../../components/erp/card-form'
import { AppLink } from '../../components/ui/AppLink'
import { TableLink } from '../../components/ui/AppLink'
import {
  LogActivityDrawer,
  QuickFollowUpDrawer,
} from '../../components/crm'
import { CrmUnifiedActivityFeed } from '../../components/crm/CrmUnifiedActivityFeed'
import { CrmDeleteConfirmModal } from '../../components/crm/CrmDeleteConfirmModal'
import { useCrmStore } from '../../store/crmStore'
import { useMasterStore } from '../../store/masterStore'
import { resolveStoreAction } from '../../store/storeAction'
import { notify } from '../../store/toastStore'
import { entity360CustomerPath } from '../../config/entity360Routes'
import { formatCrmCurrency } from '../../utils/crmMetrics'
import { contactViewBreadcrumbs } from '../../utils/crmContactNavigation'
import { opportunityStageLabel } from '../../utils/opportunityUtils'
import { buildUnifiedFeed } from '../../utils/crmUnifiedFeed'
import { formatDate, formatRelativeTime } from '../../utils/dates/format'
import { canCrmPermission } from '../../utils/permissions/crm'
import {
  EnterpriseFormMetrics,
  EnterpriseFormSectionNav,
} from '../../design-system/workspace'
import { Enterprise360Documents } from '../../design-system/workspace360'
import { EntityAttachmentsPanel } from '../../components/crm/shared/EntityAttachmentsPanel'
import { EntityNotesPanel } from '../../components/crm/shared/EntityNotesPanel'
import { demoNotesFromTexts } from '../../utils/crmEntityNotes'
import type { CrmActivity, FollowUp } from '../../types/crm'
import { useApiMode } from '@/hooks/useApiMode'
import { useContactAttachmentStore } from '../../store/contactAttachmentStore'
import { CrmSmartOverviewPanel } from '@/components/crm/CrmSmartOverviewPanel'
import {
  buildContactAiInsight,
  buildContactKeyDetails,
  buildContactSmartSignals,
  computeContactCompleteness,
  contactOverviewChips,
  contactOverviewTitle,
  resolveContactNextBestAction,
} from '../../utils/contactSmartOverview'

export function Contact360Page() {
  const apiMode = useApiMode()
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const contact = useCrmStore((s) => (id ? s.getContact(id) : undefined))
  const customer = useMasterStore((s) =>
    contact ? s.customers.find((c) => c.id === contact.customerId) : undefined,
  )
  const activities = useCrmStore((s) => s.activities)
  const followUps = useCrmStore((s) => s.followUps)
  const opportunities = useCrmStore((s) => s.opportunities)
  const deleteActivity = useCrmStore((s) => s.deleteActivity)
  const deleteFollowUp = useCrmStore((s) => s.deleteFollowUp)
  const attachmentItems = useContactAttachmentStore((s) => s.items)

  const [followUpOpen, setFollowUpOpen] = useState(false)
  const [logActivityOpen, setLogActivityOpen] = useState(false)
  const [editingActivity, setEditingActivity] = useState<CrmActivity | null>(null)
  const [editingFollowUp, setEditingFollowUp] = useState<FollowUp | null>(null)
  const [deleteActivityTarget, setDeleteActivityTarget] = useState<CrmActivity | null>(null)
  const [deleteFollowUpTarget, setDeleteFollowUpTarget] = useState<FollowUp | null>(null)
  const [pendingActivityId, setPendingActivityId] = useState<string | null>(null)
  const [pendingFollowUpId, setPendingFollowUpId] = useState<string | null>(null)
  const [activeSection, setActiveSection] = useState('profile')
  const canAddActivity = canCrmPermission('crm.activity.create')
  const canAddFollowUp = canCrmPermission('crm.follow_up.create')
  const canEditActivity = canCrmPermission('crm.activity.update')
  const canDeleteActivity = canCrmPermission('crm.activity.delete')
  const canEditFollowUp = canCrmPermission('crm.follow_up.update')
  const canDeleteFollowUp = canCrmPermission('crm.follow_up.delete')

  function scrollToSection(sectionId: string) {
    setActiveSection(sectionId)
    document.getElementById(`contact-section-${sectionId}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  const contactActivities = useMemo(
    () =>
      contact
        ? [...activities.filter((a) => a.contactId === contact.id)].sort((a, b) =>
            b.activityDate.localeCompare(a.activityDate),
          )
        : [],
    [activities, contact],
  )

  const contactFollowUps = useMemo(
    () =>
      contact
        ? [...followUps.filter((f) => f.contactId === contact.id)].sort((a, b) =>
            a.dueDate.localeCompare(b.dueDate),
          )
        : [],
    [followUps, contact],
  )

  const contactOpportunities = useMemo(
    () =>
      contact
        ? opportunities.filter((o) => o.contactId === contact.id && o.status === 'open')
        : [],
    [opportunities, contact],
  )

  const nextFollowUp = useMemo(
    () =>
      contactFollowUps.find((f) => f.status === 'pending' || f.status === 'overdue') ?? null,
    [contactFollowUps],
  )

  const lastActivity = contactActivities[0] ?? null

  const contactDemoNotes = useMemo(
    () => (contact
      ? demoNotesFromTexts([
          { label: 'Designation', text: contact.designation },
          { label: 'Department', text: contact.department },
        ])
      : []),
    [contact],
  )

  const unifiedFeedItems = useMemo(
    () => buildUnifiedFeed({
      activities: contactActivities,
      followUps: contactFollowUps,
      notes: contactDemoNotes,
      systemEvents: contact
        ? [{ id: 'created', label: 'Contact Created', date: contact.createdAt?.slice(0, 10) || new Date().toISOString().slice(0, 10) }]
        : [],
    }),
    [contact, contactActivities, contactFollowUps, contactDemoNotes],
  )

  const contactAttachments = useMemo(
    () => (id ? attachmentItems.filter((a) => a.contactId === id) : []),
    [attachmentItems, id],
  )

  const attachmentDocs = useMemo(
    () => contactAttachments.map((a) => ({
      id: a.id,
      name: a.fileName,
      type: a.documentTypeName,
      date: formatDate(a.uploadedAt),
    })),
    [contactAttachments],
  )

  if (!contact) {
    return (
      <CrmCardFormShell
        title="Contact not found"
        description="This contact may have been removed or the link is invalid."
        breadcrumbs={contactViewBreadcrumbs('Not found')}
        stickyFooter={false}
      >
        <p className="text-sm text-erp-muted">
          <AppLink to="/crm/contacts" className="text-erp-primary">
            Back to Contacts
          </AppLink>
        </p>
      </CrmCardFormShell>
    )
  }

  const metrics = [
    {
      label: 'Open Opportunities',
      value: String(contactOpportunities.length),
      accent: 'blue' as const,
      hint: contactOpportunities.length > 0 ? 'Active pipeline' : 'No open deals',
    },
    {
      label: 'Last Activity',
      value: lastActivity ? formatRelativeTime(lastActivity.activityDate) : '—',
      accent: 'violet' as const,
      hint: lastActivity?.subject ?? 'No activity logged',
    },
    {
      label: 'Next Follow-up',
      value: nextFollowUp ? formatDate(nextFollowUp.dueDate) : '—',
      accent: nextFollowUp?.status === 'overdue' ? ('amber' as const) : ('green' as const),
      hint: nextFollowUp?.assignedToName ?? 'Not scheduled',
    },
  ]

  const sectionNavItems = [
    { id: 'profile', label: 'Summary', icon: User },
    { id: 'opportunities', label: 'Opportunities', icon: Handshake },
    { id: 'engagement', label: 'Engagement', icon: Activity },
    { id: 'notes', label: 'Notes', icon: StickyNote },
    { id: 'attachments', label: 'Attachments', icon: Paperclip, done: contactAttachments.length > 0 },
  ]

  const documentStrip = [
    { label: 'Contact', value: contact.name, highlight: true },
    { label: 'Company', value: customer?.customerName ?? '—', highlight: Boolean(customer) },
    { label: 'Designation', value: contact.designation || '—' },
    { label: 'Department', value: contact.department || '—' },
    { label: 'Phone', value: contact.phone || '—' },
    { label: 'Email', value: contact.email || '—' },
    { label: 'Primary', value: contact.isPrimary ? 'Yes' : 'No' },
    { label: 'Status', value: contact.isActive === false ? 'Inactive' : 'Active' },
    { label: 'Attachments', value: String(contactAttachments.length) },
  ]

  const commandBar = (
    <ErpCardCommandBar
      inline
      homeActions={[
        {
          id: 'edit',
          label: 'Edit Contact',
          icon: Pencil,
          onClick: () => navigate(`/crm/contacts/${contact.id}/edit`),
          primary: true,
        },
        {
          id: 'follow-up',
          label: 'Schedule Activity',
          icon: Calendar,
          onClick: () => setFollowUpOpen(true),
        },
      ]}
      moreActions={[
        {
          id: 'log-activity',
          label: 'Log Activity',
          icon: Activity,
          onClick: () => setLogActivityOpen(true),
        },
        {
          id: 'company-360',
          label: 'Company 360',
          icon: Building2,
          onClick: () => navigate(entity360CustomerPath(contact.customerId)),
        },
        ...(contact.phone
          ? [{ id: 'call', label: 'Call', icon: Phone, onClick: () => window.open(`tel:${contact.phone}`) }]
          : []),
        ...(contact.email
          ? [{ id: 'email', label: 'Email', icon: Mail, onClick: () => window.open(`mailto:${contact.email}`) }]
          : []),
      ]}
    />
  )

  const smartOverviewInput = {
    name: contact.name,
    customerId: contact.customerId,
    customerName: customer?.customerName ?? '',
    designation: contact.designation || '',
    department: contact.department || '',
    phone: contact.phone || '',
    email: contact.email || '',
    isPrimary: Boolean(contact.isPrimary),
    isActive: contact.isActive !== false,
    attachmentCount: contactAttachments.length,
  }

  const nextAction = resolveContactNextBestAction(smartOverviewInput)

  const factBox = (
    <CrmSmartOverviewPanel
      ariaLabel="Smart contact overview"
      title={contactOverviewTitle(smartOverviewInput)}
      chips={contactOverviewChips(smartOverviewInput)}
      meta={[
        customer?.customerName ? `Company: ${customer.customerName}` : 'No company linked',
        contact.designation || 'No designation',
      ]}
      progressLabel="Contact readiness"
      progressPercent={computeContactCompleteness(smartOverviewInput)}
      signals={buildContactSmartSignals(smartOverviewInput)}
      nextAction={nextAction}
      onNextAction={() => {
        if (nextAction.id === 'link_company' && contact.customerId) {
          navigate(entity360CustomerPath(contact.customerId))
          return
        }
        if (nextAction.id === 'enter_name' || nextAction.id === 'add_reach' || nextAction.id === 'link_company') {
          navigate(`/crm/contacts/${contact.id}/edit`)
          return
        }
        scrollToSection('profile')
      }}
      quickActions={[
        {
          id: 'edit',
          label: 'Edit',
          icon: Pencil,
          onClick: () => navigate(`/crm/contacts/${contact.id}/edit`),
        },
        {
          id: 'schedule',
          label: 'Schedule',
          icon: Calendar,
          onClick: () => setFollowUpOpen(true),
        },
        {
          id: 'activity',
          label: 'Log Activity',
          icon: Activity,
          onClick: () => setLogActivityOpen(true),
        },
        {
          id: 'company',
          label: 'Company 360',
          icon: Building2,
          onClick: () => navigate(entity360CustomerPath(contact.customerId)),
        },
      ]}
      keyDetails={buildContactKeyDetails(smartOverviewInput)}
      aiInsight={buildContactAiInsight(smartOverviewInput)}
    />
  )

  return (
    <>
      <CrmCardFormShell
        title={contact.name}
        description={`${contact.designation}${customer ? ` · ${customer.customerName}` : ''}`}
        badge={contact.isPrimary ? 'Primary Contact' : 'CRM'}
        className={`${ENTERPRISE_FORM_DETAIL_CLASS} enterprise-workspace--crm-smart-overview contact-360-page`}
        recordTitle={contact.name}
        status={contact.isPrimary ? 'Primary' : contact.isActive === false ? 'Inactive' : 'Active'}
        statusTone={contact.isPrimary ? 'success' : contact.isActive === false ? 'neutral' : 'info'}
        company={customer?.customerName}
        owner={contact.designation}
        favoritePath={`/crm/contacts/${contact.id}`}
        breadcrumbs={contactViewBreadcrumbs(contact.name)}
        commandBar={commandBar}
        documentStrip={documentStrip}
        factBox={factBox}
        suppressFactBoxRecord
        collapsibleFactBox
        factBoxLabel="Smart Context"
        stickyFooter={false}
      >
        <EnterpriseFormSectionNav
          sections={sectionNavItems}
          activeId={activeSection}
          onSelect={scrollToSection}
        />

        <EnterpriseFormMetrics metrics={metrics} />

        <ContactSummaryCard
          contact={contact}
          customerName={customer?.customerName}
          customerCode={customer?.customerCode}
          city={customer?.city}
          territory={customer?.salesTerritory}
          industry={customer?.industry}
          lastActivityAt={lastActivity?.activityDate}
          lastActivityLabel={lastActivity?.subject}
          nextFollowUpDate={nextFollowUp?.dueDate}
          openOpportunityCount={contactOpportunities.length}
        />

          <ErpCardSection
            id="contact-section-opportunities"
            title="Open Opportunities"
            subtitle="Deals linked to this contact"
            icon={Handshake}
            accent="green"
            collapsible
            defaultOpen
            className="contact-360-section"
          >
            {contactOpportunities.length === 0 ? (
              <div className="contact-360-empty" role="status">
                <span className="contact-360-empty__icon" aria-hidden>
                  <Handshake className="h-5 w-5" strokeWidth={1.75} />
                </span>
                <div>
                  <p className="contact-360-empty__title">No open opportunities</p>
                  <p className="contact-360-empty__copy">
                    This contact is not linked to an active deal yet. Open the company 360 or create an
                    opportunity when the conversation progresses.
                  </p>
                </div>
                <div className="contact-360-empty__actions">
                  <AppLink
                    to={entity360CustomerPath(contact.customerId)}
                    className="contact-360-empty__link"
                  >
                    Open company 360
                  </AppLink>
                </div>
              </div>
            ) : (
              <ul className="contact-360-opp-list">
                {contactOpportunities.map((opp) => (
                  <li key={opp.id} className="contact-360-opp-list__item">
                    <div className="contact-360-opp-list__main">
                      <TableLink to={`/crm/opportunities/${opp.id}`} className="contact-360-opp-list__name">
                        {opp.opportunityName}
                      </TableLink>
                      <p className="contact-360-opp-list__meta">
                        {opp.opportunityNo} · {opportunityStageLabel(opp.stage)}
                      </p>
                    </div>
                    <div className="contact-360-opp-list__value">
                      <p className="contact-360-opp-list__amount">{formatCrmCurrency(opp.value)}</p>
                      <p className="contact-360-opp-list__prob">{opp.probability}% probability</p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </ErpCardSection>

          <ErpCardSection
            id="contact-section-engagement"
            title="Activity Timeline"
            subtitle="Calls, emails, notes, and follow-ups"
            icon={Activity}
            accent="slate"
            collapsible
            defaultOpen
            className="contact-360-section"
          >
            <CrmUnifiedActivityFeed
              items={unifiedFeedItems}
              nextFollowUp={nextFollowUp}
              canAddActivity={canAddActivity}
              canAddFollowUp={canAddFollowUp}
              canAddNote
              onLogActivity={() => {
                setEditingActivity(null)
                setLogActivityOpen(true)
              }}
              onScheduleFollowUp={() => {
                setEditingFollowUp(null)
                setFollowUpOpen(true)
              }}
              onAddNote={() => {
                window.requestAnimationFrame(() => {
                  document.getElementById('contact-section-notes')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
                })
              }}
              onEditActivity={canEditActivity ? (activity) => {
                setEditingActivity(activity)
                setLogActivityOpen(true)
              } : undefined}
              onDeleteActivity={canDeleteActivity ? (activity) => setDeleteActivityTarget(activity) : undefined}
              onEditFollowUp={canEditFollowUp ? (followUp) => {
                setEditingFollowUp(followUp)
                setFollowUpOpen(true)
              } : undefined}
              onDeleteFollowUp={canDeleteFollowUp ? (followUp) => setDeleteFollowUpTarget(followUp) : undefined}
              pendingActivityId={pendingActivityId}
              pendingFollowUpId={pendingFollowUpId}
            />
          </ErpCardSection>

          <ErpCardSection
            id="contact-section-notes"
            title="Notes"
            subtitle="Internal notes on this contact."
            icon={StickyNote}
            accent="slate"
            collapsible
            defaultOpen={false}
            className="contact-360-section"
          >
            {contact ? (
              <EntityNotesPanel
                entityType="CONTACT"
                entityId={contact.id}
                demoNotes={demoNotesFromTexts([
                  { label: 'Designation', text: contact.designation },
                  { label: 'Department', text: contact.department },
                ])}
              />
            ) : null}
          </ErpCardSection>

          <ErpCardSection
            id="contact-section-attachments"
            title="Attachments"
            subtitle="Business cards, KYC, and supporting documents."
            icon={Paperclip}
            accent="slate"
            collapsible
            defaultOpen={contactAttachments.length > 0}
            className="contact-360-section"
          >
            {apiMode && contact ? (
              <EntityAttachmentsPanel entityType="CONTACT" entityId={contact.id} />
            ) : (
              <Enterprise360Documents
                documents={attachmentDocs}
                onUpload={() => navigate(`/crm/contacts/${contact.id}/edit`)}
              />
            )}
          </ErpCardSection>
      </CrmCardFormShell>

      <QuickFollowUpDrawer
        open={followUpOpen}
        onClose={() => {
          setFollowUpOpen(false)
          setEditingFollowUp(null)
        }}
        context={{ customerId: contact.customerId, contactId: contact.id }}
        followUp={editingFollowUp}
      />
      <LogActivityDrawer
        open={logActivityOpen}
        onClose={() => {
          setLogActivityOpen(false)
          setEditingActivity(null)
        }}
        context={{ customerId: contact.customerId, contactId: contact.id }}
        activity={editingActivity}
      />
      <CrmDeleteConfirmModal
        open={Boolean(deleteActivityTarget)}
        title="Delete activity?"
        description={deleteActivityTarget ? `"${deleteActivityTarget.subject}" will be removed from this contact’s timeline.` : undefined}
        confirmLabel="Delete activity"
        onCancel={() => setDeleteActivityTarget(null)}
        onConfirm={() => {
          if (!deleteActivityTarget) return
          setPendingActivityId(deleteActivityTarget.id)
          void (async () => {
            try {
              const r = await resolveStoreAction(deleteActivity(deleteActivityTarget.id))
              if (r.ok) {
                setDeleteActivityTarget(null)
                notify.success('Activity deleted')
              } else {
                notify.error(r.error ?? 'Failed to delete activity')
              }
            } finally {
              setPendingActivityId(null)
            }
          })()
        }}
        isDeleting={pendingActivityId === deleteActivityTarget?.id}
      />
      <CrmDeleteConfirmModal
        open={Boolean(deleteFollowUpTarget)}
        title="Delete follow-up?"
        description={deleteFollowUpTarget
          ? `Follow-up (${deleteFollowUpTarget.followUpType.replace(/_/g, ' ')}) due ${deleteFollowUpTarget.dueDate} will be removed.`
          : undefined}
        confirmLabel="Delete follow-up"
        onCancel={() => setDeleteFollowUpTarget(null)}
        onConfirm={() => {
          if (!deleteFollowUpTarget) return
          setPendingFollowUpId(deleteFollowUpTarget.id)
          void (async () => {
            try {
              const r = await resolveStoreAction(deleteFollowUp(deleteFollowUpTarget.id))
              if (r.ok) {
                setDeleteFollowUpTarget(null)
                notify.success('Follow-up deleted')
              } else {
                notify.error(r.error ?? 'Failed to delete follow-up')
              }
            } finally {
              setPendingFollowUpId(null)
            }
          })()
        }}
        isDeleting={pendingFollowUpId === deleteFollowUpTarget?.id}
      />
    </>
  )
}

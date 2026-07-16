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
  User,
} from 'lucide-react'
import { ErpCardCommandBar } from '../../components/erp/card-form/ErpCardCommandBar'
import { FactBoxPaneAiToggle } from '../../components/erp/card-form/FactBoxPaneAiToggle'
import { CrmCardFormShell } from '@/components/crm/CrmCardFormShell'
import { ENTERPRISE_FORM_DETAIL_CLASS } from '../../design-system/workspace'
import { ErpCardSection, ErpFieldRow } from '../../components/erp/card-form'
import { Input } from '../../components/forms/Inputs'
import { AppLink } from '../../components/ui/AppLink'
import { TableLink } from '../../components/ui/AppLink'
import { DynamicsStatusChip } from '../../components/dynamics/DynamicsStatusChip'
import {
  ActivityTimeline,
  LogActivityDrawer,
  QuickFollowUpDrawer,
} from '../../components/crm'
import { useCrmStore } from '../../store/crmStore'
import { useMasterStore } from '../../store/masterStore'
import { entity360CustomerPath } from '../../config/entity360Routes'
import { formatCrmCurrency } from '../../utils/crmMetrics'
import { contactViewBreadcrumbs } from '../../utils/crmContactNavigation'
import { opportunityStageLabel } from '../../utils/opportunityUtils'
import { formatDate, formatRelativeTime } from '../../utils/dates/format'
import {
  EnterpriseFormMetrics,
  EnterpriseFormSectionNav,
} from '../../design-system/workspace'
import { Enterprise360Documents } from '../../design-system/workspace360'
import { EntityAttachmentsPanel } from '../../components/crm/shared/EntityAttachmentsPanel'
import { EntityNotesPanel } from '../../components/crm/shared/EntityNotesPanel'
import { CrmEntityDetailDrawer } from '../../components/crm/shared/CrmEntityDetailDrawer'
import { demoNotesFromTexts } from '../../utils/crmEntityNotes'
import type { CrmEntityTypeApi, DemoEntityNote } from '../../types/crmEntity'
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
  const attachmentItems = useContactAttachmentStore((s) => s.items)

  const [followUpOpen, setFollowUpOpen] = useState(false)
  const [logActivityOpen, setLogActivityOpen] = useState(false)
  const [activeSection, setActiveSection] = useState('profile')
  const [notesDetail, setNotesDetail] = useState<{
    entityType: CrmEntityTypeApi
    entityId: string
    title: string
    subtitle?: string
    demoNotes?: DemoEntityNote[]
  } | null>(null)

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

  function openActivityNotes(activity: CrmActivity) {
    setNotesDetail({
      entityType: 'ACTIVITY',
      entityId: activity.id,
      title: activity.subject,
      subtitle: activity.type.replace(/_/g, ' '),
      demoNotes: demoNotesFromTexts([{ label: 'Description', text: activity.description }]),
    })
  }

  function openFollowUpNotes(followUp: FollowUp) {
    setNotesDetail({
      entityType: 'FOLLOW_UP',
      entityId: followUp.id,
      title: followUp.followUpType.replace(/_/g, ' '),
      subtitle: `${followUp.dueDate} · ${followUp.assignedToName}`,
      demoNotes: demoNotesFromTexts([{ label: 'Follow-up notes', text: followUp.notes }]),
    })
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
    { id: 'profile', label: 'Profile', icon: User },
    { id: 'company', label: 'Company', icon: Building2 },
    { id: 'opportunities', label: 'Opportunities', icon: Handshake },
    { id: 'engagement', label: 'Engagement', icon: Activity },
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
        if (nextAction.id === 'add_reach') scrollToSection('profile')
        else if (nextAction.id === 'link_company') navigate(entity360CustomerPath(contact.customerId))
        else scrollToSection('profile')
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
        className={`${ENTERPRISE_FORM_DETAIL_CLASS} enterprise-workspace--crm-smart-overview`}
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
        factBoxLabel="Details"
        stickyFooter={false}
      >
        <EnterpriseFormSectionNav
          sections={sectionNavItems}
          activeId={activeSection}
          onSelect={scrollToSection}
          trailing={<FactBoxPaneAiToggle />}
        />

        <EnterpriseFormMetrics metrics={metrics} />

        <div className="grid gap-4 lg:grid-cols-2">
          <ErpCardSection
            id="contact-section-profile"
            title="Contact Profile"
            subtitle="Directory and communication details"
            icon={User}
            accent="blue"
            collapsible
            defaultOpen
          >
              <ErpFieldRow label="Full Name" readOnly>
                <Input value={contact.name} readOnly className="erp-input" />
              </ErpFieldRow>
              <ErpFieldRow label="Designation" readOnly>
                <Input value={contact.designation || '—'} readOnly className="erp-input" />
              </ErpFieldRow>
              <ErpFieldRow label="Department" readOnly>
                <Input value={contact.department || '—'} readOnly className="erp-input" />
              </ErpFieldRow>
              <ErpFieldRow label="Email" readOnly>
                {contact.email ? (
                  <a href={`mailto:${contact.email}`} className="erp-input block text-erp-primary">
                    {contact.email}
                  </a>
                ) : (
                  <Input value="—" readOnly className="erp-input" />
                )}
              </ErpFieldRow>
              <ErpFieldRow label="Phone" readOnly>
                {contact.phone ? (
                  <a href={`tel:${contact.phone}`} className="erp-input block text-erp-primary">
                    {contact.phone}
                  </a>
                ) : (
                  <Input value="—" readOnly className="erp-input" />
                )}
              </ErpFieldRow>
              <ErpFieldRow label="Primary Contact" readOnly>
                <Input value={contact.isPrimary ? 'Yes' : 'No'} readOnly className="erp-input" />
              </ErpFieldRow>
            </ErpCardSection>

            <ErpCardSection
              id="contact-section-company"
              title="Company"
              subtitle="Linked customer account"
              icon={Building2}
              accent="teal"
              collapsible
              defaultOpen
            >
              <ErpFieldRow label="Company" readOnly colSpan={2}>
                <TableLink to={entity360CustomerPath(contact.customerId)} className="text-[14px] font-semibold">
                  {customer?.customerName ?? contact.customerId}
                </TableLink>
              </ErpFieldRow>
              <ErpFieldRow label="Company Code" readOnly>
                <Input value={customer?.customerCode ?? '—'} readOnly className="erp-input" />
              </ErpFieldRow>
              <ErpFieldRow label="City" readOnly>
                <Input value={customer?.city ?? '—'} readOnly className="erp-input" />
              </ErpFieldRow>
              <ErpFieldRow label="Territory" readOnly>
                <Input value={customer?.salesTerritory ?? '—'} readOnly className="erp-input" />
              </ErpFieldRow>
              <ErpFieldRow label="Industry" readOnly>
                <Input value={customer?.industry ?? '—'} readOnly className="erp-input" />
              </ErpFieldRow>
            </ErpCardSection>
          </div>

          <ErpCardSection
            id="contact-section-opportunities"
            title="Open Opportunities"
            subtitle="Deals linked to this contact"
            icon={Handshake}
            accent="green"
            collapsible
            defaultOpen
          >
            {contactOpportunities.length === 0 ? (
              <p className="text-sm text-erp-muted">No open opportunities for this contact.</p>
            ) : (
              <ul className="divide-y divide-erp-border">
                {contactOpportunities.map((opp) => (
                  <li key={opp.id} className="flex items-center justify-between gap-3 py-3">
                    <div className="min-w-0">
                      <TableLink to={`/crm/opportunities/${opp.id}`} className="font-semibold">
                        {opp.opportunityName}
                      </TableLink>
                      <p className="text-xs text-erp-muted">
                        {opp.opportunityNo} · {opportunityStageLabel(opp.stage)}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-sm font-semibold text-erp-text">{formatCrmCurrency(opp.value)}</p>
                      <p className="text-xs text-erp-muted">{opp.probability}% probability</p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </ErpCardSection>

          <div id="contact-section-engagement" className="grid gap-4 lg:grid-cols-2">
            <ErpCardSection title="Activity History" subtitle="Logged calls, emails, and notes" icon={Handshake} accent="slate" collapsible defaultOpen>
              <ActivityTimeline
                activities={contactActivities}
                limit={12}
                onOpenNotes={openActivityNotes}
              />
            </ErpCardSection>

            <ErpCardSection title="Follow-ups" subtitle="Scheduled and overdue tasks" icon={Calendar} accent="amber" collapsible defaultOpen>
              {contactFollowUps.length === 0 ? (
                <p className="text-sm text-erp-muted">No follow-ups scheduled.</p>
              ) : (
                <ul className="space-y-3">
                  {contactFollowUps.slice(0, 8).map((fu) => (
                    <li key={fu.id} className="rounded-lg border border-erp-border px-3 py-2">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-erp-text">{fu.notes?.trim() || 'Follow-up'}</p>
                          <p className="text-xs text-erp-muted">
                            Due {formatDate(fu.dueDate)}
                            {fu.assignedToName ? ` · ${fu.assignedToName}` : ''}
                          </p>
                        </div>
                        <DynamicsStatusChip
                          label={fu.status === 'overdue' ? 'Overdue' : fu.status === 'pending' ? 'Pending' : 'Done'}
                          tone={fu.status === 'overdue' ? 'critical' : fu.status === 'pending' ? 'warning' : 'success'}
                        />
                      </div>
                      <button
                        type="button"
                        className="mt-2 text-[12px] font-semibold text-erp-primary"
                        onClick={() => openFollowUpNotes(fu)}
                      >
                        Notes
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </ErpCardSection>
          </div>

          <ErpCardSection
            id="contact-section-notes"
            title="Notes"
            subtitle="Internal notes on this contact."
            icon={Mail}
            accent="slate"
            collapsible
            defaultOpen={false}
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
        onClose={() => setFollowUpOpen(false)}
        context={{ customerId: contact.customerId, contactId: contact.id }}
      />
      <LogActivityDrawer
        open={logActivityOpen}
        onClose={() => setLogActivityOpen(false)}
        context={{ customerId: contact.customerId, contactId: contact.id }}
      />
      <CrmEntityDetailDrawer
        open={!!notesDetail}
        onClose={() => setNotesDetail(null)}
        entityType={notesDetail?.entityType ?? 'ACTIVITY'}
        entityId={notesDetail?.entityId ?? null}
        title={notesDetail?.title ?? 'Notes'}
        subtitle={notesDetail?.subtitle}
        demoNotes={notesDetail?.demoNotes}
      />
    </>
  )
}

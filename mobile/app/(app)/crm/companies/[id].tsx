import { useMemo, useState } from 'react'
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import { useLocalSearchParams, useRouter } from 'expo-router'
import {
  AppCard,
  AppHeader,
  Avatar,
  EmptyState,
  FormField,
  IconButton,
  InfoTile,
  Loading,
  PrimaryButton,
  SectionHeader,
  Skeleton,
  SkeletonCard,
  StatusChip,
} from '@/components'
import {
  useCompany,
  useContacts,
  useEntityAttachments,
  useEntityNotes,
  useFollowUps,
  useInvalidateCrm,
  useQuotations,
  useSalesOrders,
  useActivities,
} from '@/features/crm/hooks'
import {
  quotationAmount,
  salesOrderAmount,
} from '@/features/crm/commercialMap'
import {
  companyLabel,
  formatDate,
  formatMoney,
  mapQueryFromCompany,
  openTel,
  openWhatsApp,
  statusTone,
  titleCaseLabel,
} from '@/features/crm/utils'
import { ContextualActionsSheet } from '@/features/crm/components/ContextualActionsSheet'
import { EntityMissingState } from '@/features/crm/components/EntityMissingState'
import { QuickContactActions } from '@/features/crm/components/QuickContactActions'
import { VoiceNoteRecorder } from '@/features/crm/components/VoiceNoteRecorder'
import { createEntityAttachment, createEntityNote, fetchCompanyCommercialPosition } from '@/api/crmApi'
import { saveOfflineDraft } from '@/features/crm/offlineDrafts'
import { buildUnifiedTimeline } from '@/features/crm/timeline/buildUnifiedTimeline'
import { useSessionStore } from '@/store/sessionStore'
import { getUserFriendlyMessage } from '@/api/errors'
import { colors, layout, radius, spacing, typography } from '@/theme'
import { useQuery } from '@tanstack/react-query'
import { readFileBase64 } from '@/utils/files'
import { usePermissions } from '@/auth/permissions'

const TABS = [
  'Overview',
  'Contacts',
  'Timeline',
  'Follow-ups',
  'Quotations',
  'Sales Orders',
  'Outstanding',
  'Files',
  'Notes',
] as const

type Tab = (typeof TABS)[number]

const TAB_SHORT: Record<Tab, string> = {
  Overview: 'Overview',
  Contacts: 'Contacts',
  Timeline: 'Activity',
  'Follow-ups': 'Follow-ups',
  Quotations: 'Quotes',
  'Sales Orders': 'Orders',
  Outstanding: 'Balance',
  Files: 'Files',
  Notes: 'Notes',
}

function CompanyDetailSkeleton() {
  return (
    <View style={styles.flex}>
      <AppHeader title="Company" onBack={() => undefined} />
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.heroBlock}>
          <AppCard style={styles.headerCard}>
            <View style={styles.heroTop}>
              <Skeleton width={56} height={56} rounded style={{ borderRadius: 28 }} />
              <View style={styles.heroCopy}>
                <Skeleton width="72%" height={22} />
                <Skeleton width="48%" height={14} style={{ marginTop: spacing.sm }} />
                <Skeleton width={88} height={24} rounded style={{ marginTop: spacing.md, borderRadius: 999 }} />
              </View>
            </View>
            <View style={styles.kpiRow}>
              <View style={styles.kpiTile}>
                <Skeleton width="40%" height={10} />
                <Skeleton width="70%" height={16} style={{ marginTop: spacing.sm }} />
              </View>
              <View style={styles.kpiTile}>
                <Skeleton width="40%" height={10} />
                <Skeleton width="70%" height={16} style={{ marginTop: spacing.sm }} />
              </View>
              <View style={styles.kpiTile}>
                <Skeleton width="40%" height={10} />
                <Skeleton width="70%" height={16} style={{ marginTop: spacing.sm }} />
              </View>
            </View>
          </AppCard>
        </View>
        <View style={styles.panel}>
          <SkeletonCard />
          <View style={{ height: spacing.md }} />
          <SkeletonCard />
        </View>
      </ScrollView>
    </View>
  )
}

export default function CompanyDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const companyId = String(id || '')
  const { data, isLoading, error, refetch } = useCompany(companyId)
  const { can } = usePermissions()
  const [tab, setTab] = useState<Tab>('Overview')
  const [actionsOpen, setActionsOpen] = useState(false)
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const online = useSessionStore((s) => s.isOnline)
  const invalidate = useInvalidateCrm()
  const router = useRouter()

  const contacts = useContacts()
  const companyContacts = useMemo(
    () => (contacts.data ?? []).filter((c) => c.companyId === companyId),
    [contacts.data, companyId],
  )

  const notes = useEntityNotes('COMPANY', companyId)
  const files = useEntityAttachments('COMPANY', companyId)
  const fus = useFollowUps('mine')
  const quotes = useQuotations()
  const sos = useSalesOrders()
  const activities = useActivities()

  const followUps = useMemo(
    () => (fus.data ?? []).filter((f) => String(f.companyId || f.customerId) === companyId),
    [fus.data, companyId],
  )
  const quotations = useMemo(
    () => (quotes.data ?? []).filter((q) => String(q.companyId) === companyId),
    [quotes.data, companyId],
  )
  const salesOrders = useMemo(
    () => (sos.data ?? []).filter((s) => String(s.companyId) === companyId),
    [sos.data, companyId],
  )
  const companyActs = useMemo(
    () =>
      (activities.data ?? []).filter(
        (a) => String((a as { companyId?: string }).companyId || '') === companyId,
      ),
    [activities.data, companyId],
  )

  const notesList = notes.data ?? []
  const filesList = files.data ?? []

  const commercial = useQuery({
    queryKey: ['crm', 'company', companyId, 'commercial'],
    enabled: tab === 'Outstanding' && !!companyId,
    queryFn: async () => (await fetchCompanyCommercialPosition(companyId)).data,
    retry: false,
  })

  const timeline = useMemo(() => {
    if (tab !== 'Timeline') return []
    return buildUnifiedTimeline({
      activities: companyActs as unknown as Array<Record<string, unknown>>,
      followUps: followUps as unknown as Array<Record<string, unknown>>,
      notes: notesList as unknown as Array<Record<string, unknown>>,
      attachments: filesList as unknown as Array<Record<string, unknown>>,
      quotations: quotations as unknown as Array<Record<string, unknown>>,
      salesOrders: salesOrders as unknown as Array<Record<string, unknown>>,
      limit: 50,
    })
  }, [tab, companyActs, followUps, notesList, filesList, quotations, salesOrders])

  const openFollowUps = useMemo(
    () =>
      followUps.filter((f) => {
        const s = String(f.status || '').toUpperCase()
        return s && s !== 'DONE' && s !== 'COMPLETED' && s !== 'CANCELLED' && s !== 'CANCELED'
      }),
    [followUps],
  )

  const tabCount = (t: Tab): number | undefined => {
    if (t === 'Contacts') return companyContacts.length || undefined
    if (t === 'Follow-ups') return followUps.length || undefined
    if (t === 'Quotations') return quotations.length || undefined
    if (t === 'Sales Orders') return salesOrders.length || undefined
    if (t === 'Files') return filesList.length || undefined
    if (t === 'Notes') return notesList.length || undefined
    return undefined
  }

  const saveNote = async () => {
    if (!note.trim()) return
    setBusy(true)
    try {
      if (!online) {
        await saveOfflineDraft('note', {
          entityType: 'COMPANY',
          entityId: companyId,
          content: note.trim(),
        })
        Alert.alert('Saved offline', 'Note will sync when you are online.')
      } else {
        await createEntityNote('COMPANY', companyId, note.trim())
        invalidate()
      }
      setNote('')
    } catch (e) {
      Alert.alert('Note failed', getUserFriendlyMessage(e))
    } finally {
      setBusy(false)
    }
  }

  const attachVoice = async (file: {
    localUri: string
    originalFilename: string
    mimeType: string
  }) => {
    const base64 = online ? await readFileBase64(file.localUri) : undefined
    if (!online) {
      await saveOfflineDraft(
        'audio',
        {
          entityType: 'COMPANY',
          entityId: companyId,
          originalFilename: file.originalFilename,
          mimeType: file.mimeType,
          documentType: 'VOICE_NOTE',
        },
        {
          attachments: [
            {
              localUri: file.localUri,
              originalFilename: file.originalFilename,
              mimeType: file.mimeType,
              documentType: 'VOICE_NOTE',
            },
          ],
        },
      )
      Alert.alert('Voice note saved offline')
      return
    }
    if (!base64) throw new Error('Could not read audio')
    await createEntityAttachment('COMPANY', companyId, {
      originalFilename: file.originalFilename,
      mimeType: file.mimeType,
      contentBase64: base64,
      documentType: 'VOICE_NOTE',
    })
    invalidate()
  }

  if (!companyId) {
    return <EntityMissingState title="Customer" entityLabel="customer" />
  }
  if (isLoading) return <CompanyDetailSkeleton />
  if (error || !data) {
    return (
      <EntityMissingState
        title="Customer"
        entityLabel="customer"
        error={error ?? new Error('Not found')}
        onRetry={() => void refetch()}
      />
    )
  }

  const name = companyLabel(data)
  const owner = String(data.ownerName || data.ownerId || 'Unassigned')
  const status = String(data.status || (data.isActive === false ? 'inactive' : 'active'))
  const statusLabel = titleCaseLabel(status)
  const industryCity = [data.industry, data.city].filter(Boolean).join(' · ')
  const address = [data.addressLine1, data.city, data.state].filter(Boolean).join(', ')
  const phone = data.phone || data.contactPhone
  const mapQuery = mapQueryFromCompany(data)

  return (
    <View style={styles.flex}>
      <AppHeader
        title={name}
        subtitle={statusLabel}
        onBack={() => router.back()}
        right={
          <IconButton
            name="ellipsis-horizontal"
            accessibilityLabel="Company actions"
            onPress={() => setActionsOpen(true)}
          />
        }
      />

      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        stickyHeaderIndices={[1]}
      >
        {/* 0 — Hero */}
        <View style={styles.heroBlock}>
          <AppCard style={styles.headerCard}>
            <View style={styles.heroTop}>
              <Avatar name={name} size={56} />
              <View style={styles.heroCopy}>
                <Text style={styles.companyName} numberOfLines={2}>
                  {name}
                </Text>
                {industryCity ? (
                  <Text style={styles.metaLine} numberOfLines={1}>
                    {industryCity}
                  </Text>
                ) : null}
                <View style={styles.chipRow}>
                  <StatusChip label={statusLabel} tone={statusTone(status)} />
                </View>
              </View>
            </View>

            <View style={styles.ownerRow}>
              <Text style={styles.ownerLabel}>Owner</Text>
              <Text style={styles.ownerValue} numberOfLines={1}>
                {owner}
              </Text>
            </View>

            <View style={styles.kpiRow}>
              <View style={styles.kpiTile}>
                <Text style={styles.kpiLabel}>Contacts</Text>
                <Text style={styles.kpiValue} numberOfLines={1}>
                  {companyContacts.length}
                </Text>
              </View>
              <View style={styles.kpiTile}>
                <Text style={styles.kpiLabel}>Quotes</Text>
                <Text style={styles.kpiValue} numberOfLines={1}>
                  {quotations.length}
                </Text>
              </View>
              <View style={styles.kpiTile}>
                <Text style={styles.kpiLabel}>Orders</Text>
                <Text style={styles.kpiValue} numberOfLines={1}>
                  {salesOrders.length}
                </Text>
              </View>
              <View style={styles.kpiTile}>
                <Text style={styles.kpiLabel}>Open FU</Text>
                <Text style={styles.kpiValue} numberOfLines={1}>
                  {openFollowUps.length}
                </Text>
              </View>
            </View>

            <View style={styles.contactActions}>
              <QuickContactActions
                phone={phone}
                email={data.email}
                mapQuery={mapQuery}
                whatsappText={`Hi ${name}`}
              />
            </View>
          </AppCard>
        </View>

        {/* 1 — Sticky segment tabs */}
        <View style={styles.tabSticky}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.tabBar}
          >
            {TABS.map((t) => {
              const active = tab === t
              const count = tabCount(t)
              return (
                <Pressable
                  key={t}
                  onPress={() => setTab(t)}
                  accessibilityRole="tab"
                  accessibilityState={{ selected: active }}
                  hitSlop={layout.hitSlop}
                  style={({ pressed }) => [
                    styles.tabItem,
                    active && styles.tabItemActive,
                    pressed && styles.tabPressed,
                  ]}
                >
                  <Text style={[styles.tabLabel, active && styles.tabLabelActive]}>
                    {TAB_SHORT[t]}
                    {count != null ? ` ${count}` : ''}
                  </Text>
                </Pressable>
              )
            })}
          </ScrollView>
        </View>

        {/* Tab panels */}
        {tab === 'Overview' ? (
          <View style={styles.panel}>
            <SectionHeader title="Company details" />
            <View style={styles.infoGrid}>
              <InfoTile label="GSTIN" value={String(data.gstin || '—')} />
              <InfoTile label="Phone" value={String(phone || '—')} />
              <InfoTile label="Email" value={String(data.email || '—')} />
              <InfoTile
                label="Last activity"
                value={formatDate(data.lastActivityAt ? String(data.lastActivityAt) : null)}
              />
            </View>

            <SectionHeader title="Address" />
            <AppCard flat>
              {address ? (
                <Text style={styles.plainBody}>{address}</Text>
              ) : (
                <EmptyState
                  title="No address yet"
                  description="Add a billing or site address so maps and field visits are easier."
                  icon="location-outline"
                />
              )}
            </AppCard>

            <View style={styles.overviewActions}>
              <PrimaryButton
                title="Log follow-up"
                onPress={() =>
                  router.push({
                    pathname: '/(app)/crm/follow-ups/create',
                    params: { companyId },
                  })
                }
                fullWidth
              />
            </View>
          </View>
        ) : null}

        {tab === 'Contacts' ? (
          <View style={styles.panel}>
            {companyContacts.length ? (
              companyContacts.map((c) => {
                const contactName =
                  c.fullName || [c.firstName, c.lastName].filter(Boolean).join(' ') || 'Contact'
                return (
                  <Pressable
                    key={c.id}
                    onPress={() => router.push(`/(app)/crm/contacts/${c.id}`)}
                    style={({ pressed }) => pressed && styles.tabPressed}
                  >
                    <AppCard style={styles.mb} flat>
                      <View style={styles.contactHead}>
                        <Avatar name={contactName} size={46} />
                        <View style={styles.contactCopy}>
                          <Text style={styles.listTitle} numberOfLines={1}>
                            {contactName}
                          </Text>
                          {c.designation ? (
                            <Text style={styles.listMeta} numberOfLines={1}>
                              {c.designation}
                            </Text>
                          ) : null}
                          {c.mobile || c.email ? (
                            <Text style={styles.listMeta} numberOfLines={1}>
                              {[c.mobile, c.email].filter(Boolean).join(' · ')}
                            </Text>
                          ) : null}
                        </View>
                      </View>
                    </AppCard>
                  </Pressable>
                )
              })
            ) : (
              <AppCard flat>
                <EmptyState
                  title="No contacts yet"
                  description="People linked to this company will show here for quick outreach."
                  icon="people-outline"
                />
              </AppCard>
            )}
          </View>
        ) : null}

        {tab === 'Timeline' ? (
          <View style={styles.panel}>
            {timeline.length ? (
              timeline.map((e) => (
                <AppCard key={e.id} style={styles.mb} flat>
                  <View style={styles.listCardHead}>
                    <Text style={styles.kindLabel}>{titleCaseLabel(e.type.replace(/_/g, ' '))}</Text>
                    {e.status ? (
                      <StatusChip
                        label={titleCaseLabel(e.status)}
                        tone={statusTone(e.status)}
                        compact
                      />
                    ) : null}
                  </View>
                  <Text style={styles.listTitle}>{e.summary}</Text>
                  <Text style={styles.listMeta}>
                    {e.user} · {e.at.slice(0, 16).replace('T', ' ')}
                  </Text>
                  {e.sourceDocument ? (
                    <Text style={styles.listMeta}>Source: {e.sourceDocument}</Text>
                  ) : null}
                </AppCard>
              ))
            ) : (
              <AppCard flat>
                <EmptyState
                  title="No activity yet"
                  description="Calls, notes, quotes, and follow-ups will build a shared history here."
                  icon="time-outline"
                  actionLabel="Add note"
                  onAction={() => setTab('Notes')}
                />
              </AppCard>
            )}
          </View>
        ) : null}

        {tab === 'Follow-ups' ? (
          <View style={styles.panel}>
            {followUps.length ? (
              followUps.map((f) => (
                <AppCard key={f.id} style={styles.mb} flat>
                  <View style={styles.listCardHead}>
                    <Text style={styles.listTitle}>{titleCaseLabel(f.followUpType)}</Text>
                    <StatusChip
                      label={titleCaseLabel(f.status)}
                      tone={statusTone(f.status)}
                      compact
                    />
                  </View>
                  <Text style={styles.listMeta}>
                    {formatDate(f.dueDate)}
                    {f.dueTime ? ` · ${f.dueTime}` : ''}
                  </Text>
                </AppCard>
              ))
            ) : (
              <AppCard flat>
                <EmptyState
                  title="No follow-ups"
                  description="Schedule the next touch so this account stays warm."
                  icon="alarm-outline"
                  actionLabel="Schedule follow-up"
                  onAction={() =>
                    router.push({
                      pathname: '/(app)/crm/follow-ups/create',
                      params: { companyId },
                    })
                  }
                />
              </AppCard>
            )}
          </View>
        ) : null}

        {tab === 'Quotations' ? (
          <View style={styles.panel}>
            {quotations.length ? (
              quotations.map((q) => (
                <Pressable
                  key={q.id}
                  onPress={() => router.push(`/(app)/crm/quotations/${q.id}`)}
                  style={({ pressed }) => pressed && styles.tabPressed}
                >
                  <AppCard style={styles.mb} flat>
                    <View style={styles.listCardHead}>
                      <Text style={styles.listTitle}>
                        {q.quotationCode || q.quotationNo || 'Quote'}
                      </Text>
                      {q.status ? (
                        <StatusChip
                          label={titleCaseLabel(q.status)}
                          tone={statusTone(q.status)}
                          compact
                        />
                      ) : null}
                    </View>
                    <Text style={styles.listMeta}>{formatMoney(quotationAmount(q))}</Text>
                  </AppCard>
                </Pressable>
              ))
            ) : (
              <AppCard flat>
                <EmptyState
                  title="No quotations"
                  description="Quotes for this company will show up here."
                  icon="document-text-outline"
                />
              </AppCard>
            )}
          </View>
        ) : null}

        {tab === 'Sales Orders' ? (
          <View style={styles.panel}>
            {salesOrders.length ? (
              salesOrders.map((s) => (
                <Pressable
                  key={s.id}
                  onPress={() => router.push(`/(app)/crm/sales-orders/${s.id}`)}
                  style={({ pressed }) => pressed && styles.tabPressed}
                >
                  <AppCard style={styles.mb} flat>
                    <View style={styles.listCardHead}>
                      <Text style={styles.listTitle}>
                        {s.salesOrderNo || s.soNumber || 'Order'}
                      </Text>
                      {s.status ? (
                        <StatusChip
                          label={titleCaseLabel(s.status)}
                          tone={statusTone(s.status)}
                          compact
                        />
                      ) : null}
                    </View>
                    <Text style={styles.listMeta}>{formatMoney(salesOrderAmount(s))}</Text>
                  </AppCard>
                </Pressable>
              ))
            ) : (
              <AppCard flat>
                <EmptyState
                  title="No sales orders"
                  description="Orders linked to this company will appear here."
                  icon="cart-outline"
                />
              </AppCard>
            )}
          </View>
        ) : null}

        {tab === 'Outstanding' ? (
          <View style={styles.panel}>
            <SectionHeader title="Receivables" />
            <AppCard>
              {commercial.isLoading ? <Loading label="Loading balance…" /> : null}
              {commercial.error ? (
                <EmptyState
                  title="Balance unavailable"
                  description={
                    can('finance.ar.view') || can('tenant.manage')
                      ? getUserFriendlyMessage(commercial.error)
                      : 'Finance outstanding requires finance.ar.view permission.'
                  }
                  icon="wallet-outline"
                />
              ) : null}
              {commercial.data ? (
                <View style={styles.balanceBlock}>
                  <View style={styles.balanceHero}>
                    <Text style={styles.kpiLabel}>Outstanding</Text>
                    <Text style={styles.balanceValue}>
                      {formatMoney(
                        Number(
                          (commercial.data as { money?: { outstandingAmount?: number } }).money
                            ?.outstandingAmount,
                        ) || undefined,
                      )}
                    </Text>
                  </View>
                  <View style={styles.infoGrid}>
                    <InfoTile
                      label="Next due"
                      value={String(
                        (commercial.data as { money?: { nextPaymentDueDate?: string } }).money
                          ?.nextPaymentDueDate || '—',
                      )}
                    />
                    <InfoTile
                      label="Collected"
                      value={formatMoney(
                        Number(
                          (commercial.data as { money?: { collectedAmount?: number } }).money
                            ?.collectedAmount,
                        ) || undefined,
                      )}
                    />
                  </View>
                  {(commercial.data as { moneyVisible?: boolean }).moneyVisible === false ? (
                    <Text style={styles.listMeta}>
                      Detailed amounts may be restricted for your role.
                    </Text>
                  ) : null}
                </View>
              ) : null}
              {!commercial.isLoading &&
              !commercial.error &&
              !commercial.data &&
              !can('finance.ar.view') &&
              !can('tenant.manage') ? (
                <EmptyState
                  title="Permission required"
                  description="Invoice-level AR open items are hidden without Accounting AR permission."
                  icon="lock-closed-outline"
                />
              ) : null}
            </AppCard>
          </View>
        ) : null}

        {tab === 'Files' ? (
          <View style={styles.panel}>
            {filesList.length ? (
              filesList.map((f) => (
                <AppCard key={f.id} style={styles.mb} flat>
                  <Text style={styles.listTitle} numberOfLines={1}>
                    {f.originalFilename}
                  </Text>
                  <Text style={styles.listMeta}>
                    {titleCaseLabel(f.documentTypeName || f.documentType)}
                    {f.mimeType ? ` · ${f.mimeType}` : ''}
                  </Text>
                </AppCard>
              ))
            ) : (
              <AppCard flat>
                <EmptyState
                  title="No files yet"
                  description="Business cards, drawings, and voice notes will live here."
                  icon="folder-open-outline"
                />
              </AppCard>
            )}
          </View>
        ) : null}

        {tab === 'Notes' ? (
          <View style={styles.panel}>
            {notesList.length ? (
              notesList.map((n) => (
                <AppCard key={n.id} style={styles.mb} flat>
                  <Text style={styles.noteAuthor}>{n.createdByName || 'User'}</Text>
                  <Text style={styles.noteBody}>{n.content}</Text>
                  {n.createdAt ? (
                    <Text style={styles.listMeta}>
                      {String(n.createdAt).slice(0, 16).replace('T', ' ')}
                    </Text>
                  ) : null}
                </AppCard>
              ))
            ) : (
              <AppCard flat style={styles.mb}>
                <EmptyState
                  title="No notes yet"
                  description="Capture context after visits so the team stays aligned."
                  icon="create-outline"
                />
              </AppCard>
            )}
            <AppCard>
              <FormField label="Add note" value={note} onChangeText={setNote} multiline />
              <VoiceNoteRecorder onAttach={attachVoice} disabled={busy} />
              <PrimaryButton title="Save note" onPress={() => void saveNote()} loading={busy} fullWidth />
            </AppCard>
          </View>
        ) : null}
      </ScrollView>

      <ContextualActionsSheet
        visible={actionsOpen}
        onClose={() => setActionsOpen(false)}
        title="Company actions"
        actions={[
          {
            key: 'scan',
            label: 'Scan business card',
            onPress: () =>
              router.push({
                pathname: '/(app)/crm/business-card',
                params: { companyId },
              }),
          },
          {
            key: 'call',
            label: 'Call',
            onPress: () => void openTel(phone),
          },
          {
            key: 'wa',
            label: 'WhatsApp',
            onPress: () => void openWhatsApp(phone, `Hi ${name}`),
          },
          {
            key: 'meeting',
            label: 'Meeting',
            onPress: () => router.push('/(app)/crm/meetings/create'),
          },
          {
            key: 'quote',
            label: 'Quotation',
            onPress: () => router.push('/(app)/crm/quotations'),
          },
          {
            key: 'fu',
            label: 'Follow-up',
            onPress: () =>
              router.push({
                pathname: '/(app)/crm/follow-ups/create',
                params: { companyId },
              }),
          },
        ]}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.background },
  scroll: { paddingBottom: spacing.hero },
  heroBlock: { paddingHorizontal: layout.screenPadding, paddingTop: spacing.xs },
  headerCard: { marginBottom: spacing.md },
  heroTop: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.lg },
  heroCopy: { flex: 1, minWidth: 0 },
  companyName: { ...typography.title, fontSize: 22, letterSpacing: -0.3 },
  metaLine: { ...typography.caption, marginTop: spacing.xs, color: colors.textSecondary },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  ownerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.lg,
    paddingTop: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.divider,
    gap: spacing.md,
  },
  ownerLabel: { ...typography.micro, textTransform: 'uppercase', color: colors.textMuted },
  ownerValue: { ...typography.captionStrong, color: colors.text, flexShrink: 1 },
  kpiRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.lg,
  },
  kpiTile: {
    flex: 1,
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.lg,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.sm,
    minHeight: 68,
    justifyContent: 'center',
  },
  kpiLabel: {
    ...typography.micro,
    textTransform: 'uppercase',
    color: colors.textMuted,
    marginBottom: 4,
  },
  kpiValue: {
    ...typography.captionStrong,
    color: colors.text,
    fontSize: 15,
    letterSpacing: -0.2,
  },
  contactActions: { marginTop: spacing.lg },
  contactHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  contactCopy: { flex: 1, minWidth: 0 },
  tabSticky: {
    backgroundColor: colors.background,
    paddingBottom: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.divider,
  },
  tabBar: {
    paddingHorizontal: layout.screenPadding,
    gap: spacing.sm,
    paddingVertical: spacing.xs,
  },
  tabItem: {
    minHeight: layout.minTouch,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm + 2,
    borderRadius: radius.full,
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabItemActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  tabPressed: { opacity: 0.9, transform: [{ scale: 0.98 }] },
  tabLabel: { ...typography.captionStrong, color: colors.textSecondary, fontSize: 13 },
  tabLabelActive: { color: colors.textInverse },
  panel: { paddingHorizontal: layout.screenPadding, paddingTop: spacing.md },
  infoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
    marginBottom: spacing.sm,
  },
  plainBody: { ...typography.body, color: colors.textSecondary },
  overviewActions: { marginTop: spacing.xxl, gap: spacing.md },
  mb: { marginBottom: spacing.md },
  listCardHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
    marginBottom: spacing.xs,
  },
  listTitle: { ...typography.bodyStrong, flex: 1 },
  listMeta: { ...typography.caption, marginTop: spacing.xs, color: colors.textMuted },
  kindLabel: {
    ...typography.micro,
    textTransform: 'uppercase',
    color: colors.textMuted,
    flex: 1,
  },
  noteAuthor: {
    ...typography.captionStrong,
    color: colors.textSecondary,
    marginBottom: spacing.xs,
  },
  noteBody: { ...typography.body },
  balanceBlock: { gap: spacing.lg },
  balanceHero: {
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.lg,
    padding: spacing.lg,
  },
  balanceValue: {
    ...typography.metric,
    marginTop: spacing.xs,
    color: colors.text,
  },
})

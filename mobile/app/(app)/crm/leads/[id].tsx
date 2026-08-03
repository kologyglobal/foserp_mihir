import { useState } from 'react'
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { useLocalSearchParams, useRouter } from 'expo-router'
import {
  AppCard,
  AppHeader,
  Avatar,
  EmptyState,
  FormField,
  IconButton,
  Loading,
  PrimaryButton,
  SectionHeader,
  StatusChip,
  Timeline,
} from '@/components'
import {
  useEntityAttachments,
  useEntityNotes,
  useInvalidateCrm,
  useLead,
  useQuotations,
  useSalesOrders,
  useFollowUps,
} from '@/features/crm/hooks'
import { convertLead, createEntityNote, createEntityAttachment } from '@/api/crmApi'
import { quotationAmount, salesOrderAmount } from '@/features/crm/commercialMap'
import { QuickContactActions } from '@/features/crm/components/QuickContactActions'
import { ContextualActionsSheet } from '@/features/crm/components/ContextualActionsSheet'
import { EntityMissingState } from '@/features/crm/components/EntityMissingState'
import { VoiceNoteRecorder } from '@/features/crm/components/VoiceNoteRecorder'
import {
  formatDate,
  formatMoney,
  openTel,
  openWhatsApp,
  statusTone,
  titleCaseLabel,
} from '@/features/crm/utils'
import { colors, layout, radius, spacing, typography } from '@/theme'
import { getUserFriendlyMessage } from '@/api/errors'
import * as ImagePicker from 'expo-image-picker'
import { readFileBase64 } from '@/utils/files'
import {
  decodeLeadRequirementLines,
  isEncodedLeadRequirementPayload,
  leadRequirementDisplayText,
} from '@/utils/leadRequirementLines'
import { saveOfflineDraft } from '@/features/crm/offlineDrafts'
import { useSessionStore } from '@/store/sessionStore'
import { usePermissions } from '@/auth/permissions'

const TABS = [
  'Overview',
  'Contacts',
  'Timeline',
  'Follow-ups',
  'Quotations',
  'Sales Orders',
  'Files',
  'Notes',
] as const

type Tab = (typeof TABS)[number]

const TAB_SHORT: Record<Tab, string> = {
  Overview: 'Overview',
  Contacts: 'Contacts',
  Timeline: 'Timeline',
  'Follow-ups': 'Follow-ups',
  Quotations: 'Quotes',
  'Sales Orders': 'Orders',
  Files: 'Files',
  Notes: 'Notes',
}

export default function LeadDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const leadId = String(id || '')
  const { data: lead, isLoading, error, refetch } = useLead(leadId)
  const notes = useEntityNotes('LEAD', leadId)
  const files = useEntityAttachments('LEAD', leadId)
  const fus = useFollowUps('mine')
  const quotes = useQuotations()
  const sos = useSalesOrders()
  const [tab, setTab] = useState<Tab>('Overview')
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [actionsOpen, setActionsOpen] = useState(false)
  const invalidate = useInvalidateCrm()
  const online = useSessionStore((s) => s.isOnline)
  const router = useRouter()
  const { can } = usePermissions()

  const leadFollowUps = (fus.data ?? []).filter((f) => f.leadId === leadId)
  const leadQuotes = (quotes.data ?? []).filter(
    (q) => q.opportunityId === lead?.opportunityId || String(q.companyId) === String(lead?.customerId),
  )
  const leadSos = (sos.data ?? []).filter((s) => String(s.companyId) === String(lead?.customerId))

  const requirementLines = lead
    ? decodeLeadRequirementLines(lead.productRequirement, null, lead.remarks).lines
    : []
  const requirementNotes =
    lead && isEncodedLeadRequirementPayload(lead.productRequirement)
      ? String(lead.remarks ?? '').trim()
      : String(lead?.remarks ?? lead?.productRequirement ?? '').trim()
  const requirementFallback =
    lead && !requirementLines.length
      ? leadRequirementDisplayText(lead.productRequirement, null, lead.remarks) || requirementNotes
      : ''

  const stageLabel = titleCaseLabel(lead?.stage || lead?.lifecycleStatus, 'Prospect')
  const priorityLabel = titleCaseLabel(lead?.priority, '—')
  const companyName = lead?.companyName || lead?.customerName || ''
  const notesList = notes.data ?? []
  const filesList = files.data ?? []

  const tabCount = (t: Tab): number | undefined => {
    if (t === 'Follow-ups') return leadFollowUps.length || undefined
    if (t === 'Quotations') return leadQuotes.length || undefined
    if (t === 'Sales Orders') return leadSos.length || undefined
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
          entityType: 'LEAD',
          entityId: leadId,
          content: note.trim(),
        })
        Alert.alert('Saved offline', 'Note will sync when you are online.')
      } else {
        await createEntityNote('LEAD', leadId, note.trim())
        invalidate()
      }
      setNote('')
    } catch (e) {
      Alert.alert('Note failed', getUserFriendlyMessage(e))
    } finally {
      setBusy(false)
    }
  }

  const pickPhoto = async () => {
    const res = await ImagePicker.launchCameraAsync({ quality: 0.7, base64: true })
    if (res.canceled || !res.assets[0]) return
    const asset = res.assets[0]
    const base64 = asset.base64 || (asset.uri ? await readFileBase64(asset.uri) : '')
    if (!base64) return
    setBusy(true)
    try {
      const payload = {
        entityType: 'LEAD',
        entityId: leadId,
        originalFilename: asset.fileName || 'photo.jpg',
        mimeType: asset.mimeType || 'image/jpeg',
        contentBase64: base64,
        documentType: 'PHOTO',
      }
      if (!online) {
        await saveOfflineDraft('photo', payload)
        Alert.alert('Photo saved offline', 'Will upload when online.')
      } else {
        await createEntityAttachment('LEAD', leadId, payload)
        invalidate()
      }
    } catch (e) {
      Alert.alert('Upload failed', getUserFriendlyMessage(e))
    } finally {
      setBusy(false)
    }
  }

  const attachVoice = async (file: {
    localUri: string
    originalFilename: string
    mimeType: string
  }) => {
    if (!online) {
      await saveOfflineDraft(
        'audio',
        {
          entityType: 'LEAD',
          entityId: leadId,
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
    const base64 = await readFileBase64(file.localUri)
    await createEntityAttachment('LEAD', leadId, {
      originalFilename: file.originalFilename,
      mimeType: file.mimeType,
      contentBase64: base64,
      documentType: 'VOICE_NOTE',
    })
    invalidate()
  }

  const doConvert = async () => {
    if (!can('crm.lead.convert') && !can('tenant.manage')) {
      Alert.alert('Permission denied')
      return
    }
    try {
      await convertLead(leadId)
      invalidate()
      Alert.alert('Converted')
    } catch (e) {
      Alert.alert('Convert failed', getUserFriendlyMessage(e))
    }
  }

  const openFollowUpCreate = () =>
    router.push({
      pathname: '/(app)/crm/follow-ups/create',
      params: { leadId },
    })

  if (!leadId) {
    return <EntityMissingState title="Lead" entityLabel="lead" />
  }
  if (isLoading) return <Loading fullScreen />
  if (error || !lead) {
    return (
      <EntityMissingState
        title="Lead"
        entityLabel="lead"
        error={error ?? new Error('Not found')}
        onRetry={() => void refetch()}
      />
    )
  }

  return (
    <View style={styles.flex}>
      <AppHeader
        title={lead.leadNo || lead.leadCode || 'Lead'}
        subtitle={stageLabel}
        onBack={() => router.back()}
        right={
          <IconButton
            name="ellipsis-horizontal"
            accessibilityLabel="Lead actions"
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
              <Avatar name={lead.prospectName} size={56} />
              <View style={styles.heroCopy}>
                <Text style={styles.prospectName} numberOfLines={2}>
                  {lead.prospectName}
                </Text>
                {companyName ? (
                  <Text style={styles.companyName} numberOfLines={1}>
                    {companyName}
                  </Text>
                ) : null}
                <View style={styles.chipRow}>
                  <StatusChip label={stageLabel} tone={statusTone(lead.stage)} />
                  {lead.priority ? (
                    <StatusChip label={priorityLabel} tone={statusTone(lead.priority)} />
                  ) : null}
                </View>
              </View>
            </View>

            <View style={styles.ownerRow}>
              <Text style={styles.ownerLabel}>Owner</Text>
              <Text style={styles.ownerValue} numberOfLines={1}>
                {lead.leadOwnerName || 'Unassigned'}
              </Text>
            </View>

            <View style={styles.kpiRow}>
              <View style={styles.kpiTile}>
                <Text style={styles.kpiLabel}>Value</Text>
                <Text style={styles.kpiValue} numberOfLines={1}>
                  {formatMoney(lead.expectedValue)}
                </Text>
              </View>
              <View style={styles.kpiTile}>
                <Text style={styles.kpiLabel}>Priority</Text>
                <Text style={styles.kpiValue} numberOfLines={1}>
                  {priorityLabel}
                </Text>
              </View>
              <View style={styles.kpiTile}>
                <Text style={styles.kpiLabel}>Next FU</Text>
                <Text style={styles.kpiValue} numberOfLines={1}>
                  {formatDate(lead.nextFollowUpDate)}
                </Text>
              </View>
            </View>

            <View style={styles.contactActions}>
              <QuickContactActions
                phone={lead.mobile}
                email={lead.email}
                whatsappText={`Hi ${lead.prospectName}`}
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
            <SectionHeader title="Requirements" />
            {requirementLines.length > 0 ? (
              <View style={styles.linesList}>
                {requirementLines.map((line, idx) => {
                  const title =
                    String(line.productOrItem ?? '').trim() ||
                    String(line.description ?? '').trim() ||
                    'Line item'
                  const qty = line.qty ?? 1
                  const uom = line.uom ? ` ${line.uom}` : ''
                  return (
                    <AppCard key={line.id || `${line.itemCode ?? 'line'}-${idx}`} style={styles.lineCard} flat>
                      <View style={styles.lineHead}>
                        <View style={styles.lineIndex}>
                          <Text style={styles.lineIndexText}>{line.lineNo ?? idx + 1}</Text>
                        </View>
                        <View style={styles.lineHeadCopy}>
                          <Text style={styles.lineTitle} numberOfLines={2}>
                            {title}
                          </Text>
                          {line.itemCode ? (
                            <Text style={styles.lineCode} numberOfLines={1}>
                              {line.itemCode}
                            </Text>
                          ) : null}
                        </View>
                        <Text style={styles.lineTotal}>{formatMoney(line.lineTotal)}</Text>
                      </View>
                      {line.description && String(line.description).trim() !== title ? (
                        <Text style={styles.lineDesc} numberOfLines={2}>
                          {line.description}
                        </Text>
                      ) : null}
                      <View style={styles.lineMetaRow}>
                        <View style={styles.lineMetaCell}>
                          <Text style={styles.lineMetaLabel}>Qty</Text>
                          <Text style={styles.lineMetaValue}>
                            {qty}
                            {uom}
                          </Text>
                        </View>
                        <View style={styles.lineMetaCell}>
                          <Text style={styles.lineMetaLabel}>Unit</Text>
                          <Text style={styles.lineMetaValue}>{formatMoney(line.unitPrice)}</Text>
                        </View>
                        {line.taxPct ? (
                          <View style={styles.lineMetaCell}>
                            <Text style={styles.lineMetaLabel}>Tax</Text>
                            <Text style={styles.lineMetaValue}>{line.taxPct}%</Text>
                          </View>
                        ) : null}
                      </View>
                    </AppCard>
                  )
                })}
              </View>
            ) : (
              <AppCard flat>
                {requirementFallback ? (
                  <Text style={styles.plainReq}>{requirementFallback}</Text>
                ) : (
                  <EmptyState
                    title="No requirements yet"
                    description="Product lines and notes for this lead will show here."
                    icon="cube-outline"
                  />
                )}
              </AppCard>
            )}

            {requirementNotes && requirementLines.length > 0 ? (
              <>
                <SectionHeader title="Notes" />
                <AppCard flat>
                  <Text style={styles.plainReq}>{requirementNotes}</Text>
                </AppCard>
              </>
            ) : null}

            <View style={styles.overviewActions}>
              <PrimaryButton title="Log follow-up" onPress={openFollowUpCreate} fullWidth />
              <Pressable
                onPress={() => void doConvert()}
                style={({ pressed }) => [styles.secondaryAction, pressed && styles.tabPressed]}
                accessibilityRole="button"
                accessibilityLabel="Convert lead"
              >
                <Text style={styles.secondaryActionText}>Convert lead</Text>
              </Pressable>
            </View>
          </View>
        ) : null}

        {tab === 'Contacts' ? (
          <View style={styles.panel}>
            {lead.contactPerson || lead.mobile || lead.email ? (
              <AppCard>
                <View style={styles.contactHead}>
                  <Avatar name={lead.contactPerson || lead.prospectName} size={48} />
                  <View style={styles.contactCopy}>
                    <Text style={styles.listTitle} numberOfLines={1}>
                      {lead.contactPerson || lead.prospectName}
                    </Text>
                    {lead.mobile ? <Text style={styles.listMeta}>{lead.mobile}</Text> : null}
                    {lead.email ? <Text style={styles.listMeta}>{lead.email}</Text> : null}
                  </View>
                </View>
                <View style={styles.contactActions}>
                  <QuickContactActions
                    phone={lead.mobile}
                    email={lead.email}
                    whatsappText={`Hi ${lead.prospectName}`}
                  />
                </View>
              </AppCard>
            ) : (
              <AppCard flat>
                <EmptyState
                  title="No contact details"
                  description="Add a mobile or email so you can reach this prospect."
                  icon="person-outline"
                />
              </AppCard>
            )}
          </View>
        ) : null}

        {tab === 'Timeline' ? (
          <View style={styles.panel}>
            {notesList.length > 0 ? (
              <Timeline
                items={notesList.map((n) => ({
                  id: n.id,
                  title: 'Note',
                  subtitle: n.content,
                  time: n.createdAt?.slice?.(0, 16)?.replace?.('T', ' ') || n.createdAt,
                  icon: 'document-text-outline',
                  tone: 'info',
                }))}
              />
            ) : (
              <AppCard flat>
                <EmptyState
                  title="No timeline yet"
                  description="Notes and activity on this lead will appear here."
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
            {leadFollowUps.length ? (
              leadFollowUps.map((f) => (
                <AppCard key={f.id} style={styles.mb} flat>
                  <View style={styles.listCardHead}>
                    <Text style={styles.listTitle}>{titleCaseLabel(f.followUpType)}</Text>
                    <StatusChip label={titleCaseLabel(f.status)} tone={statusTone(f.status)} />
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
                  description="Schedule the next touch so this lead stays warm."
                  icon="alarm-outline"
                  actionLabel="Schedule follow-up"
                  onAction={openFollowUpCreate}
                />
              </AppCard>
            )}
          </View>
        ) : null}

        {tab === 'Quotations' ? (
          <View style={styles.panel}>
            {leadQuotes.length ? (
              leadQuotes.map((q) => (
                <Pressable
                  key={q.id}
                  onPress={() => router.push(`/(app)/crm/quotations/${q.id}`)}
                  style={({ pressed }) => pressed && styles.tabPressed}
                >
                  <AppCard style={styles.mb} flat>
                    <View style={styles.listCardHead}>
                      <Text style={styles.listTitle}>{q.quotationCode || q.quotationNo || 'Quote'}</Text>
                      {q.status ? (
                        <StatusChip label={titleCaseLabel(q.status)} tone={statusTone(q.status)} />
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
                  description="Quotes linked to this lead will show up here."
                  icon="document-text-outline"
                />
              </AppCard>
            )}
          </View>
        ) : null}

        {tab === 'Sales Orders' ? (
          <View style={styles.panel}>
            {leadSos.length ? (
              leadSos.map((s) => (
                <Pressable
                  key={s.id}
                  onPress={() => router.push(`/(app)/crm/sales-orders/${s.id}`)}
                  style={({ pressed }) => pressed && styles.tabPressed}
                >
                  <AppCard style={styles.mb} flat>
                    <View style={styles.listCardHead}>
                      <Text style={styles.listTitle}>{s.salesOrderNo || s.soNumber || 'Order'}</Text>
                      {s.status ? (
                        <StatusChip label={titleCaseLabel(s.status)} tone={statusTone(s.status)} />
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
                  description="Orders for this customer will appear after conversion."
                  icon="cart-outline"
                />
              </AppCard>
            )}
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
                  </Text>
                </AppCard>
              ))
            ) : (
              <AppCard flat style={styles.mb}>
                <EmptyState
                  title="No files yet"
                  description="Snap a photo or attach documents on the go."
                  icon="folder-open-outline"
                />
              </AppCard>
            )}
            <PrimaryButton title="Camera upload" onPress={() => void pickPhoto()} loading={busy} fullWidth />
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
                  description="Capture context after calls so the next visit is easier."
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
        title="Lead actions"
        actions={[
          { key: 'call', label: 'Call', onPress: () => void openTel(lead.mobile) },
          {
            key: 'wa',
            label: 'WhatsApp',
            onPress: () => void openWhatsApp(lead.mobile, `Hi ${lead.prospectName}`),
          },
          {
            key: 'fu',
            label: 'Follow-up',
            onPress: openFollowUpCreate,
          },
          {
            key: 'meeting',
            label: 'Meeting',
            onPress: () => router.push('/(app)/crm/meetings/create'),
          },
          { key: 'convert', label: 'Convert', onPress: () => void doConvert() },
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
  prospectName: { ...typography.title, fontSize: 22, letterSpacing: -0.3 },
  companyName: { ...typography.caption, marginTop: spacing.xs, color: colors.textSecondary },
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
  linesList: { gap: spacing.md },
  lineCard: { marginBottom: 0 },
  lineHead: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md },
  lineIndex: {
    width: 28,
    height: 28,
    borderRadius: 10,
    backgroundColor: colors.primaryMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  lineIndexText: { ...typography.captionStrong, color: colors.primary, fontSize: 12 },
  lineHeadCopy: { flex: 1, minWidth: 0 },
  lineTitle: { ...typography.bodyStrong },
  lineCode: { ...typography.micro, marginTop: 2, color: colors.textMuted },
  lineTotal: { ...typography.bodyStrong, color: colors.primary },
  lineDesc: {
    ...typography.caption,
    marginTop: spacing.sm,
    color: colors.textMuted,
    paddingLeft: 28 + spacing.md,
  },
  lineMetaRow: {
    flexDirection: 'row',
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.divider,
    gap: spacing.md,
    paddingLeft: 28 + spacing.md,
  },
  lineMetaCell: { flex: 1 },
  lineMetaLabel: { ...typography.micro, textTransform: 'uppercase', marginBottom: 2 },
  lineMetaValue: { ...typography.captionStrong, color: colors.text },
  plainReq: { ...typography.body, color: colors.textSecondary },
  overviewActions: { marginTop: spacing.xxl, gap: spacing.md },
  secondaryAction: {
    minHeight: layout.minTouch,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.md,
  },
  secondaryActionText: { ...typography.button, color: colors.primary },
  mb: { marginBottom: spacing.md },
  listCardHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  listTitle: { ...typography.bodyStrong, flex: 1 },
  listMeta: { ...typography.caption, marginTop: spacing.xs, color: colors.textMuted },
  noteAuthor: { ...typography.captionStrong, color: colors.textSecondary, marginBottom: spacing.xs },
  noteBody: { ...typography.body },
})

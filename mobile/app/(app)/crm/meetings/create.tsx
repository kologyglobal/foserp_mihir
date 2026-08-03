import { useState } from 'react'
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import { useLocalSearchParams, useRouter } from 'expo-router'
import {
  AppHeader,
  FormField,
  FormSection,
  PrimaryButton,
  StatusChip,
  StickyFormFooter,
  WizardStepper,
} from '@/components'
import { createActivity, createEntityAttachment, createFollowUp } from '@/api/crmApi'
import { saveOfflineDraft } from '@/features/crm/offlineDrafts'
import { todayYmd } from '@/features/crm/utils'
import { useInvalidateCrm } from '@/features/crm/hooks'
import { useSessionStore } from '@/store/sessionStore'
import { getUserFriendlyMessage } from '@/api/errors'
import { colors, layout, spacing, typography } from '@/theme'
import * as ImagePicker from 'expo-image-picker'
import { readFileBase64 } from '@/utils/files'
import { VoiceNoteRecorder } from '@/features/crm/components/VoiceNoteRecorder'
import { newClientKey } from '@/features/crm/offlineDraftLogic'

type PendingMedia = {
  localUri: string
  originalFilename: string
  mimeType: string
  documentType: string
  contentBase64?: string
}

const STEPS = [
  { key: 'meeting', label: 'Meeting' },
  { key: 'media', label: 'Media' },
] as const

function paramOne(v: string | string[] | undefined): string | undefined {
  if (Array.isArray(v)) return v[0]
  return v || undefined
}

export default function CreateMeetingScreen() {
  const params = useLocalSearchParams<{
    opportunityId?: string
    customerId?: string
    companyId?: string
    companyName?: string
    subject?: string
  }>()
  const opportunityId = paramOne(params.opportunityId)
  const customerId = paramOne(params.customerId) || paramOne(params.companyId)
  const prefillSubject = paramOne(params.subject)

  const [step, setStep] = useState(0)
  const [subject, setSubject] = useState(prefillSubject ?? '')
  const [agenda, setAgenda] = useState('')
  const [outcome, setOutcome] = useState('')
  const [nextFu, setNextFu] = useState(todayYmd())
  const [media, setMedia] = useState<PendingMedia[]>([])
  const [busy, setBusy] = useState(false)
  const online = useSessionStore((s) => s.isOnline)
  const userId = useSessionStore((s) => s.profile?.user.id)
  const invalidate = useInvalidateCrm()
  const router = useRouter()

  const goBack = () => {
    if (step === 0) router.back()
    else setStep((s) => s - 1)
  }

  const capturePhoto = async () => {
    const res = await ImagePicker.launchCameraAsync({ quality: 0.7, base64: true })
    if (res.canceled || !res.assets[0]) return
    const asset = res.assets[0]
    const base64 = asset.base64 || (asset.uri ? await readFileBase64(asset.uri) : '')
    setMedia((prev) => [
      ...prev,
      {
        localUri: asset.uri,
        originalFilename: asset.fileName || 'meeting.jpg',
        mimeType: asset.mimeType || 'image/jpeg',
        documentType: 'MEETING_PHOTO',
        contentBase64: base64 || undefined,
      },
    ])
  }

  const submit = async () => {
    if (!subject.trim()) {
      Alert.alert('Required', 'Meeting subject is required')
      setStep(0)
      return
    }
    setBusy(true)
    const clientKey = newClientKey('meeting')
    const payload = {
      type: 'meeting',
      subject: subject.trim(),
      description: [agenda && `Agenda: ${agenda}`, outcome && `Outcome: ${outcome}`]
        .filter(Boolean)
        .join('\n'),
      ownerId: userId ?? null,
      activityDate: new Date().toISOString(),
      status: outcome ? 'completed' : 'planned',
      outcome: outcome || undefined,
      nextAction: nextFu ? `Follow-up ${nextFu}` : undefined,
      clientKey,
      ...(opportunityId ? { opportunityId } : {}),
      ...(customerId ? { customerId } : {}),
    }
    try {
      if (!online) {
        await saveOfflineDraft('meeting', payload, {
          clientKey,
          attachments: media.map((m) => ({
            localUri: m.localUri,
            originalFilename: m.originalFilename,
            mimeType: m.mimeType,
            documentType: m.documentType,
          })),
        })
        Alert.alert('Saved offline', 'Meeting will sync when online.')
        router.back()
        return
      }

      const created = await createActivity(payload)
      const activityId = created.data?.id
      if (activityId && media.length) {
        for (const m of media) {
          const base64 = m.contentBase64 || (await readFileBase64(m.localUri))
          await createEntityAttachment('ACTIVITY', activityId, {
            originalFilename: m.originalFilename,
            mimeType: m.mimeType,
            contentBase64: base64,
            documentType: m.documentType,
          })
        }
      }
      if (nextFu) {
        await createFollowUp({
          followUpType: 'meeting_follow_up',
          dueDate: nextFu,
          notes: `After meeting: ${subject}`,
          priority: 'medium',
          assignedTo: userId ?? null,
        })
      }
      invalidate()
      router.back()
    } catch (e) {
      Alert.alert('Save failed', getUserFriendlyMessage(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <View style={styles.flex}>
      <AppHeader title="Meeting" subtitle={STEPS[step]?.label} onBack={goBack} />
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <WizardStepper steps={[...STEPS]} currentIndex={step} />

          {step === 0 ? (
            <FormSection
              title="What happened?"
              description="Subject and agenda first — media on the next step."
            >
              <FormField
                label="Subject"
                value={subject}
                onChangeText={setSubject}
                placeholder="Customer visit / demo / review"
                autoFocus
              />
              <FormField
                label="Agenda"
                value={agenda}
                onChangeText={setAgenda}
                multiline
                placeholder="Topics to cover"
                style={styles.multi}
              />
              <FormField
                label="Outcome"
                value={outcome}
                onChangeText={setOutcome}
                multiline
                placeholder="What was decided?"
                style={styles.multi}
              />
              <FormField
                label="Next follow-up"
                value={nextFu}
                onChangeText={setNextFu}
                placeholder="YYYY-MM-DD"
                hint="Creates a follow-up after save"
              />
            </FormSection>
          ) : null}

          {step === 1 ? (
            <FormSection
              title="Photos & voice"
              description="Capture evidence in the field — uploads with the meeting."
            >
              <PrimaryButton title="Capture photo" onPress={() => void capturePhoto()} fullWidth />
              <View style={styles.gap} />
              <VoiceNoteRecorder
                onAttach={async (file) => {
                  setMedia((prev) => [
                    ...prev,
                    {
                      localUri: file.localUri,
                      originalFilename: file.originalFilename,
                      mimeType: file.mimeType,
                      documentType: 'VOICE_NOTE',
                    },
                  ])
                }}
              />
              {media.length ? (
                <View style={styles.mediaList}>
                  <Text style={styles.mediaTitle}>{media.length} attachment(s)</Text>
                  {media.map((m, i) => (
                    <View key={`${m.originalFilename}_${i}`} style={styles.mediaRow}>
                      <Text style={styles.meta} numberOfLines={1}>
                        {m.originalFilename}
                      </Text>
                      <StatusChip label={m.documentType} tone="info" />
                    </View>
                  ))}
                </View>
              ) : (
                <Text style={styles.emptyMedia}>No media yet — optional.</Text>
              )}
            </FormSection>
          ) : null}
        </ScrollView>

        <StickyFormFooter
          primaryTitle={step === 0 ? 'Continue' : busy ? 'Saving…' : 'Save meeting'}
          onPrimary={() => {
            if (step === 0) {
              if (!subject.trim()) {
                Alert.alert('Required', 'Meeting subject is required')
                return
              }
              setStep(1)
            } else void submit()
          }}
          secondaryTitle={step === 0 ? undefined : 'Back'}
          onSecondary={step === 0 ? undefined : () => setStep(0)}
          loading={busy}
          primaryDisabled={busy}
        />
      </KeyboardAvoidingView>
    </View>
  )
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.background },
  scroll: {
    paddingHorizontal: layout.screenPadding,
    paddingTop: spacing.sm,
    paddingBottom: 120,
  },
  multi: { minHeight: 88, textAlignVertical: 'top' },
  gap: { height: spacing.md },
  mediaList: { marginTop: spacing.lg, gap: spacing.sm },
  mediaTitle: { ...typography.captionStrong, color: colors.textSecondary, marginBottom: spacing.xs },
  mediaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.divider,
  },
  meta: { ...typography.caption, flex: 1 },
  emptyMedia: { ...typography.caption, color: colors.textMuted, marginTop: spacing.lg },
})

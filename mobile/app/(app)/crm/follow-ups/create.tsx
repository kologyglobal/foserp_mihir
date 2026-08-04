import { useState } from 'react'
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native'
import { useLocalSearchParams, useRouter } from 'expo-router'
import {
  AppHeader,
  ChoiceChips,
  FormField,
  FormSection,
  StickyFormFooter,
  WizardStepper,
} from '@/components'
import { createFollowUp } from '@/api/crmApi'
import { saveOfflineDraft } from '@/features/crm/offlineDrafts'
import { todayYmd } from '@/features/crm/utils'
import { useInvalidateCrm } from '@/features/crm/hooks'
import { useSessionStore } from '@/store/sessionStore'
import { showToast } from '@/store/toastStore'
import { getUserFriendlyMessage } from '@/api/errors'
import { colors, layout, spacing } from '@/theme'

const STEPS = [
  { key: 'when', label: 'When' },
  { key: 'details', label: 'Details' },
] as const

const TYPES = [
  { value: 'call', label: 'Call' },
  { value: 'meeting', label: 'Meeting' },
  { value: 'visit', label: 'Visit' },
  { value: 'email', label: 'Email' },
]

const PRIORITIES = [
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' },
]

function paramOne(v: string | string[] | undefined): string | undefined {
  if (Array.isArray(v)) return v[0]
  return v || undefined
}

export default function CreateFollowUpScreen() {
  const params = useLocalSearchParams<{
    opportunityId?: string
    customerId?: string
    companyId?: string
    companyName?: string
    leadId?: string
  }>()
  const opportunityId = paramOne(params.opportunityId)
  const customerId = paramOne(params.customerId) || paramOne(params.companyId)
  const companyName = paramOne(params.companyName)
  const leadId = paramOne(params.leadId)

  const [step, setStep] = useState(0)
  const [followUpType, setType] = useState('call')
  const [dueDate, setDueDate] = useState(todayYmd())
  const [dueTime, setDueTime] = useState('10:00')
  const [notes, setNotes] = useState(
    companyName ? `Follow-up: ${companyName}` : '',
  )
  const [priority, setPriority] = useState('medium')
  const [busy, setBusy] = useState(false)
  const online = useSessionStore((s) => s.isOnline)
  const userId = useSessionStore((s) => s.profile?.user.id)
  const invalidate = useInvalidateCrm()
  const router = useRouter()

  const goBack = () => {
    if (step === 0) router.back()
    else setStep((s) => s - 1)
  }

  const submit = async () => {
    setBusy(true)
    const payload = {
      followUpType: followUpType.trim() || 'call',
      dueDate,
      dueTime,
      notes: notes.trim() || undefined,
      priority,
      assignedTo: userId ?? null,
      ...(opportunityId ? { opportunityId } : {}),
      ...(customerId ? { customerId } : {}),
      ...(leadId ? { leadId } : {}),
    }
    try {
      if (!online) {
        await saveOfflineDraft('follow_up', payload)
        showToast('Saved offline — will sync when online', 'warning')
        router.back()
        return
      }
      await createFollowUp(payload)
      invalidate()
      showToast('Follow-up scheduled', 'success')
      router.back()
    } catch (e) {
      showToast(getUserFriendlyMessage(e), 'danger')
    } finally {
      setBusy(false)
    }
  }

  return (
    <View style={styles.flex}>
      <AppHeader title="New follow-up" subtitle={STEPS[step]?.label} onBack={goBack} />
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
              title="Schedule the touch"
              description="Pick type and when you’ll follow up."
            >
              <ChoiceChips
                label="Type"
                options={TYPES}
                value={followUpType}
                onChange={setType}
              />
              <FormField
                label="Due date"
                value={dueDate}
                onChangeText={setDueDate}
                placeholder="YYYY-MM-DD"
                hint="Format: YYYY-MM-DD"
              />
              <FormField
                label="Due time"
                value={dueTime}
                onChangeText={setDueTime}
                placeholder="HH:mm"
              />
              <ChoiceChips
                label="Priority"
                options={PRIORITIES}
                value={priority}
                onChange={setPriority}
              />
            </FormSection>
          ) : null}

          {step === 1 ? (
            <FormSection
              title="Notes"
              description="Context for you or the assignee. Voice transcripts can go here."
            >
              <FormField
                label="Notes"
                value={notes}
                onChangeText={setNotes}
                multiline
                placeholder="Agenda, promises, next steps…"
                style={styles.notes}
              />
            </FormSection>
          ) : null}
        </ScrollView>

        <StickyFormFooter
          primaryTitle={step === 0 ? 'Continue' : busy ? 'Saving…' : 'Save follow-up'}
          onPrimary={() => {
            if (step === 0) setStep(1)
            else void submit()
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
  notes: { minHeight: 120, textAlignVertical: 'top' },
})

import { useMemo, useState } from 'react'
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native'
import { useRouter } from 'expo-router'
import {
  AppHeader,
  ChoiceChips,
  FormField,
  FormSection,
  ReviewRow,
  StickyFormFooter,
  WizardStepper,
} from '@/components'
import { createLead } from '@/api/crmApi'
import { useInvalidateCrm } from '@/features/crm/hooks'
import { useSessionStore } from '@/store/sessionStore'
import { getUserFriendlyMessage } from '@/api/errors'
import { colors, layout, spacing } from '@/theme'

const STEPS = [
  { key: 'identity', label: 'Identity' },
  { key: 'contact', label: 'Contact' },
  { key: 'deal', label: 'Deal' },
  { key: 'review', label: 'Review' },
] as const

const PRIORITIES = [
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' },
]

const SOURCES = [
  { value: 'other', label: 'Other' },
  { value: 'referral', label: 'Referral' },
  { value: 'website', label: 'Website' },
  { value: 'walk_in', label: 'Walk-in' },
  { value: 'campaign', label: 'Campaign' },
]

export default function CreateLeadScreen() {
  const [step, setStep] = useState(0)
  const [prospectName, setProspectName] = useState('')
  const [companyName, setCompanyName] = useState('')
  const [mobile, setMobile] = useState('')
  const [email, setEmail] = useState('')
  const [expectedValue, setExpectedValue] = useState('')
  const [priority, setPriority] = useState('medium')
  const [source, setSource] = useState('other')
  const [busy, setBusy] = useState(false)
  const router = useRouter()
  const invalidate = useInvalidateCrm()
  const userId = useSessionStore((s) => s.profile?.user.id)

  const canNext = useMemo(() => {
    if (step === 0) return prospectName.trim().length > 0
    return true
  }, [step, prospectName])

  const goNext = () => {
    if (step === 0 && !prospectName.trim()) {
      Alert.alert('Required', 'Lead name is required')
      return
    }
    if (step < STEPS.length - 1) setStep((s) => s + 1)
  }

  const goBack = () => {
    if (step === 0) router.back()
    else setStep((s) => s - 1)
  }

  const submit = async () => {
    if (!prospectName.trim()) {
      Alert.alert('Required', 'Lead name is required')
      setStep(0)
      return
    }
    setBusy(true)
    try {
      const res = await createLead({
        prospectName: prospectName.trim(),
        companyName: companyName.trim() || undefined,
        mobile: mobile.trim() || null,
        email: email.trim() || null,
        expectedValue: expectedValue ? Number(expectedValue) : undefined,
        priority,
        source,
        leadOwnerId: userId ?? null,
      })
      invalidate()
      const newId = res.data?.id
      if (!newId) {
        Alert.alert('Lead created', 'Open Leads to continue with the new record.')
        router.replace('/(app)/crm/leads')
        return
      }
      router.replace(`/(app)/crm/leads/${newId}`)
    } catch (e) {
      Alert.alert('Create failed', getUserFriendlyMessage(e))
    } finally {
      setBusy(false)
    }
  }

  const primaryTitle =
    step < STEPS.length - 1 ? 'Continue' : busy ? 'Creating…' : 'Create lead'
  const secondaryTitle = step === 0 ? undefined : 'Back'

  return (
    <View style={styles.flex}>
      <AppHeader
        title="New lead"
        subtitle={STEPS[step]?.label}
        onBack={goBack}
      />
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={8}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <WizardStepper steps={[...STEPS]} currentIndex={step} />

          {step === 0 ? (
            <FormSection
              title="Who is this lead?"
              description="Start with the person and company. You can refine details later."
            >
              <FormField
                label="Lead name"
                value={prospectName}
                onChangeText={setProspectName}
                placeholder="Prospect full name"
                autoFocus
                returnKeyType="next"
              />
              <FormField
                label="Company"
                value={companyName}
                onChangeText={setCompanyName}
                placeholder="Organisation (optional)"
              />
            </FormSection>
          ) : null}

          {step === 1 ? (
            <FormSection
              title="How do we reach them?"
              description="Phone and email power one-tap call, WhatsApp, and mail."
            >
              <FormField
                label="Mobile"
                value={mobile}
                onChangeText={setMobile}
                keyboardType="phone-pad"
                placeholder="+91 …"
                textContentType="telephoneNumber"
              />
              <FormField
                label="Email"
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                placeholder="name@company.com"
                textContentType="emailAddress"
              />
            </FormSection>
          ) : null}

          {step === 2 ? (
            <FormSection
              title="Deal context"
              description="Rough value and priority help the team prioritise follow-ups."
            >
              <FormField
                label="Potential value"
                value={expectedValue}
                onChangeText={setExpectedValue}
                keyboardType="numeric"
                placeholder="0"
                hint="Optional estimate in company currency"
              />
              <ChoiceChips
                label="Priority"
                options={PRIORITIES}
                value={priority}
                onChange={setPriority}
              />
              <ChoiceChips
                label="Source"
                options={SOURCES}
                value={source}
                onChange={setSource}
              />
            </FormSection>
          ) : null}

          {step === 3 ? (
            <FormSection
              title="Review & create"
              description="Confirm details, then create. You can edit more on the lead 360."
            >
              <ReviewRow label="Lead name" value={prospectName.trim()} />
              <ReviewRow label="Company" value={companyName.trim()} />
              <ReviewRow label="Mobile" value={mobile.trim()} />
              <ReviewRow label="Email" value={email.trim()} />
              <ReviewRow
                label="Potential value"
                value={expectedValue.trim() ? expectedValue.trim() : '—'}
              />
              <ReviewRow
                label="Priority"
                value={PRIORITIES.find((p) => p.value === priority)?.label ?? priority}
              />
              <ReviewRow
                label="Source"
                value={SOURCES.find((s) => s.value === source)?.label ?? source}
                last
              />
            </FormSection>
          ) : null}
        </ScrollView>

        <StickyFormFooter
          primaryTitle={primaryTitle}
          onPrimary={() => {
            if (step < STEPS.length - 1) goNext()
            else void submit()
          }}
          secondaryTitle={secondaryTitle}
          onSecondary={step === 0 ? undefined : () => setStep((s) => s - 1)}
          loading={busy}
          primaryDisabled={!canNext || busy}
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
})

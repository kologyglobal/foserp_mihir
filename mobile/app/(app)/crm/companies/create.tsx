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
import { createCompany } from '@/api/crmApi'
import { useInvalidateCrm } from '@/features/crm/hooks'
import { getUserFriendlyMessage } from '@/api/errors'
import { colors, layout, spacing } from '@/theme'

const STEPS = [
  { key: 'identity', label: 'Identity' },
  { key: 'location', label: 'Details' },
  { key: 'review', label: 'Review' },
] as const

const CUSTOMER_TYPES = [
  { value: 'corporate', label: 'Corporate' },
  { value: 'sme', label: 'SME' },
  { value: 'dealer', label: 'Dealer' },
  { value: 'fleet', label: 'Fleet' },
]

export default function CreateCompanyScreen() {
  const [step, setStep] = useState(0)
  const [customerName, setCustomerName] = useState('')
  const [city, setCity] = useState('')
  const [phone, setPhone] = useState('')
  const [industry, setIndustry] = useState('')
  const [customerType, setCustomerType] = useState('corporate')
  const [busy, setBusy] = useState(false)
  const router = useRouter()
  const invalidate = useInvalidateCrm()

  const canNext = useMemo(() => {
    if (step === 0) return customerName.trim().length > 0
    return true
  }, [step, customerName])

  const goNext = () => {
    if (step === 0 && !customerName.trim()) {
      Alert.alert('Required', 'Company name is required')
      return
    }
    if (step < STEPS.length - 1) setStep((s) => s + 1)
  }

  const goBack = () => {
    if (step === 0) router.back()
    else setStep((s) => s - 1)
  }

  const submit = async () => {
    if (!customerName.trim()) {
      Alert.alert('Required', 'Company name is required')
      setStep(0)
      return
    }
    setBusy(true)
    try {
      const res = await createCompany({
        customerName: customerName.trim(),
        city: city.trim() || undefined,
        phone: phone.trim() || undefined,
        industry: industry.trim() || undefined,
        customerType,
      })
      invalidate()
      const newId = res.data?.id
      if (!newId) {
        Alert.alert('Customer created', 'Open Customers to continue with the new record.')
        router.replace('/(app)/(tabs)/customers')
        return
      }
      router.replace(`/(app)/crm/companies/${newId}`)
    } catch (e) {
      Alert.alert('Create failed', getUserFriendlyMessage(e))
    } finally {
      setBusy(false)
    }
  }

  const primaryTitle =
    step < STEPS.length - 1 ? 'Continue' : busy ? 'Creating…' : 'Create customer'
  const secondaryTitle = step === 0 ? undefined : 'Back'

  return (
    <View style={styles.flex}>
      <AppHeader
        title="New customer"
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
              title="Company identity"
              description="Name and segment — enough to open the customer card quickly."
            >
              <FormField
                label="Company name"
                value={customerName}
                onChangeText={setCustomerName}
                placeholder="Legal or trade name"
                autoFocus
              />
              <FormField
                label="Industry"
                value={industry}
                onChangeText={setIndustry}
                placeholder="e.g. Logistics, Manufacturing"
              />
              <ChoiceChips
                label="Customer type"
                options={CUSTOMER_TYPES}
                value={customerType}
                onChange={setCustomerType}
              />
            </FormSection>
          ) : null}

          {step === 1 ? (
            <FormSection
              title="Location & contact"
              description="City and phone power filters, collection, and one-tap call."
            >
              <FormField
                label="City"
                value={city}
                onChangeText={setCity}
                placeholder="Headquarters city"
              />
              <FormField
                label="Phone"
                value={phone}
                onChangeText={setPhone}
                keyboardType="phone-pad"
                placeholder="+91 …"
                textContentType="telephoneNumber"
              />
            </FormSection>
          ) : null}

          {step === 2 ? (
            <FormSection
              title="Review & create"
              description="Confirm details, then create. Full profile can be enriched later."
            >
              <ReviewRow label="Company name" value={customerName.trim()} />
              <ReviewRow label="Industry" value={industry.trim()} />
              <ReviewRow
                label="Type"
                value={
                  CUSTOMER_TYPES.find((t) => t.value === customerType)?.label ?? customerType
                }
              />
              <ReviewRow label="City" value={city.trim()} />
              <ReviewRow label="Phone" value={phone.trim()} last />
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

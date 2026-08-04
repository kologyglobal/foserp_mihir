import { useEffect, useState } from 'react'
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
  Switch,
  Pressable,
} from 'react-native'
import { Redirect, useRouter } from 'expo-router'
import { useForm, Controller } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { getLoginPrefill, login } from '@/auth/sessionService'
import { getUserFriendlyMessage } from '@/api/errors'
import { env } from '@/config/env'
import { useSessionStore } from '@/store/sessionStore'
import {
  AppCard,
  FormField,
  Loading,
  OfflineBanner,
  PrimaryButton,
} from '@/components'
import { colors, radius, shadows, spacing, typography } from '@/theme'
import { useResponsive } from '@/hooks/useResponsive'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

const schema = z.object({
  tenantSlug: z.string().trim().min(2, 'Organisation code is required'),
  email: z.string().trim().email('Enter a valid email'),
  password: z.string().min(1, 'Password is required'),
  rememberLogin: z.boolean(),
})

type FormValues = z.infer<typeof schema>

export default function LoginScreen() {
  const status = useSessionStore((s) => s.status)
  const notice = useSessionStore((s) => s.authNotice)
  const consumeAuthNotice = useSessionStore((s) => s.consumeAuthNotice)
  const isOnline = useSessionStore((s) => s.isOnline)
  const [banner, setBanner] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [prefillReady, setPrefillReady] = useState(false)
  const router = useRouter()
  const { contentMaxWidth, isTablet } = useResponsive()
  const insets = useSafeAreaInsets()

  const {
    control,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      tenantSlug: env.defaultTenantSlug,
      email: '',
      password: '',
      rememberLogin: true,
    },
  })

  useEffect(() => {
    const msg = consumeAuthNotice()
    if (msg) setBanner(msg)
    else if (notice) setBanner(notice)
  }, [consumeAuthNotice, notice])

  useEffect(() => {
    void (async () => {
      const saved = await getLoginPrefill()
      if (saved.tenantSlug) setValue('tenantSlug', saved.tenantSlug)
      if (saved.email) setValue('email', saved.email)
      setValue('rememberLogin', saved.rememberLogin)
      setPrefillReady(true)
    })()
  }, [setValue])

  if (status === 'signed_in') {
    return <Redirect href="/(app)/(tabs)" />
  }

  if (status === 'restoring' || status === 'unknown') {
    return <Loading fullScreen label="Restoring session…" />
  }

  const onSubmit = handleSubmit(async (values) => {
    setSubmitting(true)
    setBanner(null)
    try {
      await login(values)
      router.replace('/(app)/(tabs)')
    } catch (error) {
      setBanner(getUserFriendlyMessage(error))
    } finally {
      setSubmitting(false)
    }
  })

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <OfflineBanner />
      <ScrollView
        contentContainerStyle={[
          styles.scroll,
          {
            paddingTop: Math.max(insets.top, spacing.xl) + spacing.lg,
            paddingBottom: Math.max(insets.bottom, spacing.xl) + spacing.lg,
          },
          isTablet && { alignItems: 'center' },
        ]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={[styles.inner, { maxWidth: contentMaxWidth }]}>
          <View style={styles.brandRow}>
            <View style={styles.brandMark}>
              <Text style={styles.brandMarkText}>FOS</Text>
            </View>
            <View style={styles.brandCopy}>
              <Text style={styles.brand}>FOS Mobile</Text>
              <Text style={styles.brandTag}>Field CRM · built for teams on the move</Text>
            </View>
          </View>

          <Text style={styles.headline}>Welcome back</Text>
          <Text style={styles.sub}>
            Sign in with your organisation code, work email, and password.
          </Text>

          {banner ? (
            <View style={styles.banner} accessibilityRole="alert">
              <Text style={styles.bannerText}>{banner}</Text>
            </View>
          ) : null}

          {!isOnline ? (
            <Text style={styles.offlineHint}>Connect to the network to sign in.</Text>
          ) : null}

          <AppCard style={styles.card}>
            <Controller
              control={control}
              name="tenantSlug"
              render={({ field: { onChange, onBlur, value } }) => (
                <FormField
                  label="Organisation code"
                  value={value}
                  onChangeText={onChange}
                  onBlur={onBlur}
                  autoCapitalize="none"
                  autoCorrect={false}
                  placeholder="e.g. vasant-trailers"
                  error={errors.tenantSlug?.message}
                  editable={!submitting && prefillReady}
                />
              )}
            />
            <Controller
              control={control}
              name="email"
              render={({ field: { onChange, onBlur, value } }) => (
                <FormField
                  label="Email"
                  value={value}
                  onChangeText={onChange}
                  onBlur={onBlur}
                  autoCapitalize="none"
                  autoCorrect={false}
                  keyboardType="email-address"
                  textContentType="username"
                  placeholder="you@company.com"
                  error={errors.email?.message}
                  editable={!submitting}
                />
              )}
            />
            <Controller
              control={control}
              name="password"
              render={({ field: { onChange, onBlur, value } }) => (
                <FormField
                  label="Password"
                  value={value}
                  onChangeText={onChange}
                  onBlur={onBlur}
                  secureTextEntry
                  textContentType="password"
                  placeholder="••••••••"
                  error={errors.password?.message}
                  editable={!submitting}
                />
              )}
            />

            <Controller
              control={control}
              name="rememberLogin"
              render={({ field: { value, onChange } }) => (
                <Pressable
                  style={styles.rememberRow}
                  onPress={() => onChange(!value)}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: value }}
                >
                  <Text style={styles.rememberLabel}>Remember organisation & email</Text>
                  <Switch
                    value={value}
                    onValueChange={onChange}
                    trackColor={{ true: colors.primarySoft, false: colors.border }}
                    thumbColor={value ? colors.primary : colors.surfaceMuted}
                  />
                </Pressable>
              )}
            />

            <PrimaryButton
              title="Sign in"
              onPress={() => void onSubmit()}
              loading={submitting}
              disabled={!isOnline}
              fullWidth
            />
          </AppCard>

          <Text style={styles.footer}>
            {env.appEnv.toUpperCase()} · v{env.appVersion} ({env.buildNumber})
          </Text>
          {env.isDev ? (
            <Text style={styles.devHint} selectable>
              API: {env.apiBaseUrl || '(not set)'}
            </Text>
          ) : null}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.background },
  scroll: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
  },
  inner: { width: '100%', alignSelf: 'center' },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.lg,
    marginBottom: spacing.section,
  },
  brandMark: {
    width: 64,
    height: 64,
    borderRadius: radius.xl,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.card,
  },
  brandMarkText: {
    color: colors.textInverse,
    fontWeight: '800',
    fontSize: 20,
    letterSpacing: 0.8,
  },
  brandCopy: { flex: 1 },
  brand: {
    ...typography.captionStrong,
    color: colors.primary,
    letterSpacing: 0.9,
    textTransform: 'uppercase',
    fontSize: 12,
  },
  brandTag: {
    ...typography.caption,
    color: colors.textMuted,
    marginTop: 4,
  },
  headline: { ...typography.hero, marginBottom: spacing.sm },
  sub: {
    ...typography.body,
    color: colors.textSecondary,
    marginBottom: spacing.xxl,
    lineHeight: 24,
    maxWidth: 340,
  },
  card: { marginBottom: spacing.xxl, paddingVertical: spacing.xxl },
  banner: {
    backgroundColor: colors.dangerMuted,
    borderRadius: radius.lg,
    padding: spacing.lg,
    marginBottom: spacing.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#FECACA',
  },
  bannerText: { ...typography.caption, color: colors.danger, fontWeight: '500', lineHeight: 19 },
  offlineHint: { ...typography.caption, color: colors.warning, marginBottom: spacing.md },
  rememberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.xl,
    minHeight: 44,
  },
  rememberLabel: {
    ...typography.body,
    flex: 1,
    paddingRight: spacing.md,
    color: colors.textSecondary,
    fontSize: 15,
  },
  footer: { ...typography.caption, textAlign: 'center', color: colors.textMuted },
  devHint: {
    ...typography.caption,
    textAlign: 'center',
    color: colors.textMuted,
    marginTop: spacing.sm,
  },
})

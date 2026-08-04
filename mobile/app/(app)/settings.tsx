import { useState } from 'react'
import { ScrollView, StyleSheet, Text, View, Pressable } from 'react-native'
import { useRouter } from 'expo-router'
import { useQueryClient } from '@tanstack/react-query'
import {
  AppCard,
  AppHeader,
  ConfirmDialog,
  SecondaryButton,
  StatusChip,
} from '@/components'
import { logout } from '@/auth/sessionService'
import { usePreferencesStore } from '@/store/preferencesStore'
import { env } from '@/config/env'
import { colors, spacing, typography } from '@/theme'

export default function SettingsScreen() {
  const router = useRouter()
  const queryClient = useQueryClient()
  const themePref = usePreferencesStore((s) => s.theme)
  const language = usePreferencesStore((s) => s.language)
  const setTheme = usePreferencesStore((s) => s.setTheme)
  const [confirmLogout, setConfirmLogout] = useState(false)
  const [loggingOut, setLoggingOut] = useState(false)

  const onLogout = async () => {
    setLoggingOut(true)
    try {
      queryClient.clear()
      await logout()
      setConfirmLogout(false)
      router.replace('/(auth)/login')
    } finally {
      setLoggingOut(false)
    }
  }

  return (
    <View style={styles.flex}>
      <AppHeader title="Settings" onBack={() => router.back()} />
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.section}>Appearance</Text>
        <AppCard>
          <Text style={styles.rowLabel}>Theme</Text>
          <View style={styles.chips}>
            <Pressable onPress={() => setTheme('light')}>
              <StatusChip label="Light" tone={themePref === 'light' ? 'info' : 'default'} />
            </Pressable>
            <Pressable onPress={() => setTheme('system')}>
              <StatusChip label="System" tone={themePref === 'system' ? 'info' : 'default'} />
            </Pressable>
          </View>
          <Text style={styles.hint}>Dark theme is not shipped in M1 (light / system follow device later).</Text>
        </AppCard>

        <Text style={styles.section}>Language</Text>
        <AppCard>
          <Text style={styles.rowLabel}>Language</Text>
          <StatusChip label={language === 'en' ? 'English' : language} tone="info" />
          <Text style={styles.hint}>Additional locales deferred.</Text>
        </AppCard>

        <Text style={styles.section}>About</Text>
        <AppCard>
          <Text style={styles.rowLabel}>FOS Mobile</Text>
          <Text style={styles.value}>Version {env.appVersion}</Text>
          <Text style={styles.value}>Build {env.buildNumber}</Text>
          <Text style={styles.value}>Environment {env.appEnv}</Text>
        </AppCard>

        <Text style={styles.section}>Privacy</Text>
        <AppCard>
          <Text style={styles.hint}>
            Tokens are stored in the device secure enclave (Expo SecureStore). Passwords are never
            stored. Session data is cleared on logout. Biometric app unlock is architected for a
            later phase.
          </Text>
        </AppCard>

        <SecondaryButton
          title="Log out"
          destructive
          onPress={() => setConfirmLogout(true)}
          style={styles.logout}
          fullWidth
        />
      </ScrollView>

      <ConfirmDialog
        visible={confirmLogout}
        title="Log out?"
        message="You will need your password to sign in again. Remembered organisation and email may be kept if enabled."
        confirmLabel="Log out"
        destructive
        loading={loggingOut}
        onCancel={() => setConfirmLogout(false)}
        onConfirm={() => void onLogout()}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.background },
  scroll: { padding: spacing.lg, paddingBottom: spacing.xxxl, gap: spacing.md },
  section: { ...typography.label, marginTop: spacing.sm },
  rowLabel: { ...typography.bodyStrong, marginBottom: spacing.sm },
  value: { ...typography.caption, marginBottom: 2 },
  hint: { ...typography.caption, marginTop: spacing.sm },
  chips: { flexDirection: 'row', gap: spacing.sm },
  logout: { marginTop: spacing.xl },
})

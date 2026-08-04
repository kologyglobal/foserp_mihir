import { useState } from 'react'
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native'
import { useLocalSearchParams, useRouter } from 'expo-router'
import * as ImagePicker from 'expo-image-picker'
import { AppHeader, PrimaryButton, SecondaryButton } from '@/components'
import { colors, spacing, typography } from '@/theme'
import { businessCardScanStore } from '@/features/crm/businessCard/scanStore'

/**
 * Screen 1 — Capture / gallery import for business card.
 */
export default function BusinessCardCaptureScreen() {
  const router = useRouter()
  const params = useLocalSearchParams<{ companyId?: string }>()
  const [busy, setBusy] = useState(false)

  if (params.companyId) {
    businessCardScanStore.getState().setPreselectedCompanyId(String(params.companyId))
  }

  const goPreview = (uri: string) => {
    businessCardScanStore.getState().setImage(uri)
    router.push('/(app)/crm/business-card/preview')
  }

  const capture = async () => {
    setBusy(true)
    try {
      const perm = await ImagePicker.requestCameraPermissionsAsync()
      if (!perm.granted) {
        Alert.alert('Camera permission required')
        return
      }
      const res = await ImagePicker.launchCameraAsync({
        quality: 0.9,
        allowsEditing: false,
        exif: false,
      })
      if (res.canceled || !res.assets[0]?.uri) return
      goPreview(res.assets[0].uri)
    } finally {
      setBusy(false)
    }
  }

  const gallery = async () => {
    setBusy(true)
    try {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync()
      if (!perm.granted) {
        Alert.alert('Photo library permission required')
        return
      }
      const res = await ImagePicker.launchImageLibraryAsync({
        quality: 0.9,
        allowsEditing: false,
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
      })
      if (res.canceled || !res.assets[0]?.uri) return
      goPreview(res.assets[0].uri)
    } finally {
      setBusy(false)
    }
  }

  return (
    <View style={styles.flex}>
      <AppHeader title="Scan card" onBack={() => router.back()} />
      <View style={styles.body}>
        <View style={styles.frame}>
          <Text style={styles.frameTitle}>Business card</Text>
          <Text style={styles.hint}>
            Place the card inside the frame. Use even lighting. Capture or import, then crop and review.
          </Text>
          <View style={styles.guide} />
        </View>
        <PrimaryButton title="Capture" onPress={() => void capture()} loading={busy} fullWidth />
        <SecondaryButton title="Gallery import" onPress={() => void gallery()} fullWidth />
        <Text style={styles.meta}>Under 30 seconds → Create Lead or Contact after review.</Text>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.background },
  body: { flex: 1, padding: spacing.lg, gap: spacing.md },
  frame: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: spacing.lg,
    backgroundColor: colors.surfaceMuted,
    justifyContent: 'center',
  },
  frameTitle: { ...typography.subtitle, marginBottom: spacing.sm },
  hint: { ...typography.caption, marginBottom: spacing.lg },
  guide: {
    alignSelf: 'center',
    width: '92%',
    aspectRatio: 1.6,
    borderWidth: 2,
    borderColor: colors.primary,
    borderStyle: 'dashed',
    borderRadius: 8,
    backgroundColor: colors.surface,
  },
  meta: { ...typography.caption, textAlign: 'center', color: colors.textMuted },
})

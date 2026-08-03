import { useState } from 'react'
import { Alert, Image, Pressable, StyleSheet, Text, View } from 'react-native'
import { useRouter } from 'expo-router'
import { AppHeader, Loading, PrimaryButton, SecondaryButton } from '@/components'
import { colors, spacing, typography } from '@/theme'
import { useBusinessCardScan } from '@/features/crm/businessCard/scanStore'
import {
  autoCropCard,
  BusinessCardOcrError,
  rotateImage,
  runBusinessCardOcr,
} from '@/features/crm/businessCard/ocrEngine'
import { businessCardScanStore } from '@/features/crm/businessCard/scanStore'
import { parseBusinessCardText } from '@/features/crm/businessCard/parseBusinessCardText'
import { getUserFriendlyMessage } from '@/api/errors'

/**
 * Screen 2 — Preview, auto-crop, rotate, retake, then OCR → Review.
 */
export default function BusinessCardPreviewScreen() {
  const router = useRouter()
  const previewUri = useBusinessCardScan((s) => s.previewUri)
  const originalUri = useBusinessCardScan((s) => s.originalUri)
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState<string | null>(null)

  if (!previewUri) {
    return (
      <View style={styles.flex}>
        <AppHeader title="Preview" onBack={() => router.replace('/(app)/crm/business-card')} />
        <Text style={styles.hint}>No image. Capture a card first.</Text>
      </View>
    )
  }

  const rotate = async () => {
    setBusy(true)
    try {
      const next = await rotateImage(previewUri, 90)
      businessCardScanStore.getState().setPreviewUri(next)
      businessCardScanStore
        .getState()
        .setRotation((businessCardScanStore.getState().rotation + 90) % 360)
    } catch (e) {
      Alert.alert('Rotate failed', getUserFriendlyMessage(e))
    } finally {
      setBusy(false)
    }
  }

  const crop = async () => {
    setBusy(true)
    setStatus('Auto-cropping…')
    try {
      const next = await autoCropCard(previewUri)
      businessCardScanStore.getState().setPreviewUri(next)
    } catch (e) {
      Alert.alert('Crop failed', getUserFriendlyMessage(e))
    } finally {
      setBusy(false)
      setStatus(null)
    }
  }

  const continueOcr = async () => {
    setBusy(true)
    setStatus('Reading card…')
    try {
      const parsed = await runBusinessCardOcr(previewUri)
      businessCardScanStore.getState().applyParsed(parsed)
      router.push('/(app)/crm/business-card/review')
    } catch (e) {
      if (e instanceof BusinessCardOcrError) {
        businessCardScanStore.getState().setOcrError(e.message)
        // Allow manual review with empty/partial fields so flow is not blocked
        if (e.code === 'OCR_UNAVAILABLE' || e.code === 'UNREADABLE' || e.code === 'OCR_FAILED') {
          businessCardScanStore.getState().applyParsed(
            parseBusinessCardText(''),
          )
          Alert.alert(
            'OCR issue',
            `${e.message}\n\nContinue to edit fields manually? Card image will still be saved.`,
            [
              { text: 'Retry', style: 'cancel' },
              {
                text: 'Edit manually',
                onPress: () => router.push('/(app)/crm/business-card/review'),
              },
            ],
          )
          return
        }
      }
      Alert.alert('OCR failed', getUserFriendlyMessage(e))
    } finally {
      setBusy(false)
      setStatus(null)
    }
  }

  return (
    <View style={styles.flex}>
      <AppHeader title="Preview" onBack={() => router.back()} />
      {busy ? <Loading label={status || 'Working…'} /> : null}
      <View style={styles.body}>
        <Image source={{ uri: previewUri }} style={styles.image} resizeMode="contain" />
        <View style={styles.row}>
          <Pressable style={styles.chip} onPress={() => void rotate()} disabled={busy}>
            <Text style={styles.chipText}>Rotate</Text>
          </Pressable>
          <Pressable style={styles.chip} onPress={() => void crop()} disabled={busy}>
            <Text style={styles.chipText}>Auto crop</Text>
          </Pressable>
          <Pressable
            style={styles.chip}
            disabled={busy}
            onPress={() => {
              if (originalUri) businessCardScanStore.getState().setPreviewUri(originalUri)
              router.replace('/(app)/crm/business-card')
            }}
          >
            <Text style={styles.chipText}>Retake</Text>
          </Pressable>
        </View>
        <PrimaryButton title="Continue" onPress={() => void continueOcr()} loading={busy} fullWidth />
        <SecondaryButton
          title="Cancel"
          onPress={() => {
            businessCardScanStore.getState().reset()
            router.back()
          }}
          fullWidth
        />
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.background },
  body: { flex: 1, padding: spacing.lg, gap: spacing.md },
  image: {
    flex: 1,
    width: '100%',
    backgroundColor: colors.surfaceMuted,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chip: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  chipText: { ...typography.caption, color: colors.primary, fontWeight: '700' },
  hint: { ...typography.body, padding: spacing.lg },
})

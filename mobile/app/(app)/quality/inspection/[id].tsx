import { useCallback, useState } from 'react'
import {
  Alert,
  Image,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native'
import { useLocalSearchParams, useRouter } from 'expo-router'
import * as ImagePicker from 'expo-image-picker'
import { Ionicons } from '@expo/vector-icons'
import {
  AppCard,
  AppHeader,
  EmptyState,
  ErrorState,
  FormSection,
  Loading,
  PrimaryButton,
  ReviewRow,
  SecondaryButton,
  StatusChip,
} from '@/components'
import { ApiError, getUserFriendlyMessage } from '@/api/errors'
import { usePermissions } from '@/auth/permissions'
import { isModuleEnabled } from '@/auth/modules'
import {
  QC_PHOTO_UPLOAD_READY,
  decideQcKioskInspection,
  deleteQcPhoto,
  toBackendDecision,
  uploadQcPhoto,
  type QcPhoto,
} from '@/features/quality/api'
import { useInvalidateQuality, useQcInspection, useQualityAccess } from '@/features/quality/hooks'
import { statusTone, titleCaseLabel } from '@/features/crm/utils'
import { useSessionStore } from '@/store/sessionStore'
import { colors, layout, radius, spacing, typography } from '@/theme'

type UiDecision = 'PASS' | 'FAIL' | 'HOLD' | 'REWORK'

function guessMime(uri: string): string {
  const lower = uri.toLowerCase()
  if (lower.endsWith('.png')) return 'image/png'
  if (lower.endsWith('.webp')) return 'image/webp'
  if (lower.endsWith('.heic') || lower.endsWith('.heif')) return 'image/heic'
  return 'image/jpeg'
}

function guessName(uri: string): string {
  const parts = uri.split(/[/\\]/)
  const last = parts[parts.length - 1]
  if (last && last.includes('.')) return last
  return `qc-${Date.now()}.jpg`
}

function canSubmitQc(perms: string[] | null): boolean {
  if (!perms) return false
  return (
    perms.includes('quality.submit') ||
    perms.includes('manufacturing.quality.inspect') ||
    perms.includes('quality.create')
  )
}

export default function QcInspectionScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const inspectionId = String(id || '')
  const router = useRouter()
  const profile = useSessionStore((s) => s.profile)
  const qualityModuleOn = isModuleEnabled('quality', profile?.modules)
  const { enabled } = useQualityAccess()
  const { permissions } = usePermissions()
  const q = useQcInspection(inspectionId)
  const invalidate = useInvalidateQuality()

  const [busy, setBusy] = useState(false)
  const [remarks, setRemarks] = useState('')
  const [localPreviews, setLocalPreviews] = useState<Array<{ uri: string; name: string }>>([])

  const row = q.data
  const photos = (Array.isArray(row?.photos) ? row!.photos : []) as QcPhoto[]
  const photoRequired = Boolean(row?.photoRequired)
  const photoCount = Number(row?.photoCount ?? photos.length) + localPreviews.length
  const canAct = canSubmitQc(permissions)
  const status = String(row?.status || '')
  const canEditPhotos =
    canAct && (status === 'PENDING' || status === 'REWORK' || status === 'IN_PROGRESS')

  const refresh = useCallback(async () => {
    await q.refetch()
  }, [q])

  const ensureMediaPermission = async (kind: 'camera' | 'library') => {
    const perm =
      kind === 'camera'
        ? await ImagePicker.requestCameraPermissionsAsync()
        : await ImagePicker.requestMediaLibraryPermissionsAsync()
    if (!perm.granted) {
      Alert.alert('Permission needed', 'Allow camera / photos to attach QC evidence.')
      return false
    }
    return true
  }

  const uploadFromUri = async (uri: string) => {
    if (!QC_PHOTO_UPLOAD_READY) {
      Alert.alert('Not available', 'Photo upload is not enabled on this build.')
      return
    }
    setBusy(true)
    setLocalPreviews((prev) => [...prev, { uri, name: guessName(uri) }])
    try {
      await uploadQcPhoto(inspectionId, {
        uri,
        name: guessName(uri),
        type: guessMime(uri),
      })
      setLocalPreviews([])
      invalidate()
      await refresh()
    } catch (err) {
      setLocalPreviews((prev) => prev.filter((p) => p.uri !== uri))
      Alert.alert('Upload failed', getUserFriendlyMessage(err))
    } finally {
      setBusy(false)
    }
  }

  const pickCamera = async () => {
    if (!(await ensureMediaPermission('camera'))) return
    const res = await ImagePicker.launchCameraAsync({
      quality: 0.85,
      allowsEditing: false,
      exif: false,
    })
    if (res.canceled || !res.assets[0]?.uri) return
    await uploadFromUri(res.assets[0].uri)
  }

  const pickGallery = async () => {
    if (!(await ensureMediaPermission('library'))) return
    const res = await ImagePicker.launchImageLibraryAsync({
      quality: 0.85,
      allowsEditing: false,
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
    })
    if (res.canceled || !res.assets[0]?.uri) return
    await uploadFromUri(res.assets[0].uri)
  }

  const removePhoto = (photoId: string) => {
    Alert.alert('Remove photo?', 'This soft-deletes the evidence photo.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: () => {
          void (async () => {
            setBusy(true)
            try {
              await deleteQcPhoto(inspectionId, photoId)
              invalidate()
              await refresh()
            } catch (err) {
              Alert.alert('Could not remove', getUserFriendlyMessage(err))
            } finally {
              setBusy(false)
            }
          })()
        },
      },
    ])
  }

  const decide = async (ui: UiDecision) => {
    if (ui === 'PASS' && photoRequired && photos.length < 1) {
      Alert.alert('Photo required', 'Attach at least one QC photo before PASS.')
      return
    }
    setBusy(true)
    try {
      await decideQcKioskInspection(inspectionId, {
        decision: toBackendDecision(ui),
        remarks: remarks.trim() || undefined,
      })
      invalidate()
      Alert.alert('Saved', `Inspection marked ${ui}.`, [
        { text: 'OK', onPress: () => router.back() },
      ])
    } catch (err) {
      Alert.alert('Decision failed', getUserFriendlyMessage(err))
    } finally {
      setBusy(false)
    }
  }

  if (!qualityModuleOn) {
    return (
      <View style={styles.flex}>
        <AppHeader title="Inspection" onBack={() => router.back()} />
        <EmptyState title="Quality module disabled" icon="ban-outline" />
      </View>
    )
  }

  if (!enabled) {
    return (
      <View style={styles.flex}>
        <AppHeader title="Inspection" onBack={() => router.back()} />
        <EmptyState title="Not authorised" icon="lock-closed-outline" />
      </View>
    )
  }

  if (!inspectionId) {
    return (
      <View style={styles.flex}>
        <AppHeader title="Inspection" onBack={() => router.back()} />
        <EmptyState title="Missing inspection id" />
      </View>
    )
  }

  if (q.isLoading) {
    return (
      <View style={styles.flex}>
        <AppHeader title="Inspection" onBack={() => router.back()} />
        <Loading fullScreen />
      </View>
    )
  }

  if (q.error || !row) {
    const forbidden =
      q.error instanceof ApiError && (q.error.kind === 'forbidden' || q.error.status === 403)
    return (
      <View style={styles.flex}>
        <AppHeader title="Inspection" onBack={() => router.back()} />
        <ErrorState
          title={forbidden ? 'Not authorised' : 'Could not load inspection'}
          error={q.error ?? new Error('Inspection not found.')}
          onRetry={() => void q.refetch()}
        />
      </View>
    )
  }

  const title = String(row.inspectionNumber || 'Inspection')

  return (
    <View style={styles.flex}>
      <AppHeader title={title} onBack={() => router.back()} />
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={q.isFetching} onRefresh={() => void refresh()} />}
      >
        <AppCard>
          <View style={styles.headerRow}>
            <View style={styles.headerCopy}>
              <Text style={styles.subtitle}>{titleCaseLabel(String(row.category || 'QC'))}</Text>
              <Text style={styles.itemName}>
                {String(row.itemName || row.itemCode || row.productionOrderNumber || '—')}
              </Text>
            </View>
            <StatusChip
              label={titleCaseLabel(status || 'Unknown')}
              tone={statusTone(status)}
              compact
            />
          </View>
          <ReviewRow
            label="Plan"
            value={String((row.inspectionPlan as { planCode?: string } | null)?.planCode || '—')}
          />
          <ReviewRow label="Stage" value={String(row.stageName || '—')} />
          <ReviewRow label="Qty" value={String(row.inspectedQty || '—')} />
        </AppCard>

        <FormSection
          title={`Evidence photos${photoRequired ? ' (required for PASS)' : ''}`}
          description={`${photoCount} attached · max 8`}
        >
          <View style={styles.photoGrid}>
            {photos.map((p) => (
              <View key={p.id} style={styles.photoTile}>
                <View style={styles.photoPlaceholder}>
                  <Ionicons name="image-outline" size={28} color={colors.textSecondary} />
                </View>
                <Text style={styles.photoMeta} numberOfLines={1}>
                  {p.originalFilename}
                </Text>
                {canEditPhotos ? (
                  <Pressable
                    onPress={() => removePhoto(p.id)}
                    accessibilityRole="button"
                    style={styles.removeBtn}
                  >
                    <Ionicons name="trash-outline" size={16} color={colors.danger} />
                  </Pressable>
                ) : null}
              </View>
            ))}
            {localPreviews.map((p) => (
              <View key={p.uri} style={styles.photoTile}>
                <Image source={{ uri: p.uri }} style={styles.photoImage} />
                <Text style={styles.photoMeta} numberOfLines={1}>
                  Uploading…
                </Text>
              </View>
            ))}
          </View>

          {canEditPhotos ? (
            <View style={styles.uploadRow}>
              <SecondaryButton title="Camera" onPress={() => void pickCamera()} disabled={busy} />
              <SecondaryButton title="Gallery" onPress={() => void pickGallery()} disabled={busy} />
            </View>
          ) : (
            <Text style={styles.hint}>Photos cannot be changed in status {status}.</Text>
          )}
        </FormSection>

        {canAct ? (
          <FormSection title="Decision">
            <TextInput
              value={remarks}
              onChangeText={setRemarks}
              placeholder="Remarks (optional)"
              placeholderTextColor={colors.textSecondary}
              style={styles.remarks}
              multiline
            />
            <View style={styles.decisionRow}>
              <PrimaryButton
                title="PASS"
                onPress={() => void decide('PASS')}
                loading={busy}
                disabled={busy || (photoRequired && photos.length < 1)}
              />
              <SecondaryButton title="FAIL" onPress={() => void decide('FAIL')} disabled={busy} />
            </View>
            <View style={styles.decisionRow}>
              <SecondaryButton title="HOLD" onPress={() => void decide('HOLD')} disabled={busy} />
              <SecondaryButton title="REWORK" onPress={() => void decide('REWORK')} disabled={busy} />
            </View>
            {photoRequired && photos.length < 1 ? (
              <Text style={styles.warn}>At least one photo is required before PASS.</Text>
            ) : null}
          </FormSection>
        ) : (
          <Text style={styles.hint}>You can view this inspection but not submit a decision.</Text>
        )}
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.background },
  scroll: {
    padding: layout.screenPadding,
    paddingBottom: spacing.xxl,
    gap: spacing.lg,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.md,
    marginBottom: spacing.sm,
  },
  headerCopy: { flex: 1, gap: 4 },
  subtitle: { ...typography.caption, color: colors.textSecondary },
  itemName: { ...typography.subtitle, color: colors.text },
  photoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  photoTile: {
    width: 104,
    gap: spacing.xs,
  },
  photoPlaceholder: {
    width: 104,
    height: 104,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoImage: {
    width: 104,
    height: 104,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceMuted,
  },
  photoMeta: { ...typography.caption, color: colors.textSecondary },
  removeBtn: { alignSelf: 'flex-start', padding: 4 },
  uploadRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm },
  remarks: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.md,
    minHeight: 80,
    ...typography.body,
    color: colors.text,
    backgroundColor: colors.surface,
    marginBottom: spacing.md,
  },
  decisionRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.sm },
  hint: { ...typography.caption, color: colors.textSecondary },
  warn: { ...typography.caption, color: colors.warning },
})

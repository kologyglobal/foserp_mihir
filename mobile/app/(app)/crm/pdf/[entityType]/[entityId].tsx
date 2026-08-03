import { useState } from 'react'
import { Alert, Pressable, ScrollView, StyleSheet, Text, View, Share, Platform } from 'react-native'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { WebView } from 'react-native-webview'
import * as Sharing from 'expo-sharing'
import { AppHeader, ErrorState, Loading, PrimaryButton } from '@/components'
import { resolveDocumentPdf, type DocumentPdfEntity } from '@/features/crm/pdf/documentPdf'
import { getUserFriendlyMessage } from '@/api/errors'
import { useSessionStore } from '@/store/sessionStore'
import { colors, spacing, typography } from '@/theme'
import { useQuery } from '@tanstack/react-query'

export default function DocumentPdfScreen() {
  const { entityType, entityId } = useLocalSearchParams<{
    entityType: string
    entityId: string
  }>()
  const type = (entityType === 'sales_order' ? 'sales_order' : 'quotation') as DocumentPdfEntity
  const id = String(entityId || '')
  const online = useSessionStore((s) => s.isOnline)
  const router = useRouter()
  const [busyShare, setBusyShare] = useState(false)

  const q = useQuery({
    queryKey: ['crm', 'pdf', type, id],
    enabled: !!id && online,
    queryFn: () => resolveDocumentPdf(type, id),
    retry: false,
    staleTime: 60_000,
  })

  const share = async () => {
    if (!q.data?.uri) return
    setBusyShare(true)
    try {
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(q.data.uri, {
          mimeType: q.data.mimeType || 'application/pdf',
          dialogTitle: q.data.filename,
        })
      } else {
        await Share.share({
          url: Platform.OS === 'ios' ? q.data.uri : `file://${q.data.uri}`,
          message: q.data.filename,
        })
      }
    } catch (e) {
      Alert.alert('Share failed', getUserFriendlyMessage(e))
    } finally {
      setBusyShare(false)
    }
  }

  return (
    <View style={styles.flex}>
      <AppHeader
        title={type === 'quotation' ? 'Quotation PDF' : 'Sales order PDF'}
        onBack={() => router.back()}
      />
      {!online ? (
        <ErrorState error={new Error('You are offline. Connect to load the PDF.')} />
      ) : null}
      {online && q.isLoading ? <Loading fullScreen label="Fetching PDF…" /> : null}
      {online && q.error ? (
        <ErrorState error={q.error} onRetry={() => void q.refetch()} />
      ) : null}
      {q.data?.uri ? (
        <>
          <WebView
            source={{ uri: q.data.uri }}
            style={styles.web}
            originWhitelist={['*']}
            allowFileAccess
            allowUniversalAccessFromFileURLs
          />
          <View style={styles.bar}>
            <PrimaryButton
              title="Share / Download"
              onPress={() => void share()}
              loading={busyShare}
              fullWidth
            />
            <Text style={styles.hint}>{q.data.filename}</Text>
          </View>
        </>
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.background },
  web: { flex: 1, backgroundColor: colors.surfaceMuted },
  bar: { padding: spacing.lg, gap: spacing.sm, borderTopWidth: 1, borderTopColor: colors.border },
  hint: { ...typography.caption, textAlign: 'center' },
})

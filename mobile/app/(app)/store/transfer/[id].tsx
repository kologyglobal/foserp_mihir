import { useEffect, useRef, useState } from 'react'
import {
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native'
import { useLocalSearchParams } from 'expo-router'
import {
  AppCard,
  AppHeader,
  EmptyState,
  ErrorState,
  Loading,
  PrimaryButton,
  SecondaryButton,
  StatusChip,
} from '@/components'
import {
  advanceTransferTowardDispatch,
  cancelTransfer,
  createTransferDispatchKey,
  createTransferReceiveKey,
  receiveTransfer,
  transferLineRemaining,
  type TransferLine,
} from '@/features/store/api'
import {
  useInvalidateStore,
  useTransferAccess,
  useTransferDetail,
} from '@/features/store/hooks'
import { getUserFriendlyMessage } from '@/api/errors'
import { colors, layout, radius, spacing, typography } from '@/theme'

export default function StockTransferDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const transferId = Array.isArray(id) ? id[0] : id
  const access = useTransferAccess()
  const invalidate = useInvalidateStore()
  const detailQ = useTransferDetail(transferId ?? '', access.canView && Boolean(transferId))
  const [recvQty, setRecvQty] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState(false)
  const dispatchKeyRef = useRef<string | null>(null)
  const receiveKeyRef = useRef<string | null>(null)

  const doc = detailQ.data
  const status = String(doc?.status || '')

  useEffect(() => {
    if (!doc?.lines) return
    const next: Record<string, string> = {}
    for (const line of doc.lines) {
      const rem = transferLineRemaining(line)
      next[line.id] = rem > 0 ? String(rem) : '0'
    }
    setRecvQty(next)
  }, [doc?.id, doc?.status, doc?.lines])

  const refresh = async () => {
    invalidate()
    await detailQ.refetch()
  }

  const runAdvance = async () => {
    if (!transferId || !doc) return
    if (!dispatchKeyRef.current) {
      dispatchKeyRef.current = createTransferDispatchKey(transferId)
    }
    setBusy(true)
    try {
      const next = await advanceTransferTowardDispatch(transferId, {
        canSubmit: access.canSubmit,
        canApprove: access.canApprove,
        canDispatch: access.canDispatch,
        remarks: 'Mobile transfer advance',
        dispatchIdempotencyKey: dispatchKeyRef.current,
      })
      dispatchKeyRef.current = null
      await refresh()
      Alert.alert('Updated', `Status is now ${String(next.status)}`)
    } catch (e) {
      Alert.alert('Advance failed', getUserFriendlyMessage(e))
    } finally {
      setBusy(false)
    }
  }

  const runReceive = async () => {
    if (!transferId || !doc?.lines?.length) return
    if (!access.canReceive) {
      Alert.alert('Not authorised', 'You cannot receive transfers.')
      return
    }
    const lines = doc.lines
      .map((line: TransferLine) => {
        const rem = transferLineRemaining(line)
        const q = Number(recvQty[line.id] ?? 0)
        if (!Number.isFinite(q) || q <= 0 || rem <= 0) return null
        if (q > rem) return null
        return { lineId: line.id, quantity: q }
      })
      .filter(Boolean) as Array<{ lineId: string; quantity: number }>

    if (lines.length === 0) {
      Alert.alert('Nothing to receive', 'Enter positive quantities up to remaining.')
      return
    }

    if (!receiveKeyRef.current) {
      receiveKeyRef.current = createTransferReceiveKey(transferId)
    }

    setBusy(true)
    try {
      const next = await receiveTransfer(transferId, {
        idempotencyKey: receiveKeyRef.current,
        lines,
      })
      receiveKeyRef.current = null
      await refresh()
      Alert.alert('Received', `Status is now ${String(next.status)}`)
    } catch (e) {
      Alert.alert('Receive failed', getUserFriendlyMessage(e))
    } finally {
      setBusy(false)
    }
  }

  const runCancel = async () => {
    if (!transferId || !access.canCancel) return
    Alert.alert('Cancel transfer?', 'This stops the open workflow.', [
      { text: 'Keep', style: 'cancel' },
      {
        text: 'Cancel transfer',
        style: 'destructive',
        onPress: () => {
          void (async () => {
            setBusy(true)
            try {
              await cancelTransfer(transferId, 'Cancelled from mobile')
              await refresh()
              Alert.alert('Cancelled', 'Transfer cancelled.')
            } catch (e) {
              Alert.alert('Cancel failed', getUserFriendlyMessage(e))
            } finally {
              setBusy(false)
            }
          })()
        },
      },
    ])
  }

  const canAdvance =
    (status === 'DRAFT' && access.canSubmit) ||
    (status === 'SUBMITTED' && access.canApprove) ||
    (status === 'APPROVED' && access.canDispatch)

  const canRecv =
    access.canReceive && ['IN_TRANSIT', 'PARTIALLY_RECEIVED'].includes(status)

  const canCancelDoc =
    access.canCancel && ['DRAFT', 'SUBMITTED', 'APPROVED'].includes(status)

  if (!transferId) {
    return (
      <View style={styles.flex}>
        <AppHeader title="Transfer" showBack />
        <EmptyState title="Missing id" description="Open a transfer from the list." icon="alert-outline" />
      </View>
    )
  }

  if (!access.canView) {
    return (
      <View style={styles.flex}>
        <AppHeader title="Transfer" showBack />
        <EmptyState
          title="No access"
          description="Requires inventory.transfers.view or inventory.view."
          icon="lock-closed-outline"
        />
      </View>
    )
  }

  return (
    <View style={styles.flex}>
      <AppHeader
        title={doc?.transferNumber || 'Transfer'}
        subtitle={status || 'Detail'}
        showBack
      />
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        {detailQ.isLoading ? <Loading /> : null}
        {detailQ.error ? (
          <ErrorState error={detailQ.error} onRetry={() => void detailQ.refetch()} />
        ) : null}

        {doc ? (
          <>
            <AppCard style={styles.card}>
              <View style={styles.row}>
                <Text style={styles.title}>{doc.transferNumber || doc.id.slice(0, 8)}</Text>
                <StatusChip label={status} compact />
              </View>
              <Text style={styles.meta}>
                {doc.fromWarehouse?.name || doc.fromWarehouse?.code || '—'}
                {' → '}
                {doc.toWarehouse?.name || doc.toWarehouse?.code || '—'}
              </Text>
              {doc.remarks ? <Text style={styles.meta}>{doc.remarks}</Text> : null}
            </AppCard>

            {(doc.lines ?? []).map((line) => {
              const rem = transferLineRemaining(line)
              return (
                <AppCard key={line.id} style={styles.card}>
                  <Text style={styles.title}>
                    {line.item?.code || line.itemId?.slice(0, 8) || 'Item'}
                  </Text>
                  <Text style={styles.meta}>{line.item?.name || '—'}</Text>
                  <Text style={styles.meta}>
                    qty {String(line.quantity ?? '—')} · dispatched {String(line.dispatchedQty ?? '0')} ·
                    received {String(line.receivedQty ?? '0')}
                    {rem > 0 ? ` · remain ${rem}` : ''}
                  </Text>
                  {line.batchNumberSnapshot ? (
                    <Text style={styles.meta}>Batch {line.batchNumberSnapshot}</Text>
                  ) : null}
                  {canRecv && rem > 0 ? (
                    <>
                      <Text style={styles.label}>Receive qty</Text>
                      <TextInput
                        style={styles.input}
                        value={recvQty[line.id] ?? ''}
                        onChangeText={(t) => {
                          receiveKeyRef.current = null
                          setRecvQty((m) => ({ ...m, [line.id]: t }))
                        }}
                        keyboardType="decimal-pad"
                        placeholderTextColor={colors.textMuted}
                        editable={!busy}
                      />
                    </>
                  ) : null}
                </AppCard>
              )
            })}

            {canAdvance ? (
              <PrimaryButton
                title={busy ? 'Working…' : 'Advance (submit / approve / dispatch)'}
                onPress={() => void runAdvance()}
                disabled={busy}
                style={styles.mb}
              />
            ) : null}

            {canRecv ? (
              <PrimaryButton
                title={busy ? 'Receiving…' : 'Receive selected qty'}
                onPress={() => void runReceive()}
                disabled={busy}
                style={styles.mb}
              />
            ) : null}

            {canCancelDoc ? (
              <SecondaryButton
                title="Cancel transfer"
                onPress={() => void runCancel()}
                disabled={busy}
                style={styles.mb}
              />
            ) : null}

            {!canAdvance && !canRecv && !canCancelDoc ? (
              <Text style={styles.meta}>
                No further mobile actions for status {status}. Approval/post steps may be completed
                on desktop if you lack those permissions.
              </Text>
            ) : null}
          </>
        ) : null}
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.background },
  scroll: { padding: layout.screenPadding, paddingBottom: spacing.hero },
  card: { marginBottom: spacing.sm },
  row: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing.sm },
  title: { ...typography.bodyStrong, flex: 1 },
  meta: { ...typography.caption, marginTop: 4 },
  label: { ...typography.caption, fontWeight: '600', marginBottom: spacing.xs, marginTop: spacing.sm },
  input: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.md,
    color: colors.text,
    backgroundColor: colors.surface,
  },
  mb: { marginBottom: spacing.md },
})

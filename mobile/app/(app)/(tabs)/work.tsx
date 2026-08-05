/**
 * Work tab — catalog routes + live purchase approval tasks when permitted.
 */
import { ScrollView, StyleSheet, Text, View } from 'react-native'
import { useRouter } from 'expo-router'
import { AppHeader, EmptyState, ErrorState, ListTile, Loading } from '@/components'
import { useNavigationAccess } from '@/auth/useNavigationAccess'
import { useOperationalTasks } from '@/features/ops/useOperationalTasks'
import { titleCaseLabel } from '@/features/crm/utils'
import { colors, layout, spacing, typography } from '@/theme'

export default function WorkScreen() {
  const { work } = useNavigationAccess()
  const router = useRouter()
  const ops = useOperationalTasks()
  const purchaseTasks = ops.tasks.filter((t) => t.source === 'purchase')
  const purchaseFailed = ops.failed.find((f) => f.source === 'purchase')
  const purchaseSource = ops.sources.find((s) => s.source === 'purchase')
  const showPurchase = purchaseSource != null && purchaseSource.status !== 'skipped'

  const subtitle = (() => {
    if (ops.isLoading) return 'Loading tasks…'
    if (purchaseTasks.length > 0) {
      return `${purchaseTasks.length} open · ${work.length} route${work.length === 1 ? '' : 's'}`
    }
    if (work.length === 0) return 'No routes assigned'
    return `${work.length} route${work.length === 1 ? '' : 's'}`
  })()

  return (
    <View style={styles.flex}>
      <AppHeader title="Work" subtitle={subtitle} showBack={false} />
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {showPurchase ? (
          <>
            <Text style={styles.section}>Purchase approvals</Text>
            {ops.isLoading ? <Loading /> : null}
            {purchaseFailed ? (
              <ErrorState
                error={new Error(purchaseFailed.error)}
                onRetry={() => ops.refetchSource('purchase')}
              />
            ) : null}
            {!ops.isLoading && !purchaseFailed && purchaseTasks.length === 0 ? (
              <Text style={styles.emptyLine}>No purchase approvals in your queue.</Text>
            ) : null}
            {purchaseTasks.map((task) => (
              <ListTile
                key={task.id}
                title={task.title}
                subtitle={task.subtitle || titleCaseLabel(task.status)}
                onPress={() => router.push(task.href as never)}
                icon="shield-checkmark-outline"
              />
            ))}
          </>
        ) : null}

        {work.length > 0 ? (
          <>
            <Text style={styles.section}>Your work routes</Text>
            {work.map((e) => (
              <ListTile
                key={e.id}
                title={e.label}
                subtitle={
                  e.description ||
                  (e.group === 'crm'
                    ? 'CRM tasks and follow-ups'
                    : e.id.includes('approvals')
                      ? 'Open the approval queue'
                      : 'Opens module screen when available')
                }
                onPress={() => router.push(e.href as never)}
                icon={(e.icon as never) || undefined}
              />
            ))}
          </>
        ) : null}

        {!ops.isLoading && work.length === 0 && purchaseTasks.length === 0 && !purchaseFailed ? (
          <EmptyState
            title="No open work"
            description="Ask your administrator to enable modules and grant permissions for field work."
            icon="checkbox-outline"
          />
        ) : null}
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.background },
  scroll: { padding: layout.screenPadding, paddingBottom: spacing.hero },
  section: { ...typography.bodyStrong, marginBottom: spacing.sm, marginTop: spacing.sm },
  emptyLine: { ...typography.caption, color: colors.textMuted, marginBottom: spacing.md },
})

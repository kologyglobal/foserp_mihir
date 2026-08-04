import { useState } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useRouter } from 'expo-router'
import { BottomSheet, Fab } from '@/components'
import { colors, radius, spacing, typography } from '@/theme'
import { usePermissions } from '@/auth/permissions'

const ACTIONS = [
  {
    key: 'card',
    label: 'Scan card',
    hint: 'Capture from camera or gallery',
    icon: 'scan-outline' as const,
    href: '/(app)/crm/business-card',
    perm: 'crm.lead.create',
  },
  {
    key: 'lead',
    label: 'New lead',
    hint: 'Capture a prospect',
    icon: 'person-add-outline' as const,
    href: '/(app)/crm/leads/create',
    perm: 'crm.lead.create',
  },
  {
    key: 'company',
    label: 'Customer',
    hint: 'Add company record',
    icon: 'business-outline' as const,
    href: '/(app)/crm/companies/create',
    perm: 'crm.company.create',
  },
  {
    key: 'followup',
    label: 'Follow-up',
    hint: 'Schedule next touch',
    icon: 'alarm-outline' as const,
    href: '/(app)/crm/follow-ups/create',
    perm: 'crm.follow_up.create',
  },
  {
    key: 'meeting',
    label: 'Meeting',
    hint: 'Log a visit or call',
    icon: 'calendar-outline' as const,
    href: '/(app)/crm/meetings/create',
    perm: 'crm.activity.create',
  },
  {
    key: 'quotation',
    label: 'Quotation',
    hint: 'Browse commercial quotes',
    icon: 'document-text-outline' as const,
    href: '/(app)/crm/quotations',
    perm: 'crm.quotation.view',
  },
]

export function CrmFab() {
  const [open, setOpen] = useState(false)
  const router = useRouter()
  const { can } = usePermissions()
  const items = ACTIONS.filter((a) => can(a.perm) || can('tenant.manage') || a.perm.endsWith('.view'))

  return (
    <>
      <Fab onPress={() => setOpen(true)} accessibilityLabel="Quick create" />
      <BottomSheet visible={open} onClose={() => setOpen(false)} title="Quick create">
        <View style={styles.grid}>
          {items.map((a) => (
            <Pressable
              key={a.key}
              style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
              onPress={() => {
                setOpen(false)
                router.push(a.href as never)
              }}
            >
              <View style={styles.icon}>
                <Ionicons name={a.icon} size={20} color={colors.primary} />
              </View>
              <View style={styles.copy}>
                <Text style={styles.rowLabel}>{a.label}</Text>
                <Text style={styles.rowHint}>{a.hint}</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
            </Pressable>
          ))}
        </View>
      </BottomSheet>
    </>
  )
}

const styles = StyleSheet.create({
  grid: { gap: spacing.sm, paddingBottom: spacing.md },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    borderRadius: radius.lg,
    backgroundColor: colors.surfaceMuted,
  },
  rowPressed: { opacity: 0.88, transform: [{ scale: 0.995 }] },
  icon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: colors.primaryMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  copy: { flex: 1 },
  rowLabel: { ...typography.bodyStrong },
  rowHint: { ...typography.caption, color: colors.textMuted, marginTop: 2 },
})

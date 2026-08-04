import type { ReactNode } from 'react'
import { View, Text, StyleSheet } from 'react-native'
import { AppCard } from '@/components/AppCard'
import { colors, spacing, typography } from '@/theme'

type Props = {
  title: string
  description?: string
  children: ReactNode
}

/** Logical form section card for multi-step wizards. */
export function FormSection({ title, description, children }: Props) {
  return (
    <AppCard style={styles.card}>
      <Text style={styles.title}>{title}</Text>
      {description ? <Text style={styles.description}>{description}</Text> : null}
      <View style={styles.body}>{children}</View>
    </AppCard>
  )
}

const styles = StyleSheet.create({
  card: { marginBottom: spacing.lg },
  title: { ...typography.subtitle, fontSize: 18, marginBottom: spacing.xs },
  description: {
    ...typography.caption,
    color: colors.textMuted,
    marginBottom: spacing.lg,
    lineHeight: 20,
  },
  body: { gap: 0 },
})

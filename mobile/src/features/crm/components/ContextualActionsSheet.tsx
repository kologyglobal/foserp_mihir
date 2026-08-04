import { Pressable, StyleSheet, Text, View } from 'react-native'

import { BottomSheet } from '@/components'

import { colors, spacing, typography } from '@/theme'



export type QuickActionItem = {

  key: string

  label: string

  onPress: () => void

  disabled?: boolean

  destructive?: boolean

}



type Props = {

  visible: boolean

  onClose: () => void

  title?: string

  actions: QuickActionItem[]

}



export function ContextualActionsSheet({ visible, onClose, title = 'Actions', actions }: Props) {

  return (

    <BottomSheet visible={visible} onClose={onClose} title={title}>

      <View style={styles.wrap}>

        {actions.map((a) => (

          <Pressable

            key={a.key}

            disabled={a.disabled}

            style={[styles.row, a.disabled && styles.disabled]}

            onPress={() => {

              onClose()

              a.onPress()

            }}

          >

            <Text style={[styles.label, a.destructive && styles.danger]}>{a.label}</Text>

          </Pressable>

        ))}

      </View>

    </BottomSheet>

  )

}



const styles = StyleSheet.create({

  wrap: { gap: spacing.xs, paddingBottom: spacing.md },

  row: {

    paddingVertical: spacing.md,

    borderBottomWidth: StyleSheet.hairlineWidth,

    borderBottomColor: colors.border,

  },

  label: { ...typography.bodyStrong },

  danger: { color: colors.danger },

  disabled: { opacity: 0.4 },

})


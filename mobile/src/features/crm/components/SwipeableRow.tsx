import type { ReactNode } from 'react'

import { Pressable, StyleSheet, Text, View } from 'react-native'

import { Swipeable } from 'react-native-gesture-handler'

import { colors, radius, spacing, typography } from '@/theme'



export type SwipeAction = {

  key: string

  label: string

  onPress: () => void

  tone?: 'primary' | 'danger' | 'neutral'

}



type Props = {

  children: ReactNode

  leftActions?: SwipeAction[]

  rightActions?: SwipeAction[]

}



function ActionCluster({ actions }: { actions: SwipeAction[] }) {

  return (

    <View style={styles.cluster}>

      {actions.map((a) => (

        <Pressable

          key={a.key}

          style={[

            styles.action,

            a.tone === 'danger' && styles.danger,

            a.tone === 'neutral' && styles.neutral,

          ]}

          onPress={a.onPress}

        >

          <Text style={styles.actionText}>{a.label}</Text>

        </Pressable>

      ))}

    </View>

  )

}



/** Safe swipe row — never presents destructive confirm internally; caller must confirm. */

export function SwipeableRow({ children, leftActions = [], rightActions = [] }: Props) {

  return (

    <Swipeable

      overshootLeft={false}

      overshootRight={false}

      renderLeftActions={

        leftActions.length

          ? () => <ActionCluster actions={leftActions} />

          : undefined

      }

      renderRightActions={

        rightActions.length

          ? () => <ActionCluster actions={rightActions} />

          : undefined

      }

    >

      {children}

    </Swipeable>

  )

}



const styles = StyleSheet.create({

  cluster: {

    flexDirection: 'row',

    alignItems: 'stretch',

  },

  action: {

    backgroundColor: colors.primary,

    justifyContent: 'center',

    paddingHorizontal: spacing.md,

    marginBottom: spacing.md,

    borderRadius: radius.md,

    marginLeft: spacing.xs,

  },

  danger: { backgroundColor: colors.danger },

  neutral: { backgroundColor: colors.borderStrong },

  actionText: { ...typography.caption, color: colors.textInverse, fontWeight: '700' },

})


import { Stack } from 'expo-router'
import { colors } from '@/theme'

export default function PurchaseLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.background },
      }}
    />
  )
}

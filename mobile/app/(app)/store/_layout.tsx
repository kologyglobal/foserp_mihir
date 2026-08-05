import { Stack } from 'expo-router'
import { colors } from '@/theme'

export default function StoreLayout() {
  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background } }} />
  )
}

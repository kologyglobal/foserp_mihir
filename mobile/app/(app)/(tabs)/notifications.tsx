import { Redirect } from 'expo-router'

/** Legacy tab route — keep file so Expo does not break; hidden via tabs href:null */
export default function LegacyNotificationsRedirect() {
  return <Redirect href="/(app)/crm/notifications" />
}

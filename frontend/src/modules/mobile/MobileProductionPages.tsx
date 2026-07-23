import { isApiMode } from '@/config/apiConfig'
import { MobileShopfloorKioskPage } from './kiosk/MobileShopfloorKioskPage'
import {
  MobileShopFloorDemoPage,
  MobileJobCardDemoPage,
  MobileJobCardDailyEntryDemoPage,
} from './MobileProductionDemoPages'

/** Shopfloor entry — live kiosk in API mode, demo job cards otherwise. */
export function MobileShopFloorPage() {
  if (isApiMode()) return <MobileShopfloorKioskPage />
  return <MobileShopFloorDemoPage />
}

export function MobileJobCardPage() {
  if (isApiMode()) return <MobileShopfloorKioskPage />
  return <MobileJobCardDemoPage />
}

export function MobileJobCardDailyEntryPage() {
  if (isApiMode()) return <MobileShopfloorKioskPage />
  return <MobileJobCardDailyEntryDemoPage />
}

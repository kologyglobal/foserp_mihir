import { isApiMode } from '@/config/apiConfig'
import {
  MobileQcKioskListPage,
  MobileQcKioskDetailPage,
  MobileNcrKioskPage,
} from './kiosk/MobileQcKioskPages'
import { MobileQcListDemoPage, MobileQcDetailDemoPage, MobileNcrDemoPage } from './MobileQualityDemoPages'

export function MobileQcListPage() {
  if (isApiMode()) return <MobileQcKioskListPage />
  return <MobileQcListDemoPage />
}

export function MobileQcDetailPage() {
  if (isApiMode()) return <MobileQcKioskDetailPage />
  return <MobileQcDetailDemoPage />
}

export function MobileNcrPage() {
  if (isApiMode()) return <MobileNcrKioskPage />
  return <MobileNcrDemoPage />
}

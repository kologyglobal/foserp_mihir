import { isApiMode } from '@/config/apiConfig'
import { BankCashOverviewPage as DemoOverviewPage } from '@/modules/accounting/BankCashOverviewPage'
import { ApiLiquidityDashboardPage } from './ApiLiquidityDashboardPage'

/** Bank & Cash overview: API liquidity dashboard when VITE_USE_API=true, else demo overview. */
export function LiquidityDashboardPage() {
  if (!isApiMode()) return <DemoOverviewPage />
  return <ApiLiquidityDashboardPage />
}

import { isApiMode } from '@/config/apiConfig'
import { ApiConnectorListPage } from './ApiConnectorListPage'
import { DemoConnectorListPage } from './DemoConnectorListPage'

/** Route entry — API connectors when VITE_USE_API=true, else demo seed (disabled only). */
export function ConnectorListPage() {
  if (!isApiMode()) return <DemoConnectorListPage />
  return <ApiConnectorListPage />
}

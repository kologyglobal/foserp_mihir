import * as api from '@/services/api/treasuryApi'
import type {
  BankConnectorDto,
  BankConnectorProviderCatalogItem,
  CreateBankConnectorInput,
  ListBankConnectorsQuery,
  UpdateBankConnectorInput,
} from './bank-connector.types'

function unwrap<T>(res: { data: T }): T {
  return res.data
}

export async function fetchBankConnectorProviders(): Promise<BankConnectorProviderCatalogItem[]> {
  return unwrap(await api.listBankConnectorProviders())
}

export async function fetchBankConnectors(query: ListBankConnectorsQuery) {
  return api.listBankConnectors(query)
}

export async function fetchBankConnector(id: string): Promise<BankConnectorDto> {
  return unwrap(await api.getBankConnector(id))
}

export async function createBankConnector(data: CreateBankConnectorInput): Promise<BankConnectorDto> {
  return unwrap(await api.createBankConnector(data))
}

export async function updateBankConnector(id: string, data: UpdateBankConnectorInput): Promise<BankConnectorDto> {
  return unwrap(await api.updateBankConnector(id, data))
}

export async function enableBankConnector(id: string, expectedUpdatedAt: string): Promise<BankConnectorDto> {
  return unwrap(await api.enableBankConnector(id, { expectedUpdatedAt }))
}

export async function disableBankConnector(id: string, expectedUpdatedAt: string): Promise<BankConnectorDto> {
  return unwrap(await api.disableBankConnector(id, { expectedUpdatedAt }))
}

export async function testBankConnectorConnection(id: string) {
  return unwrap(await api.testBankConnectorConnection(id))
}

export async function syncBankConnector(id: string) {
  return unwrap(await api.syncBankConnector(id))
}

export async function startBankConnectorConsent(id: string, redirectUri: string) {
  return unwrap(await api.startBankConnectorConsent(id, { redirectUri }))
}

export async function revokeBankConnectorConsent(id: string) {
  return unwrap(await api.revokeBankConnectorConsent(id))
}

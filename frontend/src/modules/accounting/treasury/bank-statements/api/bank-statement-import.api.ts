import * as api from '@/services/api/treasuryApi'
import type {
  ExecuteImportBatchInput,
  ImportBatchDto,
  ImportPreviewResult,
  InspectImportBatchInput,
  LifecycleInput,
  PreviewImportBatchInput,
} from './bank-statement.types'

function unwrap<T>(res: { data: T }): T {
  return res.data
}

export async function uploadImportBatch(input: {
  treasuryAccountId: string
  importFormat: 'CSV' | 'XLSX' | 'MT940' | 'CAMT_053' | 'AUTO_DETECT'
  mappingTemplateId?: string
  file: File
}): Promise<ImportBatchDto> {
  return unwrap(await api.createImportBatch(input))
}

export async function fetchImportBatch(id: string): Promise<ImportBatchDto> {
  return unwrap(await api.getImportBatch(id))
}

export async function inspectBatch(id: string, body: InspectImportBatchInput) {
  return unwrap(await api.inspectImportBatch(id, body))
}

export async function previewBatch(id: string, body: PreviewImportBatchInput) {
  const data = unwrap(await api.previewImportBatch(id, body))
  return {
    preview: data.preview as unknown as ImportPreviewResult,
    mappingConfig: data.mappingConfig,
  }
}

export async function executeBatchImport(id: string, body: ExecuteImportBatchInput) {
  return unwrap(await api.executeImportBatch(id, body))
}

export async function retryBatchImport(id: string, body: ExecuteImportBatchInput) {
  return unwrap(await api.retryImportBatch(id, body))
}

export async function cancelBatch(id: string, body: LifecycleInput): Promise<ImportBatchDto> {
  return unwrap(await api.cancelImportBatch(id, body))
}

export async function downloadBatchFile(id: string) {
  return api.downloadImportBatchFile(id)
}

export async function fetchMappingTemplates(legalEntityId: string, treasuryAccountId?: string) {
  return api.listMappingTemplates({
    legalEntityId,
    treasuryAccountId,
    isActive: true,
    limit: 100,
  })
}

export async function fetchAllMappingTemplates(legalEntityId: string) {
  return api.listMappingTemplates({ legalEntityId, limit: 100 })
}

export async function activateTemplate(id: string, expectedUpdatedAt: string) {
  return unwrap(await api.activateMappingTemplate(id, expectedUpdatedAt))
}

export async function deactivateTemplate(id: string, expectedUpdatedAt: string) {
  return unwrap(await api.deactivateMappingTemplate(id, expectedUpdatedAt))
}

export async function createTemplate(data: Record<string, unknown>) {
  return unwrap(await api.createMappingTemplate(data))
}

export async function updateTemplate(id: string, data: Record<string, unknown>) {
  return unwrap(await api.updateMappingTemplate(id, data))
}

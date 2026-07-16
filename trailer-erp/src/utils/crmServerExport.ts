import { apiDownloadBlob } from '../services/api/client'
import { crmExportUrl } from '../services/api/crmApi'
import { isApiMode } from '../config/apiConfig'
import { canCrmPermission } from './permissions/crm'
import { formatApiError } from '../services/api/apiErrors'

export type CrmExportResource =
  | 'companies'
  | 'contacts'
  | 'leads'
  | 'opportunities'
  | 'quotations'
  | 'activities'
  | 'follow-ups'

export async function downloadCrmServerExport(
  resource: CrmExportResource,
  params?: Record<string, string | undefined>,
  filename?: string,
): Promise<{ ok: boolean; error?: string }> {
  if (!isApiMode()) return { ok: false, error: 'Server export requires API mode' }
  if (!canCrmPermission('crm.export.execute')) {
    return { ok: false, error: 'You do not have permission to export CRM data.' }
  }
  try {
    const { blob } = await apiDownloadBlob(crmExportUrl(resource, params))
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename ?? `${resource}-export.csv`
    a.click()
    URL.revokeObjectURL(url)
    return { ok: true }
  } catch (err) {
    return { ok: false, error: formatApiError(err) }
  }
}

/** Run server export in API mode, otherwise invoke demo export callback. */
export async function runCrmExport(
  resource: CrmExportResource,
  demoExport: () => void,
  params?: Record<string, string | undefined>,
  filename?: string,
): Promise<{ ok: boolean; error?: string }> {
  if (!isApiMode()) {
    demoExport()
    return { ok: true }
  }
  return downloadCrmServerExport(resource, params, filename)
}

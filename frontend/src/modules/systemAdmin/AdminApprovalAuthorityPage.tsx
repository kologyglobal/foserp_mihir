import { useCallback, useEffect, useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { AdminWorkspaceShell } from './AdminWorkspaceShell'
import { APPROVAL_DOCUMENT_TYPES } from '@/config/adminAccessWorkspace'
import { ErpButton } from '@/components/erp/ErpButton'
import { FormField } from '@/components/forms/FormField'
import { Input, Select } from '@/components/forms/Inputs'
import { SELECT_PLACEHOLDER } from '@/components/forms/selectStandards'
import { isApiMode } from '@/config/apiConfig'
import {
  createApprovalAuthorityRuleApi,
  deleteApprovalAuthorityRuleApi,
  fetchApprovalAuthorityRulesApi,
} from '@/services/api/adminApi'
import { useAdminStore } from '@/store/adminStore'
import { notify } from '@/store/toastStore'
import { formatApiError } from '@/services/api/apiErrors'
import { formatCurrency } from '@/utils/formatters/currency'
import { canAdminPermission } from '@/utils/permissions'

type RuleRow = {
  id: string
  documentType: string
  amountFrom: number | string
  amountTo?: number | string | null
  roleId?: string | null
  userId?: string | null
  selfApprovalAllowed?: boolean
  notes?: string | null
}

export function AdminApprovalAuthorityPage() {
  const roles = useAdminStore((s) => s.roles)
  const users = useAdminStore((s) => s.users)
  const canEdit = canAdminPermission('user.update')
  const [rows, setRows] = useState<RuleRow[]>([])
  const [documentType, setDocumentType] = useState('QUOTATION')
  const [amountFrom, setAmountFrom] = useState('0')
  const [amountTo, setAmountTo] = useState('500000')
  const [roleId, setRoleId] = useState('')
  const [selfApproval, setSelfApproval] = useState(false)
  const [loading, setLoading] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      if (!isApiMode()) {
        setRows([
          {
            id: 'demo-1',
            documentType: 'QUOTATION',
            amountFrom: 0,
            amountTo: 500000,
            roleId: roles[0]?.id,
            selfApprovalAllowed: false,
            notes: 'Demo Sales Manager band',
          },
          {
            id: 'demo-2',
            documentType: 'QUOTATION',
            amountFrom: 500000.01,
            amountTo: null,
            notes: 'Demo Director band',
          },
        ])
        return
      }
      const res = await fetchApprovalAuthorityRulesApi()
      setRows((res.data as RuleRow[]) ?? [])
    } catch (e) {
      notify.error(formatApiError(e))
    } finally {
      setLoading(false)
    }
  }, [roles])

  useEffect(() => {
    void load()
  }, [load])

  async function onCreate() {
    if (!canEdit) return
    try {
      if (isApiMode()) {
        await createApprovalAuthorityRuleApi({
          documentType,
          amountFrom: Number(amountFrom) || 0,
          amountTo: amountTo === '' ? null : Number(amountTo),
          roleId: roleId || null,
          selfApprovalAllowed: selfApproval,
        })
        notify.success('Approval band created')
        await load()
      } else {
        setRows((prev) => [
          ...prev,
          {
            id: `demo-${Date.now()}`,
            documentType,
            amountFrom: Number(amountFrom) || 0,
            amountTo: amountTo === '' ? null : Number(amountTo),
            roleId: roleId || null,
            selfApprovalAllowed: selfApproval,
          },
        ])
        notify.success('Demo band added')
      }
    } catch (e) {
      notify.error(formatApiError(e))
    }
  }

  async function onDelete(id: string) {
    try {
      if (isApiMode()) {
        await deleteApprovalAuthorityRuleApi(id)
        notify.success('Rule removed')
        await load()
      } else {
        setRows((prev) => prev.filter((r) => r.id !== id))
      }
    } catch (e) {
      notify.error(formatApiError(e))
    }
  }

  return (
    <AdminWorkspaceShell
      title="Approval Authority"
      description="Document-wise amount bands for roles/users. Complements purchase approver limits — self-approval risks appear on Access Review."
      workspace="people"
      favoritePath="/admin/approval-authority"
    >
      <div className="space-y-4">
        <div className="grid gap-3 rounded-lg border border-erp-border bg-white p-4 md:grid-cols-3">
          <FormField label="Document type">
            <Select value={documentType} onChange={(e) => setDocumentType(e.target.value)}>
              {APPROVAL_DOCUMENT_TYPES.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.label}
                </option>
              ))}
            </Select>
          </FormField>
          <FormField label="Amount from (₹)">
            <Input value={amountFrom} onChange={(e) => setAmountFrom(e.target.value)} />
          </FormField>
          <FormField label="Amount to (blank = open)">
            <Input value={amountTo} onChange={(e) => setAmountTo(e.target.value)} />
          </FormField>
          <FormField label="Role">
            <Select value={roleId} onChange={(e) => setRoleId(e.target.value)}>
              <option value="">{SELECT_PLACEHOLDER}</option>
              {roles.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </Select>
          </FormField>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={selfApproval} onChange={(e) => setSelfApproval(e.target.checked)} />
            Self-approval allowed
          </label>
          <div className="flex items-end">
            <ErpButton size="sm" type="button" icon={Plus} disabled={!canEdit} onClick={() => void onCreate()}>
              Add band
            </ErpButton>
          </div>
        </div>

        <div className="overflow-x-auto rounded-lg border border-erp-border bg-white">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 text-left text-[10px] uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-3 py-2">Document</th>
                <th className="px-3 py-2">Band</th>
                <th className="px-3 py-2">Role / User</th>
                <th className="px-3 py-2">Self</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={5} className="px-3 py-6 text-erp-muted">
                    Loading…
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-3 py-6 text-erp-muted">
                    No rules yet.
                  </td>
                </tr>
              ) : (
                rows.map((r) => {
                  const roleName = roles.find((x) => x.id === r.roleId)?.name
                  const userName = users.find((x) => x.id === r.userId)
                  return (
                    <tr key={r.id} className="border-t border-slate-100">
                      <td className="px-3 py-2 font-medium">
                        {APPROVAL_DOCUMENT_TYPES.find((d) => d.id === r.documentType)?.label ?? r.documentType}
                      </td>
                      <td className="px-3 py-2 tabular-nums">
                        {formatCurrency(Number(r.amountFrom) || 0)}
                        {' – '}
                        {r.amountTo == null || r.amountTo === ''
                          ? '∞'
                          : formatCurrency(Number(r.amountTo) || 0)}
                      </td>
                      <td className="px-3 py-2">
                        {roleName ??
                          (userName ? `${userName.firstName} ${userName.lastName}` : '-')}
                      </td>
                      <td className="px-3 py-2">{r.selfApprovalAllowed ? 'Yes' : 'No'}</td>
                      <td className="px-3 py-2 text-right">
                        <button
                          type="button"
                          className="inline-flex text-red-600"
                          disabled={!canEdit}
                          onClick={() => void onDelete(r.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </AdminWorkspaceShell>
  )
}

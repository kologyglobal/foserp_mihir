import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Eye, FileText } from 'lucide-react'
import { useCrmStore } from '../../../store/crmStore'
import { resolveStoreAction } from '../../../store/storeAction'
import { formatApiError } from '../../../services/api/apiErrors'
import { notify } from '../../../store/toastStore'
import { useActiveCustomers, useSellableItems } from '../../../hooks/useMasterLists'
import { buildOpportunityLineFromItem } from '../../../utils/opportunityLineCalc'
import { useMasterStore } from '../../../store/masterStore'
import { crmQuotationEditorPath, crmQuotationPath } from '../../../utils/crmQuotationNavigation'
import { filterAllowedQuotationTemplates } from '../../../utils/quotationEngine/builtinTemplateSync'
import { CrmDrawerShell } from '../CrmDrawerShell'
import { FormField } from '../../forms/FormField'
import { Input, Select } from '../../forms/Inputs'
import { Button } from '../../ui/Button'
import { ErpButton, ErpButtonGroup } from '../../erp/ErpButton'
import { SELECT_PLACEHOLDER } from '../../forms/selectStandards'

interface QuickQuotationDrawerProps {
  open: boolean
  onClose: () => void
}

function defaultValidityDate(days = 30): string {
  const d = new Date()
  d.setDate(d.getDate() + days)
  return d.toISOString().slice(0, 10)
}

export function QuickQuotationDrawer({ open, onClose }: QuickQuotationDrawerProps) {
  const navigate = useNavigate()
  const createDirect = useCrmStore((s) => s.createQuotationDirect)
  const quotationTemplates = useCrmStore((s) => s.quotationTemplates)
  const templates = useMemo(
    () => filterAllowedQuotationTemplates(quotationTemplates),
    [quotationTemplates],
  )
  const customers = useActiveCustomers()
  const sellableItems = useSellableItems()
  const getItem = useMasterStore((s) => s.getItem)
  const getUomName = useMasterStore((s) => s.getUomName)

  const defaultTemplateId = templates[0]?.id ?? ''
  const [customerId, setCustomerId] = useState('')
  const [itemId, setItemId] = useState('')
  const [qty, setQty] = useState('1')
  const [unitPrice, setUnitPrice] = useState('')
  const [validityDate, setValidityDate] = useState(defaultValidityDate())
  const [templateId, setTemplateId] = useState(defaultTemplateId)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [savedIds, setSavedIds] = useState<{ quotationId: string; documentId: string } | null>(null)

  useEffect(() => {
    if (!open) return
    setCustomerId(customers[0]?.id ?? '')
    const firstItem = sellableItems[0]
    setItemId(firstItem?.id ?? '')
    setQty('1')
    setUnitPrice(firstItem ? String(firstItem.defaultSalesRate ?? firstItem.standardRate ?? '') : '')
    setValidityDate(defaultValidityDate())
    setTemplateId(templates[0]?.id ?? '')
    setSubmitting(false)
    setError(null)
    setSavedIds(null)
  }, [open, customers, sellableItems, templates])

  function handleItemChange(id: string) {
    setItemId(id)
    const item = getItem(id)
    if (item) setUnitPrice(String(item.defaultSalesRate ?? item.standardRate ?? ''))
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (submitting) return
    if (!customerId) {
      setError('Select a customer.')
      notify.warning('Select a customer.')
      return
    }
    if (!itemId) {
      setError('Select a sellable item.')
      notify.warning('Select a sellable item.')
      return
    }
    const price = Number(unitPrice)
    const quantity = Math.max(1, Number(qty) || 1)
    if (!price || price <= 0) {
      setError('Unit price must be greater than zero.')
      notify.warning('Unit price must be greater than zero.')
      return
    }
    if (!templateId) {
      setError('No quotation template available — open the full quotation form.')
      notify.warning('No quotation template available — open the full quotation form.')
      return
    }
    const item = getItem(itemId)
    if (!item) {
      setError('Item not found.')
      notify.warning('Item not found.')
      return
    }
    const uomName = item.baseUomId ? getUomName(item.baseUomId).split(' ')[0] : 'Nos'
    const line = buildOpportunityLineFromItem(item, uomName || 'Nos', 1)
    line.qty = quantity
    line.unitPrice = price

    setSubmitting(true)
    setError(null)
    void (async () => {
      try {
        const r = await resolveStoreAction(
          createDirect(customerId, templateId, price, [line], {
            validityDate,
          }),
        )
        if (!r.ok || !r.documentId || !r.quotationId) {
          const msg = r.error ?? formatApiError('Failed to create quotation')
          setError(msg)
          notify.error(msg)
          return
        }
        notify.success('Draft quotation created')
        setSavedIds({ quotationId: r.quotationId, documentId: r.documentId })
      } finally {
        setSubmitting(false)
      }
    })()
  }

  return (
    <CrmDrawerShell
      open={open}
      placement="modal"
      title="Quick Quotation"
      subtitle="Customer + one line — open the full editor for sections and revisions"
      onClose={onClose}
      width="lg"
      footer={
        savedIds ? null : (
          <Button type="submit" form="crm-quick-quote-form" className="w-full" disabled={submitting}>
            {submitting ? 'Creating…' : 'Create Draft Quote'}
          </Button>
        )
      }
    >
      {savedIds ? (
        <div className="space-y-3">
          <p className="text-[14px] font-semibold text-emerald-900">Draft quotation created</p>
          <ErpButtonGroup>
            <ErpButton
              type="button"
              variant="primary"
              icon={FileText}
              onClick={() => {
                onClose()
                navigate(crmQuotationEditorPath(savedIds.quotationId, savedIds.documentId))
              }}
            >
              Open Full Quotation
            </ErpButton>
            <ErpButton
              type="button"
              variant="secondary"
              icon={Eye}
              onClick={() => {
                onClose()
                navigate(crmQuotationPath(savedIds.quotationId))
              }}
            >
              View 360
            </ErpButton>
          </ErpButtonGroup>
        </div>
      ) : (
        <form id="crm-quick-quote-form" onSubmit={handleSubmit} className="crm-drawer-form">
          {error ? <p className="text-sm text-red-600">{error}</p> : null}
          <FormField label="Customer" required>
            <Select value={customerId} onChange={(e) => setCustomerId(e.target.value)} required>
              <option value="">{SELECT_PLACEHOLDER}</option>
              {customers.map((c) => (
                <option key={c.id} value={c.id}>{c.customerName}</option>
              ))}
            </Select>
          </FormField>
          <FormField label="Item" required hint="Only items allowed for sales are listed.">
            <Select value={itemId} onChange={(e) => handleItemChange(e.target.value)} required>
              <option value="">{SELECT_PLACEHOLDER}</option>
              {sellableItems.map((item) => (
                <option key={item.id} value={item.id}>{item.itemCode} — {item.itemName}</option>
              ))}
            </Select>
          </FormField>
          <div className="grid grid-cols-2 gap-3">
            <FormField label="Qty" required>
              <Input type="number" min={1} value={qty} onChange={(e) => setQty(e.target.value)} />
            </FormField>
            <FormField label="Unit price (₹)" required>
              <Input type="number" min={0} step="0.01" value={unitPrice} onChange={(e) => setUnitPrice(e.target.value)} />
            </FormField>
          </div>
          <FormField label="Validity">
            <Input type="date" value={validityDate} onChange={(e) => setValidityDate(e.target.value)} />
          </FormField>
          {templates.length > 1 ? (
            <FormField label="Template">
              <Select value={templateId} onChange={(e) => setTemplateId(e.target.value)}>
                {templates.map((t) => (
                  <option key={t.id} value={t.id}>{t.templateName || t.code || t.id}</option>
                ))}
              </Select>
            </FormField>
          ) : null}
          <p className="text-[12px] text-erp-muted">
            Need a multi-line or opportunity-linked quote?{' '}
            <button
              type="button"
              className="font-semibold text-erp-primary hover:underline"
              onClick={() => {
                onClose()
                navigate('/crm/quotations/new')
              }}
            >
              Open full form
            </button>
          </p>
        </form>
      )}
    </CrmDrawerShell>
  )
}

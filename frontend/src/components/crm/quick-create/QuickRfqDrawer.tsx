import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { FileText } from 'lucide-react'
import {
  createRFQ,
  getPurchaseItems,
  getVendors,
  PurchaseServiceError,
} from '../../../services/purchase'
import { PURCHASE_DEMO_LOCATION } from '../../../data/purchase/purchaseDomainSeed'
import { CrmDrawerShell } from '../CrmDrawerShell'
import { FormField } from '../../forms/FormField'
import { Input, Textarea } from '../../forms/Inputs'
import { Button } from '../../ui/Button'
import { ErpButton, ErpButtonGroup } from '../../erp/ErpButton'
import { useActiveLocations } from '../../../hooks/useMasterLists'

interface QuickRfqDrawerProps {
  open: boolean
  onClose: () => void
}

function defaultBidDue(days = 14): string {
  const d = new Date()
  d.setDate(d.getDate() + days)
  return d.toISOString().slice(0, 10)
}

export function QuickRfqDrawer({ open, onClose }: QuickRfqDrawerProps) {
  const navigate = useNavigate()
  const locations = useActiveLocations()
  const [title, setTitle] = useState('')
  const [bidDueDate, setBidDueDate] = useState(defaultBidDue())
  const [locationId, setLocationId] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [savedId, setSavedId] = useState<string | null>(null)
  const [savedNo, setSavedNo] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    setTitle('')
    setBidDueDate(defaultBidDue())
    setLocationId(locations[0]?.id ?? PURCHASE_DEMO_LOCATION.id)
    setSubmitting(false)
    setError(null)
    setSavedId(null)
    setSavedNo(null)
  }, [open, locations])

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (submitting) return
    const remarks = title.trim()
    if (!remarks) {
      setError('Enter a short description for this RFQ.')
      return
    }
    setSubmitting(true)
    setError(null)
    void (async () => {
      try {
        const [vendors, items] = await Promise.all([getVendors(), getPurchaseItems()])
        const vendorIds = vendors.slice(0, 2).map((v) => v.id)
        const item = items[0]
        if (!vendorIds.length) {
          setError('No vendors available — open the full RFQ form and add vendors.')
          return
        }
        if (!item) {
          setError('No purchase items available — open the full RFQ form to add lines.')
          return
        }
        const masterLoc = locations.find((l) => l.id === locationId)
        const location = masterLoc
          ? {
              id: masterLoc.id,
              code: masterLoc.locationCode ?? masterLoc.id,
              name: masterLoc.locationName,
              state: masterLoc.state || PURCHASE_DEMO_LOCATION.state,
              city: masterLoc.city || PURCHASE_DEMO_LOCATION.city,
            }
          : { ...PURCHASE_DEMO_LOCATION }
        const created = await createRFQ({
          documentDate: new Date().toISOString().slice(0, 10),
          bidDueDate,
          remarks,
          purchaseRequisitionIds: [],
          vendorIds,
          purchaseLocation: location,
          deliveryLocation: location,
          location,
          lines: [
            {
              itemId: item.id,
              itemCode: item.itemCode,
              itemName: item.itemName,
              quantity: 1,
              uom: item.uom,
              targetPrice: item.standardRate,
              remarks,
              requiredDate: bidDueDate,
            },
          ],
        })
        setSavedId(created.id)
        setSavedNo(created.documentNumber)
      } catch (err) {
        setError(err instanceof PurchaseServiceError ? err.message : 'Failed to create RFQ')
      } finally {
        setSubmitting(false)
      }
    })()
  }

  return (
    <CrmDrawerShell
      open={open}
      placement="modal"
      title="Quick RFQ"
      subtitle="Draft header now — complete vendors and lines in the editor"
      onClose={onClose}
      footer={
        savedId ? null : (
          <Button type="submit" form="crm-quick-rfq-form" className="w-full" disabled={submitting}>
            Create Draft RFQ
          </Button>
        )
      }
    >
      {savedId ? (
        <div className="space-y-3">
          <p className="text-[14px] font-semibold text-emerald-900">
            Draft RFQ created{savedNo ? ` — ${savedNo}` : ''}
          </p>
          <p className="text-[13px] text-erp-muted">Review vendors and item lines next.</p>
          <ErpButtonGroup>
            <ErpButton
              type="button"
              variant="primary"
              icon={FileText}
              onClick={() => {
                onClose()
                navigate(`/purchase/rfqs/${savedId}/edit`)
              }}
            >
              Open RFQ Editor
            </ErpButton>
          </ErpButtonGroup>
        </div>
      ) : (
        <form id="crm-quick-rfq-form" onSubmit={handleSubmit} className="crm-drawer-form">
          {error ? <p className="text-sm text-red-600">{error}</p> : null}
          <FormField label="Description" required hint="What are you inviting quotes for?">
            <Textarea
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              rows={3}
              placeholder="e.g. Mild steel plate 8mm — Chakan plant"
              required
            />
          </FormField>
          <FormField label="Enquiry due date" required>
            <Input type="date" value={bidDueDate} onChange={(e) => setBidDueDate(e.target.value)} required />
          </FormField>
          {locations.length > 0 ? (
            <FormField label="Purchase location">
              <select
                className="erp-input w-full"
                value={locationId}
                onChange={(e) => setLocationId(e.target.value)}
              >
                {locations.map((l) => (
                  <option key={l.id} value={l.id}>{l.locationName}</option>
                ))}
              </select>
            </FormField>
          ) : null}
          <p className="text-[12px] text-erp-muted">
            A starter vendor and line are added automatically so the draft can be saved. Adjust them in the editor.
          </p>
        </form>
      )}
    </CrmDrawerShell>
  )
}

import { SlidersHorizontal } from 'lucide-react'
import { CrmDrawerShell } from './CrmDrawerShell'
import { FormField } from '../forms/FormField'
import { Input } from '../forms/Inputs'
import { ErpButton, ErpButtonGroup } from '../erp/ErpButton'
import type { LeadListFilters } from '../../utils/leadListUtils'
import { countAdvancedLeadFilters } from '../../utils/leadListUtils'

interface LeadAdvancedFiltersDrawerProps {
  open: boolean
  onClose: () => void
  filters: LeadListFilters
  onChange: (filters: LeadListFilters) => void
  onApply: () => void
  onClearAdvanced: () => void
}

export function LeadAdvancedFiltersDrawer({
  open,
  onClose,
  filters,
  onChange,
  onApply,
  onClearAdvanced,
}: LeadAdvancedFiltersDrawerProps) {
  const activeCount = countAdvancedLeadFilters(filters)

  return (
    <CrmDrawerShell
      open={open}
      onClose={onClose}
      title="Advanced Filters"
      subtitle="Probability, expected value, and date ranges"
      width="md"
      footer={
        <ErpButtonGroup className="justify-between">
          <ErpButton type="button" variant="ghost" onClick={onClearAdvanced} disabled={activeCount === 0}>
            Clear advanced
          </ErpButton>
          <ErpButtonGroup>
            <ErpButton type="button" variant="secondary" onClick={onClose}>
              Cancel
            </ErpButton>
            <ErpButton type="button" variant="primary" icon={SlidersHorizontal} onClick={onApply}>
              Apply Filters
            </ErpButton>
          </ErpButtonGroup>
        </ErpButtonGroup>
      }
    >
      <div className="space-y-5">
        <section>
          <h3 className="mb-3 text-[12px] font-semibold uppercase tracking-wide text-erp-muted">Probability %</h3>
          <div className="grid gap-3 sm:grid-cols-2">
            <FormField label="Minimum">
              <Input
                type="number"
                min={0}
                max={100}
                value={filters.probMin}
                onChange={(e) => onChange({ ...filters, probMin: e.target.value })}
                placeholder="e.g. 20"
              />
            </FormField>
            <FormField label="Maximum">
              <Input
                type="number"
                min={0}
                max={100}
                value={filters.probMax}
                onChange={(e) => onChange({ ...filters, probMax: e.target.value })}
                placeholder="e.g. 80"
              />
            </FormField>
          </div>
        </section>

        <section>
          <h3 className="mb-3 text-[12px] font-semibold uppercase tracking-wide text-erp-muted">Expected Value (₹)</h3>
          <div className="grid gap-3 sm:grid-cols-2">
            <FormField label="Minimum">
              <Input
                type="number"
                min={0}
                value={filters.valueMin}
                onChange={(e) => onChange({ ...filters, valueMin: e.target.value })}
                placeholder="e.g. 500000"
              />
            </FormField>
            <FormField label="Maximum">
              <Input
                type="number"
                min={0}
                value={filters.valueMax}
                onChange={(e) => onChange({ ...filters, valueMax: e.target.value })}
                placeholder="e.g. 5000000"
              />
            </FormField>
          </div>
        </section>

        <section>
          <h3 className="mb-3 text-[12px] font-semibold uppercase tracking-wide text-erp-muted">Created Date</h3>
          <div className="grid gap-3 sm:grid-cols-2">
            <FormField label="From">
              <Input
                type="date"
                value={filters.dateFrom}
                onChange={(e) => onChange({ ...filters, dateFrom: e.target.value })}
              />
            </FormField>
            <FormField label="To">
              <Input
                type="date"
                value={filters.dateTo}
                onChange={(e) => onChange({ ...filters, dateTo: e.target.value })}
              />
            </FormField>
          </div>
        </section>

        <section>
          <h3 className="mb-3 text-[12px] font-semibold uppercase tracking-wide text-erp-muted">Last Modified</h3>
          <div className="grid gap-3 sm:grid-cols-2">
            <FormField label="From">
              <Input
                type="date"
                value={filters.modifiedFrom}
                onChange={(e) => onChange({ ...filters, modifiedFrom: e.target.value })}
              />
            </FormField>
            <FormField label="To">
              <Input
                type="date"
                value={filters.modifiedTo}
                onChange={(e) => onChange({ ...filters, modifiedTo: e.target.value })}
              />
            </FormField>
          </div>
        </section>
      </div>
    </CrmDrawerShell>
  )
}

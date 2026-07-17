import { useEffect, useState } from 'react'
import { Select } from '@/components/forms/Inputs'
import { listLegalEntities, useFinanceSetupStore } from '@/services/bridges/financeApiBridge'
import type { LegalEntity } from '@/types/financeSetup'

export function FinanceLegalEntitySwitcher() {
  const selectedId = useFinanceSetupStore((s) => s.selectedLegalEntityId)
  const setSelected = useFinanceSetupStore((s) => s.setSelectedLegalEntityId)
  const [entities, setEntities] = useState<LegalEntity[]>([])

  useEffect(() => {
    void listLegalEntities().then(setEntities).catch(() => setEntities([]))
  }, [selectedId])

  if (entities.length <= 1) return null

  return (
    <div className="flex items-center gap-2">
      <span className="text-[11px] font-medium text-erp-muted">Company</span>
      <Select
        className="min-w-[180px] text-[12px]"
        value={selectedId ?? entities.find((e) => e.isDefault)?.id ?? entities[0]?.id ?? ''}
        onChange={(e) => setSelected(e.target.value)}
      >
        {entities.map((le) => (
          <option key={le.id} value={le.id}>
            {le.displayName}
          </option>
        ))}
      </Select>
    </div>
  )
}

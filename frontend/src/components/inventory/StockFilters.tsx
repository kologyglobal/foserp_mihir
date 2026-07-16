import { Select } from '../forms/Inputs'
import { SearchInput } from '../ui/SearchInput'

interface StockFiltersProps {
  warehouseId: string
  onWarehouseChange: (v: string) => void
  search: string
  onSearchChange: (v: string) => void
  warehouses: { id: string; warehouseCode: string; warehouseName: string }[]
  extra?: React.ReactNode
}

export function StockFilters({
  warehouseId,
  onWarehouseChange,
  search,
  onSearchChange,
  warehouses,
  extra,
}: StockFiltersProps) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <SearchInput
        value={search}
        onChange={onSearchChange}
        placeholder="Search item code or name..."
        className="w-full sm:w-72"
      />
      <div className="flex flex-wrap gap-2">
        <Select value={warehouseId} onChange={(e) => onWarehouseChange(e.target.value)} className="w-52">
          <option value="">All Warehouses</option>
          {warehouses.filter((w) => w).map((w) => (
            <option key={w.id} value={w.id}>
              {w.warehouseCode} — {w.warehouseName}
            </option>
          ))}
        </Select>
        {extra}
      </div>
    </div>
  )
}

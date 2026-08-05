/** Demo-mode BIN options — mirrors canonical MasterBin codes (not a separate register). */
export type DemoBinOption = {
  id: string
  code: string
  name: string
  warehouseId?: string
  storageLocationId?: string
}

export const DEMO_BIN_OPTIONS: DemoBinOption[] = [
  { id: 'demo-bin-A1-01', code: 'A1-01', name: 'Rack A / Bin 01' },
  { id: 'demo-bin-A1-02', code: 'A1-02', name: 'Rack A / Bin 02' },
  { id: 'demo-bin-B2-01', code: 'B2-01', name: 'Rack B / Bin 01' },
  { id: 'demo-bin-C3-01', code: 'C3-01', name: 'Rack C / Quarantine' },
  { id: 'demo-bin-FG-01', code: 'FG-01', name: 'Finished Goods Bin 01' },
]

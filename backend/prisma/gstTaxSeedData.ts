/** India GST groups, rates, and HSN codes for trailer / tank manufacturing. */

export type GstGroupSeedRow = {
  code: string
  goodsType: 'goods' | 'service'
  description: string
}

export type GstRateSeedRow = {
  code: string
  gstGroupCode: string
  fromState: string
  locationStateCode: string
  dateFrom: string
  sgst: number
  cgst: number
  igst: number
  applicableFor?: 'SALES' | 'PURCHASE' | 'BOTH'
}

export type HsnSeedRow = {
  code: string
  gstGroupCode: string
  description: string
}

export const GST_GROUP_SEED_ROWS: GstGroupSeedRow[] = [
  {
    code: 'GST18-GOODS',
    goodsType: 'goods',
    description: 'Standard 18% GST on goods — trailers, assemblies, components',
  },
  {
    code: 'GST12-GOODS',
    goodsType: 'goods',
    description: 'Reduced 12% GST on selected steel & structural goods',
  },
  {
    code: 'GST5-GOODS',
    goodsType: 'goods',
    description: 'Concessional 5% GST on essential inputs',
  },
  {
    code: 'GST28-GOODS',
    goodsType: 'goods',
    description: '28% GST on luxury / high-rate goods (if applicable)',
  },
  {
    code: 'GST0-GOODS',
    goodsType: 'goods',
    description: 'Nil-rated / exempt goods',
  },
  {
    code: 'GST18-SERVICE',
    goodsType: 'service',
    description: '18% GST on fabrication, painting & service charges',
  },
  {
    code: 'GST12-SERVICE',
    goodsType: 'service',
    description: '12% GST on selected services',
  },
  {
    code: 'GST5-SERVICE',
    goodsType: 'service',
    description: '5% GST on concessional services',
  },
]

/** Plant in Gujarat — intra GJ + common inter-state IGST lanes (BOTH sales & purchase). */
export const GST_RATE_SEED_ROWS: GstRateSeedRow[] = [
  // Intra-Gujarat
  { code: 'GSTR-18-GJ-IN', gstGroupCode: 'GST18-GOODS', fromState: 'Gujarat', locationStateCode: 'Gujarat', dateFrom: '2017-07-01', sgst: 9, cgst: 9, igst: 18, applicableFor: 'BOTH' },
  { code: 'GSTR-12-GJ-IN', gstGroupCode: 'GST12-GOODS', fromState: 'Gujarat', locationStateCode: 'Gujarat', dateFrom: '2017-07-01', sgst: 6, cgst: 6, igst: 12, applicableFor: 'BOTH' },
  { code: 'GSTR-5-GJ-IN', gstGroupCode: 'GST5-GOODS', fromState: 'Gujarat', locationStateCode: 'Gujarat', dateFrom: '2017-07-01', sgst: 2.5, cgst: 2.5, igst: 5, applicableFor: 'BOTH' },
  { code: 'GSTR-28-GJ-IN', gstGroupCode: 'GST28-GOODS', fromState: 'Gujarat', locationStateCode: 'Gujarat', dateFrom: '2017-07-01', sgst: 14, cgst: 14, igst: 28, applicableFor: 'BOTH' },
  { code: 'GSTR-0-GJ-IN', gstGroupCode: 'GST0-GOODS', fromState: 'Gujarat', locationStateCode: 'Gujarat', dateFrom: '2017-07-01', sgst: 0, cgst: 0, igst: 0, applicableFor: 'BOTH' },
  { code: 'GSTR-18S-GJ-IN', gstGroupCode: 'GST18-SERVICE', fromState: 'Gujarat', locationStateCode: 'Gujarat', dateFrom: '2017-07-01', sgst: 9, cgst: 9, igst: 18, applicableFor: 'BOTH' },
  { code: 'GSTR-12S-GJ-IN', gstGroupCode: 'GST12-SERVICE', fromState: 'Gujarat', locationStateCode: 'Gujarat', dateFrom: '2017-07-01', sgst: 6, cgst: 6, igst: 12, applicableFor: 'BOTH' },
  { code: 'GSTR-5S-GJ-IN', gstGroupCode: 'GST5-SERVICE', fromState: 'Gujarat', locationStateCode: 'Gujarat', dateFrom: '2017-07-01', sgst: 2.5, cgst: 2.5, igst: 5, applicableFor: 'BOTH' },
  // Inter-state from Gujarat (IGST only)
  { code: 'GSTR-18-GJ-MH', gstGroupCode: 'GST18-GOODS', fromState: 'Gujarat', locationStateCode: 'Maharashtra', dateFrom: '2017-07-01', sgst: 0, cgst: 0, igst: 18, applicableFor: 'BOTH' },
  { code: 'GSTR-18-GJ-RJ', gstGroupCode: 'GST18-GOODS', fromState: 'Gujarat', locationStateCode: 'Rajasthan', dateFrom: '2017-07-01', sgst: 0, cgst: 0, igst: 18, applicableFor: 'BOTH' },
  { code: 'GSTR-12-GJ-MH', gstGroupCode: 'GST12-GOODS', fromState: 'Gujarat', locationStateCode: 'Maharashtra', dateFrom: '2017-07-01', sgst: 0, cgst: 0, igst: 12, applicableFor: 'BOTH' },
  { code: 'GSTR-18S-GJ-MH', gstGroupCode: 'GST18-SERVICE', fromState: 'Gujarat', locationStateCode: 'Maharashtra', dateFrom: '2017-07-01', sgst: 0, cgst: 0, igst: 18, applicableFor: 'BOTH' },
]

export const HSN_SEED_ROWS: HsnSeedRow[] = [
  { code: '871639', gstGroupCode: 'GST18-GOODS', description: 'Trailers and semi-trailers — tankers, bulkers, side-wall' },
  { code: '730890', gstGroupCode: 'GST18-GOODS', description: 'Structures and parts of structures — tank shells, chassis' },
  { code: '732690', gstGroupCode: 'GST18-GOODS', description: 'Other articles of iron or steel — brackets, fittings' },
  { code: '848180', gstGroupCode: 'GST18-GOODS', description: 'Taps, cocks, valves — discharge & pneumatic valves' },
  { code: '721070', gstGroupCode: 'GST12-GOODS', description: 'Flat-rolled MS plate — structural plate' },
  { code: '8708', gstGroupCode: 'GST18-GOODS', description: 'Parts for motor vehicles — axles, suspension, running gear' },
  { code: '3208', gstGroupCode: 'GST18-GOODS', description: 'Paints and varnishes — primer, topcoat' },
  { code: '8311', gstGroupCode: 'GST12-GOODS', description: 'Wire, rods, tubes — welding wire' },
  { code: '4016', gstGroupCode: 'GST18-GOODS', description: 'Articles of vulcanised rubber — seals, gaskets' },
]

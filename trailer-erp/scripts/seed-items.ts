/**
 * Seed trailer-manufacturing sample items via masters API.
 * Ensures UOMs + uses existing item categories. Idempotent by item code.
 * Usage: npx tsx scripts/seed-items.ts
 */
const BASE = process.env.VITE_API_BASE_URL ?? 'http://127.0.0.1:5000/api/v1'
const TENANT = process.env.VITE_TENANT_SLUG ?? 'vasant-trailers'
const EMAIL = process.env.SEED_EMAIL ?? 'admin@vasant-trailers.com'
const PASSWORD = process.env.SEED_PASSWORD ?? 'Admin@123'

type UomSeed = {
  code: string
  name: string
  description: string
  uomType: 'integer' | 'weight' | 'length' | 'volume'
  decimalPlaces: number
  isBaseUnit: boolean
}

type ItemSeed = {
  code: string
  name: string
  itemDescription: string
  categoryCode: string
  uomCode: string
  itemType: 'raw' | 'bought_out' | 'consumable' | 'sub_assembly' | 'finished_good'
  productType?: 'boi' | 'raw_material' | 'sub_assembly' | 'assembly_product' | 'finish_product' | 'scrap' | 'service'
  inventoryType?: 'inventory' | 'non_inventory' | 'service'
  materialGrade: string
  hsnCode: string
  reorderLevel: number
  reorderQty: number
  standardRate: number
  isPurchasable: boolean
  isStockable: boolean
  subAssemblyRule?: 'phantom' | 'manufactured' | 'purchased' | 'subcontracted' | null
}

const UOMS: UomSeed[] = [
  { code: 'NOS', name: 'Numbers', description: 'Numbers / each', uomType: 'integer', decimalPlaces: 0, isBaseUnit: true },
  { code: 'KG', name: 'Kilogram', description: 'Kilogram', uomType: 'weight', decimalPlaces: 3, isBaseUnit: true },
  { code: 'SET', name: 'Set', description: 'Set / kit', uomType: 'integer', decimalPlaces: 0, isBaseUnit: false },
  { code: 'LTR', name: 'Litre', description: 'Litre', uomType: 'volume', decimalPlaces: 2, isBaseUnit: true },
  { code: 'MTR', name: 'Metre', description: 'Metre', uomType: 'length', decimalPlaces: 3, isBaseUnit: true },
  { code: 'TON', name: 'Metric Ton', description: 'Metric ton', uomType: 'weight', decimalPlaces: 3, isBaseUnit: false },
  { code: 'PCS', name: 'Pieces', description: 'Pieces', uomType: 'integer', decimalPlaces: 0, isBaseUnit: false },
]

const ITEMS: ItemSeed[] = [
  {
    code: 'BO-AXL-ABS6620',
    name: 'Axle ABS-6620-1950',
    itemDescription: 'BPW ABS-6620-1950 tri-axle assembly with air suspension brackets',
    categoryCode: 'CAT-BO-RUN',
    uomCode: 'SET',
    itemType: 'bought_out',
    productType: 'boi',
    inventoryType: 'inventory',
    materialGrade: 'BPW ABS-6620-1950',
    hsnCode: '8708',
    reorderLevel: 2,
    reorderQty: 2,
    standardRate: 485000,
    isPurchasable: true,
    isStockable: true,
  },
  {
    code: 'BO-SUSP-14T',
    name: 'Air Suspension Lift Kit 14 Ton',
    itemDescription: 'BPW Air Ride 14T lift kit complete with bellows and brackets',
    categoryCode: 'CAT-BO-RUN',
    uomCode: 'SET',
    itemType: 'bought_out',
    productType: 'boi',
    inventoryType: 'inventory',
    materialGrade: 'BPW Air Ride 14T',
    hsnCode: '8708',
    reorderLevel: 2,
    reorderQty: 2,
    standardRate: 125000,
    isPurchasable: true,
    isStockable: true,
  },
  {
    code: 'BO-KPIN-2-JOST',
    name: 'King Pin 2" JOST',
    itemDescription: 'JOST king pin assembly 2 inch diameter, 42CrMo4',
    categoryCode: 'CAT-BO-RUN',
    uomCode: 'NOS',
    itemType: 'bought_out',
    productType: 'boi',
    inventoryType: 'inventory',
    materialGrade: '42CrMo4',
    hsnCode: '8708',
    reorderLevel: 5,
    reorderQty: 5,
    standardRate: 18500,
    isPurchasable: true,
    isStockable: true,
  },
  {
    code: 'BO-LJ-24T',
    name: 'Landing Jack 24T',
    itemDescription: 'JOST Modul L landing gear 24 tonne capacity',
    categoryCode: 'CAT-BO-RUN',
    uomCode: 'NOS',
    itemType: 'bought_out',
    productType: 'boi',
    inventoryType: 'inventory',
    materialGrade: 'JOST Modul L',
    hsnCode: '8708',
    reorderLevel: 4,
    reorderQty: 4,
    standardRate: 12800,
    isPurchasable: true,
    isStockable: true,
  },
  {
    code: 'BO-RIM-925',
    name: 'Wheel Rim 9.00×22.5',
    itemDescription: '22.5×9.00 JJ tubeless wheel rim',
    categoryCode: 'CAT-BO-WHEEL',
    uomCode: 'NOS',
    itemType: 'bought_out',
    productType: 'boi',
    inventoryType: 'inventory',
    materialGrade: '22.5×9.00 JJ',
    hsnCode: '8708',
    reorderLevel: 24,
    reorderQty: 12,
    standardRate: 8200,
    isPurchasable: true,
    isStockable: true,
  },
  {
    code: 'BO-TYRE-925',
    name: 'Tyre 295/80R22.5',
    itemDescription: 'Apollo EnduTrax radial tyre 295/80R22.5',
    categoryCode: 'CAT-BO-WHEEL',
    uomCode: 'NOS',
    itemType: 'bought_out',
    productType: 'boi',
    inventoryType: 'inventory',
    materialGrade: 'Apollo EnduTrax',
    hsnCode: '4011',
    reorderLevel: 24,
    reorderQty: 12,
    standardRate: 22500,
    isPurchasable: true,
    isStockable: true,
  },
  {
    code: 'BO-AIRTANK-40L',
    name: 'Air Tank 40 Litre',
    itemDescription: '40L air reservoir tank, 10 bar rated with drain cock',
    categoryCode: 'CAT-BO-PNEU',
    uomCode: 'NOS',
    itemType: 'bought_out',
    productType: 'boi',
    inventoryType: 'inventory',
    materialGrade: '10 Bar rated',
    hsnCode: '7311',
    reorderLevel: 6,
    reorderQty: 4,
    standardRate: 6500,
    isPurchasable: true,
    isStockable: true,
  },
  {
    code: 'BO-VALVE-3',
    name: 'Bottom Discharge Valve 3"',
    itemDescription: 'SS316 bottom discharge valve 3 inch',
    categoryCode: 'CAT-BO-PNEU',
    uomCode: 'NOS',
    itemType: 'bought_out',
    productType: 'boi',
    inventoryType: 'inventory',
    materialGrade: 'SS316',
    hsnCode: '8481',
    reorderLevel: 6,
    reorderQty: 4,
    standardRate: 28500,
    isPurchasable: true,
    isStockable: true,
  },
  {
    code: 'RM-MS-PLT-16',
    name: 'MS Plate 16mm',
    itemDescription: 'Mild steel plate 16mm thickness, IS 2062 E350',
    categoryCode: 'CAT-RM-PLATE',
    uomCode: 'KG',
    itemType: 'raw',
    productType: 'raw_material',
    inventoryType: 'inventory',
    materialGrade: 'IS 2062 E350',
    hsnCode: '7208',
    reorderLevel: 5000,
    reorderQty: 10000,
    standardRate: 68.5,
    isPurchasable: true,
    isStockable: true,
  },
  {
    code: 'RM-PIPE-150-CHS',
    name: 'Pipe 150mm CHS',
    itemDescription: 'Circular hollow section 150mm dia, IS 4923 YST 310',
    categoryCode: 'CAT-RM-STRUCT',
    uomCode: 'MTR',
    itemType: 'raw',
    productType: 'raw_material',
    inventoryType: 'inventory',
    materialGrade: 'IS 4923 YST 310',
    hsnCode: '7306',
    reorderLevel: 200,
    reorderQty: 500,
    standardRate: 1850,
    isPurchasable: true,
    isStockable: true,
  },
  {
    code: 'RM-ANGLE-75X75',
    name: 'Angle 75×75×8',
    itemDescription: 'MS equal angle 75×75×8mm, IS 2062 E250',
    categoryCode: 'CAT-RM-STRUCT',
    uomCode: 'MTR',
    itemType: 'raw',
    productType: 'raw_material',
    inventoryType: 'inventory',
    materialGrade: 'IS 2062 E250',
    hsnCode: '7216',
    reorderLevel: 300,
    reorderQty: 600,
    standardRate: 620,
    isPurchasable: true,
    isStockable: true,
  },
  {
    code: 'RM-PRIMER-RO',
    name: 'Primer Red Oxide',
    itemDescription: 'Asian Paints red oxide epoxy primer for trailer paint shop',
    categoryCode: 'CAT-RM-CONS',
    uomCode: 'LTR',
    itemType: 'consumable',
    productType: 'raw_material',
    inventoryType: 'inventory',
    materialGrade: 'Asian Paints EP-10 RO',
    hsnCode: '3208',
    reorderLevel: 200,
    reorderQty: 500,
    standardRate: 285,
    isPurchasable: true,
    isStockable: true,
  },
  {
    code: 'RM-THINNER-EP',
    name: 'Thinner Epoxy Grade',
    itemDescription: 'Epoxy grade paint thinner for primer and topcoat application',
    categoryCode: 'CAT-RM-CONS',
    uomCode: 'LTR',
    itemType: 'consumable',
    productType: 'raw_material',
    inventoryType: 'inventory',
    materialGrade: 'Asian Paints Thinner EP',
    hsnCode: '3814',
    reorderLevel: 50,
    reorderQty: 100,
    standardRate: 145,
    isPurchasable: true,
    isStockable: true,
  },
  {
    code: 'SA-RUN-GEAR',
    name: 'Running Gear Assembly',
    itemDescription: 'Fabricated running gear sub-assembly — axle, suspension, wheels',
    categoryCode: 'CAT-SA-RUN',
    uomCode: 'SET',
    itemType: 'sub_assembly',
    productType: 'sub_assembly',
    inventoryType: 'inventory',
    materialGrade: 'Fabricated',
    hsnCode: '8708',
    reorderLevel: 0,
    reorderQty: 0,
    standardRate: 0,
    isPurchasable: false,
    isStockable: true,
    subAssemblyRule: 'manufactured',
  },
  {
    code: 'SA-TANK-ASM',
    name: 'Tank Assembly',
    itemDescription: 'Tank shell and structural sub-assembly',
    categoryCode: 'CAT-SA-TANK',
    uomCode: 'SET',
    itemType: 'sub_assembly',
    productType: 'sub_assembly',
    inventoryType: 'inventory',
    materialGrade: 'MS IS 2062',
    hsnCode: '8716',
    reorderLevel: 0,
    reorderQty: 0,
    standardRate: 0,
    isPurchasable: false,
    isStockable: true,
    subAssemblyRule: 'manufactured',
  },
  {
    code: 'SA-CHASSIS',
    name: 'Chassis Assembly',
    itemDescription: 'Main chassis frame sub-assembly',
    categoryCode: 'CAT-SA-CHASSIS',
    uomCode: 'SET',
    itemType: 'sub_assembly',
    productType: 'sub_assembly',
    inventoryType: 'inventory',
    materialGrade: 'IS 4923 YST 310',
    hsnCode: '8716',
    reorderLevel: 0,
    reorderQty: 0,
    standardRate: 0,
    isPurchasable: false,
    isStockable: true,
    subAssemblyRule: 'manufactured',
  },
  {
    code: 'SA-PAINT-SYS',
    name: 'Paint System',
    itemDescription: 'Primer and paint application sub-assembly',
    categoryCode: 'CAT-SA',
    uomCode: 'SET',
    itemType: 'sub_assembly',
    productType: 'sub_assembly',
    inventoryType: 'inventory',
    materialGrade: 'Epoxy + PU',
    hsnCode: '8716',
    reorderLevel: 0,
    reorderQty: 0,
    standardRate: 0,
    isPurchasable: false,
    isStockable: true,
    subAssemblyRule: 'subcontracted',
  },
  {
    code: 'FG-BULKER-45M3',
    name: '45 M3 Bulker Trailer',
    itemDescription: 'Finished good — 45 m³ cement bulker trailer, ready for dispatch',
    categoryCode: 'CAT-FG-BULKER',
    uomCode: 'NOS',
    itemType: 'finished_good',
    productType: 'finish_product',
    inventoryType: 'inventory',
    materialGrade: 'FG Assembly',
    hsnCode: '8716',
    reorderLevel: 0,
    reorderQty: 0,
    standardRate: 2850000,
    isPurchasable: false,
    isStockable: true,
  },
  {
    code: 'FG-ISO-TANK-26K',
    name: '26 KL ISO Tank',
    itemDescription: 'Finished good — 26 KL ISO tank container, ready for dispatch',
    categoryCode: 'CAT-FG-ISO',
    uomCode: 'NOS',
    itemType: 'finished_good',
    productType: 'finish_product',
    inventoryType: 'inventory',
    materialGrade: 'FG Assembly',
    hsnCode: '8716',
    reorderLevel: 0,
    reorderQty: 0,
    standardRate: 4200000,
    isPurchasable: false,
    isStockable: true,
  },
  {
    code: 'FG-SIDEWALL-32FT',
    name: '32 FT Side Wall Trailer',
    itemDescription: 'Finished good — 32 ft side wall trailer, 32 MT payload',
    categoryCode: 'CAT-FG-TRAILER',
    uomCode: 'NOS',
    itemType: 'finished_good',
    productType: 'finish_product',
    inventoryType: 'inventory',
    materialGrade: 'FG Assembly',
    hsnCode: '8716',
    reorderLevel: 0,
    reorderQty: 0,
    standardRate: 1950000,
    isPurchasable: false,
    isStockable: true,
  },
]

type Listed = { id: string; code: string }

function asList(data: unknown): Listed[] {
  if (Array.isArray(data)) return data as Listed[]
  if (data && typeof data === 'object' && Array.isArray((data as { items?: Listed[] }).items)) {
    return (data as { items: Listed[] }).items
  }
  return []
}

async function login(): Promise<string> {
  const res = await fetch(`${BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: EMAIL, password: PASSWORD, tenantSlug: TENANT }),
  })
  const json = (await res.json()) as { data?: { accessToken?: string }; message?: string }
  const token = json.data?.accessToken
  if (!token) throw new Error(`Login failed: ${json.message ?? res.status}`)
  return token
}

async function listAll(
  headers: Record<string, string>,
  path: string,
): Promise<Listed[]> {
  const all: Listed[] = []
  let page = 1
  for (;;) {
    const res = await fetch(`${BASE}/t/${TENANT}${path}?page=${page}&limit=100`, { headers })
    const json = (await res.json()) as { data?: unknown; meta?: { totalPages?: number } }
    all.push(...asList(json.data))
    const totalPages = json.meta?.totalPages ?? 1
    if (page >= totalPages) break
    page += 1
  }
  return all
}

function uomKey(code: string) {
  return code.trim().toUpperCase()
}

async function main() {
  const token = await login()
  const headers = {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  }

  // --- UOMs ---
  const existingUoms = await listAll(headers, '/masters/uom')
  const uomIdByCode = new Map(existingUoms.map((u) => [uomKey(u.code), u.id]))
  // Prisma seed may have created "Nos" — treat as NOS
  if (!uomIdByCode.has('NOS')) {
    const nosLike = existingUoms.find((u) => uomKey(u.code) === 'NOS' || u.code === 'Nos')
    if (nosLike) uomIdByCode.set('NOS', nosLike.id)
  }

  let uomCreated = 0
  for (const uom of UOMS) {
    if (uomIdByCode.has(uomKey(uom.code))) continue
    const res = await fetch(`${BASE}/t/${TENANT}/masters/uom`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        code: uom.code,
        name: uom.name,
        description: uom.description,
        uomType: uom.uomType,
        decimalPlaces: uom.decimalPlaces,
        isBaseUnit: uom.isBaseUnit,
        status: 'ACTIVE',
      }),
    })
    if (!res.ok) {
      console.error(`  ✗ UOM ${uom.code}: ${res.status} ${await res.text()}`)
      continue
    }
    const body = (await res.json()) as { data?: { id?: string } }
    if (body.data?.id) uomIdByCode.set(uomKey(uom.code), body.data.id)
    uomCreated++
    console.log(`  ✓ UOM ${uom.code}`)
  }

  // --- Categories ---
  const cats = await listAll(headers, '/masters/item-categories')
  const catIdByCode = new Map(cats.map((c) => [c.code, c.id]))
  const missingCats = [...new Set(ITEMS.map((i) => i.categoryCode))].filter((c) => !catIdByCode.has(c))
  if (missingCats.length) {
    throw new Error(
      `Missing item categories: ${missingCats.join(', ')}. Run scripts/seed-item-categories.ts first.`,
    )
  }

  // --- Items ---
  const existingItems = await listAll(headers, '/masters/items')
  const itemCodes = new Set(existingItems.map((i) => i.code))

  let created = 0
  let skipped = 0
  let failed = 0

  for (const item of ITEMS) {
    if (itemCodes.has(item.code)) {
      skipped++
      continue
    }
    const categoryId = catIdByCode.get(item.categoryCode)
    const baseUomId = uomIdByCode.get(uomKey(item.uomCode))
    if (!categoryId || !baseUomId) {
      failed++
      console.error(
        `  ✗ ${item.code}: missing ${[!categoryId && `category ${item.categoryCode}`, !baseUomId && `uom ${item.uomCode}`].filter(Boolean).join(', ')}`,
      )
      continue
    }
    const res = await fetch(`${BASE}/t/${TENANT}/masters/items`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        code: item.code,
        name: item.name,
        itemDescription: item.itemDescription,
        categoryId,
        baseUomId,
        itemType: item.itemType,
        productType: item.productType,
        inventoryType: item.inventoryType ?? 'inventory',
        materialGrade: item.materialGrade,
        hsnCode: item.hsnCode,
        reorderLevel: item.reorderLevel,
        reorderQty: item.reorderQty,
        standardRate: item.standardRate,
        isPurchasable: item.isPurchasable,
        isStockable: item.isStockable,
        isBlocked: false,
        quantityPerUom: 1,
        purchaseQtyPerUom: 1,
        qcRequired: false,
        subAssemblyRule: item.subAssemblyRule ?? null,
        status: 'ACTIVE',
      }),
    })
    if (!res.ok) {
      failed++
      console.error(`  ✗ ${item.code}: ${res.status} ${await res.text()}`)
      continue
    }
    created++
    console.log(`  ✓ ${item.code} — ${item.name}`)
  }

  console.log(
    `\nDone. UOMs created: ${uomCreated}. Items created: ${created}, already present: ${skipped}, failed: ${failed}`,
  )
  if (failed > 0) process.exitCode = 1
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})

const API_BASE = 'https://stageapi.dhurandharcrm.com'
const TENANT_SLUG = 'vasant-trailers'

async function call(method: string, path: string, token: string | null, body?: unknown) {
  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })
  const json = await res.json().catch(() => null)
  return { status: res.status, body: json }
}

async function main() {
  const login = await call('POST', '/api/v1/auth/login', null, {
    email: 'admin@vasant-trailers.com',
    password: 'Admin@123',
    tenantSlug: TENANT_SLUG,
  })
  if (login.status !== 200) throw new Error(`login failed: ${JSON.stringify(login.body)}`)
  const token = login.body.data.accessToken as string

  const uomRes = await call('GET', `/api/v1/t/${TENANT_SLUG}/masters/uom?limit=100`, token)
  const uoms = (uomRes.body?.data ?? []) as Array<{ id: string; code: string }>
  const uomIdByCode = new Map(uoms.map((u) => [u.code.toUpperCase(), u.id]))
  console.log('UOMs available:', uoms.map((u) => u.code).join(', '))

  const catRes = await call('GET', `/api/v1/t/${TENANT_SLUG}/masters/item-categories?limit=100`, token)
  const cats = (catRes.body?.data ?? []) as Array<{ id: string; code: string; name: string }>
  console.log('Categories available:', cats.map((c) => `${c.code}(${c.name})`).join(', '))
  const rawMaterialCat = cats.find((c) => /raw/i.test(c.name) || /raw/i.test(c.code)) ?? cats[0]
  if (!rawMaterialCat) throw new Error('No item category found on stage — cannot create items')
  console.log('Using category:', rawMaterialCat.code, rawMaterialCat.name)

  const nosId = uomIdByCode.get('NOS')
  const kgId = uomIdByCode.get('KG')
  const mtrId = uomIdByCode.get('MTR')
  if (!nosId || !kgId || !mtrId) throw new Error(`Missing base UOMs — NOS=${nosId} KG=${kgId} MTR=${mtrId}`)

  const stamp = Date.now().toString().slice(-6)
  const NEW_MUOM_ITEMS = [
    { code: `TEST-MUOM-KG-A-${stamp}`, name: 'Test MUOM Item — Steel Casting by Weight (KG/Nos)', baseUomId: nosId, purchaseUomId: kgId, factor: 25 },
    { code: `TEST-MUOM-KG-B-${stamp}`, name: 'Test MUOM Item — Forged Component by Weight (KG/Nos)', baseUomId: nosId, purchaseUomId: kgId, factor: 50 },
    { code: `TEST-MUOM-KG-C-${stamp}`, name: 'Test MUOM Item — Electrode by Weight (KG/Nos)', baseUomId: nosId, purchaseUomId: kgId, factor: 5 },
    { code: `TEST-MUOM-KG-D-${stamp}`, name: 'Test MUOM Item — Fastener by Weight, fractional factor (KG/Nos)', baseUomId: nosId, purchaseUomId: kgId, factor: 2.5 },
    { code: `TEST-MUOM-MTR-A-${stamp}`, name: 'Test MUOM Item — Rod by Length (MTR/Nos)', baseUomId: nosId, purchaseUomId: mtrId, factor: 6 },
    { code: `TEST-MUOM-MTR-B-${stamp}`, name: 'Test MUOM Item — Tube by Length (MTR/Nos)', baseUomId: nosId, purchaseUomId: mtrId, factor: 3 },
  ]

  const created: Array<{ code: string; id: string }> = []
  for (const spec of NEW_MUOM_ITEMS) {
    const res = await call('POST', `/api/v1/t/${TENANT_SLUG}/masters/items`, token, {
      code: spec.code,
      name: spec.name,
      itemDescription: 'Created for live Multi-UOM lifecycle E2E test (safe to deactivate/delete after review).',
      categoryId: rawMaterialCat.id,
      baseUomId: spec.baseUomId,
      itemType: 'raw',
      purchaseUomId: spec.purchaseUomId,
      uomConversionFactor: spec.factor,
      isPurchasable: true,
      isStockable: true,
      status: 'ACTIVE',
    })
    if (res.status !== 201) {
      console.error(`FAILED to create ${spec.code}: ${res.status} ${JSON.stringify(res.body)}`)
      continue
    }
    console.log(`Created ${spec.code} -> id=${res.body.data.id} factor=${spec.factor}`)
    created.push({ code: spec.code, id: res.body.data.id })
  }

  console.log('\n--- Summary ---')
  console.log(JSON.stringify(created, null, 2))
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})

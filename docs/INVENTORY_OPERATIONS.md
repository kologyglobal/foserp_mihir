# Inventory Operations

Guidance for store-facing inventory work in FOS ERP.

## Truth model

```text
                    ┌─────────────────────┐
                    │  Inventory Ledger   │  ← audit source of truth
                    └──────────┬──────────┘
                               │ projects
                    ┌──────────▼──────────┐
                    │ Inventory Balance   │  ← operational one row / item×WH
                    └─────────────────────┘

Documents (immutable): GRN · Issue · Transfer · Count · Adjustment · Reservation
```

Never create alternate “consolidated GRN” stock rows. Use **Receipt Summary** / **Item 360 Receipts** for rolled-up qty; expand for each GRN.

## Daily operations (2–3 taps)

| Job | Path |
|-----|------|
| See what needs work | `/inventory` |
| Receive (choose type) | `/inventory/store/receive` → GRN / FG / transfer in / opening |
| Issue (choose type) | `/inventory/store/issue` → production / maintenance / sales / general |
| Move stock | `/inventory/store/transfer` |
| Put away after GRN | `/inventory/store/put-away` → GRN then transfer/scan |
| Pick | `/inventory/store/picking` |
| Count | `/inventory/store/count` |
| Barcode | `/inventory/store/scan` |
| Release reservation | `/inventory/store/reservations` |

All **posts** call existing inventory, purchase, manufacturing, and maintenance APIs.

## Backend workbench (already exists)

`/api/v1/t/:tenantSlug/inventory/store-workbench`

- `GET /summary`  
- `GET /needs-action`  
- domain queues + manufacturing aliases  

FE: `inventoryStoreWorkbenchApi.ts` + `storeOperationsService.ts`.

## Out of scope here

MRP, warehouse CAD design, costing engine rewrites, valuation GL, report builders — see those modules.

## Tests / UAT checklist

- [ ] GRN post → balance increases  
- [ ] Put-away transfer Receiving → bin  
- [ ] Issue to WO / general issue  
- [ ] Transfer IN_TRANSIT → received  
- [ ] Reservation create + release  
- [ ] Stock count variance post  
- [ ] Barcode scan landing  
- [ ] Batch / serial tracked moves  
- [ ] Cost layers unchanged after store UI only actions  
- [ ] Timeline lists ledger rows  
- [ ] Consolidated stock one row / item×WH  

## Related docs

- `STORE_OPERATIONS.md`  
- `ITEM_360.md`  
- Inventory costing / finance docs under `docs/`  

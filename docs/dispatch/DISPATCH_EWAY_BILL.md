# Dispatch e-Way Bill (statutory GST)

## Rule (FOS)

```text
Sales Order → Dispatch → Delivery Challan / Tax Invoice
→ Transport details
→ Generate e-Way Bill (NIC adapter API)
→ Receive EWB number + validity
→ Vehicle departs
```

**Do not** treat e-Way Bill number as a normal editable form field.

It is an **API-driven statutory integration** with:

- authentication / provider mode (`GST_NIC_PROVIDER`, default `SIMULATED`)
- request + government response logging (`lastRequestJson` / `lastResponseJson`)
- idempotent generate (duplicate prevention per SI / DC)
- cancel + update-vehicle via adapter
- audit log on generate / cancel / vehicle update
- exact adapter/government error handling (`EXCEPTION` status + message)

Live NIC must follow **current official GST / NIC specifications** (auth, encryption, error codes). This build ships **SIMULATED** only; `GST_NIC_PROVIDER=LIVE` is not configured until a certified adapter is wired.

## Threshold

General FAQ threshold used for **Required** evaluation: **₹50,000** consignment value  
(`GST_EWAY_THRESHOLD_INR`, default `50000`) — subject to governing rules and exceptions at the portal.

Dispatch panel shows:

- **e-Way Bill Required:** Yes / No  
- **Reason:** e.g. *Taxable consignment exceeds applicable threshold*

## Actions (Dispatch / Delivery Challan)

| Action | API |
|--------|-----|
| Generate e-Way Bill | `POST …/tax-compliance/e-way-bills/generate` |
| Cancel e-Way Bill | `POST …/e-way-bills/:id/cancel` |
| Update Vehicle Number | `POST …/e-way-bills/:id/update-vehicle` |
| View / Print | Panel + Tax Compliance register |

Panel: `GET …/e-way-bills/panel?deliveryChallanId=…`

## Stored fields (`GstEWayBill`)

EWB number, generatedAt, validUpto, vehicle, transporter name/ID, providerRef, last request/response JSON, cancel reason, status, requiredReason, movementReason, outboundDispatchId.

Delivery Challan `eWayBillReference` is a **system snapshot** written only on successful generate — never user-edited.

## Ownership

| Layer | Role |
|-------|------|
| Dispatch UI | Transport inputs + e-Way **panel** (no free-text EWB) |
| Tax compliance module | Register + NIC adapter + audit |
| Frontend Tax register | `/accounting/tax-compliance/gst/e-way-bills` |

## Key files

- `nic-gst.adapter.ts` — SIMULATED / future LIVE
- `eway-bill.service.ts` — generate / cancel / vehicle / panel
- `DispatchEWayBillPanel.tsx` — Dispatch workspace UI
- Migration `20260723103000_eway_bill_statutory_fields`

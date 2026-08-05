# Phase 7 — e-Way Bill

**Date:** 2026-08-05  
**Status:** **READY WITH CONDITIONS**  
**Exit label candidacy:** **E-WAY REGISTER READY (SIMULATED)**  
**Does not claim:** LIVE e-Way portal · multi-state exceptional rules complete · FULL GST COMPLIANT

---

## Scope (from plan)

- Part A (document/route) / Part B (transporter/vehicle)
- Transporter + vehicle update + cancel + **validity extension** (where supported)
- Reuse SI / delivery challan / dispatch panel
- Same provider mode pattern as Phase 6 e-Invoice

---

## Shipped

### Provider
- Shared NIC adapter + `GST_EINVOICE_PROVIDER_MODE` / `GST_NIC_PROVIDER` (SIMULATED default; LIVE gated)
- Simulated: `generateEwb`, `cancelEwb`, `updateEwbVehicle`, **`extendEwb`**
- LIVE refuses until UAT + connector flags (same as Phase 6)

### Pure util
- `eway-readiness.util.ts` — threshold, Part A/B, source readiness, generate plan, extension plan

### Service
- Sources: **POSTED SalesInvoice**, **ISSUED DeliveryChallan** (+ outbound dispatch panel soft-link)
- Generate/idempotent; EXCEPTION retry; cancelled blocked
- Part A hard checks; Part B soft by default (`allowIncompletePartB=true`) or hard
- Vehicle update stamps dispatch challan vehicle when linked
- Extend validity (`extensionCount`, adapter)
- Audit: GENERATE / GENERATE_EXCEPTION / CANCEL / UPDATE_VEHICLE / EXTEND

### Schema
- Migration `20260805190000_gst_phase7_eway_harden`  
  `transportMode`, `idempotencyKey`, `attemptCount`, `lastAttemptAt`, `extensionCount`, `vehicleUpdatedAt`

### API (prefix `…/tax-compliance`)

| Method | Path |
|--------|------|
| GET | `/e-way-bills` (+ providerMode) |
| GET | `/e-way-bills/provider-status` |
| GET | `/e-way-bills/panel` |
| POST | `/e-way-bills/generate` |
| GET | `/e-way-bills/:id` |
| POST | `/e-way-bills/:id/cancel` |
| POST | `/e-way-bills/:id/update-vehicle` |
| POST | `/e-way-bills/:id/extend` **new** |

Permissions: `finance.tax.view` / `finance.tax.eway.manage`

### FE
- E-Way register: Mode + vehicle columns; honest SIMULATED/LIVE copy

### Tests
- `backend/tests/gst-eway-phase7.test.ts`

---

## READY WITH CONDITIONS

1. Keep **SIMULATED** until certified e-Way portal UAT  
2. Threshold default ₹50k via `GST_EWAY_THRESHOLD_INR` (FAQ general; exceptions not exhaustive)  
3. Extension is product SIMULATED rules (1–24h, not after expiry) — not a claim of full NIC extend API parity  
4. Part B incomplete allowed by default (warnings on soft path)  
5. EWB number never free-text editable  

---

## Still NOT ready

- LIVE portal e-Way  
- Full Part A multi-HSN item payload certification JSON  
- ALL-state pin-to-distance service  
- Phase 8 liability payment  

**Stop for product review before Phase 8.**

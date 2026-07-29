# Maintenance V1 — Workflow

## Revised client flow

1. **Start Maintenance** (dashboard / tickets /new) — Machine + Problem + Operator Name + optional photos (max 4) + GPS/plant location  
   → Ticket `REPORTED`, Machine `OUT_OF_SERVICE`
2. **Upload Photos** — up to four photographs (also allowed during repair)
3. **Start Maintenance / Assign** — Internal User/Technician **or** External Contractor/Vendor + Operator Name  
   → `IN_REPAIR`, Machine `UNDER_MAINTENANCE`
4. **Parts Changed** — Item Name, Qty, Remarks (+ optional cost)
5. **Service Performed** — service description + invoice number/date + service amount
6. **Close Ticket** — blocked until photos, technician/contractor, parts/service details, invoice number, and amount are present  
   → `CLOSED`, Machine `AVAILABLE` (if no other open ticket)

Optional: **Test Machine** (PASS/FAIL) remains available but is not required for close.

## Exceptions

- **WAITING_FOR_PART** / **ON_HOLD** — machine remains unavailable; Resume returns to `IN_REPAIR` or `REPORTED`
- One open ticket per machine (policy)
- Max **4** photos per ticket

## Operator UX

**Start Maintenance → Photos → Assign → Parts & Service → Invoice & Amount → Close**

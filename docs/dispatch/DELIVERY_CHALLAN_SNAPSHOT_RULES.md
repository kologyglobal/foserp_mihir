# Delivery Challan Snapshot Rules

## Purpose

An **issued** Challan must remain unchanged when masters change later.

## Snapshots at issue

### Customer / ship-to / bill-to

- Customer legal/display name, code, GSTIN (if present)
- Billing and ship-to address lines, city, state, postal, country
- Contact person/phone when available
- Customer reference when available

Draft may refresh from current masters via `refresh-from-packing` / regenerate snapshot. Issued never refreshes masters.

### Legal entity / branch

- Legal-entity / tenant display name and registered address from configuration
- Branch name/address where available
- GSTIN / state when configured
- Never hardcode company details in the PDF/HTML component

### Item lines

- Item code, name, description, HSN/SAC (if present), UOM code
- Packed and challan quantities frozen on the line

### Packages / tracking

- Package number, type, weights, seal, dimensions snapshots on links
- Soft lot / serial / heat snapshots on tracking allocations

## Rules

- Missing optional fields stay blank — do not fabricate.
- Cross-tenant customer/address IDs are rejected.
- Snapshot is not a replacement customer or item master.

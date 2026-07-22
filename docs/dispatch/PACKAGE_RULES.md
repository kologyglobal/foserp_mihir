# Package Rules (Phase 7C3)

## Model

`DispatchPackage` belongs to one Packing Session and one Outbound Dispatch.

Statuses: `OPEN` → `PARTIALLY_FILLED` → `COMPLETE` → `VERIFIED` (or `REOPENED` / `CANCELLED`).

## Numbering

Code series `DISPATCH_PACKAGE` (`PKG`). May also use session sequence. Never use table row count.

## Package types

Minimal `DispatchPackageType` master (Box, Crate, Pallet, Bundle, Drum, Bag, Loose, Custom, …). Not a warehouse-container WMS.

## Contents

- Multiple Sales Order lines only when same customer, ship-to, Dispatch, and policy allows mixed items
- Never combine different Dispatch Orders
- Soft `lotRef` / `serialRef` / `heatNumber` on package lines
- Weight: gross ≥ net; when tare entered, gross = net + tare
- Dimensions: positive values; locked after verification
- Optional seal / external marking / remarks

## Actions

Create, edit metadata, pack, unpack, move lines, complete, verify, reopen (permission + reason), cancel.

Verified packages are read-only until reopen. Reopen blocked if a future Delivery Challan / posted Dispatch dependency exists (placeholder for 7C4+).

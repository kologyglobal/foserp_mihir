# SOP — Material Issue & Return

**Audience:** Stores / Materials  
**Route:** API Work Order **detail → Materials** (not inventory SPA registers)  
**Permissions:** `manufacturing.materials.*`

## Purpose

Issue components to a released WO against real `InventoryStockBalance`; return unused material.

## Preconditions

- WO released.  
- Opening stock / receipts loaded via API or approved script (MC-02).  
- Correct issue warehouse mapped for plant.

## Issue

1. Open WO detail → **Materials**.  
2. Select lines / qty to issue (within available / reserved rules the API enforces).  
3. Confirm warehouse; post issue.  
4. Record movement / document number on stores log.

## Return

1. Same Materials area → return unused qty to return warehouse.  
2. Confirm balances; log document number.

## Expected

- Stock on hand decreases/increases via inventory movement API.  
- WO material issued qty updates.

## Do not

- Trust `/inventory/*` SPA demo registers as source of truth.  
- Issue from Store workbench (not available).  
- Backflush “by feel” outside system if consumption method requires explicit issue for pilot products.

# Phase 7C4 ↔ Phase 7C0 Compatibility

## Goal

Preserve Basic Outbound Confirm (`OutboundDispatch` DRAFT → CONFIRMED + FG_DISPATCH) without bypassing issued Challan quantity when the 7C4 workflow has started.

## Gate (`assertChallanAllowsConfirm`)

When **any** non-cancelled Delivery Challan exists for the Dispatch:

1. Packing must already pass `assertPackingAllowsConfirm`
2. Exactly one **active ISSUED** Challan must exist
3. Issued challan quantity must equal the Dispatch confirm quantity (pilot)
4. Challan must not be SUPERSEDED/CANCELLED as the active document
5. Confirm remains idempotent for stock-out / fulfilment (single post)

When **no** challan rows exist:

- Legacy / basic Dispatch path may still confirm after packing gates (7C0/7C3 compatibility)

## Forbidden

- Basic Confirm while Challan is Draft/Ready/Approved only (when challan workflow started)
- Confirm that posts stock without issued reconciled Challan when policy requires it
- Using challan issue itself as stock-out

## Phase 7C5

Hardened posting will replace thin 7C0 confirm for workbench Dispatches; this gate remains the bridge until then.

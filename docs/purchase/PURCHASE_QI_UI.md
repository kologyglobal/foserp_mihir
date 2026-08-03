# Purchase QI UI

Route: `/purchase/quality-inspections`

## Status

Dual-mode (API + demo). Backend lifecycle complete (`purchase.qi.*`).

## Capabilities

- Register + create from GRN (`?grnId=`)
- Detail: accept / reject / hold / complete
- GRN command bar + Receiving chain panel links to QI

## Gaps (documented)

- Test parameter checklist not persisted in API mode (use remarks / attachments until Quality test-group wiring is finished)
- Register chrome below PO gold path (no saved views yet)
- NCR deep-link optional

## Permissions

`purchase.qi.view` · `purchase.qi.create` · `purchase.qi.edit` · `purchase.qi.complete` · `purchase.qi.cancel`

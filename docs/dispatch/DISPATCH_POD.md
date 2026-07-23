# Proof of Delivery (POD)

## Rule (FOS)

```text
Post Dispatch (FG stock issued)
→ Goods in Transit
→ Capture POD
→ Mark Delivered / Partial / Exception / Rejected / Return
→ Close fulfilment (logistics)
```

**POD must not silently modify stock.** Inventory already moved on posted Dispatch (`FG_DISPATCH`).

POD updates:

- delivery status (`deliveryStatus` on outbound + POD register)
- customer logistics fulfilment (receiver, quantities, remarks, evidence)
- invoice readiness **only when** policy `requirePodBeforeInvoice` / env `REQUIRE_POD_BEFORE_INVOICE=true`
- delivery exceptions / return readiness flags (status)

## Statuses

| Status | Meaning |
|--------|---------|
| `IN_TRANSIT` | Posted dispatch; goods en route (auto-created on post) |
| `DELIVERED` | Full accepted qty |
| `PARTIALLY_DELIVERED` | Some short/damaged/accepted |
| `DELIVERY_EXCEPTION` | Exception / damage / short with little or no accept |
| `REJECTED_BY_CUSTOMER` | Customer rejection |
| `RETURN_INITIATED` | Return workflow readiness |

Stock status on outbound remains `CONFIRMED` / `REVERSED` / `CANCELLED` — separate from POD.

## Fields

Dispatch no, Delivery Challan (when issued), Sales Order, customer, delivery address, delivered date/time, receiver name/contact, signature/attachments, qty delivered / damaged / short, delivery & transporter remarks, GPS, status.

## APIs

| Method | Path |
|--------|------|
| GET | `/dispatch/outbound/:id/pod` |
| POST | `/dispatch/outbound/:id/pod/in-transit` |
| POST | `/dispatch/outbound/:id/pod/capture` |
| POST | `/dispatch/outbound/:id/pod/exception` |
| POST | `/dispatch/outbound/:id/pod/attachments` |

Permissions: `dispatch.pod.view`, `dispatch.pod.record` (or `dispatch.view` / `dispatch.post`).

## Policy

- Default: invoice/auto-SI does **not** wait for POD.
- Set `REQUIRE_POD_BEFORE_INVOICE=true` to require POD `DELIVERED` or `PARTIALLY_DELIVERED` before auto draft SI.

## Key files

- `dispatch-pod.service.ts` — capture / in-transit / attachments (no inventory calls)
- `dispatch-posting.service.ts` — `ensurePodInTransitAfterPost` after FG issue
- `DispatchPodPanel.tsx` — outbound detail UI
- Migration `20260723110000_dispatch_proof_of_delivery`

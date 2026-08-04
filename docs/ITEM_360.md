# Item Stock 360

**Route:** `/inventory/stock/:itemId`  
**Role:** Primary inventory page for store users.

## Layout

1. **Hero metrics** — On hand, Available, Reserved, Incoming, Outgoing (issues total), Avg cost, Last purchase, Last issue  
2. **Quick actions** — Issue / Receive / Transfer / Scan / Ledger  
3. **Tabs (mobile horizontal scroll)**  

| Tab | Content |
|-----|---------|
| Overview | WH chips + balance cards |
| Warehouse | Full WH stock metrics |
| Bin | GRN/document bin destinations (not a balance SoT) |
| Batch | Lot/batch slices |
| Serial | Serial masters + document serials (unmerged; not a balance table) |
| Reservations | Active demand reserves + link to release UI |
| Receipts | Receipt summary KPIs + **each GRN separate** |
| Issues | Issue history cards |
| Transfers | Transfer history cards |
| Timeline | Chronological ops events |
| Cost | Operational avg cost + links to costing engine |

## Source of data

`getItemStock360` / `operationalViewsService` composition of balances, GRNs, POs, reservations, transfers, and ledger-derived history. **No document merge.**

## Drill path

Item → Warehouse chip → Receipts tab → Open GRN → immutable audit document.

## Related

- Consolidated balance register: `/inventory/stock`  
- Ops search: `/inventory/ops/search`  
- Full ledger: `/inventory/items/:id/ledger` or `/inventory/ledger`

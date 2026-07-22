# SOP — Work Order Release

**Audience:** Production Planner / Supervisor  
**Route:** `/manufacturing/work-orders` (API pages only)  
**Permissions:** `manufacturing.work_orders.*` (create / release as configured)

## Purpose

Create and release a Work Order for a pilot product so shop floor and stores can execute.

## Preconditions

- `VITE_USE_API=true`; correct tenant slug.  
- Product has active **Manufacturing Profile**, **BOM version**, **Routing version**.  
- Opening stock exists for required components (stores confirmed).  
- Optional: demand from SO convert already visible.

## Steps

1. Open **Work Orders** list → **Create**.  
2. Select product / profile / qty / plant / dates. Prefer pilot products only (`PILOT-FG-*`).  
3. Save draft; review BOM / routing snapshot on detail.  
4. Assign stages/ops or use defaults from routing.  
5. **Release** when ready (explicit lifecycle action — not a generic PATCH).  
6. Record WO number in daily plan sheet.

## Expected

- Status = Released / Running-equivalent per API.  
- Visible on Today / Control Room.  
- Materials tab available for issue.

## Do not

- Use demo WO edit form if it does not hydrate from API.  
- Create WO for non-pilot products during pilot window.  
- Expect MRP or automatic purchase creation.

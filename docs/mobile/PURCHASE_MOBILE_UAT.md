# Purchase Mobile UAT (Phase A + B)

## Preconditions

- Tenant with `purchase` module enabled  
- User with combinations of: `purchase.pr.view`, `purchase.pr.submit`, `purchase.po.view`, `purchase.grn.view`, `purchase.grn.create`, `purchase.grn.post`, `purchase.qi.view`, approval perms  
- At least one PO in `SENT_TO_VENDOR` or `PARTIALLY_RECEIVED` with open line qty  
- Optional: draft PR, pending QI after GRN  
- Backend reachable via `EXPO_PUBLIC_API_BASE_URL`

## Checklist

### PR list / detail (Phase B)

- [ ] Opens only with `purchase.pr.view`  
- [ ] Filters Draft / Pending / Approved / Closed  
- [ ] Draft submit visible only with `purchase.pr.submit`  
- [ ] No full PR editor — view only besides submit  

### PO list

- [ ] Opens only with `purchase.po.view`  
- [ ] Search PO number / vendor  
- [ ] Filters: Open / Pending receipt / Partial / Closed  
- [ ] Skeleton, empty, error + retry  
- [ ] Pull to refresh  

### PO detail (Phase B receipt progress)

- [ ] Lines show ordered / received / pending  
- [ ] Receipt progress bar / % matches line totals  
- [ ] **Receive goods** only when receivable + `purchase.grn.create`  
- [ ] Linked GRNs open detail when present  

### GRN receive

- [ ] Scan / type PO number  
- [ ] Open qty preferred from receivable-lines (fallback PO lines)  
- [ ] Line qty defaults to **0** (not full pending)  
- [ ] Zero-only submit blocked  
- [ ] Save draft creates GRN DRAFT  
- [ ] Save & submit creates + submit when allowed  
- [ ] Camera + keyboard wedge on ScanField  

### GRN detail

- [ ] Submit draft when `canSubmit`  
- [ ] Post inventory with confirmation when permitted  
- [ ] Posted shows immutable message  
- [ ] QC status visible; open QI when inspection id + quality module  

### Purchase QC handoff (Phase B)

- [ ] List with `purchase.qi.view`  
- [ ] Filters / search  
- [ ] **No** PASS/REJECT on this screen  
- [ ] Tap opens Quality inspection when quality module enabled  

### Approvals

- [ ] Deep link to PR / PO / GRN when view permitted  
- [ ] Safe banner when can act but cannot view  

### Work tab

- [ ] Approval, draft PR, receive, draft GRN, pending QI tasks by perm  
- [ ] Deep links land on correct screens  
- [ ] Failures do not blank other Work routes  

### Regression

- [ ] CRM leads / quotations still load  
- [ ] Store / quality act flows unchanged  

## Result template

```text
Tester:
Date:
Environment:
Pass / Fail:
Notes:
```

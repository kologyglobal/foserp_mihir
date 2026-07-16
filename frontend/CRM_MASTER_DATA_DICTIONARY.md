# CRM Master Data Dictionary

**Entity model:** `CrmMasterEntry`  
**Storage:** Zustand persist key `vasant-crm-masters`

---

## Core Entity: CrmMasterEntry

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | string | Yes | UUID-style unique ID |
| `kind` | CrmMasterKind | Yes | Register type slug |
| `code` | string | Yes | Unique business key per kind |
| `name` | string | Yes | Display label |
| `status` | `active` \| `inactive` | Yes | Lifecycle |
| `sortOrder` | number | Yes | Display sequence |
| `description` | string | No | Long description |
| `notes` | string | No | Admin notes |
| `attributes` | Record | No | Kind-specific fields |
| `systemControlled` | boolean | No | Protect from delete/edit code |
| `createdAt` | ISO datetime | Yes | Creation timestamp |
| `updatedAt` | ISO datetime | Yes | Last modification |
| `createdBy` | string | No | User who created |
| `modifiedBy` | string | No | User who last modified |
| `auditHistory` | CrmMasterAuditEvent[] | No | Change log |

---

## Register Field Definitions

### Lead Source Master (`lead-sources`)

| Attribute | Label | Type |
|-----------|-------|------|
| sourceType | Source Type | text |
| priority | Priority | text |
| cost | Campaign Cost | number |

**Seed count:** 50+

---

### Industry Master (`industries`)

| Attribute | Label | Type |
|-----------|-------|------|
| category | Category | text |
| defaultSalesProcess | Default Sales Process | text |

**Seed count:** 25+

---

### Territory Master (`territories`)

| Attribute | Label | Type |
|-----------|-------|------|
| region | Region | text |
| state | State | text |
| country | Country | text |
| manager | Manager | text |

**Seed count:** 20+

---

### CRM User / Owner Master (`owners`)

| Attribute | Label | Type |
|-----------|-------|------|
| employeeCode | Employee Code | text |
| role | Role | text |
| department | Department | text |
| email | Email | text |
| mobile | Mobile | text |
| territory | Territory | text |
| permissionGroup | CRM Permission Group | text |

---

### Lead Stage Master (`lead-stages`)

| Attribute | Label | Type |
|-----------|-------|------|
| stageType | Stage Type | select (open/qualified/converted/closed) |
| color | Color | text (hex) |
| nextAction | Next Suggested Action | text |
| isDefault | Default Stage | boolean |
| isFinal | Final Stage | boolean |

---

### Lead Priority Master (`lead-priorities`)

| Attribute | Label | Type |
|-----------|-------|------|
| slaHours | SLA Follow-up Hours | number |
| color | Color | text |
| priorityLevel | Priority Level | number |

---

### Lead Status / Reason Master (`lead-reasons`)

| Attribute | Label | Type |
|-----------|-------|------|
| category | Category | select (inactive/closed/not_qualified/archive) |

---

### Opportunity Stage Master (`opportunity-stages`)

| Attribute | Label | Type |
|-----------|-------|------|
| probability | Probability % | number |
| stageType | Stage Type | text |
| color | Color | text |
| isWon / isLost / isFinal | Flags | boolean |

---

### Opportunity Priority Master (`opportunity-priorities`)

| Attribute | Label | Type |
|-----------|-------|------|
| valueThreshold | Value Threshold (₹) | number |
| color | Color | text |

---

### Activity Type Master (`activity-types`)

| Attribute | Label | Type |
|-----------|-------|------|
| icon | Icon | text |
| color | Color | text |
| systemGenerated | System Generated | boolean |
| editable | User Editable | boolean |

**Seed count:** 40+

---

### Follow-up Type Master (`follow-up-types`)

| Attribute | Label | Type |
|-----------|-------|------|
| defaultDuration | Default Duration (min) | number |
| defaultReminder | Default Reminder (min) | number |
| icon | Icon | text |

---

### Product Interest Master (`product-interests`)

| Attribute | Label | Type |
|-----------|-------|------|
| productFamily | Product Family | text |
| defaultTemplate | Default Quotation Template | text |
| defaultMargin | Default Margin % | number |

---

### Competitor Master (`competitors`)

| Attribute | Label | Type |
|-----------|-------|------|
| productSegment | Product Segment | text |
| pricePosition | Price Position | text |
| strength | Strength | text |
| weakness | Weakness | text |
| website | Website | text |

**Seed count:** 30+

---

### Lost Reason Master (`lost-reasons`)

| Attribute | Label | Type |
|-----------|-------|------|
| category | Category | text |
| closePipeline | Close Pipeline | boolean |
| requiresCompetitor | Requires Competitor | boolean |

**Seed count:** 30+

---

### Commercial Terms Master (`commercial-terms`)

| Attribute | Label | Type |
|-----------|-------|------|
| termType | Term Type | text |
| appliesTo | Applies To | text |
| approvalRequired | Approval Required | boolean |
| clause | Clause Text | textarea |

---

### Payment Terms Master (`payment-terms`)

| Attribute | Label | Type |
|-----------|-------|------|
| advancePct | Advance % | number |
| creditDays | Credit Days | number |
| approvalRequired | Approval Required | boolean |

**Seed count:** 20+

---

### Delivery Terms Master (`delivery-terms`)

| Attribute | Label | Type |
|-----------|-------|------|
| defaultDeliveryTime | Default Delivery Time | text |
| approvalRequired | Approval Required | boolean |

**Seed count:** 15+ (FOB, CIF, EXW, DAP, DDP, etc.)

---

### Warranty Terms Master (`warranty-terms`)

| Attribute | Label | Type |
|-----------|-------|------|
| warrantyDuration | Warranty Duration | text |
| coverage | Coverage | text |
| approvalRequired | Approval Required | boolean |

**Seed count:** 15+

---

### Approval Rule Master (`approval-rules`)

| Attribute | Label | Type |
|-----------|-------|------|
| module | Module | text |
| triggerField | Trigger Field | text |
| condition | Condition | text |
| approvalRole | Approval Role | text |
| autoApprove | Auto Approve | boolean |
| escalation | Escalation SLA | text |

**Seed count:** 20+

---

### Document Type Master (`document-types`)

| Attribute | Label | Type |
|-----------|-------|------|
| requiredFor | Required For | text |
| fileTypes | File Types Allowed | text |
| maxSizeMb | Max Size (MB) | number |

---

## Linked Masters (External Entities)

### Company Master
Managed in `masterStore.customers` — fields include GST, PAN, industry, territory, credit terms, addresses.

### Contact Master
Managed in `crmStore.contacts` — fields include company link, designation, decision maker, primary flag.

### Quotation Template Master
Managed in `crmStore.quotationTemplates` — template sections, print layout, product family.

---

## Import CSV Format

```csv
code,name,status,description
website,Website,active,Corporate website enquiries
```

Required columns: `code`, `name`  
Optional: `status`, `description`

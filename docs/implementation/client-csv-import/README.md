# FOS ERP — Client Data Collection Pack

**Share with the client:** zip this folder, or send the Excel alone.

| Deliverable | File |
|-------------|------|
| **Single Excel (questionnaire + all data sheets)** | [`FOS_ERP_Client_Data_Collection.xlsx`](FOS_ERP_Client_Data_Collection.xlsx) |
| Matching CSVs (direct product upload) | `00_*.csv` … `12_*.csv` |
| Regenerator | [`generate-client-pack.ts`](generate-client-pack.ts) |

## Regenerate

```bash
cd backend
npx tsx ../docs/implementation/client-csv-import/generate-client-pack.ts
```

## Excel tabs

| Tab | Purpose |
|-----|---------|
| **00_Instructions** | How to fill, load order, rules |
| **Questionnaire** | Discovery — client fills **Client_Answer** (yellow column) |
| **Import_Index** | Live import vs collection sheets |
| **00_Prerequisites** … **12_Work_Centres** | Headers + sample rows + blank rows |

Green tabs = live in-app CSV import. Brown = collection / assisted setup.

## Live imports (upload in FOS ERP, API mode)

| Sheet | CSV |
|-------|-----|
| Items | `01_items.csv` |
| Vendors | `02_vendors.csv` |
| HSN/SAC | `03_hsn_sac.csv` |
| Companies | `04_companies.csv` |
| Contacts | `05_contacts.csv` |
| Leads | `06_leads.csv` |
| BOM | `07_bom_combined.csv` |
| Chart of Accounts | `08_chart_of_accounts.csv` |

**Not live API CSV yet:** warehouses, opening stock, users, work centres — collect in Excel; load via UI / invite / assisted import.

**Chart of Accounts:** Accounting → Chart of Accounts → Import (API mode). Requires a legal entity; parents resolve by Account Code (file or existing CoA).

## Client instructions (copy into email)

1. Open `FOS_ERP_Client_Data_Collection.xlsx`.
2. Complete the **Questionnaire** (yellow **Client_Answer** column).
3. On each data sheet, replace sample rows with your data. **Do not rename header cells.**
4. Return the filled Excel (preferred), or export sheets as CSV for Import screens.
5. Do not include passwords, bank account numbers, or Aadhaar.

## Load order

Prerequisites (UOM, categories, GST groups, geography) → Legal entity / Chart of Accounts → HSN → Items → Vendors → Companies → Contacts → Leads → Warehouses / Work Centres → BOM → Opening Stock → invite Users.

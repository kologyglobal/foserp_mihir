import { strict as assert } from 'node:assert'
import { readFileSync } from 'node:fs'
import { parseBomImportCsv } from '../src/utils/bomImport'

const valid = `bom_code,bom_name,output_item_code,output_quantity,output_uom_code,line_ref,parent_line_ref,component_item_code,component_quantity,component_uom_code,sequence,remarks
BOM-1,"Pump, Assembly",PUMP-1,1,NOS,L10,,BODY-1,1,NOS,10,"Main, body"
BOM-1,"Pump, Assembly",PUMP-1,1,NOS,L11,L10,STEEL-1,5,KG,10,Raw material`

const parsed = parseBomImportCsv(valid)
assert.deepEqual(parsed.errors, [])
assert.equal(parsed.rows.length, 2)
assert.equal(parsed.rows[0].bom_name, 'Pump, Assembly')
assert.equal(parsed.rows[0].remarks, 'Main, body')
assert.equal(parsed.rows[1].parent_line_ref, 'L10')

const missing = parseBomImportCsv('bom_code,line_ref\nBOM-1,L10')
assert.equal(missing.rows.length, 0)
assert.match(missing.errors[0], /Missing required CSV columns/)

const listPage = readFileSync(new URL('../src/modules/manufacturing/setup/boms/BomsSetupPage.tsx', import.meta.url), 'utf8')
const editorPage = readFileSync(new URL('../src/modules/manufacturing/setup/boms/BomVersionEditorPage.tsx', import.meta.url), 'utf8')
const dialog = readFileSync(new URL('../src/modules/manufacturing/setup/boms/BomCsvImportDialog.tsx', import.meta.url), 'utf8')
const api = readFileSync(new URL('../src/services/api/manufacturingApi.ts', import.meta.url), 'utf8')

assert.match(listPage, /Import CSV/)
assert.match(listPage, /Download Template/)
assert.match(editorPage, /Import as New Draft Revision/)
assert.match(dialog, /previewBomCsvImport/)
assert.match(dialog, /confirmBomCsvImport/)
assert.match(dialog, /BOM CSV import is available in live API mode/)
assert.match(api, /\/manufacturing\/boms\/import\/preview/)
assert.match(api, /\/manufacturing\/boms\/import/)

console.log('BOM CSV import checks passed')

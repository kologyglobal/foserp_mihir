/**
 * Smoke checks for Finance Phase 5D1–5D2 — bank connector FE wiring.
 * Run: npx tsx scripts/verify-bank-connectors.ts
 */
import fs from 'node:fs'
import path from 'node:path'

const root = path.resolve(import.meta.dirname, '..')
let passed = 0
let failed = 0

function check(label: string, ok: boolean) {
  if (ok) {
    console.log(`✓ ${label}`)
    passed += 1
  } else {
    console.log(`✗ ${label}`)
    failed += 1
  }
}

function exists(rel: string) {
  return fs.existsSync(path.join(root, rel))
}

function read(rel: string) {
  return fs.readFileSync(path.join(root, rel), 'utf8')
}

check('ConnectorListPage exists', exists('src/modules/accounting/treasury/connectors/pages/ConnectorListPage.tsx'))
check('ApiConnectorListPage exists', exists('src/modules/accounting/treasury/connectors/pages/ApiConnectorListPage.tsx'))
check('DemoConnectorListPage exists', exists('src/modules/accounting/treasury/connectors/pages/DemoConnectorListPage.tsx'))
check('bank-connector types exist', exists('src/modules/accounting/treasury/connectors/api/bank-connector.types.ts'))
check('bank-connector api wrappers exist', exists('src/modules/accounting/treasury/connectors/api/bank-connector.api.ts'))
check('permission hook exists', exists('src/utils/permissions/treasuryConnector.ts'))
check('demo seed exists', exists('src/modules/accounting/treasury/connectors/demo/seedDemoBankConnectors.ts'))

const routes = read('src/routes/accountingRoutes.tsx')
check('Route bank-cash/connectors registered', routes.includes("path: 'accounting/bank-cash/connectors'") && routes.includes('ConnectorListPage'))

const tabs = read('src/types/bankCash.ts')
check('Workspace tab bank_connectors', tabs.includes("id: 'bank_connectors'") && tabs.includes('Bank connectors'))

const apiPage = read('src/modules/accounting/treasury/connectors/pages/ApiConnectorListPage.tsx')
check('5D3 banner present', apiPage.includes('Phase 5D3') || apiPage.includes('live SFTP'))
check('FE gates canManage / canSync', apiPage.includes('canManage') && apiPage.includes('canSync'))
check('Sandbox mode in form save', apiPage.includes('sandboxRoot') || read('src/modules/accounting/treasury/connectors/components/ConnectorFormDrawer.tsx').includes('sandboxRoot'))
check('Test/Sync handle success', apiPage.includes('statementsCreated') || apiPage.includes('Connection probe OK'))
check('Start consent UX for OPEN_BANKING', apiPage.includes('Start consent') && apiPage.includes('startBankConnectorConsent'))
check('Consent revoke UX', apiPage.includes('revokeBankConnectorConsent') || apiPage.includes('Revoke'))

const types = read('src/modules/accounting/treasury/connectors/api/bank-connector.types.ts')
check('isLiveConnected is boolean', types.includes('isLiveConnected: boolean'))
check('Connected label supported', types.includes("'Connected'"))
check('credentialEnvKey in config', types.includes('credentialEnvKey'))

const treasuryApi = read('src/services/api/treasuryApi.ts')
check('treasuryApi bank-connectors path', treasuryApi.includes('/bank-connectors'))
check('treasuryApi test-connection', treasuryApi.includes('testBankConnectorConnection'))
check('treasuryApi sync', treasuryApi.includes('syncBankConnector'))
check('treasuryApi consent start', treasuryApi.includes('consents/start') && treasuryApi.includes('startBankConnectorConsent'))
check('treasuryApi consent revoke', treasuryApi.includes('consents/revoke'))

const demo = read('src/modules/accounting/treasury/connectors/demo/seedDemoBankConnectors.ts')
check('Demo seed DISABLED only', demo.includes("status: 'DISABLED'") && !demo.includes("status: 'ENABLED'"))

console.log(`\nTotal: ${passed} passed, ${failed} failed`)
process.exit(failed > 0 ? 1 : 0)

import { CheckCircle2, XCircle, Percent, ClipboardList } from 'lucide-react'
import {
  DynamicsModuleDashboard,
  DynamicsDashboardPanel,
  DynamicsDashboardGrid,
} from '../../components/dynamics'
import { Badge } from '../../components/ui/Badge'
import {
  uatSummary,
  uatModuleScores,
  uatRolePassPercent,
  uatDefectSummary,
  uatScenarios,
  UAT_EXECUTION_DATE,
} from '../../data/uat/uatDashboardData'

function pct(passed: number, total: number) {
  return total ? Math.round((passed / total) * 1000) / 10 : 0
}

export function UatDashboardPage() {
  const signoffColor: 'green' | 'yellow' =
    uatSummary.criticalDefectsOpen === 0 && uatSummary.highDefectsOpen === 0 && uatSummary.passPercent >= 95
      ? 'green'
      : 'yellow'

  return (
    <DynamicsModuleDashboard
      title="UAT Command Center"
      subtitle="User Acceptance Testing status for FOS ERP — pre-backend migration"
      badge="UAT"
      favoritePath="/uat/dashboard"
      healthScore={uatSummary.passPercent >= 95 ? 96 : uatSummary.passPercent >= 90 ? 85 : 72}
      heroMetrics={[
        { id: 'total', label: 'Total Test Cases', value: uatSummary.totalTestCases, icon: ClipboardList, accent: 'blue' },
        { id: 'passed', label: 'Passed', value: uatSummary.passed, icon: CheckCircle2, accent: 'green' },
        { id: 'failed', label: 'Failed', value: uatSummary.failed, icon: XCircle, accent: uatSummary.failed ? 'red' : 'green' },
        { id: 'pct', label: 'Pass %', value: `${uatSummary.passPercent}%`, icon: Percent, accent: 'indigo' },
      ]}
      kpiStrip={[
        { label: 'Blocked', value: uatSummary.blocked, tone: uatSummary.blocked ? 'warning' : 'success' },
        { label: 'Critical Open', value: uatSummary.criticalDefectsOpen, tone: uatSummary.criticalDefectsOpen ? 'critical' : 'success' },
        { label: 'Automated Suites', value: `${uatSummary.automatedSuitesPassed}/${uatSummary.automatedSuitesTotal}`, tone: 'primary' },
      ]}
    >
      <DynamicsDashboardGrid>
        <DynamicsDashboardPanel title="Defects">
          <dl className="grid grid-cols-2 gap-3 p-4 text-sm">
            <dt className="text-erp-muted">Critical (open)</dt>
            <dd className="font-semibold text-emerald-700">{uatSummary.criticalDefectsOpen}</dd>
            <dt className="text-erp-muted">High (open)</dt>
            <dd className="font-semibold text-emerald-700">{uatSummary.highDefectsOpen}</dd>
            <dt className="text-erp-muted">Medium (open)</dt>
            <dd>{uatDefectSummary.medium}</dd>
            <dt className="text-erp-muted">Low (open)</dt>
            <dd>{uatDefectSummary.low}</dd>
            <dt className="text-erp-muted">Retest pending</dt>
            <dd>{uatDefectSummary.retest}</dd>
          </dl>
        </DynamicsDashboardPanel>

        <DynamicsDashboardPanel title="Signoff Readiness">
          <div className="space-y-3 p-4">
            <Badge color={signoffColor}>
              {uatSummary.signoffReady ? 'Ready for signoff review' : 'Not ready'}
            </Badge>
            <p className="text-sm text-erp-muted">
              Backend verdict: <strong>{uatSummary.backendVerdict}</strong>
            </p>
            <p className="text-xs text-erp-muted">
              Automated suites: {uatSummary.automatedSuitesPassed}/{uatSummary.automatedSuitesTotal} passed
            </p>
            <p className="text-xs text-erp-muted">Last execution: {UAT_EXECUTION_DATE}</p>
          </div>
        </DynamicsDashboardPanel>

        <DynamicsDashboardPanel title="E2E Scenarios" noPadding>
          <ul className="dyn-entity-list">
            {uatScenarios.map((s) => (
              <li key={s.id} className="dyn-entity-list-item">
                <div>
                  <p className="font-medium">Scenario {s.id}: {s.name}</p>
                  <p className="dyn-entity-list-meta">{s.target}</p>
                </div>
                <Badge color="green">{s.status}</Badge>
              </li>
            ))}
          </ul>
        </DynamicsDashboardPanel>
      </DynamicsDashboardGrid>

      <DynamicsDashboardPanel title="Module-wise Pass %" noPadding>
        <table className="erp-table">
          <thead>
            <tr>
              <th>Module</th>
              <th className="text-right">Total</th>
              <th className="text-right">Passed</th>
              <th className="text-right">Blocked</th>
              <th className="text-right">Pass %</th>
            </tr>
          </thead>
          <tbody>
            {uatModuleScores.map((m) => (
              <tr key={m.module}>
                <td>{m.module}</td>
                <td className="num">{m.total}</td>
                <td className="num">{m.passed}</td>
                <td className="num">{m.blocked}</td>
                <td className="num">{pct(m.passed, m.total)}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </DynamicsDashboardPanel>

      <DynamicsDashboardPanel title="Role-wise Pass %">
        <div className="dyn-action-grid">
          {Object.entries(uatRolePassPercent).map(([role, p]) => (
            <div key={role} className="dyn-snapshot-strip">
              <p><strong>{role}</strong></p>
              <span className="font-semibold tabular-nums">{p}%</span>
            </div>
          ))}
        </div>
      </DynamicsDashboardPanel>

      <DynamicsDashboardPanel title="UAT Artifacts">
        <div className="p-4">
          <p className="text-sm text-erp-muted">
            Reports in repository root: ERP_UAT_TEST_CASES.md, ERP_UAT_DEFECT_LOG.md,
            ERP_UAT_SIGNOFF_CHECKLIST.md, UAT_AUTOMATION_SUMMARY.md, ERP_UAT_FINAL_EXECUTION_SUMMARY.md
          </p>
          <p className="mt-3 text-xs text-erp-muted">
            Load sample data from Settings (demo seed load is no longer a separate screen).
            Run <code className="rounded bg-erp-surface-alt px-1">npm run test:uat</code> to refresh automation summary.
          </p>
        </div>
      </DynamicsDashboardPanel>
    </DynamicsModuleDashboard>
  )
}

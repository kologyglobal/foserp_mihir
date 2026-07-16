import {
  ClipboardList,
  AlertTriangle,
  Factory,
  Truck,
  ShieldCheck,
} from 'lucide-react'
import { Link } from 'react-router-dom'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from 'recharts'
import { StatCard } from '../../components/ui/StatCard'
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card'
import { Badge, formatStatus, statusColor } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { useERPStore } from '../../store/useERPStore'
import { salesOrders } from '@/data/sales/legacyDemo'
import { materialShortages } from '@/data/inventory/legacyDemo'
import { workOrders } from '@/data/production/legacyDemo'
import { dispatchOrders } from '@/data/dispatch/legacyDemo'
import { qcInspections } from '@/data/quality/legacyDemo'
import { formatDate } from '../../utils/dates/format'
const productionByBay = [
  { bay: 'Bay-1', wip: 2, capacity: 3 },
  { bay: 'Bay-2', wip: 1, capacity: 3 },
  { bay: 'Bay-3', wip: 0, capacity: 2 },
  { bay: 'Bay-4', wip: 2, capacity: 2 },
  { bay: 'Bay-SS', wip: 1, capacity: 1 },
]

const orderMix = [
  { name: '45 M3 Bulker', value: 4, color: '#2563eb' },
  { name: 'ISO Tank', value: 2, color: '#7c3aed' },
  { name: 'Cement Bulker', value: 2, color: '#059669' },
  { name: 'Side Wall', value: 2, color: '#d97706' },
]

export function DashboardPage() {
  const { kpis } = useERPStore()

  const recentOrders = salesOrders
    .filter((o) => !['dispatched', 'closed'].includes(o.status))
    .slice(0, 5)

  const criticalShortages = materialShortages.filter(
    (s) => s.priority === 'critical' || s.priority === 'high',
  )

  const activeWIP = workOrders.filter(
    (w) => w.status === 'in-progress' || w.status === 'released',
  )

  const readyDispatch = dispatchOrders.filter((d) => d.status === 'ready')
  const pendingQC = qcInspections.filter(
    (q) => q.status === 'pending' || q.status === 'in-progress',
  )

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-slate-900">Operations Dashboard</h1>
        <p className="mt-1 text-sm text-slate-500">
          Trailer manufacturing plant overview — Pune facility
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <StatCard
          title="Open Orders"
          value={kpis.openOrders}
          icon={ClipboardList}
          trend="8 active sales orders"
          accent="blue"
        />
        <StatCard
          title="Material Shortages"
          value={kpis.materialShortages}
          icon={AlertTriangle}
          trend="2 critical items"
          accent="red"
        />
        <StatCard
          title="Production WIP"
          value={kpis.productionWIP}
          icon={Factory}
          trend="Across 5 bays"
          accent="amber"
        />
        <StatCard
          title="Dispatch Ready"
          value={kpis.dispatchReady}
          icon={Truck}
          trend="Awaiting loading"
          accent="green"
        />
        <StatCard
          title="Pending QC"
          value={kpis.pendingQC}
          icon={ShieldCheck}
          trend="3 inspections due"
          accent="purple"
        />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Production Load by Bay</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={productionByBay}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="bay" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip />
                <Bar dataKey="wip" fill="#2563eb" name="WIP" radius={[4, 4, 0, 0]} />
                <Bar dataKey="capacity" fill="#e2e8f0" name="Capacity" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Open Order Mix</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie
                  data={orderMix}
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={80}
                  paddingAngle={3}
                  dataKey="value"
                  label={({ name, value }) => `${name}: ${value}`}
                >
                  {orderMix.map((entry) => (
                    <Cell key={entry.name} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Recent Open Orders</CardTitle>
            <Link to="/sales">
              <Button variant="ghost" size="sm">
                View All
              </Button>
            </Link>
          </CardHeader>
          <div className="overflow-x-auto">
            <table className="erp-table">
              <thead>
                <tr>
                  <th>Order No</th>
                  <th>Customer</th>
                  <th>Product</th>
                  <th>Delivery</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {recentOrders.map((order) => (
                  <tr key={order.id}>
                    <td className="font-medium text-slate-800">{order.orderNo}</td>
                    <td>{order.customerName}</td>
                    <td className="text-slate-600">{order.productName}</td>
                    <td>{formatDate(order.deliveryDate)}</td>
                    <td>
                      <Badge color={statusColor(order.status)}>
                        {formatStatus(order.status)}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Critical Material Shortages</CardTitle>
            <Link to="/inventory">
              <Button variant="ghost" size="sm">
                View Inventory
              </Button>
            </Link>
          </CardHeader>
          <div className="overflow-x-auto">
            <table className="erp-table">
              <thead>
                <tr>
                  <th>Item</th>
                  <th>Shortage</th>
                  <th>Work Order</th>
                  <th>Required</th>
                  <th>Priority</th>
                </tr>
              </thead>
              <tbody>
                {criticalShortages.map((item) => (
                  <tr key={item.id}>
                    <td>
                      <p className="font-medium text-slate-800">{item.itemCode}</p>
                      <p className="text-xs text-slate-500">{item.description}</p>
                    </td>
                    <td className="font-semibold text-red-600">
                      {item.shortageQty} {item.itemCode.startsWith('RM-PLT') || item.itemCode.includes('SS') ? 'KG' : 'NOS'}
                    </td>
                    <td>{item.workOrderNo}</td>
                    <td>{formatDate(item.requiredDate)}</td>
                    <td>
                      <Badge color={statusColor(item.priority)}>
                        {formatStatus(item.priority)}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Production WIP</CardTitle>
            <Link to="/production">
              <Button variant="ghost" size="sm">
                Shop Floor
              </Button>
            </Link>
          </CardHeader>
          <div className="divide-y divide-erp-border">
            {activeWIP.map((wo) => (
              <div key={wo.id} className="flex items-center justify-between px-5 py-3">
                <div>
                  <p className="text-sm font-medium text-slate-800">{wo.woNo}</p>
                  <p className="text-xs text-slate-500">
                    {wo.productName} · {wo.bay}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-semibold text-slate-800">{wo.progress}%</p>
                  <p className="text-xs text-slate-500">{wo.currentStage}</p>
                </div>
              </div>
            ))}
          </div>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Dispatch Ready</CardTitle>
            <Link to="/dispatch">
              <Button variant="ghost" size="sm">
                Dispatch
              </Button>
            </Link>
          </CardHeader>
          <div className="divide-y divide-erp-border">
            {readyDispatch.map((d) => (
              <div key={d.id} className="flex items-center justify-between px-5 py-3">
                <div>
                  <p className="text-sm font-medium text-slate-800">{d.dispatchNo}</p>
                  <p className="text-xs text-slate-500">{d.customerName}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm text-slate-800">
                    {d.quantity}x {d.productName}
                  </p>
                  <p className="text-xs text-slate-500">{d.destination}</p>
                </div>
              </div>
            ))}
          </div>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Pending QC</CardTitle>
            <Link to="/quality">
              <Button variant="ghost" size="sm">
                Quality
              </Button>
            </Link>
          </CardHeader>
          <div className="divide-y divide-erp-border">
            {pendingQC.map((qc) => (
              <div key={qc.id} className="flex items-center justify-between px-5 py-3">
                <div>
                  <p className="text-sm font-medium text-slate-800">{qc.inspectionNo}</p>
                  <p className="text-xs text-slate-500">{qc.inspectionType}</p>
                </div>
                <div className="text-right">
                  <Badge color={statusColor(qc.status)}>
                    {formatStatus(qc.status)}
                  </Badge>
                  <p className="mt-1 text-xs text-slate-500">
                    {formatDate(qc.scheduledDate)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  )
}

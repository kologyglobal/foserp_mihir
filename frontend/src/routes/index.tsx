import { createBrowserRouter } from 'react-router-dom'
import { AuthRootLayout } from '@/components/auth/AuthRootLayout'
import { ERPLayout } from '@/components/layout/ERPLayout'
import { RouteErrorBoundary } from '@/components/system/RouteErrorBoundary'
import { PageNotFoundPage } from '@/components/system/PageNotFoundPage'
import { ApiAuthGate } from '@/modules/auth/ApiAuthGate'
import { authRoute, accountRouteChildren } from './authRoutes'
import { homeRouteChildren } from './homeRoutes'
import { masterRouteChildren } from './masterRoutes'
import { platformRouteChildren } from './platformRoutes'
import { inventoryRouteChildren } from './inventoryRoutes'
import { productionRouteChildren } from './productionRoutes'
import { manufacturingRouteChildren } from './manufacturingRoutes'
import { salesRouteChildren } from './salesRoutes'
import { qualityRouteChildren } from './qualityRoutes'
import { dispatchFinanceRouteChildren } from './dispatchFinanceRoutes'
import { logisticsRouteChildren } from './logisticsRoutes'
import { gateRouteChildren } from './gateRoutes'
import { maintenanceRouteChildren } from './maintenanceRoutes'
import { gateOperatorRouteTree } from './gateOperatorRoutes'
import { reportsRouteChildren } from './reportsRoutes'
import { mobileRouteTree } from './mobileRoutes'
import { crmRouteTree } from './crmRoutes'
import { purchaseRouteTree } from './purchaseRoutes'
import { accountingRouteChildren } from './accountingRoutes'
import { adminRouteChildren } from './adminRoutes'
import { organisationRouteChildren } from './organisationRoutes'
import { operationsRouteChildren } from './operationsRoutes'

export const router = createBrowserRouter([
  {
    element: <AuthRootLayout />,
    errorElement: <RouteErrorBoundary />,
    children: [
      authRoute,
      mobileRouteTree,
      gateOperatorRouteTree,
      {
        path: '/',
        element: (
          <ApiAuthGate>
            <ERPLayout />
          </ApiAuthGate>
        ),
        errorElement: <RouteErrorBoundary />,
        children: [
          ...homeRouteChildren,
          ...masterRouteChildren,
          ...platformRouteChildren,
          ...inventoryRouteChildren,
          ...salesRouteChildren,
          crmRouteTree,
          purchaseRouteTree,
          ...manufacturingRouteChildren,
          ...productionRouteChildren,
          ...qualityRouteChildren,
          ...maintenanceRouteChildren,
          ...logisticsRouteChildren,
          ...dispatchFinanceRouteChildren,
          ...gateRouteChildren,
          ...operationsRouteChildren,
          ...reportsRouteChildren,
          ...accountingRouteChildren,
          ...organisationRouteChildren,
          ...adminRouteChildren,
          ...accountRouteChildren,
          { path: '*', element: <PageNotFoundPage /> },
        ],
      },
    ],
  },
])

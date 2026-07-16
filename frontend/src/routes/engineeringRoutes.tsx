import type { RouteObject } from 'react-router-dom'
import { Bom360Page } from '@/modules/entity360'
import { Bom360LegacyRedirect } from '@/modules/entity360/Entity360Redirects'
import {
  BomListPage,
  BomFormPage,
  BomDetailPage,
} from '@/modules/masters/bom/BomPages'
import { EcoRegisterPage, EcoNewPage, EcoDetailPage } from '@/modules/engineering/EcoPages'
import {
  SerialNumberMasterPage,
  SerialDetailPage,
  TrailerGenealogyPage,
  ComponentGenealogyPage,
  WarrantyInvestigationPage,
} from '@/modules/serial'

export const engineeringRouteChildren: RouteObject[] = [
  { path: 'engineering/boms/:id/360', element: <Bom360Page /> },
  { path: 'engineering/bom', element: <BomListPage /> },
  { path: 'engineering/bom/new', element: <BomFormPage /> },
  { path: 'engineering/bom/:id/manage', element: <BomDetailPage /> },
  { path: 'engineering/bom/:id', element: <Bom360LegacyRedirect /> },
  { path: 'engineering/bom/:id/edit', element: <BomFormPage /> },

  { path: 'engineering/eco', element: <EcoRegisterPage /> },
  { path: 'engineering/eco/new', element: <EcoNewPage /> },
  { path: 'engineering/eco/:id', element: <EcoDetailPage /> },

  { path: 'serials', element: <SerialNumberMasterPage /> },
  { path: 'serials/:id', element: <SerialDetailPage /> },
  { path: 'masters/serial-numbers', element: <SerialNumberMasterPage /> },
  { path: 'genealogy', element: <TrailerGenealogyPage /> },
  { path: 'traceability/trailers', element: <TrailerGenealogyPage /> },
  { path: 'traceability/components/:serialNo', element: <ComponentGenealogyPage /> },
  { path: 'traceability/warranty', element: <WarrantyInvestigationPage /> },
]

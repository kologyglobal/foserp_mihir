import type { RouteObject } from 'react-router-dom'
import { Navigate } from 'react-router-dom'
import { ApprovalMatrixConfigPage } from '@/modules/approval'
import { PermissionMatrixPage, RoleMasterPage } from '@/modules/settings'
import {
  CrmContactsPage,
  CrmContactFormPage,
} from '@/modules/crm'
import { Contact360Page } from '@/modules/crm/Contact360Page'
import {
  CrmMasterListPage,
  CrmMasterFormPage,
  CrmMasterDetailPage,
} from '@/modules/crm/masters/CrmMasterPages'
import { MastersHomePage } from '@/modules/masters/MastersHomePage'
import { MasterPlaceholderPage } from '@/modules/masters/shared/MasterPlaceholderPage'
import {
  MastersCustomersLegacyRedirect,
  MastersPermissionsLegacyRedirect,
} from '@/modules/masters/shared/MastersLegacyRedirects'
import { UomListPage, UomFormPage, UomDetailPage } from '@/modules/masters/uom/UomPages'
import { HsnListPage, HsnFormPage, HsnDetailPage } from '@/modules/masters/hsn/HsnPages'
import { GstGroupListPage, GstGroupFormPage, GstGroupDetailPage } from '@/modules/masters/gst-group/GstGroupPages'
import { GstRateListPage, GstRateFormPage, GstRateDetailPage } from '@/modules/masters/gst-rate/GstRatePages'
import {
  ItemCategoryListPage,
  ItemCategoryFormPage,
  ItemCategoryDetailPage,
} from '@/modules/masters/item-category/ItemCategoryPages'
import { ItemListPage, ItemFormPage } from '@/modules/masters/item/ItemPages'
import { ItemDetailPage } from '@/modules/entity360'
import {
  CustomerListPage,
  CustomerFormPage,
} from '@/modules/masters/customer/CustomerPages'
import { Customer360Page } from '@/modules/entity360'
import { Customer360LegacyRedirect } from '@/modules/entity360/Entity360Redirects'
import {
  VendorListPage,
  VendorFormPage,
} from '@/modules/masters/vendor/VendorPages'
import { VendorDetailPage } from '@/modules/entity360'
import {
  PaymentMethodListPage,
  PaymentMethodFormPage,
  PaymentMethodDetailPage,
} from '@/modules/masters/payment-method/PaymentMethodPages'
import {
  OrderAddressListPage,
  OrderAddressFormPage,
  OrderAddressDetailPage,
} from '@/modules/masters/order-address/OrderAddressPages'
import {
  BankAccountListPage,
  BankAccountFormPage,
  BankAccountDetailPage,
} from '@/modules/masters/bank-account/BankAccountPages'
import {
  BankListPage,
  BankFormPage,
  BankDetailPage,
} from '@/modules/masters/bank/BankPages'
import {
  CodeSeriesListPage,
  CodeSeriesFormPage,
  CodeSeriesDetailPage,
} from '@/modules/masters/code-series/CodeSeriesPages'
import {
  WarehouseListPage,
  WarehouseFormPage,
  WarehouseDetailPage,
} from '@/modules/masters/warehouse/WarehousePages'
import {
  LocationListPage,
  LocationFormPage,
  LocationDetailPage,
} from '@/modules/masters/location/LocationPages'
import {
  CountryListPage,
  CountryFormPage,
  CountryDetailPage,
  StateListPage,
  StateFormPage,
  StateDetailPage,
  CityListPage,
  CityFormPage,
  CityDetailPage,
} from '@/modules/masters/geography/GeographyPages'
import {
  ProductListPage,
  ProductFormPage,
} from '@/modules/masters/product/ProductPages'
import { ProductDetailPage } from '@/modules/entity360'
import {
  BomListPage,
  BomFormPage,
  BomDetailPage,
} from '@/modules/masters/bom/BomPages'
import { Bom360LegacyRedirect } from '@/modules/entity360/Entity360Redirects'
import {
  UserMasterListPage,
  UserMasterFormPage,
  UserMasterDetailPage,
} from '@/modules/admin/UserMasterPages'
import {
  ProductInterestMasterListPage,
  ProductInterestMasterFormPage,
  ProductInterestMasterDetailPage,
} from '@/modules/admin/ProductInterestMasterPages'
import {
  WorkCenterListPage,
  WorkCenterFormPage,
  WorkCenterDetailPage,
} from '@/modules/masters/work-center/WorkCenterPages'
import {
  RoutingListPage,
  RoutingFormPage,
  RoutingDetailPage,
} from '@/modules/masters/routing/RoutingPages'

export const masterRouteChildren: RouteObject[] = [
  { path: 'masters', element: <MastersHomePage /> },

  { path: 'masters/companies', element: <CustomerListPage /> },
  { path: 'masters/companies/new', element: <CustomerFormPage /> },
  { path: 'masters/companies/:id/360', element: <Customer360Page /> },
  { path: 'masters/companies/:id', element: <Customer360LegacyRedirect /> },
  { path: 'masters/companies/:id/edit', element: <CustomerFormPage /> },

  { path: 'masters/roles', element: <RoleMasterPage /> },
  { path: 'masters/role-permissions', element: <PermissionMatrixPage /> },
  { path: 'masters/permissions', element: <MastersPermissionsLegacyRedirect /> },
  { path: 'masters/permissions/*', element: <MastersPermissionsLegacyRedirect /> },

  { path: 'masters/contacts', element: <CrmContactsPage /> },
  { path: 'masters/contacts/new', element: <CrmContactFormPage /> },
  { path: 'masters/contacts/:id/edit', element: <CrmContactFormPage /> },
  { path: 'masters/contacts/:id', element: <Contact360Page /> },

  { path: 'masters/territories', element: <CrmMasterListPage fixedSlug="territories" /> },
  { path: 'masters/territories/new', element: <CrmMasterFormPage fixedSlug="territories" /> },
  { path: 'masters/territories/:id/edit', element: <CrmMasterFormPage fixedSlug="territories" /> },
  { path: 'masters/territories/:id', element: <CrmMasterDetailPage fixedSlug="territories" /> },

  { path: 'masters/industries', element: <CrmMasterListPage fixedSlug="industries" /> },
  { path: 'masters/industries/new', element: <CrmMasterFormPage fixedSlug="industries" /> },
  { path: 'masters/industries/:id/edit', element: <CrmMasterFormPage fixedSlug="industries" /> },
  { path: 'masters/industries/:id', element: <CrmMasterDetailPage fixedSlug="industries" /> },

  { path: 'masters/designations', element: <CrmMasterListPage fixedSlug="designations" /> },
  { path: 'masters/designations/new', element: <CrmMasterFormPage fixedSlug="designations" /> },
  { path: 'masters/designations/:id/edit', element: <CrmMasterFormPage fixedSlug="designations" /> },
  { path: 'masters/designations/:id', element: <CrmMasterDetailPage fixedSlug="designations" /> },

  { path: 'masters/departments', element: <CrmMasterListPage fixedSlug="departments" /> },
  { path: 'masters/departments/new', element: <CrmMasterFormPage fixedSlug="departments" /> },
  { path: 'masters/departments/:id/edit', element: <CrmMasterFormPage fixedSlug="departments" /> },
  { path: 'masters/departments/:id', element: <CrmMasterDetailPage fixedSlug="departments" /> },

  { path: 'masters/payment-terms', element: <CrmMasterListPage fixedSlug="payment-terms" /> },
  { path: 'masters/payment-terms/new', element: <CrmMasterFormPage fixedSlug="payment-terms" /> },
  { path: 'masters/payment-terms/:id/edit', element: <CrmMasterFormPage fixedSlug="payment-terms" /> },
  { path: 'masters/payment-terms/:id', element: <CrmMasterDetailPage fixedSlug="payment-terms" /> },

  { path: 'masters/countries', element: <CountryListPage /> },
  { path: 'masters/countries/new', element: <CountryFormPage /> },
  { path: 'masters/countries/:id', element: <CountryDetailPage /> },
  { path: 'masters/countries/:id/edit', element: <CountryFormPage /> },
  { path: 'masters/states', element: <StateListPage /> },
  { path: 'masters/states/new', element: <StateFormPage /> },
  { path: 'masters/states/:id', element: <StateDetailPage /> },
  { path: 'masters/states/:id/edit', element: <StateFormPage /> },
  { path: 'masters/cities', element: <CityListPage /> },
  { path: 'masters/cities/new', element: <CityFormPage /> },
  { path: 'masters/cities/:id', element: <CityDetailPage /> },
  { path: 'masters/cities/:id/edit', element: <CityFormPage /> },
  { path: 'masters/price-lists', element: <MasterPlaceholderPage masterId="price-lists" /> },
  { path: 'masters/quality-test-groups', element: <MasterPlaceholderPage masterId="quality-test-groups" /> },

  { path: 'masters/approval-workflows', element: <ApprovalMatrixConfigPage /> },
  { path: 'masters/approval-matrix', element: <Navigate to="/masters/approval-workflows" replace /> },

  { path: 'settings/roles', element: <Navigate to="/masters/roles" replace /> },
  { path: 'settings/permissions', element: <Navigate to="/masters/role-permissions" replace /> },
  { path: 'settings/approval-matrix', element: <Navigate to="/masters/approval-workflows" replace /> },

  { path: 'masters/uom', element: <UomListPage /> },
  { path: 'masters/uom/new', element: <UomFormPage /> },
  { path: 'masters/uom/:id', element: <UomDetailPage /> },
  { path: 'masters/uom/:id/edit', element: <UomFormPage /> },

  { path: 'masters/item-categories', element: <ItemCategoryListPage /> },
  { path: 'masters/item-categories/new', element: <ItemCategoryFormPage /> },
  { path: 'masters/item-categories/:id', element: <ItemCategoryDetailPage /> },
  { path: 'masters/item-categories/:id/edit', element: <ItemCategoryFormPage /> },

  { path: 'masters/items', element: <ItemListPage /> },
  { path: 'masters/items/new', element: <ItemFormPage /> },
  { path: 'masters/items/:id', element: <ItemDetailPage /> },
  { path: 'masters/items/:id/edit', element: <ItemFormPage /> },

  { path: 'masters/hsn', element: <HsnListPage /> },
  { path: 'masters/hsn/new', element: <HsnFormPage /> },
  { path: 'masters/hsn/:id', element: <HsnDetailPage /> },
  { path: 'masters/hsn/:id/edit', element: <HsnFormPage /> },

  { path: 'masters/gst-groups', element: <GstGroupListPage /> },
  { path: 'masters/gst-groups/new', element: <GstGroupFormPage /> },
  { path: 'masters/gst-groups/:id', element: <GstGroupDetailPage /> },
  { path: 'masters/gst-groups/:id/edit', element: <GstGroupFormPage /> },

  { path: 'masters/gst-rates', element: <GstRateListPage /> },
  { path: 'masters/gst-rates/new', element: <GstRateFormPage /> },
  { path: 'masters/gst-rates/:id', element: <GstRateDetailPage /> },
  { path: 'masters/gst-rates/:id/edit', element: <GstRateFormPage /> },

  { path: 'masters/customers', element: <MastersCustomersLegacyRedirect /> },
  { path: 'masters/customers/*', element: <MastersCustomersLegacyRedirect /> },

  { path: 'entity360/customers/:id', element: <Customer360Page /> },
  { path: 'entity360/customers/:id/360', element: <Customer360Page /> },

  { path: 'masters/vendors', element: <VendorListPage /> },
  { path: 'masters/vendors/new', element: <VendorFormPage /> },
  { path: 'masters/vendors/:id', element: <VendorDetailPage /> },
  { path: 'masters/vendors/:id/edit', element: <VendorFormPage /> },

  { path: 'masters/payment-methods', element: <PaymentMethodListPage /> },
  { path: 'masters/payment-methods/new', element: <PaymentMethodFormPage /> },
  { path: 'masters/payment-methods/:id', element: <PaymentMethodDetailPage /> },
  { path: 'masters/payment-methods/:id/edit', element: <PaymentMethodFormPage /> },

  { path: 'masters/order-addresses', element: <OrderAddressListPage /> },
  { path: 'masters/order-addresses/new', element: <OrderAddressFormPage /> },
  { path: 'masters/order-addresses/:id', element: <OrderAddressDetailPage /> },
  { path: 'masters/order-addresses/:id/edit', element: <OrderAddressFormPage /> },

  { path: 'masters/bank-accounts', element: <BankAccountListPage /> },
  { path: 'masters/bank-accounts/new', element: <BankAccountFormPage /> },
  { path: 'masters/bank-accounts/:id', element: <BankAccountDetailPage /> },
  { path: 'masters/bank-accounts/:id/edit', element: <BankAccountFormPage /> },

  { path: 'masters/banks', element: <BankListPage /> },
  { path: 'masters/banks/new', element: <BankFormPage /> },
  { path: 'masters/banks/:id', element: <BankDetailPage /> },
  { path: 'masters/banks/:id/edit', element: <BankFormPage /> },

  { path: 'masters/code-series', element: <CodeSeriesListPage /> },
  { path: 'masters/code-series/new', element: <CodeSeriesFormPage /> },
  { path: 'masters/code-series/:id', element: <CodeSeriesDetailPage /> },
  { path: 'masters/code-series/:id/edit', element: <CodeSeriesFormPage /> },

  { path: 'masters/locations', element: <LocationListPage /> },
  { path: 'masters/locations/new', element: <LocationFormPage /> },
  { path: 'masters/locations/:id', element: <LocationDetailPage /> },
  { path: 'masters/locations/:id/edit', element: <LocationFormPage /> },

  { path: 'masters/warehouses', element: <WarehouseListPage /> },
  { path: 'masters/warehouses/new', element: <WarehouseFormPage /> },
  { path: 'masters/warehouses/:id', element: <WarehouseDetailPage /> },
  { path: 'masters/warehouses/:id/edit', element: <WarehouseFormPage /> },

  { path: 'masters/products', element: <ProductListPage /> },
  { path: 'masters/products/new', element: <ProductFormPage /> },
  { path: 'masters/products/:id', element: <ProductDetailPage /> },
  { path: 'masters/products/:id/edit', element: <ProductFormPage /> },

  { path: 'masters/bom', element: <BomListPage /> },
  { path: 'masters/bom/new', element: <BomFormPage /> },
  { path: 'masters/bom/:id/manage', element: <BomDetailPage /> },
  { path: 'masters/bom/:id', element: <Bom360LegacyRedirect /> },
  { path: 'masters/bom/:id/edit', element: <BomFormPage /> },

  { path: 'masters/work-centers', element: <WorkCenterListPage /> },
  { path: 'masters/work-centers/new', element: <WorkCenterFormPage /> },
  { path: 'masters/work-centers/:id', element: <WorkCenterDetailPage /> },
  { path: 'masters/work-centers/:id/edit', element: <WorkCenterFormPage /> },

  { path: 'masters/routing', element: <RoutingListPage /> },
  { path: 'masters/routing/new', element: <RoutingFormPage /> },
  { path: 'masters/routing/:id', element: <RoutingDetailPage /> },

  { path: 'masters/users', element: <UserMasterListPage /> },
  { path: 'masters/users/new', element: <UserMasterFormPage /> },
  { path: 'masters/users/:id/edit', element: <UserMasterFormPage /> },
  { path: 'masters/users/:id', element: <UserMasterDetailPage /> },
  { path: 'masters/product-interests', element: <ProductInterestMasterListPage /> },
  { path: 'masters/product-interests/new', element: <ProductInterestMasterFormPage /> },
  { path: 'masters/product-interests/:id/edit', element: <ProductInterestMasterFormPage /> },
  { path: 'masters/product-interests/:id', element: <ProductInterestMasterDetailPage /> },
]

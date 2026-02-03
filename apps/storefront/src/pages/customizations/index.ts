/**
 * Statlab B2B Portal Customizations
 *
 * This module serves as the central export point for all custom modifications
 * to the B2B Portal application in this forked repository.
 *
 * By keeping all customizations in this centralized module, it makes it easier to:
 * - Track what has been customized across all pages
 * - Share customizations between different components
 * - Merge upstream changes without conflicts
 * - Maintain and update custom code
 * - Document business-specific requirements
 *
 * @module pages/customizations
 */

export { useOrderCustomizations, getEpicorOrderId } from './useOrderCustomizations';
export type { OrderData, UseOrderCustomizationsProps, UseOrderCustomizationsReturn } from './types';

// Note: Order metafield API functions are exported separately to avoid circular dependencies
// Import directly from: import { getOrderMetafields, getEpicorOrderIdFromMetafields } from '@/pages/customizations/api/orderMetafields';

// Invoice helpers for parsing Epicor lot/pack slip data and fetching order addresses
export {
  parseEpicorLotPackSlip,
  fetchOrderAddresses,
  getBcOrderIdFromInvoice,
  createLotPackSlipLookup,
  type LotPackSlipItem,
  type OrderAddresses,
} from './invoiceHelpers';

// Export custom order queries
export {
  getB2BAllOrders,
  getB2BAllOrdersREST,
  getBCAllOrders,
  getOrderStatusType,
  getBcOrderStatusType,
  getOrdersCreatedByUser,
  getOrdersExtraFields,
  getOrdersExtraFieldsParallel,
  getOrdersExtraFieldsProgressive,
  type CustomerOrderNode,
  type CompanyOrderNode,
  type ExtraField,
} from './graphql/orders';

export { getCompaniesExtraFields } from './graphql/companies';

// Add more exports here as you create additional customizations
// Examples for other pages:
// export { useQuoteCustomizations } from './useQuoteCustomizations';
// export { useUserCustomizations } from './useUserCustomizations';
// export { useProductCustomizations } from './useProductCustomizations';
// export { customValidator } from './validators';
// export { customFormatter } from './formatters';
// export { CustomComponent } from './components/CustomComponent';

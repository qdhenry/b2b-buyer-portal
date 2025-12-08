/**
 * TypeScript type definitions for Statlab B2B Portal Customizations
 *
 * @module pages/customizations/types
 */

/**
 * Represents an extra field in the order data
 */
export interface ExtraField {
  fieldName: string;
  fieldValue: string;
}

/**
 * Represents order data structure with optional extraFields and extraInfo
 */
export interface OrderData {
  extraFields?: ExtraField[];
  extraInfo?: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: any;
}

/**
 * Props for the useOrderCustomizations hook
 */
export interface UseOrderCustomizationsProps {
  /**
   * The order data object containing extraFields (for detail view) or extraInfo (for list view) and other order information
   */
  order: OrderData | null;
}

/**
 * Return type for the useOrderCustomizations hook
 */
export interface UseOrderCustomizationsReturn {
  /**
   * The Epicor order ID extracted from extraFields or extraInfo
   * Falls back to empty string if not found
   */
  epicorOrderId: string;

  /**
   * Function to get the display order ID
   * Returns epicorOrderId if available, otherwise falls back to the provided orderId
   *
   * @param fallbackOrderId - The BigCommerce order ID to use as fallback
   * @returns The order ID to display to the user
   */
  getDisplayOrderId: (fallbackOrderId: string) => string;

  /**
   * Add more custom properties here as needed
   * Example:
   * customProperty?: string;
   * customMethod?: () => void;
   */
}

// REST API Response Types for Orders
export interface MoneyFormat {
  currencyLocation: string;
  currencyToken: string;
  decimalToken: string;
  decimalPlaces: number;
  thousandsToken: string;
}

export interface RESTOrderItem {
  id: number; // B2B internal ID
  bcOrderId: string; // BigCommerce order ID
  totalIncTax: number;
  poNumber: string | null;
  status: string;
  customStatus: string;
  cartId: string | null;
  items: number;
  usdIncTax: number;
  companyId: number;
  currencyCode: string;
  money: MoneyFormat;
  statusCode: number;
  isArchived: boolean;
  channelId: number;
  channelName: string;
  extraFields: ExtraField[]; // Already parsed array
  extraInfo: object | null; // Object (not string)
  createdAt: number;
  updatedAt: number;
}

export interface RESTOrdersPagination {
  totalCount: number;
  offset: number;
  limit: number;
}

export interface RESTOrdersResponse {
  code: number;
  data: RESTOrderItem[];
  meta: {
    pagination: RESTOrdersPagination;
    message: string;
  };
}

/**
 * Add more custom types here as you expand the customizations
 *
 * Order-related types:
 * export interface CustomOrderStatus {
 *   code: string;
 *   label: string;
 *   epicorStatus?: string;
 * }
 *
 * Quote-related types:
 * export interface UseQuoteCustomizationsReturn {
 *   epicorQuoteId: string;
 *   getDisplayQuoteId: (fallbackId: string) => string;
 * }
 *
 * User-related types:
 * export interface UseUserCustomizationsReturn {
 *   customUserFields: Record<string, string>;
 *   formatUserName: (user: any) => string;
 * }
 */

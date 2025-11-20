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
  epicoreOrderId: string;

  /**
   * Function to get the display order ID
   * Returns epicoreOrderId if available, otherwise falls back to the provided orderId
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

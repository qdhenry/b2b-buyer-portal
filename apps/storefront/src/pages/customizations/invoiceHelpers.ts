/**
 * Invoice Helper Functions for Statlab B2B Portal
 *
 * This module provides utility functions for parsing and handling
 * invoice-specific custom fields, particularly for Epicor integration.
 *
 * @module pages/customizations/invoiceHelpers
 */

import { Address } from '@/types/global';

import { getB2BOrderDetails, getBCOrderDetails } from '../../shared/service/b2b/graphql/orders';
import { ExtraField } from './types';

/**
 * Represents a single item from the epicorLotPackSlip extra field
 */
export interface LotPackSlipItem {
  sku: string;
  tracking_num: string;
  lot_num: string;
  pack_num: string;
  pack_line: string;
}

/**
 * Parses the epicorLotPackSlip JSON string from invoice extraFields
 *
 * The epicorLotPackSlip field contains a JSON array of lot/pack slip information
 * that maps SKUs to their corresponding lot numbers, pack slip numbers, and tracking numbers.
 *
 * @param extraFields - The extraFields array from the invoice data
 * @returns An array of LotPackSlipItem objects, or empty array if parsing fails
 *
 * @example
 * // Input extraFields:
 * // [{ fieldName: 'epicorLotPackSlip', fieldValue: '[{"sku":"CS-AFB/25","tracking_num":"","lot_num":"213","pack_num":"1842617","pack_line":"1"}]' }]
 * // Returns:
 * // [{ sku: 'CS-AFB/25', tracking_num: '', lot_num: '213', pack_num: '1842617', pack_line: '1' }]
 */
export const parseEpicorLotPackSlip = (extraFields?: ExtraField[]): LotPackSlipItem[] => {
  if (!extraFields) return [];

  const field = extraFields.find((f) => f.fieldName === 'epicorLotPackSlip');
  if (!field?.fieldValue) return [];

  try {
    const parsed = JSON.parse(field.fieldValue);
    // Validate that we got an array
    if (!Array.isArray(parsed)) return [];
    return parsed as LotPackSlipItem[];
  } catch {
    // Return empty array if JSON parsing fails
    return [];
  }
};

/**
 * Extracts the BigCommerce order ID from invoice extraFields.
 *
 * The bcOrderId is stored in extraFields, NOT in invoice.orderNumber (which is always null).
 * This is the correct way to get the linked order ID for fetching order details.
 *
 * @param extraFields - The extraFields array from the invoice data
 * @returns The BigCommerce order ID as a number, or null if not found/invalid
 *
 * @example
 * // Input extraFields:
 * // [{ fieldName: 'bcOrderId', fieldValue: '842' }, { fieldName: 'epicorOrderId', fieldValue: '1960274' }]
 * // Returns: 842
 */
export const getBcOrderIdFromInvoice = (extraFields?: ExtraField[]): number | null => {
  if (!extraFields) return null;

  const bcOrderIdField = extraFields.find((f) => f.fieldName === 'bcOrderId');
  if (!bcOrderIdField?.fieldValue) return null;

  const orderId = parseInt(bcOrderIdField.fieldValue, 10);
  return Number.isNaN(orderId) ? null : orderId;
};

/**
 * Represents the order addresses fetched for invoice PDF generation
 */
export interface OrderAddresses {
  billingAddress: Address | null;
  shippingAddress: Address | null;
}

/**
 * Fetches billing and shipping addresses from an order when invoice addresses are missing.
 *
 * This function is used to populate the "Sold To" and "Ship To" sections
 * in the invoice PDF when the invoice's details.header is empty.
 *
 * IMPORTANT: The order ID is extracted from extraFields.bcOrderId, NOT from invoice.orderNumber.
 * invoice.orderNumber is always null in Epicor-integrated invoices.
 *
 * @param extraFields - The extraFields array from the invoice containing bcOrderId
 * @param isB2BUser - Whether the current user is a B2B user
 * @returns Promise resolving to OrderAddresses with billing and shipping data
 *
 * @example
 * const { billingAddress, shippingAddress } = await fetchOrderAddresses(invoice.extraFields, true);
 * if (billingAddress) {
 *   // Use billingAddress.street_1, billingAddress.city, etc.
 * }
 */
/**
 * Creates a lookup map from epicorLotPackSlip data keyed by pack_line (1-indexed position).
 * This allows correct matching when the same SKU appears multiple times with different pack slips.
 *
 * @param extraFields - The extraFields array from the invoice
 * @returns Map keyed by pack_line number for O(1) lookup
 *
 * @example
 * // When line items have duplicate SKUs with different pack slips:
 * // pack_line: 3, sku: 'CS-PAS/25', pack_num: '1842617'
 * // pack_line: 4, sku: 'CS-PAS/25', pack_num: '994944'
 * // The lookup by pack_line (index + 1) returns the correct pack_num for each row
 */
export const createLotPackSlipLookup = (extraFields?: ExtraField[]): Map<number, LotPackSlipItem> => {
  const items = parseEpicorLotPackSlip(extraFields);
  const lookupByLine = new Map<number, LotPackSlipItem>();

  items.forEach((item) => {
    const lineNum = parseInt(item.pack_line, 10);
    if (!Number.isNaN(lineNum)) {
      lookupByLine.set(lineNum, item);
    }
  });

  return lookupByLine;
};

export const fetchOrderAddresses = async (
  extraFields: ExtraField[] | undefined,
  isB2BUser: boolean
): Promise<OrderAddresses> => {
  const orderId = getBcOrderIdFromInvoice(extraFields);

  if (!orderId) {
    return { billingAddress: null, shippingAddress: null };
  }

  try {
    const orderDetails = isB2BUser
      ? await getB2BOrderDetails(orderId)
      : await getBCOrderDetails(orderId);

    // shippingAddress can be an array or false
    let shippingAddr: Address | null = null;
    if (Array.isArray(orderDetails.shippingAddress) && orderDetails.shippingAddress.length > 0) {
      shippingAddr = orderDetails.shippingAddress[0] as Address;
    }

    return {
      billingAddress: orderDetails.billingAddress || null,
      shippingAddress: shippingAddr,
    };
  } catch (error) {
    console.warn('Failed to fetch order addresses for orderId:', orderId, error);
    return { billingAddress: null, shippingAddress: null };
  }
};

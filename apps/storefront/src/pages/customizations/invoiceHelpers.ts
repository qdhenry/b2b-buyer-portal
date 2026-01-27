/**
 * Invoice Helper Functions for Statlab B2B Portal
 *
 * This module provides utility functions for parsing and handling
 * invoice-specific custom fields, particularly for Epicor integration.
 *
 * @module pages/customizations/invoiceHelpers
 */

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

import { useEffect, useState } from 'react';

import { getEpicorOrderIdFromMetafields } from './api/orderMetafields';
import type {
  ExtraField,
  OrderData,
  UseOrderCustomizationsProps,
  UseOrderCustomizationsReturn,
} from './types';

/**
 * Custom hook for Statlab-specific order customizations
 *
 * This hook manages all custom modifications to order-related functionality
 * across the B2B Portal application. It can be used by OrderDetail, Orders list,
 * or any other component that needs customized order data.
 *
 * @module pages/customizations/useOrderCustomizations
 */

/**
 * Helper function to extract Epicor Order ID from order data.
 * Prioritizes checking `order.extraFields` (available on detail views) and
 * falls back to parsing `order.extraInfo` (a JSON string available on list views).
 *
 * Note: This is a synchronous lookup. For async metafield fallback, use the hook.
 *
 * @param order The order data object.
 * @returns The extracted Epicor Order ID, or an empty string if not found.
 */
export const getEpicorOrderId = (order: OrderData | null | undefined): string => {
  if (!order) return '';

  // Try extraFields (available in detail view)
  if (order.extraFields) {
    const epicoreField = order.extraFields.find(
      (field: ExtraField) => field.fieldName === 'epicorOrderId',
    );
    if (epicoreField?.fieldValue) return epicoreField.fieldValue;
  }

  // Fallback to extraInfo (available in list view as JSON string)
  if (order.extraInfo) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const extraFields = JSON.parse(order.extraInfo) as any[];
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const epicoreField = extraFields?.find((f: any) => f.fieldName === 'epicorOrderId');
      if (epicoreField?.fieldValue) return epicoreField.fieldValue;
    } catch (e) {
      // ignore json parse error
    }
  }

  return '';
};

/**
 * Hook to manage all Statlab-specific customizations for order details
 *
 * Lookup priority:
 * 1. order.extraFields array (synchronous) - key: epicorOrderId
 * 2. order.extraInfo JSON string (synchronous) - key: epicorOrderId
 * 3. BC Storefront GraphQL metafields (async) - namespace: bc.dms, key: epicoreOrderId
 *
 * @param props - Hook properties
 * @returns Customization data and helper functions
 *
 * @example
 * ```tsx
 * const { epicorOrderId, isLoading, getDisplayOrderId } = useOrderCustomizations({ order });
 * const displayId = isLoading ? 'Loading...' : getDisplayOrderId(orderId);
 * ```
 */
export const useOrderCustomizations = ({
  order,
}: UseOrderCustomizationsProps): UseOrderCustomizationsReturn => {
  const [epicorOrderId, setEpicorOrderId] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);

  // Extract epicorOrderId from order data when it changes
  useEffect(() => {
    const fetchEpicorOrderId = async () => {
      // First try synchronous sources (extraFields/extraInfo)
      const syncId = getEpicorOrderId(order);
      if (syncId) {
        setEpicorOrderId(syncId);
        return;
      }

      // Get BC order ID for metafield lookup
      // Note: Different views use different field names:
      // - Detail view: order.id
      // - List view: order.orderId or order.bcOrderId
      const bcOrderId = order?.id || order?.orderId || order?.bcOrderId;
      if (!bcOrderId) {
        setEpicorOrderId('');
        return;
      }

      // Convert to number for GraphQL query
      const orderIdNum = typeof bcOrderId === 'string' ? parseInt(bcOrderId, 10) : bcOrderId;
      if (Number.isNaN(orderIdNum)) {
        setEpicorOrderId('');
        return;
      }

      // Try metafields API as fallback
      setIsLoading(true);
      try {
        const metafieldId = await getEpicorOrderIdFromMetafields(orderIdNum);
        setEpicorOrderId(metafieldId);
      } catch {
        // Error already logged in getEpicorOrderIdFromMetafields
        setEpicorOrderId('');
      } finally {
        setIsLoading(false);
      }
    };

    fetchEpicorOrderId();
  }, [order]);

  /**
   * Get the order ID to display to users
   * Prioritizes epicorOrderId over the BigCommerce order ID
   */
  const getDisplayOrderId = (fallbackOrderId: string): string => {
    return epicorOrderId || fallbackOrderId;
  };

  // Add more custom functions here as needed
  // Example:
  // const customFunction = () => { ... };

  return {
    epicorOrderId,
    isLoading,
    getDisplayOrderId,
    // Add more return values here as needed
  };
};

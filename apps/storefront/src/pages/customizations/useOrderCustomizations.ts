import { useEffect, useState } from 'react';

import type { OrderData, UseOrderCustomizationsProps, UseOrderCustomizationsReturn } from './types';

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
 * Helper function to extract Epicor Order ID from order data
 * Parses extraInfo JSON to find the epicoreOrderId.
 */
export const getEpicorOrderId = (order: OrderData | null | undefined): string => {
  if (!order) return '';

  // Try extraInfo
  if (order.extraInfo) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const extraFields = JSON.parse(order.extraInfo) as any[];
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const epicoreField = extraFields?.find((f: any) => f.fieldName === 'epicoreOrderId');
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
 * @param props - Hook properties
 * @returns Customization data and helper functions
 *
 * @example
 * ```tsx
 * const { epicoreOrderId, getDisplayOrderId } = useOrderCustomizations({ order });
 * const displayId = getDisplayOrderId(orderId);
 * ```
 */
export const useOrderCustomizations = ({
  order,
}: UseOrderCustomizationsProps): UseOrderCustomizationsReturn => {
  const [epicoreOrderId, setEpicoreOrderId] = useState<string>('');

  // Extract epicoreOrderId from extraInfo when order data changes
  useEffect(() => {
    const id = getEpicorOrderId(order);
    setEpicoreOrderId(id);
  }, [order]);

  /**
   * Get the order ID to display to users
   * Prioritizes epicoreOrderId over the BigCommerce order ID
   */
  const getDisplayOrderId = (fallbackOrderId: string): string => {
    return epicoreOrderId || fallbackOrderId;
  };

  // Add more custom functions here as needed
  // Example:
  // const customFunction = () => { ... };

  return {
    epicoreOrderId,
    getDisplayOrderId,
    // Add more return values here as needed
  };
};

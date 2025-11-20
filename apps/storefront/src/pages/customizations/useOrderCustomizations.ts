import { useEffect, useState } from 'react';

import type {
  ExtraField,
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

  // Extract epicoreOrderId from extraFields when order data changes
  useEffect(() => {
    if (order?.extraFields) {
      const epicoreField = order.extraFields.find(
        (field: ExtraField) => field.fieldName === 'epicoreOrderId'
      );

      if (epicoreField?.fieldValue) {
        setEpicoreOrderId(epicoreField.fieldValue);
      } else {
        setEpicoreOrderId('');
      }
    } else {
      setEpicoreOrderId('');
    }
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

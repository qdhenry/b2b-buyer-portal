import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';

import { getEpicorOrderId } from '../../customizations';
import {
  getAllOrdersWithExtraFields,
  type CompanyOrderNode,
} from '../../customizations/graphql/orders';

/**
 * Custom hook for searching orders by Epicor Order ID.
 *
 * Fetches all orders for a company with extraFields and caches them for 30 minutes.
 * Filters results client-side by epicorOrderId.
 *
 * @param companyId - The company ID to fetch orders for
 * @param epicorSearchTerm - The Epicor ID search term (only fetches when set)
 * @returns Loading state, progress, and filtered results
 *
 * @example
 * ```tsx
 * const {
 *   isLoadingAllOrders,
 *   loadingProgress,
 *   epicorFilteredResults
 * } = useEpicorOrderSearch(companyId, 'EP-1001');
 * ```
 */
export const useEpicorOrderSearch = (companyId: number, epicorSearchTerm: string) => {
  const [loadingProgress, setLoadingProgress] = useState({ fetched: 0, total: 0 });

  // Only fetch when epicorSearchTerm is provided
  const enabled = Boolean(epicorSearchTerm && epicorSearchTerm.trim());

  const {
    data: allOrdersData,
    isLoading: isLoadingAllOrders,
    error,
  } = useQuery({
    queryKey: ['allOrders', companyId],
    enabled,
    staleTime: 30 * 60 * 1000, // 30 minutes
    queryFn: async () => {
      const result = await getAllOrdersWithExtraFields(
        companyId,
        undefined,
        (fetched, total) => {
          setLoadingProgress({ fetched, total });
        },
      );
      return result;
    },
  });

  // Reset progress when query is disabled
  useEffect(() => {
    if (!enabled) {
      setLoadingProgress({ fetched: 0, total: 0 });
    }
  }, [enabled]);

  // Filter orders client-side by epicorOrderId
  const epicorFilteredResults: CompanyOrderNode[] =
    allOrdersData && epicorSearchTerm
      ? allOrdersData.edges.filter((orderNode) => {
          const order = {
            ...orderNode.node,
            extraFields: allOrdersData.extraFieldsMap[orderNode.node.orderId || ''],
          };

          const epicorId = getEpicorOrderId(order);

          // Case-insensitive partial match
          return epicorId.toLowerCase().includes(epicorSearchTerm.toLowerCase());
        })
      : [];

  return {
    isLoadingAllOrders,
    loadingProgress,
    epicorFilteredResults,
    totalOrdersCount: allOrdersData?.totalCount || 0,
    extraFieldsMap: allOrdersData?.extraFieldsMap || {},
    error,
  };
};

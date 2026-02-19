import B3Request from '@/shared/service/request/b3Fetch';
import b2bLogger from '@/utils/b3Logger';

interface MetafieldNode {
  key: string;
  value: string;
}

interface MetafieldEdge {
  node: MetafieldNode;
}

interface OrderMetafieldsResponse {
  data: {
    site: {
      order: {
        metafields: {
          edges: MetafieldEdge[];
        };
      } | null;
    };
  };
}

const ORDER_METAFIELDS_QUERY = `
  query OrderMetafields($orderId: Int!, $namespace: String!) {
    site {
      order(filter: {entityId: $orderId}) {
        metafields(namespace: $namespace) {
          edges {
            node {
              key
              value
            }
          }
        }
      }
    }
  }
`;

/**
 * Fetches metafields for an order using BC Storefront GraphQL API.
 * Uses graphqlBC which authenticates with bcGraphqlToken for storefront access.
 *
 * @param orderId - BigCommerce order ID
 * @param namespace - Metafield namespace to filter by
 * @returns Array of metafield key-value pairs
 */
export const getOrderMetafields = async (
  orderId: number,
  namespace: string,
): Promise<MetafieldNode[]> => {
  try {
    const response = await B3Request.graphqlBC<OrderMetafieldsResponse>({
      query: ORDER_METAFIELDS_QUERY,
      variables: { orderId, namespace },
    });

    const edges = response?.data?.site?.order?.metafields?.edges || [];
    return edges.map((edge) => edge.node);
  } catch (error) {
    b2bLogger.error('Failed to fetch order metafields:', error);
    return [];
  }
};

/**
 * Fetches the Epicor Order ID from BC order metafields.
 * Looks in namespace 'bc.dms' for key 'epicoreOrderId'.
 *
 * @param orderId - BigCommerce order ID
 * @returns The Epicor order ID, or empty string if not found
 */
export const getEpicorOrderIdFromMetafields = async (orderId: number): Promise<string> => {
  const metafields = await getOrderMetafields(orderId, 'bc.dms');
  const epicorField = metafields.find((m) => m.key === 'epicoreOrderId');
  return epicorField?.value || '';
};

/**
 * Batch fetches Epicor Order IDs from BC metafields for multiple orders.
 * Fires all requests in parallel and calls onProgress as each completes.
 *
 * @param orderIds - Array of BigCommerce order IDs
 * @param onProgress - Callback called with accumulated results as each order loads
 * @returns Promise resolving to map of orderId -> epicorOrderId
 */
export const getEpicorOrderIdsFromMetafieldsProgressive = (
  orderIds: (string | number)[],
  onProgress: (accumulated: Record<string, string>) => void,
): Promise<Record<string, string>> => {
  if (!orderIds.length) {
    onProgress({});
    return Promise.resolve({});
  }

  const accumulated: Record<string, string> = {};

  const promises = orderIds.map(async (id) => {
    const orderIdNum = typeof id === 'string' ? parseInt(id, 10) : id;
    if (Number.isNaN(orderIdNum)) {
      accumulated[String(id)] = '';
      onProgress({ ...accumulated });
      return;
    }

    try {
      const epicorId = await getEpicorOrderIdFromMetafields(orderIdNum);
      accumulated[String(id)] = epicorId;
      onProgress({ ...accumulated });
    } catch (error) {
      b2bLogger.error(`Failed to fetch metafield for order ${id}:`, error);
      accumulated[String(id)] = '';
      onProgress({ ...accumulated });
    }
  });

  return Promise.all(promises).then(() => accumulated);
};

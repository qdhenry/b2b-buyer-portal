import B3Request from '@/shared/service/request/b3Fetch';
import { OrderStatusItem } from '@/types';
import { convertArrayToGraphql } from '@/utils';
import b2bLogger from '@/utils/b3Logger';

export type ExtraField = {
  fieldName: string;
  fieldValue: string;
};

export type CustomerOrderNode = {
  node: {
    orderId?: string;
    createdAt: number;
    totalIncTax?: number;
    money?: string;
    poNumber?: string;
    status: string;
    companyName?: string;
    firstName?: string;
    lastName?: string;
    extraInfo?: string;
  };
};

export interface GetCustomerOrders {
  data: {
    customerOrders: {
      totalCount: number;
      edges: Array<CustomerOrderNode>;
    };
  };
}

export type CompanyOrderNode = {
  node: {
    orderId?: string;
    createdAt: number;
    totalIncTax?: number;
    money?: string;
    poNumber?: string;
    status: string;
    firstName?: string;
    lastName?: string;
    companyInfo?: {
      companyName: string;
    };
    extraInfo?: string;
  };
};

export interface GetCompanyOrders {
  data: {
    allOrders: {
      totalCount: number;
      edges: Array<CustomerOrderNode>;
    };
  };
}

// STATLAB CUSTOMIZATION: Added extraFields to query
const allOrders = (data: CustomFieldItems, fn: 'allOrders' | 'customerOrders') => `
query ${fn === 'allOrders' ? 'GetAllOrders' : 'GetCustomerOrders'} {
  ${fn}(
    search: "${data.q || ''}"
    status: "${data?.statusCode || ''}"
    first: ${data.first}
    offset: ${data.offset}
    beginDateAt: ${data?.beginDateAt ? JSON.stringify(data.beginDateAt) : null}
    endDateAt: ${data?.endDateAt ? JSON.stringify(data.endDateAt) : null}
    companyName: "${data?.companyName || ''}"
    createdBy: "${data?.createdBy || ''}"
    isShowMy: "${data?.isShowMy || 0}"
    orderBy: "${data.orderBy}"
    email: "${data?.email || ''}"
    ${data?.companyIds ? `companyIds: ${convertArrayToGraphql(data.companyIds || [])}` : ''}
  ){
    totalCount,
    edges{
      node {
        orderId,
        createdAt,
        totalIncTax,
        money,
        poNumber,
        status,
        firstName,
        lastName,
        companyInfo {
          companyName,
        }
        extraInfo
      }
    }
  }
}`;

export interface OrderStatus {
  systemLabel: string;
  customLabel: string;
  statusCode: string;
}

export interface CustomerOrderStatues {
  data: {
    bcOrderStatuses: OrderStatus[];
  };
}

export interface CompanyOrderStatuses {
  data: {
    orderStatuses: OrderStatus[];
  };
}

const getOrderStatusTypeQl = (fn: 'orderStatuses' | 'bcOrderStatuses') => `
query ${fn === 'orderStatuses' ? 'GetOrderStatuses' : 'GetCustomerOrderStatuses'} {
  ${fn} {
    systemLabel,
    customLabel,
    statusCode,
  }
}`;

const getCreatedByUser = (companyId: number) => `
  query GetOrdersCreatedByUser {
    createdByUser (
      companyId: ${companyId},
      module: 0,
    ){
      results,
    }
  }
`;

export const getB2BAllOrders = (data: CustomFieldItems) =>
  B3Request.graphqlB2B({
    query: allOrders(data, 'allOrders'),
  }).then((res) => res.allOrders);

export const getBCAllOrders = (data: CustomFieldItems) =>
  B3Request.graphqlB2B({
    query: allOrders(data, 'customerOrders'),
  }).then((res) => res.customerOrders);

export const getOrderStatusType = (): Promise<OrderStatusItem[]> =>
  B3Request.graphqlB2B({
    query: getOrderStatusTypeQl('orderStatuses'),
  }).then((res) => res.orderStatuses);

export const getBcOrderStatusType = (): Promise<OrderStatusItem[]> =>
  B3Request.graphqlB2B({
    query: getOrderStatusTypeQl('bcOrderStatuses'),
  }).then((res) => res.bcOrderStatuses);

export const getOrdersCreatedByUser = (companyId: number) =>
  B3Request.graphqlB2B({
    query: getCreatedByUser(companyId),
  });

// B2B API has a hard limit of 10 items per batch query
const EXTRA_FIELDS_BATCH_SIZE = 10;

/**
 * Splits an array into chunks of the specified size.
 */
function chunkArray<T>(array: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size));
  }
  return chunks;
}

/**
 * Fetches extra fields for a list of order IDs by batching them into GraphQL queries.
 * Uses aliases to fetch multiple orders per request, with chunking to respect API limits.
 *
 * @param ids Array of order IDs (strings or numbers)
 * @param isB2BUser Boolean indicating if the user is a B2B user (affects query field name)
 * @returns Promise resolving to a map of orderId -> ExtraField[]
 */
export const getOrdersExtraFields = async (
  ids: (string | number)[],
  isB2BUser: boolean,
): Promise<Record<string, ExtraField[]>> => {
  if (!ids.length) return {};

  const queryField = isB2BUser ? 'order' : 'customerOrder';
  const operationName = isB2BUser ? 'GetOrdersDetails' : 'GetCustomerOrdersDetails';

  // Chunk IDs to respect API limit of 10 items per query
  const chunks = chunkArray(ids, EXTRA_FIELDS_BATCH_SIZE);

  // Execute all chunk queries in parallel
  const chunkPromises = chunks.map(async (chunkIds, chunkIndex) => {
    const queryParts = chunkIds.map((id) => {
      const safeId = String(id).replace(/[^a-zA-Z0-9]/g, '_');
      return `
        order_${safeId}: ${queryField}(id: ${id}) {
          id
          extraFields
        }
      `;
    });

    const query = `
      query ${operationName}_${chunkIndex} {
        ${queryParts.join('\n')}
      }
    `;

    return B3Request.graphqlB2B({ query });
  });

  try {
    const responses = await Promise.all(chunkPromises);

    // Merge all responses into single result
    const result: Record<string, ExtraField[]> = {};

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    responses.forEach((response: any) => {
      Object.keys(response).forEach((alias) => {
        const orderData = response[alias];
        // The id returned in orderData might be an integer or string, but our map keys are strings (original IDs)
        // We use the alias to map back to the original ID since we know the order
        const originalId = alias.replace('order_', '');
        if (orderData?.extraFields) {
          result[originalId] = orderData.extraFields;
        }
      });
    });

    return result;
  } catch (error) {
    b2bLogger.error('Failed to fetch extra fields for orders:', error);
    return {};
  }
};

// Company info types for REST API
export interface CompanyInfo {
  companyId: number;
  companyName: string;
}

// Cache for company names to avoid redundant API calls
const companyCache = new Map<number, string>();

/**
 * Fetches a single company's information by ID.
 * Results are cached to avoid redundant API calls.
 */
export const getCompanyInfo = async (companyId: number): Promise<CompanyInfo | null> => {
  // Check cache first
  if (companyCache.has(companyId)) {
    return { companyId, companyName: companyCache.get(companyId)! };
  }

  try {
    const response = await B3Request.get(`/api/v2/companies/${companyId}`, 'B2BRest');

    const companyName = response?.companyName || '';
    companyCache.set(companyId, companyName);
    return { companyId, companyName };
  } catch (error) {
    b2bLogger.error(`Failed to fetch company ${companyId}:`, error);
    return null;
  }
};

/**
 * Batch fetches multiple company names in parallel.
 * Uses caching and deduplication for efficiency.
 */
export const getCompaniesInfo = async (companyIds: number[]): Promise<Map<number, string>> => {
  const uniqueIds = Array.from(new Set(companyIds));
  const uncachedIds = uniqueIds.filter((id) => !companyCache.has(id));

  // Fetch uncached companies in parallel
  if (uncachedIds.length > 0) {
    await Promise.all(uncachedIds.map((id) => getCompanyInfo(id)));
  }

  // Return map of all requested companies
  const result = new Map<number, string>();
  uniqueIds.forEach((id) => {
    result.set(id, companyCache.get(id) || '');
  });
  return result;
};

/**
 * Clears the company cache. Useful for testing or when company data may have changed.
 */
export const clearCompanyCache = (): void => {
  companyCache.clear();
};

// REST API Response Types - based on actual API response
interface RESTOrderItem {
  orderId: number; // BigCommerce order ID
  companyName: string; // Already included - no separate fetch needed!
  createdAt: string; // Unix timestamp as string
  updatedAt: string;
  isInvoiceOrder: number;
  orderStatus: string; // e.g., "Awaiting Fulfillment"
  customOrderStatus: string;
  statusCode: number;
  totalIncTax: number;
  currencyCode: string;
  money: {
    currency_location: string; // snake_case
    currency_token: string;
    decimal_token: string;
    decimal_places: number;
    thousands_token: string;
  };
  firstName: string;
  lastName: string;
  poNumber: string;
  referenceNumber: string;
  channelName: string;
  extraInt1: number | null;
  extraInt2: number | null;
  extraInt3: number | null;
  extraInt4: number | null;
  extraInt5: number | null;
  extraStr1: string | null;
  extraStr2: string | null;
  extraStr3: string | null;
  extraStr4: string | null;
  extraStr5: string | null;
  extraText: string | null;
  extraInfo: {
    addressExtraFields?: {
      billingAddressExtraFields?: ExtraField[];
      shippingAddressExtraFields?: ExtraField[];
    };
  } | null;
  extraFields: ExtraField[];
}

interface RESTOrdersResponseData {
  list: RESTOrderItem[];
  paginator: {
    totalCount: number;
    offset: number;
    limit: number;
  };
}

interface RESTOrdersResponse {
  code: number;
  data: RESTOrdersResponseData;
  message: string;
}

/**
 * Maps GraphQL orderBy values to REST API orderBy format.
 * REST API only accepts 'ASC' or 'DESC' (defaults to DESC).
 * Prefix '-' in GraphQL means descending order.
 */
const mapOrderByToREST = (graphqlOrderBy: string): string => {
  // GraphQL uses '-fieldName' for descending, 'fieldName' for ascending
  return graphqlOrderBy.startsWith('-') ? 'DESC' : 'ASC';
};

/**
 * Fetches B2B orders using the REST API with showExtra=true.
 * This is more efficient than GraphQL as it returns extraFields in a single call.
 * Company names are already included in the response - no separate fetch needed!
 *
 * @param data - Filter and pagination parameters
 * @returns Orders in GraphQL-like structure plus extraFieldsMap
 */
export const getB2BAllOrdersREST = async (
  data: CustomFieldItems,
): Promise<{
  edges: CompanyOrderNode[];
  totalCount: number;
  extraFieldsMap: Record<string, ExtraField[]>;
}> => {
  // Build query parameters
  const params: Record<string, string | number | boolean> = {
    limit: data.first,
    offset: data.offset,
    showExtra: true,
  };

  // Map orderBy to REST API format (only ASC or DESC allowed)
  if (data.orderBy) {
    params.sort = mapOrderByToREST(data.orderBy);
  }

  // Add optional filters only if they have values
  if (data.q) params.search = data.q;
  if (data.statusCode) params.status = data.statusCode;
  if (data.beginDateAt) params.beginDateAt = data.beginDateAt;
  if (data.endDateAt) params.endDateAt = data.endDateAt;
  if (data.companyName) params.companyName = data.companyName;
  if (data.createdBy) params.createdBy = data.createdBy;
  if (data.email) params.email = data.email;
  if (data.isShowMy) params.isShowMy = data.isShowMy;
  if (data.companyIds?.length) params.companyIds = data.companyIds.join(',');

  try {
    const response: RESTOrdersResponse = await B3Request.get('/api/v2/orders', 'B2BRest', params);

    // Defensive check for response structure
    if (!response?.data?.list) {
      b2bLogger.error('Unexpected REST API response structure:', response);
      return {
        edges: [],
        totalCount: 0,
        extraFieldsMap: {},
      };
    }

    // Build extraFieldsMap from response
    const extraFieldsMap: Record<string, ExtraField[]> = {};

    // Map REST response to GraphQL-like structure
    // Note: companyName is already in the response - no separate fetch needed!
    const edges: CompanyOrderNode[] = response.data.list.map((order) => {
      const orderIdStr = String(order.orderId);

      // Store extraFields in the map using orderId as key
      extraFieldsMap[orderIdStr] = order.extraFields || [];

      // Keep snake_case format - ordersCurrencyFormat expects snake_case properties
      const moneyFormatted = {
        currency_location: order.money.currency_location,
        currency_token: order.money.currency_token,
        decimal_token: order.money.decimal_token,
        decimal_places: order.money.decimal_places,
        thousands_token: order.money.thousands_token,
      };

      return {
        node: {
          orderId: orderIdStr,
          createdAt: Number(order.createdAt),
          totalIncTax: order.totalIncTax,
          money: JSON.stringify(moneyFormatted),
          poNumber: order.poNumber || undefined,
          status: order.orderStatus,
          firstName: order.firstName,
          lastName: order.lastName,
          companyInfo: {
            companyName: order.companyName,
          },
          extraInfo: JSON.stringify(order.extraFields),
        },
      };
    });

    return {
      edges,
      totalCount: response.data.paginator.totalCount,
      extraFieldsMap,
    };
  } catch (error) {
    b2bLogger.error('Failed to fetch orders via REST API:', error);
    // Return empty result on error
    return {
      edges: [],
      totalCount: 0,
      extraFieldsMap: {},
    };
  }
};

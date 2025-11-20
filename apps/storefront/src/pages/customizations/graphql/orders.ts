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

/**
 * Fetches extra fields for a list of order IDs by batching them into a single GraphQL query.
 * Uses aliases to fetch multiple orders in one request.
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

  // Sanitize IDs and ensure uniqueness
  const uniqueIds = [...new Set(ids)].filter((id) => id);
  if (!uniqueIds.length) return {};

  // Determine query field name based on user type
  const queryField = isB2BUser ? 'order' : 'customerOrder';
  const operationName = isB2BUser ? 'GetOrdersDetails' : 'GetCustomerOrdersDetails';

  // Construct batched query using aliases
  // Example: order_123: order(id: 123) { orderId, extraFields { fieldName, fieldValue } }
  const queryParts = uniqueIds.map((id) => {
    // Ensure ID is safe for alias (remove non-alphanumeric if any, though usually IDs are safe)
    const safeId = String(id).replace(/[^a-zA-Z0-9]/g, '_');
    return `
      order_${safeId}: ${queryField}(id: ${id}) {
        orderId
        extraFields {
          fieldName
          fieldValue
        }
      }
    `;
  });

  const query = `
    query ${operationName} {
      ${queryParts.join('\n')}
    }
  `;

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const response: any = await B3Request.graphqlB2B({ query });

    const result: Record<string, ExtraField[]> = {};

    // Parse response and map back to IDs
    Object.keys(response).forEach((alias) => {
      const orderData = response[alias];
      if (orderData && orderData.orderId && orderData.extraFields) {
        result[orderData.orderId] = orderData.extraFields;
      }
    });

    return result;
  } catch (error) {
    b2bLogger.error(error);
    return {};
  }
};

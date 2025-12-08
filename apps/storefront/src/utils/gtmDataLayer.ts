import type { AppStore, RootState } from '@/store';
import { getActiveCurrencyInfo } from '@/utils/currencyUtils';
import b2bLogger from '@/utils/b3Logger';

// Import deprecated store as fallback
// eslint-disable-next-line import/no-deprecated
import { store as deprecatedStore } from '@/store';

export interface GTMProductItem {
  node: {
    productId?: number | string;
    productName?: string;
    variantSku?: string;
    variantId?: number;
    quantity?: number | string;
    basePrice?: number | string;
    optionList?: string;
    primaryImage?: string;
    productsSearch?: any;
    [key: string]: any; // Allow additional properties
  };
}

export interface GTMEcommerceItem {
  discount: number;
  item_name: string;
  item_id: string;
  affiliation: string;
  quantity: number;
  price: number;
  item_category?: string;
  item_category2?: string;
  item_category3?: string;
  item_category4?: string;
  item_category5?: string;
  brand: string;
  variant: string;
  variant_color: string;
  product_rating_score: string;
  product_review_quantity: string;
  item_list_name?: string;
  item_list_id?: string;
}

export interface GTMEcommerceData {
  currency: string;
  value: number;
  items: GTMEcommerceItem[];
}

export interface GTMUserDetails {
  account_id: string;
  user_id: string;
}

export interface GTMDataLayerEvent {
  ecommerce: GTMEcommerceData;
  user_details: GTMUserDetails;
}

/**
 * Get user details from Redux store for GTM dataLayer
 * @param storeInstance - Optional store instance (uses deprecated store as fallback)
 */
export const getGTMUserDetails = (storeInstance?: AppStore): GTMUserDetails => {
  try {
    const currentStore = storeInstance || deprecatedStore;
    const state = currentStore.getState() as RootState;
    const { companyInfo, customer } = state.company;

    const accountId = String(companyInfo.id || '');
    const userId = String(customer.id || '');

    // Cache user details in localStorage
    if (accountId && localStorage.getItem('accountId') !== accountId) {
      localStorage.setItem('accountId', accountId);
    }
    if (userId && localStorage.getItem('userId') !== userId) {
      localStorage.setItem('userId', userId);
    }

    return {
      account_id: accountId,
      user_id: userId,
    };
  } catch (error) {
    b2bLogger.error('Failed to get GTM user details:', error);
    return {
      account_id: '',
      user_id: '',
    };
  }
};

/**
 * Get BigCommerce GraphQL endpoint
 * @returns GraphQL API endpoint URL
 */
const getGraphQLEndpoint = (): string => {
  return '/graphql';
};

/**
 * Fetches product categories from BigCommerce GraphQL API
 * @param productIds - Product entity IDs (single ID or array)
 * @param graphQLToken - Optional GraphQL token override
 * @returns Map of productId -> category info or single result
 */
export async function fetchProductCategories(
  productIds: string | number | Array<string | number>,
  graphQLToken?: string,
): Promise<Record<number, any> | any> {
  const ids = (Array.isArray(productIds) ? productIds : [productIds])
    .map((id) => parseInt(String(id), 10))
    .filter((id) => Number.isInteger(id));

  const token =
    graphQLToken ||
    (typeof window !== 'undefined' && (window as any)?.stencilContext?.graphQLToken) ||
    '';

  if (!token || !ids.length) {
    b2bLogger.error('[GA4] Cannot fetch product categories without GraphQL token or product IDs.');
    return Array.isArray(productIds) ? {} : null;
  }

  const query = `
    query ProductCats($ids:[Int!]) {
      site {
        products(entityIds:$ids) {
          edges {
            node {
              entityId
              categories {
                edges { 
                  node { 
                    entityId 
                    name 
                    path
                    breadcrumbs(depth: 5) {
                      edges {
                        node {
                          entityId
                          name
                        }
                      }
                    }
                  } 
                }
              }
            }
          }
        }
      }
    }
  `;

  try {
    const res = await fetch(getGraphQLEndpoint(), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ query, variables: { ids } }),
      credentials: 'same-origin',
    });

    const json = await res.json();
    const result: Record<number, any> = {};

    (json?.data?.site?.products?.edges || []).forEach((edge: any) => {
      const productId = edge.node.entityId;
      const categories = edge.node.categories?.edges || [];

      if (categories.length > 0) {
        const primaryCategory = categories[0].node;
        const breadcrumbs = (primaryCategory.breadcrumbs?.edges || []).map((b: any) => b.node);
        const breadcrumbNames = breadcrumbs.map((b: any) => b.name);
        const lastBreadcrumb = breadcrumbNames[breadcrumbNames.length - 1];

        const fullPath =
          lastBreadcrumb === primaryCategory.name
            ? breadcrumbNames
            : [...breadcrumbNames, primaryCategory.name];

        const categoryFields: Record<string, string> = {};
        for (let i = 0; i < fullPath.length && i < 5; i++) {
          const key = i === 0 ? 'item_category' : `item_category${i + 1}`;
          categoryFields[key] = fullPath[i].trim();
        }

        result[productId] = {
          entityId: primaryCategory.entityId,
          name: primaryCategory.name,
          path: primaryCategory.path,
          breadcrumbs,
          fullPath,
          categoryFields,
        };
      } else {
        result[productId] = null;
      }
    });

    if (!Array.isArray(productIds)) {
      return result[parseInt(String(productIds), 10)] || null;
    }

    return result;
  } catch (error) {
    b2bLogger.error('Failed to fetch product categories from BigCommerce:', error);
    return Array.isArray(productIds) ? {} : null;
  }
}

/**
 * Generate GTM ecommerce data for products
 * @param products - Array of product items to be tracked
 * @param listName - Optional name of the product list (e.g., "Shopping List", "Quick Order")
 * @param listId - Optional ID of the product list
 * @param storeInstance - Optional store instance (uses deprecated store as fallback)
 * @returns Promise with ecommerce data object
 */
export const generateGTMEcommerceData = async (
  products: GTMProductItem[],
  listName?: string,
  listId?: string,
  storeInstance?: AppStore,
): Promise<GTMDataLayerEvent | null> => {
  try {
    const { currency_code: currencyCode } = getActiveCurrencyInfo();
    const userDetails = getGTMUserDetails(storeInstance);

    // Extract product IDs for fetching categories from BigCommerce
    const productIds = products
      .map((item) => item.node.productId)
      .filter((id): id is string | number => Boolean(id));

    // Fetch categories from BigCommerce GraphQL
    const productCategories = await fetchProductCategories(productIds);

    // Calculate total value
    const totalValue = products.reduce((sum, item) => {
      const price = Number(item.node.basePrice) || 0;
      const quantity = Number(item.node.quantity) || 1;
      return sum + price * quantity;
    }, 0);

    // Map products to GTM items format
    const items: GTMEcommerceItem[] = products.map((item) => {
      const { node } = item;
      const productId = parseInt(String(node.productId || 0), 10);
      const productName = node.productName || '';

      // Get category fields from BigCommerce
      const categoryInfo = productCategories?.[productId];
      const categoryObj = categoryInfo?.categoryFields || {};

      const gtmItem: GTMEcommerceItem = {
        item_name: productName,
        item_id: String(productId),
        affiliation: 'Statlab',
        quantity: Number(node.quantity) || 1,
        price: Number(node.basePrice) || 0,
        ...categoryObj,
        brand: '',
        variant: node.variantSku || '',
        variant_color: '',
        product_rating_score: '',
        product_review_quantity: '',
        discount: Number(node.discount) || 0,
      };

      // Add list info if provided
      if (listName) {
        gtmItem.item_list_name = listName;
      }
      if (listId) {
        gtmItem.item_list_id = String(listId);
      }

      return gtmItem;
    });

    return {
      ecommerce: {
        currency: currencyCode,
        value: Number(totalValue.toFixed(2)),
        items,
      },
      user_details: userDetails,
    };
  } catch (error) {
    b2bLogger.error('Failed to generate GTM ecommerce data:', error);
    return null;
  }
};

/**
 * Push an event to GTM dataLayer
 * @param eventName - Name of the GTM event (e.g., "add_to_cart", "remove_from_cart")
 * @param data - Event data including ecommerce and user_details
 */
export const pushGTMEvent = (eventName: string, data: GTMDataLayerEvent) => {
  try {
    if (window.dataLayer) {
      // Clear previous ecommerce object
      window.dataLayer.push({ ecommerce: null });

      // Push new event
      window.dataLayer.push({
        event: eventName,
        ...data,
      });
    }
  } catch (error) {
    b2bLogger.error(`Failed to push ${eventName} event to dataLayer:`, error);
  }
};

/**
 * Complete flow: Generate ecommerce data and push to dataLayer
 * @param eventName - Name of the GTM event
 * @param products - Array of product items
 * @param listName - Optional list name
 * @param listId - Optional list ID
 * @param storeInstance - Optional store instance (uses deprecated store as fallback)
 */
export const trackEcommerceEvent = async (
  eventName: string,
  products: GTMProductItem[],
  listName?: string,
  listId?: string,
  storeInstance?: AppStore,
): Promise<void> => {
  const data = await generateGTMEcommerceData(products, listName, listId, storeInstance);

  if (data) {
    pushGTMEvent(eventName, data);
  }
};

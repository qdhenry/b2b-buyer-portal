/* eslint-disable no-plusplus */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { vi } from 'vitest';

import B3Request from '@/shared/service/request/b3Fetch';

import {
  clearCompanyCache,
  getB2BAllOrders,
  getB2BAllOrdersREST,
  getBCAllOrders,
  getBcOrderStatusType,
  getCompaniesInfo,
  getCompanyInfo,
  getOrdersCreatedByUser,
  getOrdersExtraFields,
  getOrderStatusType,
} from './orders';

// Mock B3Request
vi.mock('@/shared/service/request/b3Fetch', () => ({
  default: {
    graphqlB2B: vi.fn(),
    get: vi.fn(),
  },
}));

describe('graphql/orders', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('getOrdersExtraFields', () => {
    it('returns empty object if ids array is empty', async () => {
      const result = await getOrdersExtraFields([], true);
      expect(result).toEqual({});
      expect(B3Request.graphqlB2B).not.toHaveBeenCalled();
    });

    it('fetches extra fields for B2B user', async () => {
      const mockResponse = {
        order_100: { id: '100', extraFields: [{ fieldName: 'test', fieldValue: 'val' }] },
        order_101: { id: '101', extraFields: [] },
      };
      (B3Request.graphqlB2B as any).mockResolvedValue(mockResponse);

      const ids = ['100', 101];
      const result = await getOrdersExtraFields(ids, true);

      expect(B3Request.graphqlB2B).toHaveBeenCalledWith({
        query: expect.stringContaining('query GetOrdersDetails_0'),
      });
      // Check alias construction
      const queryArg = (B3Request.graphqlB2B as any).mock.calls[0][0].query;
      expect(queryArg).toContain('order_100: order(id: 100)');
      expect(queryArg).toContain('order_101: order(id: 101)');

      expect(result).toEqual({
        '100': [{ fieldName: 'test', fieldValue: 'val' }],
        '101': [],
      });
    });

    it('fetches extra fields for B2C user', async () => {
      const mockResponse = {
        order_200: { id: '200', extraFields: [{ fieldName: 'f', fieldValue: 'v' }] },
      };
      (B3Request.graphqlB2B as any).mockResolvedValue(mockResponse);

      const ids = [200];
      const result = await getOrdersExtraFields(ids, false);

      expect(B3Request.graphqlB2B).toHaveBeenCalledWith({
        query: expect.stringContaining('query GetCustomerOrdersDetails_0'),
      });

      const queryArg = (B3Request.graphqlB2B as any).mock.calls[0][0].query;
      expect(queryArg).toContain('order_200: customerOrder(id: 200)');

      expect(result).toEqual({
        '200': [{ fieldName: 'f', fieldValue: 'v' }],
      });
    });

    it('sanitizes IDs for aliases', async () => {
      const mockResponse = {
        order_abc_123: { extraFields: [] },
      };
      (B3Request.graphqlB2B as any).mockResolvedValue(mockResponse);

      await getOrdersExtraFields(['abc-123'], true);

      const queryArg = (B3Request.graphqlB2B as any).mock.calls[0][0].query;
      expect(queryArg).toContain('order_abc_123: order(id: abc-123)');
    });

    it('handles errors gracefully by returning empty object', async () => {
      (B3Request.graphqlB2B as any).mockRejectedValue(new Error('Network error'));

      const result = await getOrdersExtraFields(['123'], true);

      expect(result).toEqual({});
    });

    describe('batching behavior', () => {
      it('fetches 10 IDs in a single batch', async () => {
        const ids = Array.from({ length: 10 }, (_, i) => i + 1);
        const mockResponse: Record<string, { id: string; extraFields: any[] }> = {};
        ids.forEach((id) => {
          mockResponse[`order_${id}`] = { id: String(id), extraFields: [] };
        });
        (B3Request.graphqlB2B as any).mockResolvedValue(mockResponse);

        await getOrdersExtraFields(ids, true);

        // Should make exactly 1 API call
        expect(B3Request.graphqlB2B).toHaveBeenCalledTimes(1);
      });

      it('batches 15 IDs into 2 API calls (10 + 5)', async () => {
        const ids = Array.from({ length: 15 }, (_, i) => i + 1);

        // Mock responses for both batches
        const batch1Response: Record<string, { id: string; extraFields: any[] }> = {};
        for (let i = 1; i <= 10; i++) {
          batch1Response[`order_${i}`] = {
            id: String(i),
            extraFields: [{ fieldName: 'batch', fieldValue: '1' }],
          };
        }

        const batch2Response: Record<string, { id: string; extraFields: any[] }> = {};
        for (let i = 11; i <= 15; i++) {
          batch2Response[`order_${i}`] = {
            id: String(i),
            extraFields: [{ fieldName: 'batch', fieldValue: '2' }],
          };
        }

        (B3Request.graphqlB2B as any)
          .mockResolvedValueOnce(batch1Response)
          .mockResolvedValueOnce(batch2Response);

        const result = await getOrdersExtraFields(ids, true);

        // Should make 2 API calls
        expect(B3Request.graphqlB2B).toHaveBeenCalledTimes(2);

        // First call should have IDs 1-10
        const query1 = (B3Request.graphqlB2B as any).mock.calls[0][0].query;
        expect(query1).toContain('query GetOrdersDetails_0');
        expect(query1).toContain('order_1: order(id: 1)');
        expect(query1).toContain('order_10: order(id: 10)');
        expect(query1).not.toContain('order_11');

        // Second call should have IDs 11-15
        const query2 = (B3Request.graphqlB2B as any).mock.calls[1][0].query;
        expect(query2).toContain('query GetOrdersDetails_1');
        expect(query2).toContain('order_11: order(id: 11)');
        expect(query2).toContain('order_15: order(id: 15)');

        // Result should contain all 15 IDs
        expect(Object.keys(result)).toHaveLength(15);
        expect(result['1']).toEqual([{ fieldName: 'batch', fieldValue: '1' }]);
        expect(result['15']).toEqual([{ fieldName: 'batch', fieldValue: '2' }]);
      });

      it('batches 25 IDs into 3 API calls (10 + 10 + 5)', async () => {
        const ids = Array.from({ length: 25 }, (_, i) => i + 1);

        // Mock responses for all 3 batches
        const createBatchResponse = (start: number, end: number) => {
          const response: Record<string, { id: string; extraFields: any[] }> = {};
          for (let i = start; i <= end; i++) {
            response[`order_${i}`] = { id: String(i), extraFields: [] };
          }
          return response;
        };

        (B3Request.graphqlB2B as any)
          .mockResolvedValueOnce(createBatchResponse(1, 10))
          .mockResolvedValueOnce(createBatchResponse(11, 20))
          .mockResolvedValueOnce(createBatchResponse(21, 25));

        const result = await getOrdersExtraFields(ids, true);

        // Should make 3 API calls
        expect(B3Request.graphqlB2B).toHaveBeenCalledTimes(3);

        // Result should contain all 25 IDs
        expect(Object.keys(result)).toHaveLength(25);
      });

      it('merges results from multiple batches correctly', async () => {
        const ids = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];

        const batch1Response: Record<string, { id: string; extraFields: any[] }> = {};
        for (let i = 1; i <= 10; i++) {
          batch1Response[`order_${i}`] = {
            id: String(i),
            extraFields: [{ fieldName: 'epicorOrderId', fieldValue: `EPI-${i}` }],
          };
        }

        const batch2Response: Record<string, { id: string; extraFields: any[] }> = {};
        for (let i = 11; i <= 12; i++) {
          batch2Response[`order_${i}`] = {
            id: String(i),
            extraFields: [{ fieldName: 'epicorOrderId', fieldValue: `EPI-${i}` }],
          };
        }

        (B3Request.graphqlB2B as any)
          .mockResolvedValueOnce(batch1Response)
          .mockResolvedValueOnce(batch2Response);

        const result = await getOrdersExtraFields(ids, true);

        // Verify all IDs have correct extra fields
        expect(result['1']).toEqual([{ fieldName: 'epicorOrderId', fieldValue: 'EPI-1' }]);
        expect(result['10']).toEqual([{ fieldName: 'epicorOrderId', fieldValue: 'EPI-10' }]);
        expect(result['11']).toEqual([{ fieldName: 'epicorOrderId', fieldValue: 'EPI-11' }]);
        expect(result['12']).toEqual([{ fieldName: 'epicorOrderId', fieldValue: 'EPI-12' }]);
      });
    });
  });

  describe('getB2BAllOrders', () => {
    it('calls graphqlB2B with correct parameters', async () => {
      (B3Request.graphqlB2B as any).mockResolvedValue({ allOrders: [] });

      const params = {
        q: 'search',
        first: 10,
        offset: 0,
        orderBy: 'createdAt',
      };

      await getB2BAllOrders(params);

      expect(B3Request.graphqlB2B).toHaveBeenCalledWith(
        expect.objectContaining({
          query: expect.stringContaining('allOrders'),
        }),
      );

      const queryArg = (B3Request.graphqlB2B as any).mock.calls[0][0].query;
      expect(queryArg).toContain('search: "search"');
      expect(queryArg).toContain('first: 10');
    });
  });

  describe('getBCAllOrders', () => {
    it('calls graphqlB2B with correct parameters for customer orders', async () => {
      (B3Request.graphqlB2B as any).mockResolvedValue({ customerOrders: [] });

      const params = {
        first: 5,
        offset: 0,
        orderBy: 'date',
      };

      await getBCAllOrders(params);

      expect(B3Request.graphqlB2B).toHaveBeenCalledWith(
        expect.objectContaining({
          query: expect.stringContaining('customerOrders'),
        }),
      );
    });
  });

  describe('getOrderStatusType', () => {
    it('fetches order statuses', async () => {
      const mockStatuses = [{ systemLabel: 'New', customLabel: 'New Order', statusCode: '0' }];
      (B3Request.graphqlB2B as any).mockResolvedValue({ orderStatuses: mockStatuses });

      const result = await getOrderStatusType();

      expect(B3Request.graphqlB2B).toHaveBeenCalledWith(
        expect.objectContaining({
          query: expect.stringContaining('orderStatuses'),
        }),
      );
      expect(result).toEqual(mockStatuses);
    });
  });

  describe('getBcOrderStatusType', () => {
    it('fetches BC order statuses', async () => {
      const mockStatuses = [{ systemLabel: 'New', customLabel: 'New', statusCode: '0' }];
      (B3Request.graphqlB2B as any).mockResolvedValue({ bcOrderStatuses: mockStatuses });

      const result = await getBcOrderStatusType();

      expect(B3Request.graphqlB2B).toHaveBeenCalledWith(
        expect.objectContaining({
          query: expect.stringContaining('bcOrderStatuses'),
        }),
      );
      expect(result).toEqual(mockStatuses);
    });
  });

  describe('getOrdersCreatedByUser', () => {
    it('fetches orders created by user', async () => {
      (B3Request.graphqlB2B as any).mockResolvedValue({ createdByUser: { results: [] } });

      await getOrdersCreatedByUser(123);

      expect(B3Request.graphqlB2B).toHaveBeenCalledWith(
        expect.objectContaining({
          query: expect.stringContaining('createdByUser'),
        }),
      );

      const queryArg = (B3Request.graphqlB2B as any).mock.calls[0][0].query;
      expect(queryArg).toContain('companyId: 123');
    });
  });

  describe('getCompanyInfo', () => {
    beforeEach(() => {
      clearCompanyCache();
    });

    it('fetches company info from API', async () => {
      (B3Request.get as any).mockResolvedValue({ companyName: 'Test Company' });

      const result = await getCompanyInfo(123);

      expect(B3Request.get).toHaveBeenCalledWith('/api/v2/companies/123', 'B2BRest');
      expect(result).toEqual({ companyId: 123, companyName: 'Test Company' });
    });

    it('returns cached result on subsequent calls', async () => {
      (B3Request.get as any).mockResolvedValue({ companyName: 'Cached Co' });

      await getCompanyInfo(456);
      await getCompanyInfo(456);

      expect(B3Request.get).toHaveBeenCalledTimes(1);
    });

    it('handles API errors gracefully', async () => {
      (B3Request.get as any).mockRejectedValue(new Error('Network error'));

      const result = await getCompanyInfo(999);

      expect(result).toBeNull();
    });

    it('handles empty company name', async () => {
      (B3Request.get as any).mockResolvedValue({ companyName: '' });

      const result = await getCompanyInfo(100);

      expect(result).toEqual({ companyId: 100, companyName: '' });
    });
  });

  describe('getCompaniesInfo', () => {
    beforeEach(() => {
      clearCompanyCache();
    });

    it('fetches multiple companies in parallel', async () => {
      (B3Request.get as any)
        .mockResolvedValueOnce({ companyName: 'Company A' })
        .mockResolvedValueOnce({ companyName: 'Company B' });

      const result = await getCompaniesInfo([1, 2]);

      expect(B3Request.get).toHaveBeenCalledTimes(2);
      expect(result.get(1)).toBe('Company A');
      expect(result.get(2)).toBe('Company B');
    });

    it('deduplicates company IDs', async () => {
      (B3Request.get as any).mockResolvedValue({ companyName: 'Deduped' });

      await getCompaniesInfo([1, 1, 1]);

      expect(B3Request.get).toHaveBeenCalledTimes(1);
    });

    it('uses cache for already fetched companies', async () => {
      (B3Request.get as any).mockResolvedValue({ companyName: 'Cached' });

      await getCompanyInfo(10);
      (B3Request.get as any).mockClear();

      const result = await getCompaniesInfo([10, 20]);

      expect(B3Request.get).toHaveBeenCalledTimes(1);
      expect(result.get(10)).toBe('Cached');
    });
  });

  describe('clearCompanyCache', () => {
    it('clears the cache so subsequent calls fetch from API', async () => {
      (B3Request.get as any).mockResolvedValue({ companyName: 'First' });
      await getCompanyInfo(1);

      (B3Request.get as any).mockClear();
      (B3Request.get as any).mockResolvedValue({ companyName: 'Second' });

      clearCompanyCache();
      const result = await getCompanyInfo(1);

      expect(B3Request.get).toHaveBeenCalledTimes(1);
      expect(result?.companyName).toBe('Second');
    });
  });

  describe('getB2BAllOrdersREST', () => {
    beforeEach(() => {
      clearCompanyCache();
    });

    it('fetches orders with showExtra=true', async () => {
      const mockResponse = {
        code: 200,
        data: {
          list: [],
          paginator: { totalCount: 0, offset: 0, limit: 10 },
        },
        message: '',
      };
      (B3Request.get as any).mockResolvedValue(mockResponse);

      await getB2BAllOrdersREST({ first: 10, offset: 0, orderBy: '-createdAt' });

      expect(B3Request.get).toHaveBeenCalledWith(
        '/api/v2/orders',
        'B2BRest',
        expect.objectContaining({ showExtra: true, limit: 10, offset: 0 }),
      );
    });

    it('maps REST response to GraphQL-like structure', async () => {
      const mockOrder = {
        orderId: 12345,
        companyName: 'Test Company',
        totalIncTax: 100.0,
        poNumber: 'PO-001',
        orderStatus: 'Pending',
        firstName: 'John',
        lastName: 'Doe',
        money: {
          currency_token: '$',
          decimal_places: 2,
          currency_location: 'left',
          decimal_token: '.',
          thousands_token: ',',
        },
        extraFields: [{ fieldName: 'epicorOrderId', fieldValue: 'EPI-123' }],
        createdAt: '1699900000',
      };
      const mockResponse = {
        code: 200,
        data: {
          list: [mockOrder],
          paginator: { totalCount: 1, offset: 0, limit: 10 },
        },
        message: '',
      };
      (B3Request.get as any).mockResolvedValue(mockResponse);

      const result = await getB2BAllOrdersREST({ first: 10, offset: 0, orderBy: '-createdAt' });

      expect(result.totalCount).toBe(1);
      expect(result.edges).toHaveLength(1);
      expect(result.edges[0].node.orderId).toBe('12345');
      expect(result.edges[0].node.totalIncTax).toBe(100.0);
      expect(result.edges[0].node.poNumber).toBe('PO-001');
      expect(result.edges[0].node.firstName).toBe('John');
      expect(result.edges[0].node.lastName).toBe('Doe');
      expect(result.extraFieldsMap['12345']).toEqual([
        { fieldName: 'epicorOrderId', fieldValue: 'EPI-123' },
      ]);
    });

    it('uses companyName directly from response (no separate fetch)', async () => {
      const mockOrder = {
        orderId: 999,
        companyName: 'Acme Corp',
        totalIncTax: 50,
        poNumber: '',
        orderStatus: 'Shipped',
        firstName: 'Jane',
        lastName: 'Smith',
        money: {
          currency_token: '$',
          decimal_places: 2,
          currency_location: 'left',
          decimal_token: '.',
          thousands_token: ',',
        },
        extraFields: [],
        createdAt: '1699900000',
      };
      const mockResponse = {
        code: 200,
        data: {
          list: [mockOrder],
          paginator: { totalCount: 1, offset: 0, limit: 10 },
        },
        message: '',
      };

      (B3Request.get as any).mockResolvedValue(mockResponse);

      const result = await getB2BAllOrdersREST({ first: 10, offset: 0, orderBy: '-createdAt' });

      // Company name should come directly from response - only 1 API call
      expect(B3Request.get).toHaveBeenCalledTimes(1);
      expect(result.edges[0].node.companyInfo?.companyName).toBe('Acme Corp');
    });

    it('handles errors gracefully', async () => {
      (B3Request.get as any).mockRejectedValue(new Error('API error'));

      const result = await getB2BAllOrdersREST({ first: 10, offset: 0, orderBy: '-createdAt' });

      expect(result).toEqual({ edges: [], totalCount: 0, extraFieldsMap: {} });
    });

    it('includes optional filters in request', async () => {
      const mockResponse = {
        code: 200,
        data: {
          list: [],
          paginator: { totalCount: 0, offset: 0, limit: 10 },
        },
        message: '',
      };
      (B3Request.get as any).mockResolvedValue(mockResponse);

      await getB2BAllOrdersREST({
        first: 10,
        offset: 0,
        orderBy: '-createdAt',
        q: 'search term',
        statusCode: 'Pending',
        beginDateAt: '2024-01-01',
        endDateAt: '2024-12-31',
        companyIds: [1, 2, 3],
      });

      expect(B3Request.get).toHaveBeenCalledWith(
        '/api/v2/orders',
        'B2BRest',
        expect.objectContaining({
          search: 'search term',
          status: 'Pending',
          beginDateAt: '2024-01-01',
          endDateAt: '2024-12-31',
          companyIds: '1,2,3',
        }),
      );
    });

    describe('money formatting for ordersCurrencyFormat compatibility', () => {
      it('formats money with snake_case properties required by ordersCurrencyFormat', async () => {
        const mockOrder = {
          orderId: 123,
          companyName: 'Test Co',
          totalIncTax: 99.99,
          poNumber: '',
          orderStatus: 'Pending',
          firstName: 'Test',
          lastName: 'User',
          money: {
            currency_location: 'left',
            currency_token: '$',
            decimal_token: '.',
            decimal_places: 2,
            thousands_token: ',',
          },
          extraFields: [],
          createdAt: '1699900000',
        };
        const mockResponse = {
          code: 200,
          data: {
            list: [mockOrder],
            paginator: { totalCount: 1, offset: 0, limit: 10 },
          },
          message: '',
        };
        (B3Request.get as any).mockResolvedValue(mockResponse);

        const result = await getB2BAllOrdersREST({ first: 10, offset: 0, orderBy: '-createdAt' });

        // Parse the money JSON and verify snake_case properties
        const moneyJson = result.edges[0].node.money;
        expect(moneyJson).toBeDefined();

        const parsedMoney = JSON.parse(moneyJson!);

        // Verify snake_case properties (required by ordersCurrencyFormat)
        expect(parsedMoney).toHaveProperty('currency_location', 'left');
        expect(parsedMoney).toHaveProperty('currency_token', '$');
        expect(parsedMoney).toHaveProperty('decimal_token', '.');
        expect(parsedMoney).toHaveProperty('decimal_places', 2);
        expect(parsedMoney).toHaveProperty('thousands_token', ',');

        // Verify camelCase properties are NOT present (would break ordersCurrencyFormat)
        expect(parsedMoney).not.toHaveProperty('currencyLocation');
        expect(parsedMoney).not.toHaveProperty('currencyToken');
        expect(parsedMoney).not.toHaveProperty('decimalToken');
        expect(parsedMoney).not.toHaveProperty('decimalPlaces');
        expect(parsedMoney).not.toHaveProperty('thousandsToken');
      });

      it('preserves currency_location "right" for currencies like EUR', async () => {
        const mockOrder = {
          orderId: 456,
          companyName: 'Euro Corp',
          totalIncTax: 150.5,
          poNumber: '',
          orderStatus: 'Complete',
          firstName: 'Euro',
          lastName: 'User',
          money: {
            currency_location: 'right',
            currency_token: '€',
            decimal_token: ',',
            decimal_places: 2,
            thousands_token: '.',
          },
          extraFields: [],
          createdAt: '1699900000',
        };
        const mockResponse = {
          code: 200,
          data: {
            list: [mockOrder],
            paginator: { totalCount: 1, offset: 0, limit: 10 },
          },
          message: '',
        };
        (B3Request.get as any).mockResolvedValue(mockResponse);

        const result = await getB2BAllOrdersREST({ first: 10, offset: 0, orderBy: '-createdAt' });

        const parsedMoney = JSON.parse(result.edges[0].node.money!);

        expect(parsedMoney.currency_location).toBe('right');
        expect(parsedMoney.currency_token).toBe('€');
        expect(parsedMoney.decimal_token).toBe(',');
        expect(parsedMoney.thousands_token).toBe('.');
      });

      it('handles zero decimal places for currencies like JPY', async () => {
        const mockOrder = {
          orderId: 789,
          companyName: 'Japan Corp',
          totalIncTax: 15000,
          poNumber: '',
          orderStatus: 'Pending',
          firstName: 'Yen',
          lastName: 'User',
          money: {
            currency_location: 'left',
            currency_token: '¥',
            decimal_token: '.',
            decimal_places: 0,
            thousands_token: ',',
          },
          extraFields: [],
          createdAt: '1699900000',
        };
        const mockResponse = {
          code: 200,
          data: {
            list: [mockOrder],
            paginator: { totalCount: 1, offset: 0, limit: 10 },
          },
          message: '',
        };
        (B3Request.get as any).mockResolvedValue(mockResponse);

        const result = await getB2BAllOrdersREST({ first: 10, offset: 0, orderBy: '-createdAt' });

        const parsedMoney = JSON.parse(result.edges[0].node.money!);

        expect(parsedMoney.decimal_places).toBe(0);
        expect(parsedMoney.currency_token).toBe('¥');
      });

      it('money JSON is single-encoded (not double-encoded)', async () => {
        const mockOrder = {
          orderId: 111,
          companyName: 'Test',
          totalIncTax: 50,
          poNumber: '',
          orderStatus: 'Pending',
          firstName: 'A',
          lastName: 'B',
          money: {
            currency_location: 'left',
            currency_token: '$',
            decimal_token: '.',
            decimal_places: 2,
            thousands_token: ',',
          },
          extraFields: [],
          createdAt: '1699900000',
        };
        const mockResponse = {
          code: 200,
          data: {
            list: [mockOrder],
            paginator: { totalCount: 1, offset: 0, limit: 10 },
          },
          message: '',
        };
        (B3Request.get as any).mockResolvedValue(mockResponse);

        const result = await getB2BAllOrdersREST({ first: 10, offset: 0, orderBy: '-createdAt' });

        const moneyJson = result.edges[0].node.money!;

        // First parse should give an object, not another string
        const firstParse = JSON.parse(moneyJson);
        expect(typeof firstParse).toBe('object');
        expect(typeof firstParse).not.toBe('string');

        // Verify it's a valid money object
        expect(firstParse.currency_token).toBe('$');
      });
    });
  });
});

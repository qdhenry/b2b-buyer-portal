import { vi } from 'vitest';
import B3Request from '@/shared/service/request/b3Fetch';
import { 
  getOrdersExtraFields, 
  getB2BAllOrders, 
  getBCAllOrders,
  getOrderStatusType,
  getBcOrderStatusType,
  getOrdersCreatedByUser
} from './orders';

// Mock B3Request
vi.mock('@/shared/service/request/b3Fetch', () => ({
  default: {
    graphqlB2B: vi.fn(),
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
          batch1Response[`order_${i}`] = { id: String(i), extraFields: [{ fieldName: 'batch', fieldValue: '1' }] };
        }

        const batch2Response: Record<string, { id: string; extraFields: any[] }> = {};
        for (let i = 11; i <= 15; i++) {
          batch2Response[`order_${i}`] = { id: String(i), extraFields: [{ fieldName: 'batch', fieldValue: '2' }] };
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
            extraFields: [{ fieldName: 'epicoreOrderId', fieldValue: `EPI-${i}` }]
          };
        }

        const batch2Response: Record<string, { id: string; extraFields: any[] }> = {};
        for (let i = 11; i <= 12; i++) {
          batch2Response[`order_${i}`] = {
            id: String(i),
            extraFields: [{ fieldName: 'epicoreOrderId', fieldValue: `EPI-${i}` }]
          };
        }

        (B3Request.graphqlB2B as any)
          .mockResolvedValueOnce(batch1Response)
          .mockResolvedValueOnce(batch2Response);

        const result = await getOrdersExtraFields(ids, true);

        // Verify all IDs have correct extra fields
        expect(result['1']).toEqual([{ fieldName: 'epicoreOrderId', fieldValue: 'EPI-1' }]);
        expect(result['10']).toEqual([{ fieldName: 'epicoreOrderId', fieldValue: 'EPI-10' }]);
        expect(result['11']).toEqual([{ fieldName: 'epicoreOrderId', fieldValue: 'EPI-11' }]);
        expect(result['12']).toEqual([{ fieldName: 'epicoreOrderId', fieldValue: 'EPI-12' }]);
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
      
      expect(B3Request.graphqlB2B).toHaveBeenCalledWith(expect.objectContaining({
        query: expect.stringContaining('allOrders'),
      }));
      
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
      
      expect(B3Request.graphqlB2B).toHaveBeenCalledWith(expect.objectContaining({
        query: expect.stringContaining('customerOrders'),
      }));
    });
  });

  describe('getOrderStatusType', () => {
    it('fetches order statuses', async () => {
      const mockStatuses = [{ systemLabel: 'New', customLabel: 'New Order', statusCode: '0' }];
      (B3Request.graphqlB2B as any).mockResolvedValue({ orderStatuses: mockStatuses });
      
      const result = await getOrderStatusType();
      
      expect(B3Request.graphqlB2B).toHaveBeenCalledWith(expect.objectContaining({
        query: expect.stringContaining('orderStatuses'),
      }));
      expect(result).toEqual(mockStatuses);
    });
  });

  describe('getBcOrderStatusType', () => {
    it('fetches BC order statuses', async () => {
      const mockStatuses = [{ systemLabel: 'New', customLabel: 'New', statusCode: '0' }];
      (B3Request.graphqlB2B as any).mockResolvedValue({ bcOrderStatuses: mockStatuses });
      
      const result = await getBcOrderStatusType();
      
      expect(B3Request.graphqlB2B).toHaveBeenCalledWith(expect.objectContaining({
        query: expect.stringContaining('bcOrderStatuses'),
      }));
      expect(result).toEqual(mockStatuses);
    });
  });

  describe('getOrdersCreatedByUser', () => {
    it('fetches orders created by user', async () => {
      (B3Request.graphqlB2B as any).mockResolvedValue({ createdByUser: { results: [] } });
      
      await getOrdersCreatedByUser(123);
      
      expect(B3Request.graphqlB2B).toHaveBeenCalledWith(expect.objectContaining({
        query: expect.stringContaining('createdByUser'),
      }));
      
      const queryArg = (B3Request.graphqlB2B as any).mock.calls[0][0].query;
      expect(queryArg).toContain('companyId: 123');
    });
  });
});

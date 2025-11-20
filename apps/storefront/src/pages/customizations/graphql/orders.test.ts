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
        query: expect.stringContaining('query GetOrdersDetails'),
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
        query: expect.stringContaining('query GetCustomerOrdersDetails'),
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

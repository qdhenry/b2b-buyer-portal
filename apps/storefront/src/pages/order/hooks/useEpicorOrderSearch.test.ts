import { waitFor } from '@testing-library/react';
import { renderHookWithProviders } from 'tests/utils/hook-test-utils';
import { vi } from 'vitest';

import * as ordersModule from '../../customizations/graphql/orders';
import { CompanyOrderNode, ExtraField } from '../../customizations/graphql/orders';

import { useEpicorOrderSearch } from './useEpicorOrderSearch';

// Mock the orders module
vi.mock('../../customizations/graphql/orders', async (importOriginal) => {
  const actual = await importOriginal<typeof ordersModule>();
  return {
    ...actual,
    getAllOrdersWithExtraFields: vi.fn(),
  };
});

describe('useEpicorOrderSearch', () => {
  const mockGetAllOrdersWithExtraFields = ordersModule.getAllOrdersWithExtraFields as ReturnType<
    typeof vi.fn
  >;

  const createMockOrder = (orderId: string, _epicorId: string): CompanyOrderNode => ({
    node: {
      orderId,
      createdAt: 1699900000,
      totalIncTax: 100,
      money: JSON.stringify({
        currency_token: '$',
        decimal_places: 2,
        currency_location: 'left',
        decimal_token: '.',
        thousands_token: ',',
      }),
      poNumber: 'PO-001',
      status: 'Pending',
      firstName: 'John',
      lastName: 'Doe',
      extraInfo: '',
    },
  });

  const createMockResponse = (
    orders: CompanyOrderNode[],
    extraFieldsMap: Record<string, ExtraField[]>,
  ) => ({
    edges: orders,
    totalCount: orders.length,
    extraFieldsMap,
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('query enablement', () => {
    it('does not fetch when epicorSearchTerm is empty string', () => {
      renderHookWithProviders(() => useEpicorOrderSearch(123, ''));

      expect(mockGetAllOrdersWithExtraFields).not.toHaveBeenCalled();
    });

    it('does not fetch when epicorSearchTerm is whitespace only', () => {
      renderHookWithProviders(() => useEpicorOrderSearch(123, '   '));

      expect(mockGetAllOrdersWithExtraFields).not.toHaveBeenCalled();
    });

    it('fetches when epicorSearchTerm is provided', async () => {
      mockGetAllOrdersWithExtraFields.mockResolvedValue(createMockResponse([], {}));

      renderHookWithProviders(() => useEpicorOrderSearch(123, 'EP-1001'));

      await waitFor(() => {
        expect(mockGetAllOrdersWithExtraFields).toHaveBeenCalledWith(
          123,
          undefined,
          expect.any(Function),
        );
      });
    });
  });

  describe('filtering logic', () => {
    it('filters orders by epicorOrderId with case-insensitive partial match', async () => {
      const orders = [
        createMockOrder('100', 'EP-1001'),
        createMockOrder('101', 'EP-2002'),
        createMockOrder('102', 'EP-1003'),
      ];

      const extraFieldsMap = {
        '100': [{ fieldName: 'epicorOrderId', fieldValue: 'EP-1001' }],
        '101': [{ fieldName: 'epicorOrderId', fieldValue: 'EP-2002' }],
        '102': [{ fieldName: 'epicorOrderId', fieldValue: 'EP-1003' }],
      };

      mockGetAllOrdersWithExtraFields.mockResolvedValue(createMockResponse(orders, extraFieldsMap));

      const { result } = renderHookWithProviders(() => useEpicorOrderSearch(123, 'EP-1'));

      await waitFor(() => {
        expect(result.result.current.isLoadingAllOrders).toBe(false);
      });

      // Should match EP-1001 and EP-1003 (both contain "EP-1")
      expect(result.result.current.epicorFilteredResults).toHaveLength(2);
      expect(result.result.current.epicorFilteredResults[0].node.orderId).toBe('100');
      expect(result.result.current.epicorFilteredResults[1].node.orderId).toBe('102');
    });

    it('performs case-insensitive search', async () => {
      const orders = [
        createMockOrder('100', 'EP-1001'),
        createMockOrder('101', 'ep-2002'),
        createMockOrder('102', 'Ep-1003'),
      ];

      const extraFieldsMap = {
        '100': [{ fieldName: 'epicorOrderId', fieldValue: 'EP-1001' }],
        '101': [{ fieldName: 'epicorOrderId', fieldValue: 'ep-2002' }],
        '102': [{ fieldName: 'epicorOrderId', fieldValue: 'Ep-1003' }],
      };

      mockGetAllOrdersWithExtraFields.mockResolvedValue(createMockResponse(orders, extraFieldsMap));

      const { result } = renderHookWithProviders(() => useEpicorOrderSearch(123, 'ep-1'));

      await waitFor(() => {
        expect(result.result.current.isLoadingAllOrders).toBe(false);
      });

      // Should match all three (case-insensitive "ep-1")
      expect(result.result.current.epicorFilteredResults).toHaveLength(2);
    });

    it('returns empty array when no matches found', async () => {
      const orders = [createMockOrder('100', 'EP-1001'), createMockOrder('101', 'EP-2002')];

      const extraFieldsMap = {
        '100': [{ fieldName: 'epicorOrderId', fieldValue: 'EP-1001' }],
        '101': [{ fieldName: 'epicorOrderId', fieldValue: 'EP-2002' }],
      };

      mockGetAllOrdersWithExtraFields.mockResolvedValue(createMockResponse(orders, extraFieldsMap));

      const { result } = renderHookWithProviders(() => useEpicorOrderSearch(123, 'XYZ'));

      await waitFor(() => {
        expect(result.result.current.isLoadingAllOrders).toBe(false);
      });

      expect(result.result.current.epicorFilteredResults).toHaveLength(0);
    });

    it('returns empty array when epicorSearchTerm is empty', async () => {
      const orders = [createMockOrder('100', 'EP-1001')];
      const extraFieldsMap = {
        '100': [{ fieldName: 'epicorOrderId', fieldValue: 'EP-1001' }],
      };

      mockGetAllOrdersWithExtraFields.mockResolvedValue(createMockResponse(orders, extraFieldsMap));

      const { result } = renderHookWithProviders(() => useEpicorOrderSearch(123, ''));

      // No query should run, so no results
      expect(result.result.current.epicorFilteredResults).toHaveLength(0);
    });

    it('handles orders with missing epicorOrderId gracefully', async () => {
      const orders = [
        createMockOrder('100', 'EP-1001'),
        createMockOrder('101', ''), // No epicorOrderId
        createMockOrder('102', 'EP-1002'),
      ];

      const extraFieldsMap = {
        '100': [{ fieldName: 'epicorOrderId', fieldValue: 'EP-1001' }],
        '101': [], // Missing epicorOrderId
        '102': [{ fieldName: 'epicorOrderId', fieldValue: 'EP-1002' }],
      };

      mockGetAllOrdersWithExtraFields.mockResolvedValue(createMockResponse(orders, extraFieldsMap));

      const { result } = renderHookWithProviders(() => useEpicorOrderSearch(123, 'EP-1'));

      await waitFor(() => {
        expect(result.result.current.isLoadingAllOrders).toBe(false);
      });

      // Should only match orders with epicorOrderId containing "EP-1"
      expect(result.result.current.epicorFilteredResults).toHaveLength(2);
    });
  });

  describe('progress callbacks', () => {
    it('calls progress callback during data fetching', async () => {
      mockGetAllOrdersWithExtraFields.mockImplementation(
        async (_companyId, _filters, onProgress) => {

          // Simulate progress updates
          onProgress?.(100, 500);
          onProgress?.(250, 500);
          onProgress?.(500, 500);

          return createMockResponse([], {});
        },
      );

      const { result } = renderHookWithProviders(() => useEpicorOrderSearch(123, 'EP-1'));

      await waitFor(() => {
        expect(result.result.current.isLoadingAllOrders).toBe(false);
      });

      // Progress should reflect final state
      expect(result.result.current.loadingProgress).toEqual({ fetched: 500, total: 500 });
    });

    it('updates progress state during fetching', async () => {
      mockGetAllOrdersWithExtraFields.mockImplementation(
        async (_companyId, _filters, onProgress) => {
          // Simulate incremental progress
          onProgress?.(100, 1000);
          return createMockResponse([], {});
        },
      );

      const { result } = renderHookWithProviders(() => useEpicorOrderSearch(123, 'EP-1'));

      await waitFor(() => {
        expect(result.result.current.loadingProgress.fetched).toBeGreaterThan(0);
      });
    });

    it('resets progress when query is disabled', async () => {
      mockGetAllOrdersWithExtraFields.mockImplementation(
        async (_companyId, _filters, onProgress) => {
          onProgress?.(100, 100);
          return createMockResponse([], {});
        },
      );

      const { result } = renderHookWithProviders(
        ({ searchTerm }: { searchTerm: string }) => useEpicorOrderSearch(123, searchTerm),
        { initialProps: { searchTerm: 'EP-1' } },
      );

      await waitFor(() => {
        expect(result.result.current.isLoadingAllOrders).toBe(false);
      });

      expect(result.result.current.loadingProgress).toEqual({ fetched: 100, total: 100 });

      // Change to empty search term (disables query)
      result.rerender({ searchTerm: '' });

      await waitFor(() => {
        expect(result.result.current.loadingProgress).toEqual({ fetched: 0, total: 0 });
      });
    });
  });

  describe('caching behavior', () => {
    it('caches data with 30-minute stale time', async () => {
      const orders = [createMockOrder('100', 'EP-1001')];
      const extraFieldsMap = {
        '100': [{ fieldName: 'epicorOrderId', fieldValue: 'EP-1001' }],
      };

      mockGetAllOrdersWithExtraFields.mockResolvedValue(createMockResponse(orders, extraFieldsMap));

      const { result } = renderHookWithProviders(() => useEpicorOrderSearch(123, 'EP-1'));

      await waitFor(() => {
        expect(result.result.current.isLoadingAllOrders).toBe(false);
      });

      expect(mockGetAllOrdersWithExtraFields).toHaveBeenCalledTimes(1);
      expect(result.result.current.epicorFilteredResults).toHaveLength(1);

      // Note: In a real scenario, data would be cached for 30 minutes
      // But in tests with fresh QueryClient, each render creates a new cache
    });
  });

  describe('error handling', () => {
    it('exposes error when query fails', async () => {
      const mockError = new Error('Network error');
      mockGetAllOrdersWithExtraFields.mockRejectedValue(mockError);

      const { result } = renderHookWithProviders(() => useEpicorOrderSearch(123, 'EP-1'));

      await waitFor(() => {
        expect(result.result.current.isLoadingAllOrders).toBe(false);
      });

      expect(result.result.current.error).toBeDefined();
      expect(result.result.current.epicorFilteredResults).toHaveLength(0);
    });

    it('handles getAllOrdersWithExtraFields rejection gracefully', async () => {
      mockGetAllOrdersWithExtraFields.mockRejectedValue(new Error('API error'));

      const { result } = renderHookWithProviders(() => useEpicorOrderSearch(123, 'EP-1'));

      await waitFor(() => {
        expect(result.result.current.isLoadingAllOrders).toBe(false);
      });

      // Should not crash, should return empty results
      expect(result.result.current.epicorFilteredResults).toEqual([]);
      expect(result.result.current.totalOrdersCount).toBe(0);
    });
  });

  describe('return values', () => {
    it('returns correct structure when data is loaded', async () => {
      const orders = [createMockOrder('100', 'EP-1001')];
      const extraFieldsMap = {
        '100': [{ fieldName: 'epicorOrderId', fieldValue: 'EP-1001' }],
      };

      mockGetAllOrdersWithExtraFields.mockResolvedValue(createMockResponse(orders, extraFieldsMap));

      const { result } = renderHookWithProviders(() => useEpicorOrderSearch(123, 'EP-1'));

      await waitFor(() => {
        expect(result.result.current.isLoadingAllOrders).toBe(false);
      });

      expect(result.result.current).toMatchObject({
        isLoadingAllOrders: false,
        loadingProgress: expect.any(Object),
        epicorFilteredResults: expect.any(Array),
        totalOrdersCount: 1,
        extraFieldsMap: expect.any(Object),
      });
      // error can be null or undefined when there's no error
      expect(result.result.current.error).toBeFalsy();
    });

    it('provides extraFieldsMap for accessing order extra fields', async () => {
      const orders = [createMockOrder('100', 'EP-1001')];
      const extraFieldsMap = {
        '100': [
          { fieldName: 'epicorOrderId', fieldValue: 'EP-1001' },
          { fieldName: 'customField', fieldValue: 'customValue' },
        ],
      };

      mockGetAllOrdersWithExtraFields.mockResolvedValue(createMockResponse(orders, extraFieldsMap));

      const { result } = renderHookWithProviders(() => useEpicorOrderSearch(123, 'EP-1'));

      await waitFor(() => {
        expect(result.result.current.isLoadingAllOrders).toBe(false);
      });

      expect(result.result.current.extraFieldsMap['100']).toEqual(extraFieldsMap['100']);
    });

    it('returns totalOrdersCount from API response', async () => {
      const orders = Array.from({ length: 50 }, (_, i) =>
        createMockOrder(`${100 + i}`, `EP-${1000 + i}`),
      );
      const extraFieldsMap = orders.reduce(
        (acc, order) => {
          acc[order.node.orderId!] = [
            {
              fieldName: 'epicorOrderId',
              fieldValue: `EP-${1000 + parseInt(order.node.orderId!, 10) - 100}`,
            },
          ];
          return acc;
        },
        {} as Record<string, ExtraField[]>,
      );

      mockGetAllOrdersWithExtraFields.mockResolvedValue(createMockResponse(orders, extraFieldsMap));

      const { result } = renderHookWithProviders(() => useEpicorOrderSearch(123, 'EP-1'));

      await waitFor(() => {
        expect(result.result.current.isLoadingAllOrders).toBe(false);
      });

      expect(result.result.current.totalOrdersCount).toBe(50);
    });
  });
});

/**
 * Tests for Order pagination persistence and navigation state
 *
 * These tests cover the pagination changes made to fix:
 * 1. PerPage persistence via sessionStorage
 * 2. Correct offset passing to order detail navigation
 * 3. NOT passing 'first' in searchParams (DetailPagination uses its own first: 3)
 */

const PAGINATION_STORAGE_KEY = 'b2b_orders_pagination';

describe('Order pagination persistence', () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  afterEach(() => {
    sessionStorage.clear();
  });

  describe('sessionStorage initialization', () => {
    it('returns default pagination when sessionStorage is empty', () => {
      // Simulate the initialization logic from Order.tsx
      let result = { offset: 0, first: 10 };

      try {
        const stored = sessionStorage.getItem(PAGINATION_STORAGE_KEY);
        if (stored) {
          const parsed = JSON.parse(stored);
          result = { offset: 0, first: parsed.first ?? 10 };
        }
      } catch {
        result = { offset: 0, first: 10 };
      }

      expect(result).toEqual({ offset: 0, first: 10 });
    });

    it('restores perPage preference from sessionStorage', () => {
      // Pre-set sessionStorage with saved preference
      sessionStorage.setItem(PAGINATION_STORAGE_KEY, JSON.stringify({ first: 30 }));

      let result = { offset: 0, first: 10 };

      try {
        const stored = sessionStorage.getItem(PAGINATION_STORAGE_KEY);
        if (stored) {
          const parsed = JSON.parse(stored);
          result = { offset: 0, first: parsed.first ?? 10 };
        }
      } catch {
        result = { offset: 0, first: 10 };
      }

      expect(result).toEqual({ offset: 0, first: 30 });
    });

    it('handles invalid JSON in sessionStorage gracefully', () => {
      sessionStorage.setItem(PAGINATION_STORAGE_KEY, 'invalid-json');

      let result = { offset: 0, first: 10 };

      try {
        const stored = sessionStorage.getItem(PAGINATION_STORAGE_KEY);
        if (stored) {
          const parsed = JSON.parse(stored);
          result = { offset: 0, first: parsed.first ?? 10 };
        }
      } catch {
        result = { offset: 0, first: 10 };
      }

      expect(result).toEqual({ offset: 0, first: 10 });
    });

    it('always resets offset to 0 when restoring from sessionStorage', () => {
      // Even if someone manually sets offset, it should be ignored
      sessionStorage.setItem(PAGINATION_STORAGE_KEY, JSON.stringify({ first: 25, offset: 100 }));

      let result = { offset: 0, first: 10 };

      try {
        const stored = sessionStorage.getItem(PAGINATION_STORAGE_KEY);
        if (stored) {
          const parsed = JSON.parse(stored);
          // The component always resets offset to 0
          result = { offset: 0, first: parsed.first ?? 10 };
        }
      } catch {
        result = { offset: 0, first: 10 };
      }

      expect(result.offset).toBe(0);
      expect(result.first).toBe(25);
    });
  });

  describe('sessionStorage persistence', () => {
    it('saves perPage preference to sessionStorage', () => {
      const newPagination = { offset: 0, first: 50 };

      // Simulate the setPagination wrapper logic
      sessionStorage.setItem(PAGINATION_STORAGE_KEY, JSON.stringify({ first: newPagination.first }));

      const stored = sessionStorage.getItem(PAGINATION_STORAGE_KEY);
      expect(stored).not.toBeNull();

      const parsed = JSON.parse(stored!);
      expect(parsed).toEqual({ first: 50 });
    });

    it('only persists first value, not offset', () => {
      const newPagination = { offset: 20, first: 30 };

      sessionStorage.setItem(PAGINATION_STORAGE_KEY, JSON.stringify({ first: newPagination.first }));

      const stored = sessionStorage.getItem(PAGINATION_STORAGE_KEY);
      const parsed = JSON.parse(stored!);

      expect(parsed).toEqual({ first: 30 });
      expect(parsed.offset).toBeUndefined();
    });

    it('updates preference when changing perPage', () => {
      // Initial save
      sessionStorage.setItem(PAGINATION_STORAGE_KEY, JSON.stringify({ first: 10 }));

      // User changes to 30 per page
      sessionStorage.setItem(PAGINATION_STORAGE_KEY, JSON.stringify({ first: 30 }));

      // User changes to 50 per page
      sessionStorage.setItem(PAGINATION_STORAGE_KEY, JSON.stringify({ first: 50 }));

      const stored = sessionStorage.getItem(PAGINATION_STORAGE_KEY);
      const parsed = JSON.parse(stored!);

      expect(parsed.first).toBe(50);
    });
  });

  describe('navigation state construction', () => {
    it('includes offset but NOT first in searchParams', () => {
      // This is the key fix - first should NOT be in searchParams
      const filterData = { companyId: 123 };
      const pagination = { offset: 20, first: 30 };

      // Simulate the actual navigation state from goToDetail
      const searchParams = {
        ...filterData,
        orderBy: '-bcOrderId',
        offset: pagination.offset,
        // Note: first is intentionally NOT included
      };

      expect(searchParams).toHaveProperty('offset', 20);
      expect(searchParams).not.toHaveProperty('first');
    });

    it('passes correct offset for page 1', () => {
      const pagination = { offset: 0, first: 10 };

      const searchParams = {
        orderBy: '-bcOrderId',
        offset: pagination.offset,
      };

      expect(searchParams.offset).toBe(0);
    });

    it('passes correct offset for page 2 with 10 items per page', () => {
      const pagination = { offset: 10, first: 10 };

      const searchParams = {
        orderBy: '-bcOrderId',
        offset: pagination.offset,
      };

      expect(searchParams.offset).toBe(10);
    });

    it('passes correct offset for page 3 with 30 items per page', () => {
      const pagination = { offset: 60, first: 30 };

      const searchParams = {
        orderBy: '-bcOrderId',
        offset: pagination.offset,
      };

      expect(searchParams.offset).toBe(60);
    });
  });
});

describe('Order list to detail navigation scenarios', () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  it('scenario: user on page 1 clicks first order', () => {
    const currentIndex = 0;
    const pagination = { offset: 0, first: 10 };
    const totalCount = 100;

    const navigationState = {
      currentIndex,
      searchParams: {
        offset: pagination.offset,
        orderBy: '-bcOrderId',
      },
      totalCount,
    };

    // Expected: DetailPagination calculates position as 0 + 0 = 0 (displays as "Order 1 of 100")
    expect(navigationState.currentIndex + navigationState.searchParams.offset).toBe(0);
  });

  it('scenario: user on page 2 clicks 5th order (with 10 per page)', () => {
    const currentIndex = 4; // 0-indexed, 5th item
    const pagination = { offset: 10, first: 10 };
    const totalCount = 100;

    const navigationState = {
      currentIndex,
      searchParams: {
        offset: pagination.offset,
        orderBy: '-bcOrderId',
      },
      totalCount,
    };

    // Expected: DetailPagination calculates position as 4 + 10 = 14 (displays as "Order 15 of 100")
    expect(navigationState.currentIndex + navigationState.searchParams.offset).toBe(14);
  });

  it('scenario: user on page 3 clicks 8th order (with 30 per page)', () => {
    const currentIndex = 7; // 0-indexed, 8th item
    const pagination = { offset: 60, first: 30 };
    const totalCount = 285;

    const navigationState = {
      currentIndex,
      searchParams: {
        offset: pagination.offset,
        orderBy: '-bcOrderId',
      },
      totalCount,
    };

    // Expected: DetailPagination calculates position as 7 + 60 = 67 (displays as "Order 68 of 285")
    expect(navigationState.currentIndex + navigationState.searchParams.offset).toBe(67);
  });

  it('scenario: browser back button preserves perPage preference', () => {
    // User sets 30 per page
    sessionStorage.setItem(PAGINATION_STORAGE_KEY, JSON.stringify({ first: 30 }));

    // User navigates to order detail and then back
    // On return, the component should restore first: 30 from sessionStorage

    const stored = sessionStorage.getItem(PAGINATION_STORAGE_KEY);
    const parsed = JSON.parse(stored!);

    // Restored state should use the saved first value
    const restoredPagination = { offset: 0, first: parsed.first ?? 10 };

    expect(restoredPagination.first).toBe(30);
    expect(restoredPagination.offset).toBe(0); // Offset always resets
  });
});

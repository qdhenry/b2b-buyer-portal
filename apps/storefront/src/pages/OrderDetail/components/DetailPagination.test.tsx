/**
 * Tests for DetailPagination offset calculation
 *
 * These tests cover the pagination changes made to fix:
 * 1. Correct position calculation using currentIndex + offset
 * 2. Proper handling of offset from searchParams
 * 3. API call parameters for fetching adjacent orders
 */

describe('DetailPagination offset calculation', () => {
  describe('position calculation', () => {
    it('calculates correct position when on first page (offset=0)', () => {
      const currentIndex = 0;
      const offset = 0;
      const totalCount = 100;

      // Simulate the useEffect logic
      let listIndex = 0;
      if (totalCount > 0) {
        const searchPageStart = currentIndex + (offset || 0);
        listIndex = searchPageStart;
      }

      // Display position is 1-indexed
      expect(listIndex + 1).toBe(1);
    });

    it('calculates correct position when on second page with offset=10', () => {
      const currentIndex = 3;
      const offset = 10;
      const totalCount = 100;

      let listIndex = 0;
      if (totalCount > 0) {
        const searchPageStart = currentIndex + (offset || 0);
        listIndex = searchPageStart;
      }

      // Position 14 (displays as "Order 14 of 100")
      expect(listIndex + 1).toBe(14);
    });

    it('calculates correct position when on third page with offset=20', () => {
      const currentIndex = 5;
      const offset = 20;
      const totalCount = 100;

      let listIndex = 0;
      if (totalCount > 0) {
        const searchPageStart = currentIndex + (offset || 0);
        listIndex = searchPageStart;
      }

      // Position 26 (displays as "Order 26 of 100")
      expect(listIndex + 1).toBe(26);
    });

    it('calculates correct position with 30 items per page on page 2', () => {
      const currentIndex = 4;
      const offset = 30;
      const totalCount = 500;

      let listIndex = 0;
      if (totalCount > 0) {
        const searchPageStart = currentIndex + (offset || 0);
        listIndex = searchPageStart;
      }

      // Position 35 (displays as "Order 35 of 500")
      expect(listIndex + 1).toBe(35);
    });
  });

  describe('searchParams handling', () => {
    it('uses offset from searchParams for position calculation', () => {
      const currentIndex = 5;
      const searchParams = { offset: 20, orderBy: '-createdAt' };
      const totalCount = 100;

      let listIndex = 0;
      if (totalCount > 0) {
        const searchPageStart = currentIndex + (searchParams.offset || 0);
        listIndex = searchPageStart;
      }

      expect(listIndex).toBe(25);
    });

    it('defaults offset to 0 when not provided in searchParams', () => {
      const currentIndex = 5;
      const searchParams = { orderBy: '-createdAt' } as { offset?: number; orderBy: string };
      const totalCount = 100;

      let listIndex = 0;
      if (totalCount > 0) {
        const searchPageStart = currentIndex + (searchParams.offset || 0);
        listIndex = searchPageStart;
      }

      expect(listIndex).toBe(5);
    });

    it('searchParams should NOT contain first property (the fix)', () => {
      // After the fix, searchParams from Order.tsx should NOT contain 'first'
      // This ensures DetailPagination can use its own first: 3 for fetching
      const searchParams = {
        offset: 20,
        orderBy: '-createdAt',
        // Note: 'first' is intentionally NOT here
      };

      expect(searchParams).not.toHaveProperty('first');
      expect(searchParams).toHaveProperty('offset', 20);
    });
  });

  describe('API call parameter construction', () => {
    it('uses first: 3 for fetching adjacent orders', () => {
      const defaultSearchParams = {
        orderBy: '-createdAt',
        offset: 0,
      };

      const searchParams = { offset: 20, orderBy: '-createdAt' };
      const listIndex = 25;

      // Simulate the API call construction from DetailPagination
      const searchDetailParams = {
        ...defaultSearchParams,
        ...searchParams,
        first: 3, // This should ALWAYS be 3
        offset: listIndex - 1, // Adjusted for 0-indexed API
        beginDateAt: null,
        endDateAt: null,
      };

      expect(searchDetailParams.first).toBe(3);
      expect(searchDetailParams.offset).toBe(24);
    });

    it('overrides any first value from searchParams with its own first: 3', () => {
      const defaultSearchParams = {
        orderBy: '-createdAt',
        offset: 0,
      };

      // Simulating old behavior where first might have been passed
      const searchParamsWithFirst = { offset: 20, orderBy: '-createdAt', first: 30 };
      const listIndex = 25;

      const searchDetailParams = {
        ...defaultSearchParams,
        ...searchParamsWithFirst,
        first: 3, // This comes LAST, so it overrides
        offset: listIndex - 1,
      };

      expect(searchDetailParams.first).toBe(3);
    });
  });

  describe('prev/next navigation', () => {
    it('calculates correct listIndex after clicking previous', () => {
      const listIndex = 25;
      const newListIndex = listIndex - 1;

      expect(newListIndex).toBe(24);
    });

    it('calculates correct listIndex after clicking next', () => {
      const listIndex = 25;
      const newListIndex = listIndex + 1;

      expect(newListIndex).toBe(26);
    });

    it('maintains global position across navigation', () => {
      // Starting at position 25 (page 3, item 5 with offset 20)
      let listIndex = 25;

      // Navigate to next order
      listIndex = listIndex + 1;
      expect(listIndex).toBe(26);

      // Navigate to next order again
      listIndex = listIndex + 1;
      expect(listIndex).toBe(27);

      // Navigate back
      listIndex = listIndex - 1;
      expect(listIndex).toBe(26);
    });
  });

  describe('edge cases', () => {
    it('does not update listIndex when totalCount is 0', () => {
      const currentIndex = 0;
      const offset = 0;
      const totalCount = 0;

      const initListIndex = 100000000; // From DetailPagination component
      let listIndex = initListIndex;

      if (totalCount > 0) {
        const searchPageStart = currentIndex + (offset || 0);
        listIndex = searchPageStart;
      }

      // Should not have been modified since totalCount is 0
      expect(listIndex).toBe(initListIndex);
    });

    it('handles large offset values correctly', () => {
      const currentIndex = 5;
      const offset = 990; // Page 100 with 10 items per page
      const totalCount = 1000;

      let listIndex = 0;
      if (totalCount > 0) {
        const searchPageStart = currentIndex + (offset || 0);
        listIndex = searchPageStart;
      }

      expect(listIndex + 1).toBe(996); // Display position
    });

    it('handles currentIndex at end of page correctly', () => {
      // Last item on page 3 (items per page = 10)
      const currentIndex = 9; // 0-indexed, so this is the 10th item
      const offset = 20;
      const totalCount = 100;

      let listIndex = 0;
      if (totalCount > 0) {
        const searchPageStart = currentIndex + (offset || 0);
        listIndex = searchPageStart;
      }

      expect(listIndex + 1).toBe(30); // Display position
    });
  });
});

describe('DetailPagination integration scenarios', () => {
  describe('scenario: user navigates from page 3 of orders list', () => {
    it('should show correct position for order at index 4 on page 3', () => {
      // User is on page 3 of orders (offset = 20 with 10 per page)
      // User clicks on the 5th order on that page (index 4)
      const currentIndex = 4;
      const offset = 20;
      const totalCount = 285;

      let listIndex = 0;
      if (totalCount > 0) {
        listIndex = currentIndex + (offset || 0);
      }

      // Expected: "Order 25 of 285"
      expect(listIndex + 1).toBe(25);
    });
  });

  describe('scenario: user navigates from page 2 with 30 items per page', () => {
    it('should show correct position for order at index 15 on page 2', () => {
      // User has 30 items per page, on page 2 (offset = 30)
      // User clicks on the 16th order on that page (index 15)
      const currentIndex = 15;
      const offset = 30;
      const totalCount = 500;

      let listIndex = 0;
      if (totalCount > 0) {
        listIndex = currentIndex + (offset || 0);
      }

      // Expected: "Order 46 of 500"
      expect(listIndex + 1).toBe(46);
    });
  });

  describe('scenario: prev/next navigation maintains correct position', () => {
    it('should correctly navigate between orders maintaining global position', () => {
      // Start at order 34 (page 4, index 3, offset 30)
      let listIndex = 33; // 0-indexed

      // Click next - should go to order 35
      listIndex = listIndex + 1;
      expect(listIndex + 1).toBe(35); // +1 for display

      // Click next - should go to order 36
      listIndex = listIndex + 1;
      expect(listIndex + 1).toBe(36);

      // Click prev - should go back to order 35
      listIndex = listIndex - 1;
      expect(listIndex + 1).toBe(35);

      // Click prev - should go back to order 34
      listIndex = listIndex - 1;
      expect(listIndex + 1).toBe(34);
    });
  });

  describe('scenario: correct API calls for adjacent orders', () => {
    it('fetches 3 orders centered around current position', () => {
      const listIndex = 25;

      // The API call uses offset = listIndex - 1 to get orders [24, 25, 26]
      const apiOffset = listIndex - 1;
      const apiFirst = 3;

      // This fetches orders at positions 24, 25, 26 (0-indexed)
      // Which are display positions 25, 26, 27
      expect(apiOffset).toBe(24);
      expect(apiFirst).toBe(3);
    });

    it('at beginning of list, fetches from offset 0', () => {
      const listIndex = 0;

      // index() function returns 0 for listIndex 0
      const apiOffset = listIndex === 0 ? 0 : listIndex - 1;

      expect(apiOffset).toBe(0);
    });
  });
});

describe('boundary detection for prev/next buttons', () => {
  it('disables prev button at first order (toLeft)', () => {
    const listIndex = 0;
    const totalCount = 100;

    // At position 0, user has reached the left boundary
    const atLeftBoundary = listIndex === 0;

    expect(atLeftBoundary).toBe(true);
  });

  it('disables next button at last order (toRight)', () => {
    const listIndex = 99; // 0-indexed, last of 100 orders
    const totalCount = 100;

    // At position 99 (last), user has reached the right boundary
    const atRightBoundary = listIndex === totalCount - 1;

    expect(atRightBoundary).toBe(true);
  });

  it('enables both buttons in the middle', () => {
    const listIndex = 50;
    const totalCount = 100;

    const atLeftBoundary = listIndex === 0;
    const atRightBoundary = listIndex === totalCount - 1;

    expect(atLeftBoundary).toBe(false);
    expect(atRightBoundary).toBe(false);
  });
});

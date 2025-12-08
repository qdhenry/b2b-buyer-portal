import { renderHook } from '@testing-library/react';

import { getEpicorOrderId, useOrderCustomizations } from './useOrderCustomizations';
import { OrderData } from './types';

describe('useOrderCustomizations', () => {
  describe('getEpicorOrderId', () => {
    it('returns empty string if order is null', () => {
      expect(getEpicorOrderId(null)).toBe('');
    });

    it('returns empty string if order is undefined', () => {
      expect(getEpicorOrderId(undefined)).toBe('');
    });

    it('extracts epicorOrderId from extraFields', () => {
      const order: OrderData = {
        extraFields: [
          { fieldName: 'otherField', fieldValue: '123' },
          { fieldName: 'epicorOrderId', fieldValue: 'EP-1001' },
        ],
      };
      expect(getEpicorOrderId(order)).toBe('EP-1001');
    });

    it('returns empty string if extraFields exists but does not contain epicorOrderId', () => {
      const order: OrderData = {
        extraFields: [{ fieldName: 'otherField', fieldValue: '123' }],
      };
      expect(getEpicorOrderId(order)).toBe('');
    });

    it('extracts epicorOrderId from extraInfo JSON string', () => {
      const order: OrderData = {
        extraInfo: JSON.stringify([
          { fieldName: 'otherField', fieldValue: '123' },
          { fieldName: 'epicorOrderId', fieldValue: 'EP-1002' },
        ]),
      };
      expect(getEpicorOrderId(order)).toBe('EP-1002');
    });

    it('returns empty string if extraInfo exists but does not contain epicorOrderId', () => {
      const order: OrderData = {
        extraInfo: JSON.stringify([{ fieldName: 'otherField', fieldValue: '123' }]),
      };
      expect(getEpicorOrderId(order)).toBe('');
    });

    it('handles invalid extraInfo JSON gracefully', () => {
      const order: OrderData = {
        extraInfo: '{invalid-json}',
      };
      expect(getEpicorOrderId(order)).toBe('');
    });

    it('prioritizes extraFields over extraInfo', () => {
      const order: OrderData = {
        extraFields: [{ fieldName: 'epicorOrderId', fieldValue: 'EP-FIELD' }],
        extraInfo: JSON.stringify([{ fieldName: 'epicorOrderId', fieldValue: 'EP-INFO' }]),
      };
      expect(getEpicorOrderId(order)).toBe('EP-FIELD');
    });
  });

  describe('hook', () => {
    it('initializes with empty epicorOrderId', () => {
      const { result } = renderHook(() => useOrderCustomizations({ order: null }));
      expect(result.current.epicorOrderId).toBe('');
    });

    it('updates epicorOrderId when order changes', () => {
      const order1: OrderData = {
        extraFields: [{ fieldName: 'epicorOrderId', fieldValue: 'EP-1' }],
      };
      const order2: OrderData = {
        extraFields: [{ fieldName: 'epicorOrderId', fieldValue: 'EP-2' }],
      };

      const { result, rerender } = renderHook(({ order }) => useOrderCustomizations({ order }), {
        initialProps: { order: order1 },
      });

      expect(result.current.epicorOrderId).toBe('EP-1');

      rerender({ order: order2 });
      expect(result.current.epicorOrderId).toBe('EP-2');
    });

    describe('getDisplayOrderId', () => {
      it('returns epicorOrderId if available', () => {
        const order: OrderData = {
          extraFields: [{ fieldName: 'epicorOrderId', fieldValue: 'EP-123' }],
        };
        const { result } = renderHook(() => useOrderCustomizations({ order }));

        expect(result.current.getDisplayOrderId('BC-123')).toBe('EP-123');
      });

      it('returns fallbackOrderId if epicorOrderId is missing', () => {
        const order: OrderData = { extraFields: [] };
        const { result } = renderHook(() => useOrderCustomizations({ order }));

        expect(result.current.getDisplayOrderId('BC-123')).toBe('BC-123');
      });
    });
  });
});

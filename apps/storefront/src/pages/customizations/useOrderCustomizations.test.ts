import { renderHook } from '@testing-library/react';

import {
  getEpicorOrderId,
  useOrderCustomizations,
} from './useOrderCustomizations';
import { OrderData } from './types';

describe('useOrderCustomizations', () => {
  describe('getEpicorOrderId', () => {
    it('returns empty string if order is null', () => {
      expect(getEpicorOrderId(null)).toBe('');
    });

    it('returns empty string if order is undefined', () => {
      expect(getEpicorOrderId(undefined)).toBe('');
    });

    it('extracts epicoreOrderId from extraFields', () => {
      const order: OrderData = {
        extraFields: [
          { fieldName: 'otherField', fieldValue: '123' },
          { fieldName: 'epicoreOrderId', fieldValue: 'EP-1001' },
        ],
      };
      expect(getEpicorOrderId(order)).toBe('EP-1001');
    });

    it('returns empty string if extraFields exists but does not contain epicoreOrderId', () => {
      const order: OrderData = {
        extraFields: [
          { fieldName: 'otherField', fieldValue: '123' },
        ],
      };
      expect(getEpicorOrderId(order)).toBe('');
    });

    it('extracts epicoreOrderId from extraInfo JSON string', () => {
      const order: OrderData = {
        extraInfo: JSON.stringify([
          { fieldName: 'otherField', fieldValue: '123' },
          { fieldName: 'epicoreOrderId', fieldValue: 'EP-1002' },
        ]),
      };
      expect(getEpicorOrderId(order)).toBe('EP-1002');
    });

    it('returns empty string if extraInfo exists but does not contain epicoreOrderId', () => {
      const order: OrderData = {
        extraInfo: JSON.stringify([
          { fieldName: 'otherField', fieldValue: '123' },
        ]),
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
        extraFields: [
          { fieldName: 'epicoreOrderId', fieldValue: 'EP-FIELD' },
        ],
        extraInfo: JSON.stringify([
          { fieldName: 'epicoreOrderId', fieldValue: 'EP-INFO' },
        ]),
      };
      expect(getEpicorOrderId(order)).toBe('EP-FIELD');
    });
  });

  describe('hook', () => {
    it('initializes with empty epicoreOrderId', () => {
      const { result } = renderHook(() => useOrderCustomizations({ order: null }));
      expect(result.current.epicoreOrderId).toBe('');
    });

    it('updates epicoreOrderId when order changes', () => {
      const order1: OrderData = { extraFields: [{ fieldName: 'epicoreOrderId', fieldValue: 'EP-1' }] };
      const order2: OrderData = { extraFields: [{ fieldName: 'epicoreOrderId', fieldValue: 'EP-2' }] };

      const { result, rerender } = renderHook(
        ({ order }) => useOrderCustomizations({ order }),
        { initialProps: { order: order1 } }
      );

      expect(result.current.epicoreOrderId).toBe('EP-1');

      rerender({ order: order2 });
      expect(result.current.epicoreOrderId).toBe('EP-2');
    });

    describe('getDisplayOrderId', () => {
      it('returns epicoreOrderId if available', () => {
        const order: OrderData = { extraFields: [{ fieldName: 'epicoreOrderId', fieldValue: 'EP-123' }] };
        const { result } = renderHook(() => useOrderCustomizations({ order }));
        
        expect(result.current.getDisplayOrderId('BC-123')).toBe('EP-123');
      });

      it('returns fallbackOrderId if epicoreOrderId is missing', () => {
        const order: OrderData = { extraFields: [] };
        const { result } = renderHook(() => useOrderCustomizations({ order }));
        
        expect(result.current.getDisplayOrderId('BC-123')).toBe('BC-123');
      });
    });
  });
});

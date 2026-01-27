import { describe, expect, it, vi, beforeEach, Mock } from 'vitest';

import {
  parseEpicorLotPackSlip,
  getBcOrderIdFromInvoice,
  fetchOrderAddresses,
  createLotPackSlipLookup,
  LotPackSlipItem,
} from './invoiceHelpers';
import { ExtraField } from './types';

// Mock the order API
vi.mock('../../shared/service/b2b/graphql/orders', () => ({
  getB2BOrderDetails: vi.fn(),
  getBCOrderDetails: vi.fn(),
}));

import { getB2BOrderDetails, getBCOrderDetails } from '../../shared/service/b2b/graphql/orders';

describe('parseEpicorLotPackSlip', () => {
  it('should return an empty array when extraFields is undefined', () => {
    const result = parseEpicorLotPackSlip(undefined);
    expect(result).toEqual([]);
  });

  it('should return an empty array when extraFields is empty', () => {
    const result = parseEpicorLotPackSlip([]);
    expect(result).toEqual([]);
  });

  it('should return an empty array when epicorLotPackSlip field is not present', () => {
    const extraFields: ExtraField[] = [
      { fieldName: 'otherField', fieldValue: 'some value' },
    ];
    const result = parseEpicorLotPackSlip(extraFields);
    expect(result).toEqual([]);
  });

  it('should return an empty array when epicorLotPackSlip fieldValue is empty', () => {
    const extraFields: ExtraField[] = [
      { fieldName: 'epicorLotPackSlip', fieldValue: '' },
    ];
    const result = parseEpicorLotPackSlip(extraFields);
    expect(result).toEqual([]);
  });

  it('should return an empty array when JSON is invalid', () => {
    const extraFields: ExtraField[] = [
      { fieldName: 'epicorLotPackSlip', fieldValue: 'not valid json' },
    ];
    const result = parseEpicorLotPackSlip(extraFields);
    expect(result).toEqual([]);
  });

  it('should return an empty array when JSON is not an array', () => {
    const extraFields: ExtraField[] = [
      { fieldName: 'epicorLotPackSlip', fieldValue: '{"sku":"test"}' },
    ];
    const result = parseEpicorLotPackSlip(extraFields);
    expect(result).toEqual([]);
  });

  it('should parse valid epicorLotPackSlip data correctly', () => {
    const lotPackSlipData: LotPackSlipItem[] = [
      {
        sku: 'CS-AFB/25',
        tracking_num: '',
        lot_num: '213',
        pack_num: '1842617',
        pack_line: '1',
      },
      {
        sku: 'CST0225P',
        tracking_num: 'TRACK123',
        lot_num: 'TONS39',
        pack_num: '1842617',
        pack_line: '2',
      },
    ];

    const extraFields: ExtraField[] = [
      { fieldName: 'epicorLotPackSlip', fieldValue: JSON.stringify(lotPackSlipData) },
    ];

    const result = parseEpicorLotPackSlip(extraFields);
    expect(result).toEqual(lotPackSlipData);
  });

  it('should handle single item array', () => {
    const lotPackSlipData: LotPackSlipItem[] = [
      {
        sku: 'TEST-SKU',
        tracking_num: 'TRACK456',
        lot_num: 'LOT123',
        pack_num: '9999',
        pack_line: '1',
      },
    ];

    const extraFields: ExtraField[] = [
      { fieldName: 'epicorLotPackSlip', fieldValue: JSON.stringify(lotPackSlipData) },
    ];

    const result = parseEpicorLotPackSlip(extraFields);
    expect(result).toHaveLength(1);
    expect(result[0].sku).toBe('TEST-SKU');
    expect(result[0].tracking_num).toBe('TRACK456');
    expect(result[0].lot_num).toBe('LOT123');
    expect(result[0].pack_num).toBe('9999');
  });

  it('should parse data even when other extraFields are present', () => {
    const lotPackSlipData: LotPackSlipItem[] = [
      {
        sku: 'ITEM-1',
        tracking_num: '',
        lot_num: 'L1',
        pack_num: '1001',
        pack_line: '1',
      },
    ];

    const extraFields: ExtraField[] = [
      { fieldName: 'someOtherField', fieldValue: 'value1' },
      { fieldName: 'epicorLotPackSlip', fieldValue: JSON.stringify(lotPackSlipData) },
      { fieldName: 'anotherField', fieldValue: 'value2' },
    ];

    const result = parseEpicorLotPackSlip(extraFields);
    expect(result).toEqual(lotPackSlipData);
  });

  it('should handle empty JSON array', () => {
    const extraFields: ExtraField[] = [
      { fieldName: 'epicorLotPackSlip', fieldValue: '[]' },
    ];

    const result = parseEpicorLotPackSlip(extraFields);
    expect(result).toEqual([]);
  });
});

describe('getBcOrderIdFromInvoice', () => {
  it('should return null when extraFields is undefined', () => {
    expect(getBcOrderIdFromInvoice(undefined)).toBeNull();
  });

  it('should return null when extraFields is empty', () => {
    expect(getBcOrderIdFromInvoice([])).toBeNull();
  });

  it('should return null when bcOrderId field is not present', () => {
    const extraFields: ExtraField[] = [{ fieldName: 'epicorOrderId', fieldValue: '1960274' }];
    expect(getBcOrderIdFromInvoice(extraFields)).toBeNull();
  });

  it('should return null when bcOrderId fieldValue is empty', () => {
    const extraFields: ExtraField[] = [{ fieldName: 'bcOrderId', fieldValue: '' }];
    expect(getBcOrderIdFromInvoice(extraFields)).toBeNull();
  });

  it('should return null when bcOrderId is not a valid number', () => {
    const extraFields: ExtraField[] = [{ fieldName: 'bcOrderId', fieldValue: 'abc' }];
    expect(getBcOrderIdFromInvoice(extraFields)).toBeNull();
  });

  it('should return the order ID when bcOrderId is valid', () => {
    const extraFields: ExtraField[] = [{ fieldName: 'bcOrderId', fieldValue: '842' }];
    expect(getBcOrderIdFromInvoice(extraFields)).toBe(842);
  });

  it('should extract bcOrderId from among other fields', () => {
    const extraFields: ExtraField[] = [
      { fieldName: 'epicorOrderId', fieldValue: '1960274' },
      { fieldName: 'bcOrderId', fieldValue: '842' },
      { fieldName: 'epicorLotPackSlip', fieldValue: '[]' },
    ];
    expect(getBcOrderIdFromInvoice(extraFields)).toBe(842);
  });
});

describe('fetchOrderAddresses', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return null addresses when extraFields is undefined', async () => {
    const result = await fetchOrderAddresses(undefined, true);
    expect(result).toEqual({ billingAddress: null, shippingAddress: null });
    expect(getB2BOrderDetails).not.toHaveBeenCalled();
  });

  it('should return null addresses when bcOrderId is not found', async () => {
    const extraFields: ExtraField[] = [{ fieldName: 'epicorOrderId', fieldValue: '1960274' }];
    const result = await fetchOrderAddresses(extraFields, true);
    expect(result).toEqual({ billingAddress: null, shippingAddress: null });
  });

  it('should call getB2BOrderDetails for B2B users', async () => {
    const mockBillingAddress = { street_1: '123 Main St', city: 'Test City' };
    const mockShippingAddress = [{ street_1: '456 Ship St', city: 'Ship City' }];

    (getB2BOrderDetails as Mock).mockResolvedValue({
      billingAddress: mockBillingAddress,
      shippingAddress: mockShippingAddress,
    });

    const extraFields: ExtraField[] = [{ fieldName: 'bcOrderId', fieldValue: '842' }];

    const result = await fetchOrderAddresses(extraFields, true);

    expect(getB2BOrderDetails).toHaveBeenCalledWith(842);
    expect(result.billingAddress).toEqual(mockBillingAddress);
    expect(result.shippingAddress).toEqual(mockShippingAddress[0]);
  });

  it('should call getBCOrderDetails for non-B2B users', async () => {
    (getBCOrderDetails as Mock).mockResolvedValue({
      billingAddress: null,
      shippingAddress: false,
    });

    const extraFields: ExtraField[] = [{ fieldName: 'bcOrderId', fieldValue: '100' }];

    await fetchOrderAddresses(extraFields, false);

    expect(getBCOrderDetails).toHaveBeenCalledWith(100);
    expect(getB2BOrderDetails).not.toHaveBeenCalled();
  });

  it('should handle API errors gracefully', async () => {
    (getB2BOrderDetails as Mock).mockRejectedValue(new Error('API Error'));

    const extraFields: ExtraField[] = [{ fieldName: 'bcOrderId', fieldValue: '842' }];

    const result = await fetchOrderAddresses(extraFields, true);

    expect(result).toEqual({ billingAddress: null, shippingAddress: null });
  });

  it('should handle shippingAddress being false', async () => {
    (getB2BOrderDetails as Mock).mockResolvedValue({
      billingAddress: { street_1: '123 Main St' },
      shippingAddress: false,
    });

    const extraFields: ExtraField[] = [{ fieldName: 'bcOrderId', fieldValue: '842' }];

    const result = await fetchOrderAddresses(extraFields, true);

    expect(result.billingAddress).toEqual({ street_1: '123 Main St' });
    expect(result.shippingAddress).toBeNull();
  });

  it('should handle empty shippingAddress array', async () => {
    (getB2BOrderDetails as Mock).mockResolvedValue({
      billingAddress: { street_1: '123 Main St' },
      shippingAddress: [],
    });

    const extraFields: ExtraField[] = [{ fieldName: 'bcOrderId', fieldValue: '842' }];

    const result = await fetchOrderAddresses(extraFields, true);

    expect(result.shippingAddress).toBeNull();
  });
});

describe('createLotPackSlipLookup', () => {
  it('should return empty map when extraFields is undefined', () => {
    const result = createLotPackSlipLookup(undefined);
    expect(result.size).toBe(0);
  });

  it('should return empty map when extraFields is empty', () => {
    const result = createLotPackSlipLookup([]);
    expect(result.size).toBe(0);
  });

  it('should create a map keyed by pack_line', () => {
    const extraFields: ExtraField[] = [
      {
        fieldName: 'epicorLotPackSlip',
        fieldValue: JSON.stringify([
          { sku: 'SKU-A', tracking_num: '', lot_num: 'L1', pack_num: '1001', pack_line: '1' },
          { sku: 'SKU-B', tracking_num: '', lot_num: 'L2', pack_num: '1001', pack_line: '2' },
        ]),
      },
    ];

    const result = createLotPackSlipLookup(extraFields);

    expect(result.size).toBe(2);
    expect(result.get(1)?.sku).toBe('SKU-A');
    expect(result.get(2)?.sku).toBe('SKU-B');
  });

  it('should handle same SKU with different pack_nums correctly', () => {
    const extraFields: ExtraField[] = [
      {
        fieldName: 'epicorLotPackSlip',
        fieldValue: JSON.stringify([
          { sku: 'CS-PAS/25', tracking_num: '', lot_num: '82037H', pack_num: '1842617', pack_line: '3' },
          { sku: 'CS-PAS/25', tracking_num: '', lot_num: '89337H', pack_num: '994944', pack_line: '4' },
        ]),
      },
    ];

    const result = createLotPackSlipLookup(extraFields);

    expect(result.size).toBe(2);
    // Line 3 should have pack_num 1842617
    expect(result.get(3)?.pack_num).toBe('1842617');
    expect(result.get(3)?.lot_num).toBe('82037H');
    // Line 4 should have pack_num 994944 (NOT 1842617)
    expect(result.get(4)?.pack_num).toBe('994944');
    expect(result.get(4)?.lot_num).toBe('89337H');
  });

  it('should skip items with invalid pack_line', () => {
    const extraFields: ExtraField[] = [
      {
        fieldName: 'epicorLotPackSlip',
        fieldValue: JSON.stringify([
          { sku: 'SKU-A', tracking_num: '', lot_num: 'L1', pack_num: '1001', pack_line: '1' },
          { sku: 'SKU-B', tracking_num: '', lot_num: 'L2', pack_num: '1002', pack_line: 'invalid' },
          { sku: 'SKU-C', tracking_num: '', lot_num: 'L3', pack_num: '1003', pack_line: '' },
        ]),
      },
    ];

    const result = createLotPackSlipLookup(extraFields);

    expect(result.size).toBe(1);
    expect(result.get(1)?.sku).toBe('SKU-A');
    expect(result.has(2)).toBe(false);
  });

  it('should handle the full production data scenario', () => {
    // This test mirrors the exact bug scenario
    const extraFields: ExtraField[] = [
      {
        fieldName: 'epicorLotPackSlip',
        fieldValue: JSON.stringify([
          { sku: 'CS-AFB/25', tracking_num: '12485099993', lot_num: '213', pack_num: '1842617', pack_line: '1' },
          { sku: 'CST0225P', tracking_num: '99384849348', lot_num: 'TONS39', pack_num: '1842617', pack_line: '2' },
          { sku: 'CS-PAS/25', tracking_num: '484858333', lot_num: '82037H', pack_num: '1842617', pack_line: '3' },
          { sku: 'CS-PAS/25', tracking_num: '4848848484', lot_num: '89337H', pack_num: '994944', pack_line: '4' },
        ]),
      },
    ];

    const result = createLotPackSlipLookup(extraFields);

    expect(result.size).toBe(4);

    // Simulate PDF line item lookup (0-indexed to 1-indexed)
    const lineItem0Data = result.get(0 + 1); // Line 1
    const lineItem1Data = result.get(1 + 1); // Line 2
    const lineItem2Data = result.get(2 + 1); // Line 3
    const lineItem3Data = result.get(3 + 1); // Line 4

    expect(lineItem0Data?.sku).toBe('CS-AFB/25');
    expect(lineItem0Data?.pack_num).toBe('1842617');

    expect(lineItem1Data?.sku).toBe('CST0225P');
    expect(lineItem1Data?.pack_num).toBe('1842617');

    expect(lineItem2Data?.sku).toBe('CS-PAS/25');
    expect(lineItem2Data?.pack_num).toBe('1842617');

    // THE KEY TEST: Line 4 should get 994944, not 1842617
    expect(lineItem3Data?.sku).toBe('CS-PAS/25');
    expect(lineItem3Data?.pack_num).toBe('994944'); // Not 1842617!
    expect(lineItem3Data?.lot_num).toBe('89337H');
  });
});

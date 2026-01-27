import { describe, expect, it } from 'vitest';

import { parseEpicorLotPackSlip, LotPackSlipItem } from './invoiceHelpers';
import { ExtraField } from './types';

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

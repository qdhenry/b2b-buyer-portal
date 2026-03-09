import { describe, expect, it, vi, beforeEach, Mock } from 'vitest';

import { InvoiceList } from '@/types/invoice';

import { enrichInvoiceForPdf } from './pdf';

vi.mock('@/pages/customizations/invoiceHelpers', () => ({
  getBcOrderIdFromInvoice: vi.fn(),
}));

vi.mock('@/shared/service/b2b/graphql/orders', () => ({
  getB2BOrderDetails: vi.fn(),
  getBCOrderDetails: vi.fn(),
}));

vi.mock('@/utils/pdf/InvoicePdfGenerator', () => ({
  InvoicePdfGenerator: {
    loadLogo: vi.fn(),
  },
}));

import { getBcOrderIdFromInvoice } from '@/pages/customizations/invoiceHelpers';
import { getB2BOrderDetails, getBCOrderDetails } from '@/shared/service/b2b/graphql/orders';

const makeInvoice = (overrides: Partial<InvoiceList> = {}): InvoiceList =>
  ({
    id: '1',
    invoiceNumber: 'INV-001',
    orderNumber: '',
    purchaseOrderNumber: 'PO-001',
    dueDate: 0,
    notAllowedPay: 0,
    status: 0,
    pendingPaymentCount: 0,
    openBalance: { code: 'USD', value: '100' },
    originalBalance: { code: 'USD', value: '100' },
    orderUserId: 1,
    companyInfo: { companyName: 'Test Co' },
    details: { header: {}, details: { line_items: [] } },
    extraFields: [],
    ...overrides,
  }) as unknown as InvoiceList;

describe('enrichInvoiceForPdf', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return original invoice when no orderId is resolvable', async () => {
    (getBcOrderIdFromInvoice as Mock).mockReturnValue(null);
    const invoice = makeInvoice({ orderNumber: '' });

    const result = await enrichInvoiceForPdf(invoice, true);

    expect(result).toBe(invoice);
    expect(getB2BOrderDetails).not.toHaveBeenCalled();
  });

  it('should use bcOrderId from extraFields when available', async () => {
    (getBcOrderIdFromInvoice as Mock).mockReturnValue(151);
    (getB2BOrderDetails as Mock).mockResolvedValue({
      products: [{ sku: 'NB0507', name: 'Product A' }],
      billingAddress: null,
      shippingAddress: [],
    });

    const invoice = makeInvoice({ orderNumber: '151' });

    const result = await enrichInvoiceForPdf(invoice, true);

    expect(getB2BOrderDetails).toHaveBeenCalledWith(151);
    expect(result.orderProducts).toEqual([{ sku: 'NB0507', name: 'Product A' }]);
  });

  it('should fall back to invoice.orderNumber when bcOrderId is not in extraFields', async () => {
    (getBcOrderIdFromInvoice as Mock).mockReturnValue(null);
    (getB2BOrderDetails as Mock).mockResolvedValue({
      products: [{ sku: 'NB0507', name: 'Product A', product_options: [{ display_value: 'Size 5' }] }],
      billingAddress: null,
      shippingAddress: [],
    });

    const invoice = makeInvoice({ orderNumber: '151' });

    const result = await enrichInvoiceForPdf(invoice, true);

    expect(getB2BOrderDetails).toHaveBeenCalledWith(151);
    expect(result.orderProducts).toHaveLength(1);
    expect(result.orderProducts![0].sku).toBe('NB0507');
  });

  it('should not fall back to orderNumber when it is non-numeric', async () => {
    (getBcOrderIdFromInvoice as Mock).mockReturnValue(null);

    const invoice = makeInvoice({ orderNumber: 'not-a-number' });

    const result = await enrichInvoiceForPdf(invoice, true);

    expect(result).toBe(invoice);
    expect(getB2BOrderDetails).not.toHaveBeenCalled();
  });

  it('should call getBCOrderDetails for non-B2B users', async () => {
    (getBcOrderIdFromInvoice as Mock).mockReturnValue(null);
    (getBCOrderDetails as Mock).mockResolvedValue({
      products: [{ sku: 'SKU-1', name: 'Product BC' }],
      billingAddress: null,
      shippingAddress: [],
    });

    const invoice = makeInvoice({ orderNumber: '200' });

    const result = await enrichInvoiceForPdf(invoice, false);

    expect(getBCOrderDetails).toHaveBeenCalledWith(200);
    expect(getB2BOrderDetails).not.toHaveBeenCalled();
    expect(result.orderProducts).toHaveLength(1);
  });

  it('should populate orderBillingAddress when invoice has no billing address', async () => {
    (getBcOrderIdFromInvoice as Mock).mockReturnValue(null);
    const mockBilling = { street_1: '123 Main St', city: 'Test City' };
    (getB2BOrderDetails as Mock).mockResolvedValue({
      products: [],
      billingAddress: mockBilling,
      shippingAddress: [],
    });

    const invoice = makeInvoice({ orderNumber: '100' });

    const result = await enrichInvoiceForPdf(invoice, true);

    expect(result.orderBillingAddress).toEqual(mockBilling);
  });

  it('should not overwrite existing billing address from invoice header', async () => {
    (getBcOrderIdFromInvoice as Mock).mockReturnValue(null);
    (getB2BOrderDetails as Mock).mockResolvedValue({
      products: [],
      billingAddress: { street_1: 'Order Address' },
      shippingAddress: [],
    });

    const invoice = makeInvoice({
      orderNumber: '100',
      details: {
        header: { billing_address: { street_1: 'Invoice Address' } },
        details: { line_items: [] },
      } as any,
    });

    const result = await enrichInvoiceForPdf(invoice, true);

    expect(result.orderBillingAddress).toBeUndefined();
  });

  it('should populate orderShippingAddress when invoice has no shipping address', async () => {
    (getBcOrderIdFromInvoice as Mock).mockReturnValue(null);
    const mockShipping = { street_1: '456 Ship St', city: 'Ship City' };
    (getB2BOrderDetails as Mock).mockResolvedValue({
      products: [],
      billingAddress: null,
      shippingAddress: [mockShipping],
    });

    const invoice = makeInvoice({ orderNumber: '100' });

    const result = await enrichInvoiceForPdf(invoice, true);

    expect(result.orderShippingAddress).toEqual(mockShipping);
  });

  it('should return original invoice when API call fails', async () => {
    (getBcOrderIdFromInvoice as Mock).mockReturnValue(null);
    (getB2BOrderDetails as Mock).mockRejectedValue(new Error('API Error'));

    const invoice = makeInvoice({ orderNumber: '100' });

    const result = await enrichInvoiceForPdf(invoice, true);

    expect(result).toBe(invoice);
    expect(result.orderProducts).toBeUndefined();
  });

  it('should handle orderDetails with no products gracefully', async () => {
    (getBcOrderIdFromInvoice as Mock).mockReturnValue(null);
    (getB2BOrderDetails as Mock).mockResolvedValue({
      products: undefined,
      billingAddress: null,
      shippingAddress: [],
    });

    const invoice = makeInvoice({ orderNumber: '100' });

    const result = await enrichInvoiceForPdf(invoice, true);

    expect(result.orderProducts).toEqual([]);
  });
});

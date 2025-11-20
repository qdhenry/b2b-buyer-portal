import { useParams } from 'react-router-dom';
import {
  buildCompanyStateWith,
  buildStoreInfoStateWith,
  graphql,
  HttpResponse,
  renderWithProviders,
  screen,
  startMockServer,
  waitForElementToBeRemoved,
} from 'tests/test-utils';
import { when } from 'vitest-when';

import { CustomerRole } from '@/types';

import Invoice from '.';

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useParams: vi.fn(),
  };
});

const { server } = startMockServer();

describe('Invoice Epicor ID Display', () => {
  const preloadedState = {
    company: buildCompanyStateWith({
      customer: {
        role: CustomerRole.SUPER_ADMIN, // B2B User
      },
    }),
    storeInfo: buildStoreInfoStateWith({}),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useParams).mockReturnValue({}); // No params for Invoice list

    server.use(
      // Mock getInvoiceStats to avoid errors
      graphql.query('GetInvoiceStats', () =>
        HttpResponse.json({
          data: { invoiceStats: { overDueBalance: '0', totalBalance: '0' } },
        }),
      ),
      // Mock getOrdersCreatedByUser to avoid errors
      graphql.query('GetOrdersCreatedByUser', () =>
        HttpResponse.json({ data: { createdByUser: { results: [] } } }),
      ),
    );
  });

  it('displays Epicor Order ID in the order column if available', async () => {
    const invoiceListResponse = {
      data: {
        invoices: {
          totalCount: 1,
          edges: [
            {
              node: {
                id: 'inv-001',
                orderNumber: 'BC-123',
                invoiceNumber: 'INV-001',
                dueDate: 1735689600, // Jan 1, 2025
                createdAt: 1733000000,
                status: 0,
                openBalance: { code: 'USD', value: '100.00' },
                originalBalance: { code: 'USD', value: '100.00' },
                companyInfo: { companyId: '1', companyName: 'Test Company' },
                extraInfo: JSON.stringify([
                  { fieldName: 'epicoreOrderId', fieldValue: 'EPICOR-ORD-XYZ' },
                ]),
              },
            },
          ],
        },
      },
    };

    // Mock getInvoiceList to return an invoice with extraInfo containing epicoreOrderId
    server.use(
      graphql.query('GetInvoiceList', () => HttpResponse.json(invoiceListResponse)),
      // Mock getOrdersExtraFields for BC-123 to return the extraFields
      graphql.query('GetOrdersDetails', ({ query }) => {
        if (query.includes('order(id: BC-123)')) {
          return HttpResponse.json({
            data: {
              order_BC_123: {
                id: 'BC-123',
                extraFields: [{ fieldName: 'epicoreOrderId', fieldValue: 'EPICOR-ORD-XYZ' }],
              },
            },
          });
        }
        return HttpResponse.json({ errors: [{ message: 'Not found' }] });
      }),
    );

    renderWithProviders(<Invoice />, { preloadedState });

    await waitForElementToBeRemoved(() => screen.queryAllByRole('progressbar'));

    // Verify that the Epicor Order ID is displayed in the 'order' column
    expect(screen.getByText('EPICOR-ORD-XYZ')).toBeInTheDocument();
    expect(screen.queryByText('BC-123')).not.toBeInTheDocument();
  });

  it('displays original Order Number if Epicor ID is not available', async () => {
    const invoiceListResponse = {
      data: {
        invoices: {
          totalCount: 1,
          edges: [
            {
              node: {
                id: 'inv-002',
                orderNumber: 'BC-456',
                invoiceNumber: 'INV-002',
                dueDate: 1735689600, // Jan 1, 2025
                createdAt: 1733000000,
                status: 0,
                openBalance: { code: 'USD', value: '200.00' },
                originalBalance: { code: 'USD', value: '200.00' },
                companyInfo: { companyId: '1', companyName: 'Test Company' },
                // No extraInfo or extraFields with epicoreOrderId
              },
            },
          ],
        },
      },
    };

    server.use(
      graphql.query('GetInvoiceList', () => HttpResponse.json(invoiceListResponse)),
      // Mock getOrdersExtraFields for BC-456 to return no extraFields
      graphql.query('GetOrdersDetails', ({ query }) => {
        if (query.includes('order(id: BC-456)')) {
          return HttpResponse.json({
            data: {
              order_BC_456: {
                id: 'BC-456',
                extraFields: [],
              },
            },
          });
        }
        return HttpResponse.json({ errors: [{ message: 'Not found' }] });
      }),
    );

    renderWithProviders(<Invoice />, { preloadedState });

    await waitForElementToBeRemoved(() => screen.queryAllByRole('progressbar'));

    // Verify that the original Order Number is displayed
    expect(screen.getByText('BC-456')).toBeInTheDocument();
    expect(screen.queryByText('EPICOR-ORD-XYZ')).not.toBeInTheDocument();
  });

  it('navigates to OrderDetail with the original orderNumber', async () => {
    const invoiceListResponse = {
      data: {
        invoices: {
          totalCount: 1,
          edges: [
            {
              node: {
                id: 'inv-003',
                orderNumber: 'BC-789',
                invoiceNumber: 'INV-003',
                dueDate: 1735689600, // Jan 1, 2025
                createdAt: 1733000000,
                status: 0,
                openBalance: { code: 'USD', value: '300.00' },
                originalBalance: { code: 'USD', value: '300.00' },
                companyInfo: { companyId: '1', companyName: 'Test Company' },
                extraInfo: JSON.stringify([
                  { fieldName: 'epicoreOrderId', fieldValue: 'EPICOR-ORD-QWE' },
                ]),
              },
            },
          ],
        },
      },
    };

    // Mock getInvoiceList to return an invoice with extraInfo containing epicoreOrderId
    server.use(
      graphql.query('GetInvoiceList', () => HttpResponse.json(invoiceListResponse)),
      graphql.query('GetOrdersDetails', ({ query }) => {
        if (query.includes('order(id: BC-789)')) {
          return HttpResponse.json({
            data: {
              order_BC_789: {
                id: 'BC-789',
                extraFields: [{ fieldName: 'epicoreOrderId', fieldValue: 'EPICOR-ORD-QWE' }],
              },
            },
          });
        }
        return HttpResponse.json({ errors: [{ message: 'Not found' }] });
      }),
    );

    const { navigation } = renderWithProviders(<Invoice />, { preloadedState });

    await waitForElementToBeRemoved(() => screen.queryAllByRole('progressbar'));

    const orderNumberElement = screen.getByRole('button', { name: 'EPICOR-ORD-QWE' });
    await userEvent.click(orderNumberElement);

    // Expect navigation to use the original BigCommerce order number
    expect(navigation).toHaveBeenCalledWith('/orderDetail/BC-789');
  });
});

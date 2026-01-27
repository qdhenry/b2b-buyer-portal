import { fetchOrderAddresses } from '@/pages/customizations/invoiceHelpers';
import { InvoiceList } from '@/types/invoice';
import { InvoicePdfGenerator, LogoData } from '@/utils/pdf/InvoicePdfGenerator';

// Cache the logo to avoid reloading on each PDF generation
let cachedLogo: LogoData | null = null;

const loadLogoIfNeeded = async (): Promise<LogoData | undefined> => {
  if (cachedLogo) {
    return cachedLogo;
  }
  try {
    cachedLogo = await InvoicePdfGenerator.loadLogo();
    return cachedLogo;
  } catch (error) {
    console.warn('Failed to load logo for invoice PDF:', error);
    return undefined;
  }
};

/**
 * Enriches invoice data with order addresses when invoice header addresses are missing.
 * This ensures the PDF "Sold To" and "Ship To" sections are populated.
 */
const enrichInvoiceWithOrderAddresses = async (
  invoice: InvoiceList,
  isB2BUser: boolean
): Promise<InvoiceList> => {
  // Check if invoice already has address data in header
  const hasBillingAddress = !!invoice.details?.header?.billing_address?.street_1;
  const hasShippingAddress = !!invoice.details?.header?.shipping_addresses?.[0]?.street_1;

  if (hasBillingAddress && hasShippingAddress) {
    return invoice; // Already has addresses, no need to fetch
  }

  // Fetch addresses from the linked order using bcOrderId from extraFields
  // Note: invoice.orderNumber is always null; the actual BC order ID is in extraFields.bcOrderId
  const { billingAddress, shippingAddress } = await fetchOrderAddresses(
    invoice.extraFields,
    isB2BUser
  );

  return {
    ...invoice,
    orderBillingAddress: billingAddress || undefined,
    orderShippingAddress: shippingAddress || undefined,
  };
};

export const getInvoicePdfUrl = async (
  invoice: InvoiceList,
  isB2BUser: boolean = true
): Promise<string> => {
  const logo = await loadLogoIfNeeded();

  // Fetch order addresses if invoice header is missing address data
  const invoiceWithAddresses = await enrichInvoiceWithOrderAddresses(invoice, isB2BUser);

  const generator = new InvoicePdfGenerator(invoiceWithAddresses, logo);
  generator.generate();
  return generator.getBlobUrl();
};

export const downloadInvoicePdf = async (
  invoice: InvoiceList,
  isB2BUser: boolean = true
): Promise<void> => {
  const logo = await loadLogoIfNeeded();

  // Fetch order addresses if invoice header is missing address data
  const invoiceWithAddresses = await enrichInvoiceWithOrderAddresses(invoice, isB2BUser);

  const generator = new InvoicePdfGenerator(invoiceWithAddresses, logo);
  generator.generate();
  generator.save();
};

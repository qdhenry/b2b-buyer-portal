import {
  getBcOrderIdFromInvoice,
} from '@/pages/customizations/invoiceHelpers';
import { getB2BOrderDetails, getBCOrderDetails } from '@/shared/service/b2b/graphql/orders';
import { Address } from '@/types/global';
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
 * Enriches invoice data with order details for PDF generation.
 * Fetches order data once to get both missing addresses and product variant names.
 */
export const enrichInvoiceForPdf = async (
  invoice: InvoiceList,
  isB2BUser: boolean
): Promise<InvoiceList> => {
  let orderId = getBcOrderIdFromInvoice(invoice.extraFields);
  // Fall back to invoice.orderNumber (which is the BC order ID)
  if (!orderId && invoice.orderNumber) {
    orderId = parseInt(invoice.orderNumber, 10) || null;
  }
  if (!orderId) return invoice;

  try {
    const orderDetails = isB2BUser
      ? await getB2BOrderDetails(orderId)
      : await getBCOrderDetails(orderId);

    const enriched: InvoiceList = {
      ...invoice,
      orderProducts: orderDetails.products || [],
    };

    // Populate addresses from order if invoice header is missing them
    const hasBillingAddress = !!invoice.details?.header?.billing_address?.street_1;
    const hasShippingAddress = !!invoice.details?.header?.shipping_addresses?.[0]?.street_1;

    if (!hasBillingAddress) {
      enriched.orderBillingAddress = orderDetails.billingAddress || undefined;
    }
    if (
      !hasShippingAddress &&
      Array.isArray(orderDetails.shippingAddress) &&
      orderDetails.shippingAddress.length > 0
    ) {
      enriched.orderShippingAddress = orderDetails.shippingAddress[0] as Address;
    }

    return enriched;
  } catch (error) {
    console.warn('Failed to enrich invoice for PDF:', error);
    return invoice;
  }
};

export const getInvoicePdfUrl = async (
  invoice: InvoiceList,
  isB2BUser: boolean = true
): Promise<string> => {
  const logo = await loadLogoIfNeeded();

  // Enrich invoice with order data (addresses + product variant names)
  const enrichedInvoice = await enrichInvoiceForPdf(invoice, isB2BUser);

  const generator = new InvoicePdfGenerator(enrichedInvoice, logo);
  generator.generate();
  return generator.getBlobUrl();
};

export const downloadInvoicePdf = async (
  invoice: InvoiceList,
  isB2BUser: boolean = true
): Promise<void> => {
  const logo = await loadLogoIfNeeded();

  // Enrich invoice with order data (addresses + product variant names)
  const enrichedInvoice = await enrichInvoiceForPdf(invoice, isB2BUser);

  const generator = new InvoicePdfGenerator(enrichedInvoice, logo);
  generator.generate();
  generator.save();
};

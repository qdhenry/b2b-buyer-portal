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

export const getInvoicePdfUrl = async (invoice: InvoiceList): Promise<string> => {
  const logo = await loadLogoIfNeeded();
  const generator = new InvoicePdfGenerator(invoice, logo);
  generator.generate();
  return generator.getBlobUrl();
};

export const downloadInvoicePdf = async (invoice: InvoiceList): Promise<void> => {
  const logo = await loadLogoIfNeeded();
  const generator = new InvoicePdfGenerator(invoice, logo);
  generator.generate();
  generator.save();
};

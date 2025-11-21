import { InvoiceList } from '@/types/invoice';
import { InvoicePdfGenerator } from '@/utils/pdf/InvoicePdfGenerator';

export const getInvoicePdfUrl = (invoice: InvoiceList): string => {
  const generator = new InvoicePdfGenerator(invoice);
  generator.generate();
  return generator.getBlobUrl();
};

export const downloadInvoicePdf = (invoice: InvoiceList): void => {
  const generator = new InvoicePdfGenerator(invoice);
  generator.generate();
  generator.save();
};

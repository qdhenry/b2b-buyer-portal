import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

import { InvoiceList } from '@/types/invoice';
import { displayFormat } from '@/utils';

import { getEpicorOrderId } from '../../pages/customizations';

// Define the shape of the invoice data we expect
// This matches the InvoiceList interface but we can extend it if needed
type InvoiceData = InvoiceList;

const COMPANY_LOGO_URL = '/assets/b2bLogo.png'; // Adjust path as needed
const THEME_COLOR = '#333333'; // Dark grey for headers
const ACCENT_COLOR = '#f4f4f4'; // Light grey for backgrounds

export class InvoicePdfGenerator {
  private doc: jsPDF;
  private invoice: InvoiceData;
  private startY: number = 20;

  constructor(invoice: InvoiceData) {
    this.doc = new jsPDF();
    this.invoice = invoice;
  }

  public generate(): jsPDF {
    this.addHeader();
    this.addAddresses();
    this.addOrderDetails();
    this.addTable();
    this.addFooter();
    return this.doc;
  }

  public save(filename?: string) {
    this.doc.save(filename || `invoice-${this.invoice.invoiceNumber}.pdf`);
  }

  public getBlobUrl(): string {
    return this.doc.output('bloburl');
  }

  private addHeader() {
    // Logo (Placeholder - in a real app, you'd load the image data)
    // this.doc.addImage(imgData, 'PNG', 14, 10, 30, 10);
    this.doc.setFontSize(24);
    this.doc.text('INVOICE', 14, this.startY);

    // Invoice Number & Status
    this.doc.setFontSize(10);
    this.doc.setTextColor(100);
    this.doc.text(`Invoice #: ${this.invoice.invoiceNumber}`, 14, this.startY + 10);

    // Status Badge-like text
    const statusMap: Record<number, string> = {
      0: 'Open',
      1: 'Partially Paid',
      2: 'Paid',
      3: 'Overdue',
    };
    this.doc.text(`Status: ${statusMap[this.invoice.status] || 'Unknown'}`, 14, this.startY + 15);

    // Company Info (Right aligned)
    this.doc.setFontSize(10);
    this.doc.setTextColor(0);
    const rightMargin = 196;
    this.doc.text('StatLab Medical Products', rightMargin, this.startY, { align: 'right' });
    this.doc.text('2090 Commerce Drive', rightMargin, this.startY + 5, { align: 'right' });
    this.doc.text('McKinney, TX 75069', rightMargin, this.startY + 10, { align: 'right' });
    this.doc.text('800-442-3573', rightMargin, this.startY + 15, { align: 'right' });

    this.startY += 30;
  }

  private addAddresses() {
    const y = this.startY;

    // Bill To
    this.doc.setFontSize(11);
    this.doc.setFont('helvetica', 'bold');
    this.doc.text('Bill to:', 14, y);
    this.doc.setFont('helvetica', 'normal');
    this.doc.setFontSize(10);

    const billTo = this.invoice.details?.header?.billing_address;
    if (billTo) {
      this.doc.text(`${billTo.first_name} ${billTo.last_name}`, 14, y + 7);
      this.doc.text(billTo.street_1, 14, y + 12);
      if (billTo.street_2) this.doc.text(billTo.street_2, 14, y + 17);
      this.doc.text(
        `${billTo.city}, ${billTo.state} ${billTo.zip_code}`,
        14,
        y + (billTo.street_2 ? 22 : 17),
      );
      this.doc.text(billTo.country, 14, y + (billTo.street_2 ? 27 : 22));
    }

    // Ship To
    this.doc.setFontSize(11);
    this.doc.setFont('helvetica', 'bold');
    this.doc.text('Ship to:', 100, y);
    this.doc.setFont('helvetica', 'normal');
    this.doc.setFontSize(10);

    console.log('Invoice Details:', this.invoice);

    const shipTo = this.invoice.details?.header?.shipping_addresses?.[0];
    if (shipTo) {
      this.doc.text(`${shipTo.first_name} ${shipTo.last_name}`, 100, y + 7);
      this.doc.text(shipTo.street_1, 100, y + 12);
      if (shipTo.street_2) this.doc.text(shipTo.street_2, 100, y + 17);
      this.doc.text(
        `${shipTo.city}, ${shipTo.state} ${shipTo.zip_code}`,
        100,
        y + (shipTo.street_2 ? 22 : 17),
      );
      this.doc.text(shipTo.country, 100, y + (shipTo.street_2 ? 27 : 22));
    }

    this.startY += 40;
  }

  private addOrderDetails() {
    const y = this.startY;

    // Key-Value pairs for order details
    const details = [
      { label: 'Order ID', value: getEpicorOrderId(this.invoice) || this.invoice.orderNumber },
      { label: 'PO #', value: this.invoice.purchaseOrderNumber || '-' },
      { label: 'Issued At', value: displayFormat(this.invoice.createdAt) },
      { label: 'Due Date', value: displayFormat(this.invoice.dueDate) },
    ];

    let x = 14;
    details.forEach((detail) => {
      this.doc.setFont('helvetica', 'bold');
      this.doc.text(detail.label, x, y);
      this.doc.setFont('helvetica', 'normal');
      this.doc.text(detail.value, x, y + 5);
      x += 45;
    });

    this.startY += 15;
  }

  private addTable() {
    const lineItems = this.invoice.details?.details?.line_items || [];

    const tableData = lineItems.map((item) => [
      item.sku,
      item.description,
      item.quantity,
      `${item.unit_price.code} ${parseFloat(item.unit_price.value).toFixed(2)}`,
      `${item.unit_price.code} ${(item.quantity * parseFloat(item.unit_price.value)).toFixed(2)}`,
    ]);

    autoTable(this.doc, {
      startY: this.startY,
      head: [['SKU', 'Description', 'Qty', 'Price', 'Total']],
      body: tableData,
      theme: 'grid',
      headStyles: { fillColor: THEME_COLOR },
      styles: { fontSize: 9 },
    });

    // @ts-ignore - lastAutoTable is added by jspdf-autotable
    this.startY = this.doc.lastAutoTable.finalY + 10;
  }

  private addFooter() {
    const rightMargin = 196;
    let y = this.startY;

    const formatMoney = (amount: { code: string; value: string }) =>
      `${amount.code} ${parseFloat(amount.value).toFixed(2)}`;

    // Totals
    this.doc.setFontSize(10);

    // Invoice Amount
    this.doc.text('Invoice Amount:', 140, y);
    this.doc.text(formatMoney(this.invoice.originalBalance), rightMargin, y, { align: 'right' });
    y += 7;

    // Invoice Paid
    // Calculate paid amount: original - open
    const paidValue =
      parseFloat(this.invoice.originalBalance.value) - parseFloat(this.invoice.openBalance.value);
    this.doc.text('Invoice Paid:', 140, y);
    this.doc.text(`${this.invoice.originalBalance.code} ${paidValue.toFixed(2)}`, rightMargin, y, {
      align: 'right',
    });
    y += 7;

    // Invoice Due
    this.doc.setFont('helvetica', 'bold');
    this.doc.text('Invoice Due:', 140, y);
    this.doc.text(formatMoney(this.invoice.openBalance), rightMargin, y, { align: 'right' });
  }
}

import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

import { InvoiceList } from '@/types/invoice';
import { displayFormat } from '@/utils';

import { getEpicorOrderId } from '../../pages/customizations';

// Define the shape of the invoice data we expect
type InvoiceData = InvoiceList;

// Layout Constants
const PAGE_MARGIN = 10; // mm
const CONTENT_WIDTH = 190; // 210 - 20
const COLOR_BLACK = '#000000';
const COLOR_GRAY_BG = '#E6E6E6';
const COLOR_WHITE = '#FFFFFF';

// Placeholder for missing data
const MISSING_DATA_PLACEHOLDER = '---';

export class InvoicePdfGenerator {
  private doc: jsPDF;
  private invoice: InvoiceData;
  private currentY: number = 0;

  constructor(invoice: InvoiceData) {
    this.doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4',
    });
    this.invoice = invoice;
  }

  public generate(): jsPDF {
    this.drawPage1();
    this.doc.addPage();
    this.drawPage2();

    return this.doc;
  }

  public save(filename?: string) {
    this.doc.save(filename || `invoice-${this.invoice.invoiceNumber}.pdf`);
  }

  public getBlobUrl(): string {
    return this.doc.output('bloburl') as unknown as string;
  }

  // ==========================================
  // PAGE 1
  // ==========================================
  private drawPage1() {
    this.currentY = 10;

    this.drawHeaderP1();
    this.drawAddresses();
    this.drawQuickReferenceBar();
    this.drawInvoiceInfoGrid();
    this.drawTable(); // This might expand and push Y down
    this.drawFooterP1();
  }

  private drawHeaderP1() {
    const startX = PAGE_MARGIN;
    let y = this.currentY;

    // --- Left: REMIT TO ---
    this.doc.setFontSize(9);
    this.doc.setFont('helvetica', 'bold');
    this.doc.text('REMIT TO:', startX, y);
    y += 5;
    this.doc.setFont('helvetica', 'normal');
    // Static Remit To Address from Reference
    this.doc.text('*** PILOT 9/8/25', startX, y); // Keeping the text from PDF reference exactly? Or just address?
    // The PDF says "*** PILOT 9/8/25" which might be a note, but I'll include it or just the address.
    // I'll stick to the address part to be safe, or include all if it looks like address lines.
    // "P.O. Box 678056"
    y += 5;
    this.doc.text('P.O. Box 678056', startX, y);
    y += 5;
    this.doc.text('Dallas, TX 75267-8056', startX, y);

    // --- Center: INVOICE ---
    const centerX = 105;
    let centerY = 10;
    this.doc.setFontSize(22);
    this.doc.setFont('helvetica', 'bold');
    this.doc.text('INVOICE', centerX, centerY, { align: 'center' });

    centerY += 6;
    this.doc.setFontSize(10);
    this.doc.text(`Invoice Number: ${this.invoice.invoiceNumber}`, centerX, centerY, {
      align: 'center',
    });

    centerY += 5;
    // Date: using createdAt as Invoiced Date
    this.doc.setFont('helvetica', 'normal');
    this.doc.text(`Date: ${displayFormat(this.invoice.createdAt)}`, centerX, centerY, {
      align: 'center',
    });

    centerY += 5;
    this.doc.text('Page 1 of 2', centerX, centerY, { align: 'center' });

    // --- Right: LOGO ---
    // Placeholder for Logo
    const logoX = 150;
    const logoY = 5;
    this.doc.setFontSize(24);
    this.doc.setFont('times', 'bold'); // Serif font for StatLab
    this.doc.text('StatLab', logoX + 10, logoY + 10);
    // Draw a primitive "flower/star" logo placeholder
    this.doc.setDrawColor('#EC008C');
    this.doc.setLineWidth(0.5);
    this.doc.line(logoX, logoY + 5, logoX + 8, logoY + 15);
    this.doc.line(logoX + 8, logoY + 5, logoX, logoY + 15);
    this.doc.line(logoX + 4, logoY + 2, logoX + 4, logoY + 18);
    this.doc.line(logoX - 2, logoY + 10, logoX + 10, logoY + 10);
    this.doc.setDrawColor(0); // Reset

    this.currentY = Math.max(y, centerY) + 10;
  }

  private drawAddresses() {
    let y = this.currentY;
    const leftX = PAGE_MARGIN;
    const rightX = 105;

    // Horizontal Line top
    this.doc.setLineWidth(0.5);
    this.doc.line(leftX, y, 200, y);
    y += 5;

    // Headers
    this.doc.setFontSize(10);
    this.doc.setFont('helvetica', 'bold');
    this.doc.text('Sold To:', leftX, y);
    this.doc.text('Ship To:', rightX, y);
    y += 5;

    this.doc.setFont('helvetica', 'normal');

    // Billing Address
    const billTo = this.invoice.details?.header?.billing_address;
    let billY = y;
    if (billTo) {
      // Assuming company name might be first_name last_name or custom field
      // The PDF shows "FISHER- LABCORP" which looks like a company name.
      // InvoiceList doesn't have a direct 'company' field in address, usually it's `company` or fallback to name.
      const name = billTo.custom_fields?.company_name || `${billTo.first_name} ${billTo.last_name}`;
      this.doc.text(name, leftX, billY);
      billY += 5;
      this.doc.text(billTo.street_1, leftX, billY);
      billY += 5;
      if (billTo.street_2) {
        this.doc.text(billTo.street_2, leftX, billY);
        billY += 5;
      }
      this.doc.text(`${billTo.city}, ${billTo.state} ${billTo.zip_code}`, leftX, billY);
      billY += 5;
      this.doc.text(billTo.country, leftX, billY);
      billY += 5;
    }

    // Shipping Address
    const shipTo = this.invoice.details?.header?.shipping_addresses?.[0];
    let shipY = y;
    if (shipTo) {
      const name = shipTo.custom_fields?.company_name || `${shipTo.first_name} ${shipTo.last_name}`;
      this.doc.text(name, rightX, shipY);
      shipY += 5;
      this.doc.text(shipTo.street_1, rightX, shipY);
      shipY += 5;
      if (shipTo.street_2) {
        this.doc.text(shipTo.street_2, rightX, shipY);
        shipY += 5;
      }
      this.doc.text(`${shipTo.city}, ${shipTo.state} ${shipTo.zip_code}`, rightX, shipY);
      shipY += 5;
      this.doc.text(shipTo.country, rightX, shipY);
      shipY += 5;
    }

    this.currentY = Math.max(billY, shipY) + 5;
  }

  private drawQuickReferenceBar() {
    const y = this.currentY;
    const h = 8;

    // Black bar
    this.doc.setFillColor(COLOR_BLACK);
    this.doc.rect(PAGE_MARGIN, y, CONTENT_WIDTH, h, 'F');

    // Text
    this.doc.setTextColor(COLOR_WHITE);
    this.doc.setFontSize(10);
    this.doc.setFont('helvetica', 'bold');

    // Icon placeholder (magnifying glass) - just text "Q"
    this.doc.text('Q', PAGE_MARGIN + 2, y + 5.5);
    this.doc.text('QUICK REFERENCE', PAGE_MARGIN + 8, y + 5.5);

    this.doc.setFont('helvetica', 'normal');
    this.doc.text('QUESTIONS? Customer Service: 1-800-442-3573 7AM to 6:30PM CST', 80, y + 5.5);

    this.doc.setTextColor(COLOR_BLACK); // Reset
    this.currentY += h;
  }

  private drawInvoiceInfoGrid() {
    const startY = this.currentY;
    const h = 35; // approximate height

    // Gray Background
    this.doc.setFillColor(COLOR_GRAY_BG);
    this.doc.rect(PAGE_MARGIN, startY, CONTENT_WIDTH, h, 'F');

    // Dashed border? The PDF has dashed lines.
    this.doc.setDrawColor(COLOR_BLACK);
    this.doc.setLineDashPattern([1, 1], 0);
    this.doc.rect(PAGE_MARGIN, startY, CONTENT_WIDTH, h, 'S');
    this.doc.setLineDashPattern([], 0); // Reset

    // Columns
    const col1X = PAGE_MARGIN + 2;
    const col2X = PAGE_MARGIN + 55;
    const col3X = PAGE_MARGIN + 105;

    const companyExtraFields = this.invoice.companyInfo.extraFields || [];
    console.log('companyExtraFields', companyExtraFields);
    const getCompanyExtraFieldValue = (fieldName: string) => {
      const field = companyExtraFields.find((item) => item.fieldName === fieldName);
      const value = field?.fieldValue;
      if (!value) return undefined;
      const trimmed = value.trim();
      return trimmed.length ? trimmed : undefined;
    };

    const customerIdValue =
      getCompanyExtraFieldValue('Customer ID') ||
      this.invoice.customerId ||
      MISSING_DATA_PLACEHOLDER;
    const customerNumberValue = getCompanyExtraFieldValue('Customer Number');
    const salesRepNameValue =
      getCompanyExtraFieldValue('Sales Rep Name') || MISSING_DATA_PLACEHOLDER;
    const salesRepEmailValue =
      getCompanyExtraFieldValue('Sales Rep Email') || MISSING_DATA_PLACEHOLDER;
    const paymentTermsValue = getCompanyExtraFieldValue('Payment Terms') || 'Net 60 Days';

    let y = startY + 5;

    this.doc.setFontSize(9);

    // Col 1: INVOICE INFORMATION
    this.doc.setFont('helvetica', 'bold');
    this.doc.text('INVOICE INFORMATION', col1X, y);
    y += 5;
    this.doc.setFont('helvetica', 'normal');
    this.doc.text(`Invoice Number: ${this.invoice.invoiceNumber}`, col1X, y);
    if (customerNumberValue) {
      y += 5;
      this.doc.text(`Customer Number: ${customerNumberValue}`, col1X, y);
    }

    // Col 2: CUSTOMER ID & SALES REP
    y = startY + 5;
    this.doc.setFont('helvetica', 'bold');
    this.doc.text(`CUSTOMER ID ${customerIdValue}`, col2X, y);
    y += 8;
    this.doc.text('SALES REPRESENTATIVE', col2X, y);
    y += 4;
    this.doc.setFont('helvetica', 'normal');
    this.doc.text(salesRepNameValue, col2X, y);
    y += 4;
    this.doc.text(salesRepEmailValue, col2X, y); // Email

    // Col 3: DUE DATE, TERMS, INVOICED
    y = startY + 5;
    this.doc.setFont('helvetica', 'bold');
    this.doc.text(`DUE DATE ${displayFormat(this.invoice.dueDate)}`, col3X, y);
    y += 5;
    this.doc.setFont('helvetica', 'normal');
    this.doc.text(`Invoiced: ${displayFormat(this.invoice.createdAt)}`, col3X, y);
    y += 5;
    this.doc.setFont('helvetica', 'bold');
    this.doc.text('TERMS', col3X, y);
    this.doc.setFont('helvetica', 'normal');
    this.doc.text(paymentTermsValue, col3X + 12, y);

    // Col 4: SHIPPING DETAILS (Right aligned effectively, or 4th col)
    const col4X = PAGE_MARGIN + 155;
    y = startY + 5;
    this.doc.setFont('helvetica', 'bold');
    this.doc.text('SHIPPING DETAILS', col4X, y);
    y += 5;
    this.doc.setFont('helvetica', 'normal');
    // Missing Shipping Data
    this.doc.text(`Ship Date: ${displayFormat(this.invoice.createdAt)}`, col4X, y); // Use created as placeholder
    y += 5;
    this.doc.text('FOB: Third Party', col4X, y); // Placeholder
    y += 5;
    this.doc.text('Shipping Via: FedEx Ground', col4X, y); // Placeholder

    this.currentY += h + 5;
  }

  private drawTable() {
    const lineItems = this.invoice.details?.details?.line_items || [];

    const tableData = lineItems.map((item) => {
      const unitPrice = parseFloat(item.unit_price.value);
      const qty = item.quantity;
      const extPrice = unitPrice * qty;

      return [
        { content: `${item.sku}\n${item.description}`, styles: { cellWidth: 60 } }, // Part & Description
        MISSING_DATA_PLACEHOLDER, // Lot / Serial
        MISSING_DATA_PLACEHOLDER, // Pack Slip
        `${qty} CS`, // Qty Shipped (assuming Unit is CS for example, or need unit from data)
        `${item.unit_price.code} ${unitPrice.toFixed(2)}/E`, // Unit Price
        extPrice.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }), // Ext Price
      ];
    });

    // Custom Header for PO/SO
    const poNumber = this.invoice.purchaseOrderNumber || MISSING_DATA_PLACEHOLDER;
    const soNumber =
      getEpicorOrderId(this.invoice) || this.invoice.orderNumber || MISSING_DATA_PLACEHOLDER;

    // We can't easily inject a full width row *inside* the autotable body that spans all columns with specific styling using just the data array cleanly without hooks.
    // Instead, I will rely on `didDrawPage` or just draw it as a separate block if it's outside the header.
    // But the PDF shows it as a sub-header.
    // I'll use a `willDrawCell` hook or simply add it as the first row and style it differently.

    const finalTableData = [
      // Special row for PO/SO
      [
        {
          content: `Purchase Order: ${poNumber}                 Sales Order: ${soNumber}`,
          colSpan: 6,
          styles: {
            fillColor: [217, 225, 242], // Light Blue
            fontStyle: 'bold',
            halign: 'left',
          },
        },
      ],
      ...tableData,
    ];

    autoTable(this.doc, {
      startY: this.currentY,
      head: [
        [
          'Part & Description',
          'Lot / Serial',
          'Pack Slip',
          'Qty. Shipped',
          'Unit Price',
          'Ext. Price',
        ],
      ],
      body: finalTableData as any,
      theme: 'plain', // We'll do custom styling
      styles: {
        fontSize: 8,
        cellPadding: 2,
        valign: 'top',
        lineColor: [200, 200, 200],
        lineWidth: 0.1,
      },
      headStyles: {
        fillColor: [230, 230, 230], // Light Gray for main header
        textColor: 0,
        fontStyle: 'bold',
        lineWidth: 0, // No border for header
      },
      columnStyles: {
        5: { halign: 'right' }, // Ext Price right aligned
      },
      margin: { left: PAGE_MARGIN, right: PAGE_MARGIN },
    });

    // @ts-ignore
    this.currentY = this.doc.lastAutoTable.finalY + 5;
  }

  private drawFooterP1() {
    // We need to check if we have space, else add page?
    // For now assuming it fits or we let it flow.
    // But layout requires footer at bottom? PDF has footer "Innovating..." at very bottom.
    // The "Terms and Conditions" block is below the table.

    let y = this.currentY;
    const leftX = PAGE_MARGIN;
    const rightColX = 140;

    // --- Totals (Right side) ---
    const totalY = y;
    this.doc.setFontSize(9);

    const subtotal = this.invoice.originalBalance.value; // Assuming subtotal roughly equals original for now
    const total = this.invoice.originalBalance.value;
    const due = this.invoice.openBalance.value;

    const rowHeight = 6;

    this.doc.setFont('helvetica', 'italic');
    this.doc.text('All currency listed is in US dollars', rightColX, y);
    y += rowHeight;
    this.doc.setFont('helvetica', 'normal');

    this.doc.text('Product Subtotal', rightColX, y);
    this.doc.text(`$${parseFloat(subtotal).toFixed(2)}`, 195, y, { align: 'right' });
    y += rowHeight;

    this.doc.setFont('helvetica', 'bold');
    this.doc.text('INVOICE TOTAL', rightColX, y);
    this.doc.text(`$${parseFloat(total).toFixed(2)}`, 195, y, { align: 'right' });
    y += rowHeight;

    // Dashed line
    this.doc.setLineDashPattern([1, 1], 0);
    this.doc.line(rightColX, y - 4, 195, y - 4);
    this.doc.setLineDashPattern([], 0);

    this.doc.text('INVOICE AMOUNT DUE', rightColX, y);
    this.doc.text(`$${parseFloat(due).toFixed(2)}`, 195, y, { align: 'right' });

    // --- Terms & Text (Left side) ---
    y = totalY; // Reset Y for left col
    this.doc.setFontSize(8);
    this.doc.setFont('helvetica', 'bold');
    this.doc.text('TERMS AND CONDITIONS All currency listed in US dollars', leftX, y);
    y += 4;
    this.doc.setFont('helvetica', 'normal');
    const termsText = [
      'StatLab products are guaranteed by StatLab against defects in material and',
      'workmanship for a period of one hundred twenty (120) days from the date of',
      'shipment to Customer. Returns of non-defective and non-used product will',
      'be accepted within 30 days of shipment with no restocking fee if product was',
      'shipped in error. To begin a return, visit StatLab.com/returnsform.',
    ];
    termsText.forEach((line) => {
      this.doc.text(line, leftX, y);
      y += 3.5;
    });

    y += 2;
    this.doc.setFont('helvetica', 'bold');
    this.doc.text('CREDIT MEMOS', leftX, y);
    y += 4;
    this.doc.setFont('helvetica', 'normal');
    this.doc.text(
      'The amount of a credit memo can be applied to future invoices. Simply',
      leftX,
      y,
    );
    y += 3.5;
    this.doc.text('include the credit memo in a remittance document.', leftX, y);

    y += 6;
    this.doc.setFont('helvetica', 'bold');
    this.doc.text('ORDER AND TRACK ORDERS ONLINE', leftX, y);
    y += 4;
    this.doc.setFont('helvetica', 'normal');
    this.doc.text(
      'Order online at StatLab.com and easily save favorites, access invoices,',
      leftX,
      y,
    );
    y += 3.5;
    this.doc.text('track shipments, and more. To track orders without a login, visit', leftX, y);
    y += 3.5;
    this.doc.text('StatLab.com/ordersearch.', leftX, y);

    // --- Warning Center ---
    y = Math.max(y, totalY + 40) + 10;
    this.doc.setFontSize(10);
    this.doc.setFont('helvetica', 'bolditalic');
    this.doc.text('* * *', 30, y + 5);
    this.doc.text('* * *', 170, y + 5);

    const warningText = [
      'Some items associated with this order are either partially filled or',
      'backordered. Use order search at StatLab.com/ordersearch to identify',
      'what lines are outstanding and will be shipped and invoiced',
      'separately.',
    ];
    let wy = y;
    warningText.forEach((line) => {
      this.doc.text(line, 105, wy, { align: 'center' });
      wy += 5;
    });

    // --- Bottom Footer ---
    const bottomY = 285;
    this.doc.setFontSize(10);
    this.doc.setFont('helvetica', 'bold');
    this.doc.text('Innovating pathology essentials. Together.', leftX, bottomY);
    this.doc.setFont('helvetica', 'normal');
    this.doc.text('Page 1', 190, bottomY, { align: 'right' });
  }

  // ==========================================
  // PAGE 2
  // ==========================================
  private drawPage2() {
    this.currentY = 10;

    // --- Header ---
    const startX = PAGE_MARGIN;
    this.doc.setFontSize(22);
    this.doc.setFont('helvetica', 'bold');
    this.doc.text('INVOICE', startX, this.currentY + 10);

    this.doc.setFontSize(10);
    this.doc.text(`Invoice Number: ${this.invoice.invoiceNumber}`, 60, this.currentY + 5);
    this.doc.setFont('helvetica', 'normal');
    this.doc.text(`Date: ${displayFormat(this.invoice.createdAt)}`, 60, this.currentY + 10);
    this.doc.text('Page 2 of 2', 60, this.currentY + 15);

    // Logo
    const logoX = 150;
    const logoY = 5;
    this.doc.setFontSize(24);
    this.doc.setFont('times', 'bold');
    this.doc.text('StatLab', logoX + 10, logoY + 10);
    // Draw Logo Symbol (Simplified again)
    this.doc.setDrawColor('#EC008C');
    this.doc.setLineWidth(0.5);
    this.doc.line(logoX, logoY + 5, logoX + 8, logoY + 15);
    this.doc.line(logoX + 8, logoY + 5, logoX, logoY + 15);
    this.doc.line(logoX + 4, logoY + 2, logoX + 4, logoY + 18);
    this.doc.line(logoX - 2, logoY + 10, logoX + 10, logoY + 10);
    this.doc.setDrawColor(0);

    this.currentY += 30;

    // --- SHIPPING AND TRACKING ---
    this.drawSectionHeader(
      'SHIPPING AND TRACKING',
      'QUESTIONS? Customer Service: 1-800-442-3573 7AM to 6:30PM CST',
    );

    // Tracking Table
    // Since we don't have tracking data in InvoiceList generally, we use placeholders
    // Or if `invoice.details.details.shipments` exists, we try to use it.

    const shipments = this.invoice.details?.details?.shipments || [];
    const trackingData =
      shipments.length > 0
        ? shipments.map((s) => [
            s.id || MISSING_DATA_PLACEHOLDER,
            s.tracking_number || MISSING_DATA_PLACEHOLDER,
          ])
        : [[MISSING_DATA_PLACEHOLDER, MISSING_DATA_PLACEHOLDER]];

    autoTable(this.doc, {
      startY: this.currentY,
      head: [['Pack Slip Number', 'Associated Tracking Number']],
      body: trackingData,
      theme: 'plain',
      styles: { fontSize: 10, cellPadding: 3 },
      headStyles: { fontStyle: 'bold', fillColor: COLOR_WHITE, textColor: COLOR_BLACK },
      margin: { left: PAGE_MARGIN, right: PAGE_MARGIN },
    });

    // @ts-ignore
    this.currentY = this.doc.lastAutoTable.finalY + 5;

    this.doc.setFontSize(9);
    this.doc.text(
      'TRACK ORDERS ONLINE either through your StatLab.com customer portal or by looking up your order at\nStatLab.com/ordersearch. No online account needed to access this order search. To set up an account online\nand access your customer portal, visit StatLab.com/OnlineOrdering.',
      PAGE_MARGIN,
      this.currentY,
    );
    this.currentY += 20;

    // --- BILL PAYMENT MADE EASY ---
    this.drawSectionHeader(
      'BILL PAYMENT MADE EASY',
      'QUESTIONS? Accounts Receivable: 972-436-1010, option 6',
    );

    let y = this.currentY + 5;
    const colWidth = CONTENT_WIDTH / 3;

    // Col 1: ACH
    this.doc.setFontSize(9);
    this.doc.setFont('helvetica', 'bold');
    this.doc.text('PAY BY ACH (recommended)', PAGE_MARGIN, y);
    y += 5;
    this.doc.setFont('helvetica', 'normal');
    this.doc.text('Account Name: SLMP LLC', PAGE_MARGIN, y);
    y += 4;
    this.doc.text('Account Number: 839921639', PAGE_MARGIN, y);
    y += 4;
    this.doc.text('Routing Number: 111000614', PAGE_MARGIN, y);

    // Col 2: WIRE
    y -= 13; // Reset Y
    const col2X = PAGE_MARGIN + colWidth;
    this.doc.setFont('helvetica', 'bold');
    this.doc.text('PAY BY WIRE (international customers)', col2X, y);
    y += 5;
    this.doc.setFont('helvetica', 'normal');
    this.doc.text('Account Name: SLMP LLC', col2X, y);
    y += 4;
    this.doc.text('Account Number: 839921639', col2X, y);
    y += 4;
    this.doc.text('Bank Name: JPMORGAN CHASE BANK, N.A. - TEXAS', col2X, y);
    y += 4;
    this.doc.text('Bank Swift BIC: CHASUS33', col2X, y);
    y += 4;
    this.doc.text('Bank Routing: 021000021', col2X, y);

    // Col 3: MAIL
    y -= 21; // Reset Y
    const col3X = PAGE_MARGIN + colWidth * 2;
    this.doc.setFont('helvetica', 'bold');
    this.doc.text('PAY BY MAIL', col3X, y);
    y += 5;
    this.doc.setFont('helvetica', 'normal');
    this.doc.text('PO Box 678056', col3X, y);
    y += 4;
    this.doc.text('Dallas, TX 75267-8056', col3X, y);

    // --- Bottom Footer ---
    const bottomY = 285;
    this.doc.setFontSize(10);
    this.doc.setFont('helvetica', 'bold');
    this.doc.text('Innovating pathology essentials. Together.', PAGE_MARGIN, bottomY);
    this.doc.setFont('helvetica', 'normal');
    this.doc.text('Page 2', 190, bottomY, { align: 'right' });
  }

  private drawSectionHeader(title: string, subText: string) {
    const y = this.currentY;
    const h = 8;

    // Black bar with icon placeholder
    this.doc.setFillColor(COLOR_BLACK);
    this.doc.rect(PAGE_MARGIN, y, CONTENT_WIDTH, h, 'F');

    this.doc.setTextColor(COLOR_WHITE);
    this.doc.setFontSize(10);
    this.doc.setFont('helvetica', 'bold');
    // Icon placeholder
    this.doc.text('$', PAGE_MARGIN + 2, y + 5.5);
    this.doc.text(title, PAGE_MARGIN + 8, y + 5.5);

    this.doc.setFont('helvetica', 'normal');
    this.doc.text(subText, 80, y + 5.5);

    this.doc.setTextColor(COLOR_BLACK);
    this.currentY += h + 5;
  }
}

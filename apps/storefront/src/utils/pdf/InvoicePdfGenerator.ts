import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

import { InvoiceList } from '@/types/invoice';
import { displayFormat } from '@/utils/b3DateFormat';

import {
  getEpicorOrderId,
  parseEpicorLotPackSlip,
  createLotPackSlipLookup,
} from '../../pages/customizations';

// Define the shape of the invoice data we expect
type InvoiceData = InvoiceList;

// Processed cost lines for footer display
interface ProcessedCostLines {
  taxes: { description: string; amount: number }[];
  freight: number;
  surcharges: { description: string; amount: number }[];
  discounts: { description: string; amount: number }[];
  subtotal: number;
}

// Layout Constants
const PAGE_MARGIN = 10; // mm
const CONTENT_WIDTH = 190; // 210 - 20
const COLOR_BLACK = '#000000';
const COLOR_WHITE = '#FFFFFF';
const COLOR_CYAN_BG = '#E0F7FA'; // Light cyan for info grid background

// Placeholder for missing data
const MISSING_DATA_PLACEHOLDER = '---';

// Logo URL
const LOGO_URL =
  'https://s3-us-west-2.amazonaws.com/bundleb2b-v3.0-media-files-prod/logo_1746462580__32578.original_04e9964b-7219-4984-b921-fd689c3f3965.png';

export interface LogoData {
  base64: string;
  aspectRatio: number; // width / height
}

export class InvoicePdfGenerator {
  private doc: jsPDF;

  private invoice: InvoiceData;

  private currentY: number = 0;

  private logoData: LogoData | null = null;

  constructor(invoice: InvoiceData, logoData?: LogoData) {
    this.doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4',
    });
    this.invoice = invoice;
    this.logoData = logoData || null;
  }

  /**
   * Loads the logo image and returns it as base64 with aspect ratio
   */
  public static async loadLogo(): Promise<LogoData> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0);
          const base64 = canvas.toDataURL('image/png');
          resolve({
            base64,
            aspectRatio: img.width / img.height,
          });
        } else {
          reject(new Error('Failed to get canvas context'));
        }
      };
      img.onerror = () => reject(new Error('Failed to load logo image'));
      img.src = LOGO_URL;
    });
  }

  /**
   * Draws the logo image in the top right corner
   */
  private drawLogo() {
    const logoWidth = 50; // mm
    const aspectRatio = this.logoData?.aspectRatio || 3.23; // fallback to default
    const logoHeight = logoWidth / aspectRatio; // auto height based on actual image aspect ratio
    const logoX = PAGE_MARGIN + CONTENT_WIDTH - logoWidth; // right-aligned
    const logoY = 5;

    if (this.logoData?.base64) {
      this.doc.addImage(this.logoData.base64, 'PNG', logoX, logoY, logoWidth, logoHeight);
    } else {
      // Fallback to text if logo not loaded
      this.doc.setFontSize(24);
      this.doc.setFont('times', 'bold');
      this.doc.text('StatLab', logoX + 10, logoY + 10);
    }
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
    this.doc.text('Statlab Medical Products', startX, y);
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
    this.drawLogo();

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

    // Billing Address - try invoice header first, then order address fallback
    const invoiceBillTo = this.invoice.details?.header?.billing_address;
    const orderBillTo = this.invoice.orderBillingAddress;
    let billY = y;

    if (invoiceBillTo?.street_1) {
      // Use invoice header billing address
      const name =
        invoiceBillTo.custom_fields?.company_name ||
        `${invoiceBillTo.first_name} ${invoiceBillTo.last_name}`;
      this.doc.text(name, leftX, billY);
      billY += 5;
      this.doc.text(invoiceBillTo.street_1, leftX, billY);
      billY += 5;
      if (invoiceBillTo.street_2) {
        this.doc.text(invoiceBillTo.street_2, leftX, billY);
        billY += 5;
      }
      this.doc.text(
        `${invoiceBillTo.city}, ${invoiceBillTo.state} ${invoiceBillTo.zip_code}`,
        leftX,
        billY,
      );
      billY += 5;
      this.doc.text(invoiceBillTo.country, leftX, billY);
      billY += 5;
    } else if (orderBillTo?.street_1) {
      // Fallback to order billing address
      const name = orderBillTo.company || `${orderBillTo.first_name} ${orderBillTo.last_name}`;
      this.doc.text(name, leftX, billY);
      billY += 5;
      this.doc.text(orderBillTo.street_1, leftX, billY);
      billY += 5;
      if (orderBillTo.street_2) {
        this.doc.text(orderBillTo.street_2, leftX, billY);
        billY += 5;
      }
      this.doc.text(`${orderBillTo.city}, ${orderBillTo.state} ${orderBillTo.zip}`, leftX, billY);
      billY += 5;
      this.doc.text(orderBillTo.country, leftX, billY);
      billY += 5;
    }

    // Shipping Address - try invoice header first, then order address fallback
    const invoiceShipTo = this.invoice.details?.header?.shipping_addresses?.[0];
    const orderShipTo = this.invoice.orderShippingAddress;
    let shipY = y;

    if (invoiceShipTo?.street_1) {
      // Use invoice header shipping address
      const name =
        invoiceShipTo.custom_fields?.company_name ||
        `${invoiceShipTo.first_name} ${invoiceShipTo.last_name}`;
      this.doc.text(name, rightX, shipY);
      shipY += 5;
      this.doc.text(invoiceShipTo.street_1, rightX, shipY);
      shipY += 5;
      if (invoiceShipTo.street_2) {
        this.doc.text(invoiceShipTo.street_2, rightX, shipY);
        shipY += 5;
      }
      this.doc.text(
        `${invoiceShipTo.city}, ${invoiceShipTo.state} ${invoiceShipTo.zip_code}`,
        rightX,
        shipY,
      );
      shipY += 5;
      this.doc.text(invoiceShipTo.country, rightX, shipY);
      shipY += 5;
    } else if (orderShipTo?.street_1) {
      // Fallback to order shipping address
      const name = orderShipTo.company || `${orderShipTo.first_name} ${orderShipTo.last_name}`;
      this.doc.text(name, rightX, shipY);
      shipY += 5;
      this.doc.text(orderShipTo.street_1, rightX, shipY);
      shipY += 5;
      if (orderShipTo.street_2) {
        this.doc.text(orderShipTo.street_2, rightX, shipY);
        shipY += 5;
      }
      this.doc.text(`${orderShipTo.city}, ${orderShipTo.state} ${orderShipTo.zip}`, rightX, shipY);
      shipY += 5;
      this.doc.text(orderShipTo.country, rightX, shipY);
      shipY += 5;
    }

    this.currentY = Math.max(billY, shipY) + 5;
  }

  private drawQuickReferenceBar() {
    const y = this.currentY;
    const h = 8;

    // Light gray bar (matching example design)
    this.doc.setFillColor(211, 211, 211); // #D3D3D3
    this.doc.rect(PAGE_MARGIN, y, CONTENT_WIDTH, h, 'F');

    // Text
    this.doc.setTextColor(COLOR_BLACK);
    this.doc.setFontSize(10);
    this.doc.setFont('helvetica', 'bold');

    // Magnifying glass icon placeholder (circle with Q)
    this.doc.circle(PAGE_MARGIN + 5, y + 4, 3, 'S');
    this.doc.setFontSize(7);
    this.doc.text('Q', PAGE_MARGIN + 3.5, y + 5.5);
    this.doc.setFontSize(10);
    this.doc.text('QUICK REFERENCE', PAGE_MARGIN + 12, y + 5.5);

    this.doc.setFont('helvetica', 'normal');
    this.doc.text('QUESTIONS? Customer Service: 1-800-442-3573 7AM to 6:30PM CST', 80, y + 5.5);

    this.currentY += h;
  }

  private drawInvoiceInfoGrid() {
    const startY = this.currentY;
    const h = 42; // increased height to accommodate line breaks in Shipping Details

    // Light cyan background (matching example design)
    this.doc.setFillColor(COLOR_CYAN_BG);
    this.doc.rect(PAGE_MARGIN, startY, CONTENT_WIDTH, h, 'F');

    // Solid thin border (no dashed lines - matching example)
    this.doc.setDrawColor(COLOR_BLACK);
    this.doc.setLineWidth(0.2);
    this.doc.rect(PAGE_MARGIN, startY, CONTENT_WIDTH, h, 'S');

    // Columns
    const col1X = PAGE_MARGIN + 2;
    const col2X = PAGE_MARGIN + 55;
    const col3X = PAGE_MARGIN + 105;

    const companyExtraFields = this.invoice.companyInfo.extraFields || [];

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
    // Ship Date with value on next line
    this.doc.text('Ship Date:', col4X, y);
    y += 4;
    this.doc.text(`${displayFormat(this.invoice.createdAt)}`, col4X, y);
    y += 5;
    // Shipping Via with value on next line
    // this.doc.text('Shipping Via:', col4X, y);
    // y += 4;
    // this.doc.text('FedEx Ground', col4X, y);

    this.currentY += h + 5;
  }

  private drawTable() {
    const lineItems = this.invoice.details?.details?.line_items || [];

    // Create a lookup map keyed by pack_line for correct matching
    // This fixes the bug where duplicate SKUs would show the same pack slip number
    const lotPackSlipByLine = createLotPackSlipLookup(this.invoice.extraFields);

    // Add line numbers to each item (1, 2, 3...)
    const tableData = lineItems.map((item, index) => {
      const unitPrice = parseFloat(item.unit_price.value);
      const qty = item.quantity;
      const extPrice = unitPrice * qty;

      // Look up lot/pack slip data by line number (pack_line is 1-indexed, matching index + 1)
      const lotPackData = lotPackSlipByLine.get(index + 1);

      return [
        index + 1, // Line number
        { content: `${item.sku}\n${item.description}`, styles: { cellWidth: 55 } }, // Part & Description
        lotPackData?.lot_num || MISSING_DATA_PLACEHOLDER, // Lot / Serial
        lotPackData?.pack_num || MISSING_DATA_PLACEHOLDER, // Pack Slip
        `${qty} CS`, // Qty Shipped (assuming Unit is CS for example, or need unit from data)
        `${unitPrice.toFixed(2)}/E`, // Unit Price
        extPrice.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }), // Ext Price
      ];
    });

    // Custom Header for PO/SO - drawn manually for precise 50/50 split
    const poNumber = this.invoice.purchaseOrderNumber || MISSING_DATA_PLACEHOLDER;
    const soNumber =
      getEpicorOrderId(this.invoice) || this.invoice.orderNumber || MISSING_DATA_PLACEHOLDER;

    // Draw PO/SO bar manually (50/50 split)
    const barHeight = 8;
    const halfWidth = CONTENT_WIDTH / 2;

    // Left half - Purchase Order
    this.doc.setFillColor(224, 247, 250); // Light cyan (#E0F7FA)
    this.doc.rect(PAGE_MARGIN, this.currentY, halfWidth, barHeight, 'F');

    // Right half - Sales Order
    this.doc.rect(PAGE_MARGIN + halfWidth, this.currentY, halfWidth, barHeight, 'F');

    // Border around entire bar
    this.doc.setDrawColor(200, 200, 200);
    this.doc.setLineWidth(0.1);
    this.doc.rect(PAGE_MARGIN, this.currentY, CONTENT_WIDTH, barHeight, 'S');

    // Vertical divider line in center
    this.doc.line(
      PAGE_MARGIN + halfWidth,
      this.currentY,
      PAGE_MARGIN + halfWidth,
      this.currentY + barHeight,
    );

    // Text
    this.doc.setFontSize(11);
    this.doc.setFont('helvetica', 'bold');
    this.doc.setTextColor(0, 0, 0);

    // Purchase Order text (centered in left half)
    this.doc.text(`Purchase Order: ${poNumber}`, PAGE_MARGIN + halfWidth / 2, this.currentY + 5.5, {
      align: 'center',
    });

    // Sales Order text (centered in right half)
    this.doc.text(
      `Sales Order: ${soNumber}`,
      PAGE_MARGIN + halfWidth + halfWidth / 2,
      this.currentY + 5.5,
      {
        align: 'center',
      },
    );

    this.currentY += barHeight;

    autoTable(this.doc, {
      startY: this.currentY,
      head: [
        [
          '', // Line number column (empty header)
          'Part & Description',
          'Lot / Serial',
          'Pack Slip',
          'Qty. Shipped',
          'Unit Price',
          'Ext. Price',
        ],
      ],
      body: tableData as any,
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
        0: { cellWidth: 8, halign: 'center' }, // Line number column
        6: { halign: 'right' }, // Ext Price right aligned
      },
      margin: { left: PAGE_MARGIN, right: PAGE_MARGIN },
    });

    // @ts-ignore
    this.currentY = this.doc.lastAutoTable.finalY + 5;
  }

  /**
   * Processes cost lines from invoice header into categorized breakdown
   * Handles taxes, freight, surcharges, and discounts
   */
  private processCostLines(): ProcessedCostLines {
    const costLines = this.invoice.details?.header?.cost_lines || [];
    const lineItems = this.invoice.details?.details?.line_items || [];

    // Calculate product subtotal from line items
    const subtotal = lineItems.reduce((sum, item) => {
      const unitPrice = parseFloat(item.unit_price.value) || 0;
      return sum + unitPrice * item.quantity;
    }, 0);

    // Aggregate taxes by jurisdiction (same description = sum values)
    const taxMap = new Map<string, number>();
    let freight = 0;
    const surcharges: { description: string; amount: number }[] = [];
    const discounts: { description: string; amount: number }[] = [];

    costLines.forEach((line) => {
      const amount = parseFloat(line.amount.value) || 0;
      const desc = line.description || '';

      // Categorize by description pattern
      if (desc.toLowerCase().startsWith('tax -') || desc.toLowerCase() === 'sales tax') {
        // Tax line - aggregate by jurisdiction
        const existing = taxMap.get(desc) || 0;
        taxMap.set(desc, existing + amount);
      } else if (
        desc.toLowerCase().includes('freight') ||
        desc.toLowerCase().includes('shipping')
      ) {
        // Freight/shipping
        freight += amount;
      } else if (desc.toLowerCase().includes('discount')) {
        // Discount (usually negative)
        discounts.push({ description: desc, amount });
      } else if (desc.toLowerCase() === 'subtotal') {
        // Ignore - we calculate our own subtotal from line items
      } else if (desc.trim().length > 0) {
        // Other cost lines (surcharges, fees, etc.)
        surcharges.push({ description: desc, amount });
      }
    });

    // Convert tax map to array
    const taxes: { description: string; amount: number }[] = [];
    taxMap.forEach((amount, description) => {
      taxes.push({ description, amount });
    });

    return {
      taxes,
      freight,
      surcharges,
      discounts,
      subtotal,
    };
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

    // Process cost lines for detailed breakdown
    const costBreakdown = this.processCostLines();
    const total = this.invoice.originalBalance.value;
    const due = this.invoice.openBalance.value;

    const rowHeight = 5;
    const rightAlignX = 195;

    this.doc.setFont('helvetica', 'italic');
    this.doc.text('All currency listed is in US dollars', rightColX, y);
    y += rowHeight;
    this.doc.setFont('helvetica', 'normal');

    // Product Subtotal (calculated from line items)
    this.doc.text('Product Subtotal', rightColX, y);
    this.doc.text(`$${costBreakdown.subtotal.toFixed(2)}`, rightAlignX, y, { align: 'right' });
    y += rowHeight;

    // Freight (if present)
    if (costBreakdown.freight > 0) {
      this.doc.text('*Freight Customer Paid', rightColX, y);
      this.doc.text(`$${costBreakdown.freight.toFixed(2)}`, rightAlignX, y, { align: 'right' });
      y += rowHeight;
    }

    // Surcharges (Supply Chain Surcharge, etc.)
    costBreakdown.surcharges.forEach((surcharge) => {
      this.doc.text(surcharge.description, rightColX, y);
      this.doc.text(`$${surcharge.amount.toFixed(2)}`, rightAlignX, y, { align: 'right' });
      y += rowHeight;
    });

    // Discounts (usually negative values)
    costBreakdown.discounts.forEach((discount) => {
      this.doc.text(discount.description, rightColX, y);
      const displayAmount =
        discount.amount < 0
          ? `-$${Math.abs(discount.amount).toFixed(2)}`
          : `$${discount.amount.toFixed(2)}`;
      this.doc.text(displayAmount, rightAlignX, y, { align: 'right' });
      y += rowHeight;
    });

    // Tax breakdown by jurisdiction
    costBreakdown.taxes.forEach((tax) => {
      this.doc.text(tax.description, rightColX, y);
      this.doc.text(`$${tax.amount.toFixed(2)}`, rightAlignX, y, { align: 'right' });
      y += rowHeight;
    });

    // Thin line separator before totals
    y += 2;
    this.doc.setLineWidth(0.2);
    this.doc.line(rightColX, y, rightAlignX, y);

    // Add padding after line before totals
    y += 5;

    this.doc.setFont('helvetica', 'bold');
    this.doc.text('INVOICE TOTAL', rightColX, y);
    this.doc.text(`$${parseFloat(total).toFixed(2)}`, rightAlignX, y, { align: 'right' });

    // Dashed line with padding
    y += 3;
    this.doc.setLineDashPattern([1, 1], 0);
    this.doc.line(rightColX, y, rightAlignX, y);
    this.doc.setLineDashPattern([], 0);
    y += 4;

    this.doc.text('INVOICE AMOUNT DUE', rightColX, y);
    this.doc.text(`$${parseFloat(due).toFixed(2)}`, rightAlignX, y, { align: 'right' });

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
    // this.doc.text('* * *', 30, y + 5);
    // this.doc.text('* * *', 170, y + 5);

    // const warningText = [
    //   'Some items associated with this order are either partially filled or',
    //   'backordered. Use order search at StatLab.com/ordersearch to identify',
    //   'what lines are outstanding and will be shipped and invoiced',
    //   'separately.',
    // ];
    // let wy = y;
    // warningText.forEach((line) => {
    //   this.doc.text(line, 105, wy, { align: 'center' });
    //   wy += 5;
    // });

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
    this.drawLogo();

    this.currentY += 30;

    // --- SHIPPING AND TRACKING ---
    this.drawSectionHeader(
      'SHIPPING AND TRACKING',
      'QUESTIONS? Customer Service: 1-800-442-3573 7AM to 6:30PM CST',
      'clipboard', // clipboard icon for shipping
    );

    // Parse epicorLotPackSlip from invoice extraFields
    // Group by pack slip number to deduplicate (matching example design - 2 columns only)
    const lotPackSlipItems = parseEpicorLotPackSlip(this.invoice.extraFields);

    // Group by pack slip number to get unique pack slip -> tracking number pairs
    const packSlipMap = new Map<string, string>();
    lotPackSlipItems.forEach((item) => {
      if (item.pack_num && !packSlipMap.has(item.pack_num)) {
        packSlipMap.set(item.pack_num, item.tracking_num || MISSING_DATA_PLACEHOLDER);
      }
    });

    // Draw as a simple list format (matching example design)
    const shippingCol1X = PAGE_MARGIN;
    const shippingCol2X = PAGE_MARGIN + 60;
    let shippingY = this.currentY;

    // Header row
    this.doc.setFontSize(10);
    this.doc.setFont('helvetica', 'bold');
    this.doc.text('Pack Slip Number', shippingCol1X, shippingY);
    this.doc.text('Associated Tracking Number', shippingCol2X, shippingY);
    shippingY += 2;

    // Underline under headers
    this.doc.setLineWidth(0.3);
    this.doc.line(shippingCol1X, shippingY, shippingCol1X + 50, shippingY);
    this.doc.line(shippingCol2X, shippingY, shippingCol2X + 80, shippingY);
    shippingY += 5;

    // Data rows
    this.doc.setFont('helvetica', 'normal');
    if (packSlipMap.size > 0) {
      packSlipMap.forEach((trackingNum, packNum) => {
        this.doc.text(packNum, shippingCol1X, shippingY);
        this.doc.text(trackingNum, shippingCol2X, shippingY);
        shippingY += 5;
      });
    } else {
      this.doc.text(MISSING_DATA_PLACEHOLDER, shippingCol1X, shippingY);
      this.doc.text(MISSING_DATA_PLACEHOLDER, shippingCol2X, shippingY);
      shippingY += 5;
    }

    this.currentY = shippingY + 5;

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
      'dollar', // dollar icon for payment
    );

    // Store the start Y for dashed border box
    const billPaymentStartY = this.currentY;

    let y = this.currentY + 5;
    const colWidth = CONTENT_WIDTH / 3;

    // Col 1: ACH
    this.doc.setFontSize(9);
    this.doc.setFont('helvetica', 'bold');
    this.doc.text('PAY BY ACH (recommended)', PAGE_MARGIN + 2, y);
    y += 5;
    this.doc.setFont('helvetica', 'normal');
    this.doc.text('Account Name: SLMP LLC', PAGE_MARGIN + 2, y);
    y += 4;
    this.doc.text('Account Number: 839921639', PAGE_MARGIN + 2, y);
    y += 4;
    this.doc.text('Routing Number: 111000614', PAGE_MARGIN + 2, y);

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

    // Draw dashed border box around Bill Payment section (matching example)
    const billPaymentEndY = billPaymentStartY + 35;
    this.doc.setDrawColor(COLOR_BLACK);
    this.doc.setLineDashPattern([2, 2], 0);
    this.doc.setLineWidth(0.3);
    this.doc.rect(
      PAGE_MARGIN,
      billPaymentStartY,
      CONTENT_WIDTH,
      billPaymentEndY - billPaymentStartY,
      'S',
    );
    this.doc.setLineDashPattern([], 0); // Reset

    // --- Bottom Footer ---
    const bottomY = 285;
    this.doc.setFontSize(10);
    this.doc.setFont('helvetica', 'bold');
    this.doc.text('Innovating pathology essentials. Together.', PAGE_MARGIN, bottomY);
    this.doc.setFont('helvetica', 'normal');
    this.doc.text('Page 2', 190, bottomY, { align: 'right' });
  }

  private drawSectionHeader(
    title: string,
    subText: string,
    iconType: 'clipboard' | 'dollar' = 'dollar',
  ) {
    const y = this.currentY;
    const h = 8;

    // Black bar with icon
    this.doc.setFillColor(COLOR_BLACK);
    this.doc.rect(PAGE_MARGIN, y, CONTENT_WIDTH, h, 'F');

    this.doc.setTextColor(COLOR_WHITE);
    this.doc.setFontSize(10);
    this.doc.setFont('helvetica', 'bold');

    // Draw icon based on type
    const iconX = PAGE_MARGIN + 2;
    const iconY = y + 1.5;

    if (iconType === 'clipboard') {
      // Draw a simple clipboard/document icon
      this.doc.setDrawColor(COLOR_WHITE);
      this.doc.setLineWidth(0.3);
      // Document outline
      this.doc.rect(iconX + 1, iconY, 4, 5, 'S');
      // Clipboard clip at top
      this.doc.rect(iconX + 2, iconY - 0.5, 2, 1, 'S');
    } else {
      // Draw dollar sign in circle
      this.doc.setDrawColor(COLOR_WHITE);
      this.doc.setLineWidth(0.3);
      this.doc.circle(iconX + 3, y + 4, 2.5, 'S');
      this.doc.setFontSize(7);
      this.doc.text('$', iconX + 1.8, y + 5.2);
      this.doc.setFontSize(10);
    }

    this.doc.text(title, PAGE_MARGIN + 10, y + 5.5);

    this.doc.setFont('helvetica', 'normal');
    this.doc.text(subText, 85, y + 5.5);

    this.doc.setTextColor(COLOR_BLACK);
    this.currentY += h + 5;
  }
}

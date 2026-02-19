import jspdf from 'jspdf';

declare module 'jspdf' {
  interface jsPDF {
    autoTable: (options: any) => void;
    lastAutoTable: { // Add this interface for lastAutoTable
      finalY: number;
    };
  }
}
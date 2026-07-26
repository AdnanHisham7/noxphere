// src/shared/utils/receiptGenerator.ts
import PDFDocument from "pdfkit";

export interface ReceiptData {
  academyName: string;
  studentName: string;
  installmentNumber: number;
  amountPaid: number;
  totalInstallmentAmount: number;
  currency: string;
  paymentMethod?: string;
  transactionId?: string;
  paidAt: Date;
  receiptNumber: string;
}

/**
 * Renders a single-page payment receipt as a PDF and resolves with its
 * bytes. Kept deliberately simple (no logos/branding assets) since it's
 * generated synchronously on the payment-recording request path.
 */
export function generateReceiptPdf(data: ReceiptData): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "A4", margin: 50 });
    const chunks: Buffer[] = [];
    doc.on("data", (chunk) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    doc
      .fontSize(20)
      .font("Helvetica-Bold")
      .text(data.academyName, { align: "center" })
      .fontSize(12)
      .font("Helvetica")
      .text("Payment Receipt", { align: "center" })
      .moveDown(1.5);

    doc
      .fontSize(10)
      .text(`Receipt No: ${data.receiptNumber}`)
      .text(`Date: ${data.paidAt.toLocaleDateString("en-IN")} ${data.paidAt.toLocaleTimeString("en-IN")}`)
      .moveDown(1);

    doc.moveTo(50, doc.y).lineTo(545, doc.y).strokeColor("#cccccc").stroke().moveDown(1);

    const row = (label: string, value: string) => {
      doc.font("Helvetica-Bold").fontSize(10).text(label, 50, doc.y, { continued: true, width: 200 });
      doc.font("Helvetica").text(value);
    };

    row("Student:", data.studentName);
    row("Installment:", `#${data.installmentNumber}`);
    row("Amount Paid:", `${data.currency} ${data.amountPaid.toLocaleString("en-IN")}`);
    row("Installment Total:", `${data.currency} ${data.totalInstallmentAmount.toLocaleString("en-IN")}`);
    if (data.paymentMethod) row("Payment Method:", data.paymentMethod);
    if (data.transactionId) row("Transaction ID:", data.transactionId);

    doc.moveDown(2);
    doc
      .fontSize(9)
      .fillColor("#666666")
      .text("This is a system-generated receipt and does not require a signature.", { align: "center" });

    doc.end();
  });
}

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
  paymentBreakdown?: { method: string; amount: number; transactionId?: string }[];
  paidAt: Date;
  receiptNumber: string;
}

/**
 * Generates an executive, professionally styled PDF receipt for fee payments.
 * Includes modern header styling, clean grid tables, verification badge,
 * and high-contrast monetary highlights.
 */
export function generateReceiptPdf(data: ReceiptData): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: "A4",
      margin: 40,
      info: {
        Title: `Receipt-${data.receiptNumber}`,
        Author: data.academyName,
        Subject: "Official Fee Payment Receipt",
      },
    });

    const chunks: Buffer[] = [];
    doc.on("data", (chunk) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const primaryColor = "#0f172a"; // Deep slate / pitch
    const accentColor = "#16a34a"; // Emerald / Volt green
    const textMuted = "#64748b";
    const borderMuted = "#e2e8f0";
    const bgCard = "#f8fafc";

    // 1. TOP HEADER BANNER
    doc.rect(40, 40, 515, 65).fill(primaryColor);

    // Academy Name
    doc
      .fillColor("#ffffff")
      .font("Helvetica-Bold")
      .fontSize(18)
      .text(data.academyName.toUpperCase(), 55, 52, { width: 330 });

    doc
      .font("Helvetica")
      .fontSize(9)
      .fillColor("#94a3b8")
      .text("ATHLETIC TRAINING ACADEMY · OFFICIAL FEE RECEIPT", 55, 76, { width: 330 });

    // "PAID" Stamp Badge on Top Right
    doc.roundedRect(415, 52, 125, 40, 4).fillAndStroke(accentColor, accentColor);
    doc
      .fillColor("#ffffff")
      .font("Helvetica-Bold")
      .fontSize(11)
      .text("PAYMENT VERIFIED", 415, 60, { width: 125, align: "center" });
    doc
      .fontSize(8)
      .font("Helvetica")
      .text(data.receiptNumber, 415, 75, { width: 125, align: "center" });

    // 2. META DETAILS BOX (Receipt No, Date, Student)
    let yPos = 120;
    doc.roundedRect(40, yPos, 515, 75, 6).fillAndStroke(bgCard, borderMuted);

    // Left Column: Student Details
    doc
      .fillColor(textMuted)
      .font("Helvetica-Bold")
      .fontSize(8)
      .text("STUDENT / ATHLETE", 55, yPos + 12);
    doc
      .fillColor(primaryColor)
      .font("Helvetica-Bold")
      .fontSize(13)
      .text(data.studentName, 55, yPos + 24);
    doc
      .fillColor(textMuted)
      .font("Helvetica")
      .fontSize(9)
      .text(`Installment #${data.installmentNumber} Payment`, 55, yPos + 42);

    // Center Column: Payment Info
    doc
      .fillColor(textMuted)
      .font("Helvetica-Bold")
      .fontSize(8)
      .text("PAYMENT METHOD", 260, yPos + 12);
    doc
      .fillColor(primaryColor)
      .font("Helvetica-Bold")
      .fontSize(11)
      .text((data.paymentMethod || "UPI / Online").toUpperCase(), 260, yPos + 24);
    if (data.transactionId) {
      doc
        .fillColor(textMuted)
        .font("Helvetica")
        .fontSize(8)
        .text(`Ref: ${data.transactionId}`, 260, yPos + 42, { width: 130, ellipsis: true });
    }

    // Right Column: Date & Receipt
    doc
      .fillColor(textMuted)
      .font("Helvetica-Bold")
      .fontSize(8)
      .text("TRANSACTION DATE", 410, yPos + 12);
    doc
      .fillColor(primaryColor)
      .font("Helvetica-Bold")
      .fontSize(10)
      .text(data.paidAt.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }), 410, yPos + 24);
    doc
      .fillColor(textMuted)
      .font("Helvetica")
      .fontSize(8)
      .text(data.paidAt.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" }), 410, yPos + 38);

    // 3. TABLE OF CHARGES
    yPos = 215;
    // Table Header
    doc.rect(40, yPos, 515, 24).fill("#1e293b");
    doc.fillColor("#ffffff").font("Helvetica-Bold").fontSize(9);
    doc.text("ITEM DESCRIPTION", 55, yPos + 7);
    doc.text("TOTAL DUE", 310, yPos + 7, { width: 90, align: "right" });
    doc.text("AMOUNT PAID", 425, yPos + 7, { width: 115, align: "right" });

    // Table Row 1
    yPos += 24;
    doc.rect(40, yPos, 515, 34).fillAndStroke("#ffffff", borderMuted);
    doc.fillColor(primaryColor).font("Helvetica-Bold").fontSize(10);
    doc.text(`Tuition & Training Fee - Installment #${data.installmentNumber}`, 55, yPos + 11);
    doc.font("Helvetica").fontSize(10);
    doc.text(`${data.currency} ${data.totalInstallmentAmount.toLocaleString("en-IN")}`, 310, yPos + 11, { width: 90, align: "right" });
    doc.font("Helvetica-Bold").fillColor(accentColor);
    doc.text(`${data.currency} ${data.amountPaid.toLocaleString("en-IN")}`, 425, yPos + 11, { width: 115, align: "right" });

    // 4. PAYMENT BREAKDOWN (If mixed or multiple breakdown entries)
    if (data.paymentBreakdown && data.paymentBreakdown.length > 0) {
      yPos += 45;
      doc.fillColor(textMuted).font("Helvetica-Bold").fontSize(8).text("SPLIT PAYMENT BREAKDOWN", 40, yPos);
      yPos += 14;

      data.paymentBreakdown.forEach((item) => {
        doc.roundedRect(40, yPos, 515, 24, 4).fillAndStroke("#f1f5f9", "#e2e8f0");
        doc.fillColor(primaryColor).font("Helvetica-Bold").fontSize(9);
        doc.text(item.method.toUpperCase(), 55, yPos + 7);
        if (item.transactionId) {
          doc.font("Helvetica").fontSize(8).fillColor(textMuted).text(`(Ref / Txn ID: ${item.transactionId})`, 130, yPos + 8);
        }
        doc.font("Helvetica-Bold").fillColor(primaryColor).fontSize(9);
        doc.text(`${data.currency} ${item.amount.toLocaleString("en-IN")}`, 425, yPos + 7, { width: 115, align: "right" });
        yPos += 28;
      });
    } else {
      yPos += 45;
    }

    // 5. SUMMARY CARD
    yPos += 10;
    const summaryX = 310;
    const summaryWidth = 245;
    doc.roundedRect(summaryX, yPos, summaryWidth, 75, 6).fillAndStroke(bgCard, borderMuted);

    doc.fillColor(textMuted).font("Helvetica").fontSize(9).text("Total Installment Cost:", summaryX + 15, yPos + 12);
    doc.fillColor(primaryColor).font("Helvetica-Bold").fontSize(9).text(`${data.currency} ${data.totalInstallmentAmount.toLocaleString("en-IN")}`, summaryX + 15, yPos + 12, { width: summaryWidth - 30, align: "right" });

    doc.fillColor(textMuted).font("Helvetica").fontSize(9).text("Amount Paid:", summaryX + 15, yPos + 28);
    doc.fillColor(accentColor).font("Helvetica-Bold").fontSize(11).text(`${data.currency} ${data.amountPaid.toLocaleString("en-IN")}`, summaryX + 15, yPos + 26, { width: summaryWidth - 30, align: "right" });

    const balanceRemaining = Math.max(0, data.totalInstallmentAmount - data.amountPaid);
    doc.fillColor(textMuted).font("Helvetica").fontSize(9).text("Balance Remaining:", summaryX + 15, yPos + 46);
    doc.fillColor(balanceRemaining > 0 ? "#ea580c" : textMuted).font("Helvetica-Bold").fontSize(9).text(`${data.currency} ${balanceRemaining.toLocaleString("en-IN")}`, summaryX + 15, yPos + 46, { width: summaryWidth - 30, align: "right" });

    // 6. OFFICIAL VERIFICATION FOOTER
    const footerY = 700;
    doc.moveTo(40, footerY).lineTo(555, footerY).strokeColor(borderMuted).stroke();

    doc
      .fillColor(textMuted)
      .font("Helvetica")
      .fontSize(8)
      .text("Official electronic payment receipt generated by Noxphere Athletic Ecosystem.", 40, footerY + 12, { align: "center", width: 515 });
    doc
      .fillColor(textMuted)
      .fontSize(7.5)
      .text("All payments are recorded onto the immutable academy financial ledger. For reconciliation queries, present Receipt Number to Academy Administration.", 40, footerY + 24, { align: "center", width: 515 });

    doc.end();
  });
}

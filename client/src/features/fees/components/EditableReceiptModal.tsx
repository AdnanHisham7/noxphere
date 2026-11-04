// client/src/features/fees/components/EditableReceiptModal.tsx
import React, { useState, useRef } from "react";
import {
  X,
  Printer,
  Download,
  RotateCcw,
  ShieldCheck,
  Building2,
  Calendar,
  CreditCard,
  Hash,
  User,
  Edit3,
  Eye,
  FileText,
  Check,
} from "lucide-react";
import { jsPDF } from "jspdf";
import toast from "react-hot-toast";
import { getCurrencySymbol, formatCurrency } from "../../../utils/currency";

export interface VectorReceiptParams {
  academyName: string;
  tagline: string;
  studentName: string;
  receiptNumber: string;
  date: string;
  time?: string;
  paymentMethod: string;
  transactionId?: string;
  itemDescription: string;
  installmentNumber: number;
  totalAmount: number;
  amountPaid: number;
  currency: string;
  paymentBreakdown?: { method: string; amount: number; transactionId?: string }[];
  remarks?: string;
  signatoryName?: string;
  signatoryTitle?: string;
}

/**
 * Generates an executive-grade Vector PDF matching `server/src/shared/utils/receiptGenerator.ts`
 */
export function generateVectorReceiptPdf(params: VectorReceiptParams) {
  const doc = new jsPDF({
    orientation: "portrait",
    unit: "pt",
    format: "a4",
  });

  const pageWidth = doc.internal.pageSize.getWidth(); // ~595 pt
  const margin = 40;
  const contentWidth = pageWidth - margin * 2; // ~515 pt

  const primaryColor = [15, 23, 42]; // #0f172a
  const accentColor = [22, 163, 74]; // #16a34a Emerald
  const textMuted = [100, 116, 139]; // #64748b
  const borderMuted = [226, 232, 240]; // #e2e8f0
  const bgCard = [248, 250, 252]; // #f8fafc

  const currCode = params.currency.toUpperCase();
  const pdfCurrency =
    currCode === "INR" || getCurrencySymbol(currCode) === "₹"
      ? "Rs. "
      : `${getCurrencySymbol(currCode) || currCode} `;

  const balanceRemaining = Math.max(0, params.totalAmount - params.amountPaid);

  // 1. TOP HEADER BANNER
  doc.setFillColor(primaryColor[0], primaryColor[1], primaryColor[2]);
  doc.rect(margin, margin, contentWidth, 68, "F");

  // Academy Name
  doc.setFont("helvetica", "bold");
  doc.setFontSize(17);
  doc.setTextColor(255, 255, 255);
  doc.text(params.academyName.toUpperCase(), margin + 16, margin + 28);

  // Subtitle / Tagline
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(148, 163, 184); // #94a3b8
  doc.text(params.tagline.toUpperCase(), margin + 16, margin + 48);

  // "PAYMENT VERIFIED" Badge on Top Right
  const badgeWidth = 130;
  const badgeHeight = 42;
  const badgeX = pageWidth - margin - badgeWidth - 14;
  const badgeY = margin + 13;

  doc.setFillColor(accentColor[0], accentColor[1], accentColor[2]);
  doc.roundedRect(badgeX, badgeY, badgeWidth, badgeHeight, 4, 4, "F");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(255, 255, 255);
  doc.text("PAYMENT VERIFIED", badgeX + badgeWidth / 2, badgeY + 16, {
    align: "center",
  });

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.text(params.receiptNumber, badgeX + badgeWidth / 2, badgeY + 31, {
    align: "center",
  });

  // 2. META DETAILS BOX (Student, Payment Method, Date)
  let yPos = margin + 82;
  doc.setFillColor(bgCard[0], bgCard[1], bgCard[2]);
  doc.setDrawColor(borderMuted[0], borderMuted[1], borderMuted[2]);
  doc.roundedRect(margin, yPos, contentWidth, 75, 6, 6, "FD");

  // Column 1: Student Details
  doc.setTextColor(textMuted[0], textMuted[1], textMuted[2]);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  doc.text("STUDENT / ATHLETE", margin + 15, yPos + 16);

  doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text(params.studentName, margin + 15, yPos + 33);

  doc.setTextColor(textMuted[0], textMuted[1], textMuted[2]);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.text(`Installment #${params.installmentNumber} Payment`, margin + 15, yPos + 51);

  // Column 2: Payment Method
  const col2X = margin + 215;
  doc.setTextColor(textMuted[0], textMuted[1], textMuted[2]);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  doc.text("PAYMENT METHOD", col2X, yPos + 16);

  doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10.5);
  doc.text(params.paymentMethod.toUpperCase(), col2X, yPos + 32);

  if (params.transactionId) {
    doc.setTextColor(textMuted[0], textMuted[1], textMuted[2]);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.text(`Ref: ${params.transactionId}`, col2X, yPos + 48);
  }

  // Column 3: Transaction Date
  const col3X = margin + 370;
  doc.setTextColor(textMuted[0], textMuted[1], textMuted[2]);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  doc.text("TRANSACTION DATE", col3X, yPos + 16);

  doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text(params.date, col3X, yPos + 32);

  if (params.time) {
    doc.setTextColor(textMuted[0], textMuted[1], textMuted[2]);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.text(params.time, col3X, yPos + 47);
  }

  // 3. TABLE OF CHARGES
  yPos += 90;
  // Header Bar
  doc.setFillColor(30, 41, 59); // #1e293b
  doc.rect(margin, yPos, contentWidth, 24, "F");

  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.5);
  doc.text("ITEM DESCRIPTION", margin + 15, yPos + 16);
  doc.text("TOTAL DUE", margin + 355, yPos + 16, { align: "right" });
  doc.text("AMOUNT PAID", margin + contentWidth - 15, yPos + 16, {
    align: "right",
  });

  // Table Row
  yPos += 24;
  doc.setFillColor(255, 255, 255);
  doc.setDrawColor(borderMuted[0], borderMuted[1], borderMuted[2]);
  doc.rect(margin, yPos, contentWidth, 34, "FD");

  doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9.5);
  doc.text(params.itemDescription, margin + 15, yPos + 21);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9.5);
  doc.setTextColor(textMuted[0], textMuted[1], textMuted[2]);
  doc.text(
    `${pdfCurrency}${params.totalAmount.toLocaleString("en-IN")}`,
    margin + 355,
    yPos + 21,
    { align: "right" }
  );

  doc.setFont("helvetica", "bold");
  doc.setTextColor(accentColor[0], accentColor[1], accentColor[2]);
  doc.text(
    `${pdfCurrency}${params.amountPaid.toLocaleString("en-IN")}`,
    margin + contentWidth - 15,
    yPos + 21,
    { align: "right" }
  );

  // Split breakdown if present
  if (params.paymentBreakdown && params.paymentBreakdown.length > 1) {
    yPos += 45;
    doc.setTextColor(textMuted[0], textMuted[1], textMuted[2]);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.5);
    doc.text("SPLIT PAYMENT BREAKDOWN", margin, yPos);
    yPos += 10;

    params.paymentBreakdown.forEach((item) => {
      doc.setFillColor(241, 245, 249);
      doc.setDrawColor(borderMuted[0], borderMuted[1], borderMuted[2]);
      doc.roundedRect(margin, yPos, contentWidth, 22, 3, 3, "FD");

      doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(8.5);
      doc.text(item.method.toUpperCase(), margin + 15, yPos + 14);

      if (item.transactionId) {
        doc.setFont("helvetica", "normal");
        doc.setFontSize(7.5);
        doc.setTextColor(textMuted[0], textMuted[1], textMuted[2]);
        doc.text(`(Ref / Txn ID: ${item.transactionId})`, margin + 90, yPos + 14);
      }

      doc.setFont("helvetica", "bold");
      doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
      doc.text(
        `${pdfCurrency}${item.amount.toLocaleString("en-IN")}`,
        margin + contentWidth - 15,
        yPos + 14,
        { align: "right" }
      );
      yPos += 26;
    });
  } else {
    yPos += 45;
  }

  // 4. SUMMARY CARD (Positioned on the Right)
  const summaryWidth = 240;
  const summaryX = margin + contentWidth - summaryWidth;
  doc.setFillColor(bgCard[0], bgCard[1], bgCard[2]);
  doc.setDrawColor(borderMuted[0], borderMuted[1], borderMuted[2]);
  doc.roundedRect(summaryX, yPos, summaryWidth, 75, 6, 6, "FD");

  // Total Cost
  doc.setTextColor(textMuted[0], textMuted[1], textMuted[2]);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.text("Total Installment Cost:", summaryX + 15, yPos + 18);
  doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
  doc.setFont("helvetica", "bold");
  doc.text(
    `${pdfCurrency}${params.totalAmount.toLocaleString("en-IN")}`,
    summaryX + summaryWidth - 15,
    yPos + 18,
    { align: "right" }
  );

  // Amount Paid
  doc.setTextColor(textMuted[0], textMuted[1], textMuted[2]);
  doc.setFont("helvetica", "normal");
  doc.text("Amount Paid:", summaryX + 15, yPos + 38);
  doc.setTextColor(accentColor[0], accentColor[1], accentColor[2]);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10.5);
  doc.text(
    `${pdfCurrency}${params.amountPaid.toLocaleString("en-IN")}`,
    summaryX + summaryWidth - 15,
    yPos + 38,
    { align: "right" }
  );

  // Balance Remaining
  doc.setTextColor(textMuted[0], textMuted[1], textMuted[2]);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.text("Balance Remaining:", summaryX + 15, yPos + 58);
  doc.setFont("helvetica", "bold");
  if (balanceRemaining > 0) {
    doc.setTextColor(234, 88, 12); // #ea580c orange
  } else {
    doc.setTextColor(textMuted[0], textMuted[1], textMuted[2]);
  }
  doc.text(
    `${pdfCurrency}${balanceRemaining.toLocaleString("en-IN")}`,
    summaryX + summaryWidth - 15,
    yPos + 58,
    { align: "right" }
  );

  // Remarks / Policy Box (Left side of summary)
  if (params.remarks) {
    const remarksWidth = contentWidth - summaryWidth - 20;
    doc.setTextColor(textMuted[0], textMuted[1], textMuted[2]);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.5);
    doc.text("REMARKS & NOTES", margin, yPos + 12);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    const splitLines = doc.splitTextToSize(params.remarks, remarksWidth);
    doc.text(splitLines, margin, yPos + 26);
  }

  // 5. SIGNATORY BLOCK
  yPos += 115;
  const sigX = margin + contentWidth - 180;
  doc.setDrawColor(borderMuted[0], borderMuted[1], borderMuted[2]);
  doc.line(sigX, yPos, sigX + 180, yPos);

  doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.text(params.signatoryName || "Authorized Signatory", sigX + 90, yPos + 14, { align: "center" });

  doc.setTextColor(textMuted[0], textMuted[1], textMuted[2]);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.text(params.signatoryTitle || "Accounts & Finance Department", sigX + 90, yPos + 26, { align: "center" });

  // 6. OFFICIAL FOOTER
  const footerY = 770;
  doc.setDrawColor(borderMuted[0], borderMuted[1], borderMuted[2]);
  doc.line(margin, footerY, margin + contentWidth, footerY);

  doc.setTextColor(textMuted[0], textMuted[1], textMuted[2]);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.text(
    "Official electronic payment receipt generated by Noxphere Athletic Ecosystem.",
    pageWidth / 2,
    footerY + 14,
    { align: "center" }
  );

  doc.setFontSize(7);
  doc.text(
    "All payments are recorded onto the immutable academy financial ledger. For reconciliation queries, present Receipt Number to Academy Administration.",
    pageWidth / 2,
    footerY + 26,
    { align: "center" }
  );

  // Save PDF file
  const safeName = params.studentName.replace(/[^a-zA-Z0-9]/g, "_");
  doc.save(`Receipt_${params.receiptNumber}_${safeName}.pdf`);
}

export interface EditableReceiptModalProps {
  academyName?: string;
  studentName: string;
  feeType?: string;
  installmentNumber: number;
  amountPaid: number;
  totalAmount: number;
  currency?: string;
  paymentMethod?: string;
  transactionId?: string;
  paymentBreakdown?: { method: string; amount: number; transactionId?: string }[];
  paidAt?: string | Date;
  receiptNumber?: string;
  branchName?: string;
  onClose: () => void;
}

export const EditableReceiptModal: React.FC<EditableReceiptModalProps> = ({
  academyName = "Noxphere Athletic Academy",
  studentName,
  feeType = "Tuition & Training Fee",
  installmentNumber,
  amountPaid,
  totalAmount,
  currency = "INR",
  paymentMethod = "Cash",
  transactionId = "",
  paymentBreakdown,
  paidAt,
  receiptNumber,
  branchName,
  onClose,
}) => {
  const initialDate = paidAt ? new Date(paidAt) : new Date();
  const defaultReceiptNo =
    receiptNumber ||
    `RCP-${installmentNumber}-${Date.now().toString().slice(-6)}`;

  // Form / Editable State
  const [isEditing, setIsEditing] = useState<boolean>(false);
  const [formAcademyName, setFormAcademyName] = useState<string>(academyName);
  const [formTagline, setFormTagline] = useState<string>(
    branchName
      ? `${branchName.toUpperCase()} · OFFICIAL PAYMENT RECEIPT`
      : "ATHLETIC TRAINING ACADEMY · OFFICIAL FEE RECEIPT"
  );
  const [formStudentName, setFormStudentName] = useState<string>(studentName);
  const [formReceiptNumber, setFormReceiptNumber] = useState<string>(defaultReceiptNo);
  const [formDate, setFormDate] = useState<string>(
    initialDate.toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    })
  );
  const [formTime, setFormTime] = useState<string>(
    initialDate.toLocaleTimeString("en-IN", {
      hour: "2-digit",
      minute: "2-digit",
    })
  );
  const [formPaymentMethod, setFormPaymentMethod] = useState<string>(paymentMethod || "Cash");
  const [formTransactionId, setFormTransactionId] = useState<string>(transactionId || "");
  const [formItemDescription, setFormItemDescription] = useState<string>(
    `${feeType.replace("_", " ")} - Installment #${installmentNumber}`
  );
  const [formTotalAmount, setFormTotalAmount] = useState<number>(totalAmount);
  const [formAmountPaid, setFormAmountPaid] = useState<number>(amountPaid);
  const [formCurrency, setFormCurrency] = useState<string>(currency);
  const [formRemarks, setFormRemarks] = useState<string>(
    "Official electronic payment receipt generated by Noxphere Athletic Ecosystem. All payments are recorded onto the immutable financial ledger."
  );
  const [formSignatoryName, setFormSignatoryName] = useState<string>("Authorized Signatory");
  const [formSignatoryTitle, setFormSignatoryTitle] = useState<string>("Accounts & Finance Department");

  const [isDownloading, setIsDownloading] = useState<boolean>(false);
  const receiptContainerRef = useRef<HTMLDivElement>(null);

  const balanceRemaining = Math.max(0, formTotalAmount - formAmountPaid);

  const handleReset = () => {
    setFormAcademyName(academyName);
    setFormTagline(
      branchName
        ? `${branchName.toUpperCase()} · OFFICIAL PAYMENT RECEIPT`
        : "ATHLETIC TRAINING ACADEMY · OFFICIAL FEE RECEIPT"
    );
    setFormStudentName(studentName);
    setFormReceiptNumber(defaultReceiptNo);
    setFormDate(
      initialDate.toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      })
    );
    setFormTime(
      initialDate.toLocaleTimeString("en-IN", {
        hour: "2-digit",
        minute: "2-digit",
      })
    );
    setFormPaymentMethod(paymentMethod || "Cash");
    setFormTransactionId(transactionId || "");
    setFormItemDescription(
      `${feeType.replace("_", " ")} - Installment #${installmentNumber}`
    );
    setFormTotalAmount(totalAmount);
    setFormAmountPaid(amountPaid);
    setFormCurrency(currency);
    setFormRemarks(
      "Official electronic payment receipt generated by Noxphere Athletic Ecosystem. All payments are recorded onto the immutable financial ledger."
    );
    setFormSignatoryName("Authorized Signatory");
    setFormSignatoryTitle("Accounts & Finance Department");
    toast.success("Receipt fields reset to original records.");
  };

  const handlePrint = () => {
    window.print();
  };

  const handleDownloadPdf = () => {
    setIsDownloading(true);
    try {
      generateVectorReceiptPdf({
        academyName: formAcademyName,
        tagline: formTagline,
        studentName: formStudentName,
        receiptNumber: formReceiptNumber,
        date: formDate,
        time: formTime,
        paymentMethod: formPaymentMethod,
        transactionId: formTransactionId,
        itemDescription: formItemDescription,
        installmentNumber,
        totalAmount: formTotalAmount,
        amountPaid: formAmountPaid,
        currency: formCurrency,
        paymentBreakdown,
        remarks: formRemarks,
        signatoryName: formSignatoryName,
        signatoryTitle: formSignatoryTitle,
      });
      toast.success("Receipt downloaded as official PDF!");
    } catch (err) {
      console.error("Failed to generate PDF:", err);
      toast.error("Failed to export PDF. Please try Print instead.");
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/80 backdrop-blur-sm animate-fade-in print:p-0 print:bg-white print:static">
      <div className="card w-full max-w-3xl max-h-[94vh] overflow-y-auto border-slate-200 dark:border-white/10 bg-slate-900 shadow-2xl p-0 rounded-2xl flex flex-col print:shadow-none print:border-none print:max-h-none print:w-full print:bg-white">
        {/* Top Control Bar (Hidden when printing) */}
        <div className="flex items-center justify-between border-b border-slate-200/10 px-5 py-3.5 bg-pitch-900 rounded-t-2xl print:hidden sticky top-0 z-20">
          <div className="flex items-center gap-2.5">
            <span className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <FileText size={18} />
            </span>
            <div>
              <h3 className="font-orbital text-sm font-semibold text-white flex items-center gap-2">
                Official Fee Receipt
                {isEditing ? (
                  <span className="text-3xs font-mono px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30">
                    Editing Mode
                  </span>
                ) : (
                  <span className="text-3xs font-mono px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                    Live Preview
                  </span>
                )}
              </h3>
              <p className="text-2xs text-slate-400 font-mono">
                {formReceiptNumber} · {formStudentName}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Edit Mode Toggle */}
            <button
              type="button"
              onClick={() => setIsEditing(!isEditing)}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                isEditing
                  ? "bg-amber-500/20 text-amber-300 border border-amber-500/30 hover:bg-amber-500/30"
                  : "bg-white/5 text-slate-300 hover:bg-white/10 border border-white/5"
              }`}
              title="Toggle inline editing for receipt fields"
            >
              {isEditing ? (
                <>
                  <Check size={13} />
                  <span>Done Editing</span>
                </>
              ) : (
                <>
                  <Edit3 size={13} />
                  <span>Customize</span>
                </>
              )}
            </button>

            {/* Reset Defaults */}
            <button
              type="button"
              onClick={handleReset}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white bg-white/5 hover:bg-white/10 transition-colors"
              title="Reset fields to database values"
            >
              <RotateCcw size={14} />
            </button>

            {/* Print Button */}
            <button
              type="button"
              onClick={handlePrint}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-slate-200 bg-white/5 hover:bg-white/10 transition-colors"
              title="Print directly or save via browser"
            >
              <Printer size={13} />
              <span className="hidden sm:inline">Print</span>
            </button>

            {/* Download Vector PDF Button */}
            <button
              type="button"
              onClick={handleDownloadPdf}
              disabled={isDownloading}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold text-pitch-950 bg-volt-400 hover:bg-volt-300 transition-colors shadow-sm disabled:opacity-50"
              title="Download executive PDF"
            >
              <Download size={13} />
              <span>{isDownloading ? "Generating..." : "Download PDF"}</span>
            </button>

            {/* Close Button */}
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors ml-1"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Informative helper pill in Edit Mode */}
        {isEditing && (
          <div className="bg-amber-500/10 border-b border-amber-500/20 px-6 py-2 flex items-center justify-between text-2xs text-amber-200 print:hidden">
            <span>
              ✏️ <strong>Edit Mode Active:</strong> You can modify any text, amounts, dates, or remarks directly below before downloading.
            </span>
            <button
              type="button"
              onClick={() => setIsEditing(false)}
              className="underline font-semibold hover:text-amber-100"
            >
              Preview Document
            </button>
          </div>
        )}

        {/* Paper Container (Styled like real A4 invoice/receipt) */}
        <div className="p-4 sm:p-8 bg-slate-950/60 flex justify-center print:p-0 print:bg-white">
          <div
            ref={receiptContainerRef}
            className="w-full max-w-[700px] bg-white text-slate-900 rounded-xl shadow-2xl overflow-hidden border border-slate-200 print:border-none print:shadow-none print:rounded-none"
            style={{ minHeight: "850px" }}
          >
            {/* 1. TOP HEADER BANNER (Exactly matching receiptGenerator.ts) */}
            <div className="bg-[#0f172a] text-white p-6 sm:p-7 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="space-y-1 flex-1">
                {isEditing ? (
                  <div className="space-y-1">
                    <label className="text-3xs uppercase tracking-wider text-slate-400 font-mono">
                      Academy Name
                    </label>
                    <input
                      type="text"
                      value={formAcademyName}
                      onChange={(e) => setFormAcademyName(e.target.value)}
                      className="w-full bg-slate-800 text-white font-bold text-lg px-2.5 py-1 rounded border border-slate-700 focus:outline-none focus:border-volt-400"
                    />
                    <label className="text-3xs uppercase tracking-wider text-slate-400 font-mono block mt-1">
                      Header Tagline / Subtitle
                    </label>
                    <input
                      type="text"
                      value={formTagline}
                      onChange={(e) => setFormTagline(e.target.value)}
                      className="w-full bg-slate-800 text-slate-300 text-xs px-2.5 py-1 rounded border border-slate-700 focus:outline-none focus:border-volt-400"
                    />
                  </div>
                ) : (
                  <>
                    <h1 className="font-bold text-xl sm:text-2xl tracking-tight text-white uppercase">
                      {formAcademyName}
                    </h1>
                    <p className="text-3xs font-mono uppercase tracking-widest text-slate-400">
                      {formTagline}
                    </p>
                  </>
                )}
              </div>

              {/* Top-Right Payment Verified Stamp */}
              <div className="bg-[#16a34a] text-white rounded-lg px-4 py-2 text-center min-w-[130px] shadow-sm">
                <div className="flex items-center justify-center gap-1 text-[11px] font-bold tracking-wider uppercase">
                  <ShieldCheck size={14} />
                  <span>PAYMENT VERIFIED</span>
                </div>
                {isEditing ? (
                  <input
                    type="text"
                    value={formReceiptNumber}
                    onChange={(e) => setFormReceiptNumber(e.target.value)}
                    className="w-full text-center bg-emerald-800/80 text-white font-mono text-2xs px-1 py-0.5 mt-1 rounded border border-emerald-400/30 focus:outline-none"
                    placeholder="Receipt #"
                  />
                ) : (
                  <div className="text-3xs font-mono text-emerald-100 mt-0.5">
                    {formReceiptNumber}
                  </div>
                )}
              </div>
            </div>

            {/* Content Body */}
            <div className="p-6 sm:p-8 space-y-6">
              {/* 2. META DETAILS BOX */}
              <div className="bg-[#f8fafc] border border-[#e2e8f0] rounded-xl p-4 sm:p-5 grid grid-cols-1 sm:grid-cols-3 gap-4">
                {/* Student / Athlete */}
                <div className="space-y-1">
                  <span className="text-3xs font-bold uppercase tracking-wider text-[#64748b]">
                    STUDENT / ATHLETE
                  </span>
                  {isEditing ? (
                    <input
                      type="text"
                      value={formStudentName}
                      onChange={(e) => setFormStudentName(e.target.value)}
                      className="w-full bg-white text-slate-900 font-bold text-sm px-2 py-1 rounded border border-slate-300 focus:outline-none focus:border-emerald-500"
                    />
                  ) : (
                    <div className="font-bold text-base text-[#0f172a] flex items-center gap-1.5">
                      <User size={15} className="text-emerald-600" />
                      <span>{formStudentName}</span>
                    </div>
                  )}
                  <p className="text-xs text-[#64748b]">
                    Installment #{installmentNumber} Payment
                  </p>
                </div>

                {/* Payment Method */}
                <div className="space-y-1">
                  <span className="text-3xs font-bold uppercase tracking-wider text-[#64748b]">
                    PAYMENT METHOD
                  </span>
                  {isEditing ? (
                    <div className="space-y-1">
                      <input
                        type="text"
                        value={formPaymentMethod}
                        onChange={(e) => setFormPaymentMethod(e.target.value)}
                        className="w-full bg-white text-slate-900 font-bold text-xs px-2 py-1 rounded border border-slate-300 focus:outline-none focus:border-emerald-500 uppercase"
                        placeholder="e.g. UPI, CASH, CARD"
                      />
                      <input
                        type="text"
                        value={formTransactionId}
                        onChange={(e) => setFormTransactionId(e.target.value)}
                        className="w-full bg-white text-slate-700 text-2xs px-2 py-0.5 rounded border border-slate-300 focus:outline-none focus:border-emerald-500 font-mono"
                        placeholder="Ref / Transaction ID"
                      />
                    </div>
                  ) : (
                    <>
                      <div className="font-bold text-sm text-[#0f172a] uppercase flex items-center gap-1.5">
                        <CreditCard size={14} className="text-slate-500" />
                        <span>{formPaymentMethod}</span>
                      </div>
                      {formTransactionId && (
                        <p className="text-2xs font-mono text-[#64748b] truncate">
                          Ref: {formTransactionId}
                        </p>
                      )}
                    </>
                  )}
                </div>

                {/* Transaction Date */}
                <div className="space-y-1">
                  <span className="text-3xs font-bold uppercase tracking-wider text-[#64748b]">
                    TRANSACTION DATE
                  </span>
                  {isEditing ? (
                    <div className="space-y-1">
                      <input
                        type="text"
                        value={formDate}
                        onChange={(e) => setFormDate(e.target.value)}
                        className="w-full bg-white text-slate-900 font-bold text-xs px-2 py-1 rounded border border-slate-300 focus:outline-none focus:border-emerald-500"
                        placeholder="Date"
                      />
                      <input
                        type="text"
                        value={formTime}
                        onChange={(e) => setFormTime(e.target.value)}
                        className="w-full bg-white text-slate-700 text-2xs px-2 py-0.5 rounded border border-slate-300 focus:outline-none focus:border-emerald-500 font-mono"
                        placeholder="Time"
                      />
                    </div>
                  ) : (
                    <>
                      <div className="font-bold text-sm text-[#0f172a] flex items-center gap-1.5">
                        <Calendar size={14} className="text-slate-500" />
                        <span>{formDate}</span>
                      </div>
                      {formTime && (
                        <p className="text-2xs font-mono text-[#64748b]">
                          {formTime}
                        </p>
                      )}
                    </>
                  )}
                </div>
              </div>

              {/* 3. TABLE OF CHARGES */}
              <div className="border border-[#e2e8f0] rounded-xl overflow-hidden">
                <table className="w-full text-left text-xs">
                  <thead className="bg-[#1e293b] text-white">
                    <tr>
                      <th className="py-2.5 px-4 font-bold tracking-wider text-2xs uppercase">
                        ITEM DESCRIPTION
                      </th>
                      <th className="py-2.5 px-4 font-bold tracking-wider text-2xs uppercase text-right">
                        TOTAL DUE
                      </th>
                      <th className="py-2.5 px-4 font-bold tracking-wider text-2xs uppercase text-right">
                        AMOUNT PAID
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#e2e8f0] bg-white">
                    <tr>
                      <td className="py-3.5 px-4">
                        {isEditing ? (
                          <input
                            type="text"
                            value={formItemDescription}
                            onChange={(e) => setFormItemDescription(e.target.value)}
                            className="w-full bg-slate-50 font-semibold text-xs px-2 py-1 rounded border border-slate-300 focus:outline-none focus:border-emerald-500"
                          />
                        ) : (
                          <div className="font-bold text-sm text-[#0f172a]">
                            {formItemDescription}
                          </div>
                        )}
                        <div className="text-2xs text-[#64748b] mt-0.5">
                          Official Academy Training Milestone
                        </div>
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono text-sm text-[#64748b]">
                        {isEditing ? (
                          <input
                            type="number"
                            value={formTotalAmount}
                            onChange={(e) => setFormTotalAmount(Number(e.target.value) || 0)}
                            className="w-24 text-right bg-slate-50 font-mono text-xs px-2 py-1 rounded border border-slate-300 focus:outline-none focus:border-emerald-500"
                          />
                        ) : (
                          formatCurrency(formTotalAmount, formCurrency)
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono font-bold text-base text-[#16a34a]">
                        {isEditing ? (
                          <input
                            type="number"
                            value={formAmountPaid}
                            onChange={(e) => setFormAmountPaid(Number(e.target.value) || 0)}
                            className="w-24 text-right bg-slate-50 font-mono text-xs font-bold text-emerald-600 px-2 py-1 rounded border border-slate-300 focus:outline-none focus:border-emerald-500"
                          />
                        ) : (
                          formatCurrency(formAmountPaid, formCurrency)
                        )}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Payment Breakdown (if multiple split methods) */}
              {paymentBreakdown && paymentBreakdown.length > 1 && (
                <div className="space-y-1.5">
                  <span className="text-3xs font-bold uppercase tracking-wider text-[#64748b]">
                    SPLIT PAYMENT BREAKDOWN
                  </span>
                  <div className="space-y-1.5">
                    {paymentBreakdown.map((item, idx) => (
                      <div
                        key={idx}
                        className="flex items-center justify-between px-3.5 py-1.5 rounded-lg bg-[#f1f5f9] border border-[#e2e8f0] text-xs font-medium"
                      >
                        <span className="font-bold uppercase text-[#0f172a]">
                          {item.method}{" "}
                          {item.transactionId && (
                            <span className="font-normal font-mono text-2xs text-[#64748b]">
                              (Ref: {item.transactionId})
                            </span>
                          )}
                        </span>
                        <span className="font-mono font-bold text-[#0f172a]">
                          {formatCurrency(item.amount, formCurrency)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* 4. SUMMARY & REMARKS SECTION */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-start pt-2">
                {/* Remarks / Custom Notes */}
                <div className="space-y-1.5">
                  <span className="text-3xs font-bold uppercase tracking-wider text-[#64748b]">
                    REMARKS &amp; NOTES
                  </span>
                  {isEditing ? (
                    <textarea
                      rows={3}
                      value={formRemarks}
                      onChange={(e) => setFormRemarks(e.target.value)}
                      className="w-full bg-slate-50 text-xs p-2 rounded-lg border border-slate-300 focus:outline-none focus:border-emerald-500"
                      placeholder="Add custom notes, policies, or receipts comments..."
                    />
                  ) : (
                    <p className="text-xs text-[#64748b] leading-relaxed bg-[#f8fafc] p-3 rounded-lg border border-[#e2e8f0]">
                      {formRemarks}
                    </p>
                  )}
                </div>

                {/* Financial Summary Card */}
                <div className="bg-[#f8fafc] border border-[#e2e8f0] rounded-xl p-4 space-y-2.5">
                  <div className="flex justify-between text-xs text-[#64748b]">
                    <span>Total Installment Cost:</span>
                    <span className="font-mono font-bold text-[#0f172a]">
                      {formatCurrency(formTotalAmount, formCurrency)}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm font-semibold text-[#0f172a]">
                    <span>Amount Paid:</span>
                    <span className="font-mono font-bold text-base text-[#16a34a]">
                      {formatCurrency(formAmountPaid, formCurrency)}
                    </span>
                  </div>
                  <div className="border-t border-[#e2e8f0] pt-2 flex justify-between text-xs">
                    <span className="text-[#64748b]">Balance Remaining:</span>
                    <span
                      className={`font-mono font-bold ${
                        balanceRemaining > 0 ? "text-[#ea580c]" : "text-[#64748b]"
                      }`}
                    >
                      {formatCurrency(balanceRemaining, formCurrency)}
                    </span>
                  </div>
                </div>
              </div>

              {/* 5. SIGNATORY BLOCK */}
              <div className="pt-8 flex justify-end">
                <div className="text-center w-52 space-y-1">
                  <div className="border-b border-[#e2e8f0] pb-6 mb-2">
                    {/* Visual signature placeholder or space */}
                  </div>
                  {isEditing ? (
                    <div className="space-y-1">
                      <input
                        type="text"
                        value={formSignatoryName}
                        onChange={(e) => setFormSignatoryName(e.target.value)}
                        className="w-full text-center bg-slate-50 font-bold text-xs px-2 py-0.5 rounded border border-slate-300 focus:outline-none focus:border-emerald-500"
                      />
                      <input
                        type="text"
                        value={formSignatoryTitle}
                        onChange={(e) => setFormSignatoryTitle(e.target.value)}
                        className="w-full text-center bg-slate-50 text-2xs px-2 py-0.5 rounded border border-slate-300 focus:outline-none focus:border-emerald-500"
                      />
                    </div>
                  ) : (
                    <>
                      <div className="font-bold text-xs text-[#0f172a]">
                        {formSignatoryName}
                      </div>
                      <div className="text-3xs text-[#64748b]">
                        {formSignatoryTitle}
                      </div>
                    </>
                  )}
                </div>
              </div>

              {/* 6. OFFICIAL FOOTER */}
              <div className="border-t border-[#e2e8f0] pt-5 text-center space-y-1 text-3xs text-[#64748b]">
                <p className="font-medium">
                  Official electronic payment receipt generated by Noxphere Athletic Ecosystem.
                </p>
                <p>
                  All payments are recorded onto the immutable academy financial ledger. For reconciliation queries, present Receipt Number to Academy Administration.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

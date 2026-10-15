// src/features/guardian/FeeReceiptModal.tsx
import React from "react";
import {
  X,
  Printer,
  Download,
  CheckCircle2,
  Building2,
  Calendar,
  CreditCard,
  Hash,
  User,
  ShieldCheck,
  ExternalLink,
} from "lucide-react";

export interface FeeReceiptModalProps {
  academyName?: string;
  studentName: string;
  feeType?: string;
  installmentNumber: number;
  amountPaid: number;
  totalAmount: number;
  currency?: string;
  paymentMethod?: string;
  transactionId?: string;
  paidAt?: string;
  receiptNumber?: string;
  receiptUrl?: string;
  onClose: () => void;
}

export const FeeReceiptModal: React.FC<FeeReceiptModalProps> = ({
  academyName = "Noxphere Athletic Academy",
  studentName,
  feeType = "Tuition Fee",
  installmentNumber,
  amountPaid,
  totalAmount,
  currency = "INR",
  paymentMethod = "UPI",
  transactionId,
  paidAt,
  receiptNumber,
  receiptUrl,
  onClose,
}) => {
  const currSymbol = currency === "INR" ? "₹" : currency;
  const formattedDate = paidAt
    ? new Date(paidAt).toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      })
    : new Date().toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      });

  const formattedTime = paidAt
    ? new Date(paidAt).toLocaleTimeString("en-IN", {
        hour: "2-digit",
        minute: "2-digit",
      })
    : "";

  const finalReceiptNumber =
    receiptNumber ||
    `RCP-${installmentNumber}-${Date.now().toString().slice(-6)}`;

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-sm animate-fade-in print:p-0 print:bg-white print:static">
      <div className="card w-full max-w-xl max-h-[92vh] overflow-y-auto border-slate-200 dark:border-white/10 bg-white dark:bg-pitch-800 shadow-2xl p-0 rounded-2xl flex flex-col print:shadow-none print:border-none print:max-h-none print:w-full">
        {/* Header Bar */}
        <div className="flex items-center justify-between border-b border-slate-200 dark:border-white/10 px-5 sm:px-6 py-4 bg-slate-50 dark:bg-pitch-900 rounded-t-2xl print:hidden">
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
              <ShieldCheck size={18} />
            </span>
            <div>
              <h3 className="font-orbital text-sm font-semibold text-slate-900 dark:text-white">
                Payment Receipt
              </h3>
              <p className="text-2xs text-slate-500 dark:text-slate-400 font-mono">
                {finalReceiptNumber}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handlePrint}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-slate-700 dark:text-slate-200 bg-slate-200/70 dark:bg-white/5 hover:bg-slate-300/80 dark:hover:bg-white/10 transition-colors"
              title="Print Receipt"
            >
              <Printer size={13} />
              <span className="hidden sm:inline">Print</span>
            </button>
            {receiptUrl && (
              <a
                href={receiptUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-pitch-950 bg-volt-400 hover:bg-volt-300 transition-colors shadow-sm"
                title="Download Official PDF"
              >
                <Download size={13} />
                <span className="hidden sm:inline">PDF</span>
              </a>
            )}
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-white hover:bg-slate-200/60 dark:hover:bg-white/10 transition-colors ml-1"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Printable Receipt Canvas */}
        <div className="p-6 sm:p-8 space-y-6 text-slate-900 dark:text-slate-100 print:p-6 print:text-black">
          {/* Academy & Verified Header */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-6 border-b border-slate-200 dark:border-white/10 print:border-slate-300">
            <div>
              <div className="flex items-center gap-2">
                <Building2 size={20} className="text-volt-500" />
                <h2 className="font-orbital text-lg sm:text-xl font-bold tracking-tight text-slate-900 dark:text-white print:text-black">
                  {academyName}
                </h2>
              </div>
              <p className="text-2xs font-mono uppercase tracking-wider text-slate-500 dark:text-slate-400 mt-1">
                Official Electronic Payment Receipt
              </p>
            </div>

            <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 font-bold text-xs uppercase tracking-wider">
              <CheckCircle2 size={14} />
              <span>Verified &amp; Paid</span>
            </div>
          </div>

          {/* Details 2-Column Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-slate-50 dark:bg-white/[0.02] border border-slate-200/80 dark:border-white/5 rounded-xl p-4 sm:p-5 print:bg-slate-100 print:border-slate-300">
            {/* Student Info */}
            <div className="space-y-3">
              <div>
                <span className="text-3xs uppercase tracking-wider font-mono text-slate-400 dark:text-slate-500">
                  Student / Athlete
                </span>
                <div className="font-orbital font-bold text-base text-slate-900 dark:text-white print:text-black flex items-center gap-1.5 mt-0.5">
                  <User size={15} className="text-volt-500" />
                  <span>{studentName}</span>
                </div>
              </div>

              <div>
                <span className="text-3xs uppercase tracking-wider font-mono text-slate-400 dark:text-slate-500">
                  Fee Plan &amp; Milestone
                </span>
                <p className="text-xs font-semibold text-slate-700 dark:text-slate-300 print:text-slate-800 capitalize mt-0.5">
                  {feeType.replace("_", " ")} · Installment #{installmentNumber}
                </p>
              </div>
            </div>

            {/* Transaction Info */}
            <div className="space-y-3">
              <div>
                <span className="text-3xs uppercase tracking-wider font-mono text-slate-400 dark:text-slate-500">
                  Receipt Number
                </span>
                <p className="font-mono text-xs font-bold text-slate-900 dark:text-white print:text-black mt-0.5">
                  {finalReceiptNumber}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <span className="text-3xs uppercase tracking-wider font-mono text-slate-400 dark:text-slate-500">
                    Payment Mode
                  </span>
                  <p className="text-xs font-semibold text-slate-800 dark:text-slate-200 capitalize mt-0.5">
                    {paymentMethod}
                  </p>
                </div>
                <div>
                  <span className="text-3xs uppercase tracking-wider font-mono text-slate-400 dark:text-slate-500">
                    Date Paid
                  </span>
                  <p className="text-xs font-mono font-medium text-slate-800 dark:text-slate-200 mt-0.5">
                    {formattedDate} {formattedTime && `· ${formattedTime}`}
                  </p>
                </div>
              </div>

              {transactionId && (
                <div>
                  <span className="text-3xs uppercase tracking-wider font-mono text-slate-400 dark:text-slate-500">
                    Transaction / UTR Reference
                  </span>
                  <p className="font-mono text-xs text-slate-700 dark:text-slate-300 truncate mt-0.5">
                    {transactionId}
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Itemized Table */}
          <div className="border border-slate-200 dark:border-white/10 rounded-xl overflow-hidden print:border-slate-300">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-100 dark:bg-white/5 border-b border-slate-200 dark:border-white/10 print:bg-slate-200">
                <tr>
                  <th className="py-2.5 px-4 font-semibold text-slate-600 dark:text-slate-300 print:text-black">
                    Item Description
                  </th>
                  <th className="py-2.5 px-4 font-semibold text-slate-600 dark:text-slate-300 text-right print:text-black">
                    Total Due
                  </th>
                  <th className="py-2.5 px-4 font-semibold text-slate-600 dark:text-slate-300 text-right print:text-black">
                    Amount Paid
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-white/5 print:divide-slate-300">
                <tr>
                  <td className="py-3 px-4">
                    <div className="font-semibold text-slate-900 dark:text-white print:text-black">
                      {feeType.replace("_", " ").toUpperCase()}
                    </div>
                    <div className="text-2xs text-slate-500 dark:text-slate-400">
                      Installment #{installmentNumber}
                    </div>
                  </td>
                  <td className="py-3 px-4 text-right font-mono text-slate-600 dark:text-slate-400">
                    {currSymbol}
                    {totalAmount.toLocaleString("en-IN")}
                  </td>
                  <td className="py-3 px-4 text-right font-mono font-bold text-emerald-600 dark:text-emerald-400">
                    {currSymbol}
                    {amountPaid.toLocaleString("en-IN")}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Amount Paid Highlight Card */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-4 rounded-xl bg-gradient-to-r from-emerald-500/10 via-transparent to-volt-400/5 border border-emerald-500/20">
            <div className="flex items-center gap-2">
              <CheckCircle2 size={18} className="text-emerald-500" />
              <span className="text-xs font-medium text-slate-700 dark:text-slate-300">
                Payment verified and acknowledged by academy
              </span>
            </div>
            <div className="text-right">
              <span className="text-3xs uppercase tracking-wider font-mono text-slate-500">
                Total Paid
              </span>
              <div className="font-orbital text-xl font-extrabold text-emerald-600 dark:text-emerald-400">
                {currSymbol}
                {amountPaid.toLocaleString("en-IN")}
              </div>
            </div>
          </div>

          {/* Footer Notice */}
          <div className="pt-4 border-t border-slate-200 dark:border-white/10 text-center space-y-1 print:border-slate-300">
            <p className="text-2xs text-slate-500 dark:text-slate-400">
              This is a verified computer-generated receipt issued by Noxphere
              Athletic Operating System.
            </p>
            <p className="text-3xs text-slate-400 dark:text-slate-500 font-mono">
              Authentication Hash: {finalReceiptNumber} · Status: Settled
            </p>
          </div>
        </div>

        {/* Modal Bottom Actions (Print, Close) */}
        <div className="border-t border-slate-200 dark:border-white/10 p-4 bg-slate-50 dark:bg-pitch-900 rounded-b-2xl flex items-center justify-between gap-3 print:hidden">
          <span className="text-xs text-slate-500 dark:text-slate-400 font-mono">
            {finalReceiptNumber}
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handlePrint}
              className="btn-secondary text-xs py-2 px-4 flex items-center gap-1.5"
            >
              <Printer size={13} />
              <span>Print Receipt</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="btn-primary text-xs py-2 px-5"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

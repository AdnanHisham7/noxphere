// src/features/guardian/PayFeeModal.tsx
import React, { useState } from "react";
import {
  X,
  Copy,
  Check,
  QrCode,
  Building2,
  Wallet,
  ShieldCheck,
  Calendar,
  User,
  ArrowRight,
  Info,
  AlertCircle,
} from "lucide-react";
import { toast } from "react-hot-toast";
import {
  useGetChildPaymentConfigQuery,
  usePayChildFeeMutation,
} from "../../store/api/guardianApi";
import { NoxSkeleton } from "../../components/portal-ui";
import { Select } from "../../components/ui";

interface PayFeeModalProps {
  feeId: string;
  installmentNumber: number;
  studentId: string;
  studentName?: string;
  feeType?: string;
  amount: number;
  dueDate?: string;
  currency?: string;
  onClose: () => void;
  onSuccess?: () => void;
}

export const PayFeeModal: React.FC<PayFeeModalProps> = ({
  feeId,
  installmentNumber,
  studentId,
  studentName,
  feeType,
  amount,
  dueDate,
  currency = "INR",
  onClose,
  onSuccess,
}) => {
  const { data: config, isLoading: configLoading } =
    useGetChildPaymentConfigQuery(studentId);
  const [payChildFee, { isLoading: isSubmitting }] = usePayChildFeeMutation();

  const [activeTab, setActiveTab] = useState<"qr" | "bank_transfer">("qr");
  const [copiedField, setCopiedField] = useState<string | null>(null);

  // Payment confirmation form fields
  const [paymentMethod, setPaymentMethod] = useState<string>("upi");
  const [payAmount, setPayAmount] = useState<number>(amount);
  const [transactionId, setTransactionId] = useState<string>("");
  const [notes, setNotes] = useState<string>("");

  // Sync initial tab with academy payment method
  React.useEffect(() => {
    if (config?.paymentMethod === "bank_transfer") {
      setActiveTab("bank_transfer");
      setPaymentMethod("bank_transfer");
    } else if (config?.paymentMethod === "qr") {
      setActiveTab("qr");
      setPaymentMethod("upi");
    }
  }, [config?.paymentMethod]);

  const copyToClipboard = (text: string, fieldName: string) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedField(fieldName);
    toast.success(`${fieldName} copied to clipboard`);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const numericAmount = Number(payAmount);
    if (!numericAmount || numericAmount <= 0) {
      toast.error("Please enter a valid payment amount greater than zero");
      return;
    }

    if (numericAmount > amount) {
      toast.error(`Amount cannot exceed the remaining due of ${currency === "INR" ? "₹" : currency} ${amount.toLocaleString("en-IN")}`);
      return;
    }

    if (
      (paymentMethod === "upi" || paymentMethod === "bank_transfer") &&
      !transactionId.trim()
    ) {
      toast.error(
        paymentMethod === "upi"
          ? "Please provide the UPI Transaction Reference ID (UTR)"
          : "Please enter the Bank Transfer Reference / UTR Number"
      );
      return;
    }

    try {
      await payChildFee({
        feeId,
        installmentNumber,
        amount: numericAmount,
        paymentMethod,
        transactionId: transactionId.trim() || undefined,
        notes: notes.trim() || undefined,
      }).unwrap();

      toast.success(
        "Payment proof submitted successfully! Awaiting academy verification."
      );
      onSuccess?.();
      onClose();
    } catch (err: any) {
      toast.error(
        err?.data?.message || "Failed to submit payment. Please try again."
      );
    }
  };

  const currencySymbol = currency === "INR" ? "₹" : currency;
  const isBoth = config?.paymentMethod === "both";
  const showQr = activeTab === "qr" || config?.paymentMethod === "qr";
  const showBank =
    activeTab === "bank_transfer" || config?.paymentMethod === "bank_transfer";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
      <div className="card w-full max-w-xl max-h-[92vh] overflow-y-auto border-slate-200 dark:border-white/10 bg-white dark:bg-pitch-800 shadow-2xl p-0 rounded-2xl flex flex-col">
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-slate-200 dark:border-white/10 px-5 sm:px-6 py-4 sticky top-0 bg-white/95 dark:bg-pitch-900/95 backdrop-blur z-20 rounded-t-2xl">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-volt-400/15 border border-volt-400/30 flex items-center justify-center text-volt-600 dark:text-volt-400">
              <Wallet size={20} />
            </div>
            <div>
              <h3 className="font-orbital text-base font-semibold text-slate-900 dark:text-white">
                Submit Fee Payment
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Installment #{installmentNumber} · {config?.academyName || "Academy Office"}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 dark:hover:text-white transition-colors p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-white/[0.06]"
          >
            <X size={20} />
          </button>
        </div>

        <div className="p-5 sm:p-6 space-y-6">
          {/* Fee Summary Banner */}
          <div className="bg-slate-50 dark:bg-white/[0.02] border border-slate-200 dark:border-white/10 rounded-xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-volt-600 dark:text-volt-400 uppercase tracking-wider">
                  {feeType?.replace("_", " ") || "Tuition Fee"}
                </span>
                {studentName && (
                  <span className="text-xs text-slate-600 dark:text-slate-300 flex items-center gap-1 font-medium">
                    <User size={12} /> {studentName}
                  </span>
                )}
              </div>
              {dueDate && (
                <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 font-mono mt-1">
                  <Calendar size={13} /> Due:{" "}
                  {new Date(dueDate).toLocaleDateString(undefined, {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  })}
                </div>
              )}
            </div>

            <div className="text-left sm:text-right">
              <span className="text-3xs font-mono uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Remaining Due
              </span>
              <div className="font-orbital text-xl sm:text-2xl font-bold text-slate-900 dark:text-white">
                {currencySymbol}
                {amount.toLocaleString("en-IN")}
              </div>
            </div>
          </div>

          {configLoading ? (
            <NoxSkeleton className="h-64 rounded-xl" />
          ) : (
            <>
              {/* Method Tabs if both QR and Bank Transfer supported */}
              {isBoth && (
                <div className="grid grid-cols-2 gap-2 p-1 bg-slate-100 dark:bg-white/5 rounded-xl border border-slate-200 dark:border-white/5">
                  <button
                    type="button"
                    onClick={() => setActiveTab("qr")}
                    className={`flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-xs font-semibold transition-all ${
                      activeTab === "qr"
                        ? "bg-white dark:bg-pitch-700 text-slate-900 dark:text-white shadow-sm"
                        : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                    }`}
                  >
                    <QrCode size={14} />
                    <span>Pay via UPI QR</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveTab("bank_transfer")}
                    className={`flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-xs font-semibold transition-all ${
                      activeTab === "bank_transfer"
                        ? "bg-white dark:bg-pitch-700 text-slate-900 dark:text-white shadow-sm"
                        : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                    }`}
                  >
                    <Building2 size={14} />
                    <span>Bank Transfer (NEFT/IMPS)</span>
                  </button>
                </div>
              )}

              {/* 1. UPI QR Presentation */}
              {showQr && (
                <div className="space-y-4">
                  {config?.feeQrImageUrl ? (
                    <div className="flex flex-col items-center justify-center p-5 bg-slate-50 dark:bg-white/[0.02] border border-slate-200 dark:border-white/10 rounded-2xl text-center">
                      <div className="relative p-3 bg-white rounded-2xl shadow-md border border-slate-200">
                        <img
                          src={config.feeQrImageUrl}
                          alt="Academy Payment QR Code"
                          className="w-44 h-44 object-contain"
                        />
                      </div>
                      <p className="text-xs font-medium text-slate-700 dark:text-slate-300 mt-3">
                        Scan with GPay, PhonePe, Paytm or any UPI App
                      </p>
                      <p className="text-2xs text-slate-500 dark:text-slate-400 mt-0.5">
                        Amount to pay: {currencySymbol} {payAmount.toLocaleString("en-IN")}
                      </p>
                    </div>
                  ) : (
                    <div className="p-4 bg-amber-500/10 border border-amber-500/20 rounded-xl text-amber-700 dark:text-amber-400 text-xs flex items-center gap-2">
                      <AlertCircle size={16} className="shrink-0" />
                      <span>
                        The academy has not uploaded a payment QR code yet. Please use direct bank transfer details below.
                      </span>
                    </div>
                  )}

                  {config?.bankDetails?.upiId && (
                    <div className="bg-slate-50 dark:bg-white/[0.03] border border-slate-200 dark:border-white/10 rounded-xl p-3 flex items-center justify-between">
                      <div>
                        <div className="text-2xs text-slate-500 dark:text-slate-400 uppercase tracking-wider font-mono">
                          Academy UPI VPA
                        </div>
                        <div className="font-mono font-semibold text-slate-900 dark:text-white text-sm">
                          {config.bankDetails.upiId}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() =>
                          copyToClipboard(config.bankDetails!.upiId!, "UPI ID")
                        }
                        className="p-1.5 rounded-lg text-slate-500 hover:text-slate-800 dark:hover:text-white hover:bg-slate-200/60 dark:hover:bg-white/10 transition-colors"
                        title="Copy UPI ID"
                      >
                        {copiedField === "UPI ID" ? (
                          <Check size={14} className="text-emerald-500" />
                        ) : (
                          <Copy size={14} />
                        )}
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* 2. Bank Transfer Presentation */}
              {showBank && (
                <div className="space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {/* Account Name */}
                    <div className="bg-slate-50 dark:bg-white/[0.03] border border-slate-200 dark:border-white/10 rounded-xl p-3 flex items-center justify-between sm:col-span-2">
                      <div className="min-w-0 pr-2">
                        <div className="text-2xs text-slate-500 dark:text-slate-400 uppercase tracking-wider font-mono">
                          Beneficiary Name
                        </div>
                        <div className="font-medium text-slate-900 dark:text-white truncate text-sm">
                          {config?.bankDetails?.accountName || config?.academyName || "—"}
                        </div>
                      </div>
                      {config?.bankDetails?.accountName && (
                        <button
                          type="button"
                          onClick={() =>
                            copyToClipboard(
                              config.bankDetails!.accountName!,
                              "Beneficiary Name"
                            )
                          }
                          className="p-1.5 rounded-lg text-slate-500 hover:text-slate-800 dark:hover:text-white hover:bg-slate-200/60 dark:hover:bg-white/10 transition-colors"
                        >
                          {copiedField === "Beneficiary Name" ? (
                            <Check size={14} className="text-emerald-500" />
                          ) : (
                            <Copy size={14} />
                          )}
                        </button>
                      )}
                    </div>

                    {/* Bank & Account Number */}
                    <div className="bg-slate-50 dark:bg-white/[0.03] border border-slate-200 dark:border-white/10 rounded-xl p-3 flex items-center justify-between">
                      <div className="min-w-0 pr-2">
                        <div className="text-2xs text-slate-500 dark:text-slate-400 uppercase tracking-wider font-mono">
                          Account Number
                        </div>
                        <div className="font-mono font-semibold text-slate-900 dark:text-white text-sm truncate">
                          {config?.bankDetails?.accountNumber || "—"}
                        </div>
                      </div>
                      {config?.bankDetails?.accountNumber && (
                        <button
                          type="button"
                          onClick={() =>
                            copyToClipboard(
                              config.bankDetails!.accountNumber!,
                              "Account Number"
                            )
                          }
                          className="p-1.5 rounded-lg text-slate-500 hover:text-slate-800 dark:hover:text-white hover:bg-slate-200/60 dark:hover:bg-white/10 transition-colors"
                        >
                          {copiedField === "Account Number" ? (
                            <Check size={14} className="text-emerald-500" />
                          ) : (
                            <Copy size={14} />
                          )}
                        </button>
                      )}
                    </div>

                    {/* IFSC Code */}
                    <div className="bg-slate-50 dark:bg-white/[0.03] border border-slate-200 dark:border-white/10 rounded-xl p-3 flex items-center justify-between">
                      <div className="min-w-0 pr-2">
                        <div className="text-2xs text-slate-500 dark:text-slate-400 uppercase tracking-wider font-mono">
                          IFSC Code
                        </div>
                        <div className="font-mono font-semibold text-slate-900 dark:text-white text-sm truncate">
                          {config?.bankDetails?.ifscCode || "—"}
                        </div>
                      </div>
                      {config?.bankDetails?.ifscCode && (
                        <button
                          type="button"
                          onClick={() =>
                            copyToClipboard(config.bankDetails!.ifscCode!, "IFSC Code")
                          }
                          className="p-1.5 rounded-lg text-slate-500 hover:text-slate-800 dark:hover:text-white hover:bg-slate-200/60 dark:hover:bg-white/10 transition-colors"
                        >
                          {copiedField === "IFSC Code" ? (
                            <Check size={14} className="text-emerald-500" />
                          ) : (
                            <Copy size={14} />
                          )}
                        </button>
                      )}
                    </div>

                    {/* Bank Name / Branch */}
                    {config?.bankDetails?.bankName && (
                      <div className="bg-slate-50 dark:bg-white/[0.03] border border-slate-200 dark:border-white/10 rounded-xl p-3 flex items-center justify-between sm:col-span-2">
                        <div className="min-w-0 pr-2">
                          <div className="text-2xs text-slate-500 dark:text-slate-400 uppercase tracking-wider font-mono">
                            Bank &amp; Branch
                          </div>
                          <div className="font-medium text-slate-800 dark:text-slate-200 truncate text-sm">
                            {config.bankDetails.bankName}
                            {config.bankDetails.branchName ? ` · ${config.bankDetails.branchName}` : ""}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* 3. CONFIRM YOUR PAYMENT PROOF FORM */}
              <form
                onSubmit={handleSubmit}
                className="border-t border-slate-200 dark:border-white/10 pt-5 space-y-4"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <ShieldCheck size={18} className="text-volt-500" />
                    <h4 className="font-orbital text-sm font-semibold uppercase tracking-wider text-slate-900 dark:text-white">
                      Confirm Your Payment Proof
                    </h4>
                  </div>
                  <span className="text-2xs font-mono text-slate-400">Step 2 of 2</span>
                </div>

                {/* Workflow Explanatory Notice */}
                <div className="bg-sky-500/10 border border-sky-500/20 rounded-xl p-3 text-sky-800 dark:text-sky-300 text-xs flex items-start gap-2.5">
                  <Info size={16} className="shrink-0 mt-0.5 text-sky-500" />
                  <p className="leading-relaxed">
                    <strong>Verification Process:</strong> Once submitted, your payment details will be placed under review by the academy office. After verification, an official receipt will be generated and added to your portal.
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Payment Method */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                      Payment Mode <span className="text-rose-500">*</span>
                    </label>
                    <Select
                      value={paymentMethod}
                      onChange={(e) => setPaymentMethod(e.target.value)}
                    >
                      <option value="upi">UPI (GPay / PhonePe / Paytm / BHIM)</option>
                      <option value="bank_transfer">Bank Transfer (IMPS / NEFT / RTGS)</option>
                      <option value="card">Debit / Credit Card</option>
                      <option value="cash">Cash Paid at Academy Counter</option>
                      <option value="cheque">Cheque</option>
                    </Select>
                  </div>

                  {/* Amount Paid */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                      Amount Paid ({currencySymbol}) <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="number"
                      step="any"
                      min="1"
                      max={amount}
                      value={payAmount}
                      onChange={(e) => setPayAmount(Number(e.target.value))}
                      className="w-full rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-300 dark:border-white/10 px-3.5 py-2.5 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 outline-none focus:border-volt-500 focus:ring-1 focus:ring-volt-500 transition-all font-mono font-medium"
                      required
                    />
                  </div>

                  {/* Transaction ID / UTR */}
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                      Transaction ID / UTR / Reference Number{" "}
                      {(paymentMethod === "upi" || paymentMethod === "bank_transfer") && (
                        <span className="text-rose-500">*</span>
                      )}
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. 12-digit UPI UTR or Bank Reference No."
                      value={transactionId}
                      onChange={(e) => setTransactionId(e.target.value)}
                      className="w-full rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-300 dark:border-white/10 px-3.5 py-2.5 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 outline-none focus:border-volt-500 focus:ring-1 focus:ring-volt-500 transition-all font-mono font-medium"
                      required={paymentMethod === "upi" || paymentMethod === "bank_transfer"}
                    />
                    <p className="text-2xs text-slate-500 dark:text-slate-400 mt-1">
                      Enables the academy finance desk to reconcile and approve your payment.
                    </p>
                  </div>

                  {/* Optional Remarks */}
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                      Additional Remarks / Notes (Optional)
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Paid via HDFC account / Cheque number / Deposited by guardian"
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      className="w-full rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-300 dark:border-white/10 px-3.5 py-2.5 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 outline-none focus:border-volt-500 focus:ring-1 focus:ring-volt-500 transition-all text-xs"
                    />
                  </div>
                </div>

                <div className="pt-3 border-t border-slate-200 dark:border-white/10 flex items-center justify-end gap-3">
                  <button
                    type="button"
                    onClick={onClose}
                    disabled={isSubmitting}
                    className="btn-secondary text-xs py-2.5 px-4"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="btn-primary text-xs py-2.5 px-5 flex items-center gap-2"
                  >
                    {isSubmitting ? (
                      "Submitting Proof..."
                    ) : (
                      <>
                        <span>Submit Proof for Verification</span>
                        <ArrowRight size={14} />
                      </>
                    )}
                  </button>
                </div>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

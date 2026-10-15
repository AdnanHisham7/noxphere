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
    if (!payAmount || payAmount <= 0) {
      toast.error("Please enter a valid payment amount");
      return;
    }

    try {
      await payChildFee({
        feeId,
        installmentNumber,
        amount: Number(payAmount),
        paymentMethod,
        transactionId: transactionId.trim() || undefined,
        notes: notes.trim() || undefined,
      }).unwrap();

      toast.success("Payment recorded successfully!");
      onSuccess?.();
      onClose();
    } catch (err: any) {
      toast.error(err?.data?.message || "Failed to submit payment. Please try again.");
    }
  };

  const currencySymbol = currency === "INR" ? "₹" : currency;
  const isBoth = config?.paymentMethod === "both";
  const showQr = activeTab === "qr" || config?.paymentMethod === "qr";
  const showBank =
    activeTab === "bank_transfer" || config?.paymentMethod === "bank_transfer";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fade-in">
      <div className="nox-card w-full max-w-xl max-h-[90vh] overflow-y-auto border-core-400/30 bg-[#0d121c] p-0 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/[0.08] px-6 py-4 sticky top-0 bg-[#0d121c] z-10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-core-400/10 border border-core-400/20 flex items-center justify-center text-core-400">
              <Wallet size={20} />
            </div>
            <div>
              <h3 className="font-orbital text-base font-semibold text-nox-high">
                Pay Academy Fee
              </h3>
              <p className="text-xs text-nox-mid">
                Installment #{installmentNumber} · {config?.academyName || "Academy"}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-nox-low hover:text-nox-high transition-colors p-1 rounded-lg hover:bg-white/[0.06]"
          >
            <X size={20} />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Fee Summary Card */}
          <div className="bg-white/[0.02] border border-white/[0.06] rounded-xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-core-400 uppercase tracking-wider">
                  {feeType?.replace("_", " ") || "Tuition Fee"}
                </span>
                {studentName && (
                  <span className="text-xs text-nox-mid flex items-center gap-1">
                    <User size={12} /> {studentName}
                  </span>
                )}
              </div>
              {dueDate && (
                <div className="flex items-center gap-1.5 text-xs text-nox-low font-mono mt-1">
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
              <div className="text-2xs text-nox-low uppercase tracking-wider font-mono">
                Amount to Pay
              </div>
              <div className="font-orbital text-xl font-bold text-nox-high">
                {currencySymbol}
                {amount.toLocaleString("en-IN")}
              </div>
            </div>
          </div>

          {configLoading ? (
            <NoxSkeleton className="h-44 rounded-xl" />
          ) : (
            <>
              {/* Payment Method Switcher if academy supports both */}
              {isBoth && (
                <div className="flex rounded-xl bg-white/[0.04] p-1 border border-white/[0.08]">
                  <button
                    type="button"
                    onClick={() => {
                      setActiveTab("qr");
                      setPaymentMethod("upi");
                    }}
                    className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-xs font-medium transition-all ${
                      activeTab === "qr"
                        ? "bg-core-400 text-black font-semibold shadow-sm"
                        : "text-nox-mid hover:text-nox-high"
                    }`}
                  >
                    <QrCode size={15} />
                    <span>Scan UPI QR Code</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setActiveTab("bank_transfer");
                      setPaymentMethod("bank_transfer");
                    }}
                    className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-xs font-medium transition-all ${
                      activeTab === "bank_transfer"
                        ? "bg-core-400 text-black font-semibold shadow-sm"
                        : "text-nox-mid hover:text-nox-high"
                    }`}
                  >
                    <Building2 size={15} />
                    <span>Bank Account Details</span>
                  </button>
                </div>
              )}

              {/* QR Code Presentation */}
              {showQr && (
                <div className="bg-white/[0.02] border border-white/[0.08] rounded-2xl p-5 text-center space-y-4">
                  <div className="flex items-center justify-center gap-2 text-xs font-semibold text-core-400 uppercase tracking-wider">
                    <QrCode size={16} /> Scan &amp; Pay via UPI
                  </div>
                  <div className="flex justify-center">
                    {config?.feeQrImageUrl ? (
                      <div className="p-3 bg-white rounded-xl shadow-lg border border-white/20 inline-block">
                        <img
                          src={config.feeQrImageUrl}
                          alt="Academy UPI QR"
                          className="w-48 h-48 object-contain rounded-lg"
                        />
                      </div>
                    ) : (
                      <div className="w-48 h-48 rounded-xl bg-white/[0.04] border border-dashed border-white/20 flex flex-col items-center justify-center text-center p-4">
                        <QrCode size={36} className="text-nox-low mb-2" />
                        <span className="text-xs text-nox-low font-mono">
                          Academy hasn't uploaded a QR image yet
                        </span>
                      </div>
                    )}
                  </div>

                  {config?.bankDetails?.upiId && (
                    <div className="pt-2">
                      <div className="text-2xs text-nox-low uppercase tracking-wider font-mono mb-1">
                        Academy UPI ID
                      </div>
                      <div className="inline-flex items-center gap-2 bg-white/[0.05] border border-white/[0.1] rounded-lg px-3 py-1.5 text-xs font-mono text-nox-high">
                        <span>{config.bankDetails.upiId}</span>
                        <button
                          type="button"
                          onClick={() =>
                            copyToClipboard(config.bankDetails!.upiId!, "UPI ID")
                          }
                          className="text-core-400 hover:text-core-300 p-0.5"
                          title="Copy UPI ID"
                        >
                          {copiedField === "UPI ID" ? (
                            <Check size={14} className="text-field-400" />
                          ) : (
                            <Copy size={14} />
                          )}
                        </button>
                      </div>
                    </div>
                  )}

                  <p className="text-xs text-nox-mid max-w-sm mx-auto leading-relaxed">
                    Open Google Pay, PhonePe, Paytm, or any UPI app on your mobile,
                    scan the QR code above, and complete the fee payment.
                  </p>
                </div>
              )}

              {/* Bank Account Details Presentation */}
              {showBank && (
                <div className="bg-gradient-to-br from-core-400/[0.04] to-transparent border border-core-400/20 rounded-2xl p-5 space-y-4">
                  <div className="flex items-center justify-between border-b border-white/[0.08] pb-3">
                    <div className="flex items-center gap-2">
                      <Building2 size={18} className="text-core-400" />
                      <h4 className="font-orbital text-sm font-semibold text-nox-high">
                        Academy Bank Account
                      </h4>
                    </div>
                    <span className="text-2xs font-mono px-2 py-0.5 rounded bg-core-400/10 text-core-400 font-semibold uppercase">
                      IMPS / NEFT / RTGS
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                    {/* Beneficiary Name */}
                    <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-3 flex items-center justify-between">
                      <div className="min-w-0 pr-2">
                        <div className="text-[10px] text-nox-low uppercase tracking-wider font-mono">
                          Beneficiary Name
                        </div>
                        <div className="font-medium text-nox-high truncate">
                          {config?.bankDetails?.accountName || config?.academyName || "—"}
                        </div>
                      </div>
                      {config?.bankDetails?.accountName && (
                        <button
                          type="button"
                          onClick={() =>
                            copyToClipboard(
                              config.bankDetails!.accountName!,
                              "Beneficiary Name",
                            )
                          }
                          className="text-nox-low hover:text-core-400 p-1 rounded"
                          title="Copy Name"
                        >
                          {copiedField === "Beneficiary Name" ? (
                            <Check size={14} className="text-field-400" />
                          ) : (
                            <Copy size={14} />
                          )}
                        </button>
                      )}
                    </div>

                    {/* Bank Name */}
                    <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-3 flex items-center justify-between">
                      <div className="min-w-0 pr-2">
                        <div className="text-[10px] text-nox-low uppercase tracking-wider font-mono">
                          Bank Name
                        </div>
                        <div className="font-medium text-nox-high truncate">
                          {config?.bankDetails?.bankName || "—"}
                        </div>
                      </div>
                      {config?.bankDetails?.bankName && (
                        <button
                          type="button"
                          onClick={() =>
                            copyToClipboard(config.bankDetails!.bankName!, "Bank Name")
                          }
                          className="text-nox-low hover:text-core-400 p-1 rounded"
                          title="Copy Bank"
                        >
                          {copiedField === "Bank Name" ? (
                            <Check size={14} className="text-field-400" />
                          ) : (
                            <Copy size={14} />
                          )}
                        </button>
                      )}
                    </div>

                    {/* Account Number */}
                    <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-3 flex items-center justify-between">
                      <div className="min-w-0 pr-2">
                        <div className="text-[10px] text-nox-low uppercase tracking-wider font-mono">
                          Account Number
                        </div>
                        <div className="font-mono font-semibold text-nox-high text-sm tracking-wide truncate">
                          {config?.bankDetails?.accountNumber || "—"}
                        </div>
                      </div>
                      {config?.bankDetails?.accountNumber && (
                        <button
                          type="button"
                          onClick={() =>
                            copyToClipboard(
                              config.bankDetails!.accountNumber!,
                              "Account Number",
                            )
                          }
                          className="text-nox-low hover:text-core-400 p-1 rounded"
                          title="Copy Account Number"
                        >
                          {copiedField === "Account Number" ? (
                            <Check size={14} className="text-field-400" />
                          ) : (
                            <Copy size={14} />
                          )}
                        </button>
                      )}
                    </div>

                    {/* IFSC Code */}
                    <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-3 flex items-center justify-between">
                      <div className="min-w-0 pr-2">
                        <div className="text-[10px] text-nox-low uppercase tracking-wider font-mono">
                          IFSC Code
                        </div>
                        <div className="font-mono font-semibold text-nox-high text-sm tracking-wide truncate">
                          {config?.bankDetails?.ifscCode || "—"}
                        </div>
                      </div>
                      {config?.bankDetails?.ifscCode && (
                        <button
                          type="button"
                          onClick={() =>
                            copyToClipboard(config.bankDetails!.ifscCode!, "IFSC Code")
                          }
                          className="text-nox-low hover:text-core-400 p-1 rounded"
                          title="Copy IFSC"
                        >
                          {copiedField === "IFSC Code" ? (
                            <Check size={14} className="text-field-400" />
                          ) : (
                            <Copy size={14} />
                          )}
                        </button>
                      )}
                    </div>

                    {/* Branch Name */}
                    {config?.bankDetails?.branchName && (
                      <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-3 flex items-center justify-between sm:col-span-2">
                        <div className="min-w-0 pr-2">
                          <div className="text-[10px] text-nox-low uppercase tracking-wider font-mono">
                            Branch
                          </div>
                          <div className="font-medium text-nox-high truncate">
                            {config.bankDetails.branchName}
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() =>
                            copyToClipboard(
                              config.bankDetails!.branchName!,
                              "Branch Name",
                            )
                          }
                          className="text-nox-low hover:text-core-400 p-1 rounded"
                          title="Copy Branch"
                        >
                          {copiedField === "Branch Name" ? (
                            <Check size={14} className="text-field-400" />
                          ) : (
                            <Copy size={14} />
                          )}
                        </button>
                      </div>
                    )}
                  </div>

                  <p className="text-xs text-nox-mid leading-relaxed pt-1">
                    Please transfer the fee amount directly using Net Banking, NEFT,
                    or IMPS. After transferring, paste your Transaction / UTR number
                    below to confirm.
                  </p>
                </div>
              )}

              {/* Confirmation Form */}
              <form
                onSubmit={handleSubmit}
                className="border-t border-white/[0.08] pt-5 space-y-4"
              >
                <div className="flex items-center gap-2">
                  <ShieldCheck size={16} className="text-core-400" />
                  <h4 className="font-orbital text-xs font-semibold uppercase tracking-wider text-nox-high">
                    Confirm Your Payment
                  </h4>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Payment Method */}
                  <div>
                    <Select
                      label="Payment Mode"
                      value={paymentMethod}
                      onChange={(e) => setPaymentMethod(e.target.value)}
                    >
                      <option value="upi">UPI (GPay / PhonePe / Paytm)</option>
                      <option value="bank_transfer">
                        Bank Transfer (IMPS / NEFT)
                      </option>
                      <option value="card">Debit / Credit Card</option>
                      <option value="cash">Cash paid at Academy</option>
                    </Select>
                  </div>

                  {/* Amount Paid */}
                  <div>
                    <label className="block text-xs font-medium text-nox-mid mb-1">
                      Amount Paid ({currencySymbol})
                    </label>
                    <input
                      type="number"
                      step="any"
                      min="1"
                      value={payAmount}
                      onChange={(e) => setPayAmount(Number(e.target.value))}
                      className="nox-input w-full text-xs font-mono font-semibold"
                      required
                    />
                  </div>

                  {/* Transaction ID / UTR */}
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-medium text-nox-mid mb-1">
                      Transaction ID / UTR / Reference Number
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. UTR123456789 or UPI Ref / Cheque No."
                      value={transactionId}
                      onChange={(e) => setTransactionId(e.target.value)}
                      className="nox-input w-full text-xs font-mono"
                    />
                    <p className="text-[11px] text-nox-low mt-1">
                      Helps the academy instantly identify and reconcile your payment.
                    </p>
                  </div>

                  {/* Optional Notes */}
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-medium text-nox-mid mb-1">
                      Additional Remarks / Note (Optional)
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Paid from HDFC account ending in 1234"
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      className="nox-input w-full text-xs"
                    />
                  </div>
                </div>

                <div className="pt-2 flex items-center justify-end gap-3">
                  <button
                    type="button"
                    onClick={onClose}
                    disabled={isSubmitting}
                    className="nox-btn-secondary text-xs"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="nox-btn-primary text-xs flex items-center gap-2"
                  >
                    {isSubmitting ? (
                      "Recording Payment..."
                    ) : (
                      <>
                        <span>Submit Payment Proof</span>
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

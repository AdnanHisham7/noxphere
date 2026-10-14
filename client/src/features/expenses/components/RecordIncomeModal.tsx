// src/features/expenses/components/RecordIncomeModal.tsx
import React, { useState } from "react";
import { Modal, Button, Input } from "../../../components/ui";
import { useCreateIncomeMutation } from "../../../store/api/expenseApi";
import toast from "react-hot-toast";
import { ArrowDownLeft } from "lucide-react";

interface RecordIncomeModalProps {
  isOpen: boolean;
  onClose: () => void;
  academyId: string;
  franchiseId?: string;
}

const INCOME_CATEGORIES = [
  "Sponsorship & Brand Partner",
  "Tournament Registration Fees",
  "Merchandise & Kit Direct Sales",
  "Ground & Pitch Rental",
  "Friendly Match Admission / Tickets",
  "Coaching Clinic / Workshop",
  "Grant / Subsidy",
  "Donation & Contribution",
  "Other Income",
];

export const RecordIncomeModal: React.FC<RecordIncomeModalProps> = ({
  isOpen,
  onClose,
  academyId,
  franchiseId,
}) => {
  const [createIncome, { isLoading }] = useCreateIncomeMutation();

  const [source, setSource] = useState<string>("");
  const [category, setCategory] = useState<string>("Sponsorship & Brand Partner");
  const [amount, setAmount] = useState<number>(0);
  const [date, setDate] = useState<string>(new Date().toISOString().split("T")[0]);
  const [paymentMethod, setPaymentMethod] = useState<string>("bank_transfer");
  const [payerName, setPayerName] = useState<string>("");
  const [referenceNumber, setReferenceNumber] = useState<string>("");
  const [notes, setNotes] = useState<string>("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!source.trim()) {
      toast.error("Please enter income source or title");
      return;
    }
    if (!amount || amount <= 0) {
      toast.error("Please enter a valid amount greater than 0");
      return;
    }

    try {
      await createIncome({
        academyId,
        franchiseId: franchiseId && franchiseId !== "all" ? franchiseId : undefined,
        source: source.trim(),
        category,
        amount: Number(amount),
        date,
        paymentMethod,
        payerName: payerName.trim() || undefined,
        referenceNumber: referenceNumber.trim() || undefined,
        notes: notes.trim() || undefined,
      }).unwrap();

      toast.success("Additional incoming funds recorded successfully!");
      setSource("");
      setAmount(0);
      setPayerName("");
      setReferenceNumber("");
      setNotes("");
      onClose();
    } catch (err: any) {
      toast.error(err?.data?.message || "Failed to record incoming funds");
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Record Additional Incoming Funds" size="md">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="bg-field-400/10 border border-field-400/20 rounded-lg p-3 text-xs text-slate-700 dark:text-slate-300 flex items-start gap-2.5">
          <ArrowDownLeft className="w-5 h-5 text-field-500 shrink-0 mt-0.5" />
          <div>
            <span className="font-semibold text-slate-900 dark:text-white">External Inflow: </span>
            Student fees collected are tracked automatically from student accounts. Use this form to record additional revenues such as sponsors, merchandise sales, or pitch rentals.
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
            Income Source / Title *
          </label>
          <Input
            value={source}
            onChange={(e) => setSource(e.target.value)}
            placeholder="e.g. Annual Kit Sponsorship - TechCorp"
            required
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Category *
            </label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="input w-full text-sm"
              required
            >
              {INCOME_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Amount Received (₹) *
            </label>
            <Input
              type="number"
              min="1"
              step="any"
              value={amount || ""}
              onChange={(e) => setAmount(Number(e.target.value))}
              placeholder="0.00"
              required
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Payer / Organization Name
            </label>
            <Input
              value={payerName}
              onChange={(e) => setPayerName(e.target.value)}
              placeholder="e.g. Adidas India / ABC Corp"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Transaction / Ref No.
            </label>
            <Input
              value={referenceNumber}
              onChange={(e) => setReferenceNumber(e.target.value)}
              placeholder="TXN-9023412"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Received Date *
            </label>
            <Input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              required
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Payment Method
            </label>
            <select
              value={paymentMethod}
              onChange={(e) => setPaymentMethod(e.target.value)}
              className="input w-full text-sm"
            >
              <option value="bank_transfer">Bank Transfer (NEFT/RTGS/IMPS)</option>
              <option value="upi">UPI / QR</option>
              <option value="cheque">Cheque</option>
              <option value="cash">Cash</option>
              <option value="card">Card</option>
              <option value="other">Other</option>
            </select>
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
            Notes & Terms
          </label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            className="input w-full text-sm resize-none"
            placeholder="Contract reference or installment terms..."
          />
        </div>

        <div className="flex justify-end gap-2 pt-2 border-t border-slate-200 dark:border-white/5">
          <Button variant="ghost" type="button" onClick={onClose} disabled={isLoading}>
            Cancel
          </Button>
          <Button variant="primary" type="submit" loading={isLoading}>
            Save Inflow
          </Button>
        </div>
      </form>
    </Modal>
  );
};

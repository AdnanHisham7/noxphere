import React, { useState } from "react";
import { Modal, Button, Input, Select } from "../../../components/ui";
import { useCreateExpenseMutation } from "../../../store/api/expenseApi";
import { useCurrency } from "../../../hooks/useCurrency";
import toast from "react-hot-toast";
import { Receipt, Info } from "lucide-react";

interface AddMiscExpenseModalProps {
  isOpen: boolean;
  onClose: () => void;
  academyId: string;
  franchiseId?: string;
}

const MISC_CATEGORIES = [
  "Utilities (Electricity & Water)",
  "Ground & Pitch Maintenance",
  "Travel & Transportation",
  "Refreshments & Catering",
  "Tournament & Match Fees",
  "Marketing & Promotion",
  "Equipment Repairs & Service",
  "Staff Refreshments",
  "First Aid & Emergency Supplies",
  "Administrative & Legal",
  "Software & Subscriptions",
  "Petty Cash & Miscellaneous",
];

const PAYMENT_METHODS = [
  { value: "bank_transfer", label: "Bank Transfer" },
  { value: "upi", label: "UPI" },
  { value: "cash", label: "Cash" },
  { value: "card", label: "Credit/Debit Card" },
  { value: "cheque", label: "Cheque" },
  { value: "other", label: "Other" },
];

export const AddMiscExpenseModal: React.FC<AddMiscExpenseModalProps> = ({
  isOpen,
  onClose,
  academyId,
  franchiseId,
}) => {
  const { currencySymbol } = useCurrency();
  const [createExpense, { isLoading }] = useCreateExpenseMutation();

  const [title, setTitle] = useState<string>("");
  const [category, setCategory] = useState<string>("Utilities (Electricity & Water)");
  const [amount, setAmount] = useState<number>(0);
  const [vendor, setVendor] = useState<string>("");
  const [invoiceNumber, setInvoiceNumber] = useState<string>("");
  const [date, setDate] = useState<string>(new Date().toISOString().split("T")[0]);
  const [paymentMethod, setPaymentMethod] = useState<string>("bank_transfer");
  const [notes, setNotes] = useState<string>("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      toast.error("Please enter expense title or description");
      return;
    }
    if (!amount || amount <= 0) {
      toast.error("Amount must be greater than 0");
      return;
    }

    try {
      await createExpense({
        academyId,
        franchiseId: franchiseId && franchiseId !== "all" ? franchiseId : undefined,
        type: "miscellaneous",
        title: title.trim(),
        category,
        amount: Number(amount),
        vendor: vendor.trim() || undefined,
        invoiceNumber: invoiceNumber.trim() || undefined,
        date,
        paymentMethod,
        notes: notes.trim() || undefined,
      }).unwrap();

      toast.success("Miscellaneous expense recorded successfully!");
      setTitle("");
      setAmount(0);
      setVendor("");
      setInvoiceNumber("");
      setNotes("");
      onClose();
    } catch (err: any) {
      toast.error(err?.data?.message || "Failed to record expense");
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Add Miscellaneous Expense" size="md">
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Distinction Banner */}
        <div className="bg-amber-400/10 dark:bg-amber-400/10 border border-amber-400/20 rounded-lg p-3 text-xs text-slate-700 dark:text-slate-300 flex items-start gap-2.5">
          <Info className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
          <div>
            <span className="font-semibold text-slate-900 dark:text-white">Pure Operational Expense: </span>
            This expense does NOT create or affect physical stocks (e.g. utility bills, pitch repair, travel, snacks). It is recorded purely in the financial ledger for cashflow tracking.
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
            Expense Title / Description *
          </label>
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Monthly Pitch Floodlights Electricity Bill"
            required
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <Select
              label="Category *"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              required
            >
              {MISC_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </Select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Amount ({currencySymbol}) *
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
              Paid To / Vendor / Payee
            </label>
            <Input
              value={vendor}
              onChange={(e) => setVendor(e.target.value)}
              placeholder="e.g. State Electricity Board / City Transport"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Bill / Reference No.
            </label>
            <Input
              value={invoiceNumber}
              onChange={(e) => setInvoiceNumber(e.target.value)}
              placeholder="REF-89240"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Expense Date *
            </label>
            <Input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              required
            />
          </div>

          <div>
            <Select
              label="Payment Mode"
              value={paymentMethod}
              onChange={(e) => setPaymentMethod(e.target.value)}
            >
              {PAYMENT_METHODS.map((m) => (
                <option key={m.value} value={m.value}>
                  {m.label}
                </option>
              ))}
            </Select>
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
            Notes / Remarks
          </label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            className="input w-full text-sm resize-none"
            placeholder="Additional context or approval details..."
          />
        </div>

        <div className="flex justify-end gap-2 pt-2 border-t border-slate-200 dark:border-white/5">
          <Button variant="ghost" type="button" onClick={onClose} disabled={isLoading}>
            Cancel
          </Button>
          <Button variant="primary" type="submit" loading={isLoading}>
            Save Expense
          </Button>
        </div>
      </form>
    </Modal>
  );
};

// src/features/expenses/components/AddPurchaseModal.tsx
import React, { useState, useEffect } from "react";
import { Modal, Button, Input, Select } from "../../../components/ui";
import { useCreateExpenseMutation, type StockItem } from "../../../store/api/expenseApi";
import toast from "react-hot-toast";
import { PackagePlus, CheckCircle2 } from "lucide-react";

interface AddPurchaseModalProps {
  isOpen: boolean;
  onClose: () => void;
  academyId: string;
  franchiseId?: string;
  preselectedStockItem?: StockItem | null;
  existingStocks?: StockItem[];
}

const PURCHASE_CATEGORIES = [
  "Equipment",
  "Apparel & Uniforms",
  "Footwear",
  "Training Gear",
  "Balls & Inflatables",
  "Medical & Physio",
  "Ground & Field Supplies",
  "Merchandise",
  "Electronics & Tech",
  "Other",
];

const PAYMENT_METHODS = [
  { value: "bank_transfer", label: "Bank Transfer" },
  { value: "upi", label: "UPI" },
  { value: "cash", label: "Cash" },
  { value: "card", label: "Credit/Debit Card" },
  { value: "cheque", label: "Cheque" },
  { value: "other", label: "Other" },
];

export const AddPurchaseModal: React.FC<AddPurchaseModalProps> = ({
  isOpen,
  onClose,
  academyId,
  franchiseId,
  preselectedStockItem,
  existingStocks = [],
}) => {
  const [createExpense, { isLoading }] = useCreateExpenseMutation();

  const [selectedStockId, setSelectedStockId] = useState<string>("");
  const [itemName, setItemName] = useState<string>("");
  const [category, setCategory] = useState<string>("Equipment");
  const [quantity, setQuantity] = useState<number>(10);
  const [unit, setUnit] = useState<string>("units");
  const [unitPrice, setUnitPrice] = useState<number>(0);
  const [invoiceNumber, setInvoiceNumber] = useState<string>("");
  const [date, setDate] = useState<string>(new Date().toISOString().split("T")[0]);
  const [paymentMethod, setPaymentMethod] = useState<string>("bank_transfer");
  const [notes, setNotes] = useState<string>("");
  const [verifyImmediately, setVerifyImmediately] = useState<boolean>(true);

  useEffect(() => {
    if (preselectedStockItem) {
      setSelectedStockId(preselectedStockItem.id || preselectedStockItem._id || "");
      setItemName(preselectedStockItem.name);
      setCategory(preselectedStockItem.category || "Equipment");
      setUnit(preselectedStockItem.unit || "units");
      setUnitPrice(preselectedStockItem.unitPrice || 0);
    } else {
      setSelectedStockId("");
      setItemName("");
      setCategory("Equipment");
      setUnit("units");
      setUnitPrice(0);
    }
  }, [preselectedStockItem, isOpen]);

  const handleStockSelect = (stockId: string) => {
    setSelectedStockId(stockId);
    if (!stockId) return;
    const found = existingStocks.find((s) => (s.id || s._id) === stockId);
    if (found) {
      setItemName(found.name);
      setCategory(found.category);
      setUnit(found.unit);
      setUnitPrice(found.unitPrice || 0);
    }
  };

  const calculatedTotal = (quantity || 0) * (unitPrice || 0);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!itemName.trim()) {
      toast.error("Please enter the purchased item name");
      return;
    }
    if (!quantity || quantity <= 0) {
      toast.error("Quantity must be greater than 0");
      return;
    }
    if (unitPrice === undefined || unitPrice < 0) {
      toast.error("Please provide a valid unit price");
      return;
    }

    try {
      await createExpense({
        academyId,
        franchiseId: franchiseId && franchiseId !== "all" ? franchiseId : undefined,
        type: "purchase",
        itemName: itemName.trim(),
        category,
        quantity: Number(quantity),
        unit: unit.trim() || "units",
        unitPrice: Number(unitPrice),
        amount: calculatedTotal,
        stockItemId: selectedStockId || undefined,
        invoiceNumber: invoiceNumber.trim() || undefined,
        date,
        paymentMethod,
        notes: notes.trim() || undefined,
        verifyImmediately,
      }).unwrap();

      toast.success(
        verifyImmediately
          ? "Purchase added & verified! Items added to stock inventory."
          : "Purchase recorded successfully (Pending Verification)."
      );
      onClose();
    } catch (err: any) {
      toast.error(err?.data?.message || "Failed to record purchase");
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Add Purchase (Stock Items In)" size="lg">
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Info Banner */}
        <div className="bg-volt-400/10 dark:bg-volt-400/10 border border-volt-400/20 rounded-lg p-3 text-xs text-slate-700 dark:text-slate-300 flex items-start gap-2.5">
          <PackagePlus className="w-5 h-5 text-volt-500 shrink-0 mt-0.5" />
          <div>
            <span className="font-semibold text-slate-900 dark:text-white">Inventory Stock Link: </span>
            Purchased items can be linked to an existing stock item or will automatically create a new stock item. When verified, stock count increments immediately.
          </div>
        </div>

        {/* Quick select existing stock */}
        {existingStocks.length > 0 && !preselectedStockItem && (
          <div>
            <Select
              label="Restock Existing Inventory Item (Optional)"
              value={selectedStockId}
              onChange={(e) => handleStockSelect(e.target.value)}
            >
              <option value="">-- Or enter a new item below --</option>
              {existingStocks.map((s) => (
                <option key={s.id || s._id} value={s.id || s._id}>
                  {s.name} (Current Stock: {s.quantity} {s.unit})
                </option>
              ))}
            </Select>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Item Name *
            </label>
            <Input
              value={itemName}
              onChange={(e) => setItemName(e.target.value)}
              placeholder="e.g. Match Footballs Size 5"
              required
            />
          </div>

          <div>
            <Select
              label="Category *"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              required
            >
              {PURCHASE_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </Select>
          </div>
        </div>

        {/* Quantity, Unit & Unit Price */}
        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Quantity *
            </label>
            <Input
              type="number"
              min="1"
              value={quantity}
              onChange={(e) => setQuantity(Number(e.target.value))}
              required
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Unit (e.g. pcs, sets)
            </label>
            <Input
              value={unit}
              onChange={(e) => setUnit(e.target.value)}
              placeholder="pcs, pairs, kits"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Cost Per Unit (₹) *
            </label>
            <Input
              type="number"
              min="0"
              step="any"
              value={unitPrice}
              onChange={(e) => setUnitPrice(Number(e.target.value))}
              required
            />
          </div>
        </div>

        {/* Calculated Total Display */}
        <div className="bg-slate-100 dark:bg-pitch-900 border border-slate-200 dark:border-white/10 rounded-lg p-3 flex items-center justify-between">
          <span className="text-xs font-medium text-slate-600 dark:text-slate-400">Total Purchase Expense:</span>
          <span className="text-lg font-bold font-display text-volt-500 tabular-nums">
            ₹{calculatedTotal.toLocaleString("en-IN")}
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Bill / Invoice No.
            </label>
            <Input
              value={invoiceNumber}
              onChange={(e) => setInvoiceNumber(e.target.value)}
              placeholder="INV-2026-042"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Purchase Date *
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
            Notes / Warranty / Specs
          </label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            className="input w-full text-sm resize-none"
            placeholder="e.g. Size 5 FIFA certified match balls, 1 year warranty"
          />
        </div>

        {/* Verification Checkbox */}
        <div className="flex items-center gap-2 p-2.5 rounded-lg border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-pitch-900/50">
          <input
            type="checkbox"
            id="verifyImmediately"
            checked={verifyImmediately}
            onChange={(e) => setVerifyImmediately(e.target.checked)}
            className="w-4 h-4 rounded text-volt-500 focus:ring-volt-400"
          />
          <label htmlFor="verifyImmediately" className="text-xs text-slate-700 dark:text-slate-300 font-medium cursor-pointer flex items-center gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5 text-field-500" />
            Verify and add to stocks immediately
          </label>
        </div>

        <div className="flex justify-end gap-2 pt-2 border-t border-slate-200 dark:border-white/5">
          <Button variant="ghost" type="button" onClick={onClose} disabled={isLoading}>
            Cancel
          </Button>
          <Button variant="primary" type="submit" loading={isLoading}>
            {verifyImmediately ? "Add & Restock Inventory" : "Record Purchase"}
          </Button>
        </div>
      </form>
    </Modal>
  );
};

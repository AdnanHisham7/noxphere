// src/features/expenses/components/AdjustStockModal.tsx
import React, { useState, useEffect } from "react";
import { Modal, Button, Input } from "../../../components/ui";
import { useAdjustStockMutation, type StockItem } from "../../../store/api/expenseApi";
import toast from "react-hot-toast";

interface AdjustStockModalProps {
  isOpen: boolean;
  onClose: () => void;
  stockItem: StockItem | null;
}

export const AdjustStockModal: React.FC<AdjustStockModalProps> = ({
  isOpen,
  onClose,
  stockItem,
}) => {
  const [adjustStock, { isLoading }] = useAdjustStockMutation();

  const [newQuantity, setNewQuantity] = useState<number>(0);
  const [reason, setReason] = useState<string>("");

  useEffect(() => {
    if (stockItem) {
      setNewQuantity(stockItem.quantity);
      setReason("");
    }
  }, [stockItem, isOpen]);

  if (!stockItem) return null;

  const diff = Number(newQuantity) - stockItem.quantity;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newQuantity < 0) {
      toast.error("Stock count cannot be negative");
      return;
    }
    if (!reason.trim()) {
      toast.error("Please provide a reason for the adjustment (e.g. Physical inventory count audit)");
      return;
    }

    try {
      await adjustStock({
        id: stockItem.id || stockItem._id!,
        newQuantity: Number(newQuantity),
        reason: reason.trim(),
      }).unwrap();

      toast.success("Stock count adjusted successfully!");
      onClose();
    } catch (err: any) {
      toast.error(err?.data?.message || "Failed to adjust stock count");
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`Adjust Stock Count: ${stockItem.name}`} size="md">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-3 p-3 bg-slate-100 dark:bg-pitch-900 border border-slate-200 dark:border-white/10 rounded-lg">
          <div>
            <span className="text-xs text-slate-500">Current System Count</span>
            <p className="text-base font-bold text-slate-900 dark:text-white">
              {stockItem.quantity} {stockItem.unit}
            </p>
          </div>
          <div>
            <span className="text-xs text-slate-500">Difference</span>
            <p className={`text-base font-bold ${diff >= 0 ? "text-field-500" : "text-ember-500"}`}>
              {diff > 0 ? `+${diff}` : diff} {stockItem.unit}
            </p>
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
            New Verified Physical Count *
          </label>
          <Input
            type="number"
            min="0"
            value={newQuantity}
            onChange={(e) => setNewQuantity(Number(e.target.value))}
            required
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
            Adjustment Reason / Audit Note *
          </label>
          <Input
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="e.g. End of month physical inventory verification"
            required
          />
        </div>

        <div className="flex justify-end gap-2 pt-2 border-t border-slate-200 dark:border-white/5">
          <Button variant="ghost" type="button" onClick={onClose} disabled={isLoading}>
            Cancel
          </Button>
          <Button variant="primary" type="submit" loading={isLoading}>
            Save Adjustment
          </Button>
        </div>
      </form>
    </Modal>
  );
};

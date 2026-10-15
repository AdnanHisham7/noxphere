// src/features/expenses/components/IssueStockModal.tsx
import React, { useState } from "react";
import { Modal, Button, Input, Select } from "../../../components/ui";
import { useIssueStockMutation, type StockItem } from "../../../store/api/expenseApi";
import toast from "react-hot-toast";

interface IssueStockModalProps {
  isOpen: boolean;
  onClose: () => void;
  stockItem: StockItem | null;
}

export const IssueStockModal: React.FC<IssueStockModalProps> = ({
  isOpen,
  onClose,
  stockItem,
}) => {
  const [issueStock, { isLoading }] = useIssueStockMutation();

  const [quantity, setQuantity] = useState<number>(1);
  const [reason, setReason] = useState<string>("");
  const [recipient, setRecipient] = useState<string>("");
  const [action, setAction] = useState<"issued_out" | "used_training" | "damaged">("issued_out");

  if (!stockItem) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!quantity || quantity <= 0) {
      toast.error("Please enter a valid quantity to issue");
      return;
    }
    if (quantity > stockItem.quantity) {
      toast.error(`Cannot issue ${quantity} ${stockItem.unit}. Available in stock: ${stockItem.quantity}`);
      return;
    }
    if (!reason.trim()) {
      toast.error("Please provide a reason for issuing/using this stock");
      return;
    }

    try {
      await issueStock({
        id: stockItem.id || stockItem._id!,
        quantity: Number(quantity),
        reason: reason.trim(),
        recipient: recipient.trim() || undefined,
        action,
      }).unwrap();

      toast.success(`Successfully issued ${quantity} ${stockItem.unit}!`);
      setQuantity(1);
      setReason("");
      setRecipient("");
      onClose();
    } catch (err: any) {
      toast.error(err?.data?.message || "Failed to issue stock");
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`Issue / Use Stock: ${stockItem.name}`} size="md">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="bg-slate-100 dark:bg-pitch-900 border border-slate-200 dark:border-white/10 rounded-lg p-3 flex items-center justify-between">
          <span className="text-xs text-slate-600 dark:text-slate-400">Current Available Quantity:</span>
          <span className="font-bold text-sm text-slate-900 dark:text-white">
            {stockItem.quantity} {stockItem.unit}
          </span>
        </div>

        <div>
          <Select
            label="Usage Type *"
            value={action}
            onChange={(e) => setAction(e.target.value as any)}
          >
            <option value="issued_out">Issued to Player / Coach / Team</option>
            <option value="used_training">Consumed in Training Session / Match</option>
            <option value="damaged">Damaged / Worn Out / Discarded</option>
          </Select>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Quantity to Deduct *
            </label>
            <Input
              type="number"
              min="1"
              max={stockItem.quantity}
              value={quantity}
              onChange={(e) => setQuantity(Number(e.target.value))}
              required
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Recipient / Handed To
            </label>
            <Input
              value={recipient}
              onChange={(e) => setRecipient(e.target.value)}
              placeholder="e.g. Coach Rahul, Team U-15"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
            Reason / Purpose *
          </label>
          <Input
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="e.g. Handed 2 match balls for weekend league tournament"
            required
          />
        </div>

        <div className="flex justify-end gap-2 pt-2 border-t border-slate-200 dark:border-white/5">
          <Button variant="ghost" type="button" onClick={onClose} disabled={isLoading}>
            Cancel
          </Button>
          <Button variant="primary" type="submit" loading={isLoading}>
            Confirm Stock Issue
          </Button>
        </div>
      </form>
    </Modal>
  );
};

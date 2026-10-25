// src/features/fees/components/EditFeeScheduleModal.tsx
import React, { useState } from "react";
import { Trash2, Plus, Calendar, AlertCircle, AlertTriangle } from "lucide-react";
import { toast } from "react-hot-toast";
import { Modal, Button, Input, Select } from "../../../components/ui";
import { formatCurrency } from "../../../utils/currency";
import type { AdminFeeRecord, UpdateFeeBody } from "../../../store/api/adminFeesApi";

export interface EditFeeScheduleModalProps {
  fee: AdminFeeRecord;
  currencySymbol: string;
  onClose: () => void;
  onUpdate: (id: string, body: UpdateFeeBody) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  isLoading: boolean;
}

export const EditFeeScheduleModal: React.FC<EditFeeScheduleModalProps> = ({
  fee,
  currencySymbol,
  onClose,
  onUpdate,
  onDelete,
  isLoading,
}) => {
  const [feeType, setFeeType] = useState<"one_time" | "installment" | "early_bird">(
    (fee.feeType as any) || "one_time",
  );
  const [discount, setDiscount] = useState<string>(String(fee.totalAmount - fee.finalAmount || 0));
  const [notes, setNotes] = useState<string>(fee.notes || "");
  const [isDeleting, setIsDeleting] = useState<boolean>(false);
  const [confirmDelete, setConfirmDelete] = useState<boolean>(false);

  // Initialize installments from fee
  const [installments, setInstallments] = useState(
    fee.installments.map((inst) => ({
      installmentNumber: inst.installmentNumber,
      amount: String(inst.amount),
      paidAmount: inst.paidAmount || 0,
      dueDate: inst.dueDate ? new Date(inst.dueDate).toISOString().split("T")[0] : "",
    })),
  );

  const totalPaid = fee.installments.reduce((sum, i) => sum + (i.paidAmount || 0), 0);
  const isFullyPaid = fee.overallStatus === "paid" || (totalPaid >= fee.finalAmount && totalPaid > 0);
  const canDelete = totalPaid === 0;

  const addInstallment = () => {
    const nextNum = installments.length > 0 ? Math.max(...installments.map((i) => i.installmentNumber)) + 1 : 1;
    setInstallments((prev) => [
      ...prev,
      {
        installmentNumber: nextNum,
        amount: "",
        paidAmount: 0,
        dueDate: "",
      },
    ]);
  };

  const removeInstallment = (idx: number) => {
    const inst = installments[idx];
    if (inst.paidAmount > 0) {
      toast.error(`Milestone #${inst.installmentNumber} has recorded payments of ${currencySymbol}${inst.paidAmount} and cannot be removed.`);
      return;
    }
    setInstallments((prev) => prev.filter((_, i) => i !== idx));
  };

  const updateInstallment = (
    idx: number,
    field: "amount" | "dueDate",
    value: string,
  ) => {
    setInstallments((prev) =>
      prev.map((inst, i) => (i === idx ? { ...inst, [field]: value } : inst)),
    );
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();

    if (isFullyPaid) {
      toast.error("This fee plan is already fully paid and cannot be edited.");
      return;
    }

    if (installments.length === 0) {
      toast.error("Please add at least one installment milestone.");
      return;
    }

    for (const inst of installments) {
      const amt = parseFloat(inst.amount);
      if (!amt || amt <= 0) {
        toast.error(`Please provide a valid amount for Milestone #${inst.installmentNumber}`);
        return;
      }
      if (amt < inst.paidAmount) {
        toast.error(`Milestone #${inst.installmentNumber} amount cannot be less than already collected amount (${currencySymbol}${inst.paidAmount})`);
        return;
      }
      if (!inst.dueDate) {
        toast.error(`Please set a due date for Milestone #${inst.installmentNumber}`);
        return;
      }
    }

    const totalAmt = installments.reduce((sum, i) => sum + parseFloat(i.amount || "0"), 0);
    const disc = parseFloat(discount) || 0;

    try {
      await onUpdate(fee._id, {
        feeType,
        totalAmount: totalAmt + disc,
        discount: disc,
        notes,
        installments: installments.map((i, idx) => ({
          installmentNumber: idx + 1,
          amount: parseFloat(i.amount),
          dueDate: i.dueDate,
        })),
      });
      toast.success("Fee schedule updated successfully");
      onClose();
    } catch (err: any) {
      toast.error(err?.data?.message || "Failed to update fee schedule");
    }
  };

  const handleDelete = async () => {
    if (!canDelete) {
      toast.error("Cannot delete a fee plan that already has recorded payments. Undo payments first.");
      return;
    }

    setIsDeleting(true);
    try {
      await onDelete(fee._id);
      toast.success("Scheduled fee deleted successfully");
      onClose();
    } catch (err: any) {
      toast.error(err?.data?.message || "Failed to delete fee schedule");
    } finally {
      setIsDeleting(false);
    }
  };

  const calculatedTotal = installments.reduce((sum, i) => sum + (parseFloat(i.amount) || 0), 0);

  return (
    <Modal
      isOpen
      onClose={onClose}
      title="Edit Scheduled Fee Plan"
      size="lg"
    >
      <form onSubmit={handleSave} className="space-y-4">
        {/* Top Info Banner */}
        <div className="p-3 rounded-lg bg-slate-50 dark:bg-pitch-800 border border-slate-200 dark:border-white/5 flex items-center justify-between text-xs">
          <div>
            <span className="text-slate-500">Player: </span>
            <span className="font-bold text-slate-900 dark:text-white">
              {fee.studentId?.firstName} {fee.studentId?.lastName}
            </span>
          </div>
          <div>
            <span className="text-slate-500">Recorded Payments: </span>
            <span className="font-mono font-bold text-emerald-400">
              {formatCurrency(totalPaid, fee.currency)}
            </span>
          </div>
        </div>

        {isFullyPaid && (
          <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-xs flex items-center gap-2">
            <AlertCircle size={16} className="shrink-0" />
            <span>This fee plan is already fully paid and settled. Amounts and milestones cannot be modified.</span>
          </div>
        )}

        {/* Plan Settings */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Select
            label="Plan Type"
            value={feeType}
            onChange={(e) => setFeeType(e.target.value as any)}
          >
            <option value="one_time">One Time</option>
            <option value="installment">Installment Milestone</option>
            <option value="early_bird">Early Bird</option>
          </Select>

          <Input
            label={`Discount / Promo (${currencySymbol})`}
            type="number"
            min="0"
            value={discount}
            onChange={(e) => setDiscount(e.target.value)}
            placeholder="0"
          />
        </div>

        {/* Installment Milestone Rows */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
              Installment Milestones &amp; Due Dates
            </span>
            <button
              type="button"
              onClick={addInstallment}
              className="text-xs font-semibold text-volt-500 hover:text-volt-400 flex items-center gap-1 transition-colors"
            >
              <Plus size={13} />
              <span>Add Milestone</span>
            </button>
          </div>

          <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
            {installments.map((inst, idx) => (
              <div
                key={idx}
                className="flex items-center gap-2 p-2.5 rounded-lg bg-slate-50 dark:bg-pitch-800 border border-slate-200 dark:border-white/5 text-xs"
              >
                <span className="font-mono font-bold text-slate-400 w-6 shrink-0">
                  #{idx + 1}
                </span>

                <div className="flex-1">
                  <input
                    type="number"
                    placeholder={`Amount (${currencySymbol})`}
                    value={inst.amount}
                    onChange={(e) => updateInstallment(idx, "amount", e.target.value)}
                    className="input text-xs !w-full font-mono font-semibold"
                    required
                  />
                  {inst.paidAmount > 0 && (
                    <span className="text-[10px] text-emerald-400 block mt-0.5 font-mono">
                      Paid: {currencySymbol}{inst.paidAmount}
                    </span>
                  )}
                </div>

                <div className="flex-1">
                  <input
                    type="date"
                    value={inst.dueDate}
                    onChange={(e) => updateInstallment(idx, "dueDate", e.target.value)}
                    className="input text-xs !w-full"
                    required
                  />
                </div>

                {installments.length > 1 && inst.paidAmount === 0 && (
                  <button
                    type="button"
                    onClick={() => removeInstallment(idx)}
                    className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 rounded transition-colors shrink-0"
                    title="Remove milestone"
                  >
                    <Trash2 size={14} />
                  </button>
                )}
              </div>
            ))}
          </div>

          <div className="flex items-center justify-between p-2 rounded bg-slate-100 dark:bg-pitch-800/80 text-xs">
            <span className="text-slate-500">Updated Total:</span>
            <span className="font-mono font-bold text-slate-900 dark:text-white">
              {currencySymbol}{calculatedTotal.toLocaleString()}
            </span>
          </div>
        </div>

        <Input
          label="Internal Notes"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="e.g. Adjusted discount for sibling or custom milestone"
        />

        {/* Delete Confirmation Box */}
        {confirmDelete ? (
          <div className="p-3 rounded-lg border border-rose-500/30 bg-rose-500/10 space-y-2">
            <div className="flex items-start gap-2">
              <AlertTriangle size={16} className="text-rose-400 shrink-0 mt-0.5" />
              <p className="text-xs text-rose-300">
                Are you sure you want to permanently delete this scheduled fee plan? Any scheduled alert reminders will also be cancelled.
              </p>
            </div>
            <div className="flex items-center gap-2 justify-end">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => setConfirmDelete(false)}
              >
                Cancel
              </Button>
              <Button
                type="button"
                variant="danger"
                size="sm"
                loading={isDeleting}
                onClick={handleDelete}
              >
                Yes, Delete Plan
              </Button>
            </div>
          </div>
        ) : null}

        {/* Action Buttons */}
        <div className="flex items-center justify-between pt-2">
          {!confirmDelete && (
            <button
              type="button"
              disabled={!canDelete}
              onClick={() => setConfirmDelete(true)}
              className="text-xs text-rose-400 hover:text-rose-300 flex items-center gap-1 font-semibold disabled:opacity-40 disabled:hover:text-rose-400"
              title={
                canDelete
                  ? "Delete this scheduled plan"
                  : "Cannot delete fee plan with recorded payments"
              }
            >
              <Trash2 size={13} />
              <span>Delete Schedule</span>
            </button>
          )}

          <div className="flex items-center gap-2 ml-auto">
            <Button type="button" variant="secondary" onClick={onClose}>
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isFullyPaid}
              loading={isLoading}
              className="bg-volt-400 hover:bg-volt-300 text-pitch-950 font-bold disabled:opacity-40"
            >
              Save Schedule
            </Button>
          </div>
        </div>
      </form>
    </Modal>
  );
};

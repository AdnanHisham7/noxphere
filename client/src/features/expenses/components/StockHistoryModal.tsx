// src/features/expenses/components/StockHistoryModal.tsx
import React from "react";
import { Modal, Button, Badge } from "../../../components/ui";
import { useGetStockByIdQuery } from "../../../store/api/expenseApi";
import { format } from "date-fns";
import { History, ArrowUpRight, ArrowDownLeft, AlertCircle } from "lucide-react";

interface StockHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  stockItemId: string | null;
}

export const StockHistoryModal: React.FC<StockHistoryModalProps> = ({
  isOpen,
  onClose,
  stockItemId,
}) => {
  const { data: stockItem, isLoading } = useGetStockByIdQuery(stockItemId || "", {
    skip: !stockItemId || !isOpen,
  });

  if (!stockItemId) return null;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Inventory Stock Activity & Audit Trail" size="lg">
      <div className="space-y-4">
        {isLoading ? (
          <div className="py-8 text-center text-sm text-slate-500">Loading audit history...</div>
        ) : !stockItem ? (
          <div className="py-8 text-center text-sm text-slate-500">Stock item not found</div>
        ) : (
          <>
            {/* Header Summary */}
            <div className="flex flex-wrap items-center justify-between gap-3 p-3 bg-slate-100 dark:bg-pitch-900 border border-slate-200 dark:border-white/10 rounded-lg">
              <div>
                <h3 className="font-bold text-sm text-slate-900 dark:text-white">{stockItem.name}</h3>
                <p className="text-xs text-slate-500">Category: {stockItem.category} | Unit: {stockItem.unit}</p>
              </div>
              <div className="text-right">
                <span className="text-xs text-slate-500">Current Stock</span>
                <p className="font-extrabold text-base text-volt-500 tabular-nums">
                  {stockItem.quantity} {stockItem.unit}
                </p>
              </div>
            </div>

            {/* Logs List */}
            <div className="space-y-2">
              <h4 className="text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider">
                Transaction History ({stockItem.stockLogs?.length || 0} events)
              </h4>

              {(!stockItem.stockLogs || stockItem.stockLogs.length === 0) ? (
                <div className="p-6 text-center text-xs text-slate-500 border border-dashed border-slate-200 dark:border-white/10 rounded-lg">
                  No activity logs recorded yet for this item.
                </div>
              ) : (
                <div className="divide-y divide-slate-100 dark:divide-white/5 max-h-96 overflow-y-auto">
                  {[...stockItem.stockLogs]
                    .reverse()
                    .map((log, index) => {
                      const isPositive = log.quantityChange > 0;
                      return (
                        <div key={log._id || index} className="py-3 flex items-start gap-3">
                          <div
                            className={`p-2 rounded-lg shrink-0 mt-0.5 ${
                              isPositive
                                ? "bg-field-500/10 text-field-500"
                                : "bg-ember-500/10 text-ember-500"
                            }`}
                          >
                            {isPositive ? <ArrowDownLeft size={16} /> : <ArrowUpRight size={16} />}
                          </div>

                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-xs font-bold text-slate-900 dark:text-white capitalize">
                                {log.action.replace("_", " ")}
                              </span>
                              <span
                                className={`text-xs font-bold tabular-nums ${
                                  isPositive ? "text-field-500" : "text-ember-500"
                                }`}
                              >
                                {isPositive ? `+${log.quantityChange}` : log.quantityChange} {stockItem.unit}
                              </span>
                            </div>

                            <p className="text-xs text-slate-600 dark:text-slate-300 mt-0.5">{log.reason}</p>

                            {log.recipient && (
                              <p className="text-[11px] text-slate-500 mt-0.5">
                                Recipient / Issued To: <span className="text-slate-700 dark:text-slate-300 font-medium">{log.recipient}</span>
                              </p>
                            )}

                            <div className="flex items-center gap-3 mt-1 text-[11px] text-slate-400">
                              <span>
                                Balance: {log.previousQuantity} → {log.newQuantity} {stockItem.unit}
                              </span>
                              <span>•</span>
                              <span>By {log.performedByName}</span>
                              <span>•</span>
                              <span>{format(new Date(log.date), "dd MMM yyyy, hh:mm a")}</span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                </div>
              )}
            </div>
          </>
        )}

        <div className="flex justify-end pt-2 border-t border-slate-200 dark:border-white/5">
          <Button variant="ghost" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
    </Modal>
  );
};

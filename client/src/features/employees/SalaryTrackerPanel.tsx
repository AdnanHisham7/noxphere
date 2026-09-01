// src/features/employees/SalaryTrackerPanel.tsx
import React, { useState } from "react";
import { toast } from "react-hot-toast";
import { CheckCircle2, Clock3 } from "lucide-react";
import { Badge, Button, Skeleton, EmptyState } from "../../components/ui";
import { useConfirm } from "../../hooks/useConfirm";
import { useListSalaryForPeriodQuery, useMarkSalaryPaidMutation } from "../../store/api/employeeApi";

const currentPeriod = () => new Date().toISOString().slice(0, 7);

export const SalaryTrackerPanel: React.FC<{ academyId: string }> = ({ academyId }) => {
  const [period, setPeriod] = useState(currentPeriod());
  const { data: records, isLoading } = useListSalaryForPeriodQuery({ academyId, period });
  const [markPaid, { isLoading: marking }] = useMarkSalaryPaidMutation();
  const { confirm, ConfirmDialog } = useConfirm();

  const handleMarkPaid = async (salaryPaymentId: string, name: string) => {
    const ok = await confirm({
      title: "Mark salary as paid",
      message: `Mark ${name}'s salary for ${period} as paid? This is a record-keeping action only — no payment is actually processed.`,
      confirmLabel: "Mark as paid",
    });
    if (!ok) return;
    try {
      await markPaid({ academyId, salaryPaymentId }).unwrap();
      toast.success("Marked as paid");
    } catch (err: any) {
      toast.error(err?.data?.message || "Couldn't update — try again");
    }
  };

  const totalPending = (records ?? []).filter((r) => r.status === "pending").reduce((sum, r) => sum + r.amount, 0);
  const totalPaid = (records ?? []).filter((r) => r.status === "paid").reduce((sum, r) => sum + r.amount, 0);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <input
          type="month"
          value={period}
          onChange={(e) => setPeriod(e.target.value)}
          className="input"
        />
        <div className="flex gap-4 text-xs">
          <span className="text-slate-500">Pending: <span className="text-ember-400 font-semibold">₹{totalPending.toLocaleString("en-IN")}</span></span>
          <span className="text-slate-500">Paid: <span className="text-field-400 font-semibold">₹{totalPaid.toLocaleString("en-IN")}</span></span>
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-2">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-14 rounded" />)}</div>
      ) : !records?.length ? (
        <EmptyState icon={<Clock3 size={28} />} title="No employees for this period" description="Add employees under the Employees tab first." />
      ) : (
        <div className="card divide-y divide-white/5">
          {records.map((rec) => {
            const emp = typeof rec.employeeId === "object" ? rec.employeeId : null;
            return (
              <div key={rec.id} className="flex items-center gap-4 p-4">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-white">{emp ? `${emp.firstName} ${emp.lastName}` : "Employee"}</p>
                  <p className="text-2xs text-slate-500">{emp?.employeeType === "staff" ? "System access" : "External"}</p>
                </div>
                <span className="text-sm text-white w-24 text-right">₹{rec.amount.toLocaleString("en-IN")}</span>
                <Badge variant={rec.status === "paid" ? "green" : "yellow"}>
                  {rec.status === "paid" ? "Paid" : "Pending"}
                </Badge>
                {rec.status === "pending" ? (
                  <Button
                    size="sm"
                    variant="secondary"
                    icon={<CheckCircle2 size={13} />}
                    loading={marking}
                    onClick={() => handleMarkPaid(rec.id, emp ? `${emp.firstName} ${emp.lastName}` : "this employee")}
                  >
                    Mark Paid
                  </Button>
                ) : (
                  <span className="text-2xs text-slate-600 w-24 text-right">
                    {rec.paidAt ? new Date(rec.paidAt).toLocaleDateString("en-IN", { day: "numeric", month: "short" }) : ""}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      )}
      {ConfirmDialog}
    </div>
  );
};
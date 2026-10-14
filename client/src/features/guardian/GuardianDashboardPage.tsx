// src/features/guardian/GuardianDashboardPage.tsx
import React, { useState } from "react";
import { Link } from "react-router-dom";
import {
  Users,
  AlertTriangle,
  Wallet,
  Calendar,
  Clock,
  ArrowRight,
  CreditCard,
  CheckCircle,
} from "lucide-react";
import { useSelector } from "react-redux";
import { RootState } from "../../store";
import {
  useGetGuardianDashboardQuery,
  type GuardianFeeUrgencyItem,
} from "../../store/api/guardianApi";
import {
  NoxPageHeader,
  NoxStatCard,
  NoxSkeleton,
  NoxEmptyState,
  NoxStatusBadge,
} from "../../components/portal-ui";
import { PayFeeModal } from "./PayFeeModal";

const GuardianDashboardPage: React.FC = () => {
  const user = useSelector((s: RootState) => s.auth.user);
  const { data, isLoading, isError, refetch } = useGetGuardianDashboardQuery();

  const [paymentModalFee, setPaymentModalFee] =
    useState<GuardianFeeUrgencyItem | null>(null);

  const attendanceByStudent = new Map(
    (data?.todayAttendance ?? []).map((a) => [a.studentId, a.status]),
  );

  const lateFees = data?.lateFees ?? data?.overdueFees ?? [];
  const pendingFees = data?.pendingFees ?? [];
  const upcomingFees = data?.upcomingFees ?? [];

  const totalActionableFees = lateFees.length + pendingFees.length;

  return (
    <div>
      <NoxPageHeader
        eyebrow="Guardian portal"
        title={`Welcome back${user?.firstName ? `, ${user.firstName}` : ""}`}
        subtitle="Track your children's training, attendance, and fee installments in one place."
      />

      {isLoading && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
          {[1, 2, 3, 4].map((i) => (
            <NoxSkeleton key={i} className="h-24" />
          ))}
        </div>
      )}

      {isError && (
        <NoxEmptyState
          title="Couldn't load your dashboard"
          body="Please refresh the page, or try again shortly."
        />
      )}

      {data && (
        <>
          {/* Top Stat Summary */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
            <NoxStatCard
              label="Children"
              value={data.children.length}
              icon={<Users size={18} />}
              accent="ion"
            />
            <NoxStatCard
              label="Late / Overdue"
              value={lateFees.length}
              icon={<AlertTriangle size={18} />}
              accent={lateFees.length ? "core" : "ion"}
            />
            <NoxStatCard
              label="Due Soon (≤14d)"
              value={pendingFees.length}
              icon={<Wallet size={18} />}
              accent={pendingFees.length ? "plasma" : "ion"}
            />
            <NoxStatCard
              label="Upcoming Installments"
              value={upcomingFees.length}
              icon={<Calendar size={18} />}
              accent="ion"
            />
          </div>

          {/* Children List */}
          {data.children.length === 0 ? (
            <NoxEmptyState
              title="No children linked yet"
              body="Once your academy links a student to your account, they'll show up here."
              icon={<Users size={28} />}
            />
          ) : (
            <div className="mb-10">
              <h2 className="font-orbital text-lg font-medium text-nox-high mb-4">
                Your children
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {data.children.map((child) => {
                  const todayStatus = attendanceByStudent.get(child.id);
                  return (
                    <Link
                      key={child.id}
                      to={`/guardian/children/${child.id}`}
                      className="nox-card p-5 block hover:border-core-400/30 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <span className="flex items-center justify-center w-11 h-11 rounded-full bg-core-400/[0.12] text-core-400 font-orbital font-semibold">
                          {child.firstName.charAt(0)}
                          {child.lastName.charAt(0)}
                        </span>
                        <div>
                          <div className="font-orbital text-sm font-medium text-nox-high">
                            {child.firstName} {child.lastName}
                          </div>
                          <div className="text-[11px] text-nox-low font-mono">
                            {child.attendancePercentage}% attendance
                          </div>
                        </div>
                      </div>
                      <div className="mt-4 pt-3 border-t border-white/[0.06] flex items-center justify-between">
                        <div className="flex items-center gap-1.5 text-xs text-nox-mid">
                          <span>Today:</span>
                          {todayStatus ? (
                            <NoxStatusBadge status={todayStatus} />
                          ) : (
                            <span className="text-xs text-nox-low font-mono">
                              Not marked
                            </span>
                          )}
                        </div>
                        <span className="text-2xs font-mono text-core-400 group-hover:underline flex items-center gap-1">
                          View &amp; Fees &rarr;
                        </span>
                      </div>
                    </Link>
                  );
                })}
              </div>
            </div>
          )}

          {/* Fee Management Sections Categorized by Urgency */}
          <div className="space-y-8">
            {/* 1. LATE / OVERDUE FEES (High Urgency) */}
            {lateFees.length > 0 && (
              <div className="space-y-4">
                <div className="flex items-center justify-between border-b border-rose-500/20 pb-3">
                  <div className="flex items-center gap-2">
                    <span className="p-1.5 rounded-lg bg-rose-500/10 text-rose-400 border border-rose-500/20">
                      <AlertTriangle size={18} />
                    </span>
                    <div>
                      <h3 className="font-orbital text-base font-semibold text-rose-400 flex items-center gap-2">
                        Late &amp; Overdue Fees
                        <span className="text-xs font-mono px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-300 font-bold">
                          {lateFees.length} Action Required
                        </span>
                      </h3>
                      <p className="text-xs text-nox-mid">
                        These installments are past their due dates. Please clear them promptly.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {lateFees.map((fee) => {
                    const daysOverdue = Math.abs(fee.daysDiff || 0);
                    const currSymbol = fee.currency === "INR" ? "₹" : fee.currency;
                    return (
                      <div
                        key={`${fee.feeId}-${fee.installmentNumber}`}
                        className="nox-card p-5 border-rose-500/30 bg-rose-950/[0.08] flex flex-col justify-between hover:border-rose-500/50 transition-all space-y-4"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-orbital text-sm font-semibold text-nox-high">
                                {fee.studentName}
                              </span>
                              <span className="text-2xs font-mono uppercase tracking-wider px-2 py-0.5 rounded bg-white/5 text-slate-300">
                                {fee.feeType.replace("_", " ")}
                              </span>
                            </div>
                            <div className="text-xs text-nox-mid mt-1">
                              Installment #{fee.installmentNumber}
                            </div>
                            <div className="text-xs text-rose-400 font-mono font-medium mt-1 flex items-center gap-1.5">
                              <AlertTriangle size={13} />
                              Overdue by {daysOverdue} {daysOverdue === 1 ? "day" : "days"} (Due{" "}
                              {new Date(fee.dueDate).toLocaleDateString()})
                            </div>
                          </div>

                          <div className="text-right">
                            <span className="text-2xs font-mono uppercase tracking-wider px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-400 font-bold">
                              Overdue
                            </span>
                            <div className="font-orbital text-lg font-bold text-rose-400 mt-2">
                              {currSymbol}
                              {fee.amount.toLocaleString("en-IN")}
                            </div>
                          </div>
                        </div>

                        <div className="pt-3 border-t border-rose-500/20 flex items-center justify-between">
                          <span className="text-xs text-nox-low font-mono">
                            Pay via QR or Bank Transfer
                          </span>
                          <button
                            type="button"
                            onClick={() => setPaymentModalFee(fee)}
                            className="nox-btn-primary !bg-rose-500 hover:!bg-rose-600 !text-white text-xs flex items-center gap-1.5 py-1.5 px-3.5 shadow-md shadow-rose-950/40"
                          >
                            <CreditCard size={14} />
                            <span>Pay Overdue Fee</span>
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* 2. PENDING FEES (Due within 14 Days) */}
            {pendingFees.length > 0 && (
              <div className="space-y-4">
                <div className="flex items-center justify-between border-b border-amber-500/20 pb-3">
                  <div className="flex items-center gap-2">
                    <span className="p-1.5 rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/20">
                      <Clock size={18} />
                    </span>
                    <div>
                      <h3 className="font-orbital text-base font-semibold text-amber-400 flex items-center gap-2">
                        Pending Fees (Due Soon)
                        <span className="text-xs font-mono px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 font-bold">
                          {pendingFees.length} Due in ≤14d
                        </span>
                      </h3>
                      <p className="text-xs text-nox-mid">
                        Installments due within the next two weeks.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {pendingFees.map((fee) => {
                    const daysLeft = fee.daysDiff;
                    const currSymbol = fee.currency === "INR" ? "₹" : fee.currency;
                    return (
                      <div
                        key={`${fee.feeId}-${fee.installmentNumber}`}
                        className="nox-card p-5 border-amber-500/30 bg-amber-950/[0.05] flex flex-col justify-between hover:border-amber-500/50 transition-all space-y-4"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-orbital text-sm font-semibold text-nox-high">
                                {fee.studentName}
                              </span>
                              <span className="text-2xs font-mono uppercase tracking-wider px-2 py-0.5 rounded bg-white/5 text-slate-300">
                                {fee.feeType.replace("_", " ")}
                              </span>
                            </div>
                            <div className="text-xs text-nox-mid mt-1">
                              Installment #{fee.installmentNumber}
                            </div>
                            <div className="text-xs text-amber-400 font-mono mt-1 flex items-center gap-1.5">
                              <Clock size={13} />
                              Due {daysLeft === 0 ? "today" : `in ${daysLeft} ${daysLeft === 1 ? "day" : "days"}`} (
                              {new Date(fee.dueDate).toLocaleDateString()})
                            </div>
                          </div>

                          <div className="text-right">
                            <span className="text-2xs font-mono uppercase tracking-wider px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-400 font-semibold">
                              Due Soon
                            </span>
                            <div className="font-orbital text-lg font-bold text-amber-400 mt-2">
                              {currSymbol}
                              {fee.amount.toLocaleString("en-IN")}
                            </div>
                          </div>
                        </div>

                        <div className="pt-3 border-t border-amber-500/20 flex items-center justify-between">
                          <span className="text-xs text-nox-low font-mono">
                            Online payment enabled
                          </span>
                          <button
                            type="button"
                            onClick={() => setPaymentModalFee(fee)}
                            className="nox-btn-primary !bg-amber-500 hover:!bg-amber-600 !text-black font-semibold text-xs flex items-center gap-1.5 py-1.5 px-3.5 shadow-md shadow-amber-950/40"
                          >
                            <CreditCard size={14} />
                            <span>Pay Now</span>
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* 3. UPCOMING INSTALLMENTS (Future) */}
            {upcomingFees.length > 0 && (
              <div className="space-y-4">
                <div className="flex items-center justify-between border-b border-white/[0.08] pb-3">
                  <div className="flex items-center gap-2">
                    <span className="p-1.5 rounded-lg bg-core-400/10 text-core-400 border border-core-400/20">
                      <Calendar size={18} />
                    </span>
                    <div>
                      <h3 className="font-orbital text-base font-semibold text-nox-high flex items-center gap-2">
                        Upcoming Installments
                        <span className="text-xs font-mono px-2 py-0.5 rounded-full bg-white/10 text-slate-300">
                          {upcomingFees.length} Scheduled
                        </span>
                      </h3>
                      <p className="text-xs text-nox-mid">
                        Future scheduled fee payments. You may clear them in advance if desired.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="nox-card divide-y divide-white/[0.06] overflow-hidden">
                  {upcomingFees.map((fee) => {
                    const currSymbol = fee.currency === "INR" ? "₹" : fee.currency;
                    return (
                      <div
                        key={`${fee.feeId}-${fee.installmentNumber}`}
                        className="p-4 sm:p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 hover:bg-white/[0.01] transition-colors"
                      >
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-semibold text-nox-high">
                              {fee.studentName}
                            </span>
                            <span className="text-2xs font-mono uppercase tracking-wider px-2 py-0.5 rounded bg-white/5 text-slate-400">
                              {fee.feeType.replace("_", " ")}
                            </span>
                          </div>
                          <div className="text-xs text-nox-low font-mono flex items-center gap-2">
                            <span>Installment #{fee.installmentNumber}</span>
                            <span>·</span>
                            <span>Due {new Date(fee.dueDate).toLocaleDateString()}</span>
                            {fee.daysDiff > 0 && (
                              <span className="text-slate-400">
                                (in {fee.daysDiff} days)
                              </span>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center justify-between sm:justify-end gap-4 w-full sm:w-auto">
                          <div className="text-left sm:text-right">
                            <div className="font-orbital text-base font-semibold text-nox-high">
                              {currSymbol}
                              {fee.amount.toLocaleString("en-IN")}
                            </div>
                            <span className="text-2xs font-mono text-core-400">
                              Upcoming
                            </span>
                          </div>
                          <button
                            type="button"
                            onClick={() => setPaymentModalFee(fee)}
                            className="nox-btn-secondary text-xs flex items-center gap-1.5 py-1.5 px-3"
                          >
                            <span>Pay in Advance</span>
                            <ArrowRight size={13} />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Zero Fees State */}
            {lateFees.length === 0 &&
              pendingFees.length === 0 &&
              upcomingFees.length === 0 && (
                <div className="nox-card p-6 border-field-400/20 bg-field-400/[0.02] flex items-center gap-4">
                  <div className="w-12 h-12 rounded-full bg-field-400/10 text-field-400 flex items-center justify-center shrink-0">
                    <CheckCircle size={24} />
                  </div>
                  <div>
                    <h3 className="font-orbital text-sm font-semibold text-nox-high">
                      All Fees Up to Date
                    </h3>
                    <p className="text-xs text-nox-mid mt-0.5">
                      You have no pending, late, or upcoming fee payments due at this time.
                    </p>
                  </div>
                </div>
              )}
          </div>

          {/* Pay Fee Modal */}
          {paymentModalFee && (
            <PayFeeModal
              feeId={paymentModalFee.feeId}
              installmentNumber={paymentModalFee.installmentNumber}
              studentId={paymentModalFee.studentId}
              studentName={paymentModalFee.studentName}
              feeType={paymentModalFee.feeType}
              amount={paymentModalFee.amount}
              dueDate={paymentModalFee.dueDate}
              currency={paymentModalFee.currency}
              onClose={() => setPaymentModalFee(null)}
              onSuccess={() => {
                refetch();
              }}
            />
          )}
        </>
      )}
    </div>
  );
};

export default GuardianDashboardPage;


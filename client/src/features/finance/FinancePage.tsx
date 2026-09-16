// src/features/finance/FinancePage.tsx
import React, { useState } from "react";
import { Link } from "react-router-dom";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from "recharts";
import { clsx } from "clsx";
import {
  CreditCard,
  Building2,
  TrendingUp,
  ShieldCheck,
  ArrowRight,
  Sparkles,
  Info,
  Layers,
  Radio,
  Clock,
  CheckCircle2,
  Wallet,
} from "lucide-react";
import { StatCard, Skeleton, EmptyState, Badge, Button } from "../../components/ui";
import { academyApi } from "../../store/api/academyApi";
import {
  useGetFinanceOverviewQuery,
  useGetRevenueByMonthQuery,
  useGetRevenueByAcademyQuery,
  useGetOverdueInvoicesQuery,
  useGetRecentTransactionsQuery,
  type Transaction,
  type MonthlyRevenue,
  type AcademyRevenue,
  type OverdueInvoice,
} from "../../store/api/financeApi";

const formatCurrency = (n: number) =>
  n >= 10000000 ? `₹${(n / 10000000).toFixed(2)}Cr` : n >= 100000 ? `₹${(n / 100000).toFixed(1)}L` : `₹${n.toLocaleString("en-IN")}`;

const ChartTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-slate-900 dark:bg-pitch-800 border border-slate-700 dark:border-white/10 rounded px-3 py-2 text-xs shadow-lg">
      <p className="text-slate-400 font-medium mb-1">{label}</p>
      {payload.map((p: any) => (
        <p key={p.dataKey} style={{ color: p.fill }} className="font-bold flex items-center justify-between gap-4">
          <span>{p.name}:</span>
          <span>{formatCurrency(p.value)}</span>
        </p>
      ))}
    </div>
  );
};

const FinancePage: React.FC = () => {
  const [academyId, setAcademyId] = useState("");
  const [txFilter, setTxFilter] = useState<"platform_all" | "subscriptions" | "nfc" | "academy_fees">("platform_all");
  const [showInternalFeeAudit, setShowInternalFeeAudit] = useState(false);

  const { data: academiesResult } = academyApi.useGetAcademiesQuery({ isActive: true, limit: 100 });
  const academies = academiesResult?.data ?? [];

  const params = academyId ? { academyId } : undefined;
  const { data: overview, isLoading: overviewLoading } = useGetFinanceOverviewQuery(params);
  const { data: monthly, isLoading: monthlyLoading } = useGetRevenueByMonthQuery(params);
  const { data: byAcademy, isLoading: byAcademyLoading } = useGetRevenueByAcademyQuery();
  const { data: overdue, isLoading: overdueLoading } = useGetOverdueInvoicesQuery(params);
  const { data: transactions, isLoading: txLoading } = useGetRecentTransactionsQuery(params);

  const rawTxList: Transaction[] = Array.isArray(transactions)
    ? transactions
    : Array.isArray((transactions as any)?.data)
    ? (transactions as any).data
    : [];

  const filteredTransactions = rawTxList.filter((tx) => {
    const isSub = tx.type === "academy_subscription" || tx.method === "Stripe" && !tx.quantity;
    const isNfc = tx.type === "nfc_card_order" || !!tx.quantity;
    const isFee = tx.type === "student_fee" || (!isSub && !isNfc);

    if (txFilter === "platform_all") return isSub || isNfc;
    if (txFilter === "subscriptions") return isSub;
    if (txFilter === "nfc") return isNfc;
    if (txFilter === "academy_fees") return isFee;
    return true;
  });

  const monthlyList: MonthlyRevenue[] = Array.isArray(monthly)
    ? monthly
    : Array.isArray((monthly as any)?.data)
    ? (monthly as any).data
    : [];

  const byAcademyList: AcademyRevenue[] = Array.isArray(byAcademy)
    ? byAcademy
    : Array.isArray((byAcademy as any)?.data)
    ? (byAcademy as any).data
    : [];

  const overdueList: OverdueInvoice[] = Array.isArray(overdue?.data)
    ? overdue.data
    : Array.isArray(overdue)
    ? (overdue as any)
    : [];

  const totalPlatformRev = overview?.totalPlatformRevenue ?? overview?.totalRevenue ?? 0;
  const subRev = overview?.subscriptionRevenue ?? 0;
  const nfcRev = overview?.nfcRevenue ?? 0;

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="pill pill-green font-mono text-2xs uppercase">Platform Operator</span>
            <span className="text-2xs text-slate-500">Super Admin Finances</span>
          </div>
          <h1 className="font-display font-extrabold text-slate-900 dark:text-white text-xl sm:text-2xl uppercase tracking-tight">
            Platform Financial Ledger
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5 max-w-2xl">
            Super Admin revenue derived strictly from Academy SaaS Subscriptions and Smart NFC Card sales.
          </p>
        </div>

        <select
          className="input w-full sm:!w-auto text-xs"
          value={academyId}
          onChange={(e) => setAcademyId(e.target.value)}
        >
          <option value="">All Academies (Platform-Wide)</option>
          {academies.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
            </option>
          ))}
        </select>
      </div>

      {/* Domain Separation Notice */}
      <div className="card p-3.5 bg-slate-100/70 dark:bg-pitch-800/40 border border-slate-200/80 dark:border-white/[0.06] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-2.5 text-slate-600 dark:text-slate-300">
          <Info size={16} className="text-volt-500 dark:text-volt-400 shrink-0" />
          <span>
            <strong>Revenue Model:</strong> Platform earnings come directly from <strong>SaaS Subscriptions</strong> and <strong>Smart NFC Card sales</strong>. Student coaching and tuition fees belong exclusively to each respective academy.
          </span>
        </div>
        <Link to="/nfc-cards" className="shrink-0 w-full sm:w-auto">
          <Button size="sm" variant="secondary" className="text-xs !py-1 !px-2.5 w-full justify-center">
            <CreditCard size={13} className="mr-1" /> NFC Cards Center
          </Button>
        </Link>
      </div>

      {/* Platform KPI Row */}
      {overviewLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-28 rounded-lg" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <StatCard
            label="Total Platform Revenue"
            value={formatCurrency(totalPlatformRev)}
            sublabel={`SaaS: ${formatCurrency(subRev)} · NFC: ${formatCurrency(nfcRev)}`}
            icon={<Wallet size={20} />}
            accent="volt"
          />
          <StatCard
            label="Academy SaaS Subscriptions"
            value={formatCurrency(subRev)}
            sublabel={`${overview?.activeSubscriptionsCount ?? 0} active subscriptions`}
            icon={<CreditCard size={20} />}
            accent="ice"
          />
          <StatCard
            label="Smart NFC Card Sales"
            value={formatCurrency(nfcRev)}
            sublabel={`${overview?.nfcCardsCount ?? 0} cards · ${overview?.nfcOrdersCount ?? 0} orders`}
            icon={<Radio size={20} />}
            accent="field"
          />
          <StatCard
            label="Active Client Academies"
            value={overview?.activeSubscriptionsCount ?? academies.length}
            sublabel="Recurring Stripe billing active"
            icon={<Building2 size={20} />}
            accent="ember"
          />
        </div>
      )}

      {/* Academy-Internal Tuition Auditing Panel (Optional / Collapsible) */}
      <div className="card p-4 bg-slate-50 dark:bg-pitch-800/30 border border-slate-200 dark:border-white/5 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Building2 size={16} className="text-slate-400" />
            <div>
              <h4 className="font-semibold text-xs text-slate-900 dark:text-white">
                Academy Internal Student Collections (For Platform Audit)
              </h4>
              <p className="text-2xs text-slate-500">
                Tuition and installment payments collected directly by academies from their students. (Not platform income)
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setShowInternalFeeAudit((prev) => !prev)}
            className="text-xs text-slate-500 hover:text-slate-900 dark:hover:text-white underline font-medium"
          >
            {showInternalFeeAudit ? "Hide Details" : "View Audit Overview"}
          </button>
        </div>

        {showInternalFeeAudit && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2 border-t border-slate-200 dark:border-white/5 animate-fade-in">
            <div className="p-2.5 rounded-lg bg-white dark:bg-pitch-900 border border-slate-200 dark:border-white/5">
              <span className="text-2xs uppercase text-slate-400 font-mono">Total Billed by Academies</span>
              <p className="font-display font-bold text-sm text-slate-900 dark:text-white mt-0.5">
                {formatCurrency(overview?.academyFeesTotal ?? overview?.studentFeeRevenue ?? 0)}
              </p>
            </div>
            <div className="p-2.5 rounded-lg bg-white dark:bg-pitch-900 border border-slate-200 dark:border-white/5">
              <span className="text-2xs uppercase text-slate-400 font-mono">Collected by Academies</span>
              <p className="font-display font-bold text-sm text-field-500 dark:text-field-400 mt-0.5">
                {formatCurrency(overview?.academyFeesCollected ?? 0)}
              </p>
            </div>
            <div className="p-2.5 rounded-lg bg-white dark:bg-pitch-900 border border-slate-200 dark:border-white/5">
              <span className="text-2xs uppercase text-slate-400 font-mono">Outstanding to Academies</span>
              <p className="font-display font-bold text-sm text-amber-500 mt-0.5">
                {formatCurrency(overview?.academyFeesOutstanding ?? overview?.totalOutstanding ?? 0)}
              </p>
            </div>
            <div className="p-2.5 rounded-lg bg-white dark:bg-pitch-900 border border-slate-200 dark:border-white/5">
              <span className="text-2xs uppercase text-slate-400 font-mono">Overdue Academy Invoices</span>
              <p className="font-display font-bold text-sm text-rose-500 mt-0.5">
                {overview?.academyFeesOverdueCount ?? overview?.overdueCount ?? 0} ({formatCurrency(overview?.academyFeesOverdueAmount ?? overview?.overdueAmount ?? 0)})
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Platform Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Monthly Platform Revenue Chart */}
        <div className="lg:col-span-2 card p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="section-title">Platform Revenue Streams — Last 6 Months</p>
              <p className="text-2xs text-slate-500">Breakdown of SaaS Subscriptions vs Smart NFC Card Sales</p>
            </div>
            <span className="pill pill-green text-2xs font-mono">Super Admin Income</span>
          </div>

          {monthlyLoading ? (
            <Skeleton className="h-56 rounded" />
          ) : !monthlyList.length || monthlyList.every((m) => (m.platformRevenue ?? m.revenue) === 0) ? (
            <EmptyState
              title="No platform income records yet"
              description="Platform revenue will appear once academies subscribe or purchase Smart NFC cards."
            />
          ) : (
            <ResponsiveContainer width="100%" height={230}>
              <BarChart data={monthlyList}>
                <CartesianGrid stroke="rgba(255,255,255,0.04)" vertical={false} />
                <XAxis dataKey="month" tick={{ fill: "#64748b", fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis
                  tick={{ fill: "#64748b", fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(v) => formatCurrency(v)}
                />
                <Tooltip content={<ChartTooltip />} />
                <Bar dataKey="subscriptionRevenue" name="SaaS Subscriptions" fill="#3b82f6" radius={[3, 3, 0, 0]} />
                <Bar dataKey="nfcRevenue" name="NFC Cards" fill="#16a34a" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Platform Revenue By Academy */}
        <div className="card p-5 space-y-4">
          <div className="flex items-center justify-between">
            <p className="section-title">Platform Income by Academy</p>
            <span className="text-2xs text-slate-500">SaaS + NFC</span>
          </div>

          {byAcademyLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-12 rounded" />
              ))}
            </div>
          ) : !byAcademyList.length ? (
            <EmptyState title="No academies yet" />
          ) : (
            <div className="space-y-3 max-h-56 overflow-y-auto pr-1">
              {byAcademyList.map((a) => {
                const totalPaid = a.platformRevenue ?? a.revenue;
                return (
                  <div key={a.academyId} className="flex items-center justify-between">
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-slate-900 dark:text-white truncate">
                        {a.academyName}
                      </p>
                      <p className="text-2xs text-slate-500">
                        SaaS: {formatCurrency(a.subscriptionRevenue ?? 0)} · NFC: {formatCurrency(a.nfcRevenue ?? 0)}
                      </p>
                    </div>
                    <span className="font-display font-bold text-field-500 dark:text-volt-400 text-sm flex-shrink-0">
                      {formatCurrency(totalPaid)}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Transactions Section with Clear Category Separation */}
      <div className="card p-5 space-y-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div>
            <p className="section-title">Platform Financial Transactions</p>
            <p className="text-2xs text-slate-500">
              Audit log of all Stripe subscriptions, hardware NFC payments, and academy student tuition
            </p>
          </div>

          {/* Filter Tabs */}
          <div className="flex items-center gap-1 bg-slate-100 dark:bg-pitch-800/60 p-0.5 rounded-lg border border-slate-200/60 dark:border-white/[0.04] overflow-x-auto max-w-full">
            <button
              type="button"
              onClick={() => setTxFilter("platform_all")}
              className={`px-2.5 py-1 rounded text-2xs font-semibold whitespace-nowrap transition-colors ${
                txFilter === "platform_all"
                  ? "bg-volt-400 text-pitch-900 font-bold shadow-sm"
                  : "text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white"
              }`}
            >
              All Platform Income
            </button>
            <button
              type="button"
              onClick={() => setTxFilter("subscriptions")}
              className={`px-2.5 py-1 rounded text-2xs font-semibold whitespace-nowrap transition-colors flex items-center gap-1 ${
                txFilter === "subscriptions"
                  ? "bg-volt-400 text-pitch-900 font-bold shadow-sm"
                  : "text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white"
              }`}
            >
              <CreditCard size={11} /> SaaS Subscriptions
            </button>
            <button
              type="button"
              onClick={() => setTxFilter("nfc")}
              className={`px-2.5 py-1 rounded text-2xs font-semibold whitespace-nowrap transition-colors flex items-center gap-1 ${
                txFilter === "nfc"
                  ? "bg-volt-400 text-pitch-900 font-bold shadow-sm"
                  : "text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white"
              }`}
            >
              <Radio size={11} /> NFC Card Sales
            </button>
            <button
              type="button"
              onClick={() => setTxFilter("academy_fees")}
              className={`px-2.5 py-1 rounded text-2xs font-semibold whitespace-nowrap transition-colors flex items-center gap-1 ${
                txFilter === "academy_fees"
                  ? "bg-volt-400 text-pitch-900 font-bold shadow-sm"
                  : "text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white"
              }`}
            >
              <Building2 size={11} /> Academy Student Fees (Internal)
            </button>
          </div>
        </div>

        {txLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-12 rounded" />
            ))}
          </div>
        ) : !filteredTransactions.length ? (
          <EmptyState
            title="No transactions recorded"
            description="No payments match the selected revenue stream filter."
          />
        ) : (
          <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
            {filteredTransactions.map((tx, i) => {
              const isSub = tx.type === "academy_subscription" || (tx.method === "Stripe" && !tx.quantity);
              const isNfc = tx.type === "nfc_card_order" || !!tx.quantity;

              return (
                <div
                  key={`${tx.feeId}-${i}`}
                  className="flex items-center justify-between p-3 rounded-lg bg-white dark:bg-pitch-900/60 border border-slate-200/80 dark:border-white/5 hover:border-slate-300 dark:hover:border-white/10 transition-colors"
                >
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-xs font-semibold text-slate-900 dark:text-white">
                        {tx.student}
                      </p>
                      {isSub ? (
                        <span className="text-2xs font-mono font-bold bg-indigo-500/15 text-indigo-500 dark:text-indigo-400 px-2 py-0.5 rounded flex items-center gap-1">
                          <CreditCard size={10} /> SaaS Subscription (Platform)
                        </span>
                      ) : isNfc ? (
                        <span className="text-2xs font-mono font-bold bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 px-2 py-0.5 rounded flex items-center gap-1">
                          <Radio size={10} /> NFC Cards Sale (Platform)
                        </span>
                      ) : (
                        <span className="text-2xs font-mono text-slate-500 bg-slate-100 dark:bg-pitch-800 px-2 py-0.5 rounded flex items-center gap-1">
                          <Building2 size={10} /> Academy Student Fee (Internal)
                        </span>
                      )}
                    </div>

                    <p className="text-2xs text-slate-500 flex items-center gap-2">
                      <span>{new Date(tx.paidAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}</span>
                      <span>·</span>
                      <span>Method: {tx.method || "Stripe"}</span>
                      {tx.billingInterval && (
                        <>
                          <span>·</span>
                          <span className="capitalize">{tx.billingInterval} Plan</span>
                        </>
                      )}
                      {tx.quantity && (
                        <>
                          <span>·</span>
                          <span>Quantity: {tx.quantity} cards</span>
                        </>
                      )}
                      {tx.transactionId && (
                        <>
                          <span>·</span>
                          <span className="font-mono text-slate-400">ID: {tx.transactionId.slice(-8)}</span>
                        </>
                      )}
                    </p>
                  </div>

                  <div className="text-right shrink-0">
                    <span
                      className={`font-display font-bold text-sm ${
                        isSub
                          ? "text-indigo-500 dark:text-volt-400"
                          : isNfc
                          ? "text-emerald-600 dark:text-emerald-400"
                          : "text-slate-600 dark:text-slate-300"
                      }`}
                    >
                      {formatCurrency(tx.amount)}
                    </span>
                    <p className="text-3xs text-slate-400">
                      {isSub || isNfc ? "Platform Revenue" : "Academy Revenue"}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default FinancePage;

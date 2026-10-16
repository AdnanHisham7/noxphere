// src/features/expenses/ExpenseManagementPage.tsx
import React, { useState, useMemo } from "react";
import { useSelector } from "react-redux";
import { RootState } from "../../store";
import { useCurrentAcademyId } from "../../hooks/useCurrentAcademyId";
import { useCurrentFranchiseId } from "../../hooks/useCurrentFranchiseId";
import { useGetFranchisesQuery } from "../../store/api/franchiseApi";
import { useGetAcademyByIdQuery } from "../../store/api/academyApi";
import {
  useListExpensesQuery,
  useListStocksQuery,
  useListIncomesQuery,
  useGetAnalyticsReportQuery,
  useVerifyPurchaseMutation,
  useRejectPurchaseMutation,
  useDeleteExpenseMutation,
  useDeleteIncomeMutation,
  type ExpenseItem,
  type StockItem,
} from "../../store/api/expenseApi";
import {
  StatCard,
  Button,
  Input,
  Badge,
  Spinner,
  EmptyState,
  PageHeader,
  Tabs,
  Select,
} from "../../components/ui";
import { AddPurchaseModal } from "./components/AddPurchaseModal";
import { AddMiscExpenseModal } from "./components/AddMiscExpenseModal";
import { AddStockItemModal } from "./components/AddStockItemModal";
import { IssueStockModal } from "./components/IssueStockModal";
import { AdjustStockModal } from "./components/AdjustStockModal";
import { StockHistoryModal } from "./components/StockHistoryModal";
import { RecordIncomeModal } from "./components/RecordIncomeModal";
import { PrintReportModal } from "./components/PrintReportModal";
import { format } from "date-fns";
import toast from "react-hot-toast";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  PieChart,
  Pie,
  Cell,
  CartesianGrid,
} from "recharts";
import {
  LayoutDashboard,
  ShoppingCart,
  Boxes,
  Receipt,
  ArrowDownLeft,
  FileSpreadsheet,
  Plus,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  History,
  TrendingUp,
  TrendingDown,
  Printer,
  Download,
  Filter,
  Search,
  PackageMinus,
  SlidersHorizontal,
  PackagePlus,
  Trash2,
  Building2,
  Calendar,
} from "lucide-react";

type ActiveTab = "overview" | "purchases" | "stocks" | "misc" | "inflows" | "reports";

const PIE_COLORS = [
  "#ccff00", // volt
  "#38bdf8", // ice
  "#fb7185", // rose
  "#a78bfa", // purple
  "#fb923c", // orange
  "#34d399", // emerald
  "#facc15", // yellow
  "#94a3b8", // slate
];

export const ExpenseManagementPage: React.FC = () => {
  const { user } = useSelector((s: RootState) => s.auth);
  const activeAcademyId = useCurrentAcademyId();
  const currentFranchiseId = useCurrentFranchiseId();

  const [activeTab, setActiveTab] = useState<ActiveTab>("overview");
  const [selectedFranchiseId, setSelectedFranchiseId] = useState<string>(
    user?.franchiseId || currentFranchiseId || "all"
  );

  // Timeframe filters for Overview and Reports
  const [timeframe, setTimeframe] = useState<"day" | "month" | "year" | "lifetime" | "custom">("month");
  const [reportDate, setReportDate] = useState<string>(new Date().toISOString().split("T")[0]);
  const [reportMonth, setReportMonth] = useState<string>(
    `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, "0")}`
  );
  const [reportYear, setReportYear] = useState<string>(new Date().getFullYear().toString());
  const [customStart, setCustomStart] = useState<string>("");
  const [customEnd, setCustomEnd] = useState<string>("");

  // Modals state
  const [isAddPurchaseOpen, setIsAddPurchaseOpen] = useState(false);
  const [isAddMiscOpen, setIsAddMiscOpen] = useState(false);
  const [isAddStockOpen, setIsAddStockOpen] = useState(false);
  const [isRecordIncomeOpen, setIsRecordIncomeOpen] = useState(false);
  const [isPrintReportOpen, setIsPrintReportOpen] = useState(false);

  const [restockItem, setRestockItem] = useState<StockItem | null>(null);
  const [issueStockItem, setIssueStockItem] = useState<StockItem | null>(null);
  const [adjustStockItem, setAdjustStockItem] = useState<StockItem | null>(null);
  const [historyStockItemId, setHistoryStockItemId] = useState<string | null>(null);

  // Filters for tabs
  const [purchasesFilter, setPurchasesFilter] = useState<string>("all");
  const [purchasesSearch, setPurchasesSearch] = useState<string>("");
  const [stocksFilter, setStocksFilter] = useState<string>("all");
  const [stocksSearch, setStocksSearch] = useState<string>("");
  const [miscSearch, setMiscSearch] = useState<string>("");

  // Data fetching
  const { data: currentAcademy } = useGetAcademyByIdQuery(activeAcademyId!, {
    skip: !activeAcademyId,
  });

  const { data: franchises } = useGetFranchisesQuery(
    activeAcademyId ? { academyId: activeAcademyId, isActive: true } : undefined,
    { skip: !activeAcademyId }
  );

  const franchiseNameMap = useMemo(() => {
    const map = new Map<string, string>();
    franchises?.forEach((f) => map.set(f.id, f.name));
    return map;
  }, [franchises]);

  const activeFranchiseName =
    selectedFranchiseId === "all"
      ? "All Branches"
      : franchiseNameMap.get(selectedFranchiseId) || "Selected Branch";

  // Queries
  const { data: reportData, isLoading: isReportLoading } = useGetAnalyticsReportQuery(
    {
      academyId: activeAcademyId || "",
      franchiseId: selectedFranchiseId !== "all" ? selectedFranchiseId : undefined,
      timeframe,
      date: timeframe === "day" ? reportDate : undefined,
      month: timeframe === "month" ? reportMonth : undefined,
      year: timeframe === "year" ? reportYear : undefined,
      startDate: timeframe === "custom" ? customStart : undefined,
      endDate: timeframe === "custom" ? customEnd : undefined,
    },
    { skip: !activeAcademyId }
  );

  const { data: stocksData, isLoading: isStocksLoading } = useListStocksQuery(
    {
      academyId: activeAcademyId || "",
      franchiseId: selectedFranchiseId !== "all" ? selectedFranchiseId : undefined,
      status: stocksFilter !== "all" ? stocksFilter : undefined,
      search: stocksSearch || undefined,
    },
    { skip: !activeAcademyId }
  );

  const { data: purchasesData, isLoading: isPurchasesLoading } = useListExpensesQuery(
    {
      academyId: activeAcademyId || "",
      franchiseId: selectedFranchiseId !== "all" ? selectedFranchiseId : undefined,
      type: "purchase",
      verificationStatus: purchasesFilter !== "all" ? purchasesFilter : undefined,
      search: purchasesSearch || undefined,
      limit: 100,
    },
    { skip: !activeAcademyId }
  );

  const { data: miscData, isLoading: isMiscLoading } = useListExpensesQuery(
    {
      academyId: activeAcademyId || "",
      franchiseId: selectedFranchiseId !== "all" ? selectedFranchiseId : undefined,
      type: "miscellaneous",
      search: miscSearch || undefined,
      limit: 100,
    },
    { skip: !activeAcademyId }
  );

  const { data: incomesData } = useListIncomesQuery(
    {
      academyId: activeAcademyId || "",
      franchiseId: selectedFranchiseId !== "all" ? selectedFranchiseId : undefined,
    },
    { skip: !activeAcademyId }
  );

  // Mutations
  const [verifyPurchase, { isLoading: isVerifying }] = useVerifyPurchaseMutation();
  const [rejectPurchase] = useRejectPurchaseMutation();
  const [deleteExpense] = useDeleteExpenseMutation();
  const [deleteIncome] = useDeleteIncomeMutation();

  const handleVerify = async (id: string) => {
    try {
      await verifyPurchase(id).unwrap();
      toast.success("Purchase verified! Inventory stocks have been updated.");
    } catch (err: any) {
      toast.error(err?.data?.message || "Verification failed");
    }
  };

  const handleReject = async (id: string) => {
    const reason = window.prompt("Enter rejection reason:");
    if (reason === null) return;
    try {
      await rejectPurchase({ id, reason }).unwrap();
      toast.success("Purchase rejected");
    } catch (err: any) {
      toast.error(err?.data?.message || "Rejection failed");
    }
  };

  const handleDeleteExpense = async (id: string) => {
    if (!window.confirm("Are you sure you want to delete this expense record?")) return;
    try {
      await deleteExpense(id).unwrap();
      toast.success("Expense record deleted");
    } catch (err: any) {
      toast.error(err?.data?.message || "Failed to delete expense");
    }
  };

  const handleDeleteIncome = async (id: string) => {
    if (!window.confirm("Are you sure you want to delete this incoming fund record?")) return;
    try {
      await deleteIncome(id).unwrap();
      toast.success("Income record deleted");
    } catch (err: any) {
      toast.error(err?.data?.message || "Failed to delete income");
    }
  };

  const handleOpenRestock = (item: StockItem) => {
    setRestockItem(item);
    setIsAddPurchaseOpen(true);
  };

  if (!activeAcademyId) {
    return (
      <div className="space-y-6 animate-fade-in">
        <EmptyState
          icon={<AlertTriangle className="w-10 h-10 text-amber-500" />}
          title="Academy Not Found"
          description="Please select or configure an academy to manage expenses and inventory."
        />
      </div>
    );
  }

  const summary = reportData?.summary;
  const timeSeries = reportData?.timeSeries || [];
  const categoryBreakdown = reportData?.categoryBreakdown || [];

  return (
    <div className="space-y-6 animate-fade-in">
      {/* ─── Top Header & Controls ────────────────────────────────────────────── */}
      <PageHeader
        breakpoint="xl"
        eyebrow="Financial Management"
        title="Expense & Stock Management"
        subtitle={
          <span className="block max-w-3xl">
            Track purchases, verified stock replenishment, operational expenses, incoming student fees, and financial audits.
          </span>
        }
        actions={
          <div className="flex flex-col md:flex-row md:items-center justify-between xl:justify-end gap-2.5 w-full xl:w-auto">
            {franchises && franchises.length > 0 && !user?.franchiseId && (
              <div className="w-full md:w-52 lg:w-56 shrink-0">
                <Select
                  icon={<Building2 className="w-3.5 h-3.5 text-slate-400" />}
                  value={selectedFranchiseId}
                  onChange={(e) => setSelectedFranchiseId(e.target.value)}
                  className="text-xs py-1.5 sm:py-2"
                >
                  <option value="all">All Branches</option>
                  {franchises.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.name}
                    </option>
                  ))}
                </Select>
              </div>
            )}

            <div className="grid grid-cols-2 sm:flex sm:flex-wrap items-center gap-2 w-full sm:w-auto">
              <Button
                variant="primary"
                onClick={() => {
                  setRestockItem(null);
                  setIsAddPurchaseOpen(true);
                }}
                className="w-full sm:w-auto justify-center text-xs py-2 px-2.5 sm:px-3 flex items-center gap-1.5 font-bold shadow-md truncate order-1 sm:order-3"
                title="Add Purchase & Restock"
              >
                <PackagePlus size={14} className="shrink-0" />
                <span className="truncate">Add Purchase</span>
              </Button>

              <Button
                variant="secondary"
                onClick={() => setIsRecordIncomeOpen(true)}
                className="w-full sm:w-auto justify-center text-xs py-2 px-2.5 sm:px-3 flex items-center gap-1.5 truncate order-2 sm:order-1"
                title="Record External Income"
              >
                <ArrowDownLeft size={14} className="text-field-500 shrink-0" />
                <span className="truncate">Record Income</span>
              </Button>

              <Button
                variant="secondary"
                onClick={() => setIsAddMiscOpen(true)}
                className="w-full sm:w-auto justify-center text-xs py-2 px-2.5 sm:px-3 flex items-center gap-1.5 truncate order-3 sm:order-2"
                title="Log Miscellaneous Expense"
              >
                <Receipt size={14} className="shrink-0" />
                <span className="truncate">Misc Expense</span>
              </Button>

              <Button
                variant="secondary"
                onClick={() => setIsPrintReportOpen(true)}
                className="w-full sm:w-auto justify-center text-xs py-2 px-2.5 sm:px-3 flex items-center gap-1.5 truncate order-4"
                title="Print or download comprehensive financial report"
              >
                <Printer size={14} className="shrink-0" />
                <span className="truncate">Print / Report</span>
              </Button>
            </div>
          </div>
        }
      />

      {/* ─── Navigation Tabs ──────────────────────────────────────────────────── */}
      <Tabs
        activeTab={activeTab}
        onChange={setActiveTab}
        tabs={[
          {
            id: "overview",
            label: (
              <>
                <span className="hidden lg:inline">Financial Overview & Cash Flow</span>
                <span className="hidden sm:inline lg:hidden">Overview & Flow</span>
                <span className="sm:hidden">Overview</span>
              </>
            ),
            icon: <LayoutDashboard size={16} />,
          },
          {
            id: "purchases",
            label: (
              <>
                <span className="hidden lg:inline">Purchases & Restocks</span>
                <span className="hidden sm:inline lg:hidden">Purchases</span>
                <span className="sm:hidden">Purchases</span>
              </>
            ),
            icon: <ShoppingCart size={16} />,
            badge:
              summary && summary.pendingPurchasesCount > 0 ? (
                <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-amber-500/20 text-amber-500 font-bold">
                  {summary.pendingPurchasesCount}
                </span>
              ) : undefined,
          },
          {
            id: "stocks",
            label: (
              <>
                <span className="hidden lg:inline">Stocks & Inventory</span>
                <span className="hidden sm:inline lg:hidden">Inventory</span>
                <span className="sm:hidden">Inventory</span>
              </>
            ),
            icon: <Boxes size={16} />,
            badge:
              summary && summary.outOfStockCount > 0 ? (
                <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-rose-500/20 text-rose-500 font-bold">
                  {summary.outOfStockCount} out
                </span>
              ) : undefined,
          },
          {
            id: "misc",
            label: (
              <>
                <span className="hidden lg:inline">Misc Expenses (No Stocks)</span>
                <span className="hidden sm:inline lg:hidden">Misc Expenses</span>
                <span className="sm:hidden">Misc</span>
              </>
            ),
            icon: <Receipt size={16} />,
          },
          {
            id: "inflows",
            label: (
              <>
                <span className="hidden lg:inline">Incoming Funds & Fees</span>
                <span className="hidden sm:inline lg:hidden">Funds & Fees</span>
                <span className="sm:hidden">Inflows</span>
              </>
            ),
            icon: <ArrowDownLeft size={16} />,
          },
          {
            id: "reports",
            label: (
              <>
                <span className="hidden lg:inline">Advanced Audit Reports</span>
                <span className="hidden sm:inline lg:hidden">Audit Reports</span>
                <span className="sm:hidden">Reports</span>
              </>
            ),
            icon: <FileSpreadsheet size={16} />,
          },
        ]}
      />

      {/* ─── TAB 1: FINANCIAL OVERVIEW & CASH FLOW ─────────────────────────────── */}
      {activeTab === "overview" && (
        <div className="space-y-6">
          {/* Timeframe bar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 bg-slate-50 dark:bg-pitch-900/60 border border-slate-200 dark:border-white/5 rounded-xl">
            <div className="flex items-center justify-between sm:justify-start gap-1.5 text-xs text-slate-600 dark:text-slate-400 font-medium">
              <div className="flex items-center gap-1.5">
                <Calendar size={14} className="text-volt-500" />
                <span>Statement Period:</span>
              </div>
              <span className="sm:hidden font-mono text-[11px] text-volt-500 font-bold uppercase">
                {timeframe}
              </span>
            </div>

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full sm:w-auto">
              <div className="flex rounded-lg border border-slate-200 dark:border-white/10 bg-white dark:bg-pitch-800 p-0.5 text-xs overflow-x-auto no-scrollbar max-w-full">
                {(["day", "month", "year", "lifetime", "custom"] as const).map((t) => (
                  <button
                    key={t}
                    onClick={() => setTimeframe(t)}
                    className={`flex-1 sm:flex-initial px-2.5 sm:px-3 py-1 rounded capitalize font-medium transition-all whitespace-nowrap text-center ${
                      timeframe === t
                        ? "bg-volt-400 text-slate-950 font-bold shadow-sm"
                        : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                    }`}
                  >
                    {t}
                  </button>
                ))}
              </div>

              {timeframe === "day" && (
                <Input
                  type="date"
                  value={reportDate}
                  onChange={(e) => setReportDate(e.target.value)}
                  className="text-xs py-1 px-2 w-full sm:w-36"
                />
              )}

              {timeframe === "month" && (
                <Input
                  type="month"
                  value={reportMonth}
                  onChange={(e) => setReportMonth(e.target.value)}
                  className="text-xs py-1 px-2 w-full sm:w-36"
                />
              )}

              {timeframe === "year" && (
                <Input
                  type="number"
                  min="2020"
                  max="2035"
                  value={reportYear}
                  onChange={(e) => setReportYear(e.target.value)}
                  className="text-xs py-1 px-2 w-full sm:w-24"
                />
              )}

              {timeframe === "custom" && (
                <div className="grid grid-cols-2 sm:flex items-center gap-1.5 w-full sm:w-auto">
                  <Input
                    type="date"
                    value={customStart}
                    onChange={(e) => setCustomStart(e.target.value)}
                    className="text-xs py-1 px-2 w-full sm:w-32"
                    placeholder="Start"
                  />
                  <Input
                    type="date"
                    value={customEnd}
                    onChange={(e) => setCustomEnd(e.target.value)}
                    className="text-xs py-1 px-2 w-full sm:w-32"
                    placeholder="End"
                  />
                </div>
              )}
            </div>
          </div>

          {/* KPI Stat Cards */}
          {isReportLoading ? (
            <div className="py-12 flex justify-center">
              <Spinner size="lg" />
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard
                  label="Total Inflow (Revenue)"
                  value={`₹${(summary?.totalInflow || 0).toLocaleString("en-IN")}`}
                  sublabel={`Student Fees: ₹${(summary?.feesInflow || 0).toLocaleString("en-IN")} | Other: ₹${(summary?.otherInflow || 0).toLocaleString("en-IN")}`}
                  icon={<ArrowDownLeft size={22} />}
                  accent="field"
                />

                <StatCard
                  label="Total Outflow (Expenses)"
                  value={`₹${(summary?.totalOutflow || 0).toLocaleString("en-IN")}`}
                  sublabel={`Purchases: ₹${(summary?.purchasesOutflow || 0).toLocaleString("en-IN")} | Misc: ₹${(summary?.miscOutflow || 0).toLocaleString("en-IN")}`}
                  icon={<Receipt size={22} />}
                  accent="ember"
                />

                <StatCard
                  label="Net Balance (Surplus / Deficit)"
                  value={`${(summary?.netBalance || 0) >= 0 ? "+" : ""}₹${(summary?.netBalance || 0).toLocaleString("en-IN")}`}
                  sublabel={`Net Operating Margin: ${summary?.profitMargin || 0}%`}
                  icon={<TrendingUp size={22} />}
                  accent="volt"
                />

                <StatCard
                  label="Total Inventory Valuation"
                  value={`₹${(summary?.totalInventoryValue || 0).toLocaleString("en-IN")}`}
                  sublabel={`${summary?.outOfStockCount || 0} Stockout | ${summary?.lowStockCount || 0} Low Stock Alert`}
                  icon={<Boxes size={22} />}
                  accent="ice"
                />
              </div>

              {/* Stock Alerts Notice Banner */}
              {summary && summary.outOfStockCount > 0 && (
                <div className="bg-rose-500/10 border border-rose-500/20 rounded-xl p-3.5 sm:p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <span className="p-2 rounded-lg bg-rose-500/20 text-rose-500 shrink-0">
                      <AlertTriangle className="w-5 h-5" />
                    </span>
                    <div>
                      <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                        {summary.outOfStockCount} Inventory Items are Completely Stockout!
                      </h4>
                      <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">
                        These items have 0 quantity available. Create a purchase order to replenish stock immediately.
                      </p>
                    </div>
                  </div>
                  <Button
                    variant="primary"
                    onClick={() => setActiveTab("stocks")}
                    className="w-full sm:w-auto justify-center text-xs py-1.5 px-3 bg-rose-500 hover:bg-rose-600 text-white border-none shrink-0"
                  >
                    View Stockout Items
                  </Button>
                </div>
              )}

              {/* Charts Section */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
                {/* Cash Flow Inflow vs Outflow Trend */}
                <div className="lg:col-span-2 card p-3.5 sm:p-5 space-y-4 min-w-0">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wide font-display">
                        Cash Flow Inflow vs. Outflow Trend
                      </h3>
                      <p className="text-xs text-slate-500">Revenue collected vs Total expenses recorded</p>
                    </div>
                    <Badge variant="gray">{timeframe.toUpperCase()}</Badge>
                  </div>

                  <div className="h-60 sm:h-72 w-full">
                    {timeSeries.length === 0 ? (
                      <div className="h-full flex items-center justify-center text-xs text-slate-400">
                        No financial transactions in this period
                      </div>
                    ) : (
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={timeSeries} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                          <XAxis dataKey="label" stroke="#64748b" fontSize={11} />
                          <YAxis stroke="#64748b" fontSize={11} tickFormatter={(v) => `₹${v >= 1000 ? `${v / 1000}k` : v}`} />
                          <Tooltip
                            content={({ active, payload, label }) => {
                              if (!active || !payload?.length) return null;
                              return (
                                <div className="bg-slate-900 text-white border border-slate-700 rounded-lg p-2.5 text-xs shadow-xl space-y-1">
                                  <p className="font-bold text-slate-300">{label}</p>
                                  <p className="text-field-400 font-semibold">
                                    Inflow: ₹{Number(payload[0]?.value || 0).toLocaleString("en-IN")}
                                  </p>
                                  <p className="text-rose-400 font-semibold">
                                    Outflow: ₹{Number(payload[1]?.value || 0).toLocaleString("en-IN")}
                                  </p>
                                </div>
                              );
                            }}
                          />
                          <Legend wrapperStyle={{ fontSize: "11px" }} />
                          <Bar dataKey="inflow" name="Inflow (Revenue)" fill="#34d399" radius={[4, 4, 0, 0]} />
                          <Bar dataKey="outflow" name="Outflow (Expenses)" fill="#fb7185" radius={[4, 4, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    )}
                  </div>
                </div>

                {/* Expense Distribution by Category */}
                <div className="card p-3.5 sm:p-5 space-y-4 min-w-0">
                  <div>
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wide font-display">
                      Expense Category Breakdown
                    </h3>
                    <p className="text-xs text-slate-500">Distribution of operational & equipment spending</p>
                  </div>

                  <div className="h-44 sm:h-48 w-full flex items-center justify-center">
                    {categoryBreakdown.length === 0 ? (
                      <p className="text-xs text-slate-400">No expenses in this period</p>
                    ) : (
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={categoryBreakdown}
                            dataKey="amount"
                            nameKey="category"
                            cx="50%"
                            cy="50%"
                            innerRadius={45}
                            outerRadius={70}
                            paddingAngle={3}
                          >
                            {categoryBreakdown.map((_, index) => (
                              <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                            ))}
                          </Pie>
                          <Tooltip
                            formatter={(value: any) => [`₹${Number(value).toLocaleString("en-IN")}`, "Amount"]}
                            contentStyle={{ background: "#0f172a", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "8px", fontSize: "11px" }}
                          />
                        </PieChart>
                      </ResponsiveContainer>
                    )}
                  </div>

                  {/* Category Legend List */}
                  <div className="space-y-1.5 max-h-36 overflow-y-auto custom-scrollbar">
                    {categoryBreakdown.slice(0, 5).map((cat, idx) => (
                      <div key={idx} className="flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2 truncate">
                          <span
                            className="w-2.5 h-2.5 rounded-full shrink-0"
                            style={{ backgroundColor: PIE_COLORS[idx % PIE_COLORS.length] }}
                          />
                          <span className="text-slate-700 dark:text-slate-300 truncate">{cat.category}</span>
                        </div>
                        <span className="font-semibold text-slate-900 dark:text-white tabular-nums shrink-0">
                          ₹{cat.amount.toLocaleString("en-IN")} ({cat.percentage}%)
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Purchases vs Misc Split bar */}
              <div className="card p-3.5 sm:p-5 space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 sm:gap-2 text-xs">
                  <span className="font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                    Spending Allocation Ratio
                  </span>
                  <span className="text-slate-500">
                    Purchases: ₹{(summary?.purchasesOutflow || 0).toLocaleString("en-IN")} vs Misc: ₹{(summary?.miscOutflow || 0).toLocaleString("en-IN")}
                  </span>
                </div>
                <div className="w-full h-3 bg-slate-200 dark:bg-pitch-800 rounded-full overflow-hidden flex">
                  <div
                    className="h-full bg-volt-400"
                    style={{ width: `${reportData?.purchasesVsMisc.purchasesPercent || 50}%` }}
                    title={`Stock Purchases: ${reportData?.purchasesVsMisc.purchasesPercent || 0}%`}
                  />
                  <div
                    className="h-full bg-sky-400"
                    style={{ width: `${reportData?.purchasesVsMisc.miscPercent || 50}%` }}
                    title={`Misc Expenses: ${reportData?.purchasesVsMisc.miscPercent || 0}%`}
                  />
                </div>
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-1 text-[11px] text-slate-500">
                  <div className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-volt-400" />
                    <span>Inventory Purchases ({reportData?.purchasesVsMisc.purchasesPercent || 0}%)</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-sky-400" />
                    <span>Operational & Misc Expenses ({reportData?.purchasesVsMisc.miscPercent || 0}%)</span>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* ─── TAB 2: PURCHASES & RESTOCKS ──────────────────────────────────────── */}
      {activeTab === "purchases" && (
        <div className="space-y-4">
          <div className="bg-volt-400/10 dark:bg-volt-400/10 border border-volt-400/20 rounded-xl p-3.5 sm:p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-volt-500 shrink-0" /> Verified Purchases Convert Into Inventory Stocks
              </h3>
              <p className="text-xs text-slate-600 dark:text-slate-300 mt-0.5">
                Purchases recorded with status "Pending" can be inspected and verified. Once verified, stock quantity is automatically incremented in your inventory.
              </p>
            </div>
            <Button
              variant="primary"
              onClick={() => {
                setRestockItem(null);
                setIsAddPurchaseOpen(true);
              }}
              className="w-full sm:w-auto justify-center text-xs py-1.5 px-3 shrink-0"
            >
              <Plus size={14} /> Add Purchase
            </Button>
          </div>

          {/* Filters & Search */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 sm:gap-3">
            <div className="flex items-center gap-2 overflow-x-auto no-scrollbar w-full sm:w-auto pb-0.5 sm:pb-0">
              <span className="text-xs text-slate-500 shrink-0">Status:</span>
              <div className="flex rounded-lg border border-slate-200 dark:border-white/10 bg-white dark:bg-pitch-800 p-0.5 text-xs shrink-0">
                {["all", "pending", "verified", "rejected"].map((s) => (
                  <button
                    key={s}
                    onClick={() => setPurchasesFilter(s)}
                    className={`px-2.5 py-1 rounded capitalize font-medium whitespace-nowrap ${
                      purchasesFilter === s
                        ? "bg-volt-400 text-slate-950 font-bold"
                        : "text-slate-500 hover:text-slate-900 dark:hover:text-white"
                    }`}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>

            <div className="w-full sm:w-64">
              <Input
                placeholder="Search item, invoice..."
                value={purchasesSearch}
                onChange={(e) => setPurchasesSearch(e.target.value)}
                className="text-xs py-1.5"
              />
            </div>
          </div>

          {/* Purchases Content */}
          {isPurchasesLoading ? (
            <div className="py-12 flex justify-center">
              <Spinner size="lg" />
            </div>
          ) : !purchasesData?.expenses || purchasesData.expenses.length === 0 ? (
            <EmptyState
              icon={<ShoppingCart className="w-8 h-8 text-slate-400" />}
              title="No Purchases Recorded"
              description="Record purchases of balls, cones, bibs, medical supplies or kits."
              action={
                <Button
                  variant="primary"
                  onClick={() => {
                    setRestockItem(null);
                    setIsAddPurchaseOpen(true);
                  }}
                  className="text-xs"
                >
                  Add First Purchase
                </Button>
              }
            />
          ) : (
            <>
              {/* Mobile View: Cards */}
              <div className="block lg:hidden space-y-3">
                {purchasesData.expenses.map((p) => {
                  const isPending = p.verificationStatus === "pending";
                  const isVerified = p.verificationStatus === "verified";
                  return (
                    <div
                      key={p.id || p._id}
                      className="card p-3.5 space-y-2.5 transition-colors border border-slate-200 dark:border-white/5"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <h4 className="font-bold text-sm text-slate-900 dark:text-white truncate">
                            {p.itemName}
                          </h4>
                          {p.stockItemId && (
                            <span className="text-[10px] text-field-500 font-normal block truncate">
                              Linked to Stock: {p.stockItemId.name}
                            </span>
                          )}
                          <div className="flex items-center gap-2 text-[11px] text-slate-500 mt-0.5">
                            <span>{p.category}</span>
                            <span>•</span>
                            <span className="font-mono">{format(new Date(p.date), "dd MMM yyyy")}</span>
                          </div>
                        </div>
                        <div className="shrink-0">
                          {isVerified && (
                            <Badge variant="green" className="text-[10px]">
                              Verified
                            </Badge>
                          )}
                          {isPending && (
                            <Badge variant="yellow" className="text-[10px]">
                              Pending
                            </Badge>
                          )}
                          {p.verificationStatus === "rejected" && (
                            <Badge variant="red" className="text-[10px]">
                              Rejected
                            </Badge>
                          )}
                        </div>
                      </div>

                      <div className="grid grid-cols-3 gap-2 p-2 bg-slate-50 dark:bg-pitch-900/60 rounded-lg text-xs">
                        <div>
                          <span className="text-[10px] text-slate-400 block uppercase">Qty</span>
                          <span className="font-bold text-slate-900 dark:text-white tabular-nums">
                            {p.quantity} {p.unit}
                          </span>
                        </div>
                        <div>
                          <span className="text-[10px] text-slate-400 block uppercase">Unit Cost</span>
                          <span className="text-slate-600 dark:text-slate-300 tabular-nums">
                            ₹{(p.unitPrice || 0).toLocaleString("en-IN")}
                          </span>
                        </div>
                        <div>
                          <span className="text-[10px] text-slate-400 block uppercase">Total</span>
                          <span className="font-extrabold text-volt-500 tabular-nums">
                            ₹{p.amount.toLocaleString("en-IN")}
                          </span>
                        </div>
                      </div>

                      {p.invoiceNumber && (
                        <div className="text-[11px] text-slate-500 font-mono truncate">
                          Bill / Invoice:{" "}
                          <span className="text-slate-700 dark:text-slate-300 font-semibold">{p.invoiceNumber}</span>
                        </div>
                      )}

                      <div className="flex items-center justify-between pt-1 border-t border-slate-100 dark:border-white/5 gap-2">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {isPending && (
                            <>
                              <Button
                                variant="primary"
                                onClick={() => handleVerify(p.id || p._id!)}
                                disabled={isVerifying}
                                className="text-[11px] py-1 px-2.5 bg-field-500 hover:bg-field-600 text-slate-950 font-bold border-none"
                              >
                                Verify into Stock
                              </Button>
                              <Button
                                variant="ghost"
                                onClick={() => handleReject(p.id || p._id!)}
                                className="text-[11px] py-1 px-2 text-rose-500 hover:bg-rose-500/10"
                              >
                                Reject
                              </Button>
                            </>
                          )}
                        </div>
                        <button
                          onClick={() => handleDeleteExpense(p.id || p._id!)}
                          className="p-1 text-slate-400 hover:text-rose-500 transition-colors shrink-0 ml-auto"
                          title="Delete record"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Desktop / Tablet View: Table */}
              <div className="card overflow-hidden hidden lg:block">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-100 dark:bg-pitch-800 text-slate-600 dark:text-slate-400 uppercase text-[10px] tracking-wider border-b border-slate-200 dark:border-white/5 font-semibold">
                      <tr>
                        <th className="px-4 py-3">Date</th>
                        <th className="px-4 py-3">Item Name</th>
                        <th className="px-4 py-3">Category</th>
                        <th className="px-4 py-3 text-right">Quantity</th>
                        <th className="px-4 py-3 text-right">Unit Price</th>
                        <th className="px-4 py-3 text-right">Total Amount</th>
                        <th className="px-4 py-3">Invoice / Bill No.</th>
                        <th className="px-4 py-3">Status</th>
                        <th className="px-4 py-3 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                      {purchasesData.expenses.map((p) => {
                        const isPending = p.verificationStatus === "pending";
                        const isVerified = p.verificationStatus === "verified";
                        return (
                          <tr key={p.id || p._id} className="hover:bg-slate-50 dark:hover:bg-pitch-800/40 transition-colors">
                            <td className="px-4 py-3 tabular-nums font-mono text-[11px] text-slate-500">
                              {format(new Date(p.date), "dd MMM yyyy")}
                            </td>
                            <td className="px-4 py-3 font-semibold text-slate-900 dark:text-white">
                              {p.itemName}
                              {p.stockItemId && (
                                <span className="block text-[10px] text-field-500 font-normal">
                                  Linked to Stock: {p.stockItemId.name}
                                </span>
                              )}
                            </td>
                            <td className="px-4 py-3 text-slate-500">{p.category}</td>
                            <td className="px-4 py-3 text-right font-bold tabular-nums">
                              {p.quantity} {p.unit}
                            </td>
                            <td className="px-4 py-3 text-right tabular-nums text-slate-500">
                              ₹{(p.unitPrice || 0).toLocaleString("en-IN")}
                            </td>
                            <td className="px-4 py-3 text-right font-extrabold text-volt-500 tabular-nums">
                              ₹{p.amount.toLocaleString("en-IN")}
                            </td>
                            <td className="px-4 py-3">
                              {p.invoiceNumber ? (
                                <span className="font-mono text-xs text-slate-800 dark:text-slate-200 block truncate max-w-[150px]">
                                  {p.invoiceNumber}
                                </span>
                              ) : (
                                <span className="text-slate-400">—</span>
                              )}
                            </td>
                            <td className="px-4 py-3">
                              {isVerified && (
                                <Badge variant="green" className="text-[10px]">
                                  Verified (In Stock)
                                </Badge>
                              )}
                              {isPending && (
                                <Badge variant="yellow" className="text-[10px]">
                                  Pending Review
                                </Badge>
                              )}
                              {p.verificationStatus === "rejected" && (
                                <Badge variant="red" className="text-[10px]">
                                  Rejected
                                </Badge>
                              )}
                            </td>
                            <td className="px-4 py-3 text-right space-x-1 whitespace-nowrap">
                              {isPending && (
                                <>
                                  <Button
                                    variant="primary"
                                    onClick={() => handleVerify(p.id || p._id!)}
                                    disabled={isVerifying}
                                    className="text-[11px] py-1 px-2.5 bg-field-500 hover:bg-field-600 text-slate-950 font-bold border-none"
                                  >
                                    Verify into Stock
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    onClick={() => handleReject(p.id || p._id!)}
                                    className="text-[11px] py-1 px-2 text-rose-500 hover:bg-rose-500/10"
                                  >
                                    Reject
                                  </Button>
                                </>
                              )}
                              <button
                                onClick={() => handleDeleteExpense(p.id || p._id!)}
                                className="p-1 text-slate-400 hover:text-rose-500 transition-colors inline-block"
                                title="Delete record"
                              >
                                <Trash2 size={14} />
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* ─── TAB 3: STOCKS & INVENTORY ────────────────────────────────────────── */}
      {activeTab === "stocks" && (
        <div className="space-y-4">
          {/* Top Inventory Stat Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3">
            <div className="card p-2.5 sm:p-3">
              <span className="text-[11px] sm:text-xs text-slate-500 block truncate">Total Items Cataloged</span>
              <p className="text-lg sm:text-xl font-bold text-slate-900 dark:text-white tabular-nums">
                {stocksData?.summary.totalItems || 0}
              </p>
            </div>
            <div className="card p-2.5 sm:p-3">
              <span className="text-[11px] sm:text-xs text-slate-500 block truncate">In Stock</span>
              <p className="text-lg sm:text-xl font-bold text-field-500 tabular-nums">
                {stocksData?.summary.inStockCount || 0}
              </p>
            </div>
            <div className="card p-2.5 sm:p-3">
              <span className="text-[11px] sm:text-xs text-slate-500 block truncate">Low Stock Alert</span>
              <p className="text-lg sm:text-xl font-bold text-amber-500 tabular-nums">
                {stocksData?.summary.lowStockCount || 0}
              </p>
            </div>
            <div className="card p-2.5 sm:p-3">
              <span className="text-[11px] sm:text-xs text-slate-500 block truncate">Total Valuation</span>
              <p className="text-lg sm:text-xl font-bold text-ice-400 tabular-nums truncate">
                ₹{(stocksData?.summary.totalInventoryValuation || 0).toLocaleString("en-IN")}
              </p>
            </div>
          </div>

          {/* Filters & Actions Bar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 sm:gap-3">
            <div className="flex items-center gap-2 overflow-x-auto no-scrollbar w-full sm:w-auto pb-0.5 sm:pb-0">
              <span className="text-xs text-slate-500 shrink-0">Filter:</span>
              <div className="flex rounded-lg border border-slate-200 dark:border-white/10 bg-white dark:bg-pitch-800 p-0.5 text-xs shrink-0">
                {["all", "in_stock", "low_stock", "out_of_stock"].map((st) => (
                  <button
                    key={st}
                    onClick={() => setStocksFilter(st)}
                    className={`px-2.5 py-1 rounded capitalize font-medium whitespace-nowrap ${
                      stocksFilter === st
                        ? "bg-volt-400 text-slate-950 font-bold"
                        : "text-slate-500 hover:text-slate-900 dark:hover:text-white"
                    }`}
                  >
                    {st.replace("_", " ")}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex flex-col xs:flex-row items-stretch xs:items-center gap-2 w-full sm:w-auto">
              <Input
                placeholder="Search inventory items..."
                value={stocksSearch}
                onChange={(e) => setStocksSearch(e.target.value)}
                className="text-xs py-1.5 w-full sm:w-64"
              />
              <Button
                variant="primary"
                onClick={() => setIsAddStockOpen(true)}
                className="w-full xs:w-auto justify-center text-xs py-1.5 px-3 whitespace-nowrap shrink-0"
              >
                <Plus size={14} /> New Stock Item
              </Button>
            </div>
          </div>

          {/* Stocks Content */}
          {isStocksLoading ? (
            <div className="py-12 flex justify-center">
              <Spinner size="lg" />
            </div>
          ) : !stocksData?.items || stocksData.items.length === 0 ? (
            <EmptyState
              icon={<Boxes className="w-8 h-8 text-slate-400" />}
              title="No Stock Items Found"
              description="Add verified purchases to automatically create stocks, or create a new stock item directly."
              action={
                <Button variant="primary" onClick={() => setIsAddStockOpen(true)} className="text-xs">
                  Create Stock Item
                </Button>
              }
            />
          ) : (
            <>
              {/* Mobile View: Cards */}
              <div className="block lg:hidden space-y-3">
                {stocksData.items.map((item) => {
                  const isStockout = item.quantity <= 0;
                  const isLowStock = item.status === "low_stock";
                  return (
                    <div
                      key={item.id || item._id}
                      className={`card p-3.5 space-y-3 border transition-colors ${
                        isStockout
                          ? "border-rose-500/30 bg-rose-500/5"
                          : "border-slate-200 dark:border-white/5"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <h4 className="font-bold text-sm text-slate-900 dark:text-white truncate">
                            {item.name}
                          </h4>
                          <div className="flex items-center gap-2 text-[11px] text-slate-500 mt-0.5">
                            <span>{item.category}</span>
                            {item.sku && (
                              <>
                                <span>•</span>
                                <span className="font-mono">SKU: {item.sku}</span>
                              </>
                            )}
                          </div>
                        </div>
                        <div className="shrink-0">
                          {isStockout && (
                            <Badge variant="red" className="text-[10px] font-bold">
                              STOCKOUT
                            </Badge>
                          )}
                          {isLowStock && (
                            <Badge variant="yellow" className="text-[10px]">
                              Low Stock
                            </Badge>
                          )}
                          {item.status === "in_stock" && (
                            <Badge variant="green" className="text-[10px]">
                              In Stock
                            </Badge>
                          )}
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-2 p-2.5 bg-slate-50 dark:bg-pitch-900/60 rounded-lg text-xs">
                        <div>
                          <span className="text-[10px] text-slate-400 block uppercase">Available Stock</span>
                          <span
                            className={`text-base font-extrabold tabular-nums ${
                              isStockout
                                ? "text-rose-500"
                                : isLowStock
                                ? "text-amber-500"
                                : "text-field-500"
                            }`}
                          >
                            {item.quantity} {item.unit}
                          </span>
                          <span className="block text-[10px] text-slate-400">
                            Alert at ≤ {item.minQuantityAlert}
                          </span>
                        </div>
                        <div>
                          <span className="text-[10px] text-slate-400 block uppercase">Valuation</span>
                          <span className="text-base font-bold text-slate-900 dark:text-white tabular-nums block">
                            ₹{(item.totalValue || 0).toLocaleString("en-IN")}
                          </span>
                          <span className="text-[10px] text-slate-500 tabular-nums">
                            @ ₹{(item.unitPrice || 0).toLocaleString("en-IN")}/{item.unit}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center justify-between text-[11px] text-slate-500">
                        <span>Location:</span>
                        <span className="font-medium text-slate-700 dark:text-slate-300">
                          {item.location || "General Storage"}
                        </span>
                      </div>

                      <div className="flex flex-wrap items-center justify-between gap-1.5 pt-2 border-t border-slate-100 dark:border-white/5">
                        <Button
                          variant="primary"
                          onClick={() => handleOpenRestock(item)}
                          className={`text-xs py-1 px-2.5 font-bold flex-1 sm:flex-initial justify-center ${
                            isStockout
                              ? "bg-rose-500 hover:bg-rose-600 text-white border-none animate-pulse"
                              : isLowStock
                              ? "bg-amber-500 hover:bg-amber-600 text-slate-950 border-none"
                              : "bg-volt-400 text-slate-950"
                          }`}
                          title="Add purchase to restock this item"
                        >
                          + Restock via Purchase
                        </Button>

                        <div className="flex items-center gap-1">
                          <Button
                            variant="secondary"
                            onClick={() => setIssueStockItem(item)}
                            disabled={isStockout}
                            className="text-xs py-1 px-2.5"
                            title="Hand out or consume stock"
                          >
                            Issue
                          </Button>

                          <Button
                            variant="ghost"
                            onClick={() => setAdjustStockItem(item)}
                            className="text-xs py-1 px-2 text-slate-400 hover:text-slate-900 dark:hover:text-white"
                            title="Audit count adjustment"
                          >
                            <SlidersHorizontal size={13} />
                          </Button>

                          <Button
                            variant="ghost"
                            onClick={() => setHistoryStockItemId(item.id || item._id!)}
                            className="text-xs py-1 px-2 text-slate-400 hover:text-slate-900 dark:hover:text-white"
                            title="View stock history trail"
                          >
                            <History size={13} />
                          </Button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Desktop / Tablet View: Table */}
              <div className="card overflow-hidden hidden lg:block">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-100 dark:bg-pitch-800 text-slate-600 dark:text-slate-400 uppercase text-[10px] tracking-wider border-b border-slate-200 dark:border-white/5 font-semibold">
                      <tr>
                        <th className="px-4 py-3">Item Details</th>
                        <th className="px-4 py-3">Category</th>
                        <th className="px-4 py-3 text-right">Available Stock</th>
                        <th className="px-4 py-3 text-right">Est. Unit Price</th>
                        <th className="px-4 py-3 text-right">Total Value</th>
                        <th className="px-4 py-3">Storage Location</th>
                        <th className="px-4 py-3">Stock Status</th>
                        <th className="px-4 py-3 text-right">Inventory Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                      {stocksData.items.map((item) => {
                        const isStockout = item.quantity <= 0;
                        const isLowStock = item.status === "low_stock";
                        return (
                          <tr
                            key={item.id || item._id}
                            className={`hover:bg-slate-50 dark:hover:bg-pitch-800/40 transition-colors ${
                              isStockout ? "bg-rose-500/5" : ""
                            }`}
                          >
                            <td className="px-4 py-3">
                              <span className="font-bold text-slate-900 dark:text-white block">
                                {item.name}
                              </span>
                              {item.sku && (
                                <span className="text-[10px] font-mono text-slate-400">
                                  SKU: {item.sku}
                                </span>
                              )}
                            </td>
                            <td className="px-4 py-3 text-slate-500">{item.category}</td>
                            <td className="px-4 py-3 text-right">
                              <span
                                className={`text-sm font-extrabold tabular-nums ${
                                  isStockout
                                    ? "text-rose-500"
                                    : isLowStock
                                    ? "text-amber-500"
                                    : "text-field-500"
                                }`}
                              >
                                {item.quantity} {item.unit}
                              </span>
                              <span className="block text-[10px] text-slate-400">
                                Alert at ≤ {item.minQuantityAlert}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-right tabular-nums text-slate-500">
                              ₹{(item.unitPrice || 0).toLocaleString("en-IN")}
                            </td>
                            <td className="px-4 py-3 text-right font-bold text-slate-900 dark:text-white tabular-nums">
                              ₹{(item.totalValue || 0).toLocaleString("en-IN")}
                            </td>
                            <td className="px-4 py-3 text-slate-500">{item.location || "General Storage"}</td>
                            <td className="px-4 py-3">
                              {isStockout && (
                                <Badge variant="red" className="text-[10px] font-bold">
                                  STOCKOUT
                                </Badge>
                              )}
                              {isLowStock && (
                                <Badge variant="yellow" className="text-[10px]">
                                  Low Stock
                                </Badge>
                              )}
                              {item.status === "in_stock" && (
                                <Badge variant="green" className="text-[10px]">
                                  In Stock
                                </Badge>
                              )}
                            </td>
                            <td className="px-4 py-3 text-right space-x-1.5 whitespace-nowrap">
                              {/* Key requirement: Restock when out of stock by adding a purchase */}
                              <Button
                                variant="primary"
                                onClick={() => handleOpenRestock(item)}
                                className={`text-[11px] py-1 px-2.5 font-bold ${
                                  isStockout
                                    ? "bg-rose-500 hover:bg-rose-600 text-white border-none animate-pulse"
                                    : isLowStock
                                    ? "bg-amber-500 hover:bg-amber-600 text-slate-950 border-none"
                                    : "bg-volt-400 text-slate-950"
                                }`}
                                title="Add purchase to restock this item"
                              >
                                + Restock via Purchase
                              </Button>

                              <Button
                                variant="secondary"
                                onClick={() => setIssueStockItem(item)}
                                disabled={isStockout}
                                className="text-[11px] py-1 px-2"
                                title="Hand out or consume stock"
                              >
                                Issue
                              </Button>

                              <Button
                                variant="ghost"
                                onClick={() => setAdjustStockItem(item)}
                                className="text-[11px] py-1 px-1.5 text-slate-400 hover:text-slate-900 dark:hover:text-white"
                                title="Audit count adjustment"
                              >
                                <SlidersHorizontal size={13} />
                              </Button>

                              <Button
                                variant="ghost"
                                onClick={() => setHistoryStockItemId(item.id || item._id!)}
                                className="text-[11px] py-1 px-1.5 text-slate-400 hover:text-slate-900 dark:hover:text-white"
                                title="View stock history trail"
                              >
                                <History size={13} />
                              </Button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* ─── TAB 4: MISCELLANEOUS EXPENSES (NO STOCKS) ─────────────────────────── */}
      {activeTab === "misc" && (
        <div className="space-y-4">
          <div className="bg-amber-400/10 dark:bg-amber-400/10 border border-amber-400/20 rounded-xl p-3.5 sm:p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Receipt className="w-4 h-4 text-amber-500 shrink-0" /> Operational Miscellaneous Expenses
              </h3>
              <p className="text-xs text-slate-600 dark:text-slate-300 mt-0.5">
                Record routine running costs like pitch grass maintenance, electric utility bills, referee refreshments, bus travel, and marketing. These do NOT produce physical stocks.
              </p>
            </div>
            <Button
              variant="primary"
              onClick={() => setIsAddMiscOpen(true)}
              className="w-full sm:w-auto justify-center text-xs py-1.5 px-3 shrink-0"
            >
              <Plus size={14} /> Add Misc Expense
            </Button>
          </div>

          <div className="flex justify-end w-full">
            <div className="w-full sm:w-64">
              <Input
                placeholder="Search expense description, vendor..."
                value={miscSearch}
                onChange={(e) => setMiscSearch(e.target.value)}
                className="text-xs py-1.5 w-full"
              />
            </div>
          </div>

          {isMiscLoading ? (
            <div className="py-12 flex justify-center">
              <Spinner size="lg" />
            </div>
          ) : !miscData?.expenses || miscData.expenses.length === 0 ? (
            <EmptyState
              icon={<Receipt className="w-8 h-8 text-slate-400" />}
              title="No Miscellaneous Expenses"
              description="Record electricity bills, maintenance, travel, refreshments, and staff costs."
              action={
                <Button variant="primary" onClick={() => setIsAddMiscOpen(true)} className="text-xs">
                  Add First Misc Expense
                </Button>
              }
            />
          ) : (
            <>
              {/* Mobile View: Cards */}
              <div className="block lg:hidden space-y-3">
                {miscData.expenses.map((exp) => (
                  <div
                    key={exp.id || exp._id}
                    className="card p-3.5 space-y-2.5 border border-slate-200 dark:border-white/5"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <h4 className="font-bold text-sm text-slate-900 dark:text-white truncate">
                          {exp.title}
                        </h4>
                        {exp.notes && (
                          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 line-clamp-2">
                            {exp.notes}
                          </p>
                        )}
                        <div className="flex items-center gap-2 text-[11px] text-slate-500 mt-1">
                          <span className="font-medium text-slate-700 dark:text-slate-300">{exp.category}</span>
                          <span>•</span>
                          <span className="font-mono">{format(new Date(exp.date), "dd MMM yyyy")}</span>
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <span className="text-base font-extrabold text-rose-500 tabular-nums block">
                          ₹{exp.amount.toLocaleString("en-IN")}
                        </span>
                        <span className="text-[10px] text-slate-400 capitalize block">
                          {exp.paymentMethod.replace("_", " ")}
                        </span>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center justify-between text-xs pt-2 border-t border-slate-100 dark:border-white/5 gap-1.5 text-slate-500">
                      <div className="flex items-center gap-2 text-[11px]">
                        <span>Vendor: <strong className="text-slate-700 dark:text-slate-300">{exp.vendor || "—"}</strong></span>
                        {exp.invoiceNumber && (
                          <span>| Bill: <span className="font-mono text-slate-600 dark:text-slate-300">{exp.invoiceNumber}</span></span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 ml-auto">
                        <span className="text-[10px] text-slate-400">By {exp.createdByName}</span>
                        <button
                          onClick={() => handleDeleteExpense(exp.id || exp._id!)}
                          className="p-1 text-slate-400 hover:text-rose-500 transition-colors"
                          title="Delete expense"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Desktop / Tablet View: Table */}
              <div className="card overflow-hidden hidden lg:block">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-100 dark:bg-pitch-800 text-slate-600 dark:text-slate-400 uppercase text-[10px] tracking-wider border-b border-slate-200 dark:border-white/5 font-semibold">
                      <tr>
                        <th className="px-4 py-3">Date</th>
                        <th className="px-4 py-3">Expense Title / Description</th>
                        <th className="px-4 py-3">Category</th>
                        <th className="px-4 py-3 text-right">Amount (₹)</th>
                        <th className="px-4 py-3">Paid To / Vendor</th>
                        <th className="px-4 py-3">Payment Mode</th>
                        <th className="px-4 py-3">Reference / Bill</th>
                        <th className="px-4 py-3">Logged By</th>
                        <th className="px-4 py-3 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                      {miscData.expenses.map((exp) => (
                        <tr key={exp.id || exp._id} className="hover:bg-slate-50 dark:hover:bg-pitch-800/40 transition-colors">
                          <td className="px-4 py-3 tabular-nums font-mono text-[11px] text-slate-500">
                            {format(new Date(exp.date), "dd MMM yyyy")}
                          </td>
                          <td className="px-4 py-3 font-semibold text-slate-900 dark:text-white">
                            {exp.title}
                            {exp.notes && (
                              <span className="block text-[11px] text-slate-400 font-normal truncate max-w-xs">
                                {exp.notes}
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-slate-500">{exp.category}</td>
                          <td className="px-4 py-3 text-right font-extrabold text-rose-500 tabular-nums">
                            ₹{exp.amount.toLocaleString("en-IN")}
                          </td>
                          <td className="px-4 py-3 text-slate-700 dark:text-slate-300">{exp.vendor || "—"}</td>
                          <td className="px-4 py-3 capitalize text-slate-500">{exp.paymentMethod.replace("_", " ")}</td>
                          <td className="px-4 py-3 font-mono text-[11px] text-slate-400">{exp.invoiceNumber || "—"}</td>
                          <td className="px-4 py-3 text-[11px] text-slate-400">{exp.createdByName}</td>
                          <td className="px-4 py-3 text-right">
                            <button
                              onClick={() => handleDeleteExpense(exp.id || exp._id!)}
                              className="p-1 text-slate-400 hover:text-rose-500 transition-colors inline-block"
                              title="Delete expense"
                            >
                              <Trash2 size={14} />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* ─── TAB 5: INCOMING FUNDS (FEES & OTHER INCOMES) ───────────────────────── */}
      {activeTab === "inflows" && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
            <StatCard
              label="Total Funds Inflow"
              value={`₹${(summary?.totalInflow || 0).toLocaleString("en-IN")}`}
              sublabel="Student Fees + External Incomes"
              icon={<ArrowDownLeft size={22} />}
              accent="field"
            />
            <StatCard
              label="Student Fees Collected"
              value={`₹${(summary?.feesInflow || 0).toLocaleString("en-IN")}`}
              sublabel="Aggregated from paid fee installments"
              icon={<Receipt size={22} />}
              accent="ice"
            />
            <StatCard
              label="Additional Incomes"
              value={`₹${(summary?.otherInflow || 0).toLocaleString("en-IN")}`}
              sublabel="Sponsorships, pitch rentals & events"
              icon={<TrendingUp size={22} />}
              accent="volt"
            />
          </div>

          {/* Additional Incomes Section */}
          <div className="card p-3.5 sm:p-5 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider font-display">
                  Additional External Incomes
                </h3>
                <p className="text-xs text-slate-500">Sponsorship deals, tournament entry fees, merchandise cash</p>
              </div>
              <Button
                variant="primary"
                onClick={() => setIsRecordIncomeOpen(true)}
                className="w-full sm:w-auto justify-center text-xs py-1.5 px-3 shrink-0"
              >
                <Plus size={14} /> Record Income
              </Button>
            </div>

            {(!incomesData || incomesData.length === 0) ? (
              <p className="text-xs text-slate-400 italic py-4 text-center">
                No external incomes logged yet. Student fee collections are displayed below.
              </p>
            ) : (
              <>
                {/* Mobile View: Cards */}
                <div className="block lg:hidden space-y-2.5">
                  {incomesData.map((inc) => (
                    <div
                      key={inc.id || inc._id}
                      className="p-3 bg-slate-50 dark:bg-pitch-900/60 rounded-xl border border-slate-200 dark:border-white/5 space-y-2 text-xs"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <span className="font-bold text-slate-900 dark:text-white block text-sm">{inc.source}</span>
                          <span className="text-[11px] text-slate-500">{inc.category} • {format(new Date(inc.date), "dd MMM yyyy")}</span>
                        </div>
                        <span className="text-base font-extrabold text-field-500 tabular-nums shrink-0">
                          ₹{inc.amount.toLocaleString("en-IN")}
                        </span>
                      </div>
                      <div className="flex flex-wrap items-center justify-between text-[11px] text-slate-500 pt-1.5 border-t border-slate-200 dark:border-white/5 gap-1">
                        <div>
                          Payer: <strong className="text-slate-700 dark:text-slate-300">{inc.payerName || "—"}</strong> ({inc.paymentMethod})
                        </div>
                        <button
                          onClick={() => handleDeleteIncome(inc.id || inc._id!)}
                          className="p-1 text-slate-400 hover:text-rose-500 transition-colors ml-auto"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Desktop View: Table */}
                <div className="overflow-x-auto hidden lg:block">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-100 dark:bg-pitch-800 text-slate-600 dark:text-slate-400 uppercase text-[10px] tracking-wider border-b border-slate-200 dark:border-white/5 font-semibold">
                      <tr>
                        <th className="px-4 py-2.5">Date</th>
                        <th className="px-4 py-2.5">Source / Purpose</th>
                        <th className="px-4 py-2.5">Category</th>
                        <th className="px-4 py-2.5 text-right">Amount (₹)</th>
                        <th className="px-4 py-2.5">Payer / Partner</th>
                        <th className="px-4 py-2.5">Payment Mode</th>
                        <th className="px-4 py-2.5">Ref No</th>
                        <th className="px-4 py-2.5 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                      {incomesData.map((inc) => (
                        <tr key={inc.id || inc._id} className="hover:bg-slate-50 dark:hover:bg-pitch-800/40">
                          <td className="px-4 py-2.5 tabular-nums text-slate-500">
                            {format(new Date(inc.date), "dd MMM yyyy")}
                          </td>
                          <td className="px-4 py-2.5 font-semibold text-slate-900 dark:text-white">{inc.source}</td>
                          <td className="px-4 py-2.5 text-slate-500">{inc.category}</td>
                          <td className="px-4 py-2.5 text-right font-extrabold text-field-500 tabular-nums">
                            ₹{inc.amount.toLocaleString("en-IN")}
                          </td>
                          <td className="px-4 py-2.5 text-slate-700 dark:text-slate-300">{inc.payerName || "—"}</td>
                          <td className="px-4 py-2.5 capitalize text-slate-500">{inc.paymentMethod}</td>
                          <td className="px-4 py-2.5 font-mono text-[11px] text-slate-400">{inc.referenceNumber || "—"}</td>
                          <td className="px-4 py-2.5 text-right">
                            <button
                              onClick={() => handleDeleteIncome(inc.id || inc._id!)}
                              className="p-1 text-slate-400 hover:text-rose-500 transition-colors"
                            >
                              <Trash2 size={14} />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>

          {/* Paid Student Fees Inflow Ledger */}
          <div className="card p-3.5 sm:p-5 space-y-3">
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider font-display">
                Student Fee Collections in Selected Period ({reportData?.feeInflows.length || 0} Transactions)
              </h3>
              <p className="text-xs text-slate-500">Real-time payment records from enrolled students across installments</p>
            </div>

            {(!reportData?.feeInflows || reportData.feeInflows.length === 0) ? (
              <p className="text-xs text-slate-400 italic py-6 text-center">
                No fee payment installments collected in this timeframe.
              </p>
            ) : (
              <>
                {/* Mobile View: Cards */}
                <div className="block lg:hidden space-y-2.5">
                  {reportData.feeInflows.map((f, idx) => (
                    <div
                      key={f.id || idx}
                      className="p-3 bg-slate-50 dark:bg-pitch-900/60 rounded-xl border border-slate-200 dark:border-white/5 space-y-1.5 text-xs"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <span className="font-bold text-slate-900 dark:text-white text-sm block">{f.studentName}</span>
                          <span className="text-[11px] text-slate-500 capitalize">
                            {f.feeType.replace("_", " ")} • Installment #{f.installmentNumber}
                          </span>
                        </div>
                        <span className="text-base font-extrabold text-field-500 tabular-nums shrink-0">
                          ₹{f.amount.toLocaleString("en-IN")}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1 border-t border-slate-200 dark:border-white/5">
                        <span>Paid: {format(new Date(f.paidAt), "dd MMM yyyy")}</span>
                        <span>{f.paymentMethod || "Cash"}{f.transactionId ? ` • Ref: ${f.transactionId}` : ""}</span>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Desktop View: Table */}
                <div className="overflow-x-auto max-h-96 custom-scrollbar hidden lg:block">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-100 dark:bg-pitch-800 text-slate-600 dark:text-slate-400 uppercase text-[10px] tracking-wider border-b border-slate-200 dark:border-white/5 font-semibold sticky top-0 z-10">
                      <tr>
                        <th className="px-4 py-2.5">Date Paid</th>
                        <th className="px-4 py-2.5">Student Name</th>
                        <th className="px-4 py-2.5">Fee Type</th>
                        <th className="px-4 py-2.5">Installment</th>
                        <th className="px-4 py-2.5 text-right">Amount Paid</th>
                        <th className="px-4 py-2.5">Payment Method</th>
                        <th className="px-4 py-2.5">Transaction ID</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                      {reportData.feeInflows.map((f, idx) => (
                        <tr key={f.id || idx} className="hover:bg-slate-50 dark:hover:bg-pitch-800/40">
                          <td className="px-4 py-2.5 tabular-nums text-slate-500 font-mono text-[11px]">
                            {format(new Date(f.paidAt), "dd MMM yyyy")}
                          </td>
                          <td className="px-4 py-2.5 font-bold text-slate-900 dark:text-white">{f.studentName}</td>
                          <td className="px-4 py-2.5 text-slate-500 capitalize">{f.feeType.replace("_", " ")}</td>
                          <td className="px-4 py-2.5 text-slate-500">Installment #{f.installmentNumber}</td>
                          <td className="px-4 py-2.5 text-right font-extrabold text-field-500 tabular-nums">
                            ₹{f.amount.toLocaleString("en-IN")}
                          </td>
                          <td className="px-4 py-2.5 capitalize text-slate-500">{f.paymentMethod || "Cash"}</td>
                          <td className="px-4 py-2.5 font-mono text-[11px] text-slate-400">{f.transactionId || "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* ─── TAB 6: ADVANCED AUDIT REPORTS & STATEMENTS ───────────────────────── */}
      {activeTab === "reports" && (
        <div className="space-y-6">
          <div className="card p-3.5 sm:p-5 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-200 dark:border-white/5">
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white uppercase tracking-wide font-display">
                  Advanced Financial Audit & Accounting Statement
                </h3>
                <p className="text-xs text-slate-500">
                  Generate print-ready and spreadsheet-ready financial statements by day, month, year, or lifetime.
                </p>
              </div>

              <div className="grid grid-cols-2 sm:flex sm:items-center gap-2 w-full sm:w-auto">
                <Button
                  variant="secondary"
                  onClick={() => setIsPrintReportOpen(true)}
                  className="w-full sm:w-auto justify-center text-xs py-2 px-3 flex items-center gap-1.5"
                >
                  <Printer size={14} /> Print View
                </Button>
                <Button
                  variant="primary"
                  onClick={() => setIsPrintReportOpen(true)}
                  className="w-full sm:w-auto justify-center text-xs py-2 px-3 flex items-center gap-1.5 shadow-md"
                >
                  <Download size={14} /> Export CSV
                </Button>
              </div>
            </div>

            {/* Timeframe selector controls */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 bg-slate-50 dark:bg-pitch-900/40 p-3 rounded-lg border border-slate-200 dark:border-white/5">
              <div>
                <Select
                  label="Report Timeframe"
                  value={timeframe}
                  onChange={(e) => setTimeframe(e.target.value as any)}
                >
                  <option value="day">Single Day Audit</option>
                  <option value="month">Monthly Statement</option>
                  <option value="year">Annual Financial Statement</option>
                  <option value="lifetime">Lifetime (All-Time Audit)</option>
                  <option value="custom">Custom Date Range</option>
                </Select>
              </div>

              {timeframe === "day" && (
                <div>
                  <label className="block text-[11px] font-semibold text-slate-500 uppercase mb-1">Select Day</label>
                  <Input type="date" value={reportDate} onChange={(e) => setReportDate(e.target.value)} className="text-xs" />
                </div>
              )}

              {timeframe === "month" && (
                <div>
                  <label className="block text-[11px] font-semibold text-slate-500 uppercase mb-1">Select Month</label>
                  <Input type="month" value={reportMonth} onChange={(e) => setReportMonth(e.target.value)} className="text-xs" />
                </div>
              )}

              {timeframe === "year" && (
                <div>
                  <label className="block text-[11px] font-semibold text-slate-500 uppercase mb-1">Select Year</label>
                  <Input type="number" min="2020" max="2035" value={reportYear} onChange={(e) => setReportYear(e.target.value)} className="text-xs" />
                </div>
              )}

              {timeframe === "custom" && (
                <>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-500 uppercase mb-1">From Date</label>
                    <Input type="date" value={customStart} onChange={(e) => setCustomStart(e.target.value)} className="text-xs" />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-500 uppercase mb-1">To Date</label>
                    <Input type="date" value={customEnd} onChange={(e) => setCustomEnd(e.target.value)} className="text-xs" />
                  </div>
                </>
              )}

              <div>
                <Select
                  label="Target Branch"
                  value={selectedFranchiseId}
                  onChange={(e) => setSelectedFranchiseId(e.target.value)}
                >
                  <option value="all">All Branches</option>
                  {franchises?.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.name}
                    </option>
                  ))}
                </Select>
              </div>
            </div>

            {/* Quick Summary Statement Table */}
            {summary && (
              <div className="border border-slate-200 dark:border-white/10 rounded-lg overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs divide-y divide-slate-200 dark:divide-white/10">
                    <thead className="bg-slate-100 dark:bg-pitch-800 text-slate-700 dark:text-slate-300 font-bold">
                      <tr>
                        <th className="px-4 py-2.5">Financial Metric</th>
                        <th className="px-4 py-2.5 text-right">Amount (INR)</th>
                        <th className="px-4 py-2.5">Accounting Significance</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                      <tr>
                        <td className="px-4 py-2.5 font-bold text-slate-900 dark:text-white">Total Gross Inflows</td>
                        <td className="px-4 py-2.5 text-right font-extrabold text-field-500 tabular-nums">
                          ₹{summary.totalInflow.toLocaleString("en-IN")}
                        </td>
                        <td className="px-4 py-2.5 text-slate-500">Student fees collected + sponsorships & external revenues</td>
                      </tr>
                      <tr>
                        <td className="px-4 py-2.5 font-bold text-slate-900 dark:text-white">Total Outflows (Expenses)</td>
                        <td className="px-4 py-2.5 text-right font-extrabold text-rose-500 tabular-nums">
                          ₹{summary.totalOutflow.toLocaleString("en-IN")}
                        </td>
                        <td className="px-4 py-2.5 text-slate-500">Verified purchases + pitch maintenance + operational bills</td>
                      </tr>
                      <tr className="bg-slate-50 dark:bg-pitch-900/50">
                        <td className="px-4 py-2.5 font-black text-slate-900 dark:text-white uppercase font-display">
                          Net Operating Balance
                        </td>
                        <td
                          className={`px-4 py-2.5 text-right font-black text-base tabular-nums ${
                            summary.netBalance >= 0 ? "text-field-500" : "text-rose-500"
                          }`}
                        >
                          {summary.netBalance >= 0 ? "+" : ""}₹{summary.netBalance.toLocaleString("en-IN")}
                        </td>
                        <td className="px-4 py-2.5 font-bold text-volt-500">
                          {summary.profitMargin}% Operating Margin ({summary.netBalance >= 0 ? "Surplus" : "Deficit"})
                        </td>
                      </tr>
                      <tr>
                        <td className="px-4 py-2.5 font-bold text-slate-900 dark:text-white">Active Stock Assets Valuation</td>
                        <td className="px-4 py-2.5 text-right font-extrabold text-sky-400 tabular-nums">
                          ₹{summary.totalInventoryValue.toLocaleString("en-IN")}
                        </td>
                        <td className="px-4 py-2.5 text-slate-500">Current market valuation of all physical equipment in inventory</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ─── Modals ───────────────────────────────────────────────────────────── */}
      <AddPurchaseModal
        isOpen={isAddPurchaseOpen}
        onClose={() => {
          setIsAddPurchaseOpen(false);
          setRestockItem(null);
        }}
        academyId={activeAcademyId}
        franchiseId={selectedFranchiseId !== "all" ? selectedFranchiseId : undefined}
        preselectedStockItem={restockItem}
        existingStocks={stocksData?.items || []}
      />

      <AddMiscExpenseModal
        isOpen={isAddMiscOpen}
        onClose={() => setIsAddMiscOpen(false)}
        academyId={activeAcademyId}
        franchiseId={selectedFranchiseId !== "all" ? selectedFranchiseId : undefined}
      />

      <AddStockItemModal
        isOpen={isAddStockOpen}
        onClose={() => setIsAddStockOpen(false)}
        academyId={activeAcademyId}
        franchiseId={selectedFranchiseId !== "all" ? selectedFranchiseId : undefined}
      />

      <IssueStockModal
        isOpen={!!issueStockItem}
        onClose={() => setIssueStockItem(null)}
        stockItem={issueStockItem}
      />

      <AdjustStockModal
        isOpen={!!adjustStockItem}
        onClose={() => setAdjustStockItem(null)}
        stockItem={adjustStockItem}
      />

      <StockHistoryModal
        isOpen={!!historyStockItemId}
        onClose={() => setHistoryStockItemId(null)}
        stockItemId={historyStockItemId}
      />

      <RecordIncomeModal
        isOpen={isRecordIncomeOpen}
        onClose={() => setIsRecordIncomeOpen(false)}
        academyId={activeAcademyId}
        franchiseId={selectedFranchiseId !== "all" ? selectedFranchiseId : undefined}
      />

      <PrintReportModal
        isOpen={isPrintReportOpen}
        onClose={() => setIsPrintReportOpen(false)}
        report={reportData || null}
        academyName={currentAcademy?.name || "Noxphere Football Academy"}
        franchiseName={activeFranchiseName}
      />
    </div>
  );
};

export default ExpenseManagementPage;

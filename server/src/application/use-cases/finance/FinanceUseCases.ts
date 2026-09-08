// src/application/use-cases/finance/FinanceUseCases.ts
import mongoose from "mongoose";
import { FeeModel } from "../../../infrastructure/database/models/Fee.model";
import { AcademyModel } from "../../../infrastructure/database/models/Academy.model";
import { FranchiseModel } from "../../../infrastructure/database/models/Franchise.model";
import { StudentModel } from "../../../infrastructure/database/models/Student.model";
import { AcademySubscriptionModel } from "../../../infrastructure/database/models/AcademySubscription.model";

function computeSubscriptionAmount(sub: {
  ratePerStudentPerDay: number;
  provisionedCapacity: number;
  billingInterval: "month" | "year";
  staffRatePerStaffPerMonth?: number;
  provisionedStaffCapacity?: number;
}): number {
  const days = sub.billingInterval === "year" ? 365 : 30;
  const months = sub.billingInterval === "year" ? 12 : 1;
  const studentTotal = (sub.ratePerStudentPerDay || 0) * (sub.provisionedCapacity || 0) * days;
  const staffTotal = (sub.staffRatePerStaffPerMonth || 0) * (sub.provisionedStaffCapacity || 0) * months;
  return round2(studentTotal + staffTotal);
}

// Fees, students, etc. are all scoped to a Franchise, not an Academy
// directly. When a caller filters by academyId (e.g. the super_admin
// Finance page), we resolve it to the set of franchise IDs under that
// academy first.
async function resolveFranchiseFilter(filters: { academyId?: string; franchiseId?: string }) {
  if (filters.franchiseId) return { franchiseId: new mongoose.Types.ObjectId(filters.franchiseId) };
  if (filters.academyId) {
    const franchises = await FranchiseModel.find({ academyId: filters.academyId }).select("_id");
    return { franchiseId: { $in: franchises.map((f) => f._id) } };
  }
  return {};
}

async function resolveSubscriptionAcademyFilter(filters: { academyId?: string; franchiseId?: string }) {
  if (filters.academyId) return { academyId: new mongoose.Types.ObjectId(filters.academyId) };
  if (filters.franchiseId) {
    const fr = await FranchiseModel.findById(filters.franchiseId).select("academyId");
    if (fr?.academyId) return { academyId: fr.academyId };
  }
  return {};
}

export class FinanceUseCases {
  async getOverview(filters: { from?: string; to?: string; academyId?: string; franchiseId?: string }) {
    const match: Record<string, unknown> = { ...(await resolveFranchiseFilter(filters)) };
    if (filters.from || filters.to) {
      match.createdAt = {
        ...(filters.from && { $gte: new Date(filters.from) }),
        ...(filters.to && { $lte: new Date(filters.to) }),
      };
    }

    const fees = await FeeModel.find(match);

    let totalRevenue = 0;
    let totalCollected = 0;
    let totalOutstanding = 0;
    let overdueCount = 0;
    let overdueAmount = 0;

    for (const fee of fees) {
      totalRevenue += fee.finalAmount;
      for (const inst of fee.installments) {
        totalCollected += inst.paidAmount;
        if (inst.status === "overdue") {
          overdueCount += 1;
          overdueAmount += inst.amount - inst.paidAmount;
        }
      }
    }

    // Incorporate active academy subscriptions
    const subMatch: Record<string, unknown> = {
      status: "active",
      ...(await resolveSubscriptionAcademyFilter(filters)),
    };
    if (filters.from || filters.to) {
      subMatch.updatedAt = {
        ...(filters.from && { $gte: new Date(filters.from) }),
        ...(filters.to && { $lte: new Date(filters.to) }),
      };
    }
    const subscriptions = await AcademySubscriptionModel.find(subMatch);
    for (const sub of subscriptions) {
      const amount = computeSubscriptionAmount(sub);
      totalRevenue += amount;
      totalCollected += amount;
    }

    totalOutstanding = totalRevenue - totalCollected;

    return {
      totalRevenue: round2(totalRevenue),
      totalCollected: round2(totalCollected),
      totalOutstanding: round2(totalOutstanding),
      overdueCount,
      overdueAmount: round2(overdueAmount),
      collectionRate: totalRevenue > 0 ? round2((totalCollected / totalRevenue) * 100) : 0,
      totalInvoices: fees.length + subscriptions.length,
    };
  }

  async getRevenueByMonth(filters: { academyId?: string; franchiseId?: string; months?: number }) {
    const months = filters.months ?? 6;
    const since = new Date();
    since.setMonth(since.getMonth() - (months - 1));
    since.setDate(1);
    since.setHours(0, 0, 0, 0);

    const match: Record<string, unknown> = {
      createdAt: { $gte: since },
      ...(await resolveFranchiseFilter(filters)),
    };

    const fees = await FeeModel.find(match);
    const buckets = new Map<string, { revenue: number; collected: number }>();

    // seed empty buckets so months with zero activity still render
    for (let i = 0; i < months; i++) {
      const d = new Date(since);
      d.setMonth(d.getMonth() + i);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      buckets.set(key, { revenue: 0, collected: 0 });
    }

    for (const fee of fees) {
      const d = fee.createdAt;
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      const bucket = buckets.get(key);
      if (!bucket) continue;
      bucket.revenue += fee.finalAmount;
      bucket.collected += fee.installments.reduce((s, i) => s + i.paidAmount, 0);
    }

    // Incorporate active subscriptions by month
    const subSinceMatch: Record<string, unknown> = {
      status: "active",
      updatedAt: { $gte: since },
      ...(await resolveSubscriptionAcademyFilter(filters)),
    };
    const subs = await AcademySubscriptionModel.find(subSinceMatch);
    for (const sub of subs) {
      const d = sub.updatedAt || sub.createdAt;
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      const bucket = buckets.get(key);
      if (!bucket) continue;
      const amount = computeSubscriptionAmount(sub);
      bucket.revenue += amount;
      bucket.collected += amount;
    }

    return Array.from(buckets.entries()).map(([month, v]) => ({
      month,
      revenue: round2(v.revenue),
      collected: round2(v.collected),
    }));
  }

  async getRevenueByAcademy() {
    const academies = await AcademyModel.find({ isActive: true }).lean();
    const results = await Promise.all(
      academies.map(async (a: any) => {
        const franchises = await FranchiseModel.find({ academyId: a._id }).select("_id");
        const franchiseIds = franchises.map((f) => f._id);
        const fees = franchiseIds.length
          ? await FeeModel.find({ franchiseId: { $in: franchiseIds } })
          : [];
        let revenue = fees.reduce((s, f) => s + f.finalAmount, 0);
        let collected = fees.reduce(
          (s, f) => s + f.installments.reduce((si, i) => si + i.paidAmount, 0),
          0,
        );

        // Add subscription revenue
        const activeSub = await AcademySubscriptionModel.findOne({ academyId: a._id, status: "active" });
        if (activeSub) {
          const subAmount = computeSubscriptionAmount(activeSub);
          revenue += subAmount;
          collected += subAmount;
        }

        const studentCount = franchiseIds.length
          ? await StudentModel.countDocuments({ franchiseId: { $in: franchiseIds }, isActive: true })
          : 0;
        return {
          academyId: a._id.toString(),
          academyName: a.name,
          franchiseCount: franchiseIds.length,
          revenue: round2(revenue),
          collected: round2(collected),
          outstanding: round2(revenue - collected),
          studentCount,
        };
      }),
    );
    return results.sort((a, b) => b.revenue - a.revenue);
  }

  async getOverdueInvoices(filters: { academyId?: string; franchiseId?: string; page?: number; limit?: number }) {
    const page = filters.page ?? 1;
    const limit = filters.limit ?? 20;
    const match: Record<string, unknown> = {
      overallStatus: "overdue",
      ...(await resolveFranchiseFilter(filters)),
    };

    const [fees, total] = await Promise.all([
      FeeModel.find(match)
        .populate("studentId", "firstName lastName")
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit),
      FeeModel.countDocuments(match),
    ]);

    return {
      data: fees.map((f: any) => ({
        id: f._id.toString(),
        student: f.studentId
          ? `${f.studentId.firstName} ${f.studentId.lastName}`
          : "Unknown",
        totalAmount: f.finalAmount,
        outstanding: round2(
          f.finalAmount - f.installments.reduce((s: number, i: any) => s + i.paidAmount, 0),
        ),
        overallStatus: f.overallStatus,
      })),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async getRecentTransactions(filters: { academyId?: string; franchiseId?: string; limit?: number }) {
    const limit = filters.limit ?? 20;
    const match: Record<string, unknown> = {
      "installments.paidAt": { $exists: true },
      ...(await resolveFranchiseFilter(filters)),
    };

    const fees = await FeeModel.find(match)
      .populate("studentId", "firstName lastName")
      .sort({ updatedAt: -1 })
      .limit(limit);

    const feeTransactions = fees.flatMap((f: any) =>
      f.installments
        .filter((i: any) => i.paidAt)
        .map((i: any) => ({
          feeId: f._id.toString(),
          student: f.studentId
            ? `${f.studentId.firstName} ${f.studentId.lastName}`
            : "Unknown",
          amount: i.paidAmount,
          paidAt: i.paidAt,
          method: i.paymentMethod,
          transactionId: i.transactionId,
        })),
    );

    // Fetch active subscription transactions
    const subTransactionsMatch: Record<string, unknown> = {
      status: "active",
      ...(await resolveSubscriptionAcademyFilter(filters)),
    };
    const recentSubs = await AcademySubscriptionModel.find(subTransactionsMatch)
      .populate("academyId", "name")
      .sort({ updatedAt: -1 })
      .limit(limit);

    const subTransactions = recentSubs.map((s: any) => ({
      feeId: s._id.toString(),
      student: `${s.academyId?.name || "Academy"} (Subscription - ${s.billingInterval})`,
      amount: computeSubscriptionAmount(s),
      paidAt: s.updatedAt || s.createdAt,
      method: "Stripe",
      transactionId: s.stripeSubscriptionId || s.stripeCheckoutSessionId || "stripe_sub",
    }));

    const allTransactions = [...feeTransactions, ...subTransactions];

    return allTransactions
      .sort((a, b) => new Date(b.paidAt).getTime() - new Date(a.paidAt).getTime())
      .slice(0, limit);
  }
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

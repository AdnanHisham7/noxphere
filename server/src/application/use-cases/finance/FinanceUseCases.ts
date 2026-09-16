// src/application/use-cases/finance/FinanceUseCases.ts
import mongoose from "mongoose";
import { FeeModel } from "../../../infrastructure/database/models/Fee.model";
import { AcademyModel } from "../../../infrastructure/database/models/Academy.model";
import { FranchiseModel } from "../../../infrastructure/database/models/Franchise.model";
import { StudentModel } from "../../../infrastructure/database/models/Student.model";
import { AcademySubscriptionModel } from "../../../infrastructure/database/models/AcademySubscription.model";
import { NfcCardRequestModel } from "../../../infrastructure/database/models/NfcCardRequest.model";

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
    // 1. Academy SaaS Subscriptions (Platform Revenue for Super Admin)
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
    let subscriptionRevenue = 0;
    for (const sub of subscriptions) {
      subscriptionRevenue += computeSubscriptionAmount(sub);
    }

    // 2. Smart NFC Card Orders (Platform Revenue for Super Admin)
    const nfcMatch: Record<string, unknown> = {
      status: { $in: ["paid", "dispatched", "delivered"] },
      ...(filters.academyId && { academyId: new mongoose.Types.ObjectId(filters.academyId) }),
    };
    if (filters.from || filters.to) {
      nfcMatch.paidAt = {
        ...(filters.from && { $gte: new Date(filters.from) }),
        ...(filters.to && { $lte: new Date(filters.to) }),
      };
    }
    const nfcOrders = await NfcCardRequestModel.find(nfcMatch);
    let nfcRevenue = 0;
    let nfcCardsCount = 0;
    for (const o of nfcOrders) {
      nfcRevenue += o.totalAmount || 0;
      nfcCardsCount += o.quantity || 0;
    }

    // Total Platform Revenue for Super Admin
    const totalPlatformRevenue = round2(subscriptionRevenue + nfcRevenue);

    // 3. Academy Student Fees (Internal to each Academy — Tuition/Training fees)
    const feeMatch: Record<string, unknown> = { ...(await resolveFranchiseFilter(filters)) };
    if (filters.from || filters.to) {
      feeMatch.createdAt = {
        ...(filters.from && { $gte: new Date(filters.from) }),
        ...(filters.to && { $lte: new Date(filters.to) }),
      };
    }

    const fees = await FeeModel.find(feeMatch);
    let academyFeesTotal = 0;
    let academyFeesCollected = 0;
    let overdueCount = 0;
    let overdueAmount = 0;

    for (const fee of fees) {
      academyFeesTotal += fee.finalAmount;
      for (const inst of fee.installments) {
        academyFeesCollected += inst.paidAmount;
        if (inst.status === "overdue") {
          overdueCount += 1;
          overdueAmount += inst.amount - inst.paidAmount;
        }
      }
    }

    const academyFeesOutstanding = round2(academyFeesTotal - academyFeesCollected);

    return {
      // Super Admin Platform Business Income
      totalPlatformRevenue,
      subscriptionRevenue: round2(subscriptionRevenue),
      nfcRevenue: round2(nfcRevenue),
      activeSubscriptionsCount: subscriptions.length,
      nfcOrdersCount: nfcOrders.length,
      nfcCardsCount,

      // Academy-Internal Student Tuition (Belongs to respective Academies)
      academyFeesTotal: round2(academyFeesTotal),
      academyFeesCollected: round2(academyFeesCollected),
      academyFeesOutstanding,
      academyFeesOverdueCount: overdueCount,
      academyFeesOverdueAmount: round2(overdueAmount),

      // Standard / backward-compatible properties
      totalRevenue: totalPlatformRevenue,
      totalCollected: totalPlatformRevenue,
      totalOutstanding: academyFeesOutstanding,
      studentFeeRevenue: round2(academyFeesTotal),
      overdueCount,
      overdueAmount: round2(overdueAmount),
      collectionRate: totalPlatformRevenue > 0 ? 100 : 0,
      totalInvoices: subscriptions.length + nfcOrders.length,
    };
  }

  async getRevenueByMonth(filters: { academyId?: string; franchiseId?: string; months?: number }) {
    const months = filters.months ?? 6;
    const since = new Date();
    since.setMonth(since.getMonth() - (months - 1));
    since.setDate(1);
    since.setHours(0, 0, 0, 0);

    const buckets = new Map<
      string,
      {
        month: string;
        platformRevenue: number;
        subscriptionRevenue: number;
        nfcRevenue: number;
        academyFees: number;
        revenue: number;
        collected: number;
      }
    >();

    // seed empty buckets
    for (let i = 0; i < months; i++) {
      const d = new Date(since);
      d.setMonth(d.getMonth() + i);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      buckets.set(key, {
        month: key,
        platformRevenue: 0,
        subscriptionRevenue: 0,
        nfcRevenue: 0,
        academyFees: 0,
        revenue: 0,
        collected: 0,
      });
    }

    // Subscriptions
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
      bucket.subscriptionRevenue += amount;
      bucket.platformRevenue += amount;
      bucket.revenue += amount;
      bucket.collected += amount;
    }

    // NFC Card Orders
    const nfcMatch: Record<string, unknown> = {
      status: { $in: ["paid", "dispatched", "delivered"] },
      paidAt: { $gte: since },
      ...(filters.academyId && { academyId: new mongoose.Types.ObjectId(filters.academyId) }),
    };
    const nfcOrders = await NfcCardRequestModel.find(nfcMatch);
    for (const order of nfcOrders) {
      const d = order.paidAt || order.updatedAt || order.createdAt;
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      const bucket = buckets.get(key);
      if (!bucket) continue;
      bucket.nfcRevenue += order.totalAmount || 0;
      bucket.platformRevenue += order.totalAmount || 0;
      bucket.revenue += order.totalAmount || 0;
      bucket.collected += order.totalAmount || 0;
    }

    // Academy Student Fees (tracked for audit reference)
    const match: Record<string, unknown> = {
      createdAt: { $gte: since },
      ...(await resolveFranchiseFilter(filters)),
    };
    const fees = await FeeModel.find(match);
    for (const fee of fees) {
      const d = fee.createdAt;
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      const bucket = buckets.get(key);
      if (!bucket) continue;
      bucket.academyFees += fee.finalAmount;
    }

    return Array.from(buckets.values()).map((v) => ({
      month: v.month,
      platformRevenue: round2(v.platformRevenue),
      subscriptionRevenue: round2(v.subscriptionRevenue),
      nfcRevenue: round2(v.nfcRevenue),
      academyFees: round2(v.academyFees),
      revenue: round2(v.platformRevenue),
      collected: round2(v.platformRevenue),
    }));
  }

  async getRevenueByAcademy() {
    const academies = await AcademyModel.find({ isActive: true }).lean();
    const results = await Promise.all(
      academies.map(async (a: any) => {
        // SaaS subscription from this academy to Platform
        const activeSub = await AcademySubscriptionModel.findOne({ academyId: a._id, status: "active" });
        const subscriptionRevenue = activeSub ? computeSubscriptionAmount(activeSub) : 0;

        // NFC Cards purchased by this academy from Platform
        const nfcOrders = await NfcCardRequestModel.find({
          academyId: a._id,
          status: { $in: ["paid", "dispatched", "delivered"] },
        });
        const nfcRevenue = nfcOrders.reduce((sum, o) => sum + (o.totalAmount || 0), 0);

        // Platform revenue = SaaS + NFC
        const platformRevenue = round2(subscriptionRevenue + nfcRevenue);

        // Academy's own internal student fee collections
        const franchises = await FranchiseModel.find({ academyId: a._id }).select("_id");
        const franchiseIds = franchises.map((f) => f._id);
        const fees = franchiseIds.length
          ? await FeeModel.find({ franchiseId: { $in: franchiseIds } })
          : [];
        const studentFeesCollected = fees.reduce(
          (s, f) => s + f.installments.reduce((si, i) => si + i.paidAmount, 0),
          0,
        );

        const studentCount = franchiseIds.length
          ? await StudentModel.countDocuments({ franchiseId: { $in: franchiseIds }, isActive: true })
          : 0;

        return {
          academyId: a._id.toString(),
          academyName: a.name,
          franchiseCount: franchiseIds.length,
          revenue: platformRevenue, // Platform revenue from this academy
          platformRevenue,
          subscriptionRevenue: round2(subscriptionRevenue),
          nfcRevenue: round2(nfcRevenue),
          academyFeesCollected: round2(studentFeesCollected),
          collected: platformRevenue,
          outstanding: 0,
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
    const limit = filters.limit ?? 25;

    // 1. Fetch active subscription transactions (Platform Revenue)
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
      type: "academy_subscription" as const,
      student: `${s.academyId?.name || "Academy"}`,
      academyName: s.academyId?.name || "Academy",
      billingInterval: s.billingInterval,
      amount: computeSubscriptionAmount(s),
      paidAt: s.updatedAt || s.createdAt,
      method: "Stripe",
      transactionId: s.stripeSubscriptionId || s.stripeCheckoutSessionId || "stripe_sub",
    }));

    // 2. Fetch paid NFC Card orders (Platform Revenue)
    const nfcOrders = await NfcCardRequestModel.find({
      status: { $in: ["paid", "dispatched", "delivered"] },
      ...(filters.academyId && { academyId: new mongoose.Types.ObjectId(filters.academyId) }),
    })
      .populate("academyId", "name")
      .populate("requesterId", "firstName lastName email")
      .sort({ updatedAt: -1 })
      .limit(limit);

    const nfcTransactions = nfcOrders.map((o: any) => ({
      feeId: o._id.toString(),
      type: "nfc_card_order" as const,
      student: o.academyId?.name
        ? `${o.academyId.name} (${o.quantity} NFC Cards)`
        : `${o.shippingAddress?.recipientName || "Player"} (${o.quantity} NFC Card)`,
      academyName: o.academyId?.name || "Independent Player",
      quantity: o.quantity,
      unitPrice: o.unitPrice,
      amount: o.totalAmount,
      paidAt: o.paidAt || o.updatedAt || o.createdAt,
      method: "Stripe",
      transactionId: o.stripeSessionId || o.stripePaymentIntentId || "nfc_stripe",
    }));

    // 3. Fetch Academy Student Fees (Academy-Internal Tuition, shown for audit)
    const match: Record<string, unknown> = {
      "installments.paidAt": { $exists: true },
      ...(await resolveFranchiseFilter(filters)),
    };

    const fees = await FeeModel.find(match)
      .populate("studentId", "firstName lastName")
      .populate("franchiseId", "name")
      .sort({ updatedAt: -1 })
      .limit(limit);

    const feeTransactions = fees.flatMap((f: any) =>
      f.installments
        .filter((i: any) => i.paidAt)
        .map((i: any) => ({
          feeId: f._id.toString(),
          type: "student_fee" as const,
          student: f.studentId
            ? `${f.studentId.firstName} ${f.studentId.lastName}`
            : "Unknown",
          academyName: f.franchiseId?.name ? `Franchise: ${f.franchiseId.name}` : "Academy Student",
          amount: i.paidAmount,
          paidAt: i.paidAt,
          method: i.paymentMethod,
          transactionId: i.transactionId,
        })),
    );

    const allTransactions = [...subTransactions, ...nfcTransactions, ...feeTransactions];

    return allTransactions
      .sort((a, b) => new Date(b.paidAt).getTime() - new Date(a.paidAt).getTime())
      .slice(0, limit);
  }
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

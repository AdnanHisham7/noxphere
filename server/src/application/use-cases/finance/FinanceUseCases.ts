// src/application/use-cases/finance/FinanceUseCases.ts
import mongoose from "mongoose";
import { FeeModel } from "../../../infrastructure/database/models/Fee.model";
import { AcademyModel } from "../../../infrastructure/database/models/Academy.model";
import { FranchiseModel } from "../../../infrastructure/database/models/Franchise.model";
import { StudentModel } from "../../../infrastructure/database/models/Student.model";
import {
  AcademySubscriptionModel,
  type BillingInterval,
} from "../../../infrastructure/database/models/AcademySubscription.model";
import { NfcCardRequestModel } from "../../../infrastructure/database/models/NfcCardRequest.model";
import { PlatformSettingsModel } from "../../../infrastructure/database/models/PlatformSettings.model";
import {
  convertToInr,
  getCurrencySymbol,
} from "../../../infrastructure/services/GeoLocationService";

function computeSubscriptionAmount(sub: {
  ratePerStudentPerDay: number;
  provisionedCapacity: number;
  billingInterval: BillingInterval;
  staffRatePerStaffPerMonth?: number;
  provisionedStaffCapacity?: number;
}): number {
  const days =
    sub.billingInterval === "year"
      ? 365
      : sub.billingInterval === "half_year"
      ? 180
      : sub.billingInterval === "quarter"
      ? 90
      : 30;
  const months =
    sub.billingInterval === "year"
      ? 12
      : sub.billingInterval === "half_year"
      ? 6
      : sub.billingInterval === "quarter"
      ? 3
      : 1;
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
    const settings = await PlatformSettingsModel.findOne().lean();

    // Map to track breakdown by each currency
    const breakdownMap = new Map<
      string,
      {
        currency: string;
        symbol: string;
        subscriptionAmount: number;
        nfcAmount: number;
        totalAmount: number;
        normalizedInr: number;
      }
    >();

    const getOrCreateBreakdown = (curr: string) => {
      const c = (curr || "INR").toUpperCase();
      if (!breakdownMap.has(c)) {
        breakdownMap.set(c, {
          currency: c,
          symbol: getCurrencySymbol(c),
          subscriptionAmount: 0,
          nfcAmount: 0,
          totalAmount: 0,
          normalizedInr: 0,
        });
      }
      return breakdownMap.get(c)!;
    };

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
    let subscriptionRevenueInr = 0;
    for (const sub of subscriptions) {
      const subCurrency = (sub.currency || "INR").toUpperCase();
      const paidPayments = Array.isArray(sub.payments)
        ? sub.payments.filter((p: any) => p.status === "paid")
        : [];
      paidPayments.sort((a: any, b: any) => new Date(b.paidAt || 0).getTime() - new Date(a.paidAt || 0).getTime());
      const latestPayment = paidPayments[0] || null;

      const amountNative = (latestPayment && typeof latestPayment.amount === "number")
        ? latestPayment.amount
        : computeSubscriptionAmount(sub);

      const amountInr = (latestPayment && typeof latestPayment.amountInInr === "number")
        ? latestPayment.amountInInr
        : convertToInr(amountNative, subCurrency, settings?.currencyPricing);

      subscriptionRevenueInr += amountInr;

      const item = getOrCreateBreakdown(subCurrency);
      item.subscriptionAmount = round2(item.subscriptionAmount + amountNative);
      item.totalAmount = round2(item.totalAmount + amountNative);
      item.normalizedInr = round2(item.normalizedInr + amountInr);
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
    let nfcRevenueInr = 0;
    let nfcCardsCount = 0;
    for (const o of nfcOrders) {
      const amountNative = o.totalAmount || 0;
      const nfcCurrency = (o.currency || "INR").toUpperCase();
      const amountInr = typeof o.totalAmountInInr === "number"
        ? o.totalAmountInInr
        : convertToInr(amountNative, nfcCurrency, settings?.currencyPricing);
      nfcRevenueInr += amountInr;
      nfcCardsCount += o.quantity || 0;

      const item = getOrCreateBreakdown(nfcCurrency);
      item.nfcAmount = round2(item.nfcAmount + amountNative);
      item.totalAmount = round2(item.totalAmount + amountNative);
      item.normalizedInr = round2(item.normalizedInr + amountInr);
    }

    // Total Platform Revenue for Super Admin (normalized in INR)
    const totalPlatformRevenue = round2(subscriptionRevenueInr + nfcRevenueInr);

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
      // Super Admin Platform Business Income (Normalized to Base Currency INR)
      baseCurrency: "INR",
      baseCurrencySymbol: "₹",
      totalPlatformRevenue,
      subscriptionRevenue: round2(subscriptionRevenueInr),
      nfcRevenue: round2(nfcRevenueInr),
      activeSubscriptionsCount: subscriptions.filter(
        (s) =>
          computeSubscriptionAmount(s) > 0 ||
          (Array.isArray(s.payments) && s.payments.some((p) => p.status === "paid" && p.amount > 0))
      ).length,
      nfcOrdersCount: nfcOrders.length,
      nfcCardsCount,

      // Multi-Currency Breakdown
      currencyBreakdown: Array.from(breakdownMap.values()).filter((item) => item.totalAmount > 0),

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
    const settings = await PlatformSettingsModel.findOne().lean();
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

      const paidPayments = Array.isArray(sub.payments)
        ? sub.payments.filter((p: any) => p.status === "paid")
        : [];
      paidPayments.sort((a: any, b: any) => new Date(b.paidAt || 0).getTime() - new Date(a.paidAt || 0).getTime());
      const latestPayment = paidPayments[0] || null;

      const amountNative = (latestPayment && typeof latestPayment.amount === "number")
        ? latestPayment.amount
        : computeSubscriptionAmount(sub);

      const amountInr = (latestPayment && typeof latestPayment.amountInInr === "number")
        ? latestPayment.amountInInr
        : convertToInr(amountNative, sub.currency || "INR", settings?.currencyPricing);

      bucket.subscriptionRevenue += amountInr;
      bucket.platformRevenue += amountInr;
      bucket.revenue += amountInr;
      bucket.collected += amountInr;
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
      const amountNative = order.totalAmount || 0;
      const amountInr = typeof order.totalAmountInInr === "number"
        ? order.totalAmountInInr
        : convertToInr(amountNative, order.currency || "INR", settings?.currencyPricing);
      bucket.nfcRevenue += amountInr;
      bucket.platformRevenue += amountInr;
      bucket.revenue += amountInr;
      bucket.collected += amountInr;
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
    const settings = await PlatformSettingsModel.findOne().lean();
    const academies = await AcademyModel.find({ isActive: true }).lean();
    const results = await Promise.all(
      academies.map(async (a: any) => {
        const currency = (a.currency || "INR").toUpperCase();
        const currencySymbol = getCurrencySymbol(currency);

        // SaaS subscription from this academy to Platform
        const activeSub = await AcademySubscriptionModel.findOne({ academyId: a._id, status: "active" });
        const paidPayments = Array.isArray(activeSub?.payments)
          ? activeSub.payments.filter((p: any) => p.status === "paid")
          : [];
        paidPayments.sort((a: any, b: any) => new Date(b.paidAt || 0).getTime() - new Date(a.paidAt || 0).getTime());
        const latestPayment = paidPayments[0] || null;

        const subscriptionRevenueNative = activeSub
          ? (latestPayment && typeof latestPayment.amount === "number"
              ? latestPayment.amount
              : computeSubscriptionAmount(activeSub))
          : 0;

        const subRevenueInr = (latestPayment && typeof latestPayment.amountInInr === "number")
          ? latestPayment.amountInInr
          : convertToInr(subscriptionRevenueNative, currency, settings?.currencyPricing);

        // NFC Cards purchased by this academy from Platform
        const nfcOrders = await NfcCardRequestModel.find({
          academyId: a._id,
          status: { $in: ["paid", "dispatched", "delivered"] },
        });
        const nfcRevenueNative = nfcOrders.reduce((sum, o) => sum + (o.totalAmount || 0), 0);
        const nfcRevenueInr = nfcOrders.reduce((sum, o) => {
          if (typeof o.totalAmountInInr === "number") {
            return sum + o.totalAmountInInr;
          }
          const oCurr = (o.currency || currency || "INR").toUpperCase();
          return sum + convertToInr(o.totalAmount || 0, oCurr, settings?.currencyPricing);
        }, 0);

        // Platform revenue normalized in INR
        const platformRevenueInr = round2(subRevenueInr + nfcRevenueInr);
        const totalNative = round2(subscriptionRevenueNative + nfcRevenueNative);

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
          currency,
          currencySymbol,
          franchiseCount: franchiseIds.length,
          revenue: platformRevenueInr, // Normalized Platform revenue in INR
          platformRevenue: platformRevenueInr,
          nativeRevenue: totalNative,
          subscriptionRevenue: round2(subRevenueInr),
          subscriptionRevenueNative: round2(subscriptionRevenueNative),
          nfcRevenue: round2(nfcRevenueInr),
          nfcRevenueNative: round2(nfcRevenueNative),
          academyFeesCollected: round2(studentFeesCollected),
          collected: platformRevenueInr,
          outstanding: 0,
          studentCount,
        };
      }),
    );
    return results
      .filter((a) => a.platformRevenue > 0)
      .sort((a, b) => b.platformRevenue - a.platformRevenue);
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
      .populate("academyId", "name currency")
      .sort({ updatedAt: -1 })
      .limit(limit);

    const payingSubs = recentSubs.filter((s: any) => {
      const hasPaid = Array.isArray(s.payments) && s.payments.some((p: any) => p.status === "paid" && p.amount > 0);
      return hasPaid || computeSubscriptionAmount(s) > 0;
    });

    const subTransactions = payingSubs.map((s: any) => {
      const currency = (s.currency || s.academyId?.currency || "INR").toUpperCase();
      const paidPayments = Array.isArray(s.payments)
        ? s.payments.filter((p: any) => p.status === "paid")
        : [];
      paidPayments.sort((a: any, b: any) => new Date(b.paidAt || 0).getTime() - new Date(a.paidAt || 0).getTime());
      const lastPayment = paidPayments[0] || (Array.isArray(s.payments) && s.payments[0]) || null;

      const subAmount = (lastPayment && typeof lastPayment.amount === "number")
        ? lastPayment.amount
        : computeSubscriptionAmount(s);
      const exchangeRateToInr = lastPayment?.exchangeRateToInr ?? (currency === "INR" ? 1 : undefined);
      const amountInInr = lastPayment?.amountInInr ?? (currency === "INR" ? subAmount : undefined);

      const method = lastPayment?.paymentMethod
        ? lastPayment.paymentMethod
        : s.razorpayPaymentId
        ? "Razorpay"
        : undefined;

      const transactionId = lastPayment?.paymentId || lastPayment?.orderId || s.razorpayPaymentId || s.razorpayOrderId || undefined;
      const notes = lastPayment?.notes || undefined;

      return {
        feeId: s._id.toString(),
        type: "academy_subscription" as const,
        student: `${s.academyId?.name || "Academy"}`,
        academyName: s.academyId?.name || "Academy",
        billingInterval: s.billingInterval,
        amount: subAmount,
        currency,
        currencySymbol: getCurrencySymbol(currency),
        exchangeRateToInr,
        amountInInr,
        paidAt: lastPayment?.paidAt || s.updatedAt || s.createdAt,
        method,
        transactionId,
        notes,
      };
    });

    // 2. Fetch paid NFC Card orders (Platform Revenue)
    const nfcOrders = await NfcCardRequestModel.find({
      status: { $in: ["paid", "dispatched", "delivered"] },
      totalAmount: { $gt: 0 },
      ...(filters.academyId && { academyId: new mongoose.Types.ObjectId(filters.academyId) }),
    })
      .populate("academyId", "name currency")
      .populate("requesterId", "firstName lastName email")
      .sort({ updatedAt: -1 })
      .limit(limit);

    const nfcTransactions = nfcOrders.map((o: any) => {
      const currency = (o.currency || o.academyId?.currency || "INR").toUpperCase();
      const method = o.razorpayPaymentId || o.razorpayOrderId ? "Razorpay" : undefined;
      const transactionId = o.razorpayPaymentId || o.razorpayOrderId || undefined;
      return {
        feeId: o._id.toString(),
        type: "nfc_card_order" as const,
        student: o.academyId?.name
          ? `${o.academyId.name} (${o.quantity} NFC Cards)`
          : `${o.shippingAddress?.recipientName || "Player"} (${o.quantity} NFC Card)`,
        academyName: o.academyId?.name || "Independent Player",
        quantity: o.quantity,
        unitPrice: o.unitPrice,
        amount: o.totalAmount,
        currency,
        currencySymbol: getCurrencySymbol(currency),
        exchangeRateToInr: o.exchangeRateToInr ?? (currency === "INR" ? 1 : undefined),
        amountInInr: o.totalAmountInInr ?? (currency === "INR" ? o.totalAmount : undefined),
        paidAt: o.paidAt || o.updatedAt || o.createdAt,
        method,
        transactionId,
      };
    });

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
        .map((i: any) => {
          const currency = (f.currency || "INR").toUpperCase();
          return {
            feeId: f._id.toString(),
            type: "student_fee" as const,
            student: f.studentId
              ? `${f.studentId.firstName} ${f.studentId.lastName}`
              : "Unknown",
            academyName: f.franchiseId?.name ? `Franchise: ${f.franchiseId.name}` : "Academy Student",
            amount: i.paidAmount,
            currency,
            currencySymbol: getCurrencySymbol(currency),
            exchangeRateToInr: i.exchangeRateToInr ?? (currency === "INR" ? 1 : undefined),
            amountInInr: i.paidAmountInInr ?? (currency === "INR" ? i.paidAmount : undefined),
            paidAt: i.paidAt,
            method: i.paymentMethod,
            transactionId: i.transactionId,
          };
        }),
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


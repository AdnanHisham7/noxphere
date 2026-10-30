// src/application/use-cases/dashboard/DashboardUseCases.ts
import mongoose from "mongoose";
import { StudentModel } from "../../../infrastructure/database/models/Student.model";
import { TeamModel } from "../../../infrastructure/database/models/Team.model";
import { AttendanceModel } from "../../../infrastructure/database/models/Attendance.model";
import { PerformanceModel } from "../../../infrastructure/database/models/Performance.model";
import { FeeModel } from "../../../infrastructure/database/models/Fee.model";
import { FranchiseModel } from "../../../infrastructure/database/models/Franchise.model";
import { UserModel } from "../../../infrastructure/database/models/User.model";
import { SessionModel } from "../../../infrastructure/database/models/Session.model";
import { AcademyModel } from "../../../infrastructure/database/models/Academy.model";
import { NfcCardRequestModel } from "../../../infrastructure/database/models/NfcCardRequest.model";
import { PlatformSettingsModel } from "../../../infrastructure/database/models/PlatformSettings.model";
import { PlatformTicketModel } from "../../../infrastructure/database/models/PlatformTicket.model";
import { AcademySubscriptionModel } from "../../../infrastructure/database/models/AcademySubscription.model";
import { convertToInr } from "../../../infrastructure/services/GeoLocationService";
import { BadRequestError } from "../../../shared/errors/AppError";

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

export class DashboardUseCases {
  private async getQueryFranchiseIds(params: { franchiseId?: string; academyId?: string }): Promise<mongoose.Types.ObjectId[]> {
    if (params.franchiseId) {
      return [new mongoose.Types.ObjectId(params.franchiseId)];
    }
    if (params.academyId) {
      const franchises = await FranchiseModel.find({ academyId: params.academyId }).select("_id").lean();
      return franchises.map((f) => f._id);
    }
    throw new BadRequestError("Either franchiseId or academyId is required");
  }

  async getStats(params: { franchiseId?: string; academyId?: string; isSuperAdmin?: boolean }) {
    if (params.isSuperAdmin && !params.academyId && !params.franchiseId) {
      const [totalAcademies, totalFranchises, totalStudents, totalCoaches, totalTeams] = await Promise.all([
        AcademyModel.countDocuments({ deletedAt: { $exists: false } }),
        FranchiseModel.countDocuments({ deletedAt: { $exists: false } }),
        StudentModel.countDocuments({ isActive: true }),
        UserModel.countDocuments({ role: "coach", isActive: true, deletedAt: { $exists: false } }),
        TeamModel.countDocuments({ deletedAt: { $exists: false } }),
      ]);

      return {
        totalStudents,
        pendingEnrollment: 0,
        avgAttendance: 0,
        avgRating: 0,
        feesCollected: 0,
        feesOutstanding: 0,
        totalCoaches,
        totalTeams,
        totalSessions: 0,
        franchisePerformance: [],
        totalAcademies,
        totalFranchises,
      };
    }

    const franchiseIds = await this.getQueryFranchiseIds(params);

    const [totalStudents, pendingStudents, students, fees, totalTeams, totalSessions] = await Promise.all([
      StudentModel.countDocuments({ franchiseId: { $in: franchiseIds }, isActive: true }),
      StudentModel.countDocuments({ franchiseId: { $in: franchiseIds }, isActive: false }),
      StudentModel.find({ franchiseId: { $in: franchiseIds }, isActive: true }).select("attendancePercentage overallRating"),
      FeeModel.find({ franchiseId: { $in: franchiseIds } }),
      TeamModel.countDocuments({ franchiseId: { $in: franchiseIds }, deletedAt: { $exists: false } }),
      SessionModel.countDocuments({ franchiseId: { $in: franchiseIds }, deletedAt: { $exists: false } }),
    ]);

    const avgAttendance =
      students.length > 0
        ? students.reduce((s, st) => s + (st.attendancePercentage || 0), 0) / students.length
        : 0;
    const avgRating =
      students.length > 0
        ? students.reduce((s, st) => s + (st.overallRating || 0), 0) / students.length
        : 0;

    let feesCollected = 0;
    let feesOutstanding = 0;
    for (const fee of fees) {
      const paid = fee.installments.reduce((s, i) => s + i.paidAmount, 0);
      feesCollected += paid;
      feesOutstanding += fee.finalAmount - paid;
    }

    let totalCoaches = 0;
    let franchisePerformance: any[] = [];

    if (params.academyId) {
      totalCoaches = await UserModel.countDocuments({
        role: "coach",
        academyId: params.academyId,
        isActive: true,
        deletedAt: { $exists: false },
      });

      const franchises = await FranchiseModel.find({ academyId: params.academyId });
      franchisePerformance = await Promise.all(
        franchises.map(async (f) => {
          const [fStudents, fTeams, fSessions, fFees] = await Promise.all([
            StudentModel.countDocuments({ franchiseId: f._id, isActive: true }),
            TeamModel.countDocuments({ franchiseId: f._id, deletedAt: { $exists: false } }),
            SessionModel.countDocuments({ franchiseId: f._id, deletedAt: { $exists: false } }),
            FeeModel.find({ franchiseId: f._id }),
          ]);
          let fPaid = 0;
          let fOutstanding = 0;
          for (const fee of fFees) {
            const paid = fee.installments.reduce((s, i) => s + i.paidAmount, 0);
            fPaid += paid;
            fOutstanding += fee.finalAmount - paid;
          }
          return {
            id: f._id.toString(),
            name: f.name,
            code: f.franchiseCode,
            location: f.location?.name,
            totalPlayers: fStudents,
            totalTeams: fTeams,
            totalSessions: fSessions,
            feesCollected: round1(fPaid),
            feesOutstanding: round1(fOutstanding),
            isActive: f.isActive,
          };
        })
      );
    }

    return {
      totalStudents,
      pendingEnrollment: pendingStudents,
      avgAttendance: round1(avgAttendance),
      avgRating: round1(avgRating),
      feesCollected: round1(feesCollected),
      feesOutstanding: round1(feesOutstanding),
      totalCoaches,
      totalTeams,
      totalSessions,
      franchisePerformance,
    };
  }

  async getAttendanceTrend(params: { franchiseId?: string; academyId?: string }, days = 7) {
    const franchiseIds = await this.getQueryFranchiseIds(params);

    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth();
    const currentDate = now.getDate();

    if (days === 365 || days === 0 || days >= 1000) {
      // Monthly aggregation for 1 year or overall
      const isOverall = days === 0 || days >= 1000;
      let startYear = currentYear;
      let startMonth = currentMonth - 11; // Default to last 12 months

      if (isOverall) {
        const earliest = await AttendanceModel.findOne({ franchiseId: { $in: franchiseIds } })
          .sort({ sessionDate: 1 })
          .select("sessionDate")
          .lean();

        if (earliest && earliest.sessionDate) {
          const eDate = new Date(earliest.sessionDate);
          const eYear = eDate.getUTCFullYear();
          const eMonth = eDate.getUTCMonth();
          // Provide at least 6 months of historical context
          const minContextMonth = currentMonth - 5;
          let minContextYear = currentYear;
          let normMinMonth = minContextMonth;
          while (normMinMonth < 0) {
            normMinMonth += 12;
            minContextYear -= 1;
          }
          if (eYear < minContextYear || (eYear === minContextYear && eMonth <= normMinMonth)) {
            startYear = eYear;
            startMonth = eMonth;
          } else {
            startYear = minContextYear;
            startMonth = normMinMonth;
          }
        } else {
          // If no records, provide last 6 months
          startMonth = currentMonth - 5;
        }
      }

      while (startMonth < 0) {
        startMonth += 12;
        startYear -= 1;
      }

      const buckets = new Map<string, { present: number; total: number; label: string }>();
      let curYear = startYear;
      let curMonth = startMonth;

      while (
        curYear < currentYear ||
        (curYear === currentYear && curMonth <= currentMonth)
      ) {
        const monthNum = curMonth + 1;
        const key = `${curYear}-${String(monthNum).padStart(2, "0")}`;
        const dObj = new Date(Date.UTC(curYear, curMonth, 1));
        const label = dObj.toLocaleDateString("en-IN", {
          timeZone: "UTC",
          month: "short",
          year: isOverall || curYear !== currentYear ? "2-digit" : undefined,
        });

        buckets.set(key, { present: 0, total: 0, label });

        curMonth++;
        if (curMonth > 11) {
          curMonth = 0;
          curYear++;
        }
      }

      const since = new Date(Date.UTC(startYear, startMonth, 1, 0, 0, 0, 0));
      const until = new Date(Date.UTC(currentYear, currentMonth + 1, 0, 23, 59, 59, 999));

      const records = await AttendanceModel.find({
        franchiseId: { $in: franchiseIds },
        sessionDate: { $gte: since, $lte: until },
      }).select("sessionDate status");

      for (const r of records) {
        if (!r.sessionDate) continue;
        const rd = new Date(r.sessionDate);
        const key = `${rd.getUTCFullYear()}-${String(rd.getUTCMonth() + 1).padStart(2, "0")}`;
        const bucket = buckets.get(key);
        if (!bucket) continue;
        bucket.total += 1;
        if (r.status === "present" || r.status === "late") {
          bucket.present += 1;
        }
      }

      return Array.from(buckets.entries()).map(([dateKey, b]) => ({
        date: dateKey,
        day: b.label,
        rate: b.total > 0 ? round1((b.present / b.total) * 100) : 0,
        present: b.present,
        total: b.total,
      }));
    }

    // Daily aggregation for 7 days or 30 days
    const numDays = Math.max(1, days);
    const buckets = new Map<string, { present: number; total: number; label: string }>();

    for (let i = 0; i < numDays; i++) {
      const offset = (numDays - 1) - i;
      const d = new Date(Date.UTC(currentYear, currentMonth, currentDate - offset));
      const dateKey = d.toISOString().split("T")[0];
      const label =
        numDays <= 7
          ? d.toLocaleDateString("en-IN", { timeZone: "UTC", weekday: "short" })
          : d.toLocaleDateString("en-IN", { timeZone: "UTC", day: "numeric", month: "short" });
      buckets.set(dateKey, { present: 0, total: 0, label });
    }

    const since = new Date(Date.UTC(currentYear, currentMonth, currentDate - (numDays - 1), 0, 0, 0, 0));
    const until = new Date(Date.UTC(currentYear, currentMonth, currentDate, 23, 59, 59, 999));

    const records = await AttendanceModel.find({
      franchiseId: { $in: franchiseIds },
      sessionDate: { $gte: since, $lte: until },
    }).select("sessionDate status");

    for (const r of records) {
      if (!r.sessionDate) continue;
      const key = new Date(r.sessionDate).toISOString().split("T")[0];
      const bucket = buckets.get(key);
      if (!bucket) continue;
      bucket.total += 1;
      if (r.status === "present" || r.status === "late") {
        bucket.present += 1;
      }
    }

    return Array.from(buckets.entries()).map(([date, b]) => ({
      date,
      day: b.label,
      rate: b.total > 0 ? round1((b.present / b.total) * 100) : 0,
      present: b.present,
      total: b.total,
    }));
  }

  async getSkillRadar(params: { franchiseId?: string; academyId?: string }) {
    const franchiseIds = await this.getQueryFranchiseIds(params);
    const performances = await PerformanceModel.find({ franchiseId: { $in: franchiseIds } })
      .sort({ sessionDate: -1 })
      .limit(500)
      .select("skillScores");

    const totals = new Map<string, { sum: number; count: number }>();
    for (const p of performances) {
      for (const s of p.skillScores) {
        const bucket = totals.get(s.parameter) ?? { sum: 0, count: 0 };
        bucket.sum += s.score;
        bucket.count += 1;
        totals.set(s.parameter, bucket);
      }
    }
    return Array.from(totals.entries()).map(([skill, v]) => ({
      skill,
      avg: v.count > 0 ? round1(v.sum / v.count) : 0,
    }));
  }

  async getTeamHealth(params: { franchiseId?: string; academyId?: string }) {
    const franchiseIds = await this.getQueryFranchiseIds(params);
    const teams = await TeamModel.find({ franchiseId: { $in: franchiseIds } }).populate(
      "coachId",
      "firstName lastName",
    );

    return Promise.all(
      teams.map(async (team: any) => {
        const students = await StudentModel.find({ teamId: team._id, isActive: true }).select(
          "attendancePercentage overallRating",
        );
        const attendance =
          students.length > 0
            ? students.reduce((s, st) => s + (st.attendancePercentage || 0), 0) / students.length
            : 0;
        const performance =
          students.length > 0
            ? students.reduce((s, st) => s + (st.overallRating || 0), 0) / students.length
            : 0;
        return {
          name: team.name,
          attendance: round1(attendance),
          performance: round1(performance),
          students: students.length,
          coach: team.coachId ? `${team.coachId.firstName} ${team.coachId.lastName}` : "Unassigned",
        };
      }),
    );
  }

  async getTopPerformers(params: { franchiseId?: string; academyId?: string }, limit = 5) {
    const franchiseIds = await this.getQueryFranchiseIds(params);
    const students = await StudentModel.find({ franchiseId: { $in: franchiseIds }, isActive: true })
      .populate("teamId", "name")
      .sort({ overallRating: -1 })
      .limit(limit);
    return students.map((s: any) => ({
      id: s._id.toString(),
      name: `${s.firstName} ${s.lastName}`,
      rating: s.overallRating,
      team: s.teamId?.name ?? "Unassigned",
      position: s.position ?? "—",
      avatar: s.photo,
    }));
  }

  async getRecentActivity(params: { franchiseId?: string; academyId?: string }, limit = 10) {
    const franchiseIds = await this.getQueryFranchiseIds(params);
    const [attendance, performance, fees] = await Promise.all([
      AttendanceModel.find({ franchiseId: { $in: franchiseIds } }).sort({ createdAt: -1 }).limit(limit).populate("studentId", "firstName lastName"),
      PerformanceModel.find({ franchiseId: { $in: franchiseIds } }).sort({ createdAt: -1 }).limit(limit).populate("studentId", "firstName lastName"),
      FeeModel.find({ franchiseId: { $in: franchiseIds }, "installments.paidAt": { $exists: true } })
        .sort({ updatedAt: -1 })
        .limit(limit)
        .populate("studentId", "firstName lastName"),
    ]);

    const events = [
      ...attendance.map((a: any) => ({
        id: a._id.toString(),
        type: "attendance",
        message: `${a.studentId?.firstName ?? "A student"} marked ${a.status}`,
        time: a.createdAt,
        icon: "attendance",
      })),
      ...performance.map((p: any) => ({
        id: p._id.toString(),
        type: "performance",
        message: `Performance recorded for ${p.studentId?.firstName ?? "a student"}`,
        time: p.createdAt,
        icon: "performance",
      })),
      ...fees.map((f: any) => ({
        id: f._id.toString(),
        type: "fee",
        message: `Payment recorded for ${f.studentId?.firstName ?? "a student"}`,
        time: f.updatedAt,
        icon: "fee",
      })),
    ];

    return events
      .sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime())
      .slice(0, limit);
  }

  async getSuperAdminAnalytics() {
    const [
      academies,
      franchises,
      subscriptions,
      nfcOrders,
      sessionsCount,
      teamsCount,
      openTicketsCount,
      studentAgg,
      coachAgg,
    ] = await Promise.all([
      AcademyModel.find({ deletedAt: { $exists: false } }).lean(),
      FranchiseModel.find({ deletedAt: { $exists: false } }).select("_id academyId name").lean(),
      AcademySubscriptionModel.find().lean(),
      NfcCardRequestModel.find({ status: { $in: ["paid", "dispatched", "delivered"] } }).lean(),
      SessionModel.countDocuments({ deletedAt: { $exists: false } }),
      TeamModel.countDocuments({ deletedAt: { $exists: false } }),
      PlatformTicketModel.countDocuments({ status: { $in: ["open", "in_progress"] } }),
      StudentModel.aggregate([
        { $match: { isActive: true, deletedAt: { $exists: false } } },
        { $group: { _id: "$franchiseId", count: { $sum: 1 } } },
      ]),
      UserModel.aggregate([
        { $match: { role: "coach", isActive: true, deletedAt: { $exists: false } } },
        { $group: { _id: "$academyId", count: { $sum: 1 } } },
      ]),
    ]);

    // Map student counts per franchise
    const franchiseStudentMap = new Map<string, number>();
    let totalStudents = 0;
    for (const item of studentAgg) {
      if (item._id) {
        const c = item.count || 0;
        franchiseStudentMap.set(item._id.toString(), c);
        totalStudents += c;
      }
    }

    // Map coach counts per academy
    const academyCoachMap = new Map<string, number>();
    let totalCoaches = 0;
    for (const item of coachAgg) {
      if (item._id) {
        const c = item.count || 0;
        academyCoachMap.set(item._id.toString(), c);
        totalCoaches += c;
      }
    }

    // Map franchises per academy and student total per academy
    const academyFranchisesMap = new Map<string, string[]>();
    const academyStudentMap = new Map<string, number>();
    for (const f of franchises) {
      if (f.academyId) {
        const acId = f.academyId.toString();
        const list = academyFranchisesMap.get(acId) || [];
        list.push(f._id.toString());
        academyFranchisesMap.set(acId, list);

        const currentStCount = academyStudentMap.get(acId) || 0;
        const fCount = franchiseStudentMap.get(f._id.toString()) || 0;
        academyStudentMap.set(acId, currentStCount + fCount);
      }
    }

    const subMap = new Map<string, any>();
    for (const s of subscriptions) {
      if (s.academyId) {
        subMap.set(s.academyId.toString(), s);
      }
    }

    const now = new Date();
    let activeAcademies = 0;
    let trialingAcademies = 0;
    let expiredAcademies = 0;
    let totalProvisionedCapacity = 0;

    const academyStatusList: Array<{
      id: string;
      name: string;
      country?: string;
      currency?: string;
      isTrial: boolean;
      status: string;
      totalFranchises: number;
      activeStudents: number;
      capacity: number;
      utilizationPercentage: number;
      coachesCount: number;
      currentPeriodEnd: Date | null;
    }> = [];

    const currencyMap = new Map<string, { count: number }>();

    for (const a of academies) {
      const aId = a._id.toString();
      const sub = subMap.get(aId);
      const isTrial = Boolean(sub?.isTrial || a.isTrial);
      const trialEndsAt = sub?.trialEndsAt || a.trialEndsAt;
      const isTrialActive = Boolean(isTrial && trialEndsAt && now <= new Date(trialEndsAt));
      const isTrialExpired = Boolean(isTrial && trialEndsAt && now > new Date(trialEndsAt));
      const isPaidExpired = Boolean(
        !isTrial && sub?.currentPeriodEnd && now > new Date(sub.currentPeriodEnd)
      );

      let effectiveStatus = "incomplete";
      if (isTrialActive) {
        effectiveStatus = "trialing";
        trialingAcademies++;
      } else if (isTrialExpired) {
        effectiveStatus = "trial_expired";
        expiredAcademies++;
      } else if (isPaidExpired) {
        effectiveStatus = "past_due";
        expiredAcademies++;
      } else if (sub?.status === "active") {
        effectiveStatus = "active";
        activeAcademies++;
      } else {
        effectiveStatus = (sub?.status as string) || "incomplete";
      }

      const capacity = isTrialActive
        ? (sub?.provisionedCapacity || a.trialCapacity || 50)
        : (sub?.provisionedCapacity || 0);

      totalProvisionedCapacity += capacity;
      const stCount = academyStudentMap.get(aId) || 0;
      const util = capacity > 0 ? Math.min(100, Math.round((stCount / capacity) * 100)) : 0;
      const cur = (a.currency || sub?.currency || "INR").toUpperCase();

      const currEntry = currencyMap.get(cur) || { count: 0 };
      currEntry.count++;
      currencyMap.set(cur, currEntry);

      academyStatusList.push({
        id: aId,
        name: a.name,
        country: a.country || "IN",
        currency: cur,
        isTrial,
        status: effectiveStatus,
        totalFranchises: (academyFranchisesMap.get(aId) || []).length,
        activeStudents: stCount,
        capacity,
        utilizationPercentage: util,
        coachesCount: academyCoachMap.get(aId) || 0,
        currentPeriodEnd: sub?.currentPeriodEnd || trialEndsAt || null,
      });
    }

    // Revenue calculations (Normalized to Base Currency INR)
    const platformSettings = await PlatformSettingsModel.findOne().lean();
    let totalSubscriptionRevenue = 0;
    for (const s of subscriptions) {
      if (s.status === "active") {
        const days =
          s.billingInterval === "year"
            ? 365
            : s.billingInterval === "half_year"
            ? 180
            : s.billingInterval === "quarter"
            ? 90
            : 30;
        const months =
          s.billingInterval === "year"
            ? 12
            : s.billingInterval === "half_year"
            ? 6
            : s.billingInterval === "quarter"
            ? 3
            : 1;
        const studentTotal = (s.ratePerStudentPerDay || 0) * (s.provisionedCapacity || 0) * days;
        const staffTotal = (s.staffRatePerStaffPerMonth || 0) * (s.provisionedStaffCapacity || 0) * months;
        const subNative = studentTotal + staffTotal;
        const paidPayments = Array.isArray(s.payments)
          ? s.payments.filter((p: any) => p.status === "paid")
          : [];
        paidPayments.sort((a: any, b: any) => new Date(b.paidAt || 0).getTime() - new Date(a.paidAt || 0).getTime());
        const latestPayment = paidPayments[0] || null;
        const effectiveNative = (latestPayment && typeof latestPayment.amount === "number")
          ? latestPayment.amount
          : subNative;
        const subInr = (latestPayment && typeof latestPayment.amountInInr === "number")
          ? latestPayment.amountInInr
          : convertToInr(effectiveNative, s.currency || "INR", platformSettings?.currencyPricing);
        totalSubscriptionRevenue += subInr;
      }
    }

    let totalNfcRevenue = 0;
    for (const o of nfcOrders) {
      const nfcInr = typeof o.totalAmountInInr === "number"
        ? o.totalAmountInInr
        : convertToInr(o.totalAmount || 0, o.currency || "INR", platformSettings?.currencyPricing);
      totalNfcRevenue += nfcInr;
    }
    const totalPlatformRevenue = Math.round(totalSubscriptionRevenue + totalNfcRevenue);

    // Monthly breakdown (last 6 months)
    const monthlyRevenue: Array<{
      month: string;
      label: string;
      subscriptions: number;
      nfc: number;
      total: number;
    }> = [];

    const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      const label = `${monthNames[d.getMonth()]} ${d.getFullYear().toString().slice(-2)}`;

      let subMonth = 0;
      for (const s of subscriptions) {
        const updated = s.updatedAt || s.createdAt;
        if (
          updated &&
          `${updated.getFullYear()}-${String(updated.getMonth() + 1).padStart(2, "0")}` === key &&
          s.status === "active"
        ) {
          const days =
            s.billingInterval === "year"
              ? 365
              : s.billingInterval === "half_year"
              ? 180
              : s.billingInterval === "quarter"
              ? 90
              : 30;
          const months =
            s.billingInterval === "year"
              ? 12
              : s.billingInterval === "half_year"
              ? 6
              : s.billingInterval === "quarter"
              ? 3
              : 1;
          const nativeAmt =
            (s.ratePerStudentPerDay || 0) * (s.provisionedCapacity || 0) * days +
            (s.staffRatePerStaffPerMonth || 0) * (s.provisionedStaffCapacity || 0) * months;
          const paidPayments = Array.isArray(s.payments)
            ? s.payments.filter((p: any) => p.status === "paid")
            : [];
          paidPayments.sort((a: any, b: any) => new Date(b.paidAt || 0).getTime() - new Date(a.paidAt || 0).getTime());
          const latestPayment = paidPayments[0] || null;
          const effectiveNative = (latestPayment && typeof latestPayment.amount === "number")
            ? latestPayment.amount
            : nativeAmt;
          const inrAmt = (latestPayment && typeof latestPayment.amountInInr === "number")
            ? latestPayment.amountInInr
            : convertToInr(effectiveNative, s.currency || "INR", platformSettings?.currencyPricing);
          subMonth += Math.round(inrAmt);
        }
      }

      let nfcMonth = 0;
      for (const o of nfcOrders) {
        const pd = o.paidAt || o.createdAt;
        if (pd && `${pd.getFullYear()}-${String(pd.getMonth() + 1).padStart(2, "0")}` === key) {
          const nfcInr = typeof o.totalAmountInInr === "number"
            ? o.totalAmountInInr
            : convertToInr(o.totalAmount || 0, o.currency || "INR", platformSettings?.currencyPricing);
          nfcMonth += Math.round(nfcInr);
        }
      }

      monthlyRevenue.push({
        month: key,
        label,
        subscriptions: subMonth,
        nfc: nfcMonth,
        total: Math.round(subMonth + nfcMonth),
      });
    }

    // Currency distribution
    const currencyDistribution = Array.from(currencyMap.entries()).map(([currency, data]) => ({
      currency,
      count: data.count,
    }));

    // Top utilized academies sorted by active students / utilization
    const topAcademies = academyStatusList
      .sort((a, b) => b.activeStudents - a.activeStudents || b.utilizationPercentage - a.utilizationPercentage)
      .slice(0, 8);

    // Recent events across the platform
    const recentAcademies = await AcademyModel.find({ deletedAt: { $exists: false } })
      .sort({ createdAt: -1 })
      .limit(3)
      .select("name createdAt currency")
      .lean();

    const recentNfc = await NfcCardRequestModel.find({ totalAmount: { $gt: 0 } })
      .sort({ createdAt: -1 })
      .limit(3)
      .populate("academyId", "name")
      .select("quantity totalAmount status createdAt academyId")
      .lean();

    const recentTickets = await PlatformTicketModel.find()
      .sort({ createdAt: -1 })
      .limit(3)
      .populate("academyId", "name")
      .select("ticketNumber subject priority status createdAt")
      .lean();

    const activityFeed: Array<{
      id: string;
      type: "academy" | "nfc" | "ticket";
      title: string;
      description: string;
      time: Date;
    }> = [
      ...recentAcademies.map((a: any) => ({
        id: a._id.toString(),
        type: "academy" as const,
        title: "New Academy Onboarded",
        description: `${a.name} registered on the platform (${a.currency || "INR"})`,
        time: a.createdAt,
      })),
      ...recentNfc.map((n: any) => ({
        id: n._id.toString(),
        type: "nfc" as const,
        title: `NFC Order: ${n.quantity} Cards`,
        description: `${(n.academyId as any)?.name || "Academy"} — Status: ${n.status}`,
        time: n.createdAt,
      })),
      ...recentTickets.map((t: any) => ({
        id: t._id.toString(),
        type: "ticket" as const,
        title: `Support: ${t.ticketNumber}`,
        description: `${t.subject} (${t.priority} priority)`,
        time: t.createdAt,
      })),
    ]
      .sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime())
      .slice(0, 8);

    return {
      kpi: {
        totalAcademies: academies.length,
        activeAcademies,
        trialingAcademies,
        expiredAcademies,
        totalFranchises: franchises.length,
        totalStudents,
        totalCoaches,
        totalTeams: teamsCount,
        totalSessions: sessionsCount,
        totalPlatformRevenue,
        subscriptionRevenue: Math.round(totalSubscriptionRevenue),
        nfcRevenue: Math.round(totalNfcRevenue),
        totalCapacity: totalProvisionedCapacity,
        overallCapacityUtilization:
          totalProvisionedCapacity > 0
            ? Math.round((totalStudents / totalProvisionedCapacity) * 100)
            : 0,
        openTicketsCount,
      },
      monthlyRevenue,
      statusDistribution: [
        { status: "Active SaaS", count: activeAcademies, color: "#10b981" },
        { status: "Trialing", count: trialingAcademies, color: "#f59e0b" },
        { status: "Expired / Past Due", count: expiredAcademies, color: "#ef4444" },
      ],
      currencyDistribution,
      topAcademies,
      activityFeed,
    };
  }
}

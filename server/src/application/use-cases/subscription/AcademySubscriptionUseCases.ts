import mongoose from "mongoose";
import Stripe from "stripe";
import {
  AcademySubscriptionModel,
  SubscriptionStatus,
  BillingInterval,
} from "../../../infrastructure/database/models/AcademySubscription.model";
import { PlatformSettingsModel, CurrencyPricing } from "../../../infrastructure/database/models/PlatformSettings.model";
import { AcademyModel } from "../../../infrastructure/database/models/Academy.model";
import { UserModel } from "../../../infrastructure/database/models/User.model";
import { StudentModel } from "../../../infrastructure/database/models/Student.model";
import { SquadInvitationModel } from "../../../infrastructure/database/models/SquadInvitation.model";
import { NfcCardRequestModel } from "../../../infrastructure/database/models/NfcCardRequest.model";
import { EmployeeModel } from "../../../infrastructure/database/models/Employee.model";
import { FranchiseModel } from "../../../infrastructure/database/models/Franchise.model";
import { stripeService } from "../../../infrastructure/services/StripeService";
import { razorpayService } from "../../../infrastructure/services/RazorpayService";
import { notificationService } from "../../../infrastructure/services/NotificationService";
import { geoLocationService, SUPPORTED_CURRENCY_MAP } from "../../../infrastructure/services/GeoLocationService";
import { config } from "../../../config/app.config";
import {
  NotFoundError,
  BadRequestError,
  ForbiddenError,
  SubscriptionRequiredError,
  SubscriptionCapacityExceededError,
  TrialExpiredError,
} from "../../../shared/errors/AppError";

const DAYS_IN_PERIOD: Record<BillingInterval, number> = {
  month: 30,
  quarter: 90,
  half_year: 180,
  year: 365,
};

const STAFF_MONTHS_IN_PERIOD: Record<BillingInterval, number> = {
  month: 1,
  quarter: 3,
  half_year: 6,
  year: 12,
};

function studentPeriodAmount(ratePerStudentPerDay: number, capacity: number, interval: BillingInterval): number {
  return ratePerStudentPerDay * capacity * (DAYS_IN_PERIOD[interval] ?? 30);
}

function staffPeriodAmount(staffRatePerMonth: number, staffCapacity: number, interval: BillingInterval): number {
  return staffRatePerMonth * staffCapacity * (STAFF_MONTHS_IN_PERIOD[interval] ?? 1);
}

// Backward-compatibility aliases
const studentRupeeAmount = studentPeriodAmount;
const staffRupeeAmount = staffPeriodAmount;

function toPaise(amount: number): number {
  return Math.round(amount * 100);
}

export class AcademySubscriptionUseCases {
  // Student documents are scoped by franchiseId, not academyId directly —
  // this resolves every franchise under the academy first so headcount
  // and capacity checks span the whole academy, not just one franchise.
  private async countActiveStudents(academyId: string): Promise<number> {
    const franchiseIds = await FranchiseModel.find({ academyId }).distinct("_id");
    if (franchiseIds.length === 0) return 0;
    return StudentModel.countDocuments({ franchiseId: { $in: franchiseIds }, isActive: true });
  }

  private async countActiveStaff(academyId: string): Promise<number> {
    return EmployeeModel.countDocuments({
      academyId,
      employeeType: "staff",
      isActive: true,
    });
  }

  async getEffectiveRate(academyId: string): Promise<number> {
    const academy = await AcademyModel.findById(academyId).select("subscriptionRateOverride currency").lean();
    if (academy?.subscriptionRateOverride !== undefined && academy.subscriptionRateOverride !== null) {
      return academy.subscriptionRateOverride;
    }
    const currency = (academy?.currency || "INR").toUpperCase();
    const settings = await PlatformSettingsModel.findOne().lean();
    const customCurrencySetting = settings?.currencyPricing?.find(
      (c) => c.currency.toUpperCase() === currency && c.isActive !== false
    );
    if (customCurrencySetting) {
      return customCurrencySetting.ratePerStudentPerDay;
    }
    if (SUPPORTED_CURRENCY_MAP[currency]) {
      return SUPPORTED_CURRENCY_MAP[currency].defaultRatePerStudentPerDay;
    }
    return settings?.defaultRatePerStudentPerDay ?? 1;
  }

  async getEffectiveStaffRate(academyId: string): Promise<number> {
    const academy = await AcademyModel.findById(academyId).select("staffRateOverride currency").lean();
    if (academy?.staffRateOverride !== undefined && academy.staffRateOverride !== null) {
      return academy.staffRateOverride;
    }
    const currency = (academy?.currency || "INR").toUpperCase();
    const settings = await PlatformSettingsModel.findOne().lean();
    const customCurrencySetting = settings?.currencyPricing?.find(
      (c) => c.currency.toUpperCase() === currency && c.isActive !== false
    );
    if (customCurrencySetting) {
      return customCurrencySetting.staffRatePerStaffPerMonth;
    }
    if (SUPPORTED_CURRENCY_MAP[currency]) {
      return SUPPORTED_CURRENCY_MAP[currency].defaultStaffRatePerStaffPerMonth;
    }
    return settings?.defaultStaffRatePerStaffPerMonth ?? 10;
  }

  async getStatus(academyId: string) {
    const [academy, subscription, rate, staffRate, activeStudentCount, activeStaffCount, pendingInvitationCount] = await Promise.all([
      AcademyModel.findById(academyId).select("name currency country isTrial trialDays trialStartsAt trialEndsAt trialCapacity trialStaffCapacity").lean(),
      AcademySubscriptionModel.findOne({ academyId }).lean(),
      this.getEffectiveRate(academyId),
      this.getEffectiveStaffRate(academyId),
      this.countActiveStudents(academyId),
      this.countActiveStaff(academyId),
      SquadInvitationModel.countDocuments({
        academyId: new mongoose.Types.ObjectId(academyId),
        status: "pending",
      }),
    ]);

    const now = new Date();
    const isTrial = Boolean(subscription?.isTrial || academy?.isTrial);
    const trialEndsAt = subscription?.trialEndsAt || academy?.trialEndsAt;
    const isTrialActive = Boolean(isTrial && trialEndsAt && now <= new Date(trialEndsAt));
    const isTrialExpired = Boolean(isTrial && trialEndsAt && now > new Date(trialEndsAt));

    const provisionedCapacity = isTrialActive
      ? (subscription?.provisionedCapacity || academy?.trialCapacity || 50)
      : (subscription?.provisionedCapacity ?? 0);
    const provisionedStaffCapacity = isTrialActive
      ? (subscription?.provisionedStaffCapacity || academy?.trialStaffCapacity || 5)
      : (subscription?.provisionedStaffCapacity ?? 0);

    const remainingInviteSlots = Math.max(0, provisionedCapacity - (activeStudentCount + pendingInvitationCount));

    const isPaidExpired = Boolean(
      !isTrial &&
      subscription?.currentPeriodEnd &&
      now > new Date(subscription.currentPeriodEnd)
    );

    const isActive = Boolean(
      isTrialActive ||
      (subscription?.status === "active" && !isPaidExpired)
    );

    const isExpired = isTrial ? isTrialExpired : isPaidExpired;

    let effectiveStatus: SubscriptionStatus;
    if (isTrialActive) {
      effectiveStatus = "trialing";
    } else if (isTrialExpired) {
      effectiveStatus = "trial_expired";
    } else if (isPaidExpired) {
      effectiveStatus = "past_due";
    } else {
      effectiveStatus = (subscription?.status as SubscriptionStatus) ?? "incomplete";
    }

    const trialDaysRemaining = isTrialActive && trialEndsAt
      ? Math.max(0, Math.ceil((new Date(trialEndsAt).getTime() - now.getTime()) / (1000 * 60 * 60 * 24)))
      : 0;

    const currency = academy?.currency || subscription?.currency || "INR";
    const currencySymbol = geoLocationService.getCurrencySymbol(currency);
    const country = academy?.country || geoLocationService.getCountryForCurrency(currency);
    const countryName = geoLocationService.getCountryName(country);

    return {
      hasSubscription: Boolean(subscription || isTrial),
      status: effectiveStatus,
      isTrial,
      isTrialActive,
      isTrialExpired,
      trialDaysRemaining,
      trialEndsAt: trialEndsAt ?? null,
      currency,
      currencySymbol,
      country,
      countryName,
      billingInterval: subscription?.billingInterval ?? null,
      provisionedCapacity,
      provisionedStaffCapacity,
      currentPeriodEnd: subscription?.currentPeriodEnd ?? trialEndsAt ?? null,
      ratePerStudentPerDay: subscription?.ratePerStudentPerDay ?? rate,
      staffRatePerStaffPerMonth: subscription?.staffRatePerStaffPerMonth ?? staffRate,
      currentDefaultRate: rate,
      currentDefaultStaffRate: staffRate,
      activeStudentCount,
      pendingInvitationCount,
      remainingInviteSlots,
      activeStaffCount,
      isActive,
      isExpired,
    };
  }

  async getBillingDetails(academyId: string) {
    const [
      academy,
      subscription,
      rate,
      staffRate,
      activeStudentCount,
      activeStaffCount,
      pendingInvitationCount,
      platformSettings,
    ] = await Promise.all([
      AcademyModel.findById(academyId).select("name currency country isTrial trialDays trialStartsAt trialEndsAt trialCapacity trialStaffCapacity subscriptionRateOverride staffRateOverride").lean(),
      AcademySubscriptionModel.findOne({ academyId }).lean(),
      this.getEffectiveRate(academyId),
      this.getEffectiveStaffRate(academyId),
      this.countActiveStudents(academyId),
      this.countActiveStaff(academyId),
      SquadInvitationModel.countDocuments({
        academyId: new mongoose.Types.ObjectId(academyId),
        status: "pending",
      }),
      PlatformSettingsModel.findOne().lean(),
    ]);

    const now = new Date();
    const isTrial = Boolean(subscription?.isTrial || academy?.isTrial);
    const trialEndsAt = subscription?.trialEndsAt || academy?.trialEndsAt;
    const isTrialActive = Boolean(isTrial && trialEndsAt && now <= new Date(trialEndsAt));
    const isTrialExpired = Boolean(isTrial && trialEndsAt && now > new Date(trialEndsAt));

    const provisionedCapacity = isTrialActive
      ? (subscription?.provisionedCapacity || academy?.trialCapacity || 50)
      : (subscription?.provisionedCapacity ?? 0);
    const provisionedStaffCapacity = isTrialActive
      ? (subscription?.provisionedStaffCapacity || academy?.trialStaffCapacity || 5)
      : (subscription?.provisionedStaffCapacity ?? 0);

    const studentUtilization = provisionedCapacity > 0 ? Math.round((activeStudentCount / provisionedCapacity) * 100) : 0;
    const staffUtilization = provisionedStaffCapacity > 0 ? Math.round((activeStaffCount / provisionedStaffCapacity) * 100) : 0;
    const remainingInviteSlots = Math.max(0, provisionedCapacity - (activeStudentCount + pendingInvitationCount));

    const interval = (subscription?.billingInterval as BillingInterval) ?? "month";
    const currentRate = rate;
    const currentStaffRate = staffRate;

    const estimatedRenewalAmount =
      studentPeriodAmount(currentRate, provisionedCapacity, interval) +
      staffPeriodAmount(currentStaffRate, provisionedStaffCapacity, interval);

    const isPaidExpired = Boolean(
      !isTrial &&
      subscription?.currentPeriodEnd &&
      now > new Date(subscription.currentPeriodEnd)
    );

    const isActive = Boolean(
      isTrialActive ||
      (subscription?.status === "active" && !isPaidExpired)
    );

    const isExpired = isTrial ? isTrialExpired : isPaidExpired;

    let effectiveStatus: SubscriptionStatus;
    if (isTrialActive) {
      effectiveStatus = "trialing";
    } else if (isTrialExpired) {
      effectiveStatus = "trial_expired";
    } else if (isPaidExpired) {
      effectiveStatus = "past_due";
    } else {
      effectiveStatus = (subscription?.status as SubscriptionStatus) ?? "incomplete";
    }

    let daysRemainingInCycle = 0;
    const relevantEnd = isTrial ? trialEndsAt : subscription?.currentPeriodEnd;
    if (relevantEnd) {
      const diffMs = new Date(relevantEnd).getTime() - now.getTime();
      daysRemainingInCycle = Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));
    }

    const trialDaysRemaining = isTrialActive && trialEndsAt ? daysRemainingInCycle : 0;

    const currency = academy?.currency || subscription?.currency || "INR";
    const currencySymbol = geoLocationService.getCurrencySymbol(currency);
    const country = academy?.country || geoLocationService.getCountryForCurrency(currency);
    const countryName = geoLocationService.getCountryName(country);

    const alerts: Array<{ type: "warning" | "danger" | "info"; title: string; message: string }> = [];

    if (isTrialActive) {
      alerts.push({
        type: "info",
        title: "Free Trial License Active",
        message: `Your academy is currently operating on a free trial with ${trialDaysRemaining} day(s) remaining. You can test out all operations before purchasing a full software license.`,
      });
    } else if (isTrialExpired) {
      alerts.push({
        type: "danger",
        title: "Free Trial Expired",
        message: "Your academy trial period has ended. Management operations and student rosters are restricted until an operational subscription is purchased.",
      });
    } else if (subscription?.status === "past_due" || isPaidExpired) {
      alerts.push({
        type: "danger",
        title: "Subscription Expired / Past Due",
        message: "Your subscription renewal is overdue. Please renew your plan to restore full operations.",
      });
    }

    if (provisionedCapacity > 0) {
      if (activeStudentCount >= provisionedCapacity) {
        alerts.push({
          type: "danger",
          title: "Student Capacity Limit Reached (100%)",
          message: `Your academy has reached its maximum limit of ${provisionedCapacity} enrolled students. Upgrade your plan to expand capacity.`,
        });
      } else if (studentUtilization >= 80) {
        alerts.push({
          type: "warning",
          title: "Student Capacity Warning (>80%)",
          message: `Student capacity is at ${studentUtilization}% (${activeStudentCount}/${provisionedCapacity} students).`,
        });
      }
    }

    if (provisionedStaffCapacity > 0) {
      if (activeStaffCount >= provisionedStaffCapacity) {
        alerts.push({
          type: "danger",
          title: "Staff Capacity Limit Reached (100%)",
          message: `Your academy has reached its limit of ${provisionedStaffCapacity} staff members.`,
        });
      } else if (staffUtilization >= 80) {
        alerts.push({
          type: "warning",
          title: "Staff Capacity Warning (>80%)",
          message: `Staff capacity is at ${staffUtilization}% (${activeStaffCount}/${provisionedStaffCapacity} staff members).`,
        });
      }
    }

    let invoices: any[] = [];
    if (subscription?.stripeCustomerId) {
      try {
        invoices = await stripeService.listInvoices(subscription.stripeCustomerId);
      } catch {
        invoices = [];
      }
    }

    const recordedPayments = (subscription?.payments || []).map((p: any) => ({
      id: p.paymentId || p.orderId || p._id?.toString(),
      number: p.receiptNumber || `INV-${(p.paymentId || p.orderId || "PAY").slice(-8).toUpperCase()}`,
      amountPaid: p.amount,
      currency: p.currency || currency,
      amountDue: 0,
      status: p.status || "paid",
      created: (p.paidAt ? new Date(p.paidAt) : (subscription as any).createdAt || new Date()).toISOString(),
      invoicePdf: null,
      hostedInvoiceUrl: null,
    }));

    if (recordedPayments.length === 0 && subscription?.razorpayPaymentId) {
      const legacyAmount =
        studentPeriodAmount(currentRate, provisionedCapacity, interval) +
        staffPeriodAmount(currentStaffRate, provisionedStaffCapacity, interval);
      recordedPayments.push({
        id: subscription.razorpayPaymentId,
        number: `INV-${subscription.razorpayPaymentId.slice(-8).toUpperCase()}`,
        amountPaid: legacyAmount,
        currency,
        amountDue: 0,
        status: "paid",
        created: ((subscription as any).updatedAt || (subscription as any).createdAt || new Date()).toISOString(),
        invoicePdf: null,
        hostedInvoiceUrl: null,
      });
    }

    const allTransactions = [...recordedPayments, ...invoices].sort(
      (a, b) => new Date(b.created).getTime() - new Date(a.created).getTime()
    );

    return {
      hasSubscription: Boolean(subscription || isTrial),
      status: effectiveStatus,
      isTrial,
      isTrialActive,
      isTrialExpired,
      trialDaysRemaining,
      trialEndsAt: trialEndsAt ?? null,
      currency,
      currencySymbol,
      country,
      countryName,
      isActive,
      isExpired,
      billingInterval: interval,
      currentPeriodEnd: subscription?.currentPeriodEnd ?? trialEndsAt ?? null,
      daysRemainingInCycle: isExpired ? 0 : daysRemainingInCycle,
      provisionedCapacity,
      activeStudentCount,
      studentUtilization,
      remainingStudentSlots: Math.max(0, provisionedCapacity - activeStudentCount),
      pendingInvitationCount,
      remainingInviteSlots,
      provisionedStaffCapacity,
      activeStaffCount,
      staffUtilization,
      remainingStaffSlots: Math.max(0, provisionedStaffCapacity - activeStaffCount),
      ratePerStudentPerDay: currentRate,
      staffRatePerStaffPerMonth: currentStaffRate,
      platformDefaultRate: platformSettings?.defaultRatePerStudentPerDay ?? 1,
      platformDefaultStaffRate: platformSettings?.defaultStaffRatePerStaffPerMonth ?? 10,
      hasCustomRate: academy?.subscriptionRateOverride !== undefined && academy?.subscriptionRateOverride !== null,
      hasCustomStaffRate: academy?.staffRateOverride !== undefined && academy?.staffRateOverride !== null,
      estimatedRenewalRupees: estimatedRenewalAmount, // kept for backward-compatibility
      estimatedRenewalAmount,
      alerts,
      transactions: allTransactions,
    };
  }

  async assertCanAddStudent(academyId: string): Promise<void> {
    const [academy, subscription, activeStudentCount] = await Promise.all([
      AcademyModel.findById(academyId).select("name isTrial trialEndsAt trialCapacity").lean(),
      AcademySubscriptionModel.findOne({ academyId }).lean(),
      this.countActiveStudents(academyId),
    ]);

    const now = new Date();
    const isTrial = Boolean(subscription?.isTrial || academy?.isTrial);
    const trialEndsAt = subscription?.trialEndsAt || academy?.trialEndsAt;

    if (isTrial) {
      if (trialEndsAt && now > new Date(trialEndsAt)) {
        throw new TrialExpiredError("Academy trial period has expired. Please subscribe to continue adding students.");
      }
      const capacity = subscription?.provisionedCapacity || academy?.trialCapacity || 50;
      if (activeStudentCount >= capacity) {
        throw new SubscriptionCapacityExceededError(
          `Trial limit reached (${capacity} students). Please upgrade your subscription plan to enroll more students.`
        );
      }
      return;
    }

    if (!subscription || subscription.status !== "active") {
      throw new SubscriptionRequiredError();
    }
    if (subscription.currentPeriodEnd && now > new Date(subscription.currentPeriodEnd)) {
      throw new SubscriptionRequiredError("Subscription period has expired. Please renew your subscription.");
    }
    if (activeStudentCount >= subscription.provisionedCapacity) {
      throw new SubscriptionCapacityExceededError(
        `This academy is subscribed for ${subscription.provisionedCapacity} students and already has ${activeStudentCount}. Increase your plan to add more.`
      );
    }
  }

  async assertCanInviteStudent(academyId: string): Promise<void> {
    const [academy, subscription, activeStudentCount, pendingInvitationCount] = await Promise.all([
      AcademyModel.findById(academyId).select("name isTrial trialEndsAt trialCapacity").lean(),
      AcademySubscriptionModel.findOne({ academyId }).lean(),
      this.countActiveStudents(academyId),
      SquadInvitationModel.countDocuments({
        academyId: new mongoose.Types.ObjectId(academyId),
        status: "pending",
      }),
    ]);

    const now = new Date();
    const isTrial = Boolean(subscription?.isTrial || academy?.isTrial);
    const trialEndsAt = subscription?.trialEndsAt || academy?.trialEndsAt;
    const capacity = isTrial
      ? (subscription?.provisionedCapacity || academy?.trialCapacity || 50)
      : (subscription?.provisionedCapacity ?? 0);

    if (isTrial) {
      if (trialEndsAt && now > new Date(trialEndsAt)) {
        throw new TrialExpiredError("Academy trial period has expired. Please subscribe to invite students.");
      }
      if (activeStudentCount + pendingInvitationCount >= capacity) {
        const allowedNewInvites = Math.max(0, capacity - activeStudentCount);
        throw new SubscriptionCapacityExceededError(
          `Trial limit reached (${capacity} players). You currently have ${activeStudentCount} enrolled players and ${pendingInvitationCount} pending invitations. Upgrade to invite more.`
        );
      }
      return;
    }

    if (!subscription || subscription.status !== "active") {
      throw new SubscriptionRequiredError();
    }
    if (subscription.currentPeriodEnd && now > new Date(subscription.currentPeriodEnd)) {
      throw new SubscriptionRequiredError("Subscription period has expired. Please renew your subscription.");
    }
    if (activeStudentCount + pendingInvitationCount >= subscription.provisionedCapacity) {
      const allowedNewInvites = Math.max(0, subscription.provisionedCapacity - activeStudentCount);
      throw new SubscriptionCapacityExceededError(
        `Player limit reached. Your subscription plan allows up to ${subscription.provisionedCapacity} players. You currently have ${activeStudentCount} enrolled players and ${pendingInvitationCount} pending invitation${pendingInvitationCount === 1 ? "" : "s"}. You can only invite up to ${allowedNewInvites} player${allowedNewInvites === 1 ? "" : "s"} total.`
      );
    }
  }

  async assertCanAddStaff(academyId: string): Promise<void> {
    const [academy, subscription, activeStaffCount] = await Promise.all([
      AcademyModel.findById(academyId).select("name isTrial trialEndsAt trialStaffCapacity").lean(),
      AcademySubscriptionModel.findOne({ academyId }).lean(),
      this.countActiveStaff(academyId),
    ]);

    const now = new Date();
    const isTrial = Boolean(subscription?.isTrial || academy?.isTrial);
    const trialEndsAt = subscription?.trialEndsAt || academy?.trialEndsAt;

    if (isTrial) {
      if (trialEndsAt && now > new Date(trialEndsAt)) {
        throw new TrialExpiredError("Academy trial period has expired. Please subscribe to continue adding staff members.");
      }
      const capacity = subscription?.provisionedStaffCapacity || academy?.trialStaffCapacity || 5;
      if (activeStaffCount >= capacity) {
        throw new SubscriptionCapacityExceededError(
          `Trial staff quota reached (${capacity} staff). Upgrade your plan to add more staff.`
        );
      }
      return;
    }

    if (!subscription || subscription.status !== "active") {
      throw new SubscriptionRequiredError();
    }
    if (subscription.currentPeriodEnd && now > new Date(subscription.currentPeriodEnd)) {
      throw new SubscriptionRequiredError("Subscription period has expired. Please renew your subscription.");
    }
    if (activeStaffCount >= subscription.provisionedStaffCapacity) {
      throw new SubscriptionCapacityExceededError(
        `This academy is billed for ${subscription.provisionedStaffCapacity} staff seats and already has ${activeStaffCount}. Increase your staff capacity to add more.`
      );
    }
  }

  async createCheckoutSession(
    academyId: string,
    dto: { capacity: number; staffCapacity: number; billingInterval: BillingInterval },
    requesterId: string,
  ): Promise<{ url: string }> {
    if (dto.capacity < 1) throw new BadRequestError("Capacity must be at least 1 student");
    if (dto.staffCapacity < 0) throw new BadRequestError("Staff capacity can't be negative");

    const existing = await AcademySubscriptionModel.findOne({ academyId });
    if (existing && existing.status === "active") {
      throw new BadRequestError(
        "This academy already has an active subscription — use the upgrade flow to change capacity instead.",
      );
    }

    const [academy, requester] = await Promise.all([
      AcademyModel.findById(academyId).select("name subscriptionRateOverride staffRateOverride").lean(),
      UserModel.findById(requesterId).select("email firstName lastName").lean(),
    ]);
    if (!academy) throw new NotFoundError("Academy");
    if (!requester) throw new NotFoundError("Requester");

    const rate = await this.getEffectiveRate(academyId);
    const staffRate = await this.getEffectiveStaffRate(academyId);
    // Combined into a single Stripe price line rather than two separate
    // subscription items — much simpler and more robust to keep in sync
    // (no item-add/item-reorder bookkeeping on every future upgrade).
    // The pricing modal breaks the total back out into "Students" and
    // "Staff" lines for the manager, even though Stripe only sees one.
    const totalRupees =
      studentRupeeAmount(rate, dto.capacity, dto.billingInterval) +
      staffRupeeAmount(staffRate, dto.staffCapacity, dto.billingInterval);
    const unitAmountPaise = toPaise(totalRupees);

    const customerId = await stripeService.findOrCreateCustomer({
      existingCustomerId: existing?.stripeCustomerId,
      email: requester.email,
      name: `${requester.firstName} ${requester.lastName}`.trim() || requester.email,
      academyId,
    });

    const session = await stripeService.createSubscriptionCheckoutSession({
      customerId,
      academyId,
      billingInterval: dto.billingInterval,
      unitAmountPaise,
      capacity: dto.capacity,
      ratePerStudentPerDay: rate,
      successUrl: `${config.clientUrl}/subscription/success?session_id={CHECKOUT_SESSION_ID}`,
      cancelUrl: `${config.clientUrl}/subscription/cancelled`,
    });

    await AcademySubscriptionModel.findOneAndUpdate(
      { academyId },
      {
        academyId,
        stripeCustomerId: customerId,
        stripeCheckoutSessionId: session.id,
        billingInterval: dto.billingInterval,
        ratePerStudentPerDay: rate,
        staffRatePerStaffPerMonth: staffRate,
        provisionedCapacity: dto.capacity,
        provisionedStaffCapacity: dto.staffCapacity,
        status: "incomplete",
      },
      { upsert: true, new: true },
    );

    if (!session.url) throw new BadRequestError("Stripe did not return a checkout URL");
    return { url: session.url };
  }

  async createRazorpayOrder(
    academyId: string,
    dto: { capacity: number; staffCapacity: number; billingInterval: BillingInterval; isRenewal?: boolean },
    requesterUserId: string,
  ): Promise<{
    orderId: string;
    amount: number;
    currency: string;
    keyId: string;
    academyName: string;
    totalAmount: number;
    totalRupees: number;
    currencySymbol: string;
  }> {
    const [academy, existing, requester] = await Promise.all([
      AcademyModel.findById(academyId).select("name currency country").lean(),
      AcademySubscriptionModel.findOne({ academyId }),
      UserModel.findById(requesterUserId).select("email firstName lastName").lean(),
    ]);
    if (!academy) throw new NotFoundError("Academy");
    if (!requester) throw new NotFoundError("Requester");

    const currency = (academy.currency || "INR").toUpperCase();
    const rate = await this.getEffectiveRate(academyId);
    const staffRate = await this.getEffectiveStaffRate(academyId);

    const totalAmount =
      studentPeriodAmount(rate, dto.capacity, dto.billingInterval) +
      staffPeriodAmount(staffRate, dto.staffCapacity, dto.billingInterval);
    const unitAmountPaise = toPaise(totalAmount);

    const order = await razorpayService.createOrder({
      amountPaise: unitAmountPaise,
      currency,
      receipt: `sub_${academyId.slice(-10)}_${Date.now().toString().slice(-6)}`,
      notes: {
        academyId,
        currency,
        capacity: dto.capacity,
        staffCapacity: dto.staffCapacity,
        billingInterval: dto.billingInterval,
        type: dto.isRenewal ? "renewal" : "new_subscription",
      },
    });

    await AcademySubscriptionModel.findOneAndUpdate(
      { academyId },
      {
        academyId,
        currency,
        razorpayOrderId: order.id,
        billingInterval: dto.billingInterval,
        ratePerStudentPerDay: rate,
        staffRatePerStaffPerMonth: staffRate,
        provisionedCapacity: dto.capacity,
        provisionedStaffCapacity: dto.staffCapacity,
        status:
          existing?.status === "active" &&
          existing.currentPeriodEnd &&
          new Date() < new Date(existing.currentPeriodEnd)
            ? "active"
            : "incomplete",
      },
      { upsert: true, new: true },
    );

    return {
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
      keyId: razorpayService.getKeyId(),
      academyName: academy.name,
      totalAmount,
      totalRupees: totalAmount, // backward compatibility
      currencySymbol: geoLocationService.getCurrencySymbol(currency),
    };
  }

  async verifyRazorpayPayment(params: {
    academyId: string;
    orderId: string;
    paymentId: string;
    signature: string;
  }): Promise<{ status: string; isActive: boolean }> {
    const { academyId, orderId, paymentId, signature } = params;
    const isValid = razorpayService.verifyPaymentSignature({
      orderId,
      paymentId,
      signature,
    });
    if (!isValid) {
      throw new BadRequestError("Invalid Razorpay payment signature");
    }

    const [academy, subscription] = await Promise.all([
      AcademyModel.findById(academyId).select("name currency").lean(),
      AcademySubscriptionModel.findOne({ academyId }),
    ]);

    if (!subscription) {
      throw new NotFoundError("Academy subscription not found");
    }

    const currency = (academy?.currency || subscription.currency || "INR").toUpperCase();
    const rate = await this.getEffectiveRate(academyId);
    const staffRate = await this.getEffectiveStaffRate(academyId);
    const interval = (subscription.billingInterval as BillingInterval) || "month";

    const days = DAYS_IN_PERIOD[interval] || 30;
    const now = new Date();
    const isRenewal = Boolean(
      subscription.currentPeriodEnd &&
      new Date(subscription.currentPeriodEnd) > now &&
      !subscription.isTrial
    );

    if (isRenewal) {
      subscription.currentPeriodEnd = new Date(
        new Date(subscription.currentPeriodEnd!).getTime() + days * 24 * 60 * 60 * 1000
      );
    } else {
      subscription.currentPeriodEnd = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);
    }

    subscription.status = "active";
    subscription.isTrial = false; // Transitioned to paid subscription!
    subscription.currency = currency;
    subscription.razorpayOrderId = orderId;
    subscription.razorpayPaymentId = paymentId;
    subscription.razorpaySignature = signature;
    subscription.ratePerStudentPerDay = rate;
    subscription.staffRatePerStaffPerMonth = staffRate;

    const amountPaid =
      studentPeriodAmount(rate, subscription.provisionedCapacity, interval) +
      staffPeriodAmount(staffRate, subscription.provisionedStaffCapacity, interval);

    subscription.payments = subscription.payments || [];
    subscription.payments.unshift({
      orderId,
      paymentId,
      amount: amountPaid,
      currency,
      status: "paid",
      billingInterval: interval,
      studentCapacity: subscription.provisionedCapacity,
      staffCapacity: subscription.provisionedStaffCapacity,
      type: isRenewal ? "renewal" : "subscription",
      paidAt: now,
      receiptNumber: `INV-${paymentId.slice(-8).toUpperCase()}`,
    });

    await subscription.save();

    // Also update academy isTrial flag
    await AcademyModel.findByIdAndUpdate(academyId, { isTrial: false });

    const symbol = geoLocationService.getCurrencySymbol(currency);
    await notificationService.notifySuperAdmins({
      type: "payment_received",
      title: "Academy Subscription Payment Received",
      body: `${academy?.name || "An academy"} has completed payment of ${symbol} ${amountPaid} (${currency}) for their ${subscription.billingInterval}ly subscription.`,
      metadata: { academyId, orderId, paymentId, currency, amount: String(amountPaid) },
    });

    return { status: "active", isActive: true };
  }


  // Increases student and/or staff capacity on an already-active
  // subscription by repricing it in place (see
  // StripeService.updateSubscriptionCapacity) — no new checkout needed
  // since a payment method is already on file. Either capacity can stay
  // the same as it currently is; at least one must increase.
  async upgradeCapacity(
    academyId: string,
    dto: { capacity: number; staffCapacity: number },
  ): Promise<{ provisionedCapacity: number; provisionedStaffCapacity: number }> {
    const subscription = await AcademySubscriptionModel.findOne({ academyId });
    if (!subscription || subscription.status !== "active" || !subscription.stripeSubscriptionId) {
      throw new BadRequestError("This academy doesn't have an active subscription to upgrade");
    }
    if (dto.capacity < subscription.provisionedCapacity || dto.staffCapacity < subscription.provisionedStaffCapacity) {
      throw new BadRequestError("New capacity can't be lower than the current capacity");
    }
    if (dto.capacity === subscription.provisionedCapacity && dto.staffCapacity === subscription.provisionedStaffCapacity) {
      throw new BadRequestError("Choose a higher student or staff capacity to upgrade");
    }

    const rate = await this.getEffectiveRate(academyId);
    const staffRate = await this.getEffectiveStaffRate(academyId);
    const totalRupees =
      studentRupeeAmount(rate, dto.capacity, subscription.billingInterval) +
      staffRupeeAmount(staffRate, dto.staffCapacity, subscription.billingInterval);
    const unitAmountPaise = toPaise(totalRupees);

    await stripeService.updateSubscriptionCapacity({
      subscriptionId: subscription.stripeSubscriptionId,
      academyId,
      billingInterval: subscription.billingInterval,
      unitAmountPaise,
      capacity: dto.capacity,
      ratePerStudentPerDay: rate,
    });

    subscription.provisionedCapacity = dto.capacity;
    subscription.provisionedStaffCapacity = dto.staffCapacity;
    subscription.ratePerStudentPerDay = rate;
    subscription.staffRatePerStaffPerMonth = staffRate;
    await subscription.save();

    return {
      provisionedCapacity: subscription.provisionedCapacity,
      provisionedStaffCapacity: subscription.provisionedStaffCapacity,
    };
  }

  async verifyCheckoutSession(sessionId: string, academyId?: string): Promise<{ status: string; isActive: boolean }> {
    if (!sessionId) {
      throw new BadRequestError("Session ID is required to verify checkout");
    }

    const session = await stripeService.retrieveCheckoutSession(sessionId);
    const resolvedAcademyId = session.metadata?.academyId || academyId;
    if (!resolvedAcademyId) {
      throw new BadRequestError("Academy ID could not be identified from checkout session");
    }

    const isPaid = session.payment_status === "paid" || session.status === "complete";
    if (!isPaid) {
      return { status: "incomplete", isActive: false };
    }

    const subscription = await AcademySubscriptionModel.findOne({ academyId: resolvedAcademyId });
    if (!subscription) {
      throw new NotFoundError("Academy subscription not found");
    }

    const subId = typeof session.subscription === "string" ? session.subscription : (session.subscription as any)?.id;
    subscription.status = "active";
    if (subId) subscription.stripeSubscriptionId = subId;

    if (!subscription.currentPeriodEnd) {
      const days = subscription.billingInterval === "year" ? 365 : 30;
      subscription.currentPeriodEnd = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
    }
    await subscription.save();

    // Alert Super Admins about the payment received!
    const academy = await AcademyModel.findById(resolvedAcademyId).select("name").lean();
    const amountRupees = session.amount_total ? session.amount_total / 100 : 0;
    await notificationService.notifySuperAdmins({
      type: "payment_received",
      title: "Academy Subscription Payment Received",
      body: `${academy?.name || "An academy"} has completed payment of ₹${amountRupees.toLocaleString("en-IN")} for their ${subscription.billingInterval}ly subscription (${subscription.provisionedCapacity} students, ${subscription.provisionedStaffCapacity} staff).`,
      metadata: { academyId: resolvedAcademyId, amount: String(amountRupees), sessionId },
    });

    return { status: "active", isActive: true };
  }

  async handleWebhookEvent(event: Stripe.Event): Promise<void> {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const nfcRequestId = session.metadata?.nfcRequestId;
        if (nfcRequestId) {
          const nfcRequest = await NfcCardRequestModel.findById(nfcRequestId);
          if (nfcRequest && ["pending", "approved"].includes(nfcRequest.status)) {
            nfcRequest.status = "paid";
            nfcRequest.paidAt = new Date();
            nfcRequest.stripePaymentIntentId =
              typeof session.payment_intent === "string"
                ? session.payment_intent
                : (session.payment_intent as any)?.id;
            await nfcRequest.save();

            await notificationService.send({
              userIds: [nfcRequest.requesterId.toString()],
              type: "nfc_order_paid",
              title: "Payment Confirmed — NFC Order Initiated!",
              body: `Payment of ₹${nfcRequest.totalAmount} for ${nfcRequest.quantity} card(s) was received. Production has started.`,
              data: { requestId: nfcRequest._id.toString() },
            });
          }
          break;
        }

        const academyId = session.metadata?.academyId;
        if (!academyId) break;
        const subId = typeof session.subscription === "string" ? session.subscription : undefined;
        const subscription = await AcademySubscriptionModel.findOneAndUpdate(
          { academyId },
          {
            ...(subId && { stripeSubscriptionId: subId }),
            status: "active",
          },
          { new: true },
        );
        const academy = await AcademyModel.findById(academyId).select("name").lean();
        const amountRupees = session.amount_total ? session.amount_total / 100 : 0;
        await notificationService.notifySuperAdmins({
          type: "payment_received",
          title: "Academy Subscription Payment Received",
          body: `${academy?.name || "An academy"} has completed payment of ₹${amountRupees.toLocaleString("en-IN")} for their ${subscription?.billingInterval || "month"}ly subscription (${subscription?.provisionedCapacity || 0} students, ${subscription?.provisionedStaffCapacity || 0} staff).`,
          metadata: { academyId, amount: String(amountRupees), sessionId: session.id },
        });
        break;
      }
      case "customer.subscription.updated":
      case "customer.subscription.created": {
        const sub = event.data.object as Stripe.Subscription;
        const academyId = sub.metadata?.academyId;
        if (!academyId) break;
        const status = this.mapStripeStatus(sub.status);
        await AcademySubscriptionModel.findOneAndUpdate(
          { academyId },
          {
            status,
            currentPeriodEnd: new Date(sub.current_period_end * 1000),
          },
        );
        break;
      }
      case "customer.subscription.deleted": {
        const sub = event.data.object as Stripe.Subscription;
        const academyId = sub.metadata?.academyId;
        if (!academyId) break;
        await AcademySubscriptionModel.findOneAndUpdate({ academyId }, { status: "canceled" });
        break;
      }
      case "invoice.payment_failed": {
        const invoice = event.data.object as Stripe.Invoice;
        const subscriptionId = typeof invoice.subscription === "string" ? invoice.subscription : undefined;
        if (!subscriptionId) break;
        await AcademySubscriptionModel.findOneAndUpdate(
          { stripeSubscriptionId: subscriptionId },
          { status: "past_due" },
        );
        break;
      }
      default:
        break;
    }
  }

  private mapStripeStatus(stripeStatus: Stripe.Subscription.Status): SubscriptionStatus {
    switch (stripeStatus) {
      case "active":
      case "trialing":
        return "active";
      case "past_due":
        return "past_due";
      case "canceled":
      case "incomplete_expired":
        return "canceled";
      case "unpaid":
        return "unpaid";
      default:
        return "incomplete";
    }
  }

  // ─── super_admin platform pricing config ──────────────────────────────

  async getPlatformDefaultRate(): Promise<number> {
    const settings = await PlatformSettingsModel.findOne().lean();
    return settings?.defaultRatePerStudentPerDay ?? 1;
  }

  async setPlatformDefaultRate(rate: number, updatedBy: string): Promise<number> {
    if (rate < 0) throw new BadRequestError("Rate cannot be negative");
    const updated = await PlatformSettingsModel.findOneAndUpdate(
      {},
      { defaultRatePerStudentPerDay: rate, updatedBy },
      { upsert: true, new: true },
    );
    return updated.defaultRatePerStudentPerDay;
  }

  async getPlatformDefaultStaffRate(): Promise<number> {
    const settings = await PlatformSettingsModel.findOne().lean();
    return settings?.defaultStaffRatePerStaffPerMonth ?? 10;
  }

  async setPlatformDefaultStaffRate(rate: number, updatedBy: string): Promise<number> {
    if (rate < 0) throw new BadRequestError("Rate cannot be negative");
    const updated = await PlatformSettingsModel.findOneAndUpdate(
      {},
      { defaultStaffRatePerStaffPerMonth: rate, updatedBy },
      { upsert: true, new: true },
    );
    return updated.defaultStaffRatePerStaffPerMonth;
  }

  async getPlatformTransferWall(): Promise<boolean> {
    const settings = await PlatformSettingsModel.findOne().lean();
    return settings?.transferWallEnabled ?? true;
  }

  async setPlatformTransferWall(enabled: boolean, updatedBy: string): Promise<boolean> {
    const updated = await PlatformSettingsModel.findOneAndUpdate(
      {},
      { transferWallEnabled: enabled, updatedBy },
      { upsert: true, new: true },
    );
    return updated.transferWallEnabled;
  }

  async getPlatformCurrencies(): Promise<CurrencyPricing[]> {
    const settings = await PlatformSettingsModel.findOne().lean();
    const existing = settings?.currencyPricing || [];
    const map = new Map<string, CurrencyPricing>();

    // Seed defaults from SUPPORTED_CURRENCY_MAP
    Object.values(SUPPORTED_CURRENCY_MAP).forEach((item) => {
      map.set(item.currency.toUpperCase(), {
        currency: item.currency,
        ratePerStudentPerDay: item.defaultRatePerStudentPerDay,
        staffRatePerStaffPerMonth: item.defaultStaffRatePerStaffPerMonth,
        symbol: item.symbol,
        countryCode: item.countryCode,
        countryName: item.countryName,
        isActive: true,
      });
    });

    // Override with DB values
    existing.forEach((item) => {
      map.set(item.currency.toUpperCase(), item);
    });

    return Array.from(map.values());
  }

  async setPlatformCurrencyRate(
    data: {
      currency: string;
      ratePerStudentPerDay: number;
      staffRatePerStaffPerMonth: number;
      symbol?: string;
      countryCode?: string;
      countryName?: string;
      isActive?: boolean;
    },
    updatedBy: string
  ): Promise<CurrencyPricing[]> {
    const currency = data.currency.trim().toUpperCase();
    if (!currency) throw new BadRequestError("Currency code is required");
    if (data.ratePerStudentPerDay < 0) throw new BadRequestError("Student rate cannot be negative");
    if (data.staffRatePerStaffPerMonth < 0) throw new BadRequestError("Staff rate cannot be negative");

    const defaultInfo = SUPPORTED_CURRENCY_MAP[currency];
    const symbol = data.symbol || defaultInfo?.symbol || currency;
    const countryCode = (data.countryCode || defaultInfo?.countryCode || "IN").toUpperCase();
    const countryName = data.countryName || defaultInfo?.countryName || countryCode;
    const isActive = data.isActive ?? true;

    let settings = await PlatformSettingsModel.findOne();
    if (!settings) {
      settings = await PlatformSettingsModel.create({
        defaultRatePerStudentPerDay: 1,
        defaultStaffRatePerStaffPerMonth: 10,
        defaultNfcCardPrice: 299,
        defaultNfcCustomCardPrice: 399,
        transferWallEnabled: true,
        defaultTrialDays: 14,
        defaultTrialCapacity: 50,
        defaultTrialStaffCapacity: 5,
        currencyPricing: [],
      });
    }

    const pricingList = settings.currencyPricing || [];
    const idx = pricingList.findIndex((p) => p.currency.toUpperCase() === currency);
    const newEntry: CurrencyPricing = {
      currency,
      ratePerStudentPerDay: data.ratePerStudentPerDay,
      staffRatePerStaffPerMonth: data.staffRatePerStaffPerMonth,
      symbol,
      countryCode,
      countryName,
      isActive,
    };

    if (idx >= 0) {
      pricingList[idx] = newEntry;
    } else {
      pricingList.push(newEntry);
    }

    settings.currencyPricing = pricingList;
    settings.updatedBy = new mongoose.Types.ObjectId(updatedBy);
    await settings.save();

    return this.getPlatformCurrencies();
  }

  async getPlatformTrialDefaults(): Promise<{
    defaultTrialDays: number;
    defaultTrialCapacity: number;
    defaultTrialStaffCapacity: number;
  }> {
    const settings = await PlatformSettingsModel.findOne().lean();
    return {
      defaultTrialDays: settings?.defaultTrialDays ?? 14,
      defaultTrialCapacity: settings?.defaultTrialCapacity ?? 50,
      defaultTrialStaffCapacity: settings?.defaultTrialStaffCapacity ?? 5,
    };
  }

  async setPlatformTrialDefaults(
    data: {
      defaultTrialDays?: number;
      defaultTrialCapacity?: number;
      defaultTrialStaffCapacity?: number;
    },
    updatedBy: string
  ): Promise<{
    defaultTrialDays: number;
    defaultTrialCapacity: number;
    defaultTrialStaffCapacity: number;
  }> {
    const updates: any = { updatedBy };
    if (data.defaultTrialDays !== undefined) {
      if (data.defaultTrialDays < 1) throw new BadRequestError("Trial days must be at least 1");
      updates.defaultTrialDays = data.defaultTrialDays;
    }
    if (data.defaultTrialCapacity !== undefined) {
      if (data.defaultTrialCapacity < 1) throw new BadRequestError("Trial player capacity must be at least 1");
      updates.defaultTrialCapacity = data.defaultTrialCapacity;
    }
    if (data.defaultTrialStaffCapacity !== undefined) {
      if (data.defaultTrialStaffCapacity < 0) throw new BadRequestError("Trial staff capacity cannot be negative");
      updates.defaultTrialStaffCapacity = data.defaultTrialStaffCapacity;
    }

    const updated = await PlatformSettingsModel.findOneAndUpdate({}, updates, {
      upsert: true,
      new: true,
    });

    return {
      defaultTrialDays: updated.defaultTrialDays,
      defaultTrialCapacity: updated.defaultTrialCapacity,
      defaultTrialStaffCapacity: updated.defaultTrialStaffCapacity,
    };
  }
}
// src/application/use-cases/subscription/AcademySubscriptionUseCases.ts
import Stripe from "stripe";
import {
  AcademySubscriptionModel,
  SubscriptionStatus,
} from "../../../infrastructure/database/models/AcademySubscription.model";
import { PlatformSettingsModel } from "../../../infrastructure/database/models/PlatformSettings.model";
import { AcademyModel } from "../../../infrastructure/database/models/Academy.model";
import { UserModel } from "../../../infrastructure/database/models/User.model";
import { StudentModel } from "../../../infrastructure/database/models/Student.model";
import { EmployeeModel } from "../../../infrastructure/database/models/Employee.model";
import { FranchiseModel } from "../../../infrastructure/database/models/Franchise.model";
import { stripeService } from "../../../infrastructure/services/StripeService";
import { config } from "../../../config/app.config";
import {
  NotFoundError,
  BadRequestError,
  ForbiddenError,
  SubscriptionRequiredError,
  SubscriptionCapacityExceededError,
} from "../../../shared/errors/AppError";

const DAYS_IN_PERIOD: Record<"month" | "year", number> = {
  // A flat 30/365 is used rather than the exact days in the calendar
  // month the subscription happens to start in, so the quoted price in
  // the pricing modal always matches what Stripe actually charges —
  // Stripe's own "month" interval already handles the real calendar
  // billing date, this constant is only used to *compute* the rate-based
  // total, not to schedule the renewal.
  month: 30,
  year: 365,
};

function studentRupeeAmount(ratePerStudentPerDay: number, capacity: number, interval: "month" | "year"): number {
  return ratePerStudentPerDay * capacity * DAYS_IN_PERIOD[interval];
}

// Staff billing is a flat ₹/staff/*month* rate (not a day-rate like
// students), so a yearly plan is simply 12 months of it — there's no
// day-count subtlety to mirror here the way there is for students.
function staffRupeeAmount(staffRatePerMonth: number, staffCapacity: number, interval: "month" | "year"): number {
  return staffRatePerMonth * staffCapacity * (interval === "year" ? 12 : 1);
}

function toPaise(rupees: number): number {
  return Math.round(rupees * 100);
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
    const academy = await AcademyModel.findById(academyId).select("subscriptionRateOverride").lean();
    if (academy?.subscriptionRateOverride !== undefined && academy.subscriptionRateOverride !== null) {
      return academy.subscriptionRateOverride;
    }
    const settings = await PlatformSettingsModel.findOne().lean();
    return settings?.defaultRatePerStudentPerDay ?? 1;
  }

  async getEffectiveStaffRate(academyId: string): Promise<number> {
    const academy = await AcademyModel.findById(academyId).select("staffRateOverride").lean();
    if (academy?.staffRateOverride !== undefined && academy.staffRateOverride !== null) {
      return academy.staffRateOverride;
    }
    const settings = await PlatformSettingsModel.findOne().lean();
    return settings?.defaultStaffRatePerStaffPerMonth ?? 10;
  }

  async getStatus(academyId: string) {
    const [subscription, rate, staffRate, activeStudentCount, activeStaffCount] = await Promise.all([
      AcademySubscriptionModel.findOne({ academyId }).lean(),
      this.getEffectiveRate(academyId),
      this.getEffectiveStaffRate(academyId),
      this.countActiveStudents(academyId),
      this.countActiveStaff(academyId),
    ]);

    return {
      hasSubscription: !!subscription,
      status: subscription?.status ?? null,
      billingInterval: subscription?.billingInterval ?? null,
      provisionedCapacity: subscription?.provisionedCapacity ?? 0,
      provisionedStaffCapacity: subscription?.provisionedStaffCapacity ?? 0,
      currentPeriodEnd: subscription?.currentPeriodEnd ?? null,
      ratePerStudentPerDay: subscription?.ratePerStudentPerDay ?? rate,
      staffRatePerStaffPerMonth: subscription?.staffRatePerStaffPerMonth ?? staffRate,
      currentDefaultRate: rate,
      currentDefaultStaffRate: staffRate,
      activeStudentCount,
      activeStaffCount,
      isActive: subscription?.status === "active",
    };
  }

  // The gate every mutating route that adds a player relies on (see
  // StudentUseCases.createStudent). Kept as its own method so it can be
  // reused anywhere else that needs the same two checks without
  // duplicating the query logic.
  async assertCanAddStudent(academyId: string): Promise<void> {
    const subscription = await AcademySubscriptionModel.findOne({ academyId }).lean();
    if (!subscription || subscription.status !== "active") {
      throw new SubscriptionRequiredError();
    }
    const activeStudentCount = await this.countActiveStudents(academyId);
    if (activeStudentCount >= subscription.provisionedCapacity) {
      throw new SubscriptionCapacityExceededError(
        `This academy is subscribed for ${subscription.provisionedCapacity} students and already has ${activeStudentCount}. Increase your plan to add more.`,
      );
    }
  }

  // Same idea as assertCanAddStudent, for a 'staff'-type employee (see
  // Employee.employeeType) — called from EmployeeUseCases.createEmployee.
  async assertCanAddStaff(academyId: string): Promise<void> {
    const subscription = await AcademySubscriptionModel.findOne({ academyId }).lean();
    if (!subscription || subscription.status !== "active") {
      throw new SubscriptionRequiredError();
    }
    const activeStaffCount = await this.countActiveStaff(academyId);
    if (activeStaffCount >= subscription.provisionedStaffCapacity) {
      throw new SubscriptionCapacityExceededError(
        `This academy is billed for ${subscription.provisionedStaffCapacity} staff seats and already has ${activeStaffCount}. Increase your staff capacity to add more.`,
      );
    }
  }

  async createCheckoutSession(
    academyId: string,
    dto: { capacity: number; staffCapacity: number; billingInterval: "month" | "year" },
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

  async handleWebhookEvent(event: Stripe.Event): Promise<void> {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const academyId = session.metadata?.academyId;
        if (!academyId || typeof session.subscription !== "string") break;
        await AcademySubscriptionModel.findOneAndUpdate(
          { academyId },
          {
            stripeSubscriptionId: session.subscription,
            status: "active",
          },
        );
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
}
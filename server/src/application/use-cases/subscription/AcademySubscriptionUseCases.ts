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

function toRupeeAmount(ratePerStudentPerDay: number, capacity: number, interval: "month" | "year"): number {
  return ratePerStudentPerDay * capacity * DAYS_IN_PERIOD[interval];
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

  async getEffectiveRate(academyId: string): Promise<number> {
    const academy = await AcademyModel.findById(academyId).select("subscriptionRateOverride").lean();
    if (academy?.subscriptionRateOverride !== undefined && academy.subscriptionRateOverride !== null) {
      return academy.subscriptionRateOverride;
    }
    const settings = await PlatformSettingsModel.findOne().lean();
    return settings?.defaultRatePerStudentPerDay ?? 1;
  }

  async getStatus(academyId: string) {
    const [subscription, rate, activeStudentCount] = await Promise.all([
      AcademySubscriptionModel.findOne({ academyId }).lean(),
      this.getEffectiveRate(academyId),
      this.countActiveStudents(academyId),
    ]);

    return {
      hasSubscription: !!subscription,
      status: subscription?.status ?? null,
      billingInterval: subscription?.billingInterval ?? null,
      provisionedCapacity: subscription?.provisionedCapacity ?? 0,
      currentPeriodEnd: subscription?.currentPeriodEnd ?? null,
      ratePerStudentPerDay: subscription?.ratePerStudentPerDay ?? rate,
      currentDefaultRate: rate,
      activeStudentCount,
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

  async createCheckoutSession(
    academyId: string,
    dto: { capacity: number; billingInterval: "month" | "year" },
    requesterId: string,
  ): Promise<{ url: string }> {
    if (dto.capacity < 1) throw new BadRequestError("Capacity must be at least 1 student");

    const existing = await AcademySubscriptionModel.findOne({ academyId });
    if (existing && existing.status === "active") {
      throw new BadRequestError(
        "This academy already has an active subscription — use the upgrade flow to change capacity instead.",
      );
    }

    const [academy, requester] = await Promise.all([
      AcademyModel.findById(academyId).select("name subscriptionRateOverride").lean(),
      UserModel.findById(requesterId).select("email firstName lastName").lean(),
    ]);
    if (!academy) throw new NotFoundError("Academy");
    if (!requester) throw new NotFoundError("Requester");

    const rate = await this.getEffectiveRate(academyId);
    const totalRupees = toRupeeAmount(rate, dto.capacity, dto.billingInterval);
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
        provisionedCapacity: dto.capacity,
        status: "incomplete",
      },
      { upsert: true, new: true },
    );

    if (!session.url) throw new BadRequestError("Stripe did not return a checkout URL");
    return { url: session.url };
  }

  // Increases capacity on an already-active subscription by repricing it
  // in place (see StripeService.updateSubscriptionCapacity) — no new
  // checkout needed since a payment method is already on file.
  async upgradeCapacity(
    academyId: string,
    dto: { capacity: number },
  ): Promise<{ provisionedCapacity: number }> {
    const subscription = await AcademySubscriptionModel.findOne({ academyId });
    if (!subscription || subscription.status !== "active" || !subscription.stripeSubscriptionId) {
      throw new BadRequestError("This academy doesn't have an active subscription to upgrade");
    }
    if (dto.capacity <= subscription.provisionedCapacity) {
      throw new BadRequestError("New capacity must be greater than the current capacity");
    }

    const rate = await this.getEffectiveRate(academyId);
    const totalRupees = toRupeeAmount(rate, dto.capacity, subscription.billingInterval);
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
    subscription.ratePerStudentPerDay = rate;
    await subscription.save();

    return { provisionedCapacity: subscription.provisionedCapacity };
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
}
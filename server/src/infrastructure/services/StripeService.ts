// src/infrastructure/services/StripeService.ts
import Stripe from "stripe";
import { config } from "../../config/app.config";
import { logger } from "../../shared/utils/logger";

// Every price here is built inline with price_data rather than a
// pre-created Stripe Price object, because the ₹/student/day rate is
// dynamic per-academy (global default or a super_admin override) and the
// quantity (provisioned student capacity) is chosen by the manager at
// checkout time — there's no fixed catalog of plans to point at.
class StripeService {
  private client: Stripe | null = null;

  private getClient(): Stripe {
    if (!this.client) {
      if (!config.stripe.secretKey) {
        throw new Error("STRIPE_SECRET_KEY is not configured");
      }
      this.client = new Stripe(config.stripe.secretKey, {
        apiVersion: "2023-10-16",
      });
    }
    return this.client;
  }

  async findOrCreateCustomer(params: {
    existingCustomerId?: string;
    email: string;
    name: string;
    academyId: string;
  }): Promise<string> {
    const stripe = this.getClient();
    if (params.existingCustomerId) {
      try {
        const existing = await stripe.customers.retrieve(
          params.existingCustomerId,
        );
        if (!existing.deleted) return params.existingCustomerId;
      } catch {
        // Fall through and create a fresh one if the stored id is stale/invalid.
      }
    }
    const customer = await stripe.customers.create({
      email: params.email,
      name: params.name,
      metadata: { academyId: params.academyId },
    });
    return customer.id;
  }

  // Unit amount is computed by the caller as whole paise for the full
  // billing period (rate × days-in-period × capacity), since Stripe
  // requires integer amounts in the smallest currency unit.
  async createSubscriptionCheckoutSession(params: {
    customerId: string;
    academyId: string;
    billingInterval: "month" | "year";
    unitAmountPaise: number;
    capacity: number;
    ratePerStudentPerDay: number;
    successUrl: string;
    cancelUrl: string;
  }): Promise<Stripe.Checkout.Session> {
    const stripe = this.getClient();
    return stripe.checkout.sessions.create({
      mode: "subscription",
      customer: params.customerId,
      line_items: [
        {
          price_data: {
            currency: "inr",
            unit_amount: params.unitAmountPaise,
            recurring: { interval: params.billingInterval },
            product_data: {
              name: `Noxphere subscription — ${params.capacity} students`,
              metadata: {
                academyId: params.academyId,
                ratePerStudentPerDay: String(params.ratePerStudentPerDay),
                capacity: String(params.capacity),
              },
            },
          },
          quantity: 1,
        },
      ],
      metadata: {
        academyId: params.academyId,
        capacity: String(params.capacity),
        billingInterval: params.billingInterval,
        ratePerStudentPerDay: String(params.ratePerStudentPerDay),
      },
      subscription_data: {
        metadata: { academyId: params.academyId },
      },
      success_url: params.successUrl,
      cancel_url: params.cancelUrl,
    });
  }

  async retrieveSubscription(
    subscriptionId: string,
  ): Promise<Stripe.Subscription> {
    return this.getClient().subscriptions.retrieve(subscriptionId);
  }

  // Used when an already-subscribed academy increases its provisioned
  // capacity — the customer's payment method is already on file from the
  // original checkout, so this reprices the existing subscription in
  // place (with proration) instead of sending them through checkout
  // again.
  async updateSubscriptionCapacity(params: {
    subscriptionId: string;
    academyId: string;
    billingInterval: "month" | "year";
    unitAmountPaise: number;
    capacity: number;
    ratePerStudentPerDay: number;
  }): Promise<Stripe.Subscription> {
    const stripe = this.getClient();

    const subscription = await stripe.subscriptions.retrieve(
      params.subscriptionId,
      {
        expand: ["items.data.price.product"],
      },
    );

    const item = subscription.items.data[0];

    if (!item) {
      throw new Error("Subscription has no billable item to update");
    }

    const existingProduct = item.price.product;

    if (!existingProduct) {
      throw new Error("Subscription price has no associated product");
    }

    const productId =
      typeof existingProduct === "string"
        ? existingProduct
        : existingProduct.id;

    return stripe.subscriptions.update(params.subscriptionId, {
      items: [
        {
          id: item.id,

          price_data: {
            product: productId,
            currency: "inr",
            unit_amount: params.unitAmountPaise,
            recurring: {
              interval: params.billingInterval,
            },
          },

          quantity: 1,
        },
      ],

      metadata: {
        academyId: params.academyId,
        capacity: String(params.capacity),
        ratePerStudentPerDay: String(params.ratePerStudentPerDay),
      },

      proration_behavior: "create_prorations",
    });
  }

  async cancelSubscription(subscriptionId: string): Promise<void> {
    try {
      await this.getClient().subscriptions.cancel(subscriptionId);
    } catch (err) {
      logger.error("[StripeService] cancelSubscription failed:", err);
    }
  }

  constructWebhookEvent(rawBody: Buffer, signature: string): Stripe.Event {
    if (!config.stripe.webhookSecret) {
      throw new Error("STRIPE_WEBHOOK_SECRET is not configured");
    }
    return this.getClient().webhooks.constructEvent(
      rawBody,
      signature,
      config.stripe.webhookSecret,
    );
  }
}

export const stripeService = new StripeService();

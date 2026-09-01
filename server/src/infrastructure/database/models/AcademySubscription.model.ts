// src/infrastructure/database/models/AcademySubscription.model.ts
import mongoose, { Schema, Document } from "mongoose";

export type SubscriptionStatus =
  | "incomplete"
  | "active"
  | "past_due"
  | "canceled"
  | "unpaid";

export type BillingInterval = "month" | "year";

export interface AcademySubscriptionDocument extends Document {
  academyId: mongoose.Types.ObjectId;
  stripeCustomerId?: string;
  stripeSubscriptionId?: string;
  stripeCheckoutSessionId?: string;
  billingInterval: BillingInterval;
  // The ₹/student/day rate actually in effect for this subscription,
  // captured at checkout time. A later change to the platform default or
  // this academy's override (see Academy.subscriptionRateOverride) only
  // affects the *next* subscription created or capacity increase — not
  // the price already locked into an active Stripe subscription — the
  // same way most SaaS billing treats existing subscriptions.
  ratePerStudentPerDay: number;
  // The number of student seats this academy has paid for. This is a
  // deliberately-chosen number the manager sets when subscribing or
  // upgrading — not a live mirror of actual headcount — so
  // "add player" can enforce a hard cap against it (see
  // StudentUseCases.createStudent).
  provisionedCapacity: number;
  status: SubscriptionStatus;
  currentPeriodEnd?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const AcademySubscriptionSchema = new Schema<AcademySubscriptionDocument>(
  {
    academyId: {
      type: Schema.Types.ObjectId,
      ref: "Academy",
      required: true,
      unique: true,
      index: true,
    },
    stripeCustomerId: String,
    stripeSubscriptionId: String,
    stripeCheckoutSessionId: String,
    billingInterval: { type: String, enum: ["month", "year"], required: true },
    ratePerStudentPerDay: { type: Number, required: true, min: 0 },
    provisionedCapacity: { type: Number, required: true, min: 1 },
    status: {
      type: String,
      enum: ["incomplete", "active", "past_due", "canceled", "unpaid"],
      default: "incomplete",
      index: true,
    },
    currentPeriodEnd: Date,
  },
  {
    timestamps: true,
    toJSON: {
      transform: (_doc, ret: any) => {
        ret.id = ret._id.toString();
        delete ret._id;
        delete ret.__v;
        return ret;
      },
    },
  },
);

export const AcademySubscriptionModel = mongoose.model<AcademySubscriptionDocument>(
  "AcademySubscription",
  AcademySubscriptionSchema,
);
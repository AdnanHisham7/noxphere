// src/infrastructure/database/models/AcademySubscription.model.ts
import mongoose, { Schema, Document } from "mongoose";

export type SubscriptionStatus =
  | "incomplete"
  | "active"
  | "past_due"
  | "canceled"
  | "unpaid"
  | "trialing"
  | "trial_expired";

export type BillingInterval = "month" | "quarter" | "half_year" | "year";

export interface SubscriptionPaymentRecord {
  orderId: string;
  paymentId: string;
  amount: number;
  currency: string;
  exchangeRateToInr?: number;
  amountInInr?: number;
  status: string;
  billingInterval: BillingInterval;
  studentCapacity: number;
  staffCapacity: number;
  type: "subscription" | "renewal" | "upgrade";
  paidAt: Date;
  receiptNumber?: string;
  paymentMethod?: string;
  notes?: string;
}

export interface AcademySubscriptionDocument extends Document {
  academyId: mongoose.Types.ObjectId;
  stripeCustomerId?: string;
  stripeSubscriptionId?: string;
  stripeCheckoutSessionId?: string;
  razorpayOrderId?: string;
  razorpayPaymentId?: string;
  razorpaySignature?: string;
  billingInterval: BillingInterval;
  currency: string;
  isTrial: boolean;
  trialEndsAt?: Date;
  // The per student per day rate in effect for this subscription
  ratePerStudentPerDay: number;
  // The per staff per month rate in effect for this subscription's staff line
  staffRatePerStaffPerMonth: number;
  // The number of student seats this academy has paid or trialed for
  provisionedCapacity: number;
  // Same idea, for staff employees
  provisionedStaffCapacity: number;
  status: SubscriptionStatus;
  currentPeriodEnd?: Date;
  payments?: SubscriptionPaymentRecord[];
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
    razorpayOrderId: { type: String, index: true },
    razorpayPaymentId: String,
    razorpaySignature: String,
    billingInterval: {
      type: String,
      enum: ["month", "quarter", "half_year", "year"],
      required: true,
      default: "month",
    },
    currency: { type: String, default: "INR", uppercase: true },
    isTrial: { type: Boolean, default: false },
    trialEndsAt: Date,
    ratePerStudentPerDay: { type: Number, required: true, min: 0 },
    staffRatePerStaffPerMonth: { type: Number, required: true, min: 0, default: 10 },
    provisionedCapacity: { type: Number, required: true, min: 1 },
    provisionedStaffCapacity: { type: Number, required: true, min: 0, default: 0 },
    status: {
      type: String,
      enum: ["incomplete", "active", "past_due", "canceled", "unpaid", "trialing", "trial_expired"],
      default: "incomplete",
      index: true,
    },
    currentPeriodEnd: Date,
    payments: [
      {
        orderId: String,
        paymentId: String,
        amount: { type: Number, required: true },
        currency: { type: String, default: "INR" },
        exchangeRateToInr: Number,
        amountInInr: Number,
        status: { type: String, default: "paid" },
        billingInterval: String,
        studentCapacity: Number,
        staffCapacity: Number,
        type: { type: String, enum: ["subscription", "renewal", "upgrade"], default: "subscription" },
        paidAt: { type: Date, default: Date.now },
        receiptNumber: String,
        paymentMethod: String,
        notes: String,
      },
    ],
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
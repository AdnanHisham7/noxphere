// src/infrastructure/database/models/AcademySubscription.model.ts
import mongoose, { Schema, Document } from "mongoose";

export type SubscriptionStatus =
  | "incomplete"
  | "active"
  | "past_due"
  | "canceled"
  | "unpaid";

export type BillingInterval = "month" | "quarter" | "half_year" | "year";

export interface SubscriptionPaymentRecord {
  orderId: string;
  paymentId: string;
  amount: number;
  currency: string;
  status: string;
  billingInterval: BillingInterval;
  studentCapacity: number;
  staffCapacity: number;
  type: "subscription" | "renewal" | "upgrade";
  paidAt: Date;
  receiptNumber?: string;
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
  // The ₹/student/day rate actually in effect for this subscription,
  // captured at checkout time. A later change to the platform default or
  // this academy's override (see Academy.subscriptionRateOverride) only
  // affects the *next* subscription created or capacity increase — not
  // the price already locked into an active Stripe subscription — the
  // same way most SaaS billing treats existing subscriptions.
  ratePerStudentPerDay: number;
  // The ₹/staff/month rate actually in effect for this subscription's
  // staff-seat line, captured at checkout/upgrade time — same snapshot
  // rationale as ratePerStudentPerDay above.
  staffRatePerStaffPerMonth: number;
  // The number of student seats this academy has paid for. This is a
  // deliberately-chosen number the manager sets when subscribing or
  // upgrading — not a live mirror of actual headcount — so
  // "add player" can enforce a hard cap against it (see
  // StudentUseCases.createStudent).
  provisionedCapacity: number;
  // Same idea, for "staff" (system-access, software-managing) employees
  // — see Employee.employeeType. External employees never count here.
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
    },
    ratePerStudentPerDay: { type: Number, required: true, min: 0 },
    staffRatePerStaffPerMonth: { type: Number, required: true, min: 0, default: 10 },
    provisionedCapacity: { type: Number, required: true, min: 1 },
    provisionedStaffCapacity: { type: Number, required: true, min: 0, default: 0 },
    status: {
      type: String,
      enum: ["incomplete", "active", "past_due", "canceled", "unpaid"],
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
        status: { type: String, default: "paid" },
        billingInterval: String,
        studentCapacity: Number,
        staffCapacity: Number,
        type: { type: String, enum: ["subscription", "renewal", "upgrade"], default: "subscription" },
        paidAt: { type: Date, default: Date.now },
        receiptNumber: String,
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
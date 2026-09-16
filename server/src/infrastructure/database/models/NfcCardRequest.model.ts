// src/infrastructure/database/models/NfcCardRequest.model.ts
import mongoose, { Schema, Document } from "mongoose";

export type NfcRequesterRole = "student" | "manager";
export type NfcRequesterType = "independent_player" | "academy";
export type NfcCardType = "official" | "custom";
export type NfcRequestStatus =
  | "pending"
  | "approved"
  | "rejected"
  | "paid"
  | "dispatched"
  | "delivered";

export interface NfcStudentItem {
  studentId: mongoose.Types.ObjectId;
  studentName: string;
  jerseyNumber?: number;
  photo?: string;
  franchiseName?: string;
  ageGroup?: string;
  publicProfileToken?: string;
}

export interface NfcShippingAddress {
  recipientName: string;
  phone: string;
  addressLine1: string;
  addressLine2?: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
}

export interface NfcDispatchDetails {
  courierName?: string;
  trackingNumber?: string;
  trackingUrl?: string;
  dispatchedAt?: Date;
}

export interface NfcCardRequestDocument extends Document {
  requesterId: mongoose.Types.ObjectId;
  requesterRole: NfcRequesterRole;
  requesterType: NfcRequesterType;
  academyId?: mongoose.Types.ObjectId;
  franchiseId?: mongoose.Types.ObjectId;
  cardType: NfcCardType;
  customDesignUrl?: string;
  customDesignFileName?: string;
  students: NfcStudentItem[];
  quantity: number;
  unitPrice: number;
  totalAmount: number;
  currency: string;
  shippingAddress: NfcShippingAddress;
  status: NfcRequestStatus;
  rejectionReason?: string;
  adminNotes?: string;
  dispatchDetails?: NfcDispatchDetails;
  deliveredAt?: Date;
  stripeSessionId?: string;
  stripePaymentIntentId?: string;
  paidAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const NfcStudentItemSchema = new Schema(
  {
    studentId: { type: Schema.Types.ObjectId, ref: "Student", required: true },
    studentName: { type: String, required: true },
    jerseyNumber: Number,
    photo: String,
    franchiseName: String,
    ageGroup: String,
    publicProfileToken: String,
  },
  { _id: false },
);

const NfcShippingAddressSchema = new Schema(
  {
    recipientName: { type: String, required: true, trim: true },
    phone: { type: String, required: true, trim: true },
    addressLine1: { type: String, required: true, trim: true },
    addressLine2: { type: String, trim: true },
    city: { type: String, required: true, trim: true },
    state: { type: String, required: true, trim: true },
    postalCode: { type: String, required: true, trim: true },
    country: { type: String, required: true, default: "India", trim: true },
  },
  { _id: false },
);

const NfcDispatchDetailsSchema = new Schema(
  {
    courierName: { type: String, trim: true },
    trackingNumber: { type: String, trim: true },
    trackingUrl: { type: String, trim: true },
    dispatchedAt: Date,
  },
  { _id: false },
);

const NfcCardRequestSchema = new Schema<NfcCardRequestDocument>(
  {
    requesterId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    requesterRole: {
      type: String,
      enum: ["student", "manager"],
      required: true,
    },
    requesterType: {
      type: String,
      enum: ["independent_player", "academy"],
      required: true,
      index: true,
    },
    academyId: {
      type: Schema.Types.ObjectId,
      ref: "Academy",
      index: true,
    },
    franchiseId: {
      type: Schema.Types.ObjectId,
      ref: "Franchise",
      index: true,
    },
    cardType: {
      type: String,
      enum: ["official", "custom"],
      default: "official",
    },
    customDesignUrl: String,
    customDesignFileName: String,
    students: {
      type: [NfcStudentItemSchema],
      default: [],
    },
    quantity: {
      type: Number,
      required: true,
      min: 1,
    },
    unitPrice: {
      type: Number,
      required: true,
      min: 0,
    },
    totalAmount: {
      type: Number,
      required: true,
      min: 0,
    },
    currency: {
      type: String,
      default: "INR",
    },
    shippingAddress: {
      type: NfcShippingAddressSchema,
      required: true,
    },
    status: {
      type: String,
      enum: ["pending", "approved", "rejected", "paid", "dispatched", "delivered"],
      default: "pending",
      index: true,
    },
    rejectionReason: String,
    adminNotes: String,
    dispatchDetails: NfcDispatchDetailsSchema,
    deliveredAt: Date,
    stripeSessionId: {
      type: String,
      index: true,
    },
    stripePaymentIntentId: String,
    paidAt: Date,
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

NfcCardRequestSchema.index({ requesterId: 1, createdAt: -1 });
NfcCardRequestSchema.index({ academyId: 1, createdAt: -1 });
NfcCardRequestSchema.index({ status: 1, createdAt: -1 });

export const NfcCardRequestModel = mongoose.model<NfcCardRequestDocument>(
  "NfcCardRequest",
  NfcCardRequestSchema,
);

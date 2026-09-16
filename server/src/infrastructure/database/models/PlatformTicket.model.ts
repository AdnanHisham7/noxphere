// src/infrastructure/database/models/PlatformTicket.model.ts
import mongoose, { Schema, Document } from "mongoose";

export type TicketCategory =
  | "bug_technical"
  | "billing_subscription"
  | "feature_request"
  | "account_access"
  | "other";

export type TicketPriority = "low" | "medium" | "high" | "urgent";

export type TicketStatus = "open" | "in_progress" | "resolved" | "closed";

export interface TicketMessage {
  _id: mongoose.Types.ObjectId;
  senderId: mongoose.Types.ObjectId;
  senderRole: "manager" | "super_admin";
  senderName: string;
  message: string;
  createdAt: Date;
}

export interface PlatformTicketDocument extends Document {
  ticketNumber: string;
  academyId: mongoose.Types.ObjectId;
  academyName: string;
  raisedBy: mongoose.Types.ObjectId;
  raisedByName: string;
  raisedByEmail: string;
  subject: string;
  category: TicketCategory;
  priority: TicketPriority;
  description: string;
  status: TicketStatus;
  messages: TicketMessage[];
  lastRepliedAt?: Date;
  lastRepliedBy?: mongoose.Types.ObjectId;
  lastRepliedRole?: "manager" | "super_admin";
  resolvedAt?: Date;
  resolvedBy?: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const TicketMessageSchema = new Schema<TicketMessage>(
  {
    senderId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    senderRole: { type: String, enum: ["manager", "super_admin"], required: true },
    senderName: { type: String, required: true },
    message: { type: String, required: true, maxlength: 5000 },
    createdAt: { type: Date, default: Date.now },
  },
  { _id: true }
);

const PlatformTicketSchema = new Schema<PlatformTicketDocument>(
  {
    ticketNumber: { type: String, required: true, unique: true, index: true },
    academyId: { type: Schema.Types.ObjectId, ref: "Academy", required: true, index: true },
    academyName: { type: String, required: true, index: true },
    raisedBy: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    raisedByName: { type: String, required: true },
    raisedByEmail: { type: String, required: true },
    subject: { type: String, required: true, trim: true, maxlength: 200 },
    category: {
      type: String,
      enum: ["bug_technical", "billing_subscription", "feature_request", "account_access", "other"],
      default: "other",
      index: true,
    },
    priority: {
      type: String,
      enum: ["low", "medium", "high", "urgent"],
      default: "medium",
      index: true,
    },
    description: { type: String, required: true, maxlength: 5000 },
    status: {
      type: String,
      enum: ["open", "in_progress", "resolved", "closed"],
      default: "open",
      index: true,
    },
    messages: [TicketMessageSchema],
    lastRepliedAt: { type: Date },
    lastRepliedBy: { type: Schema.Types.ObjectId, ref: "User" },
    lastRepliedRole: { type: String, enum: ["manager", "super_admin"] },
    resolvedAt: { type: Date },
    resolvedBy: { type: Schema.Types.ObjectId, ref: "User" },
  },
  {
    timestamps: true,
    toJSON: {
      transform: (_doc, ret: any) => {
        ret.id = ret._id.toString();
        delete ret._id;
        delete ret.__v;
        if (Array.isArray(ret.messages)) {
          ret.messages = ret.messages.map((m: any) => {
            if (m._id) {
              m.id = m._id.toString();
              delete m._id;
            }
            return m;
          });
        }
        return ret;
      },
    },
  }
);

PlatformTicketSchema.index({ academyId: 1, createdAt: -1 });
PlatformTicketSchema.index({ status: 1, createdAt: -1 });

export const PlatformTicketModel = mongoose.model<PlatformTicketDocument>(
  "PlatformTicket",
  PlatformTicketSchema
);

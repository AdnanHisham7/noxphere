// src/infrastructure/database/models/Expense.model.ts
import mongoose, { Schema, Document } from "mongoose";

export type ExpenseType = "purchase" | "miscellaneous";
export type PurchaseStatus = "pending" | "verified" | "rejected";
export type MiscExpenseStatus = "paid" | "pending";
export type PaymentMethod =
  | "cash"
  | "bank_transfer"
  | "upi"
  | "card"
  | "cheque"
  | "other";

export interface ExpenseDocument extends Document {
  academyId: mongoose.Types.ObjectId;
  franchiseId?: mongoose.Types.ObjectId;
  type: ExpenseType;

  // Purchases specific fields (creates/increments stock when verified)
  itemName?: string;
  category: string;
  quantity?: number;
  unit?: string;
  unitPrice?: number;
  stockItemId?: mongoose.Types.ObjectId;
  verificationStatus?: PurchaseStatus;
  verifiedBy?: mongoose.Types.ObjectId;
  verifiedByName?: string;
  verifiedAt?: Date;
  rejectionReason?: string;

  // Miscellaneous specific fields (no stock created)
  title?: string;
  miscStatus?: MiscExpenseStatus;

  // Common financial fields
  amount: number;
  date: Date;
  vendor?: string;
  vendorContact?: string;
  invoiceNumber?: string;
  paymentMethod: PaymentMethod;
  receiptUrl?: string;
  notes?: string;

  createdBy: mongoose.Types.ObjectId;
  createdByName: string;

  createdAt: Date;
  updatedAt: Date;
}

const ExpenseSchema = new Schema<ExpenseDocument>(
  {
    academyId: { type: Schema.Types.ObjectId, ref: "Academy", required: true, index: true },
    franchiseId: { type: Schema.Types.ObjectId, ref: "Franchise", index: true },
    type: {
      type: String,
      enum: ["purchase", "miscellaneous"],
      required: true,
      index: true,
    },

    // Purchase fields
    itemName: { type: String, trim: true },
    category: { type: String, required: true, trim: true, index: true },
    quantity: { type: Number, min: 1 },
    unit: { type: String, default: "units" },
    unitPrice: { type: Number, min: 0 },
    stockItemId: { type: Schema.Types.ObjectId, ref: "StockItem", index: true },
    verificationStatus: {
      type: String,
      enum: ["pending", "verified", "rejected"],
      default: function (this: ExpenseDocument) {
        return this.type === "purchase" ? "pending" : undefined;
      },
      index: true,
    },
    verifiedBy: { type: Schema.Types.ObjectId, ref: "User" },
    verifiedByName: String,
    verifiedAt: Date,
    rejectionReason: String,

    // Miscellaneous fields
    title: { type: String, trim: true },
    miscStatus: {
      type: String,
      enum: ["paid", "pending"],
      default: "paid",
    },

    // Common financial fields
    amount: { type: Number, required: true, min: 0 },
    date: { type: Date, required: true, default: Date.now, index: true },
    vendor: { type: String, trim: true },
    vendorContact: { type: String, trim: true },
    invoiceNumber: { type: String, trim: true },
    paymentMethod: {
      type: String,
      enum: ["cash", "bank_transfer", "upi", "card", "cheque", "other"],
      default: "bank_transfer",
    },
    receiptUrl: String,
    notes: String,

    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    createdByName: { type: String, required: true },
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
  }
);

ExpenseSchema.index({ academyId: 1, type: 1, date: -1 });
ExpenseSchema.index({ franchiseId: 1, type: 1, date: -1 });
ExpenseSchema.index({ academyId: 1, verificationStatus: 1 });

export const ExpenseModel = mongoose.model<ExpenseDocument>("Expense", ExpenseSchema);

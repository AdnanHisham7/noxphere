// src/infrastructure/database/models/StockItem.model.ts
import mongoose, { Schema, Document } from "mongoose";

export type StockStatus = "in_stock" | "low_stock" | "out_of_stock";
export type StockLogAction =
  | "purchase_restock"
  | "issued_out"
  | "used_training"
  | "damaged"
  | "audit_adjustment"
  | "initial";

export interface StockLog {
  action: StockLogAction;
  quantityChange: number;
  previousQuantity: number;
  newQuantity: number;
  reason: string;
  recipient?: string;
  performedBy: mongoose.Types.ObjectId;
  performedByName: string;
  date: Date;
  referenceId?: string;
}

export interface StockItemDocument extends Document {
  academyId: mongoose.Types.ObjectId;
  franchiseId?: mongoose.Types.ObjectId;
  name: string;
  sku?: string;
  category: string;
  unit: string;
  quantity: number;
  minQuantityAlert: number;
  unitPrice: number;
  location?: string;
  status: StockStatus;
  lastRestockedAt?: Date;
  lastPurchaseId?: mongoose.Types.ObjectId;
  notes?: string;
  stockLogs: StockLog[];
  createdAt: Date;
  updatedAt: Date;
}

const StockLogSchema = new Schema(
  {
    action: {
      type: String,
      enum: ["purchase_restock", "issued_out", "used_training", "damaged", "audit_adjustment", "initial"],
      required: true,
    },
    quantityChange: { type: Number, required: true },
    previousQuantity: { type: Number, required: true },
    newQuantity: { type: Number, required: true },
    reason: { type: String, required: true },
    recipient: String,
    performedBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    performedByName: { type: String, required: true },
    date: { type: Date, default: Date.now },
    referenceId: String,
  },
  { _id: true }
);

const StockItemSchema = new Schema<StockItemDocument>(
  {
    academyId: { type: Schema.Types.ObjectId, ref: "Academy", required: true, index: true },
    franchiseId: { type: Schema.Types.ObjectId, ref: "Franchise", index: true },
    name: { type: String, required: true, trim: true },
    sku: { type: String, trim: true },
    category: {
      type: String,
      required: true,
      default: "Equipment",
      index: true,
    },
    unit: { type: String, required: true, default: "units" },
    quantity: { type: Number, required: true, default: 0, min: 0 },
    minQuantityAlert: { type: Number, default: 5, min: 0 },
    unitPrice: { type: Number, default: 0, min: 0 },
    location: { type: String, trim: true },
    status: {
      type: String,
      enum: ["in_stock", "low_stock", "out_of_stock"],
      default: "out_of_stock",
      index: true,
    },
    lastRestockedAt: Date,
    lastPurchaseId: { type: Schema.Types.ObjectId, ref: "Expense" },
    notes: String,
    stockLogs: { type: [StockLogSchema], default: [] },
  },
  {
    timestamps: true,
    toJSON: {
      transform: (_doc, ret: any) => {
        ret.id = ret._id.toString();
        ret.totalValue = (ret.quantity || 0) * (ret.unitPrice || 0);
        delete ret._id;
        delete ret.__v;
        return ret;
      },
    },
  }
);

StockItemSchema.pre("save", function (next) {
  if (this.quantity <= 0) {
    this.status = "out_of_stock";
  } else if (this.quantity <= this.minQuantityAlert) {
    this.status = "low_stock";
  } else {
    this.status = "in_stock";
  }
  next();
});

StockItemSchema.index({ academyId: 1, name: 1 });
StockItemSchema.index({ academyId: 1, franchiseId: 1, status: 1 });

export const StockItemModel = mongoose.model<StockItemDocument>("StockItem", StockItemSchema);

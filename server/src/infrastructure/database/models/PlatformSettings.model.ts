// src/infrastructure/database/models/PlatformSettings.model.ts
import mongoose, { Schema, Document } from "mongoose";

export interface CurrencyPricing {
  currency: string;
  ratePerStudentPerDay: number;
  staffRatePerStaffPerMonth: number;
  symbol: string;
  countryCode: string;
  countryName: string;
  isActive: boolean;
}

export interface PlatformSettingsDocument extends Document {
  // Singleton row — always looked up with no filter (see
  // PlatformSettingsModel.findOne()), so this collection only ever holds
  // one document.
  defaultRatePerStudentPerDay: number;
  defaultStaffRatePerStaffPerMonth: number;
  defaultNfcCardPrice: number;
  defaultNfcCustomCardPrice: number;
  transferWallEnabled: boolean;
  defaultTrialDays: number;
  defaultTrialCapacity: number;
  defaultTrialStaffCapacity: number;
  currencyPricing?: CurrencyPricing[];
  playerAiPromptTemplate?: string;
  updatedBy?: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const CurrencyPricingSchema = new Schema<CurrencyPricing>(
  {
    currency: { type: String, required: true },
    ratePerStudentPerDay: { type: Number, required: true, min: 0 },
    staffRatePerStaffPerMonth: { type: Number, required: true, min: 0 },
    symbol: { type: String, required: true },
    countryCode: { type: String, required: true },
    countryName: { type: String, required: true },
    isActive: { type: Boolean, default: true },
  },
  { _id: false },
);

const PlatformSettingsSchema = new Schema<PlatformSettingsDocument>(
  {
    defaultRatePerStudentPerDay: { type: Number, required: true, default: 1, min: 0 },
    defaultStaffRatePerStaffPerMonth: { type: Number, required: true, default: 10, min: 0 },
    defaultNfcCardPrice: { type: Number, required: true, default: 299, min: 0 },
    defaultNfcCustomCardPrice: { type: Number, required: true, default: 399, min: 0 },
    transferWallEnabled: { type: Boolean, default: true },
    defaultTrialDays: { type: Number, required: true, default: 14, min: 1 },
    defaultTrialCapacity: { type: Number, required: true, default: 50, min: 1 },
    defaultTrialStaffCapacity: { type: Number, required: true, default: 5, min: 0 },
    currencyPricing: { type: [CurrencyPricingSchema], default: [] },
    playerAiPromptTemplate: { type: String, default: "" },
    updatedBy: { type: Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true },
);

export const PlatformSettingsModel = mongoose.model<PlatformSettingsDocument>(
  "PlatformSettings",
  PlatformSettingsSchema,
);
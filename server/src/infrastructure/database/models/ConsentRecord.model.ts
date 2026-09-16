// src/infrastructure/database/models/ConsentRecord.model.ts
import mongoose, { Schema, Document } from "mongoose";

export interface ConsentRecordDocument extends Document {
  studentId: mongoose.Types.ObjectId;
  guardianId: mongoose.Types.ObjectId;
  academyId: mongoose.Types.ObjectId;
  // 'enrollment' is the base consent required to use the academy at
  // all (see ConsentUseCases.CONSENT_NOTICE). 'public_profile' is a
  // distinct, separately-opted-in purpose — publishing a minor's
  // name/photo on the open internet via a public player page/QR code is
  // a materially different exposure than the data processing needed to
  // just run the academy, so it gets its own consent record rather than
  // being folded into the base one.
  consentType: "enrollment" | "public_profile";
  noticeVersion: string;
  dataCategories: string[];
  purposes: string[];
  grantedAt: Date;
  grantedIp?: string;
  grantedUserAgent?: string;
  withdrawnAt?: Date;
  withdrawnIp?: string;
  withdrawalReason?: string;
  createdAt: Date;
  updatedAt: Date;
}

const ConsentRecordSchema = new Schema<ConsentRecordDocument>(
  {
    studentId: { type: Schema.Types.ObjectId, ref: "Student", required: true, index: true },
    guardianId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    academyId: { type: Schema.Types.ObjectId, ref: "Academy", required: true, index: true },
    consentType: {
      type: String,
      enum: ["enrollment", "public_profile"],
      required: true,
      default: "enrollment",
    },
    noticeVersion: { type: String, required: true },
    dataCategories: [{ type: String }],
    purposes: [{ type: String }],
    grantedAt: { type: Date, required: true },
    grantedIp: String,
    grantedUserAgent: String,
    withdrawnAt: Date,
    withdrawnIp: String,
    withdrawalReason: { type: String, maxlength: 500 },
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

// One active consent chain per student+guardian pair — withdrawing and
// re-granting updates the same document rather than creating duplicates,
// so there's always exactly one record to check "is this student's
// guardian currently consented".
ConsentRecordSchema.index({ studentId: 1, guardianId: 1, consentType: 1 }, { unique: true });

export const ConsentRecordModel = mongoose.model<ConsentRecordDocument>(
  "ConsentRecord",
  ConsentRecordSchema,
);
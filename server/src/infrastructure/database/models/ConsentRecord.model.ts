// src/infrastructure/database/models/ConsentRecord.model.ts
import mongoose, { Schema, Document } from "mongoose";

export interface ConsentRecordDocument extends Document {
  studentId: mongoose.Types.ObjectId;
  guardianId: mongoose.Types.ObjectId;
  academyId: mongoose.Types.ObjectId;
  // A version string for the exact notice text shown at consent time
  // (see CONSENT_NOTICE.version in ConsentUseCases). If the notice ever
  // changes, existing consents stay tied to the version they actually
  // saw and agreed to — required to answer "what did they consent to"
  // under DPDP Act Section 6(10)'s burden of proof.
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
ConsentRecordSchema.index({ studentId: 1, guardianId: 1 }, { unique: true });

export const ConsentRecordModel = mongoose.model<ConsentRecordDocument>(
  "ConsentRecord",
  ConsentRecordSchema,
);
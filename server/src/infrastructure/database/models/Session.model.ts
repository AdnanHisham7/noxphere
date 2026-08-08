// src/infrastructure/database/models/Session.model.ts
import mongoose, { Schema, Document } from "mongoose";

export interface SessionDocument extends Document {
  franchiseId: mongoose.Types.ObjectId;
  targetType: "team" | "category";
  teamId?: mongoose.Types.ObjectId;
  category?: string;
  categories?: string[];
  coachId?: mongoose.Types.ObjectId;
  coachIds?: mongoose.Types.ObjectId[];
  type: string;
  date: string; // YYYY-MM-DD (start date for multi-day)
  startTime: string; // HH:MM (start time for first day)
  endTime: string; // HH:MM (end time for first day)
  startDate?: string; // YYYY-MM-DD
  endDate?: string; // YYYY-MM-DD
  dailyStartTime?: string; // HH:MM
  dailyEndTime?: string; // HH:MM
  location: string;
  fieldNumber?: string;
  status: string;
  notes?: string;
  cancelReason?: string;
  createdBy: mongoose.Types.ObjectId;
  deletedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
  playerIds?: mongoose.Types.ObjectId[];
  documents?: { name: string; url: string }[];
}

const SessionSchema = new Schema<SessionDocument>(
  {
    franchiseId: { type: Schema.Types.ObjectId, ref: "Franchise", required: true, index: true },
    targetType: {
      type: String,
      enum: ["team", "category"],
      default: "team",
      required: true,
    },
    teamId: { type: Schema.Types.ObjectId, ref: "Team", index: true },
    category: { type: String, index: true },
    categories: [{ type: String }],
    coachId: { type: Schema.Types.ObjectId, ref: "User", index: true },
    coachIds: [{ type: Schema.Types.ObjectId, ref: "User" }],
    type: {
      type: String,
      default: "training",
    },
    date: { type: String, required: true, index: true }, // YYYY-MM-DD
    startTime: { type: String, required: true },
    endTime: { type: String, required: true },
    startDate: String,
    endDate: String,
    dailyStartTime: String,
    dailyEndTime: String,
    location: { type: String, required: true },
    fieldNumber: String,
    status: {
      type: String,
      enum: ["upcoming", "ongoing", "completed", "cancelled"],
      default: "upcoming",
      index: true,
    },
    notes: String,
    cancelReason: String,
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    deletedAt: { type: Date, select: false },
    playerIds: [{ type: Schema.Types.ObjectId, ref: "Student" }],
    documents: [
      {
        name: { type: String, required: true },
        url: { type: String, required: true },
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

SessionSchema.pre("validate", function (this: SessionDocument, next) {
  if (this.coachIds && this.coachIds.length > 0 && !this.coachId) {
    this.coachId = this.coachIds[0];
  }
  if (this.categories && this.categories.length > 0 && !this.category) {
    this.category = this.categories[0];
  }
  if (this.targetType === "team" && !this.teamId) {
    next(new Error("teamId is required when targetType is 'team'"));
    return;
  }
  if (this.targetType === "category" && !this.category && (!this.categories || this.categories.length === 0)) {
    next(new Error("category or categories are required when targetType is 'category'"));
    return;
  }
  next();
});

SessionSchema.pre(/^find/, function (this: mongoose.Query<unknown, SessionDocument>, next) {
  this.where({ deletedAt: { $exists: false } });
  next();
});

SessionSchema.index({ franchiseId: 1, date: 1 });
SessionSchema.index({ teamId: 1, date: 1 });
SessionSchema.index({ franchiseId: 1, category: 1, date: 1 });

export const SessionModel = mongoose.model<SessionDocument>("Session", SessionSchema);
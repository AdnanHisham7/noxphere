import mongoose, { Schema, Document } from "mongoose";

// Players are never a notification audience — only their guardians and/or
// coaches. "team" resolves to that team's roster's guardians plus its
// coach, still never the players themselves.
export type NotificationAudience = "guardians" | "coaches" | "both" | "team";

export interface NotificationDocument extends Document {
  franchiseId: mongoose.Types.ObjectId;
  title: string;
  body: string;
  audience: NotificationAudience;
  teamId?: mongoose.Types.ObjectId;
  imageUrl?: string;
  documentUrl?: string;
  documentFilename?: string;
  createdBy: mongoose.Types.ObjectId;
  readBy: mongoose.Types.ObjectId[];
  createdAt: Date;
  updatedAt: Date;
}

const NotificationSchema = new Schema<NotificationDocument>(
  {
    franchiseId: { type: Schema.Types.ObjectId, ref: "Franchise", required: true, index: true },
    title: { type: String, required: true, trim: true },
    body: { type: String, required: true },
    audience: {
      type: String,
      enum: ["guardians", "coaches", "both", "team"],
      required: true,
      default: "both",
    },
    teamId: { type: Schema.Types.ObjectId, ref: "Team" },
    imageUrl: { type: String },
    documentUrl: { type: String },
    documentFilename: { type: String },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    readBy: [{ type: Schema.Types.ObjectId, ref: "User" }],
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

NotificationSchema.index({ franchiseId: 1, createdAt: -1 });

export const NotificationModel = mongoose.model<NotificationDocument>("Notification", NotificationSchema);

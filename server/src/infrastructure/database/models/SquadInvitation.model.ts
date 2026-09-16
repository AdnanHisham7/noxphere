// src/infrastructure/database/models/SquadInvitation.model.ts
import mongoose, { Schema, Document } from 'mongoose';

export type SquadInvitationStatus = 'pending' | 'accepted' | 'rejected' | 'cancelled';

export interface SquadInvitationDocument extends Document {
  studentId: mongoose.Types.ObjectId;
  academyId: mongoose.Types.ObjectId;
  franchiseId: mongoose.Types.ObjectId;
  teamId?: mongoose.Types.ObjectId;
  invitedBy: mongoose.Types.ObjectId;
  status: SquadInvitationStatus;
  jerseyNumber?: number;
  position?: string;
  notes?: string;
  rejectionReason?: string;
  respondedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const SquadInvitationSchema = new Schema<SquadInvitationDocument>(
  {
    studentId: { type: Schema.Types.ObjectId, ref: 'Student', required: true, index: true },
    academyId: { type: Schema.Types.ObjectId, ref: 'Academy', required: true, index: true },
    franchiseId: { type: Schema.Types.ObjectId, ref: 'Franchise', required: true, index: true },
    teamId: { type: Schema.Types.ObjectId, ref: 'Team', index: true },
    invitedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    status: {
      type: String,
      enum: ['pending', 'accepted', 'rejected', 'cancelled'],
      default: 'pending',
      index: true,
    },
    jerseyNumber: { type: Number, min: 1, max: 99 },
    position: { type: String, trim: true },
    notes: { type: String, trim: true },
    rejectionReason: { type: String, trim: true },
    respondedAt: { type: Date },
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

SquadInvitationSchema.index({ studentId: 1, academyId: 1, status: 1 });
SquadInvitationSchema.index({ academyId: 1, createdAt: -1 });

export const SquadInvitationModel = mongoose.model<SquadInvitationDocument>(
  'SquadInvitation',
  SquadInvitationSchema
);

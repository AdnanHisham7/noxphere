// src/infrastructure/database/models/Attendance.model.ts
import mongoose, { Schema, Document } from 'mongoose';

export interface AttendanceDocument extends Document {
  studentId: mongoose.Types.ObjectId;
  campId: mongoose.Types.ObjectId;
  teamId: mongoose.Types.ObjectId;
  coachId: mongoose.Types.ObjectId;
  date?: Date; // Deprecated, use sessionDate instead
  sessionDate: Date;
  status: 'present' | 'absent' | 'late' | 'excused';
  checkInTime?: Date;
  remarks?: string;
  proofPhotoUrl?: string;
  isOfflineEntry: boolean;
  syncedAt?: Date;
  guardianNotified: boolean;
  manuallyEdited: boolean;
  editedBy?: mongoose.Types.ObjectId;
  markedBy?: string;
  createdAt: Date;
  updatedAt: Date;
}

const AttendanceSchema = new Schema<AttendanceDocument>(
  {
    studentId: { type: Schema.Types.ObjectId, ref: 'Student', required: true, index: true },
    campId: { type: Schema.Types.ObjectId, ref: 'Camp', required: true, index: true },
    teamId: { type: Schema.Types.ObjectId, ref: 'Team', required: true, index: true },
    coachId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    sessionDate: { type: Date, required: true, index: true },
    status: {
      type: String,
      enum: ['present', 'absent', 'late', 'excused'],
      required: true,
      index: true,
    },
    checkInTime: Date,
    remarks: String,
    proofPhotoUrl: String,
    isOfflineEntry: { type: Boolean, default: false },
    syncedAt: Date,
    guardianNotified: { type: Boolean, default: false },
    manuallyEdited: { type: Boolean, default: false },
    editedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

AttendanceSchema.index({ studentId: 1, campId: 1, sessionDate: -1 });
AttendanceSchema.index({ teamId: 1, sessionDate: -1 });
AttendanceSchema.index({ campId: 1, sessionDate: -1, status: 1 });

// Prevent duplicate attendance per student per date
AttendanceSchema.index({ studentId: 1, campId: 1, sessionDate: 1 }, { unique: true });

export const AttendanceModel = mongoose.model<AttendanceDocument>('Attendance', AttendanceSchema);
// src/application/use-cases/consent/ConsentUseCases.ts
import { ConsentRecordModel } from "../../../infrastructure/database/models/ConsentRecord.model";
import { StudentModel } from "../../../infrastructure/database/models/Student.model";
import { FranchiseModel } from "../../../infrastructure/database/models/Franchise.model";
import { NotFoundError, ForbiddenError, BadRequestError } from "../../../shared/errors/AppError";

// The itemized notice required under DPDP Rule 3: a plain-language,
// self-contained account of exactly what's collected and why, presented
// before consent is captured — not a link to a separate privacy policy.
// Bump `version` any time the wording or scope changes; existing
// ConsentRecords keep the version they actually saw (see
// ConsentRecordModel.noticeVersion), so a wording change never silently
// rewrites what someone is deemed to have agreed to — they'd need to
// consent again under the new version.
export const CONSENT_NOTICE = {
  version: "2026-08-v1",
  dataCategories: [
    "Full name, date of birth, and photo",
    "Guardian/parent name, phone number, and email address",
    "Health information you choose to provide (blood group, allergies, medical conditions, emergency contact, and any medical documents you upload)",
    "Attendance records and performance/skill evaluations logged by coaches",
    "Fee and payment records",
    "Session schedules and any coach remarks about the player",
  ],
  purposes: [
    "Academy enrollment and squad/roster management",
    "Tracking attendance and training performance",
    "Sending you schedule changes, attendance alerts, and fee reminders",
    "Processing fee payments",
    "Emergency contact in case of injury or a medical situation during training",
    "Coach evaluation and internal player development notes",
  ],
} as const;

export class ConsentUseCases {
  private async assertGuardianOfStudent(studentId: string, guardianId: string): Promise<void> {
    const student = await StudentModel.findById(studentId).select("guardianIds").lean();
    if (!student) throw new NotFoundError("Student");
    const isLinkedGuardian = student.guardianIds?.some((id) => id.toString() === guardianId);
    if (!isLinkedGuardian) {
      throw new ForbiddenError("You aren't a registered guardian for this player");
    }
  }

  async getStatusForGuardian(guardianId: string): Promise<
    Array<{
      studentId: string;
      studentName: string;
      hasActiveConsent: boolean;
      noticeVersion: string | null;
      grantedAt: Date | null;
      withdrawnAt: Date | null;
    }>
  > {
    const students = await StudentModel.find({ guardianIds: guardianId })
      .select("firstName lastName")
      .lean();
    if (students.length === 0) return [];

    const records = await ConsentRecordModel.find({
      guardianId,
      consentType: "enrollment",
      studentId: { $in: students.map((s) => s._id) },
    }).lean();
    const recordByStudent = new Map(records.map((r) => [r.studentId.toString(), r]));

    return students.map((s) => {
      const record = recordByStudent.get(s._id.toString());
      const hasActiveConsent = !!record && !record.withdrawnAt && record.noticeVersion === CONSENT_NOTICE.version;
      return {
        studentId: s._id.toString(),
        studentName: `${s.firstName} ${s.lastName}`,
        hasActiveConsent,
        noticeVersion: record?.noticeVersion ?? null,
        grantedAt: record?.grantedAt ?? null,
        withdrawnAt: record?.withdrawnAt ?? null,
      };
    });
  }

  async grantConsent(
    studentId: string,
    guardianId: string,
    meta: { ip?: string; userAgent?: string },
    consentType: "enrollment" | "public_profile" = "enrollment",
  ): Promise<void> {
    await this.assertGuardianOfStudent(studentId, guardianId);
    const student = await StudentModel.findById(studentId).select("franchiseId").lean();
    if (!student) throw new NotFoundError("Student");
    const franchise = await FranchiseModel.findById(student.franchiseId).select("academyId").lean();
    if (!franchise) throw new NotFoundError("Franchise");

    await ConsentRecordModel.findOneAndUpdate(
      { studentId, guardianId, consentType },
      {
        $set: {
          studentId,
          guardianId,
          consentType,
          academyId: franchise.academyId,
          noticeVersion: CONSENT_NOTICE.version,
          dataCategories: [...CONSENT_NOTICE.dataCategories],
          purposes: [...CONSENT_NOTICE.purposes],
          grantedAt: new Date(),
          grantedIp: meta.ip,
          grantedUserAgent: meta.userAgent,
        },
        $unset: { withdrawnAt: "", withdrawnIp: "", withdrawalReason: "" },
      },
      { upsert: true, new: true },
    );
  }

  async withdrawConsent(
    studentId: string,
    guardianId: string,
    reason: string | undefined,
    meta: { ip?: string },
    consentType: "enrollment" | "public_profile" = "enrollment",
  ): Promise<void> {
    await this.assertGuardianOfStudent(studentId, guardianId);
    const record = await ConsentRecordModel.findOne({ studentId, guardianId, consentType });
    if (!record || record.withdrawnAt) {
      throw new BadRequestError("There's no active consent to withdraw for this player");
    }
    record.withdrawnAt = new Date();
    record.withdrawnIp = meta.ip;
    record.withdrawalReason = reason;
    await record.save();
  }

  // The guardian's single opt-in toggle for the public player page (see
  // Student.publicProfileEnabled). Enabling grants 'public_profile'
  // consent and flips the flag in one action; disabling withdraws it and
  // flips the flag back off, which immediately 404s the public page (see
  // PublicPlayerUseCases.getByToken).
  async setPublicProfileEnabled(
    studentId: string,
    guardianId: string,
    enabled: boolean,
    meta: { ip?: string; userAgent?: string },
    settings?: Record<string, any>,
  ): Promise<void> {
    await this.assertGuardianOfStudent(studentId, guardianId);
    if (enabled) {
      await this.grantConsent(studentId, guardianId, meta, "public_profile");
    } else {
      const record = await ConsentRecordModel.findOne({ studentId, guardianId, consentType: "public_profile" });
      if (record && !record.withdrawnAt) {
        record.withdrawnAt = new Date();
        record.withdrawnIp = meta.ip;
        await record.save();
      }
    }
    const updatePayload: Record<string, any> = { publicProfileEnabled: enabled };
    if (settings) {
      updatePayload.publicProfileSettings = settings;
    }
    await StudentModel.findByIdAndUpdate(studentId, updatePayload);
  }

  // Used by the manager-facing Students page to show which players still
  // need a guardian to complete consent, without an N+1 query per row.
  async getStatusForFranchise(franchiseId: string): Promise<Record<string, boolean>> {
    const students = await StudentModel.find({ franchiseId }).select("_id").lean();
    if (students.length === 0) return {};
    const records = await ConsentRecordModel.find({
      studentId: { $in: students.map((s) => s._id) },
      consentType: "enrollment",
      withdrawnAt: { $exists: false },
      noticeVersion: CONSENT_NOTICE.version,
    })
      .select("studentId")
      .lean();
    const consented = new Set(records.map((r) => r.studentId.toString()));
    const result: Record<string, boolean> = {};
    for (const s of students) {
      result[s._id.toString()] = consented.has(s._id.toString());
    }
    return result;
  }
}
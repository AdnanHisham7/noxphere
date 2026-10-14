// src/application/use-cases/complaint/ComplaintUseCases.ts
import mongoose from "mongoose";
import { ComplaintModel } from "../../../infrastructure/database/models/Complaint.model";
import { UserModel } from "../../../infrastructure/database/models/User.model";
import { StudentModel } from "../../../infrastructure/database/models/Student.model";
import { TeamModel } from "../../../infrastructure/database/models/Team.model";
import { SessionModel } from "../../../infrastructure/database/models/Session.model";
import { NotFoundError, ForbiddenError, BadRequestError } from "../../../shared/errors/AppError";
import { notificationService } from "../../../infrastructure/services/NotificationService";

export class ComplaintUseCases {
  async create(dto: {
    academyId: string;
    raisedBy: string;
    subject: string;
    message: string;
    studentId?: string;
  }) {
    const user = await UserModel.findById(dto.raisedBy).select("firstName lastName role").lean();
    if (!user) throw new NotFoundError("User");

    let studentName: string | undefined;
    let studentIdObj: mongoose.Types.ObjectId | undefined;

    if (dto.studentId && mongoose.Types.ObjectId.isValid(dto.studentId)) {
      const student = await StudentModel.findById(dto.studentId).select("firstName lastName").lean();
      if (student) {
        studentIdObj = student._id as mongoose.Types.ObjectId;
        studentName = `${student.firstName} ${student.lastName}`.trim();
      }
    } else if (user.role === "guardian") {
      const student = await StudentModel.findOne({
        guardianIds: new mongoose.Types.ObjectId(dto.raisedBy),
        deletedAt: { $exists: false },
      })
        .select("firstName lastName")
        .lean();
      if (student) {
        studentIdObj = student._id as mongoose.Types.ObjectId;
        studentName = `${student.firstName} ${student.lastName}`.trim();
      }
    }

    const complaint = await ComplaintModel.create({
      academyId: dto.academyId,
      raisedBy: dto.raisedBy,
      raisedByRole: user.role,
      raisedByName: `${user.firstName} ${user.lastName}`.trim(),
      studentId: studentIdObj,
      studentName,
      subject: dto.subject,
      message: dto.message,
    });

    // 1. Notify academy managers about the new complaint
    const managers = await UserModel.find({
      academyId: dto.academyId,
      role: "manager",
      isActive: true,
    })
      .select("_id")
      .lean();

    if (managers.length > 0) {
      const managerIds = managers.map((m) => m._id.toString());
      await notificationService.send({
        userIds: managerIds,
        type: "complaint_received",
        title: "New Complaint Submitted",
        body: `${complaint.raisedByName} submitted a complaint${studentName ? ` regarding ${studentName}` : ""}: "${dto.subject}"`,
        channels: ["push", "email"],
      }).catch(() => undefined);
    }

    // 2. Notify the filer (Guardian) that their complaint has been registered
    await notificationService.send({
      userIds: [dto.raisedBy],
      type: "complaint_received",
      title: "Complaint Received",
      body: `Your complaint${studentName ? ` regarding ${studentName}` : ""} ("${dto.subject}") has been registered with academy management.`,
      channels: ["push"],
    }).catch(() => undefined);

    return complaint;
  }

  // The manager/coach inbox for their academy.
  async listForAcademy(
    academyId: string,
    status?: "open" | "in_progress" | "resolved",
    userId?: string,
    userRole?: string,
  ) {
    const filter: Record<string, unknown> = { academyId };
    if (status) filter.status = status;

    // If caller is coach, only show complaints forwarded to them
    if (userRole === "coach" && userId) {
      filter["forwardedToCoaches.coachId"] = new mongoose.Types.ObjectId(userId);
    }

    return ComplaintModel.find(filter).sort({ createdAt: -1 });
  }

  // Find candidate coaches for a complaint, prioritizing the student's assigned/team coaches
  async getCandidateCoachesForComplaint(academyId: string, complaintId: string) {
    const complaint = await ComplaintModel.findById(complaintId);
    if (!complaint) throw new NotFoundError("Complaint");
    if (complaint.academyId.toString() !== academyId) {
      throw new ForbiddenError("Complaint belongs to another academy");
    }

    const allCoaches = await UserModel.find({
      academyId,
      role: "coach",
      isActive: true,
    })
      .select("firstName lastName email phone")
      .lean();

    const studentCoachIds = new Set<string>();
    const relationshipMap = new Map<string, string>();

    if (complaint.studentId) {
      const student = await StudentModel.findById(complaint.studentId).lean();
      if (student) {
        if (student.coachId) {
          const id = student.coachId.toString();
          studentCoachIds.add(id);
          relationshipMap.set(id, "Assigned Squad Coach");
        }
        if (student.teamId) {
          const team = await TeamModel.findById(student.teamId).lean();
          if (team?.coachId) {
            const id = team.coachId.toString();
            studentCoachIds.add(id);
            if (!relationshipMap.has(id)) {
              relationshipMap.set(id, `Team Coach (${team.name})`);
            }
          }
        }

        const sessions = await SessionModel.find({
          $or: [
            { "attendees.studentId": student._id },
            ...(student.teamId ? [{ teamId: student.teamId }] : []),
          ],
        })
          .select("coachId coachIds")
          .limit(10)
          .lean();

        for (const sess of sessions) {
          if (sess.coachId) {
            const id = sess.coachId.toString();
            studentCoachIds.add(id);
            if (!relationshipMap.has(id)) {
              relationshipMap.set(id, "Training Session Coach");
            }
          }
          if (sess.coachIds) {
            for (const cId of sess.coachIds) {
              const id = cId.toString();
              studentCoachIds.add(id);
              if (!relationshipMap.has(id)) {
                relationshipMap.set(id, "Training Session Coach");
              }
            }
          }
        }
      }
    }

    const formatted = allCoaches.map((c) => {
      const id = c._id.toString();
      const isStudentCoach = studentCoachIds.has(id);
      return {
        id,
        name: `${c.firstName} ${c.lastName}`.trim(),
        email: c.email,
        phone: c.phone,
        isStudentCoach,
        relationship: isStudentCoach
          ? relationshipMap.get(id) || "Student's Coach"
          : "Academy Coach",
        isAlreadyForwarded:
          complaint.forwardedToCoaches?.some((fc) => fc.coachId.toString() === id) ?? false,
      };
    });

    formatted.sort((a, b) => {
      if (a.isStudentCoach && !b.isStudentCoach) return -1;
      if (!a.isStudentCoach && b.isStudentCoach) return 1;
      return a.name.localeCompare(b.name);
    });

    return {
      complaintId,
      studentName: complaint.studentName,
      coaches: formatted,
    };
  }

  // Forward complaint to selected coaches with manager notes
  async forwardToCoaches(
    complaintId: string,
    academyId: string,
    managerId: string,
    coachIds: string[],
    notes?: string,
  ) {
    const complaint = await ComplaintModel.findById(complaintId);
    if (!complaint) throw new NotFoundError("Complaint");
    if (complaint.academyId.toString() !== academyId) {
      throw new ForbiddenError("Complaint belongs to another academy");
    }

    const manager = await UserModel.findById(managerId).select("firstName lastName role").lean();
    if (!manager) throw new NotFoundError("Manager");

    const coaches = await UserModel.find({
      _id: { $in: coachIds },
      academyId,
      role: "coach",
      isActive: true,
    }).select("firstName lastName email").lean();

    if (coaches.length === 0) {
      throw new BadRequestError("No valid active coaches selected");
    }

    const managerName = `${manager.firstName} ${manager.lastName}`.trim();
    const existingCoachIds = new Set(
      (complaint.forwardedToCoaches || []).map((fc) => fc.coachId.toString()),
    );

    const newlyForwarded: Array<{ cId: string; name: string }> = [];

    for (const coach of coaches) {
      const cId = coach._id.toString();
      if (!existingCoachIds.has(cId)) {
        complaint.forwardedToCoaches = complaint.forwardedToCoaches || [];
        complaint.forwardedToCoaches.push({
          coachId: coach._id as mongoose.Types.ObjectId,
          coachName: `${coach.firstName} ${coach.lastName}`.trim(),
          forwardedAt: new Date(),
          notes,
        });
        newlyForwarded.push({ cId, name: `${coach.firstName} ${coach.lastName}`.trim() });
      }
    }

    complaint.forwardedBy = manager._id as mongoose.Types.ObjectId;
    complaint.forwardedByName = managerName;
    complaint.forwardedAt = new Date();
    complaint.forwardedNotes = notes;
    if (complaint.status === "open") {
      complaint.status = "in_progress";
    }

    await complaint.save();

    // 1. Send system alerts to the newly forwarded coaches
    if (newlyForwarded.length > 0) {
      const recipientCoachIds = newlyForwarded.map((c) => c.cId);
      await notificationService.send({
        userIds: recipientCoachIds,
        type: "complaint_forwarded",
        title: `Complaint Forwarded: ${complaint.subject}`,
        body: `Manager ${managerName} forwarded a complaint${complaint.studentName ? ` regarding ${complaint.studentName}` : ""}: "${complaint.subject}".${notes ? ` Manager Note: "${notes}"` : ""}`,
        channels: ["push", "email"],
      }).catch(() => undefined);
    }

    // 2. Send update alert to the guardian who raised the complaint
    const coachNamesStr = coaches.map((c) => `${c.firstName} ${c.lastName}`.trim()).join(", ");
    await notificationService.send({
      userIds: [complaint.raisedBy.toString()],
      type: "complaint_forwarded",
      title: "Complaint Forwarded to Coaching Staff",
      body: `Your complaint ("${complaint.subject}")${complaint.studentName ? ` regarding ${complaint.studentName}` : ""} has been forwarded to ${coachNamesStr} for direct review.`,
      channels: ["push"],
    }).catch(() => undefined);

    return complaint;
  }

  // Coach submits feedback/response on a forwarded complaint
  async coachRespond(
    complaintId: string,
    academyId: string,
    coachId: string,
    response: string,
  ) {
    const complaint = await ComplaintModel.findById(complaintId);
    if (!complaint) throw new NotFoundError("Complaint");
    if (complaint.academyId.toString() !== academyId) {
      throw new ForbiddenError("Complaint belongs to another academy");
    }

    const coach = await UserModel.findById(coachId).select("firstName lastName role").lean();
    if (!coach || coach.role !== "coach") {
      throw new ForbiddenError("Only coaches can submit coach feedback");
    }

    const coachName = `${coach.firstName} ${coach.lastName}`.trim();

    complaint.coachResponses = complaint.coachResponses || [];
    complaint.coachResponses.push({
      coachId: coach._id as mongoose.Types.ObjectId,
      coachName,
      response,
      respondedAt: new Date(),
    });

    if (complaint.status === "open") {
      complaint.status = "in_progress";
    }

    await complaint.save();

    // 1. Notify academy managers about coach response
    const managers = await UserModel.find({
      academyId,
      role: "manager",
      isActive: true,
    })
      .select("_id")
      .lean();

    if (managers.length > 0) {
      const managerIds = managers.map((m) => m._id.toString());
      await notificationService.send({
        userIds: managerIds,
        type: "complaint_coach_response",
        title: `Coach Response: ${complaint.subject}`,
        body: `Coach ${coachName} responded to complaint${complaint.studentName ? ` regarding ${complaint.studentName}` : ""}: "${response}"`,
        channels: ["push", "email"],
      }).catch(() => undefined);
    }

    // 2. Notify guardian
    await notificationService.send({
      userIds: [complaint.raisedBy.toString()],
      type: "complaint_response",
      title: `Coach Responded: ${complaint.subject}`,
      body: `Coach ${coachName} provided feedback on your complaint: "${response}"`,
      channels: ["push"],
    }).catch(() => undefined);

    return complaint;
  }

  // What the person who filed a complaint sees of their own
  async listMine(userId: string) {
    return ComplaintModel.find({ raisedBy: userId }).sort({ createdAt: -1 });
  }

  // Manager response to complaint
  async respond(
    complaintId: string,
    academyId: string,
    responderId: string,
    response: string,
    status: "in_progress" | "resolved",
  ) {
    const complaint = await ComplaintModel.findById(complaintId);
    if (!complaint) throw new NotFoundError("Complaint");
    if (complaint.academyId.toString() !== academyId) {
      throw new ForbiddenError("This complaint doesn't belong to your academy");
    }

    const responder = await UserModel.findById(responderId).select("firstName lastName role").lean();
    const responderName = responder ? `${responder.firstName} ${responder.lastName}`.trim() : "Academy Management";

    complaint.response = response;
    complaint.status = status;
    complaint.respondedAt = new Date();
    complaint.respondedBy = responderId as any;
    complaint.respondedByName = responderName;
    await complaint.save();

    // 1. Send alert to the guardian
    await notificationService.send({
      userIds: [complaint.raisedBy.toString()],
      type: "complaint_response",
      title: `Complaint ${status === "resolved" ? "Resolved" : "Updated"}: ${complaint.subject}`,
      body: `Your complaint has been marked as ${status.replace("_", " ")}. Management response: "${response}"`,
      channels: ["push", "email"],
    }).catch(() => undefined);

    // 2. If forwarded to coaches, inform them of manager's response / resolution
    if (complaint.forwardedToCoaches && complaint.forwardedToCoaches.length > 0) {
      const coachIds = complaint.forwardedToCoaches.map((fc) => fc.coachId.toString());
      await notificationService.send({
        userIds: coachIds,
        type: "complaint_response",
        title: `Complaint ${status === "resolved" ? "Resolved" : "Updated"}: ${complaint.subject}`,
        body: `Manager ${responderName} responded to complaint${complaint.studentName ? ` regarding ${complaint.studentName}` : ""}: "${response}" (${status.replace("_", " ")})`,
        channels: ["push"],
      }).catch(() => undefined);
    }

    return complaint;
  }
}
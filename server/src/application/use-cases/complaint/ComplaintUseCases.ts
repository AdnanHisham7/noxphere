// src/application/use-cases/complaint/ComplaintUseCases.ts
import { ComplaintModel } from "../../../infrastructure/database/models/Complaint.model";
import { UserModel } from "../../../infrastructure/database/models/User.model";
import { NotFoundError, ForbiddenError } from "../../../shared/errors/AppError";
import { notificationService } from "../../../infrastructure/services/NotificationService";

export class ComplaintUseCases {
  async create(dto: {
    academyId: string;
    raisedBy: string;
    subject: string;
    message: string;
  }) {
    // req.user (the JWT payload) only carries sub/role/franchiseId/
    // academyId/permissions — no name — so it's resolved here from the
    // User record rather than trusting anything client-supplied for
    // raisedByName/raisedByRole.
    const user = await UserModel.findById(dto.raisedBy).select("firstName lastName role").lean();
    if (!user) throw new NotFoundError("User");
    const complaint = await ComplaintModel.create({
      academyId: dto.academyId,
      raisedBy: dto.raisedBy,
      raisedByRole: user.role,
      raisedByName: `${user.firstName} ${user.lastName}`.trim(),
      subject: dto.subject,
      message: dto.message,
    });

    // Notify academy managers about the new complaint
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
        body: `${user.firstName} ${user.lastName} submitted a complaint: "${dto.subject}"`,
        channels: ["push"],
      }).catch(() => undefined);
    }

    return complaint;
  }

  // The manager's inbox for their own academy.
  async listForAcademy(academyId: string, status?: "open" | "in_progress" | "resolved") {
    const filter: Record<string, unknown> = { academyId };
    if (status) filter.status = status;
    return ComplaintModel.find(filter).sort({ createdAt: -1 });
  }

  // What the person who filed a complaint sees of their own — so a
  // guardian/coach/employee can check status and read the response
  // without seeing anyone else's complaints.
  async listMine(userId: string) {
    return ComplaintModel.find({ raisedBy: userId }).sort({ createdAt: -1 });
  }

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
    complaint.response = response;
    complaint.status = status;
    complaint.respondedAt = new Date();
    complaint.respondedBy = responderId as any;
    await complaint.save();

    // Send internal alert to the user who raised the complaint
    await notificationService.send({
      userIds: [complaint.raisedBy.toString()],
      type: "complaint_response",
      title: `Complaint Updated: ${complaint.subject}`,
      body: `Your complaint has been marked as ${status.replace("_", " ")}. Response: "${response}"`,
      channels: ["push", "email"],
    }).catch(() => undefined);

    return complaint;
  }
}
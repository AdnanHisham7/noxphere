import mongoose from "mongoose";
import {
  NfcCardRequestModel,
  NfcCardRequestDocument,
  NfcStudentItem,
} from "../../../infrastructure/database/models/NfcCardRequest.model";
import { PlatformSettingsModel } from "../../../infrastructure/database/models/PlatformSettings.model";
import { StudentModel } from "../../../infrastructure/database/models/Student.model";
import { UserModel } from "../../../infrastructure/database/models/User.model";
import { AcademyModel } from "../../../infrastructure/database/models/Academy.model";
import { FranchiseModel } from "../../../infrastructure/database/models/Franchise.model";
import { razorpayService } from "../../../infrastructure/services/RazorpayService";
import { NotificationService } from "../../../infrastructure/services/NotificationService";
import {
  getNfcPricingForCurrency,
  getCurrencySymbol,
} from "../../../infrastructure/services/GeoLocationService";
import { config } from "../../../config/app.config";
import {
  BadRequestError,
  NotFoundError,
  ForbiddenError,
} from "../../../shared/errors/AppError";
import {
  CreatePlayerNfcRequestDto,
  CreateAcademyNfcRequestDto,
  ApproveNfcRequestDto,
  UpdateNfcFulfillmentDto,
  UpdateNfcPricingDto,
  ListNfcRequestsQueryDto,
} from "../../dtos/nfcCard.dto";

export class NfcCardUseCases {
  constructor(private notificationService: NotificationService = new NotificationService()) {}

  // ─── Pricing Management ───────────────────────────────────────────────────────

  async getPricing(currency: string = "INR"): Promise<{ cardPrice: number; customCardPrice: number; currency: string }> {
    const settings = await PlatformSettingsModel.findOne().lean();
    const pricing = getNfcPricingForCurrency(currency, settings?.currencyPricing, {
      defaultNfcCardPrice: settings?.defaultNfcCardPrice,
      defaultNfcCustomCardPrice: settings?.defaultNfcCustomCardPrice,
    });
    return {
      cardPrice: pricing.cardPrice,
      customCardPrice: pricing.customCardPrice,
      currency: (currency || "INR").toUpperCase(),
    };
  }

  async updatePricing(
    dto: UpdateNfcPricingDto,
    updatedBy: string,
  ): Promise<{ cardPrice: number; customCardPrice: number }> {
    if (dto.cardPrice < 0 || dto.customCardPrice < 0) {
      throw new BadRequestError("NFC Card pricing cannot be negative");
    }

    const updated = await PlatformSettingsModel.findOneAndUpdate(
      {},
      {
        defaultNfcCardPrice: dto.cardPrice,
        defaultNfcCustomCardPrice: dto.customCardPrice,
        updatedBy,
      },
      { upsert: true, new: true },
    );

    return {
      cardPrice: updated.defaultNfcCardPrice,
      customCardPrice: updated.defaultNfcCustomCardPrice,
    };
  }

  // ─── Independent Player Request ───────────────────────────────────────────────

  async createPlayerRequest(
    userId: string,
    dto: CreatePlayerNfcRequestDto,
  ): Promise<NfcCardRequestDocument> {
    const student = await StudentModel.findOne({ userId, isActive: true });
    if (!student) {
      throw new NotFoundError("No active student profile linked to this user account");
    }

    // Check for an already pending or approved active request
    const existingActive = await NfcCardRequestModel.findOne({
      requesterId: userId,
      status: { $in: ["pending", "approved", "paid", "dispatched"] },
    });
    if (existingActive) {
      if (existingActive.status === "approved") {
        throw new BadRequestError(
          "You already have an approved NFC card request awaiting payment. Please complete payment or contact support.",
        );
      }
      if (existingActive.status === "pending") {
        throw new BadRequestError(
          "You already have a pending NFC card request under review by the platform admin.",
        );
      }
      if (["paid", "dispatched"].includes(existingActive.status)) {
        throw new BadRequestError(
          `Your card order is currently in progress (status: ${existingActive.status}).`,
        );
      }
    }

    // Determine currency from student's franchise -> academy, fallback to INR
    let currency = "INR";
    if (student.franchiseId) {
      const fr = await FranchiseModel.findById(student.franchiseId).select("academyId").lean();
      if (fr?.academyId) {
        const ac = await AcademyModel.findById(fr.academyId).select("currency").lean();
        if (ac?.currency) currency = ac.currency.toUpperCase();
      }
    }

    const pricing = await this.getPricing(currency);
    const unitPrice = pricing.cardPrice;
    const quantity = 1;
    const totalAmount = unitPrice * quantity;

    const studentItem: NfcStudentItem = {
      studentId: student._id as mongoose.Types.ObjectId,
      studentName: `${student.firstName} ${student.lastName}`.trim(),
      jerseyNumber: student.jerseyNumber,
      photo: student.photo,
      franchiseName: undefined,
      ageGroup: student.ageGroup,
      publicProfileToken: student.publicProfileToken,
    };

    const request = await NfcCardRequestModel.create({
      requesterId: userId,
      requesterRole: "student",
      requesterType: "independent_player",
      cardType: "official",
      students: [studentItem],
      quantity,
      unitPrice,
      totalAmount,
      currency,
      shippingAddress: dto.shippingAddress,
      status: "pending",
    });

    // Notify Super Admins
    this.notifySuperAdmins({
      title: "New NFC Card Request",
      body: `${studentItem.studentName} (Independent Player) requested a Noxphere NFC card (${currency} ${totalAmount}).`,
      type: "nfc_request_created",
      data: { requestId: request._id.toString() },
    }).catch(() => {});

    return request;
  }

  // ─── Academy Bulk Request ────────────────────────────────────────────────────

  async createAcademyRequest(
    userId: string,
    academyId: string,
    dto: CreateAcademyNfcRequestDto,
  ): Promise<NfcCardRequestDocument> {
    const academy = await AcademyModel.findById(academyId).lean();
    if (!academy) {
      throw new NotFoundError("Academy not found");
    }

    const students = await StudentModel.find({
      _id: { $in: dto.studentIds },
      isActive: true,
    })
      .populate("franchiseId", "name")
      .lean();

    if (students.length === 0) {
      throw new BadRequestError("No valid active students found for selection");
    }

    const currency = (academy.currency || "INR").toUpperCase();
    const pricing = await this.getPricing(currency);
    const unitPrice =
      dto.cardType === "custom" ? pricing.customCardPrice : pricing.cardPrice;
    const quantity = students.length;
    const totalAmount = unitPrice * quantity;

    const studentItems: NfcStudentItem[] = students.map((s: any) => ({
      studentId: s._id as mongoose.Types.ObjectId,
      studentName: `${s.firstName} ${s.lastName}`.trim(),
      jerseyNumber: s.jerseyNumber,
      photo: s.photo,
      franchiseName: s.franchiseId?.name,
      ageGroup: s.ageGroup,
      publicProfileToken: s.publicProfileToken,
    }));

    const request = await NfcCardRequestModel.create({
      requesterId: userId,
      requesterRole: "manager",
      requesterType: "academy",
      academyId,
      cardType: dto.cardType,
      customDesignUrl: dto.customDesignUrl,
      customDesignFileName: dto.customDesignFileName,
      students: studentItems,
      quantity,
      unitPrice,
      totalAmount,
      currency,
      shippingAddress: dto.shippingAddress,
      status: "pending",
    });

    // Notify Super Admins
    this.notifySuperAdmins({
      title: "New Bulk NFC Card Request",
      body: `${academy.name} requested ${quantity} ${dto.cardType} NFC card(s) (${currency} ${totalAmount}).`,
      type: "nfc_request_created",
      data: { requestId: request._id.toString() },
    }).catch(() => {});

    return request;
  }

  // ─── Listing & Detail ────────────────────────────────────────────────────────

  async listRequests(
    query: ListNfcRequestsQueryDto,
    user: { sub: string; role: string; academyId?: string },
  ) {
    const filter: Record<string, any> = {};

    if (user.role === "student") {
      filter.requesterId = user.sub;
    } else if (user.role === "manager") {
      filter.academyId = user.academyId;
    }

    if (query.status && query.status !== "all") {
      filter.status = query.status;
    }

    if (query.requesterType && query.requesterType !== "all") {
      filter.requesterType = query.requesterType;
    }

    if (query.search && query.search.trim()) {
      const searchRegex = new RegExp(query.search.trim(), "i");
      filter.$or = [
        { "shippingAddress.recipientName": searchRegex },
        { "shippingAddress.city": searchRegex },
        { "students.studentName": searchRegex },
      ];
    }

    const page = query.page || 1;
    const limit = query.limit || 20;
    const skip = (page - 1) * limit;

    const [rawRequests, total] = await Promise.all([
      NfcCardRequestModel.find(filter)
        .populate("requesterId", "firstName lastName email phone avatar")
        .populate("academyId", "name code logo")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      NfcCardRequestModel.countDocuments(filter),
    ]);

    const requests = rawRequests.map((r: any) => ({
      ...r,
      id: r._id?.toString() || r.id,
      requesterId: r.requesterId
        ? {
            ...r.requesterId,
            id: r.requesterId._id?.toString() || r.requesterId.id,
          }
        : r.requesterId,
      academyId: r.academyId
        ? {
            ...r.academyId,
            id: r.academyId._id?.toString() || r.academyId.id,
          }
        : r.academyId,
    }));

    return {
      requests,
      total,
      page,
      totalPages: Math.ceil(total / limit),
    };
  }

  async getRequestById(
    requestId: string,
    user: { sub: string; role: string; academyId?: string },
  ): Promise<NfcCardRequestDocument> {
    const request = await NfcCardRequestModel.findById(requestId)
      .populate("requesterId", "firstName lastName email phone avatar")
      .populate("academyId", "name code logo");

    if (!request) {
      throw new NotFoundError("NFC Card request not found");
    }

    // Role-based access control
    if (user.role === "student" && request.requesterId._id.toString() !== user.sub) {
      throw new ForbiddenError("You cannot access this NFC card request");
    }
    if (
      user.role === "manager" &&
      request.academyId &&
      request.academyId._id.toString() !== user.academyId
    ) {
      throw new ForbiddenError("You cannot access this academy's NFC card request");
    }

    return request;
  }

  // ─── Super Admin Approval / Rejection ────────────────────────────────────────

  async approveRequest(
    requestId: string,
    superAdminId: string,
    dto?: ApproveNfcRequestDto,
  ): Promise<NfcCardRequestDocument> {
    const request = await NfcCardRequestModel.findById(requestId);
    if (!request) throw new NotFoundError("NFC Card request not found");

    if (request.status !== "pending") {
      throw new BadRequestError(`Cannot approve a request with status '${request.status}'`);
    }

    if (dto?.unitPrice !== undefined) {
      request.unitPrice = dto.unitPrice;
      request.totalAmount = request.quantity * dto.unitPrice;
    }

    request.status = "approved";
    await request.save();

    // Notify purchaser
    await this.notificationService.send({
      userIds: [request.requesterId.toString()],
      type: "nfc_request_approved",
      title: "NFC Card Request Approved!",
      body: `Your request for ${request.quantity} NFC card(s) (Total: ₹${request.totalAmount}) has been approved. Please complete payment to initiate your order.`,
      data: {
        requestId: request._id.toString(),
        totalAmount: String(request.totalAmount),
      },
    });

    return request;
  }

  async rejectRequest(
    requestId: string,
    superAdminId: string,
    reason: string,
  ): Promise<NfcCardRequestDocument> {
    const request = await NfcCardRequestModel.findById(requestId);
    if (!request) throw new NotFoundError("NFC Card request not found");

    if (request.status !== "pending") {
      throw new BadRequestError(`Cannot reject a request with status '${request.status}'`);
    }

    request.status = "rejected";
    request.rejectionReason = reason;
    await request.save();

    // Notify purchaser
    await this.notificationService.send({
      userIds: [request.requesterId.toString()],
      type: "nfc_request_rejected",
      title: "NFC Card Request Declined",
      body: `Your NFC card request was declined. Reason: ${reason}`,
      data: {
        requestId: request._id.toString(),
        reason,
      },
    });

    return request;
  }

  // ─── Stripe Checkout & Payment ───────────────────────────────────────────────

  async createCheckoutSession(
    requestId: string,
    user: { sub: string; role: string; academyId?: string },
  ): Promise<{ url: string }> {
    const request = await NfcCardRequestModel.findById(requestId);
    if (!request) throw new NotFoundError("NFC Card request not found");

    if (request.status !== "approved") {
      throw new BadRequestError(
        `Payment is only allowed for approved requests. Current status is '${request.status}'.`,
      );
    }

    // Gating
    if (user.role === "student" && request.requesterId.toString() !== user.sub) {
      throw new ForbiddenError("Not authorized to pay for this request");
    }
    if (
      user.role === "manager" &&
      request.academyId &&
      request.academyId.toString() !== user.academyId
    ) {
      throw new ForbiddenError("Not authorized to pay for this request");
    }

    throw new BadRequestError("Stripe payments have been decommissioned. Please use Razorpay for online checkout.");
  }

  async createRazorpayOrder(
    requestId: string,
    user: { sub: string; role: string; academyId?: string },
  ): Promise<{
    orderId: string;
    amount: number;
    currency: string;
    keyId: string;
    totalAmount: number;
    cardType: string;
    quantity: number;
    currencySymbol: string;
  }> {
    const request = await NfcCardRequestModel.findById(requestId);
    if (!request) throw new NotFoundError("NFC Card request not found");

    if (request.status !== "approved") {
      throw new BadRequestError(
        `Payment is only allowed for approved requests. Current status is '${request.status}'.`,
      );
    }

    if (user.role === "student" && request.requesterId.toString() !== user.sub) {
      throw new ForbiddenError("Not authorized to pay for this request");
    }
    if (
      user.role === "manager" &&
      request.academyId &&
      request.academyId.toString() !== user.academyId
    ) {
      throw new ForbiddenError("Not authorized to pay for this request");
    }

    const currency = (request.currency || "INR").toUpperCase();
    const amountPaise = Math.round(request.totalAmount * 100);
    const order = await razorpayService.createOrder({
      amountPaise,
      currency,
      receipt: `nfc_${request._id.toString().slice(-10)}`,
      notes: {
        nfcRequestId: request._id.toString(),
        requesterId: user.sub,
        cardType: request.cardType,
        quantity: request.quantity,
        currency,
      },
    });

    request.razorpayOrderId = order.id;
    await request.save();

    return {
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
      keyId: razorpayService.getKeyId(),
      totalAmount: request.totalAmount,
      cardType: request.cardType,
      quantity: request.quantity,
      currencySymbol: getCurrencySymbol(currency),
    };
  }

  async verifyRazorpayPayment(params: {
    requestId: string;
    orderId: string;
    paymentId: string;
    signature: string;
  }): Promise<{ paid: boolean; request: any }> {
    const { requestId, orderId, paymentId, signature } = params;
    const isValid = razorpayService.verifyPaymentSignature({
      orderId,
      paymentId,
      signature,
    });
    if (!isValid) {
      throw new BadRequestError("Invalid Razorpay payment signature");
    }

    const request = await NfcCardRequestModel.findById(requestId);
    if (!request) throw new NotFoundError("NFC Card request not found");

    request.status = "paid";
    request.paidAt = new Date();
    request.razorpayOrderId = orderId;
    request.razorpayPaymentId = paymentId;
    request.razorpaySignature = signature;
    await request.save();

    const sym = getCurrencySymbol(request.currency);

    // Alert Super Admins about the payment received!
    await this.notificationService.notifySuperAdmins({
      type: "payment_received",
      title: "NFC Cards Paid — Ready to Dispatch",
      body: `An order of ${request.quantity} ${request.cardType} NFC card(s) has been paid via Razorpay (${sym}${request.totalAmount} ${request.currency || "INR"}). Please prepare shipment to ${request.shippingAddress?.recipientName}.`,
      metadata: { requestId: request._id.toString(), orderId, paymentId },
    });

    return { paid: true, request };
  }

  async verifyCheckoutSession(
    _sessionId: string,
    _user?: { sub?: string; role?: string },
  ): Promise<{ paid: boolean; request: any }> {
    throw new BadRequestError("Stripe session verification is deprecated. All online payments are handled via Razorpay.");
  }

  // ─── Fulfillment Updates (Super Admin) ───────────────────────────────────────

  async updateFulfillmentStatus(
    requestId: string,
    superAdminId: string,
    dto: UpdateNfcFulfillmentDto,
  ): Promise<NfcCardRequestDocument> {
    const request = await NfcCardRequestModel.findById(requestId);
    if (!request) throw new NotFoundError("NFC Card request not found");

    if (!["paid", "dispatched"].includes(request.status) && dto.status !== request.status) {
      throw new BadRequestError(
        `Cannot transition to fulfillment status '${dto.status}' from '${request.status}'`,
      );
    }

    if (dto.status === "dispatched") {
      request.status = "dispatched";
      request.dispatchDetails = {
        courierName: dto.courierName,
        trackingNumber: dto.trackingNumber,
        trackingUrl: dto.trackingUrl,
        dispatchedAt: new Date(),
      };
      await request.save();

      // Notify purchaser
      await this.notificationService.send({
        userIds: [request.requesterId.toString()],
        type: "nfc_order_dispatched",
        title: "Your NFC Card(s) Have Dispatched!",
        body: `Your cards are on the way via ${dto.courierName || "courier"}${
          dto.trackingNumber ? ` (Tracking: ${dto.trackingNumber})` : ""
        }.`,
        data: {
          requestId: request._id.toString(),
          courierName: dto.courierName || "",
          trackingNumber: dto.trackingNumber || "",
        },
      });
    } else if (dto.status === "delivered") {
      request.status = "delivered";
      request.deliveredAt = new Date();
      await request.save();

      // Notify purchaser
      await this.notificationService.send({
        userIds: [request.requesterId.toString()],
        type: "nfc_order_delivered",
        title: "Your NFC Card(s) Have Been Delivered!",
        body: `Your order for ${request.quantity} NFC card(s) has been delivered. Enjoy tapping your verified cards!`,
        data: { requestId: request._id.toString() },
      });
    }

    return request;
  }

  // ─── Helper: Super Admin Notifications ────────────────────────────────────────

  private async notifySuperAdmins(opts: {
    title: string;
    body: string;
    type: any;
    data?: Record<string, string>;
  }): Promise<void> {
    try {
      const superAdmins = await UserModel.find({
        role: "super_admin",
        isActive: true,
      }).select("_id");
      const adminIds = superAdmins.map((a) => a._id.toString());
      if (adminIds.length > 0) {
        await this.notificationService.send({
          userIds: adminIds,
          type: opts.type,
          title: opts.title,
          body: opts.body,
          data: opts.data,
        });
      }
    } catch (err) {
      // Background notifications shouldn't throw to caller
    }
  }
}

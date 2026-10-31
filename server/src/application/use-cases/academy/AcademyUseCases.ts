import { IAcademyRepository } from "../../../domain/repositories/IAcademyRepository";
import { IUserRepository } from "../../../domain/repositories/IUserRepository";
import {
  AcademyEntity,
  Location,
} from "../../../domain/entities/Academy.entity";
import { FranchiseEntity } from "../../../domain/entities/Franchise.entity";
import { FranchiseModel, FranchiseDocument } from "../../../infrastructure/database/models/Franchise.model";
import { UserEntity, UserRole } from "../../../domain/entities/User.entity";
import {
  CreateAcademyDto,
  UpdateAcademyDto,
  AcademyConfigDto,
  UpdateTrialDto,
} from "../../dtos/academy.dto";
import {
  AppError,
  ConflictError,
  NotFoundError,
  BadRequestError,
  ForbiddenError,
} from "../../../shared/errors/AppError";
import bcrypt from "bcryptjs";
import { logger } from "../../../shared/utils/logger";
import { ensureWhatsAppCompatibleImageUrl } from "../../../infrastructure/services/WhatsAppService";
import { schedulerService } from "../../../infrastructure/services/SchedulerService";
import { AcademySubscriptionModel } from "../../../infrastructure/database/models/AcademySubscription.model";
import { PlatformSettingsModel } from "../../../infrastructure/database/models/PlatformSettings.model";
import { geoLocationService, SUPPORTED_CURRENCY_MAP } from "../../../infrastructure/services/GeoLocationService";
import { exchangeRateService } from "../../../infrastructure/services/ExchangeRateService";

function toFranchiseEntity(doc: FranchiseDocument): FranchiseEntity {
  const json = doc.toJSON() as any;
  return {
    id: json.id,
    academyId: json.academyId?.toString?.() ?? json.academyId,
    name: json.name,
    franchiseCode: json.franchiseCode,
    managerId: json.managerId?.toString?.(),
    location: json.location,
    sessionTimes: json.sessionTimes ?? [],
    ageGroups: json.ageGroups ?? [],
    skillLevels: json.skillLevels ?? [],
    maxStudents: json.maxStudents,
    isActive: json.isActive,
    alertBeforeMinutes: json.alertBeforeMinutes,
    notificationAlertAfterMinutes: json.notificationAlertAfterMinutes,
    skillParameters: json.skillParameters ?? [],
    createdAt: json.createdAt,
    updatedAt: json.updatedAt,
  };
}

export class AcademyUseCases {
  constructor(
    private readonly academyRepository: IAcademyRepository,
    private readonly userRepository: IUserRepository,
  ) {}

  async createAcademy(dto: CreateAcademyDto): Promise<AcademyEntity & { defaultFranchise: FranchiseEntity }> {
    // 1. Check if academy code already exists (if provided)
    if (dto.academyCode) {
      const existing = await this.academyRepository.findByCode(dto.academyCode);
      if (existing) throw new ConflictError("Academy code already exists");
    }

    // 2. Check if manager email already exists
    const existingUser = await this.userRepository.findByEmail(
      dto.manager.email,
    );
    if (existingUser)
      throw new ConflictError("Manager email already registered");

    // 3. Create the manager user (franchiseId is attached once the
    // franchise below exists)
    const passwordHash = await bcrypt.hash(dto.manager.password, 12);
    const managerUser = await this.userRepository.create({
      email: dto.manager.email.toLowerCase(),
      passwordHash,
      role: "manager" as UserRole,
      firstName: dto.manager.firstName,
      lastName: dto.manager.lastName,
      phone: dto.manager.phone,
      isActive: true,
      isEmailVerified: false,
      permissions: {
        canManageUsers: true,
        canManageFranchises: true,
        canManageSessions: true,
        canManageFinance: true,
        canViewReports: true,
        canManageAttendance: true,
        canManagePerformance: true,
        canManageSelection: true,
        canSendNotifications: true,
      },
      fcmTokens: [],
    });

    // 4. Generate unique academy code if not provided
    let academyCode = dto.academyCode;
    if (!academyCode) {
      academyCode = await this.generateUniqueCode(dto.name);
    }

    // 5. Create academy with currency, country, and subscription parameters
    if (dto.sessionTypes && dto.sessionTypes.length > 6) {
      throw new BadRequestError("An academy can have a maximum of 6 session types (representing 6 core performance skills)");
    }
    const currency = (dto.currency || "INR").toUpperCase();
    const country = (dto.country || geoLocationService.getCountryForCurrency(currency)).toUpperCase();

    const planMode = dto.subscriptionPlan?.mode ?? (dto.isTrial ? "trial" : "trial");
    const isTrial = planMode === "trial";
    const trialDays = dto.trialDays ?? 14;
    const trialCapacity = dto.subscriptionPlan?.studentCapacity ?? dto.trialCapacity ?? 50;
    const trialStaffCapacity = dto.subscriptionPlan?.staffCapacity ?? dto.trialStaffCapacity ?? 5;
    const trialStartsAt = isTrial ? new Date() : undefined;
    const trialEndsAt = isTrial ? new Date(Date.now() + trialDays * 24 * 60 * 60 * 1000) : undefined;

    const academy = await this.academyRepository.create({
      name: dto.name,
      academyCode,
      managerId: managerUser.id,
      location: dto.location,
      logo: dto.logo,
      ageGroups: dto.ageGroups,
      maxStudents: 0,
      isActive: true,
      alertBeforeMinutes: dto.alertBeforeMinutes,
      notificationAlertAfterMinutes: dto.notificationAlertAfterMinutes,
      absentAlertDays: dto.absentAlertDays,
      dueDateAlertDays: dto.dueDateAlertDays,
      skillParameters: dto.skillParameters,
      currency,
      country,
      isTrial,
      trialDays,
      trialStartsAt,
      trialEndsAt,
      trialCapacity,
      trialStaffCapacity,
    });

    const platformSettings = await PlatformSettingsModel.findOne().lean();
    const customRate = platformSettings?.currencyPricing?.find(c => c.currency.toUpperCase() === currency);
    const ratePerStudentPerDay = customRate?.ratePerStudentPerDay ?? (SUPPORTED_CURRENCY_MAP[currency]?.defaultRatePerStudentPerDay ?? 1);
    const staffRatePerStaffPerMonth = customRate?.staffRatePerStaffPerMonth ?? (SUPPORTED_CURRENCY_MAP[currency]?.defaultStaffRatePerStaffPerMonth ?? 10);

    // 5a. If trial mode is selected, provision an active trial subscription
    if (isTrial && trialEndsAt) {
      await AcademySubscriptionModel.findOneAndUpdate(
        { academyId: academy.id },
        {
          academyId: academy.id,
          billingInterval: "month",
          currency,
          isTrial: true,
          trialEndsAt,
          ratePerStudentPerDay,
          staffRatePerStaffPerMonth,
          provisionedCapacity: trialCapacity,
          provisionedStaffCapacity: trialStaffCapacity,
          status: "trialing",
          currentPeriodEnd: trialEndsAt,
        },
        { upsert: true, new: true }
      );
    } else if (planMode === "paid_manual" && dto.subscriptionPlan) {
      // 5b. If super admin marks subscription as paid upfront (offline / manual)
      const sub = dto.subscriptionPlan;
      const interval = sub.billingInterval || "month";
      const intervalDaysMap: Record<string, number> = { month: 30, quarter: 90, half_year: 180, year: 365 };
      const intervalStaffMonthsMap: Record<string, number> = { month: 1, quarter: 3, half_year: 6, year: 12 };
      const durationDays = sub.durationDays ?? intervalDaysMap[interval] ?? 30;
      const staffMonths = intervalStaffMonthsMap[interval] ?? 1;

      const calcAmount =
        ratePerStudentPerDay * (sub.studentCapacity || 50) * durationDays +
        staffRatePerStaffPerMonth * (sub.staffCapacity || 5) * staffMonths;
      const amountPaid = sub.amountPaid !== undefined && sub.amountPaid !== null ? sub.amountPaid : calcAmount;

      const { rate: exchangeRateToInr, amountInInr } = await exchangeRateService.convertToInr(amountPaid, currency);

      const now = new Date();
      const currentPeriodEnd = new Date(now.getTime() + durationDays * 24 * 60 * 60 * 1000);
      const paymentRef = `OFFLINE-${(sub.paymentMethod || "MANUAL").toUpperCase()}-${Date.now()}`;

      await AcademySubscriptionModel.findOneAndUpdate(
        { academyId: academy.id },
        {
          academyId: academy.id,
          billingInterval: interval,
          currency,
          isTrial: false,
          ratePerStudentPerDay,
          staffRatePerStaffPerMonth,
          provisionedCapacity: sub.studentCapacity || 50,
          provisionedStaffCapacity: sub.staffCapacity || 5,
          status: "active",
          currentPeriodEnd,
          payments: [
            {
              orderId: `MANUAL-${Date.now()}`,
              paymentId: paymentRef,
              amount: amountPaid,
              currency,
              exchangeRateToInr,
              amountInInr,
              status: "paid",
              billingInterval: interval,
              studentCapacity: sub.studentCapacity || 50,
              staffCapacity: sub.staffCapacity || 5,
              type: "subscription",
              paidAt: now,
              receiptNumber: `REC-${Date.now().toString().slice(-6)}`,
              paymentMethod: sub.paymentMethod || "bank_transfer",
              notes: sub.referenceNote?.trim() ? sub.referenceNote.trim() : undefined,
            },
          ],
        },
        { upsert: true, new: true }
      );
    }

    // 6. Auto-create a single default franchise under this academy. Every
    // academy needs at least one operational franchise for students, teams,
    // sessions, fees etc. to be scoped into — managers and coaches work
    // within a franchise, not the academy record directly.
    const franchiseCode = await this.generateUniqueFranchiseCode(dto.name);
    const defaultFranchise = await FranchiseModel.create({
      academyId: academy.id,
      name: dto.name,
      franchiseCode,
      managerId: managerUser.id,
      location: dto.location,
      ageGroups: dto.ageGroups,
      isActive: true,
      alertBeforeMinutes: dto.alertBeforeMinutes,
      notificationAlertAfterMinutes: dto.notificationAlertAfterMinutes,
      skillParameters: dto.skillParameters,
    });

    // 7. Associate the manager user with the academy, keeping franchiseId undefined so they are treated as an Academy Owner (Head Office).
    await this.userRepository.update(managerUser.id, { academyId: academy.id } as Partial<UserEntity>);

    return {
      ...academy,
      defaultFranchise: toFranchiseEntity(defaultFranchise),
    };
  }

  async getAcademyById(id: string): Promise<AcademyEntity> {
    const academy = await this.academyRepository.findById(id);
    if (!academy) throw new NotFoundError("Academy");
    return academy;
  }

  async getAllAcademies(
    filters: { isActive?: boolean; search?: string },
    page: number = 1,
    limit: number = 20,
  ): Promise<{
    data: AcademyEntity[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }> {
    return this.academyRepository.findAll(filters, { page, limit });
  }

  async updateAcademy(
    id: string,
    dto: UpdateAcademyDto,
  ): Promise<AcademyEntity> {
    const academy = await this.academyRepository.findById(id);
    if (!academy) throw new NotFoundError("Academy");

    // If location updates are partial, merge with existing

    let locationUpdate: Location | undefined;
    if (dto.location) {
      locationUpdate = {
        ...academy.location,
        ...dto.location,
      };
    }

    const { ...safeDto } = dto as any;
    delete safeDto.skillParameters;
    const updated = await this.academyRepository.update(id, {
      ...safeDto,
      location: locationUpdate,
    });
    if (!updated) throw new NotFoundError("Academy");
    return updated;
  }

  async updateAcademyConfig(
    id: string,
    dto: AcademyConfigDto,
    requester?: { sub?: string; role: string; franchiseId?: string; academyId?: string },
  ): Promise<AcademyEntity> {
    const academy = await this.academyRepository.findById(id);
    if (!academy) throw new NotFoundError("Academy");

    if (dto.sessionTypes && dto.sessionTypes.length > 6) {
      throw new BadRequestError("An academy can have a maximum of 6 session types (representing 6 core performance skills)");
    }

    // A manager may only edit the academy their own franchise belongs to.
    // super_admin is unrestricted. This is what makes the settings tab —
    // name, location, age categories, guardian alert-day thresholds, and
    // feeQrImageUrl — genuinely editable by the manager of the academy,
    // without opening up isActive, maxStudents, or the session-reminder
    // minute fields, which stay super_admin-only.
    // Skill parameters are permanently established at academy creation.
    //
    // Whitelisting here (rather than blacklisting isActive) means a
    // future field added to AcademyConfigSchema doesn't silently become
    // manager-editable too.
    // Location is a required embedded document — replacing it wholesale
    // with whatever partial object the client sent would risk wiping
    // fields the manager didn't touch. Merge onto what's already stored
    // instead, so a partial edit (e.g. just the address) never corrupts
    // the rest.
    const mergedLocation = dto.location ? { ...academy.location, ...dto.location } : undefined;

    let effectiveDto: any = {};
    if (requester && requester.role === "manager") {
      const isOwner =
        (requester.academyId && requester.academyId === id) ||
        (academy.manager?.id === requester.sub) ||
        (academy.managerId === requester.sub);
      
      let isFranchiseManager = false;
      if (requester.franchiseId) {
        const franchise = await FranchiseModel.findById(requester.franchiseId).select("academyId").lean();
        if (franchise && franchise.academyId.toString() === id) {
          isFranchiseManager = true;
        }
      }

      if (!isOwner && !isFranchiseManager) {
        throw new ForbiddenError("You can only configure your own academy");
      }

      if (dto.name !== undefined) effectiveDto.name = dto.name;
      if (mergedLocation !== undefined) effectiveDto.location = mergedLocation;
      if (dto.pitches !== undefined) effectiveDto.pitches = dto.pitches;
      if (dto.ageGroups !== undefined) effectiveDto.ageGroups = dto.ageGroups;
      if (dto.absentAlertDays !== undefined) effectiveDto.absentAlertDays = dto.absentAlertDays;
      if (dto.dueDateAlertDays !== undefined) effectiveDto.dueDateAlertDays = dto.dueDateAlertDays;
      if (dto.feeQrImageUrl !== undefined) {
        effectiveDto.feeQrImageUrl = dto.feeQrImageUrl ? ensureWhatsAppCompatibleImageUrl(dto.feeQrImageUrl) : dto.feeQrImageUrl;
      }
      if (dto.feePaymentMethod !== undefined) effectiveDto.feePaymentMethod = dto.feePaymentMethod;
      if (dto.bankDetails !== undefined) effectiveDto.bankDetails = dto.bankDetails;
      if (dto.logo !== undefined) effectiveDto.logo = dto.logo;
      if (dto.sessionTypes !== undefined) effectiveDto.sessionTypes = dto.sessionTypes;
      if (dto.dataProtectionContactEmail !== undefined) effectiveDto.dataProtectionContactEmail = dto.dataProtectionContactEmail;
    } else {
      effectiveDto = { ...dto };
      delete effectiveDto.skillParameters;
      if (effectiveDto.feeQrImageUrl) {
        effectiveDto.feeQrImageUrl = ensureWhatsAppCompatibleImageUrl(effectiveDto.feeQrImageUrl);
      }
      if (mergedLocation !== undefined) effectiveDto.location = mergedLocation;
    }

    const updated = await this.academyRepository.update(id, effectiveDto);
    if (!updated) throw new NotFoundError("Academy");

    // If dueDateAlertDays was updated, immediately check upcoming installments so newly eligible ones get alerted
    if (dto.dueDateAlertDays !== undefined) {
      schedulerService.checkAndSendDueSoonFeeAlerts().catch((err) => {
        logger.error("[AcademyUseCases] Triggering fee alert check after dueDateAlertDays update failed:", err);
      });
    }

    return updated;
  }

  async toggleAcademyStatus(id: string): Promise<AcademyEntity> {
    const academy = await this.academyRepository.findById(id);
    if (!academy) throw new NotFoundError("Academy");

    const newIsActive = !academy.isActive;
    const updated = await this.academyRepository.update(id, {
      isActive: newIsActive,
    });
    if (!updated) throw new NotFoundError("Academy");

    // Keep all franchises under this academy in sync with the academy's active status
    await FranchiseModel.updateMany({ academyId: id }, { isActive: newIsActive });

    return updated;
  }

  async toggleTransferWall(id: string): Promise<AcademyEntity> {
    const academy = await this.academyRepository.findById(id);
    if (!academy) throw new NotFoundError("Academy");

    const updated = await this.academyRepository.update(id, {
      transferWallEnabled: !academy.transferWallEnabled,
    });
    if (!updated) throw new NotFoundError("Academy");
    return updated;
  }

  async deleteAcademy(id: string): Promise<void> {
    const academy = await this.academyRepository.findById(id);
    if (!academy) throw new NotFoundError("Academy");

    const deleted = await this.academyRepository.softDelete(id);
    if (!deleted) throw new BadRequestError("Could not delete academy");

    await FranchiseModel.updateMany({ academyId: id }, { isActive: false, deletedAt: new Date() });
  }

  async updateTrial(academyId: string, dto: UpdateTrialDto): Promise<AcademyEntity> {
    const academy = await this.academyRepository.findById(academyId);
    if (!academy) throw new NotFoundError("Academy");

    const now = new Date();
    let isTrial = academy.isTrial ?? false;
    let trialStartsAt = academy.trialStartsAt ? new Date(academy.trialStartsAt) : now;
    let trialEndsAt = academy.trialEndsAt ? new Date(academy.trialEndsAt) : undefined;
    let trialCapacity = dto.trialCapacity ?? (academy.trialCapacity || 50);
    let trialStaffCapacity = dto.trialStaffCapacity ?? (academy.trialStaffCapacity ?? 5);
    let trialDays = dto.trialDays ?? (academy.trialDays || 14);

    if (dto.endTrial) {
      isTrial = true;
      trialEndsAt = new Date(Date.now() - 1000); // Set to past to immediately expire
    } else if (dto.extendDays && dto.extendDays > 0) {
      isTrial = true;
      const baseDate = trialEndsAt && trialEndsAt > now ? trialEndsAt : now;
      trialEndsAt = new Date(baseDate.getTime() + dto.extendDays * 24 * 60 * 60 * 1000);
      trialDays = Math.ceil((trialEndsAt.getTime() - trialStartsAt.getTime()) / (24 * 60 * 60 * 1000));
    } else if (dto.isTrial) {
      isTrial = true;
      trialStartsAt = now;
      trialEndsAt = new Date(now.getTime() + trialDays * 24 * 60 * 60 * 1000);
    } else if (dto.isTrial === false) {
      isTrial = false;
    }

    const updatedAcademy = await this.academyRepository.update(academyId, {
      isTrial,
      trialDays,
      trialStartsAt,
      trialEndsAt,
      trialCapacity,
      trialStaffCapacity,
    });

    const isTrialActive = Boolean(isTrial && trialEndsAt && now <= trialEndsAt);
    const isTrialExpired = Boolean(isTrial && trialEndsAt && now > trialEndsAt);

    const subscription = await AcademySubscriptionModel.findOne({ academyId });
    if (subscription) {
      subscription.isTrial = isTrial;
      subscription.trialEndsAt = trialEndsAt;
      if (isTrialActive) {
        subscription.status = "trialing";
        subscription.currentPeriodEnd = trialEndsAt;
        subscription.provisionedCapacity = trialCapacity;
        subscription.provisionedStaffCapacity = trialStaffCapacity;
      } else if (isTrialExpired) {
        subscription.status = "trial_expired";
      }
      await subscription.save();
    } else if (isTrial && trialEndsAt) {
      const currency = (academy.currency || "INR").toUpperCase();
      await AcademySubscriptionModel.create({
        academyId,
        billingInterval: "month",
        currency,
        isTrial,
        trialEndsAt,
        ratePerStudentPerDay: 1,
        staffRatePerStaffPerMonth: 10,
        provisionedCapacity: trialCapacity,
        provisionedStaffCapacity: trialStaffCapacity,
        status: isTrialActive ? "trialing" : "trial_expired",
        currentPeriodEnd: trialEndsAt,
      });
    }

    return updatedAcademy || academy;
  }

  private async generateUniqueFranchiseCode(baseName: string): Promise<string> {
    const prefix = baseName
      .substring(0, 3)
      .toUpperCase()
      .replace(/[^A-Z]/g, "");
    const random = Math.floor(1000 + Math.random() * 9000);
    let code = `${prefix}-F-${random}`;
    let exists = await FranchiseModel.findOne({ franchiseCode: code });
    let counter = 1;
    while (exists) {
      code = `${prefix}-F-${random}${counter}`;
      exists = await FranchiseModel.findOne({ franchiseCode: code });
      counter++;
    }
    return code;
  }

  private async generateUniqueCode(baseName: string): Promise<string> {
    const prefix = baseName
      .substring(0, 3)
      .toUpperCase()
      .replace(/[^A-Z]/g, "");
    const random = Math.floor(1000 + Math.random() * 9000);
    let code = `${prefix}${random}`;
    let exists = await this.academyRepository.findByCode(code);
    let counter = 1;
    while (exists) {
      code = `${prefix}${random}${counter}`;
      exists = await this.academyRepository.findByCode(code);
      counter++;
    }
    return code;
  }
}
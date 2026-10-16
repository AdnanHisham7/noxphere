// src/scripts/seedDemoData.ts
import "dotenv/config";
import dns from "dns";
dns.setServers(["8.8.8.8", "8.8.4.4", "1.1.1.1"]);
import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import { v4 as uuidv4 } from "uuid";
import fs from "fs";
import path from "path";

import { config } from "../config/app.config";
import { defaultPermissions } from "../domain/entities/User.entity";
import { UserModel } from "../infrastructure/database/models/User.model";
import { AcademyModel } from "../infrastructure/database/models/Academy.model";
import { AcademySubscriptionModel } from "../infrastructure/database/models/AcademySubscription.model";
import { FranchiseModel } from "../infrastructure/database/models/Franchise.model";
import { TeamModel } from "../infrastructure/database/models/Team.model";
import { StudentModel } from "../infrastructure/database/models/Student.model";
import { EmployeeRoleModel } from "../infrastructure/database/models/EmployeeRole.model";
import { EmployeeModel } from "../infrastructure/database/models/Employee.model";
import { SalaryPaymentModel } from "../infrastructure/database/models/SalaryPayment.model";
import { SessionModel } from "../infrastructure/database/models/Session.model";
import { AttendanceModel } from "../infrastructure/database/models/Attendance.model";
import { PerformanceModel } from "../infrastructure/database/models/Performance.model";
import { CoachRemarkModel } from "../infrastructure/database/models/CoachRemark.model";
import { FeeModel } from "../infrastructure/database/models/Fee.model";
import { ExpenseModel } from "../infrastructure/database/models/Expense.model";
import { IncomeModel } from "../infrastructure/database/models/Income.model";
import { StockItemModel } from "../infrastructure/database/models/StockItem.model";
import { ResourceModel } from "../infrastructure/database/models/Resource.model";
import { PlatformSettingsModel } from "../infrastructure/database/models/PlatformSettings.model";
import { PlatformTicketModel } from "../infrastructure/database/models/PlatformTicket.model";
import { ComplaintModel } from "../infrastructure/database/models/Complaint.model";
import { NfcCardRequestModel } from "../infrastructure/database/models/NfcCardRequest.model";
import { SquadInvitationModel } from "../infrastructure/database/models/SquadInvitation.model";
import { ConsentRecordModel } from "../infrastructure/database/models/ConsentRecord.model";
import { TransferListingModel } from "../infrastructure/database/models/TransferListing.model";
import { TransferRequestModel } from "../infrastructure/database/models/TransferRequest.model";
import { FranchiseTransferLogModel } from "../infrastructure/database/models/FranchiseTransferLog.model";
import { NotificationModel } from "../infrastructure/database/models/Notification.model";
import { UserNotificationModel } from "../infrastructure/database/models/UserNotification.model";
import { RegistrationRequestModel } from "../infrastructure/database/models/RegistrationRequest.model";
import { cleanDatabase } from "./cleanDatabase";

interface ImageOverrides {
  academy?: { logo?: string; feeQrImageUrl?: string };
  teams?: Array<{ name: string; logoUrl?: string; bannerUrl?: string }>;
  students?: Array<{ name: string; photo?: string; medicalReportUrl?: string }>;
  users?: Array<{ email: string; avatar?: string }>;
  resources?: Array<{ fileName: string; fileUrl: string; mimeType: string; publicId: string }>;
}

function loadImageOverrides(): ImageOverrides | null {
  const filePath = path.join(__dirname, "seedImages.json");
  if (fs.existsSync(filePath)) {
    try {
      const data = JSON.parse(fs.readFileSync(filePath, "utf-8"));
      console.log("📸 Loaded saved image overrides from seedImages.json");
      return data;
    } catch {
      return null;
    }
  }
  return null;
}

export async function seedDemoData() {
  const shouldClean = process.argv.includes("--clean") || process.env.CLEAN_DB === "true";
  if (shouldClean) {
    await cleanDatabase();
  } else {
    await mongoose.connect(config.db.uri);
    console.log(`Connected to database: ${mongoose.connection.name}`);
  }

  const overrides = loadImageOverrides();
  const password = "Demo@123";
  const passwordHash = await bcrypt.hash(password, 12);
  const now = new Date();

  console.log("🌱 [1/17] Seeding Platform Settings & Super Admin...");
  await PlatformSettingsModel.findOneAndUpdate(
    {},
    {
      defaultRatePerStudentPerDay: 2,
      defaultStaffRatePerStaffPerMonth: 50,
      defaultNfcCardPrice: 299,
      defaultNfcCustomCardPrice: 399,
      transferWallEnabled: true,
      defaultTrialDays: 14,
      defaultTrialCapacity: 50,
      defaultTrialStaffCapacity: 5,
      currencyPricing: [
        { currency: "INR", ratePerStudentPerDay: 2, staffRatePerStaffPerMonth: 50, symbol: "₹", countryCode: "IN", countryName: "India", isActive: true },
        { currency: "USD", ratePerStudentPerDay: 0.05, staffRatePerStaffPerMonth: 1.5, symbol: "$", countryCode: "US", countryName: "United States", isActive: true },
        { currency: "EUR", ratePerStudentPerDay: 0.045, staffRatePerStaffPerMonth: 1.4, symbol: "€", countryCode: "EU", countryName: "European Union", isActive: true },
        { currency: "GBP", ratePerStudentPerDay: 0.04, staffRatePerStaffPerMonth: 1.2, symbol: "£", countryCode: "GB", countryName: "United Kingdom", isActive: true },
        { currency: "AED", ratePerStudentPerDay: 0.18, staffRatePerStaffPerMonth: 5.5, symbol: "د.إ", countryCode: "AE", countryName: "United Arab Emirates", isActive: true },
      ],
      playerAiPromptTemplate: "Analyze player development metrics and suggest tailored positional drills based on match rating.",
    },
    { upsert: true, new: true }
  );

  const superAdminEmail = "noxwing.official@gmail.com";
  let superAdmin = await UserModel.findOne({ email: superAdminEmail });
  if (!superAdmin) {
    superAdmin = await UserModel.create({
      email: superAdminEmail,
      passwordHash,
      role: "super_admin",
      firstName: "Super",
      lastName: "Admin",
      phone: "+919999999999",
      isActive: true,
      isEmailVerified: true,
      permissions: defaultPermissions.super_admin,
      fcmTokens: [],
    });
  }

  console.log("🌱 [2/17] Seeding Academy Manager & Staff Users...");
  const managerEmail = "noxphere.official@gmail.com";
  let manager = await UserModel.findOne({ email: managerEmail });
  if (!manager) {
    manager = await UserModel.create({
      email: managerEmail,
      passwordHash,
      role: "manager",
      firstName: "Zinedine",
      lastName: "Zidane",
      phone: "+919876543210",
      isActive: true,
      isEmailVerified: true,
      permissions: defaultPermissions.manager,
      fcmTokens: [],
    });
  }

  console.log("🌱 [3/17] Seeding Academy & Full Subscription...");
  const academyLogo = overrides?.academy?.logo || undefined;
  const academyFeeQr = overrides?.academy?.feeQrImageUrl || undefined;

  let academy = await AcademyModel.findOne({ academyCode: "GEFA" });
  if (!academy) {
    academy = await AcademyModel.create({
      name: "Galácticos Elite Football Academy",
      academyCode: "GEFA",
      managerId: manager._id as mongoose.Types.ObjectId,
      location: {
        name: "Apex Sports Arena & Complex",
        address: "74 Champions Boulevard, Elite Sports Enclave",
        latitude: 12.9716,
        longitude: 77.5946,
        fieldNumber: "Main Campus Complex",
      },
      pitches: [
        {
          id: "pitch-stadium-1",
          name: "Santiago Bernabéu Match Pitch (11s)",
          fieldNumber: "Field A",
          surfaceType: "Natural Hybrid Grass",
          address: "North Gate, Apex Arena Complex",
          googleMapsUrl: "https://maps.google.com/?q=12.9718,77.5948",
          latitude: 12.9718,
          longitude: 77.5948,
          isActive: true,
        },
        {
          id: "pitch-synthetic-2",
          name: "Di Stéfano Synthetic Arena (11s)",
          fieldNumber: "Field B",
          surfaceType: "FIFA Quality Pro 4G Turf",
          address: "Central Wing, Apex Arena Complex",
          googleMapsUrl: "https://maps.google.com/?q=12.9714,77.5944",
          latitude: 12.9714,
          longitude: 77.5944,
          isActive: true,
        },
        {
          id: "pitch-cage-3",
          name: "La Fábrica Training Cage (7s)",
          fieldNumber: "Field C",
          surfaceType: "Indoor Rubber Infill Turf",
          address: "Academy Gym Annex, Apex Arena",
          googleMapsUrl: "https://maps.google.com/?q=12.9712,77.5942",
          latitude: 12.9712,
          longitude: 77.5942,
          isActive: true,
        },
      ],
      ageGroups: ["U13", "U15", "U17", "U19"],
      maxStudents: 250,
      currency: "INR",
      country: "IN",
      isActive: true,
      transferWallEnabled: true,
      alertBeforeMinutes: 60,
      notificationAlertAfterMinutes: 15,
      absentAlertDays: 3,
      dueDateAlertDays: 5,
      feePaymentMethod: "both",
      logo: academyLogo,
      feeQrImageUrl: academyFeeQr,
      bankDetails: {
        beneficiaryName: "Galácticos Elite Football Academy Pvt Ltd",
        accountNumber: "98760012345678",
        ifscCode: "HDFC0001234",
        bankName: "HDFC Bank",
        branchName: "Sports City Corporate Branch",
        upiId: "galacticos.academy@okaxis",
        swiftCode: "HDFCINBB",
      },
      skillParameters: ["Dribbling", "Passing", "Shooting", "Speed", "Tactical Awareness", "Attitude"],
      isTrial: false,
    });
  }

  // Update manager's academyId
  await UserModel.findByIdAndUpdate(manager._id, { academyId: academy._id });

  // 1-Year Full Paid Enterprise Subscription
  const oneYearFromNow = new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000);
  await AcademySubscriptionModel.findOneAndUpdate(
    { academyId: academy._id },
    {
      academyId: academy._id,
      billingInterval: "year",
      currency: "INR",
      isTrial: false,
      ratePerStudentPerDay: 2,
      staffRatePerStaffPerMonth: 50,
      provisionedCapacity: 250,
      provisionedStaffCapacity: 25,
      status: "active",
      currentPeriodEnd: oneYearFromNow,
      payments: [
        {
          orderId: "order_saas_annual_2026",
          paymentId: "pay_saas_annual_success_8932",
          amount: 197500, // (250 * 2 * 365) + (25 * 50 * 12)
          currency: "INR",
          status: "paid",
          billingInterval: "year",
          studentCapacity: 250,
          staffCapacity: 25,
          type: "subscription",
          paidAt: new Date(now.getTime() - 15 * 24 * 60 * 60 * 1000),
          receiptNumber: "RCP-GEFA-2026-SAAS-01",
          paymentMethod: "Razorpay Corporate Net Banking",
          notes: "Annual Enterprise Tier - 250 Student Slots & 25 Staff Tier Paid in Full",
        },
      ],
    },
    { upsert: true, new: true }
  );

  console.log("🌱 [4/17] Seeding Franchises...");
  let franchiseDowntown = await FranchiseModel.findOne({ franchiseCode: "GEFA-DT" });
  if (!franchiseDowntown) {
    franchiseDowntown = await FranchiseModel.create({
      academyId: academy._id as mongoose.Types.ObjectId,
      name: "Galácticos Downtown Arena",
      franchiseCode: "GEFA-DT",
      managerId: manager._id as mongoose.Types.ObjectId,
      location: {
        name: "Downtown Sports Arena",
        address: "Plot 12, Stadium Road, Downtown Central",
        latitude: 12.9716,
        longitude: 77.5946,
        fieldNumber: "1",
      },
      sessionTimes: [
        { dayOfWeek: 1, startTime: "06:30", endTime: "08:30" }, // Mon morning
        { dayOfWeek: 3, startTime: "16:30", endTime: "18:30" }, // Wed evening
        { dayOfWeek: 5, startTime: "16:30", endTime: "18:30" }, // Fri evening
        { dayOfWeek: 6, startTime: "07:30", endTime: "10:30" }, // Sat matchday
      ],
      ageGroups: ["U13", "U15", "U17"],
      skillLevels: ["Beginner", "Intermediate", "Advanced", "Elite"],
      maxStudents: 150,
      isActive: true,
      alertBeforeMinutes: 60,
      notificationAlertAfterMinutes: 15,
      skillParameters: ["Dribbling", "Passing", "Shooting", "Speed", "Tactical Awareness", "Attitude"],
    });
  }

  let franchiseNorthCoast = await FranchiseModel.findOne({ franchiseCode: "GEFA-NC" });
  if (!franchiseNorthCoast) {
    franchiseNorthCoast = await FranchiseModel.create({
      academyId: academy._id as mongoose.Types.ObjectId,
      name: "Galácticos North Coast Campus",
      franchiseCode: "GEFA-NC",
      managerId: manager._id as mongoose.Types.ObjectId,
      location: {
        name: "North Coast Sports Village",
        address: "45 Ocean Boulevard, North Wing Coastal Enclave",
        latitude: 13.0827,
        longitude: 80.2707,
        fieldNumber: "NC-P1",
      },
      sessionTimes: [
        { dayOfWeek: 2, startTime: "06:30", endTime: "08:30" }, // Tue morning
        { dayOfWeek: 4, startTime: "16:30", endTime: "18:30" }, // Thu evening
        { dayOfWeek: 6, startTime: "16:00", endTime: "19:00" }, // Sat evening
        { dayOfWeek: 0, startTime: "07:30", endTime: "10:30" }, // Sun matchday
      ],
      ageGroups: ["U15", "U19"],
      skillLevels: ["Intermediate", "Advanced", "Elite"],
      maxStudents: 100,
      isActive: true,
      alertBeforeMinutes: 60,
      notificationAlertAfterMinutes: 15,
      skillParameters: ["Dribbling", "Passing", "Shooting", "Speed", "Tactical Awareness", "Attitude"],
    });
  }

  console.log("🌱 [5/17] Seeding Elite Coaches & Operational Managers...");
  async function createOrGetUser(dto: {
    email: string;
    firstName: string;
    lastName: string;
    phone: string;
    role: "coach" | "operational_manager" | "employee";
    franchiseId?: mongoose.Types.ObjectId;
    avatar?: string;
  }) {
    let user = await UserModel.findOne({ email: dto.email });
    if (!user) {
      user = await UserModel.create({
        email: dto.email,
        passwordHash,
        role: dto.role,
        firstName: dto.firstName,
        lastName: dto.lastName,
        phone: dto.phone,
        avatar: dto.avatar,
        isActive: true,
        isEmailVerified: true,
        permissions: defaultPermissions[dto.role],
        academyId: academy._id as mongoose.Types.ObjectId,
        franchiseId: dto.franchiseId,
        fcmTokens: [],
      });
    }
    return user;
  }

  const coachPep = await createOrGetUser({
    email: "coach.pep@galacticos.com",
    firstName: "Pep",
    lastName: "Guardiola",
    phone: "+919800000001",
    role: "coach",
    franchiseId: franchiseDowntown._id as mongoose.Types.ObjectId,
  });

  const coachMourinho = await createOrGetUser({
    email: "coach.mourinho@galacticos.com",
    firstName: "Jose",
    lastName: "Mourinho",
    phone: "+919800000002",
    role: "coach",
    franchiseId: franchiseDowntown._id as mongoose.Types.ObjectId,
  });

  const coachKlopp = await createOrGetUser({
    email: "coach.klopp@galacticos.com",
    firstName: "Jurgen",
    lastName: "Klopp",
    phone: "+919800000003",
    role: "coach",
    franchiseId: franchiseNorthCoast._id as mongoose.Types.ObjectId,
  });

  const coachAncelotti = await createOrGetUser({
    email: "coach.ancelotti@galacticos.com",
    firstName: "Carlo",
    lastName: "Ancelotti",
    phone: "+919800000004",
    role: "coach",
    franchiseId: franchiseNorthCoast._id as mongoose.Types.ObjectId,
  });

  const opsManager = await createOrGetUser({
    email: "ops.alonso@galacticos.com",
    firstName: "Xabi",
    lastName: "Alonso",
    phone: "+919800000005",
    role: "operational_manager",
    franchiseId: franchiseDowntown._id as mongoose.Types.ObjectId,
  });

  console.log("🌱 [6/17] Seeding Employee Roles, Staff & Payroll...");
  const rolePhysio = await EmployeeRoleModel.findOneAndUpdate(
    { academyId: academy._id, name: "Chief Sports Science & Physio" },
    {
      academyId: academy._id,
      name: "Chief Sports Science & Physio",
      permissions: ["canViewReports", "canManageAttendance"],
    },
    { upsert: true, new: true }
  );

  const roleScout = await EmployeeRoleModel.findOneAndUpdate(
    { academyId: academy._id, name: "Head Talent Scout" },
    {
      academyId: academy._id,
      name: "Head Talent Scout",
      permissions: ["canManageSelection", "canViewReports"],
    },
    { upsert: true, new: true }
  );

  const roleKit = await EmployeeRoleModel.findOneAndUpdate(
    { academyId: academy._id, name: "Groundskeeper & Kit Master" },
    {
      academyId: academy._id,
      name: "Groundskeeper & Kit Master",
      permissions: ["canManageSessions", "canManageFinance"],
    },
    { upsert: true, new: true }
  );

  const staffEvaUser = await createOrGetUser({
    email: "physio.eva@galacticos.com",
    firstName: "Eva",
    lastName: "Carneiro",
    phone: "+919811110001",
    role: "employee",
    franchiseId: franchiseDowntown._id as mongoose.Types.ObjectId,
  });

  const staffMonchiUser = await createOrGetUser({
    email: "scout.monchi@galacticos.com",
    firstName: "Ramon",
    lastName: "Monchi",
    phone: "+919811110002",
    role: "employee",
    franchiseId: franchiseDowntown._id as mongoose.Types.ObjectId,
  });

  const empPhysio = await EmployeeModel.findOneAndUpdate(
    { email: "physio.eva@galacticos.com" },
    {
      academyId: academy._id,
      firstName: "Eva",
      lastName: "Carneiro",
      phone: "+919811110001",
      email: "physio.eva@galacticos.com",
      designation: "Chief Physiotherapist",
      employeeType: "staff",
      userId: staffEvaUser._id,
      roleId: rolePhysio._id,
      salaryAmount: 85000,
      joinDate: new Date("2025-06-01"),
      isActive: true,
      notes: "Lead medical expert overseeing injury prevention, rehabilitation, and sports nutrition protocols.",
    },
    { upsert: true, new: true }
  );

  const empScout = await EmployeeModel.findOneAndUpdate(
    { email: "scout.monchi@galacticos.com" },
    {
      academyId: academy._id,
      firstName: "Ramon",
      lastName: "Monchi",
      phone: "+919811110002",
      email: "scout.monchi@galacticos.com",
      designation: "Head Talent Scout",
      employeeType: "staff",
      userId: staffMonchiUser._id,
      roleId: roleScout._id,
      salaryAmount: 95000,
      joinDate: new Date("2025-07-15"),
      isActive: true,
      notes: "Directs talent scouting and recruitment networks across youth leagues.",
    },
    { upsert: true, new: true }
  );

  const empGroundskeeper = await EmployeeModel.findOneAndUpdate(
    { email: "grounds.albert@galacticos.com" },
    {
      academyId: academy._id,
      firstName: "Albert",
      lastName: "Capellas",
      phone: "+919811110003",
      email: "grounds.albert@galacticos.com",
      designation: "Pitch & Equipment Master",
      employeeType: "external",
      salaryAmount: 45000,
      joinDate: new Date("2025-05-01"),
      isActive: true,
      notes: "Supervises pitch turf preservation, floodlight upkeep, and equipment storage.",
    },
    { upsert: true, new: true }
  );

  // Coach Employees
  const empPep = await EmployeeModel.findOneAndUpdate(
    { email: "coach.pep@galacticos.com" },
    {
      academyId: academy._id,
      firstName: "Pep",
      lastName: "Guardiola",
      phone: "+919800000001",
      email: "coach.pep@galacticos.com",
      designation: "Head Tactical Coach (U17)",
      employeeType: "staff",
      userId: coachPep._id,
      salaryAmount: 180000,
      joinDate: new Date("2025-06-01"),
      isActive: true,
    },
    { upsert: true, new: true }
  );

  // Past salary payment records
  const periods = ["2026-08", "2026-09", "2026-10"];
  for (const emp of [empPhysio, empScout, empGroundskeeper, empPep]) {
    for (const period of periods) {
      const isCurrentMonth = period === "2026-10";
      await SalaryPaymentModel.findOneAndUpdate(
        { employeeId: emp._id, period },
        {
          employeeId: emp._id,
          academyId: academy._id,
          period,
          amount: emp.salaryAmount,
          status: isCurrentMonth ? "pending" : "paid",
          paidAt: isCurrentMonth ? undefined : new Date(period + "-28"),
          paidBy: isCurrentMonth ? undefined : (manager._id as mongoose.Types.ObjectId),
          notes: `Monthly payroll compensation for ${period}`,
        },
        { upsert: true }
      );
    }
  }

  console.log("🌱 [7/17] Seeding Elite Teams...");
  const teamOverrides = (overrides?.teams || []).reduce((acc, t) => {
    acc[t.name] = t;
    return acc;
  }, {} as Record<string, { logoUrl?: string; bannerUrl?: string }>);

  // Team 1: Galácticos U17 Pro
  let teamU17Pro = await TeamModel.findOne({ name: "Galácticos U17 Pro", franchiseId: franchiseDowntown._id });
  if (!teamU17Pro) {
    teamU17Pro = await TeamModel.create({
      name: "Galácticos U17 Pro",
      ageGroup: "U17",
      teamFormat: "11s",
      franchiseId: franchiseDowntown._id as mongoose.Types.ObjectId,
      academyId: academy._id as mongoose.Types.ObjectId,
      coachId: coachPep._id as mongoose.Types.ObjectId,
      description: "Premier competitive youth division competing in National Youth Development League.",
      primaryColor: "#1E3A8A", // Royal Navy
      secondaryColor: "#F59E0B", // Gold
      logoUrl: teamOverrides["Galácticos U17 Pro"]?.logoUrl,
      bannerUrl: teamOverrides["Galácticos U17 Pro"]?.bannerUrl,
    });
  }

  // Team 2: Galácticos U15 Strikers
  let teamU15Strikers = await TeamModel.findOne({ name: "Galácticos U15 Strikers", franchiseId: franchiseDowntown._id });
  if (!teamU15Strikers) {
    teamU15Strikers = await TeamModel.create({
      name: "Galácticos U15 Strikers",
      ageGroup: "U15",
      teamFormat: "11s",
      franchiseId: franchiseDowntown._id as mongoose.Types.ObjectId,
      academyId: academy._id as mongoose.Types.ObjectId,
      coachId: coachMourinho._id as mongoose.Types.ObjectId,
      description: "Tactical high-intensity U15 squad focused on structured defense and rapid counter-attacks.",
      primaryColor: "#DC2626", // Crimson Red
      secondaryColor: "#111827", // Dark Slate
      logoUrl: teamOverrides["Galácticos U15 Strikers"]?.logoUrl,
      bannerUrl: teamOverrides["Galácticos U15 Strikers"]?.bannerUrl,
    });
  }

  // Team 3: Galácticos U13 Rising Stars
  let teamU13Stars = await TeamModel.findOne({ name: "Galácticos U13 Rising Stars", franchiseId: franchiseDowntown._id });
  if (!teamU13Stars) {
    teamU13Stars = await TeamModel.create({
      name: "Galácticos U13 Rising Stars",
      ageGroup: "U13",
      teamFormat: "7s",
      franchiseId: franchiseDowntown._id as mongoose.Types.ObjectId,
      academyId: academy._id as mongoose.Types.ObjectId,
      coachId: coachMourinho._id as mongoose.Types.ObjectId,
      description: "Junior grassroots development squad emphasizing technical ball mastery and spatial creativity.",
      primaryColor: "#047857", // Emerald Green
      secondaryColor: "#F3F4F6", // Pearl White
      logoUrl: teamOverrides["Galácticos U13 Rising Stars"]?.logoUrl,
      bannerUrl: teamOverrides["Galácticos U13 Rising Stars"]?.bannerUrl,
    });
  }

  // Team 4: North Coast U19 Thunder
  let teamU19Thunder = await TeamModel.findOne({ name: "North Coast U19 Thunder", franchiseId: franchiseNorthCoast._id });
  if (!teamU19Thunder) {
    teamU19Thunder = await TeamModel.create({
      name: "North Coast U19 Thunder",
      ageGroup: "U19",
      teamFormat: "11s",
      franchiseId: franchiseNorthCoast._id as mongoose.Types.ObjectId,
      academyId: academy._id as mongoose.Types.ObjectId,
      coachId: coachAncelotti._id as mongoose.Types.ObjectId,
      description: "Senior youth flagship team preparing prospective student athletes for professional trials.",
      primaryColor: "#7C3AED", // Violet
      secondaryColor: "#FBBF24", // Amber
      logoUrl: teamOverrides["North Coast U19 Thunder"]?.logoUrl,
      bannerUrl: teamOverrides["North Coast U19 Thunder"]?.bannerUrl,
    });
  }

  // Team 5: North Coast U15 Raptors
  let teamU15Raptors = await TeamModel.findOne({ name: "North Coast U15 Raptors", franchiseId: franchiseNorthCoast._id });
  if (!teamU15Raptors) {
    teamU15Raptors = await TeamModel.create({
      name: "North Coast U15 Raptors",
      ageGroup: "U15",
      teamFormat: "9s",
      franchiseId: franchiseNorthCoast._id as mongoose.Types.ObjectId,
      academyId: academy._id as mongoose.Types.ObjectId,
      coachId: coachKlopp._id as mongoose.Types.ObjectId,
      description: "Gegenpressing tactical unit specializing in heavy transitional pressing and fluid verticality.",
      primaryColor: "#0284C7", // Sky Blue
      secondaryColor: "#1E293B", // Navy Charcoal
      logoUrl: teamOverrides["North Coast U15 Raptors"]?.logoUrl,
      bannerUrl: teamOverrides["North Coast U15 Raptors"]?.bannerUrl,
    });
  }

  console.log("🌱 [8/17] Seeding Real-World Players & Guardians...");
  const studentOverrides = (overrides?.students || []).reduce((acc, s) => {
    acc[s.name] = s;
    return acc;
  }, {} as Record<string, { photo?: string; medicalReportUrl?: string }>);

  interface RawPlayerData {
    firstName: string;
    lastName: string;
    dob: string;
    ageGroup: "U13" | "U15" | "U17" | "U19";
    position: string;
    positions: string[];
    jerseyNumber: number;
    jerseySize: string;
    team: typeof teamU17Pro;
    franchise: typeof franchiseDowntown;
    coach: typeof coachPep;
    overallRating: number;
    attendancePercentage: number;
    selectionStatus: "selected" | "shortlisted" | "on_hold" | "pending";
    transferStatus: "not_listed" | "listed" | "sold";
    transferPrice?: number;
    guardianName: string;
    guardianEmail: string;
    guardianPhone: string;
    preferredFoot: "Left" | "Right" | "Both";
    bio: string;
    bloodGroup: string;
    allergies: string[];
  }

  const rawPlayers: RawPlayerData[] = [
    // ─── TEAM 1: Galácticos U17 Pro (11s) ──────────────────────────────
    {
      firstName: "Lamine",
      lastName: "Yamal",
      dob: "2007-07-13",
      ageGroup: "U17",
      position: "RW",
      positions: ["RW", "CAM", "LW"],
      jerseyNumber: 19,
      jerseySize: "M",
      team: teamU17Pro,
      franchise: franchiseDowntown,
      coach: coachPep,
      overallRating: 9.8,
      attendancePercentage: 98,
      selectionStatus: "selected",
      transferStatus: "not_listed",
      guardianName: "Mounir Nasraoui",
      guardianEmail: "guardian.yamal@galacticos.demo",
      guardianPhone: "+919870000001",
      preferredFoot: "Left",
      bio: "Generational prodigy renowned for effortless balance, electric acceleration, and surgical curlers from the half-space.",
      bloodGroup: "O+",
      allergies: ["Peanuts"],
    },
    {
      firstName: "Jude",
      lastName: "Bellingham",
      dob: "2007-06-29",
      ageGroup: "U17",
      position: "CAM",
      positions: ["CAM", "CM", "ST"],
      jerseyNumber: 5,
      jerseySize: "L",
      team: teamU17Pro,
      franchise: franchiseDowntown,
      coach: coachPep,
      overallRating: 9.7,
      attendancePercentage: 96,
      selectionStatus: "selected",
      transferStatus: "not_listed",
      guardianName: "Mark Bellingham",
      guardianEmail: "guardian.bellingham@galacticos.demo",
      guardianPhone: "+919870000002",
      preferredFoot: "Right",
      bio: "Commanding box-to-box maestro combining physical dominance, clutch timing in the box, and vocal leadership.",
      bloodGroup: "A+",
      allergies: [],
    },
    {
      firstName: "Warren",
      lastName: "Zaïre-Emery",
      dob: "2006-03-08",
      ageGroup: "U17",
      position: "CM",
      positions: ["CM", "CDM", "RB"],
      jerseyNumber: 33,
      jerseySize: "M",
      team: teamU17Pro,
      franchise: franchiseDowntown,
      coach: coachPep,
      overallRating: 9.2,
      attendancePercentage: 95,
      selectionStatus: "selected",
      transferStatus: "not_listed",
      guardianName: "Franck Zaïre",
      guardianEmail: "guardian.zaire@galacticos.demo",
      guardianPhone: "+919870000003",
      preferredFoot: "Right",
      bio: "Relentless midfield anchor with world-class press resistance, body-feints, and intelligent positional recovery.",
      bloodGroup: "B+",
      allergies: [],
    },
    {
      firstName: "Kobbie",
      lastName: "Mainoo",
      dob: "2006-04-19",
      ageGroup: "U17",
      position: "CDM",
      positions: ["CDM", "CM"],
      jerseyNumber: 37,
      jerseySize: "M",
      team: teamU17Pro,
      franchise: franchiseDowntown,
      coach: coachPep,
      overallRating: 9.3,
      attendancePercentage: 97,
      selectionStatus: "selected",
      transferStatus: "not_listed",
      guardianName: "Felix Mainoo",
      guardianEmail: "guardian.mainoo@galacticos.demo",
      guardianPhone: "+919870000004",
      preferredFoot: "Right",
      bio: "Ice-cold poise under pressure, trademark turn-and-slip passing, and immaculate defensive shielding.",
      bloodGroup: "O+",
      allergies: [],
    },
    {
      firstName: "Alejandro",
      lastName: "Garnacho",
      dob: "2006-07-01",
      ageGroup: "U17",
      position: "LW",
      positions: ["LW", "RW"],
      jerseyNumber: 17,
      jerseySize: "M",
      team: teamU17Pro,
      franchise: franchiseDowntown,
      coach: coachPep,
      overallRating: 9.0,
      attendancePercentage: 94,
      selectionStatus: "selected",
      transferStatus: "not_listed",
      guardianName: "Alex Garnacho",
      guardianEmail: "guardian.garnacho@galacticos.demo",
      guardianPhone: "+919870000005",
      preferredFoot: "Right",
      bio: "Direct, fearless winger with rapid burst of speed, acrobatics, and clinical one-versus-one dribbling.",
      bloodGroup: "A+",
      allergies: [],
    },
    {
      firstName: "Endrick",
      lastName: "Felipe",
      dob: "2006-07-21",
      ageGroup: "U17",
      position: "ST",
      positions: ["ST", "RW"],
      jerseyNumber: 16,
      jerseySize: "M",
      team: teamU17Pro,
      franchise: franchiseDowntown,
      coach: coachPep,
      overallRating: 9.4,
      attendancePercentage: 95,
      selectionStatus: "selected",
      transferStatus: "not_listed",
      guardianName: "Douglas Sousa",
      guardianEmail: "guardian.endrick@galacticos.demo",
      guardianPhone: "+919870000006",
      preferredFoot: "Left",
      bio: "Explosive center-forward boasting thunderous shooting power, aggressive pressing, and aerial fearlessness.",
      bloodGroup: "B+",
      allergies: [],
    },
    {
      firstName: "Pau",
      lastName: "Cubarsí",
      dob: "2007-01-22",
      ageGroup: "U17",
      position: "CB",
      positions: ["CB"],
      jerseyNumber: 2,
      jerseySize: "L",
      team: teamU17Pro,
      franchise: franchiseDowntown,
      coach: coachPep,
      overallRating: 9.5,
      attendancePercentage: 99,
      selectionStatus: "selected",
      transferStatus: "not_listed",
      guardianName: "Pablo Cubarsí Sr",
      guardianEmail: "guardian.cubarsi@galacticos.demo",
      guardianPhone: "+919870000007",
      preferredFoot: "Right",
      bio: "Ball-playing center back with senior-level maturity, pinpoint 40-yard line-breaking passes, and clean slide tackles.",
      bloodGroup: "O+",
      allergies: [],
    },
    {
      firstName: "Leny",
      lastName: "Yoro",
      dob: "2006-11-13",
      ageGroup: "U17",
      position: "CB",
      positions: ["CB"],
      jerseyNumber: 15,
      jerseySize: "L",
      team: teamU17Pro,
      franchise: franchiseDowntown,
      coach: coachPep,
      overallRating: 9.1,
      attendancePercentage: 92,
      selectionStatus: "selected",
      transferStatus: "not_listed",
      guardianName: "Alain Yoro",
      guardianEmail: "guardian.yoro@galacticos.demo",
      guardianPhone: "+919870000008",
      preferredFoot: "Right",
      bio: "Imposing long-striding defender with superb aerial anticipation, speed on the recovery, and crisp distribution.",
      bloodGroup: "AB+",
      allergies: [],
    },
    {
      firstName: "Rico",
      lastName: "Lewis",
      dob: "2006-11-21",
      ageGroup: "U17",
      position: "RB",
      positions: ["RB", "CDM", "LB"],
      jerseyNumber: 82,
      jerseySize: "M",
      team: teamU17Pro,
      franchise: franchiseDowntown,
      coach: coachPep,
      overallRating: 8.9,
      attendancePercentage: 96,
      selectionStatus: "selected",
      transferStatus: "not_listed",
      guardianName: "Rick Lewis",
      guardianEmail: "guardian.lewis@galacticos.demo",
      guardianPhone: "+919870000009",
      preferredFoot: "Right",
      bio: "Tactically hyper-intelligent inverted fullback who naturally tucks inside into central midfield to dictate tempo.",
      bloodGroup: "A-",
      allergies: [],
    },
    {
      firstName: "Alejandro",
      lastName: "Balde",
      dob: "2006-10-18",
      ageGroup: "U17",
      position: "LB",
      positions: ["LB", "LWB"],
      jerseyNumber: 3,
      jerseySize: "M",
      team: teamU17Pro,
      franchise: franchiseDowntown,
      coach: coachPep,
      overallRating: 9.0,
      attendancePercentage: 93,
      selectionStatus: "selected",
      transferStatus: "not_listed",
      guardianName: "Alassane Balde",
      guardianEmail: "guardian.balde@galacticos.demo",
      guardianPhone: "+919870000010",
      preferredFoot: "Left",
      bio: "Lightning-fast attacking fullback capable of burning down the wing and delivering whipping low crosses.",
      bloodGroup: "O+",
      allergies: [],
    },
    {
      firstName: "Guillaume",
      lastName: "Restes",
      dob: "2006-03-11",
      ageGroup: "U17",
      position: "GK",
      positions: ["GK"],
      jerseyNumber: 1,
      jerseySize: "L",
      team: teamU17Pro,
      franchise: franchiseDowntown,
      coach: coachPep,
      overallRating: 9.1,
      attendancePercentage: 97,
      selectionStatus: "selected",
      transferStatus: "not_listed",
      guardianName: "Luc Restes",
      guardianEmail: "guardian.restes@galacticos.demo",
      guardianPhone: "+919870000011",
      preferredFoot: "Left",
      bio: "Phenomenal reflex shot-stopper with commanding 1-on-1 bravado and sweeping distribution outside the box.",
      bloodGroup: "A+",
      allergies: [],
    },
    // Reserves & Listed Players on U17:
    {
      firstName: "Arda",
      lastName: "Güler",
      dob: "2006-02-25",
      ageGroup: "U17",
      position: "CAM",
      positions: ["CAM", "RW"],
      jerseyNumber: 15,
      jerseySize: "M",
      team: teamU17Pro,
      franchise: franchiseDowntown,
      coach: coachPep,
      overallRating: 9.3,
      attendancePercentage: 91,
      selectionStatus: "selected",
      transferStatus: "not_listed",
      guardianName: "Umit Güler",
      guardianEmail: "guardian.guler@galacticos.demo",
      guardianPhone: "+919870000012",
      preferredFoot: "Left",
      bio: "Silky Turkish playmaker with wand-like vision, disguised reverse through balls, and top-corner finesse.",
      bloodGroup: "B+",
      allergies: [],
    },
    {
      firstName: "Mathys",
      lastName: "Tel",
      dob: "2006-04-27",
      ageGroup: "U17",
      position: "ST",
      positions: ["ST", "LW"],
      jerseyNumber: 39,
      jerseySize: "M",
      team: teamU17Pro,
      franchise: franchiseDowntown,
      coach: coachPep,
      overallRating: 8.8,
      attendancePercentage: 90,
      selectionStatus: "shortlisted",
      transferStatus: "listed",
      transferPrice: 85000,
      guardianName: "Bernard Tel",
      guardianEmail: "guardian.tel@galacticos.demo",
      guardianPhone: "+919870000013",
      preferredFoot: "Right",
      bio: "Devastating transitional attacker with lethal inside-curling shots from the edge of the eighteen-yard box.",
      bloodGroup: "O+",
      allergies: [],
    },
    {
      firstName: "Lucas",
      lastName: "Beraldo",
      dob: "2006-11-24",
      ageGroup: "U17",
      position: "CB",
      positions: ["CB", "LB"],
      jerseyNumber: 35,
      jerseySize: "L",
      team: teamU17Pro,
      franchise: franchiseDowntown,
      coach: coachPep,
      overallRating: 8.7,
      attendancePercentage: 88,
      selectionStatus: "on_hold",
      transferStatus: "listed",
      transferPrice: 75000,
      guardianName: "Andre Beraldo",
      guardianEmail: "guardian.beraldo@galacticos.demo",
      guardianPhone: "+919870000014",
      preferredFoot: "Left",
      bio: "Composed Brazilian defender gifted with calm distribution out of congested high-press situations.",
      bloodGroup: "A+",
      allergies: [],
    },

    // ─── TEAM 2: Galácticos U15 Strikers (11s) ─────────────────────────
    {
      firstName: "Francesco",
      lastName: "Camarda",
      dob: "2008-03-10",
      ageGroup: "U15",
      position: "ST",
      positions: ["ST"],
      jerseyNumber: 9,
      jerseySize: "M",
      team: teamU15Strikers,
      franchise: franchiseDowntown,
      coach: coachMourinho,
      overallRating: 9.6,
      attendancePercentage: 99,
      selectionStatus: "selected",
      transferStatus: "not_listed",
      guardianName: "Manuel Camarda",
      guardianEmail: "guardian.camarda@galacticos.demo",
      guardianPhone: "+919870000015",
      preferredFoot: "Right",
      bio: "Prolific Italian wonderkid goalscoring machine with 500+ academy goals and supreme penalty box instinct.",
      bloodGroup: "O+",
      allergies: [],
    },
    {
      firstName: "Ethan",
      lastName: "Nwaneri",
      dob: "2007-03-21",
      ageGroup: "U15",
      position: "CAM",
      positions: ["CAM", "RW", "CM"],
      jerseyNumber: 10,
      jerseySize: "M",
      team: teamU15Strikers,
      franchise: franchiseDowntown,
      coach: coachMourinho,
      overallRating: 9.4,
      attendancePercentage: 97,
      selectionStatus: "selected",
      transferStatus: "not_listed",
      guardianName: "Obi Nwaneri",
      guardianEmail: "guardian.nwaneri@galacticos.demo",
      guardianPhone: "+919870000016",
      preferredFoot: "Left",
      bio: "Record-setting dynamic attacking midfielder with explosive body feints and venomous top-bin strikes.",
      bloodGroup: "B+",
      allergies: [],
    },
    {
      firstName: "Estêvão",
      lastName: "Willian",
      dob: "2007-04-24",
      ageGroup: "U15",
      position: "RW",
      positions: ["RW", "CAM"],
      jerseyNumber: 41,
      jerseySize: "S",
      team: teamU15Strikers,
      franchise: franchiseDowntown,
      coach: coachMourinho,
      overallRating: 9.5,
      attendancePercentage: 96,
      selectionStatus: "selected",
      transferStatus: "not_listed",
      guardianName: "Ivo Willian",
      guardianEmail: "guardian.messinho@galacticos.demo",
      guardianPhone: "+919870000017",
      preferredFoot: "Left",
      bio: "Nicknamed 'Messinho' for his supernatural glued-to-the-boot close control and devastating solo runs.",
      bloodGroup: "A+",
      allergies: [],
    },
    {
      firstName: "Franco",
      lastName: "Mastantuono",
      dob: "2007-08-14",
      ageGroup: "U15",
      position: "CAM",
      positions: ["CAM", "CM"],
      jerseyNumber: 30,
      jerseySize: "M",
      team: teamU15Strikers,
      franchise: franchiseDowntown,
      coach: coachMourinho,
      overallRating: 9.1,
      attendancePercentage: 94,
      selectionStatus: "selected",
      transferStatus: "not_listed",
      guardianName: "Christian Mastantuono",
      guardianEmail: "guardian.mastantuono@galacticos.demo",
      guardianPhone: "+919870000018",
      preferredFoot: "Left",
      bio: "Argentine playmaker prodigy with dead-ball mastery and uncanny ability to execute defense-splitting lobs.",
      bloodGroup: "O+",
      allergies: [],
    },
    {
      firstName: "Chris",
      lastName: "Rigg",
      dob: "2007-06-18",
      ageGroup: "U15",
      position: "CM",
      positions: ["CM", "CAM"],
      jerseyNumber: 8,
      jerseySize: "M",
      team: teamU15Strikers,
      franchise: franchiseDowntown,
      coach: coachMourinho,
      overallRating: 8.9,
      attendancePercentage: 93,
      selectionStatus: "selected",
      transferStatus: "not_listed",
      guardianName: "Sean Rigg",
      guardianEmail: "guardian.rigg@galacticos.demo",
      guardianPhone: "+919870000019",
      preferredFoot: "Left",
      bio: "Tenacious English box-to-box engine with fiery competitive bite and pinpoint diagonal switches.",
      bloodGroup: "A-",
      allergies: [],
    },
    {
      firstName: "Myles",
      lastName: "Lewis-Skelly",
      dob: "2006-09-26",
      ageGroup: "U15",
      position: "CDM",
      positions: ["CDM", "LB"],
      jerseyNumber: 6,
      jerseySize: "M",
      team: teamU15Strikers,
      franchise: franchiseDowntown,
      coach: coachMourinho,
      overallRating: 9.0,
      attendancePercentage: 95,
      selectionStatus: "selected",
      transferStatus: "not_listed",
      guardianName: "Marcia Lewis",
      guardianEmail: "guardian.lewisskelly@galacticos.demo",
      guardianPhone: "+919870000020",
      preferredFoot: "Left",
      bio: "Dominant midfielder possessing rare agility in congested pivots and assertive physical challenge success rate.",
      bloodGroup: "B+",
      allergies: [],
    },
    {
      firstName: "Luka",
      lastName: "Vušković",
      dob: "2007-02-24",
      ageGroup: "U15",
      position: "CB",
      positions: ["CB"],
      jerseyNumber: 4,
      jerseySize: "L",
      team: teamU15Strikers,
      franchise: franchiseDowntown,
      coach: coachMourinho,
      overallRating: 9.2,
      attendancePercentage: 96,
      selectionStatus: "selected",
      transferStatus: "not_listed",
      guardianName: "Daniel Vušković",
      guardianEmail: "guardian.vuskovic@galacticos.demo",
      guardianPhone: "+919870000021",
      preferredFoot: "Right",
      bio: "Towering 6ft 4in Croatian prodigy who scores thunderous headers and dominates both penalty boxes.",
      bloodGroup: "O+",
      allergies: [],
    },
    {
      firstName: "Jorrel",
      lastName: "Hato",
      dob: "2006-03-07",
      ageGroup: "U15",
      position: "CB",
      positions: ["CB", "LB"],
      jerseyNumber: 3,
      jerseySize: "L",
      team: teamU15Strikers,
      franchise: franchiseDowntown,
      coach: coachMourinho,
      overallRating: 9.1,
      attendancePercentage: 92,
      selectionStatus: "selected",
      transferStatus: "not_listed",
      guardianName: "Rivaldo Hato",
      guardianEmail: "guardian.hato@galacticos.demo",
      guardianPhone: "+919870000022",
      preferredFoot: "Left",
      bio: "Dutch modern defensive phenom with great recovery speed and high defensive work-rate.",
      bloodGroup: "A+",
      allergies: [],
    },
    {
      firstName: "Archie",
      lastName: "Gray",
      dob: "2006-03-12",
      ageGroup: "U15",
      position: "RB",
      positions: ["RB", "CM", "CDM"],
      jerseyNumber: 2,
      jerseySize: "M",
      team: teamU15Strikers,
      franchise: franchiseDowntown,
      coach: coachMourinho,
      overallRating: 9.0,
      attendancePercentage: 94,
      selectionStatus: "selected",
      transferStatus: "not_listed",
      guardianName: "Andy Gray",
      guardianEmail: "guardian.gray@galacticos.demo",
      guardianPhone: "+919870000023",
      preferredFoot: "Right",
      bio: "Dynastic midfield-cum-fullback talent with relentless aerobic endurance and positional reading.",
      bloodGroup: "O+",
      allergies: [],
    },
    {
      firstName: "Max",
      lastName: "Moerstedt",
      dob: "2006-01-15",
      ageGroup: "U15",
      position: "ST",
      positions: ["ST"],
      jerseyNumber: 19,
      jerseySize: "L",
      team: teamU15Strikers,
      franchise: franchiseDowntown,
      coach: coachMourinho,
      overallRating: 8.8,
      attendancePercentage: 91,
      selectionStatus: "selected",
      transferStatus: "not_listed",
      guardianName: "Klaus Moerstedt",
      guardianEmail: "guardian.moerstedt@galacticos.demo",
      guardianPhone: "+919870000024",
      preferredFoot: "Right",
      bio: "Classic German target man with formidable back-to-goal hold-up play and first-time finishing.",
      bloodGroup: "B-",
      allergies: [],
    },
    {
      firstName: "Spike",
      lastName: "Brits",
      dob: "2007-06-24",
      ageGroup: "U15",
      position: "GK",
      positions: ["GK"],
      jerseyNumber: 1,
      jerseySize: "L",
      team: teamU15Strikers,
      franchise: franchiseDowntown,
      coach: coachMourinho,
      overallRating: 8.9,
      attendancePercentage: 96,
      selectionStatus: "selected",
      transferStatus: "not_listed",
      guardianName: "Trevor Brits",
      guardianEmail: "guardian.brits@galacticos.demo",
      guardianPhone: "+919870000025",
      preferredFoot: "Right",
      bio: "High-flying academy shot-stopper with commanding vocal presence on set-piece defense.",
      bloodGroup: "O+",
      allergies: [],
    },
    {
      firstName: "Kendry",
      lastName: "Páez",
      dob: "2007-05-04",
      ageGroup: "U15",
      position: "RW",
      positions: ["RW", "CAM"],
      jerseyNumber: 11,
      jerseySize: "M",
      team: teamU15Strikers,
      franchise: franchiseDowntown,
      coach: coachMourinho,
      overallRating: 9.3,
      attendancePercentage: 89,
      selectionStatus: "selected",
      transferStatus: "listed",
      transferPrice: 120000,
      guardianName: "Ray Páez",
      guardianEmail: "guardian.paez@galacticos.demo",
      guardianPhone: "+919870000026",
      preferredFoot: "Left",
      bio: "Ecuadorian international sensation capable of dazzling trickery and vicious long-range free kicks.",
      bloodGroup: "A+",
      allergies: [],
    },

    // ─── TEAM 3: Galácticos U13 Rising Stars (7s) ──────────────────────
    {
      firstName: "Cavan",
      lastName: "Sullivan",
      dob: "2009-09-28",
      ageGroup: "U13",
      position: "CAM",
      positions: ["CAM", "RW"],
      jerseyNumber: 10,
      jerseySize: "S",
      team: teamU13Stars,
      franchise: franchiseDowntown,
      coach: coachMourinho,
      overallRating: 9.6,
      attendancePercentage: 100,
      selectionStatus: "selected",
      transferStatus: "not_listed",
      guardianName: "Brendan Sullivan",
      guardianEmail: "guardian.sullivan@galacticos.demo",
      guardianPhone: "+919870000027",
      preferredFoot: "Left",
      bio: "The youngest professional signing in North American history; a wizard in tight spaces with telepathic passing.",
      bloodGroup: "O+",
      allergies: [],
    },
    {
      firstName: "Finlay",
      lastName: "Gorman",
      dob: "2008-09-20",
      ageGroup: "U13",
      position: "LW",
      positions: ["LW", "CAM"],
      jerseyNumber: 7,
      jerseySize: "S",
      team: teamU13Stars,
      franchise: franchiseDowntown,
      coach: coachMourinho,
      overallRating: 9.2,
      attendancePercentage: 97,
      selectionStatus: "selected",
      transferStatus: "not_listed",
      guardianName: "Darren Gorman",
      guardianEmail: "guardian.gorman@galacticos.demo",
      guardianPhone: "+919870000028",
      preferredFoot: "Left",
      bio: "Electric dribbler with rapid shoulder drops and extraordinary close-range agility.",
      bloodGroup: "A+",
      allergies: [],
    },
    {
      firstName: "Enzo",
      lastName: "Alves",
      dob: "2009-09-16",
      ageGroup: "U13",
      position: "ST",
      positions: ["ST"],
      jerseyNumber: 9,
      jerseySize: "M",
      team: teamU13Stars,
      franchise: franchiseDowntown,
      coach: coachMourinho,
      overallRating: 9.3,
      attendancePercentage: 98,
      selectionStatus: "selected",
      transferStatus: "not_listed",
      guardianName: "Marcelo Vieira",
      guardianEmail: "guardian.marcelo@galacticos.demo",
      guardianPhone: "+919870000029",
      preferredFoot: "Right",
      bio: "Son of Real Madrid legend Marcelo; clinical forward with deadly poacher positioning and explosive headers.",
      bloodGroup: "O+",
      allergies: [],
    },
    {
      firstName: "Kai",
      lastName: "Rooney",
      dob: "2009-11-02",
      ageGroup: "U13",
      position: "CF",
      positions: ["CF", "LW"],
      jerseyNumber: 18,
      jerseySize: "M",
      team: teamU13Stars,
      franchise: franchiseDowntown,
      coach: coachMourinho,
      overallRating: 9.1,
      attendancePercentage: 95,
      selectionStatus: "selected",
      transferStatus: "not_listed",
      guardianName: "Wayne Rooney",
      guardianEmail: "guardian.rooney@galacticos.demo",
      guardianPhone: "+919870000030",
      preferredFoot: "Left",
      bio: "Inherited his father's fearless attacking grit, cannon of a shot, and relentless pressing intensity.",
      bloodGroup: "O+",
      allergies: [],
    },
    {
      firstName: "Cristiano",
      lastName: "Ronaldo Jr",
      dob: "2010-06-17",
      ageGroup: "U13",
      position: "LW",
      positions: ["LW", "ST", "RW"],
      jerseyNumber: 7,
      jerseySize: "M",
      team: teamU13Stars,
      franchise: franchiseDowntown,
      coach: coachMourinho,
      overallRating: 9.4,
      attendancePercentage: 99,
      selectionStatus: "selected",
      transferStatus: "not_listed",
      guardianName: "Cristiano Ronaldo",
      guardianEmail: "guardian.cr7@galacticos.demo",
      guardianPhone: "+919870000031",
      preferredFoot: "Right",
      bio: "Meticulous work-ethic, blistering sprint speed, trademark knuckleball technique, and clinical finishing.",
      bloodGroup: "A+",
      allergies: [],
    },
    {
      firstName: "Thiago",
      lastName: "Messi",
      dob: "2012-11-02",
      ageGroup: "U13",
      position: "RW",
      positions: ["RW", "CAM"],
      jerseyNumber: 10,
      jerseySize: "S",
      team: teamU13Stars,
      franchise: franchiseDowntown,
      coach: coachMourinho,
      overallRating: 9.2,
      attendancePercentage: 96,
      selectionStatus: "selected",
      transferStatus: "not_listed",
      guardianName: "Lionel Messi",
      guardianEmail: "guardian.messi@galacticos.demo",
      guardianPhone: "+919870000032",
      preferredFoot: "Right",
      bio: "Visionary playmaker with a deft first touch, spatial intelligence, and unselfish link-up capabilities.",
      bloodGroup: "O+",
      allergies: [],
    },
    {
      firstName: "Benjamin",
      lastName: "Aguero",
      dob: "2009-02-19",
      ageGroup: "U13",
      position: "ST",
      positions: ["ST", "CAM"],
      jerseyNumber: 19,
      jerseySize: "M",
      team: teamU13Stars,
      franchise: franchiseDowntown,
      coach: coachMourinho,
      overallRating: 8.9,
      attendancePercentage: 92,
      selectionStatus: "selected",
      transferStatus: "not_listed",
      guardianName: "Sergio Aguero",
      guardianEmail: "guardian.aguero@galacticos.demo",
      guardianPhone: "+919870000033",
      preferredFoot: "Right",
      bio: "Grandson of Maradona and son of Aguero; gifted with low-center-of-gravity turning and lethal shooting.",
      bloodGroup: "B+",
      allergies: [],
    },
    {
      firstName: "Mateo",
      lastName: "Messi",
      dob: "2015-09-11",
      ageGroup: "U13",
      position: "CAM",
      positions: ["CAM", "LW"],
      jerseyNumber: 8,
      jerseySize: "XS",
      team: teamU13Stars,
      franchise: franchiseDowntown,
      coach: coachMourinho,
      overallRating: 9.3,
      attendancePercentage: 98,
      selectionStatus: "selected",
      transferStatus: "not_listed",
      guardianName: "Lionel Messi",
      guardianEmail: "guardian.messi@galacticos.demo",
      guardianPhone: "+919870000032",
      preferredFoot: "Right",
      bio: "Unpredictable dribbler with lightning body swerves, audacious chip shots, and pure joyful flair on the pitch.",
      bloodGroup: "O+",
      allergies: [],
    },
    {
      firstName: "Ciro",
      lastName: "Messi",
      dob: "2018-03-10",
      ageGroup: "U13",
      position: "GK",
      positions: ["GK"],
      jerseyNumber: 1,
      jerseySize: "XS",
      team: teamU13Stars,
      franchise: franchiseDowntown,
      coach: coachMourinho,
      overallRating: 8.7,
      attendancePercentage: 95,
      selectionStatus: "selected",
      transferStatus: "not_listed",
      guardianName: "Lionel Messi",
      guardianEmail: "guardian.messi@galacticos.demo",
      guardianPhone: "+919870000032",
      preferredFoot: "Right",
      bio: "Brave grassroots goalkeeper developing fast instincts, strong parries, and enthusiastic shot prevention.",
      bloodGroup: "O+",
      allergies: [],
    },

    // ─── TEAM 4: North Coast U19 Thunder (11s) ─────────────────────────
    {
      firstName: "Kylian",
      lastName: "Mbappé",
      dob: "2005-12-20",
      ageGroup: "U19",
      position: "ST",
      positions: ["ST", "LW"],
      jerseyNumber: 9,
      jerseySize: "L",
      team: teamU19Thunder,
      franchise: franchiseNorthCoast,
      coach: coachAncelotti,
      overallRating: 9.9,
      attendancePercentage: 99,
      selectionStatus: "selected",
      transferStatus: "not_listed",
      guardianName: "Wilfried Mbappé",
      guardianEmail: "guardian.mbappe@galacticos.demo",
      guardianPhone: "+919870000034",
      preferredFoot: "Right",
      bio: "Unstoppable world-class speed merchant with devastating bursts into open channel space and merciless finishing.",
      bloodGroup: "O+",
      allergies: [],
    },
    {
      firstName: "Vinicius",
      lastName: "Junior",
      dob: "2005-07-12",
      ageGroup: "U19",
      position: "LW",
      positions: ["LW"],
      jerseyNumber: 7,
      jerseySize: "M",
      team: teamU19Thunder,
      franchise: franchiseNorthCoast,
      coach: coachAncelotti,
      overallRating: 9.8,
      attendancePercentage: 97,
      selectionStatus: "selected",
      transferStatus: "not_listed",
      guardianName: "Vinicius Paixão",
      guardianEmail: "guardian.vini@galacticos.demo",
      guardianPhone: "+919870000035",
      preferredFoot: "Right",
      bio: "Electrifying Brazilian winger with world-beating elastico step-overs, explosive acceleration, and outside-boot trivela assists.",
      bloodGroup: "A+",
      allergies: [],
    },
    {
      firstName: "Eduardo",
      lastName: "Camavinga",
      dob: "2005-11-10",
      ageGroup: "U19",
      position: "CDM",
      positions: ["CDM", "CM", "LB"],
      jerseyNumber: 12,
      jerseySize: "M",
      team: teamU19Thunder,
      franchise: franchiseNorthCoast,
      coach: coachAncelotti,
      overallRating: 9.5,
      attendancePercentage: 96,
      selectionStatus: "selected",
      transferStatus: "not_listed",
      guardianName: "Celestino Camavinga",
      guardianEmail: "guardian.camavinga@galacticos.demo",
      guardianPhone: "+919870000036",
      preferredFoot: "Left",
      bio: "Chameleonic athletic dynamo capable of playing central pivot, box-to-box engine, or flying inverted fullback with equal elegance.",
      bloodGroup: "B+",
      allergies: [],
    },
  ];

  const createdStudents: any[] = [];
  const createdGuardiansMap = new Map<string, any>();

  for (const p of rawPlayers) {
    const studentEmail = `${p.firstName.toLowerCase()}.${p.lastName.toLowerCase().replace(/[^a-z]/g, "")}@galacticos.demo`;
    let studentUser = await UserModel.findOne({ email: studentEmail });
    if (!studentUser) {
      studentUser = await UserModel.create({
        email: studentEmail,
        passwordHash,
        role: "student",
        firstName: p.firstName,
        lastName: p.lastName,
        phone: p.guardianPhone,
        isActive: true,
        isEmailVerified: true,
        permissions: defaultPermissions.student,
        academyId: academy._id as mongoose.Types.ObjectId,
        franchiseId: p.franchise._id as mongoose.Types.ObjectId,
        fcmTokens: [],
      });
    }

    // Guardian User
    let guardianUser = createdGuardiansMap.get(p.guardianEmail);
    if (!guardianUser) {
      guardianUser = await UserModel.findOne({ email: p.guardianEmail });
      if (!guardianUser) {
        const [gFirst, ...gLast] = p.guardianName.split(" ");
        guardianUser = await UserModel.create({
          email: p.guardianEmail,
          passwordHash,
          role: "guardian",
          firstName: gFirst || p.guardianName,
          lastName: gLast.join(" ") || "Guardian",
          phone: p.guardianPhone,
          isActive: true,
          isEmailVerified: true,
          permissions: defaultPermissions.guardian,
          academyId: academy._id as mongoose.Types.ObjectId,
          franchiseId: p.franchise._id as mongoose.Types.ObjectId,
          fcmTokens: [],
        });
      }
      createdGuardiansMap.set(p.guardianEmail, guardianUser);
    }

    const fullName = `${p.firstName} ${p.lastName}`;
    const photoUrl = studentOverrides[fullName]?.photo || undefined;
    const medReportUrl = studentOverrides[fullName]?.medicalReportUrl || undefined;

    let studentDoc = await StudentModel.findOne({ userId: studentUser._id });
    if (!studentDoc) {
      studentDoc = await StudentModel.create({
        userId: studentUser._id as mongoose.Types.ObjectId,
        franchiseId: p.franchise._id as mongoose.Types.ObjectId,
        teamId: p.team._id as mongoose.Types.ObjectId,
        coachId: p.coach._id as mongoose.Types.ObjectId,
        guardianIds: [guardianUser._id as mongoose.Types.ObjectId],
        guardian: {
          name: p.guardianName,
          phone: p.guardianPhone,
          email: p.guardianEmail,
        },
        firstName: p.firstName,
        lastName: p.lastName,
        dateOfBirth: new Date(p.dob),
        ageGroup: p.ageGroup,
        jerseyNumber: p.jerseyNumber,
        jerseySize: p.jerseySize,
        position: p.position,
        positions: p.positions,
        photo: photoUrl,
        medicalInfo: {
          bloodGroup: p.bloodGroup,
          allergies: p.allergies,
          medicalConditions: [],
          emergencyContactName: p.guardianName,
          emergencyContactPhone: p.guardianPhone,
          medicalReportUrl: medReportUrl,
        },
        enrollmentDate: new Date(now.getTime() - 120 * 24 * 60 * 60 * 1000), // Enrolled 4 months ago
        isActive: true,
        status: "active",
        attendancePercentage: p.attendancePercentage,
        overallRating: p.overallRating,
        selectionStatus: p.selectionStatus,
        selectionPhase: "Final National Squad",
        selectionFeedback: "Elite technical comprehension and outstanding athletic output.",
        transferStatus: p.transferStatus,
        transferPrice: p.transferPrice,
        transferListedAt: p.transferStatus === "listed" ? new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000) : undefined,
        transferNote: p.transferStatus === "listed" ? "Available for youth contract loan or academy development transfer." : undefined,
        publicProfileToken: uuidv4(),
        publicProfileEnabled: true,
        publicProfileSettings: {
          showPhoto: true,
          showPosition: true,
          showJerseyNumber: true,
          showAgeGroup: true,
          showRating: true,
          showTeam: true,
          bio: p.bio,
          preferredFoot: p.preferredFoot,
        },
      });
    }

    // Base DPDP Consent
    await ConsentRecordModel.findOneAndUpdate(
      { studentId: studentDoc._id, guardianId: guardianUser._id, consentType: "enrollment" },
      {
        studentId: studentDoc._id,
        guardianId: guardianUser._id,
        academyId: academy._id,
        consentType: "enrollment",
        noticeVersion: "1.0",
        dataCategories: ["identity", "biometric", "performance", "medical", "contact"],
        purposes: ["academy_training", "sports_science", "emergency_medical"],
        grantedAt: new Date(now.getTime() - 120 * 24 * 60 * 60 * 1000),
        grantedIp: "103.21.244.2",
        grantedUserAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_4)",
      },
      { upsert: true }
    );

    // Public Profile Consent
    await ConsentRecordModel.findOneAndUpdate(
      { studentId: studentDoc._id, guardianId: guardianUser._id, consentType: "public_profile" },
      {
        studentId: studentDoc._id,
        guardianId: guardianUser._id,
        academyId: academy._id,
        consentType: "public_profile",
        noticeVersion: "1.0",
        dataCategories: ["name", "photo", "position", "jerseyNumber", "stats"],
        purposes: ["public_scouting_profile", "digital_nfc_card"],
        grantedAt: new Date(now.getTime() - 110 * 24 * 60 * 60 * 1000),
        grantedIp: "103.21.244.2",
        grantedUserAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_4)",
      },
      { upsert: true }
    );

    createdStudents.push(studentDoc);
  }

  console.log("🌱 [9/17] Setting Up Squad Formations & Tactics...");
  const u17ProRoster = createdStudents.filter((s) => s.teamId?.toString() === teamU17Pro._id.toString());
  const u17Map: Record<string, string> = {};
  const getPlayerId = (first: string) => u17ProRoster.find((s) => s.firstName === first)?._id.toString() || "";

  u17Map["GK"] = getPlayerId("Guillaume");
  u17Map["LB"] = getPlayerId("Alejandro"); // Balde
  u17Map["CB1"] = getPlayerId("Pau"); // Cubarsi
  u17Map["CB2"] = getPlayerId("Leny"); // Yoro
  u17Map["RB"] = getPlayerId("Rico"); // Lewis
  u17Map["CDM"] = getPlayerId("Kobbie"); // Mainoo
  u17Map["LCM"] = getPlayerId("Warren"); // Zaire-Emery
  u17Map["RCM"] = getPlayerId("Jude"); // Bellingham
  u17Map["LW"] = getPlayerId("Alejandro"); // Garnacho
  u17Map["ST"] = getPlayerId("Endrick");
  u17Map["RW"] = getPlayerId("Lamine"); // Yamal

  await TeamModel.findByIdAndUpdate(teamU17Pro._id, {
    formationPresets: [
      {
        id: "preset-4-3-3",
        label: "Galácticos Attacking 4-3-3 (Tiki-Taka)",
        formationType: "4-3-3",
        teamFormat: "11s",
        squad: u17Map,
      },
      {
        id: "preset-4-2-3-1",
        label: "Compact 4-2-3-1 Fluid Transition",
        formationType: "4-2-3-1",
        teamFormat: "11s",
        squad: u17Map,
      },
    ],
  });

  // U15 Strikers 4-2-3-1 Preset
  const u15ProRoster = createdStudents.filter((s) => s.teamId?.toString() === teamU15Strikers._id.toString());
  const u15Map: Record<string, string> = {};
  const getU15Id = (first: string) => u15ProRoster.find((s) => s.firstName.includes(first))?._id.toString() || "";

  u15Map["GK"] = getU15Id("Spike");
  u15Map["LB"] = getU15Id("Jorrel");
  u15Map["CB1"] = getU15Id("Luka");
  u15Map["CB2"] = getU15Id("Chris");
  u15Map["RB"] = getU15Id("Archie");
  u15Map["LDM"] = getU15Id("Myles");
  u15Map["RDM"] = getU15Id("Franco");
  u15Map["CAM"] = getU15Id("Ethan");
  u15Map["LW"] = getU15Id("Estêvão");
  u15Map["RW"] = getU15Id("Kendry");
  u15Map["ST"] = getU15Id("Francesco");

  await TeamModel.findByIdAndUpdate(teamU15Strikers._id, {
    formationPresets: [
      {
        id: "preset-u15-4231",
        label: "High Pressing 4-2-3-1",
        formationType: "4-2-3-1",
        teamFormat: "11s",
        squad: u15Map,
      },
    ],
  });

  console.log("🌱 [10/17] Seeding Transfer Wall Listings & Active Inquiries...");
  const listedPlayers = createdStudents.filter((s) => s.transferStatus === "listed");
  for (const lp of listedPlayers) {
    const listing = await TransferListingModel.findOneAndUpdate(
      { studentId: lp._id },
      {
        studentId: lp._id,
        fromFranchiseId: lp.franchiseId,
        academyId: academy._id,
        fromManagerId: manager._id,
        price: lp.transferPrice || 75000,
        currency: "INR",
        note: `Scouting report verified by ${academy.name}. Available for mid-season academy transfer.`,
        skills: ["Ball Progression", "Speed", "Dribbling in Tight Spaces", "High Pressing"],
        highlights: ["State Cup Semi-Final Man of the Match", "94% Passing Accuracy under High Block"],
        overallRating: lp.overallRating,
        isPublic: true,
        isActive: true,
        viewCount: 42,
        expiresAt: new Date(now.getTime() + 60 * 24 * 60 * 60 * 1000),
      },
      { upsert: true, new: true }
    );

    // Seed an active transfer inquiry/request for the first listed player
    if (lp.firstName === "Kendry") {
      await TransferRequestModel.findOneAndUpdate(
        { listingId: listing._id },
        {
          listingId: listing._id,
          studentId: lp._id,
          fromFranchiseId: franchiseDowntown._id,
          fromManagerId: manager._id,
          toFranchiseId: franchiseNorthCoast._id,
          toManagerId: manager._id,
          offeredPrice: 115000,
          currency: "INR",
          status: "pending",
          message: "We would like to acquire Kendry Páez on a permanent youth transfer for our U15 National Campaign.",
        },
        { upsert: true }
      );
    }
  }

  console.log("🌱 [11/17] Seeding Training Sessions, Live Attendance & Match Performance...");
  // Create past completed sessions & future upcoming sessions
  const sessionDefs = [
    {
      daysOffset: -14,
      title: "Tactical Shape & High-Press Trigger Clinic",
      type: "training",
      team: teamU17Pro,
      franchise: franchiseDowntown,
      coach: coachPep,
      status: "completed",
    },
    {
      daysOffset: -10,
      title: "Set-Piece Mastery & Dead-Ball Execution",
      type: "training",
      team: teamU17Pro,
      franchise: franchiseDowntown,
      coach: coachPep,
      status: "completed",
    },
    {
      daysOffset: -7,
      title: "Full Match Simulation: U17 Pro vs City Academy",
      type: "match",
      team: teamU17Pro,
      franchise: franchiseDowntown,
      coach: coachPep,
      status: "completed",
    },
    {
      daysOffset: -5,
      title: "U15 Strikers Intensive Counter-Attacking Drills",
      type: "training",
      team: teamU15Strikers,
      franchise: franchiseDowntown,
      coach: coachMourinho,
      status: "completed",
    },
    {
      daysOffset: -2,
      title: "Small-Sided 7s Technical Agility & Finishing",
      type: "training",
      team: teamU13Stars,
      franchise: franchiseDowntown,
      coach: coachMourinho,
      status: "completed",
    },
    // Future / Upcoming:
    {
      daysOffset: 1,
      title: "Championship Prep: Low-Block Defense & Transition",
      type: "training",
      team: teamU17Pro,
      franchise: franchiseDowntown,
      coach: coachPep,
      status: "upcoming",
    },
    {
      daysOffset: 3,
      title: "State Youth League Matchday: Derby Showdown",
      type: "match",
      team: teamU17Pro,
      franchise: franchiseDowntown,
      coach: coachPep,
      status: "upcoming",
    },
    {
      daysOffset: 5,
      title: "Speed, Reaction & Plyometric Performance Assessment",
      type: "training",
      team: teamU15Strikers,
      franchise: franchiseDowntown,
      coach: coachMourinho,
      status: "upcoming",
    },
  ];

  for (const sDef of sessionDefs) {
    const sDate = new Date(now.getTime() + sDef.daysOffset * 24 * 60 * 60 * 1000);
    const dateStr = sDate.toISOString().split("T")[0];

    const sessionDoc = await SessionModel.findOneAndUpdate(
      { teamId: sDef.team._id, date: dateStr, startTime: "16:30" },
      {
        franchiseId: sDef.franchise._id,
        targetType: "team",
        teamId: sDef.team._id,
        category: sDef.team.ageGroup,
        categories: [sDef.team.ageGroup],
        coachId: sDef.coach._id,
        coachIds: [sDef.coach._id],
        type: sDef.type,
        date: dateStr,
        startTime: "16:30",
        endTime: "18:30",
        location: sDef.franchise.location.name,
        pitchId: "pitch-stadium-1",
        fieldNumber: "Pitch 1 (Grand Turf)",
        status: sDef.status,
        notes: `Focus on ${sDef.title}. High energy demanded from all participating players.`,
        createdBy: manager._id,
      },
      { upsert: true, new: true }
    );

    // If completed session, seed real attendance & performance records
    if (sDef.status === "completed") {
      const roster = createdStudents.filter((s) => s.teamId?.toString() === sDef.team._id.toString());
      for (let i = 0; i < roster.length; i++) {
        const student = roster[i];
        const isAbsent = i === roster.length - 1; // Last player absent once for realism
        const isLate = i === roster.length - 2;

        const attStatus = isAbsent ? "absent" : isLate ? "late" : "present";
        await AttendanceModel.findOneAndUpdate(
          { studentId: student._id, sessionId: sessionDoc._id },
          {
            studentId: student._id,
            franchiseId: sDef.franchise._id,
            teamId: sDef.team._id,
            coachId: sDef.coach._id,
            sessionId: sessionDoc._id,
            sessionDate: sDate,
            status: attStatus,
            checkInTime: attStatus !== "absent" ? new Date(sDate.getTime() + (isLate ? 15 : 0) * 60 * 1000) : undefined,
            remarks: isLate ? "Arrived 15 minutes delayed due to school traffic" : attStatus === "absent" ? "Excused mild muscle fatigue" : "On time, excellent warm-up engagement",
            isOfflineEntry: false,
            guardianNotified: true,
            manuallyEdited: false,
          },
          { upsert: true }
        );

        if (attStatus !== "absent") {
          // Performance score for the academy's 6 skill parameters
          const baseScore = student.overallRating || 9.0;
          const jitter = (Math.sin(i * 1.5) * 0.4);
          const score = Math.min(10, Math.max(7, Math.round((baseScore + jitter) * 10) / 10));

          await PerformanceModel.findOneAndUpdate(
            { studentId: student._id, sessionId: sessionDoc._id },
            {
              studentId: student._id,
              franchiseId: sDef.franchise._id,
              teamId: sDef.team._id,
              coachId: sDef.coach._id,
              sessionId: sessionDoc._id,
              sessionDate: sDate,
              overallScore: score,
              skillScores: [
                { parameter: "Dribbling", score: Math.min(10, Math.round((score + 0.2) * 10) / 10) },
                { parameter: "Passing", score: Math.min(10, Math.round((score - 0.1) * 10) / 10) },
                { parameter: "Shooting", score: Math.min(10, Math.round((score + 0.3) * 10) / 10) },
                { parameter: "Speed", score: Math.min(10, Math.round((score) * 10) / 10) },
                { parameter: "Tactical Awareness", score: Math.min(10, Math.round((score - 0.2) * 10) / 10) },
                { parameter: "Attitude", score: 9.8 },
              ],
              remarks: `Demonstrated exceptional match readiness and sharp positional understanding throughout drills.`,
            },
            { upsert: true }
          );

          // Coach remarks
          if (i < 4) {
            await CoachRemarkModel.create({
              studentId: student._id,
              coachId: sDef.coach._id,
              date: sDate,
              text: `Coach ${sDef.coach.firstName}: Outstanding session output. Noticeable growth in decision-making speed during transition phase.`,
            });
          }
        }
      }
    }
  }

  console.log("🌱 [12/17] Seeding Student Tuition & Fee Collections...");
  for (let i = 0; i < createdStudents.length; i++) {
    const student = createdStudents[i];
    const isFullPaid = i % 3 !== 0; // 66% paid in full, 33% installment/pending
    const totalFee = 45000;

    await FeeModel.findOneAndUpdate(
      { studentId: student._id, feeType: "installment" },
      {
        studentId: student._id,
        franchiseId: student.franchiseId,
        feeType: "installment",
        totalAmount: totalFee,
        currency: "INR",
        discount: 0,
        finalAmount: totalFee,
        overallStatus: isFullPaid ? "paid" : "partial",
        installments: [
          {
            installmentNumber: 1,
            amount: 22500,
            dueDate: new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000),
            paidAmount: 22500,
            paidAt: new Date(now.getTime() - 65 * 24 * 60 * 60 * 1000),
            status: "paid",
            transactionId: `TXN_FEE_${student._id.toString().slice(-4)}_INST1`,
            paymentMethod: "UPI",
            reminderSentCount: 0,
          },
          {
            installmentNumber: 2,
            amount: 22500,
            dueDate: new Date(now.getTime() + 15 * 24 * 60 * 60 * 1000),
            paidAmount: isFullPaid ? 22500 : 0,
            paidAt: isFullPaid ? new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000) : undefined,
            status: isFullPaid ? "paid" : "pending",
            transactionId: isFullPaid ? `TXN_FEE_${student._id.toString().slice(-4)}_INST2` : undefined,
            paymentMethod: isFullPaid ? "Bank Transfer" : undefined,
            reminderSentCount: isFullPaid ? 0 : 1,
            lastReminderAt: isFullPaid ? undefined : new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000),
          },
        ],
        notes: "Academic Year 2026-2027 Professional Youth Development Tuition",
        createdBy: manager._id,
        auditLog: [
          {
            action: "Installment Payment Confirmed",
            amount: 22500,
            installmentNumber: 1,
            paymentMethod: "UPI",
            transactionId: `TXN_FEE_${student._id.toString().slice(-4)}_INST1`,
            timestamp: new Date(now.getTime() - 65 * 24 * 60 * 60 * 1000),
            performedBy: manager._id,
            performedByName: "Zinedine Zidane",
            details: "Installment #1 paid via UPI successfully.",
          },
        ],
      },
      { upsert: true }
    );
  }

  console.log("🌱 [13/17] Seeding Financial Incomes, Expenses & Stock Inventory...");
  // Equipment Stock Items
  const stockDefs = [
    { name: "Adidas Pro Match Balls (Size 5)", category: "Balls", unit: "balls", qty: 45, unitPrice: 3200 },
    { name: "Agility Training Cones & Markers", category: "Training Equipment", unit: "sets", qty: 120, unitPrice: 350 },
    { name: "Pro Speed Slalom Hurdle Poles", category: "Agility", unit: "poles", qty: 35, unitPrice: 750 },
    { name: "Reversible High-Vis Training Bibs (Neon Yellow/Pink)", category: "Apparel", unit: "pieces", qty: 80, unitPrice: 420 },
    { name: "Physio First Aid & Cryo Ice Therapy Kits", category: "Medical", unit: "kits", qty: 15, unitPrice: 2800 },
    { name: "Aluminum Portable Mini-Goals (Futsal & Small-Sided)", category: "Goals", unit: "units", qty: 6, unitPrice: 18500 },
  ];

  for (const s of stockDefs) {
    await StockItemModel.findOneAndUpdate(
      { academyId: academy._id, name: s.name },
      {
        academyId: academy._id,
        franchiseId: franchiseDowntown._id,
        name: s.name,
        category: s.category,
        unit: s.unit,
        quantity: s.qty,
        minQuantityAlert: 10,
        unitPrice: s.unitPrice,
        location: "Central Equipment Bunker, Apex Arena",
        status: "in_stock",
        notes: "Official training apparatus for Academy squads.",
        stockLogs: [
          {
            action: "initial",
            quantityChange: s.qty,
            previousQuantity: 0,
            newQuantity: s.qty,
            reason: "Initial academy season stocking",
            performedBy: manager._id,
            performedByName: "Zinedine Zidane",
            date: new Date(now.getTime() - 40 * 24 * 60 * 60 * 1000),
          },
        ],
      },
      { upsert: true }
    );
  }

  // Purchases & Expenses
  const expenses = [
    {
      type: "purchase",
      itemName: "Adidas Pro Match Balls (Size 5)",
      category: "Equipment",
      quantity: 45,
      unitPrice: 3200,
      amount: 144000,
      vendor: "Adidas Official Sports India",
      paymentMethod: "bank_transfer",
      verificationStatus: "verified",
      date: new Date(now.getTime() - 35 * 24 * 60 * 60 * 1000),
    },
    {
      type: "miscellaneous",
      title: "Stadium Pitch LED Floodlight Array Maintenance & Lux Calibration",
      category: "Facility Maintenance",
      amount: 38500,
      vendor: "Apex Arena Facility Management",
      paymentMethod: "bank_transfer",
      miscStatus: "paid",
      date: new Date(now.getTime() - 20 * 24 * 60 * 60 * 1000),
    },
    {
      type: "miscellaneous",
      title: "National Youth Development League Team Registration Fees",
      category: "Tournaments",
      amount: 50000,
      vendor: "All India Football Federation",
      paymentMethod: "bank_transfer",
      miscStatus: "paid",
      date: new Date(now.getTime() - 15 * 24 * 60 * 60 * 1000),
    },
    {
      type: "purchase",
      itemName: "Physio Cryo Compression Sleeves & First Aid Kits",
      category: "Medical Supplies",
      quantity: 15,
      unitPrice: 2800,
      amount: 42000,
      vendor: "MedSports Healthcare Systems",
      paymentMethod: "upi",
      verificationStatus: "verified",
      date: new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000),
    },
  ];

  for (const exp of expenses) {
    const existing = await ExpenseModel.findOne({ academyId: academy._id, amount: exp.amount, category: exp.category });
    if (!existing) {
      await ExpenseModel.create({
        academyId: academy._id,
        franchiseId: franchiseDowntown._id,
        type: exp.type as any,
        itemName: exp.itemName,
        category: exp.category,
        quantity: exp.quantity,
        unitPrice: exp.unitPrice,
        title: exp.title,
        amount: exp.amount,
        vendor: exp.vendor,
        paymentMethod: exp.paymentMethod as any,
        verificationStatus: exp.verificationStatus as any,
        verifiedBy: exp.verificationStatus === "verified" ? manager._id : undefined,
        verifiedByName: exp.verificationStatus === "verified" ? "Zinedine Zidane" : undefined,
        verifiedAt: exp.verificationStatus === "verified" ? exp.date : undefined,
        miscStatus: exp.miscStatus as any,
        date: exp.date,
        createdBy: manager._id,
        createdByName: "Zinedine Zidane",
      });
    }
  }

  // External Incomes
  const incomes = [
    {
      source: "Nike Youth Elite Technical Sponsorship",
      category: "Sponsorship",
      amount: 350000,
      payerName: "Nike India Pvt Ltd",
      referenceNumber: "SPON-NIKE-2026-Q3",
      date: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000),
    },
    {
      source: "Weekend Facility Sub-Leasing (Corporate Cup Tournament)",
      category: "Facility Rental",
      amount: 85000,
      payerName: "Tech Mahindra Sports Club",
      referenceNumber: "RENT-TMSC-OCT",
      date: new Date(now.getTime() - 12 * 24 * 60 * 60 * 1000),
    },
    {
      source: "Academy Merchandise & Match Kit Sales",
      category: "Merchandise",
      amount: 62000,
      payerName: "Academy Fan Shop & Matchday Store",
      referenceNumber: "MERCH-SALES-WK41",
      date: new Date(now.getTime() - 4 * 24 * 60 * 60 * 1000),
    },
  ];

  for (const inc of incomes) {
    await IncomeModel.findOneAndUpdate(
      { academyId: academy._id, source: inc.source },
      {
        academyId: academy._id,
        franchiseId: franchiseDowntown._id,
        source: inc.source,
        category: inc.category,
        amount: inc.amount,
        payerName: inc.payerName,
        referenceNumber: inc.referenceNumber,
        paymentMethod: "bank_transfer",
        date: inc.date,
        createdBy: manager._id,
        createdByName: "Zinedine Zidane",
      },
      { upsert: true }
    );
  }

  console.log("🌱 [14/17] Seeding Smart NFC Card Bulk & Custom Orders...");
  const u17CardsList = createdStudents.slice(0, 11).map((s) => ({
    studentId: s._id as mongoose.Types.ObjectId,
    studentName: `${s.firstName} ${s.lastName}`,
    jerseyNumber: s.jerseyNumber,
    franchiseName: franchiseDowntown.name,
    ageGroup: s.ageGroup,
    publicProfileToken: s.publicProfileToken,
  }));

  await NfcCardRequestModel.findOneAndUpdate(
    { requesterId: manager._id, cardType: "official" },
    {
      requesterId: manager._id,
      requesterRole: "manager",
      requesterType: "academy",
      academyId: academy._id,
      franchiseId: franchiseDowntown._id,
      cardType: "official",
      students: u17CardsList,
      quantity: 11,
      unitPrice: 299,
      totalAmount: 3289,
      currency: "INR",
      shippingAddress: {
        recipientName: "Zinedine Zidane (Academy Director)",
        phone: "+919876543210",
        addressLine1: "74 Champions Boulevard, Elite Sports Enclave",
        city: "Bengaluru",
        state: "Karnataka",
        postalCode: "560001",
        country: "India",
      },
      status: "delivered",
      paidAt: new Date(now.getTime() - 25 * 24 * 60 * 60 * 1000),
      dispatchDetails: {
        courierName: "BlueDart Express",
        trackingNumber: "BD-889912344-IN",
        trackingUrl: "https://www.bluedart.com/tracking/BD-889912344-IN",
        dispatchedAt: new Date(now.getTime() - 22 * 24 * 60 * 60 * 1000),
      },
      deliveredAt: new Date(now.getTime() - 20 * 24 * 60 * 60 * 1000),
    },
    { upsert: true }
  );

  // Custom NFC Card request for Lamine Yamal
  const yamalStudent = createdStudents.find((s) => s.firstName === "Lamine");
  if (yamalStudent) {
    await NfcCardRequestModel.findOneAndUpdate(
      { requesterId: yamalStudent.userId, cardType: "custom" },
      {
        requesterId: yamalStudent.userId,
        requesterRole: "student",
        requesterType: "independent_player",
        academyId: academy._id,
        franchiseId: franchiseDowntown._id,
        cardType: "custom",
        customDesignFileName: "yamal_gold_signature_card.png",
        students: [
          {
            studentId: yamalStudent._id,
            studentName: "Lamine Yamal",
            jerseyNumber: 19,
            franchiseName: franchiseDowntown.name,
            ageGroup: "U17",
            publicProfileToken: yamalStudent.publicProfileToken,
          },
        ],
        quantity: 1,
        unitPrice: 399,
        totalAmount: 399,
        currency: "INR",
        shippingAddress: {
          recipientName: "Mounir Nasraoui",
          phone: "+919870000001",
          addressLine1: "Villa 12, Gold Crest Greens, Stadium View",
          city: "Bengaluru",
          state: "Karnataka",
          postalCode: "560001",
          country: "India",
        },
        status: "dispatched",
        paidAt: new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000),
        dispatchDetails: {
          courierName: "DHL Express",
          trackingNumber: "DHL-99432100-IN",
          trackingUrl: "https://www.dhl.com/tracking/DHL-99432100-IN",
          dispatchedAt: new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000),
        },
      },
      { upsert: true }
    );
  }

  console.log("🌱 [15/17] Seeding Support Tickets, Guardian Complaints & Feedback...");
  await PlatformTicketModel.findOneAndUpdate(
    { ticketNumber: "TICK-GEFA-001" },
    {
      ticketNumber: "TICK-GEFA-001",
      academyId: academy._id,
      academyName: academy.name,
      raisedBy: manager._id,
      raisedByName: "Zinedine Zidane",
      raisedByEmail: manager.email,
      subject: "Request for pitch floodlight lux calibration and AI performance module assistance",
      category: "feature_request",
      priority: "medium",
      description: "We are installing 1200 lux broadcast floodlights for night matches and want to ensure optimal camera tracking for the AI Player Analysis feature.",
      status: "resolved",
      messages: [
        {
          senderId: manager._id,
          senderRole: "manager",
          senderName: "Zinedine Zidane",
          message: "Hello team, we are upgrading Pitch 1 to 1200 lux floodlights. Does the automated video analysis pipeline require high-contrast ball tracking calibration?",
          createdAt: new Date(now.getTime() - 15 * 24 * 60 * 60 * 1000),
        },
        {
          senderId: superAdmin._id,
          senderRole: "super_admin",
          senderName: "Super Admin",
          message: "Greetings Coach Zidane. The AI video tracking is calibrated for any standard lux above 600. Your 1200 lux upgrade will deliver crisp 60fps tracking without any config modifications.",
          createdAt: new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000),
        },
      ],
      resolvedAt: new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000),
      resolvedBy: superAdmin._id,
    },
    { upsert: true }
  );

  // Guardian Complaint
  const yamalGuardian = createdGuardiansMap.get("guardian.yamal@galacticos.demo");
  if (yamalGuardian && yamalStudent) {
    await ComplaintModel.findOneAndUpdate(
      { academyId: academy._id, subject: "Summer hydration breaks during peak afternoon heat" },
      {
        academyId: academy._id,
        raisedBy: yamalGuardian._id,
        raisedByRole: "guardian",
        raisedByName: "Mounir Nasraoui",
        studentId: yamalStudent._id,
        studentName: "Lamine Yamal",
        subject: "Summer hydration breaks during peak afternoon heat",
        message: "Can we ensure mandatory electrolyte fluid intervals every 20 minutes during the heatwave training sessions?",
        status: "resolved",
        forwardedToCoaches: [
          {
            coachId: coachPep._id,
            coachName: "Pep Guardiola",
            forwardedAt: new Date(now.getTime() - 8 * 24 * 60 * 60 * 1000),
            notes: "Please review with Head Physio Eva Carneiro.",
          },
        ],
        coachResponses: [
          {
            coachId: coachPep._id,
            coachName: "Pep Guardiola",
            response: "Confirmed. Physio Eva has implemented refrigerated electrolyte cooling stations at Pitch 1 with 3-minute drink pauses every 18 minutes.",
            respondedAt: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000),
          },
        ],
        response: "Resolved. Mandatory cooling protocols and hydration intervals have been institutionalized across all training schedules.",
        respondedAt: new Date(now.getTime() - 6 * 24 * 60 * 60 * 1000),
        respondedBy: manager._id,
        respondedByName: "Zinedine Zidane",
      },
      { upsert: true }
    );
  }

  console.log("🌱 [16/17] Seeding Broadcast Announcements & User Notifications...");
  await NotificationModel.findOneAndUpdate(
    { franchiseId: franchiseDowntown._id, title: "State Youth Championship Fixtures & Travel Itinerary" },
    {
      franchiseId: franchiseDowntown._id,
      title: "State Youth Championship Fixtures & Travel Itinerary",
      body: "Galácticos U17 and U15 squads will depart via academy team bus on Saturday 06:00 AM from Downtown Arena. Full match kits and passports required.",
      audience: "academy",
      createdBy: manager._id,
      channels: ["push", "in_app"],
      readBy: [manager._id, coachPep._id, coachMourinho._id],
    },
    { upsert: true }
  );

  await NotificationModel.findOneAndUpdate(
    { franchiseId: franchiseDowntown._id, title: "U17 Pro Tactical Briefing & Video Review" },
    {
      franchiseId: franchiseDowntown._id,
      title: "U17 Pro Tactical Briefing & Video Review",
      body: "Coach Pep will host a 45-minute tactical video session in the Media Room analyzing opposing set-piece patterns.",
      audience: "team",
      teamId: teamU17Pro._id,
      createdBy: coachPep._id,
      channels: ["push", "in_app"],
      readBy: [manager._id],
    },
    { upsert: true }
  );

  // Per-user in-app notification feed
  const notifyUsers = [manager, coachPep, coachMourinho];
  for (const u of notifyUsers) {
    await UserNotificationModel.findOneAndUpdate(
      { userId: u._id, title: "Welcome to Galácticos Elite Football Management System" },
      {
        userId: u._id,
        franchiseId: franchiseDowntown._id,
        type: "welcome_alert",
        title: "Welcome to Galácticos Elite Football Management System",
        body: "All squad rosters, match analysis charts, attendance scanners, and pitch schedules are active and synchronized.",
        isRead: false,
        sentVia: ["in_app", "email"],
      },
      { upsert: true }
    );
  }

  console.log("🌱 [17/17] Seeding Prospective Registration Request & Squad Invitations...");
  await RegistrationRequestModel.findOneAndUpdate(
    { academyId: academy._id, "studentDetails.firstName": "Gavi" },
    {
      academyId: academy._id,
      franchiseId: franchiseDowntown._id,
      studentDetails: {
        firstName: "Gavi",
        lastName: "Páez",
        dateOfBirth: new Date("2007-08-05"),
        gender: "Male",
        ageGroup: "U17",
        position: "CM",
        positions: ["CM", "CAM"],
        jerseyNumber: 6,
        jerseySize: "M",
        medicalInfo: {
          bloodGroup: "A+",
          allergies: [],
          medicalConditions: [],
          emergencyContactName: "Pablo Páez Sr",
          emergencyContactPhone: "+919870000099",
        },
      },
      guardianDetails: {
        name: "Pablo Páez Sr",
        phone: "+919870000099",
        email: "guardian.gavi@galacticos.demo",
        relation: "Father",
      },
      status: "pending",
      dpdpConsent: true,
      dpdpConsentAt: new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000),
      dpdpConsentIp: "103.21.244.15",
      dpdpConsentUserAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
    },
    { upsert: true }
  );

  // Squad Invitation
  const yamalObj = createdStudents.find((s) => s.firstName === "Lamine");
  if (yamalObj) {
    await SquadInvitationModel.findOneAndUpdate(
      { studentId: yamalObj._id, teamId: teamU17Pro._id },
      {
        studentId: yamalObj._id,
        academyId: academy._id,
        franchiseId: franchiseDowntown._id,
        teamId: teamU17Pro._id,
        invitedBy: manager._id,
        status: "accepted",
        jerseyNumber: 19,
        position: "RW",
        notes: "Selected for starting XI in National Youth Development League.",
        respondedAt: new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000),
      },
      { upsert: true }
    );
  }

  // Vault Training Resources
  const vaultResources = [
    {
      fileName: "Galacticos_High_Press_Trigger_Masterclass.pdf",
      fileUrl: "https://noxphere.storage/vault/drills/high_press_v2.pdf",
      publicId: "vault_high_press_v2",
      mimeType: "application/pdf",
      fileSizeBytes: 2450000,
    },
    {
      fileName: "Nutrition_Hydration_Microcycle_Guidelines.pdf",
      fileUrl: "https://noxphere.storage/vault/sports_science/nutrition_2026.pdf",
      publicId: "vault_nutrition_2026",
      mimeType: "application/pdf",
      fileSizeBytes: 1850000,
    },
    {
      fileName: "Set_Piece_Routine_Playbook_Corners_FreeKicks.pdf",
      fileUrl: "https://noxphere.storage/vault/tactics/set_piece_playbook.pdf",
      publicId: "vault_set_piece_playbook",
      mimeType: "application/pdf",
      fileSizeBytes: 3200000,
    },
  ];

  for (const res of vaultResources) {
    await ResourceModel.findOneAndUpdate(
      { academyId: academy._id, fileName: res.fileName },
      {
        academyId: academy._id,
        franchiseId: franchiseDowntown._id,
        uploadedBy: manager._id,
        fileName: res.fileName,
        fileUrl: res.fileUrl,
        publicId: res.publicId,
        mimeType: res.mimeType,
        fileSizeBytes: res.fileSizeBytes,
        verified: true,
        verifiedBy: manager._id,
        verifiedAt: new Date(now.getTime() - 20 * 24 * 60 * 60 * 1000),
      },
      { upsert: true }
    );
  }

  console.log("\n=======================================================");
  console.log("🏆 DEMO SEEDING COMPLETED SUCCESSFULLY!");
  console.log("=======================================================");
  console.log("🔑 ACCOUNTS READY FOR IMMEDIATE LOGIN (Password: Demo@123):");
  console.log("-------------------------------------------------------");
  console.log("👑 SUPER ADMIN:");
  console.log("   Email:    noxwing.official@gmail.com");
  console.log("   Password: Demo@123");
  console.log("");
  console.log("⚽ ACADEMY DIRECTOR / MANAGER:");
  console.log("   Email:    noxphere.official@gmail.com");
  console.log("   Password: Demo@123");
  console.log("   Academy:  Galácticos Elite Football Academy (GEFA)");
  console.log("");
  console.log("👔 HEAD COACHES:");
  console.log("   Pep Guardiola:     coach.pep@galacticos.com");
  console.log("   Jose Mourinho:     coach.mourinho@galacticos.com");
  console.log("   Jurgen Klopp:      coach.klopp@galacticos.com");
  console.log("   Carlo Ancelotti:   coach.ancelotti@galacticos.com");
  console.log("   Operational Mgr:   ops.alonso@galacticos.com");
  console.log("");
  console.log("🌟 STAR PLAYERS (Each has an active student & guardian login):");
  console.log("   Lamine Yamal:      lamine.yamal@galacticos.demo");
  console.log("   Jude Bellingham:   jude.bellingham@galacticos.demo");
  console.log("   Francesco Camarda: francesco.camarda@galacticos.demo");
  console.log("   Cavan Sullivan:    cavan.sullivan@galacticos.demo");
  console.log("   Kylian Mbappé:     kylian.mbappe@galacticos.demo");
  console.log("   Endrick Felipe:    endrick.felipe@galacticos.demo");
  console.log("   (36 real-world players created across 5 elite squads)");
  console.log("=======================================================\n");
}

if (require.main === module) {
  seedDemoData()
    .then(async () => {
      await mongoose.disconnect();
      console.log("MongoDB connection closed.");
      process.exit(0);
    })
    .catch(async (err) => {
      console.error("❌ Seeding failed:", err);
      await mongoose.disconnect();
      process.exit(1);
    });
}

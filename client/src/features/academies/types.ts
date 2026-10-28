export interface Location {
  name: string;
  address: string;
  latitude: number;
  longitude: number;
  fieldNumber?: string;
}

export interface AcademySessionType {
  id: string;
  name: string;
  description?: string;
  submetrics: string[];
}

export interface AcademyPitch {
  id: string;
  name: string;
  fieldNumber?: string;
  surfaceType?: string;
  address?: string;
  googleMapsUrl?: string;
  latitude?: number;
  longitude?: number;
  isActive?: boolean;
}

export interface AcademyBankDetails {
  beneficiaryName?: string;
  accountNumber?: string;
  ifscCode?: string;
  bankName?: string;
  branchName?: string;
  upiId?: string;
  swiftCode?: string;
}

export interface Manager {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
}

export interface Academy {
  id: string;
  name: string;
  academyCode: string;
  managerId: string;
  manager?: Manager; // populated from backend
  location: Location;
  pitches?: AcademyPitch[];
  ageGroups: string[];
  maxStudents: number;
  subscriptionRateOverride?: number;
  staffRateOverride?: number;
  dataProtectionContactEmail?: string;
  isActive: boolean;
  transferWallEnabled: boolean;
  alertBeforeMinutes: number;
  notificationAlertAfterMinutes: number;
  absentAlertDays: number;
  dueDateAlertDays: number;
  feeQrImageUrl?: string;
  feePaymentMethod?: "qr" | "bank_transfer" | "both";
  bankDetails?: AcademyBankDetails;
  logo?: string;
  skillParameters: string[];
  sessionTypes?: AcademySessionType[];
  currency?: string;
  country?: string;
  isTrial?: boolean;
  trialDays?: number;
  trialStartsAt?: string;
  trialEndsAt?: string;
  trialCapacity?: number;
  trialStaffCapacity?: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreateAcademyPayload {
  name: string;
  academyCode?: string;
  location: Location;
  logo?: string;
  ageGroups: string[];
  alertBeforeMinutes: number;
  notificationAlertAfterMinutes: number;
  absentAlertDays?: number;
  dueDateAlertDays?: number;
  skillParameters: string[];
  currency?: string;
  country?: string;
  isTrial?: boolean;
  trialDays?: number;
  trialCapacity?: number;
  trialStaffCapacity?: number;
  subscriptionPlan?: {
    mode: "trial" | "paid_manual" | "none";
    studentCapacity?: number;
    staffCapacity?: number;
    billingInterval?: "month" | "quarter" | "half_year" | "year";
    durationDays?: number;
    paymentMethod?: "cash" | "bank_transfer" | "cheque" | "other" | "waived";
    amountPaid?: number;
    referenceNote?: string;
  };
  manager: {
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
    password: string;
  };
}

export interface UpdateTrialPayload {
  isTrial?: boolean;
  trialDays?: number;
  extendDays?: number;
  trialEndsAt?: string;
  trialCapacity?: number;
  trialStaffCapacity?: number;
}

export interface AcademyConfigPayload {
  name?: string;
  location?: Partial<Location>;
  pitches?: AcademyPitch[];
  maxStudents?: number;
  subscriptionRateOverride?: number;
  staffRateOverride?: number;
  dataProtectionContactEmail?: string;
  ageGroups?: string[];
  alertBeforeMinutes?: number;
  notificationAlertAfterMinutes?: number;
  absentAlertDays?: number;
  dueDateAlertDays?: number;
  feeQrImageUrl?: string;
  feePaymentMethod?: "qr" | "bank_transfer" | "both";
  bankDetails?: AcademyBankDetails;
  logo?: string;
  sessionTypes?: AcademySessionType[];
  isActive?: boolean;
}
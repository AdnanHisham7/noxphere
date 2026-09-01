// src/domain/entities/Academy.entity.ts

export interface Location {
  name: string;
  address: string;
  latitude: number;
  longitude: number;
  fieldNumber?: string;
}

export interface AcademyManager {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
}

export interface AcademyEntity {
  id: string;
  name: string;
  academyCode: string;
  manager?: AcademyManager;
  location: Location;
  ageGroups: string[];
  maxStudents: number;
  // Overrides PlatformSettings.defaultRatePerStudentPerDay for this
  // academy's subscription checkout — e.g. a negotiated rate. Unset means
  // "use the platform default".
  subscriptionRateOverride?: number;
  // Per-academy override of PlatformSettings.defaultStaffRatePerStaffPerMonth
  // — same override pattern as subscriptionRateOverride above, for the
  // staff-seat billing line instead of the student one.
  staffRateOverride?: number;
  // Surfaced in the DPDP consent notice as the contact for exercising
  // data-principal rights (access, correction, erasure, grievance) and
  // for consent withdrawal — Rule 3(c) requires a communication link.
  dataProtectionContactEmail?: string;
  isActive: boolean;
  transferWallEnabled: boolean;
  alertBeforeMinutes: number;
  notificationAlertAfterMinutes: number;
  absentAlertDays: number;
  dueDateAlertDays: number;
  feeQrImageUrl?: string;
  skillParameters: string[];
  deletedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateAcademyEntity {
  name: string;
  academyCode: string;
  managerId: string;
  location: Location;
  ageGroups: string[];
  maxStudents: number;
  isActive: boolean;
  alertBeforeMinutes: number;
  notificationAlertAfterMinutes: number;
  absentAlertDays: number;
  dueDateAlertDays: number;
  skillParameters: string[];
}
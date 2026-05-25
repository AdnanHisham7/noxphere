// src/domain/entities/Academy.entity.ts

export interface Location {
  name: string;
  address: string;
  latitude: number;
  longitude: number;
  fieldNumber?: string;
}

export interface AcademyEntity {
  id: string;
  name: string;
  academyCode: string;
  location: Location;
  ageGroups: string[];
  maxStudents: number;
  isActive: boolean;
  alertBeforeMinutes: number;
  notificationAlertAfterMinutes: number;
  skillParameters: string[];
  deletedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateAcademyEntity {
  name: string;
  academyCode: string;
  location: Location;
  ageGroups: string[];
  maxStudents: number;
  isActive: boolean;
  alertBeforeMinutes: number;
  notificationAlertAfterMinutes: number;
  skillParameters: string[];
}
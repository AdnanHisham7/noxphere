// src/scripts/exportSeedData.ts
import "dotenv/config";
import dns from "dns";
dns.setServers(["8.8.8.8", "8.8.4.4", "1.1.1.1"]);
import mongoose from "mongoose";
import fs from "fs";
import path from "path";
import { config } from "../config/app.config";
import { AcademyModel } from "../infrastructure/database/models/Academy.model";
import { TeamModel } from "../infrastructure/database/models/Team.model";
import { StudentModel } from "../infrastructure/database/models/Student.model";
import { UserModel } from "../infrastructure/database/models/User.model";
import { ResourceModel } from "../infrastructure/database/models/Resource.model";

export async function exportSeedImages() {
  console.log("Connecting to MongoDB to export uploaded media & assets...");
  await mongoose.connect(config.db.uri);
  console.log(`Connected to database: ${mongoose.connection.name}`);

  const academy = await AcademyModel.findOne({ deletedAt: { $exists: false } }).lean();
  const teams = await TeamModel.find({ deletedAt: { $exists: false } }).lean();
  const students = await StudentModel.find({ deletedAt: { $exists: false } }).lean();
  const users = await UserModel.find({ deletedAt: { $exists: false } }).lean();
  const resources = await ResourceModel.find({ deletedAt: { $exists: false } }).lean();

  const exportPayload = {
    exportedAt: new Date().toISOString(),
    academy: academy
      ? {
          academyCode: academy.academyCode,
          logo: academy.logo || null,
          feeQrImageUrl: academy.feeQrImageUrl || null,
        }
      : null,
    teams: teams.map((t) => ({
      name: t.name,
      logoUrl: t.logoUrl || null,
      bannerUrl: t.bannerUrl || null,
    })),
    students: students.map((s) => ({
      name: `${s.firstName} ${s.lastName}`,
      photo: s.photo || null,
      medicalReportUrl: s.medicalInfo?.medicalReportUrl || null,
    })),
    users: users
      .filter((u) => u.avatar)
      .map((u) => ({
        email: u.email,
        avatar: u.avatar || null,
      })),
    resources: resources.map((r) => ({
      title: (r as any).title,
      notes: (r as any).notes,
      fileName: r.fileName,
      fileUrl: r.fileUrl,
      mimeType: r.mimeType,
      publicId: r.publicId,
    })),
  };

  const outputPath = path.join(__dirname, "seedImages.json");
  fs.writeFileSync(outputPath, JSON.stringify(exportPayload, null, 2), "utf-8");

  console.log(`✅ Successfully exported media & assets to ${outputPath}`);
  console.log(`   - Academy Logo & QR: ${exportPayload.academy?.logo ? "Yes" : "None"}`);
  console.log(`   - Teams: ${exportPayload.teams.filter((t) => t.logoUrl || t.bannerUrl).length} with images`);
  console.log(`   - Students: ${exportPayload.students.filter((s) => s.photo).length} with photos`);
  console.log(`   - Users: ${exportPayload.users.length} with avatars`);
  console.log(`   - Resources: ${exportPayload.resources.length} files`);
}

if (require.main === module) {
  exportSeedImages()
    .then(async () => {
      await mongoose.disconnect();
      console.log("MongoDB connection closed.");
      process.exit(0);
    })
    .catch(async (err) => {
      console.error("❌ Export failed:", err);
      await mongoose.disconnect();
      process.exit(1);
    });
}

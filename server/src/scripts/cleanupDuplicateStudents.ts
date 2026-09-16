import "dotenv/config";
import mongoose from "mongoose";
import { StudentModel } from "../infrastructure/database/models/Student.model";
import { UserModel } from "../infrastructure/database/models/User.model";
import { config } from "../config/app.config";

async function cleanup() {
  await mongoose.connect(config.db.uri);
  console.log("Connected to MongoDB");

  const students = await StudentModel.find({ deletedAt: { $exists: false } }).sort({ createdAt: 1 });
  console.log(`Analyzing ${students.length} active students...`);

  const seenByEmail = new Map<string, typeof students[0]>();
  const duplicateIdsToRemove: mongoose.Types.ObjectId[] = [];

  for (const student of students) {
    const email = student.guardian?.email?.trim().toLowerCase();
    if (!email) continue;

    if (seenByEmail.has(email)) {
      const original = seenByEmail.get(email)!;
      console.log(
        `Found duplicate student: "${student.firstName} ${student.lastName}" (ID: ${student._id}) sharing email ${email} with original (ID: ${original._id})`
      );
      duplicateIdsToRemove.push(student._id as mongoose.Types.ObjectId);
    } else {
      seenByEmail.set(email, student);
    }
  }

  if (duplicateIdsToRemove.length === 0) {
    console.log("No duplicate student records found.");
  } else {
    console.log(`Found ${duplicateIdsToRemove.length} duplicate student records.`);
    if (process.argv.includes("--fix")) {
      console.log("Removing duplicate student records (--fix flag provided)...");
      const res = await StudentModel.deleteMany({ _id: { $in: duplicateIdsToRemove } });
      console.log(`Removed ${res.deletedCount} duplicate student documents.`);
    } else {
      console.log("Run with --fix to remove duplicate student records.");
    }
  }

  await mongoose.disconnect();
}

cleanup().catch(console.error);

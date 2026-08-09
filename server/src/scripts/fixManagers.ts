import "dotenv/config";
import mongoose from "mongoose";
import { UserModel } from "../infrastructure/database/models/User.model";
import { FranchiseModel } from "../infrastructure/database/models/Franchise.model";
import { config } from "../config/app.config";

async function main() {
  await mongoose.connect(config.db.uri);
  console.log("Connected to MongoDB");

  const managers = await UserModel.find({ role: "manager" });
  console.log(`Found ${managers.length} managers`);

  for (const manager of managers) {
    if (manager.franchiseId && !manager.academyId) {
      const franchise = await FranchiseModel.findById(manager.franchiseId).lean();
      if (franchise) {
        console.log(`Migrating manager: ${manager.email}`);
        console.log(`Setting academyId to: ${franchise.academyId} (from franchise ${franchise.name})`);
        console.log(`Unsetting franchiseId...`);
        
        await UserModel.updateOne(
          { _id: manager._id },
          { 
            $set: { academyId: franchise.academyId },
            $unset: { franchiseId: "" }
          }
        );
      } else {
        console.warn(`Franchise ${manager.franchiseId} not found for manager ${manager.email}`);
      }
    } else {
      console.log(`Manager ${manager.email} already has academyId or doesn't have franchiseId`);
    }
  }

  console.log("Migration complete!");
  await mongoose.disconnect();
}

main().catch(console.error);

// src/scripts/cleanDatabase.ts
import "dotenv/config";
import dns from "dns";
dns.setServers(["8.8.8.8", "8.8.4.4", "1.1.1.1"]);
import mongoose from "mongoose";
import { config } from "../config/app.config";

export async function cleanDatabase() {
  console.log("Connecting to MongoDB for database cleanup...");
  await mongoose.connect(config.db.uri);
  console.log(`Connected to database: ${mongoose.connection.name}`);

  const collections = await mongoose.connection.db!.collections();
  console.log(`Found ${collections.length} collections to clean.`);

  for (const collection of collections) {
    const count = await collection.countDocuments();
    if (count > 0) {
      await collection.deleteMany({});
      console.log(`  🧹 Cleaned collection "${collection.collectionName}" (${count} documents removed)`);
    } else {
      console.log(`  ⚪ Collection "${collection.collectionName}" was already empty`);
    }
  }

  console.log("✅ All collections have been cleanly emptied.");
}

if (require.main === module) {
  cleanDatabase()
    .then(async () => {
      await mongoose.disconnect();
      console.log("MongoDB connection closed.");
      process.exit(0);
    })
    .catch(async (err) => {
      console.error("❌ Cleanup failed:", err);
      await mongoose.disconnect();
      process.exit(1);
    });
}

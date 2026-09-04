import mongoose from "mongoose";
import dotenv from "dotenv";

dotenv.config();

const uri = process.env.MONGODB_URI;
const isProduction = process.env.NODE_ENV === "production";
const dbName =
  process.env.MONGODB_DB_NAME || (isProduction ? "budget_tracker" : "budget_tracker_dev");

async function clearDB() {
  try {
    await mongoose.connect(uri, { dbName });
    console.log(`Clearing database: ${dbName}`);
    const db = mongoose.connection.db;

    const collections = await db.listCollections().toArray();
    for (const col of collections) {
      await db.collection(col.name).deleteMany({});
      console.log(`Cleared: ${col.name}`);
    }

    console.log("✅ All collections cleared successfully");
    await mongoose.disconnect();
  } catch (error) {
    console.error("❌ Error:", error.message);
    process.exit(1);
  }
}

clearDB();

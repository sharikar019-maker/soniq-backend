import dotenv from "dotenv";
import mongoose from "mongoose";
import User from "../src/models/User.js";
dotenv.config();

const seedAdmin = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("DB connected");

    const existing = await User.findOne({ email: process.env.ADMIN_EMAIL });
    if (existing) {
      console.log("Admin already exists, skipping.");
      process.exit(0);
    }

    await User.create({
      name:     process.env.ADMIN_NAME,
      email:    process.env.ADMIN_EMAIL,
      phone:    process.env.ADMIN_PHONE,
      password: process.env.ADMIN_PASSWORD, 
      role:     "admin",
    });

    console.log("✅ Admin created successfully");
    process.exit(0);
  } catch (err) {
    console.error("❌ Seeder failed:", err.message);
    process.exit(1);
  }
};

seedAdmin();
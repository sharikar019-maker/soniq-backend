
import mongoose from "mongoose";
import dotenv from "dotenv";
import User from "../src/models/User.js";
dotenv.config();

const migrate = async () => {
  await mongoose.connect(process.env.MONGO_URI);

  const result = await User.updateMany(
    { status: { $exists: false } },  
    { $set: { status: "active" } }
  );

  console.log(`✅ Updated ${result.modifiedCount} users`);
  process.exit(0);
};

migrate();
import "dotenv/config";
import app from "./app.js";
import connectDB from "./src/config/db.js";


connectDB(); 

const PORT = process.env.PORT || 5000;

const server = app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});


process.on("unhandledRejection", (err) => {
  console.error("UNHANDLED REJECTION:", err.message);
  server.close(() => process.exit(1));
});


process.on("uncaughtException", (err) => {
  console.error("UNCAUGHT EXCEPTION:", err.message);
  process.exit(1);
});
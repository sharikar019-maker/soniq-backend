import express from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import cookieParser from "cookie-parser";
import routes from "./src/routes/index.js";
import errorHandler from "./src/middleware/errorMiddleware.js";

const app = express();


app.use(helmet({ crossOriginResourcePolicy: { policy: "cross-origin" } }));
app.use(cors({ origin: "http://localhost:5173", credentials: true }));


const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: { success: false, message: "Too many requests, please try again after 15 minutes" },
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { success: false, message: "Too many auth attempts, please try again after 15 minutes" },
});

app.use("/api/auth", authLimiter);
app.use("/api", limiter);


app.use(express.json({ limit: "10kb" }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser()); // ✅ moved here — after body parsers


const OBJECT_ID_REGEX = /^[a-f\d]{24}$/i;

const sanitizeValue = (value) => {
  
  if (typeof value === "string" && OBJECT_ID_REGEX.test(value)) return value;

  if (typeof value === "string") {
    return value
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#x27;");
    
  }
  return value; 
};

const sanitizeInput = (obj) => {
  if (!obj || typeof obj !== "object") return;
  for (const key of Object.keys(obj)) {
    if (key.startsWith("$") || key.includes(".")) {
      delete obj[key];
    } else if (typeof obj[key] === "object" && obj[key] !== null) {
      sanitizeInput(obj[key]);
    } else {
      obj[key] = sanitizeValue(obj[key]);
    }
  }
};

app.use((req, res, next) => {
  if (req.body)   sanitizeInput(req.body);
  if (req.params) sanitizeInput(req.params);
  if (req.query)  sanitizeInput(req.query);
  next();
});


app.get("/", (req, res) => res.json({ message: "API is running..." }));
app.use("/api", routes);


app.use((req, res) => res.status(404).json({ success: false, message: "Route not found" }));
app.use(errorHandler);

export default app;
import express from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import routes from "./src/routes/index.js";
import errorHandler from "./src/middleware/errorMiddleware.js";

// ✅ NO imports for xss-clean or express-mongo-sanitize

const app = express();

// ✅ Custom sanitizer — blocks MongoDB injection + XSS
const sanitizeValue = (value) => {
  if (typeof value === "string") {
    return value
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#x27;")
      .replace(/\//g, "&#x2F;");
  }
  return value;
};

const sanitizeInput = (obj) => {
  if (obj && typeof obj === "object") {
    for (const key of Object.keys(obj)) {
      if (key.startsWith("$") || key.includes(".")) {
        delete obj[key];
      } else if (typeof obj[key] === "object") {
        sanitizeInput(obj[key]);
      } else {
        obj[key] = sanitizeValue(obj[key]);
      }
    }
  }
};

app.use(cors({
  origin: (origin, callback) => {
    if (!origin || origin.startsWith("http://localhost")) {
      callback(null, true);
    } else {
      callback(new Error("Not allowed by CORS"));
    }
  },
  credentials: true,
}));

app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" },
}));

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

app.use("/api", limiter);
app.use("/api/auth", authLimiter);

app.use(express.json({ limit: "10kb" }));
app.use(express.urlencoded({ extended: true }));

// ✅ One middleware handles both MongoDB injection + XSS (only touches body/params)
app.use((req, res, next) => {
  if (req.body) sanitizeInput(req.body);
  if (req.params) sanitizeInput(req.params);
  next();
});

app.get("/", (req, res) => {
  res.json({ message: "API is running..." });
});

app.use("/api", routes);

app.use((req, res) => {
  res.status(404).json({ success: false, message: "Route not found" });
});

app.use(errorHandler);

export default app;
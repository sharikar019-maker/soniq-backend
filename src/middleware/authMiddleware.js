
import jwt from "jsonwebtoken";
import User from "../models/User.js";
import AppError from "../utils/AppError.js";

export const protect = async (req, res, next) => {
  try {
    
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith("Bearer "))
      return next(new AppError("Not authorized, no token", 401));

    const token = authHeader.split(" ")[1];

    const decoded = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET);

    
    const user = await User.findById(decoded.id)
      .select("_id name email role")
      .lean();

    if (!user) return next(new AppError("User no longer exists", 401));

    req.user = { ...user, id: user._id.toString() };
    next();
  } catch (error) {
    
    if (error.name === "TokenExpiredError")
      return next(new AppError("Access token expired", 401));

    return next(new AppError("Not authorized, token failed", 401));
  }
};

export const authorizeAdmin = (req, res, next) => {
  if (req.user.role !== "admin")
    return next(new AppError("Access denied, admin only", 403));
  next();
};
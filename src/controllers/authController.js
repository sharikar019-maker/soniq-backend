import jwt from "jsonwebtoken";
import User from "../models/User.js";
import AppError from "../utils/AppError.js";


const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || "7d",
  });
};


const sendTokenResponse = (user, statusCode, res) => {
  const token = generateToken(user._id);
  user.password = undefined;

  res.status(statusCode).json({
    success: true,
    token,
    data: user,
  });
};


export const register = async (req, res, next) => {
  try {
    const { name, email, phone, password } = req.body;

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return next(new AppError("Email already registered", 400));
    }

    const user = await User.create({ name, email, phone, password });
    sendTokenResponse(user, 201, res);
  } catch (error) {
    next(error);
  }
};


export const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return next(new AppError("Please provide email and password", 400));
    }

    const user = await User.findOne({ email }).select("+password");
    if (!user) {
      return next(new AppError("Invalid email or password", 401));
    }

    const isMatch = await user.matchPassword(password);
    if (!isMatch) {
      return next(new AppError("Invalid email or password", 401));
    }

    sendTokenResponse(user, 200, res);
  } catch (error) {
    next(error);
  }
};


export const getMe = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id);
    res.status(200).json({ success: true, data: user });
  } catch (error) {
    next(error);
  }
};

// ─── GET /api/users ───────────────────────────────────────────────
// @desc  Get all users (admin only)
// @access Private/Admin
export const getAllUsers = async (req, res, next) => {
  try {
    const users = await User.find().select("-password").sort({ createdAt: -1 });
    res.status(200).json({
      success: true,
      count: users.length,
      data: users,
    });
  } catch (error) {
    next(error);
  }
};
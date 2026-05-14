
import User from "../models/User.js";
import AppError from "../utils/AppError.js";
import {
  generateAccessToken,
  generateRefreshToken,
  hashToken,
  refreshCookieOptions,
} from "../utils/token.js";


const sendTokenResponse = async (user, statusCode, res) => {
  
  const accessToken  = generateAccessToken(user._id);
  const refreshToken = generateRefreshToken();

  user.refreshToken       = hashToken(refreshToken);
  user.refreshTokenExpiry = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  await user.save({ validateBeforeSave: false });

  
  res.cookie("refreshToken", refreshToken, refreshCookieOptions);

  
  user.password = undefined;
  res.status(statusCode).json({
    success: true,
    accessToken, 
    data: user,
  });
};


export const register = async (req, res, next) => {
  try {
    const { name, email, phone, password } = req.body;
    const user = await User.create({ name, email, phone, password });
    await sendTokenResponse(user, 201, res);
  } catch (error) {
    if (error.code === 11000) 
      return next(new AppError("Email already registered", 400));
    next(error);
  }
};


export const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;
    if (!email || !password)
      return next(new AppError("Please provide email and password", 400));

    const user = await User.findOne({ email }).select("+password");
    if (!user || !(await user.matchPassword(password)))
      return next(new AppError("Invalid email or password", 401));

    await sendTokenResponse(user, 200, res);
  } catch (error) {
    next(error);
  }
};


export const refreshAccessToken = async (req, res, next) => {
  try {
    const incomingToken = req.cookies.refreshToken;
    if (!incomingToken)
      return next(new AppError("No refresh token", 401));

  
    const hashed = hashToken(incomingToken);
    const user = await User.findOne({
      refreshToken: hashed,
      refreshTokenExpiry: { $gt: Date.now() }, 
    });

    if (!user) return next(new AppError("Invalid or expired refresh token", 401));

    
    const accessToken = generateAccessToken(user._id);
    res.status(200).json({ success: true, accessToken });
  } catch (error) {
    next(error);
  }
};

export const logout = async (req, res, next) => {
  try {
    
    await User.findByIdAndUpdate(req.user.id, {
      refreshToken: null,
      refreshTokenExpiry: null,
    });

    
    res.clearCookie("refreshToken", refreshCookieOptions);
    res.status(200).json({ success: true, message: "Logged out" });
  } catch (error) {
    next(error);
  }
};


export const getMe = async (req, res) => {
  
  res.status(200).json({ success: true, data: req.user });
};


export const getAllUsers = async (req, res, next) => {
  try {
    const page  = parseInt(req.query.page)  || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip  = (page - 1) * limit;

    const [users, total] = await Promise.all([
      User.find()
        .select("-password -refreshToken -refreshTokenExpiry")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(), 
      User.countDocuments(),
    ]);

    res.status(200).json({
      success: true,
      total,
      currentPage: page,
      totalPages: Math.ceil(total / limit),
      data: users,
    });
  } catch (error) {
    next(error);
  }
};
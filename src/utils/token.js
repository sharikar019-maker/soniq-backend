import crypto from "crypto";
import jwt from "jsonwebtoken";



export const generateAccessToken = (id) => {
  return jwt.sign({ id }, process.env.ACCESS_TOKEN_SECRET, {
    expiresIn: "15m", 
  });
};


export const generateRefreshToken = () => {
  return crypto.randomBytes(40).toString("hex"); 
};


export const hashToken = (token) => {
  return crypto.createHash("sha256").update(token).digest("hex");
};


export const refreshCookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production", 
  sameSite: "strict",
  maxAge: 7 * 24 * 60 * 60 * 1000, 
};

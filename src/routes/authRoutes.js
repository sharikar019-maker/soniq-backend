import express from "express";
import {
  register,
  login,
  logout,
  refreshAccessToken,
  getMe,
  getAllUsers,
} from "../controllers/authController.js";
import { protect, authorizeAdmin } from "../middleware/authMiddleware.js";

const router = express.Router();

router.post("/register", register);
router.post("/login", login);
router.post("/refresh",   refreshAccessToken);
router.get("/me", protect, getMe);
router.get("/users", protect, authorizeAdmin, getAllUsers); 
router.post("/logout", protect, logout)

export default router;
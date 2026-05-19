import express from "express";
import {
  getAllUsers,
  getUserStats,
  getUserById,
  updateUserStatus,
  getProfile,
  updateProfile,
  updatePassword,
  addAddress,
  updateAddress,
  deleteAddress,
} from "../controllers/userController.js";
import { protect, authorizeAdmin } from "../middleware/authMiddleware.js";

const router = express.Router();

router.get(  "/",               protect, authorizeAdmin, getAllUsers);
router.get(  "/stats",          protect, authorizeAdmin, getUserStats);
router.get(  "/:id",            protect, authorizeAdmin, getUserById);
router.patch("/:id/status",     protect, authorizeAdmin, updateUserStatus);


router.get(  "/profile",                    protect, getProfile);
router.put(  "/profile",                    protect, updateProfile);
router.put(  "/profile/password",           protect, updatePassword);
router.post( "/profile/addresses",          protect, addAddress);
router.put(  "/profile/addresses/:addressId", protect, updateAddress);
router.delete("/profile/addresses/:addressId", protect, deleteAddress);

export default router;
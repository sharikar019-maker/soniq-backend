import express from "express";
import {
  placeOrder,
  getMyOrders,
  getOrderById,
  getAllOrders,
  updateOrderStatus,
  cancelOrder,
} from "../controllers/orderController.js";
import { protect, authorizeAdmin } from "../middleware/authMiddleware.js";

const router = express.Router();

router.use(protect);


router.route("/")
  .post(placeOrder)
  .get(authorizeAdmin, getAllOrders);


router.get("/my", getMyOrders);


router.patch("/:id/status", authorizeAdmin, updateOrderStatus);
router.patch("/:id/cancel", cancelOrder);


router.get("/:id", getOrderById);

export default router;
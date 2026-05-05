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

router.get("/:id", getOrderById);               

router.put("/:id/status", authorizeAdmin, updateOrderStatus); 
router.put("/:id/cancel", cancelOrder);          

export default router;
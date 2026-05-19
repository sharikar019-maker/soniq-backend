import express from "express";
import {
  createRazorpayOrder,
  verifyPaymentAndCreateOrder,
  getRazorpayKey,
} from "../controllers/paymentController.js";
import { protect } from "../middleware/authMiddleware.js";

const router = express.Router();

router.use(protect); 

router.get("/key", getRazorpayKey);     
router.post("/create-order", createRazorpayOrder);
router.post("/verify", verifyPaymentAndCreateOrder);

export default router;
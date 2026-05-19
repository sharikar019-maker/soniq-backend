import express from "express";
import productRoutes from "./productRoutes.js";
import authRoutes from "./authRoutes.js";
import cartRoutes from "./cartRoutes.js";
import orderRoutes from "./orderRoutes.js"; 
import paymentRoutes from "./paymentRoutes.js";
import userRoutes from "./userRoutes.js";

const router = express.Router();

router.use("/products", productRoutes);
router.use("/auth", authRoutes);
router.use("/cart", cartRoutes);
router.use("/orders", orderRoutes); 
router.use("/payment", paymentRoutes);
router.use("/users", userRoutes);

export default router;



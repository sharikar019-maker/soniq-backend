import express from "express";
import {
  getAllProducts,
  getProductById,
  createProduct,
  updateProduct,
  deleteProduct,
  addReview,
} from "../controllers/productController.js";
import { protect, authorizeAdmin } from "../middleware/authMiddleware.js";

const router = express.Router();

router.route("/")
  .get(getAllProducts)
  .post(protect, authorizeAdmin, createProduct);

router.route("/:id")
  .get(getProductById)
  .put(protect, authorizeAdmin, updateProduct)
  .delete(protect, authorizeAdmin, deleteProduct);

router.post("/:id/reviews", protect, addReview); // ← new

export default router;
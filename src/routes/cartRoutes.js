import express from "express";
import {
  getCart,
  addToCart,
  replaceCartItem,
  updateCartItem,
  removeFromCart,
  clearCart,
} from "../controllers/cartController.js";
import { protect } from "../middleware/authMiddleware.js";

const router = express.Router();

router.use(protect);

router.route("/")
  .get(getCart)
  .post(addToCart)
  .delete(clearCart);

router.route("/:productId")
  .put(replaceCartItem)    
  .patch(updateCartItem)   
  .delete(removeFromCart); 

export default router;
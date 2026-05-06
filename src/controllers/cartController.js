import Cart from "../models/Cart.js";
import Product from "../models/Product.js";
import AppError from "../utils/AppError.js";
import mongoose from "mongoose";

// ✅ Helper — recalculate totalPrice from stored prices
const calcTotal = (items) =>
  items.reduce((sum, item) => sum + item.price * item.quantity, 0);

export const getCart = async (req, res, next) => {
  try {
    const cart = await Cart.findOne({ user: req.user.id }).populate(
      "items.product", "title price image category"
    );

    if (!cart) {
      return res.status(200).json({
        success: true,
        data: { items: [], totalPrice: 0 },
      });
    }

    res.status(200).json({ success: true, data: cart });
  } catch (error) {
    next(error);
  }
};

export const addToCart = async (req, res, next) => {
  try {
    const { productId, quantity = 1 } = req.body;

    if (!mongoose.Types.ObjectId.isValid(productId)) {
      return next(new AppError("Invalid product ID", 400));
    }

    const product = await Product.findById(productId);
    if (!product) return next(new AppError("Product not found", 404));

    let cart = await Cart.findOne({ user: req.user.id });
    if (!cart) {
      cart = new Cart({ user: req.user.id, items: [] });
    }

    const existingItem = cart.items.find(
      (item) => item.product.toString() === productId
    );

    if (existingItem) {
      existingItem.quantity += quantity;
    } else {
      // ✅ store price alongside product reference
      cart.items.push({ product: productId, quantity, price: product.price });
    }

    // ✅ compute totalPrice before saving (no populate needed)
    cart.totalPrice = calcTotal(cart.items);
    await cart.save();

    await cart.populate("items.product", "title price image category");
    res.status(200).json({ success: true, data: cart });
  } catch (error) {
    next(error);
  }
};

export const updateCartItem = async (req, res, next) => {
  try {
    const { quantity } = req.body;
    const { productId } = req.params;

    if (!quantity || quantity < 1) {
      return next(new AppError("Quantity must be at least 1", 400));
    }

    const cart = await Cart.findOne({ user: req.user.id });
    if (!cart) return next(new AppError("Cart not found", 404));

    const item = cart.items.find(
      (item) => item.product.toString() === productId
    );
    if (!item) return next(new AppError("Item not found in cart", 404));

    item.quantity = quantity;
    cart.totalPrice = calcTotal(cart.items); // ✅
    await cart.save();

    await cart.populate("items.product", "title price image category");
    res.status(200).json({ success: true, data: cart });
  } catch (error) {
    next(error);
  }
};

export const removeFromCart = async (req, res, next) => {
  try {
    const { productId } = req.params;

    const cart = await Cart.findOne({ user: req.user.id });
    if (!cart) return next(new AppError("Cart not found", 404));

    cart.items = cart.items.filter(
      (item) => item.product.toString() !== productId
    );
    cart.totalPrice = calcTotal(cart.items); // ✅
    await cart.save();

    await cart.populate("items.product", "title price image category");
    res.status(200).json({ success: true, data: cart });
  } catch (error) {
    next(error);
  }
};

export const clearCart = async (req, res, next) => {
  try {
    const cart = await Cart.findOne({ user: req.user.id });
    if (!cart) return next(new AppError("Cart not found", 404));

    cart.items = [];
    cart.totalPrice = 0; // ✅
    await cart.save();

    res.status(200).json({ success: true, message: "Cart cleared", data: cart });
  } catch (error) {
    next(error);
  }
};
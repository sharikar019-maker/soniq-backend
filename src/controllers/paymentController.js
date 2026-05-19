import crypto from "crypto";
import mongoose from "mongoose";
import getRazorpay from "../config/razorpay.js";
import Order from "../models/Order.js";
import Cart from "../models/Cart.js";
import AppError from "../utils/AppError.js";
import { buildOrderFromCart } from "./orderController.js";


export const createRazorpayOrder = async (req, res, next) => {
  try {
   
    const cartData = await buildOrderFromCart(req.user.id);
    if (!cartData) return next(new AppError("Your cart is empty", 400));

    const razorpay = getRazorpay();
    const razorpayOrder = await razorpay.orders.create({
      amount:   Math.round(cartData.totalPrice * 100), 
      currency: "INR",
      receipt:  `receipt_${Date.now()}`,
    });

    res.status(200).json({
      success: true,
      data: {
        razorpayOrderId: razorpayOrder.id,
        amount:          razorpayOrder.amount,
        currency:        razorpayOrder.currency,
        keyId:           process.env.RAZORPAY_KEY_ID,
      },
    });
  } catch (error) {
    next(error);
  }
};

export const verifyPaymentAndCreateOrder = async (req, res, next) => {
  try {
    const {
      razorpayOrderId,
      razorpayPaymentId,
      razorpaySignature,
      shippingAddress,
    } = req.body;

    if (!razorpayOrderId || !razorpayPaymentId || !razorpaySignature)
      return next(new AppError("Payment details are incomplete", 400));

    if (!shippingAddress || typeof shippingAddress !== "object")
      return next(new AppError("Shipping address is required", 400));

   
    const { street, city, country } = shippingAddress;
    if (!street || !city || !country)
      return next(
        new AppError(
          "Shipping address must include street, city, and country",
          400
        )
      );

    
    if (!process.env.RAZORPAY_KEY_SECRET)
      return next(new AppError("Payment configuration error", 500));

    
    const expectedSignature = crypto
      .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
      .update(`${razorpayOrderId}|${razorpayPaymentId}`)
      .digest("hex");

    if (expectedSignature !== razorpaySignature)
      return next(new AppError("Payment verification failed", 400));

    
    const cartData = await buildOrderFromCart(req.user.id);

    if (!cartData)
      return next(new AppError("Cart is empty", 400));

    const order = await Order.create({
      user:              req.user.id,
      items:             cartData.orderItems,
      shippingAddress,
      paymentMethod:     "online",
      totalPrice:        cartData.totalPrice,
      isPaid:            true,
      paidAt:            new Date(),
      razorpayOrderId,
      razorpayPaymentId,
      razorpaySignature,
    });

    
    await Cart.updateOne(
      { user: new mongoose.Types.ObjectId(req.user.id) },
      { $set: { items: [], totalPrice: 0 } }
    );

    res.status(201).json({ success: true, data: order });
  } catch (error) {
    next(error);
  }
};


export const getRazorpayKey = (req, res) => {
  res.status(200).json({
    success: true,
    keyId: process.env.RAZORPAY_KEY_ID,
  });
};
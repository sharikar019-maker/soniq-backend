import crypto from "crypto";
import getRazorpay from "../config/razorpay.js"; // ← same import
import Order from "../models/Order.js";
import Cart from "../models/Cart.js";
import AppError from "../utils/AppError.js";

export const createRazorpayOrder = async (req, res, next) => {
  try {
    const { amount } = req.body;

    if (!amount || amount <= 0) {
      return next(new AppError("Valid amount is required", 400));
    }

    const razorpay = getRazorpay(); // ← call it here, not at top level

    const options = {
      amount: Math.round(amount * 100),
      currency: "INR",
      receipt: `receipt_${Date.now()}`,
    };

    const razorpayOrder = await razorpay.orders.create(options);

    res.status(200).json({
      success: true,
      data: {
        razorpayOrderId: razorpayOrder.id,
        amount: razorpayOrder.amount,
        currency: razorpayOrder.currency,
        keyId: process.env.RAZORPAY_KEY_ID,
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

    if (!razorpayOrderId || !razorpayPaymentId || !razorpaySignature) {
      return next(new AppError("Payment details are incomplete", 400));
    }

    if (!shippingAddress) {
      return next(new AppError("Shipping address is required", 400));
    }

    // verify signature
    const body = razorpayOrderId + "|" + razorpayPaymentId;
    const expectedSignature = crypto
      .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
      .update(body)
      .digest("hex");

    if (expectedSignature !== razorpaySignature) {
      return next(new AppError("Payment verification failed", 400));
    }

    const cart = await Cart.findOne({ user: req.user.id }).populate(
      "items.product"
    );

    if (!cart || cart.items.length === 0) {
      return next(new AppError("Cart is empty", 400));
    }

    const orderItems = cart.items.map((item) => ({
      product: item.product._id,
      title: item.product.title,
      image: item.product.image,
      price: item.product.price,
      quantity: item.quantity,
    }));

    const totalPrice = orderItems.reduce(
      (total, item) => total + item.price * item.quantity,
      0
    );

    const order = await Order.create({
      user: req.user.id,
      items: orderItems,
      shippingAddress,
      paymentMethod: "online",
      totalPrice,
      isPaid: true,
      paidAt: Date.now(),
      razorpayOrderId,
      razorpayPaymentId,
      razorpaySignature,
    });

    cart.items = [];
    await cart.save();

    res.status(201).json({ success: true, data: order });
  } catch (error) {
    next(error);
  }
};

export const getRazorpayKey = async (req, res) => {
  res.status(200).json({
    success: true,
    keyId: process.env.RAZORPAY_KEY_ID,
  });
};
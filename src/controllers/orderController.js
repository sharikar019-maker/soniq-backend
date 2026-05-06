import Order from "../models/Order.js";
import Cart from "../models/Cart.js";
import AppError from "../utils/AppError.js";


export const placeOrder = async (req, res, next) => {
  try {
    const { shippingAddress, paymentMethod } = req.body;

    if (!shippingAddress) {
      return next(new AppError("Shipping address is required", 400));
    }

    const cart = await Cart.findOne({ user: req.user.id }).populate(
      "items.product"
    );

    if (!cart || cart.items.length === 0) {
      return next(new AppError("Your cart is empty", 400));
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
      paymentMethod: paymentMethod || "COD",
      totalPrice,
    });

    cart.items = [];
    await cart.save();

    res.status(201).json({ success: true, data: order });
  } catch (error) {
    next(error);
  }
};


export const getMyOrders = async (req, res, next) => {
  try {
    const orders = await Order.find({ user: req.user.id }).sort({
      createdAt: -1,
    });

    res.status(200).json({
      success: true,
      count: orders.length,
      data: orders,
    });
  } catch (error) {
    next(error);
  }
};


export const getOrderById = async (req, res, next) => {
  try {
    const order = await Order.findById(req.params.id).populate(
      "user",
      "name email phone"
    );

    if (!order) {
      return next(new AppError("Order not found", 404));
    }

    if (
      order.user._id.toString() !== req.user.id &&
      req.user.role !== "admin"
    ) {
      return next(new AppError("Not authorized to view this order", 403));
    }

    res.status(200).json({ success: true, data: order });
  } catch (error) {
    next(error);
  }
};


export const getAllOrders = async (req, res, next) => {
  try {
    const orders = await Order.find()
      .populate("user", "name email phone")
      .sort({ createdAt: -1 });

    const totalRevenue = orders.reduce(
      (total, order) => total + order.totalPrice,
      0
    );

    res.status(200).json({
      success: true,
      count: orders.length,
      totalRevenue,
      data: orders,
    });
  } catch (error) {
    next(error);
  }
};


export const updateOrderStatus = async (req, res, next) => {
  try {
    const { status } = req.body;

    const validStatuses = [
      "pending",
      "processing",
      "shipped",
      "delivered",
      "cancelled",
    ];

    if (!validStatuses.includes(status)) {
      return next(
        new AppError(`Status must be one of: ${validStatuses.join(", ")}`, 400)
      );
    }

    const order = await Order.findById(req.params.id);
    if (!order) {
      return next(new AppError("Order not found", 404));
    }

    order.status = status;

    if (status === "delivered") {
      order.deliveredAt = Date.now();
      order.isPaid = true;
      order.paidAt = Date.now();
    }

    await order.save();
    res.status(200).json({ success: true, data: order });
  } catch (error) {
    next(error);
  }
};


export const cancelOrder = async (req, res, next) => {
  try {
    const order = await Order.findById(req.params.id);

    if (!order) {
      return next(new AppError("Order not found", 404));
    }

    if (order.user.toString() !== req.user.id) {
      return next(new AppError("Not authorized to cancel this order", 403));
    }

    if (order.status !== "pending") {
      return next(
        new AppError(`Cannot cancel order with status: ${order.status}`, 400)
      );
    }

    order.status = "cancelled";
    await order.save();

    res.status(200).json({ success: true, data: order });
  } catch (error) {
    next(error);
  }
};
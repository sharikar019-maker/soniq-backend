
import mongoose from "mongoose";
import Order from "../models/Order.js";
import Cart from "../models/Cart.js";
import AppError from "../utils/AppError.js";

const VALID_STATUSES = ["pending", "processing", "shipped", "delivered", "cancelled"];


export const buildOrderFromCart = async (userId) => {
  const result = await Cart.aggregate([
    {
      $match: { user: new mongoose.Types.ObjectId(userId) },
    },
    {
      $lookup: {
        from: "products",
        localField: "items.product",
        foreignField: "_id",
        as: "productDocs",
      },
    },
    {
      $addFields: {
        
        orderItems: {
          $map: {
            input: "$items",
            as: "item",
            in: {
              $let: {
                vars: {
                  prod: {
                    $arrayElemAt: [
                      {
                        $filter: {
                          input: "$productDocs",
                          as: "p",
                          cond: { $eq: ["$$p._id", "$$item.product"] },
                        },
                      },
                      0,
                    ],
                  },
                },
                in: {
                  product: "$$item.product",
                  quantity: "$$item.quantity",
                  price:    "$$prod.price",
                  title:    "$$prod.title",
                  image:    "$$prod.image",
                },
              },
            },
          },
        },

       
        totalPrice: {
          $sum: {
            $map: {
              input: "$items",
              as: "item",
              in: {
                $multiply: [
                  {
                    $let: {
                      vars: {
                        prod: {
                          $arrayElemAt: [
                            {
                              $filter: {
                                input: "$productDocs",
                                as: "p",
                                cond: { $eq: ["$$p._id", "$$item.product"] },
                              },
                            },
                            0,
                          ],
                        },
                      },
                      in: "$$prod.price",
                    },
                  },
                  "$$item.quantity",
                ],
              },
            },
          },
        },
      },
    },
    {
      $project: {
        orderItems: 1,
        totalPrice: 1,
        itemCount: { $size: "$items" },
      },
    },
  ]);

  const data = result[0];

  
  if (!data || data.itemCount === 0) return null;

  return data;
};


export const placeOrder = async (req, res, next) => {
  try {
    const { shippingAddress, paymentMethod } = req.body;

    if (!shippingAddress || typeof shippingAddress !== "object") {
      return next(new AppError("Shipping address is required", 400));
    }

    
    const { street, city, country } = shippingAddress;
    if (!street || !city || !country) {
      return next(new AppError("Shipping address must include street, city, and country", 400));
    }

    const cartData = await buildOrderFromCart(req.user.id);

    
    if (!cartData) {
      return next(new AppError("Your cart is empty", 400));
    }

    const order = await Order.create({
      user:            req.user.id,
      items:           cartData.orderItems,
      shippingAddress,
      paymentMethod:   paymentMethod || "COD",
      totalPrice:      cartData.totalPrice,
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


export const getMyOrders = async (req, res, next) => {
  try {
    const page  = Math.max(parseInt(req.query.page)  || 1, 1);
    const limit = Math.min(parseInt(req.query.limit) || 10, 50);
    const skip  = (page - 1) * limit;

    const filter = { user: new mongoose.Types.ObjectId(req.user.id) };
    if (req.query.status && VALID_STATUSES.includes(req.query.status)) {
      filter.status = req.query.status;
    }

    const [orders, total] = await Promise.all([
      Order.find(filter)
        .select("-items.image")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Order.countDocuments(filter),
    ]);

    res.status(200).json({
      success: true,
      total,
      currentPage: page,
      totalPages: Math.ceil(total / limit),
      data: orders,
    });
  } catch (error) {
    next(error);
  }
};


export const getOrderById = async (req, res, next) => {
  try {
   
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return next(new AppError("Invalid order ID", 400));
    }

    const [order] = await Order.aggregate([
      {
        $match: { _id: new mongoose.Types.ObjectId(req.params.id) },
      },
      {
        $lookup: {
          from: "users",
          localField: "user",
          foreignField: "_id",
          as: "user",
          pipeline: [
            { $project: { name: 1, email: 1, phone: 1 } },
          ],
        },
      },
      {
        $unwind: "$user",
      },
    ]);

    if (!order) return next(new AppError("Order not found", 404));

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
    const page  = Math.max(parseInt(req.query.page)  || 1, 1);
    const limit = Math.min(parseInt(req.query.limit) || 20, 100);
    const skip  = (page - 1) * limit;

    const matchFilter = {};
    if (req.query.status && VALID_STATUSES.includes(req.query.status)) {
      matchFilter.status = req.query.status;
    }

    const [result] = await Order.aggregate([
      { $match: matchFilter },
      {
        $facet: {
          metadata: [
            {
              $group: {
                _id: null,
                total: { $sum: 1 },
                totalRevenue: { $sum: "$totalPrice" },
              },
            },
          ],
          orders: [
            { $sort: { createdAt: -1 } },
            { $skip: skip },
            { $limit: limit },
            {
              $lookup: {
                from: "users",
                localField: "user",
                foreignField: "_id",
                as: "user",
                pipeline: [
                  { $project: { name: 1, email: 1, phone: 1 } },
                ],
              },
            },
            { $unwind: "$user" },
          ],
        },
      },
    ]);

    const total        = result.metadata[0]?.total        || 0;
    const totalRevenue = result.metadata[0]?.totalRevenue || 0;

    res.status(200).json({
      success: true,
      total,
      totalRevenue,
      currentPage: page,
      totalPages: Math.ceil(total / limit),
      data: result.orders,
    });
  } catch (error) {
    next(error);
  }
};


export const updateOrderStatus = async (req, res, next) => {
  try {
   
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return next(new AppError("Invalid order ID", 400));
    }

    const { status } = req.body;

    if (!VALID_STATUSES.includes(status)) {
      return next(
        new AppError(`Status must be one of: ${VALID_STATUSES.join(", ")}`, 400)
      );
    }

    const updateFields = { status };
    if (status === "delivered") {
      updateFields.deliveredAt = new Date();
      updateFields.isPaid      = true;
      updateFields.paidAt      = new Date();
    }

    const order = await Order.findByIdAndUpdate(
      req.params.id,
      { $set: updateFields },
      { new: true, runValidators: true }
    ).lean();

    if (!order) return next(new AppError("Order not found", 404));

    res.status(200).json({ success: true, data: order });
  } catch (error) {
    next(error);
  }
};


export const cancelOrder = async (req, res, next) => {
  try {
    
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return next(new AppError("Invalid order ID", 400));
    }

    const order = await Order.findOneAndUpdate(
      {
        _id:    req.params.id,
        user:   req.user.id,
        status: "pending",
      },
      { $set: { status: "cancelled" } },
      { new: true }
    ).lean();

    if (!order) {
      const exists = await Order.findById(req.params.id).lean();
      if (!exists)
        return next(new AppError("Order not found", 404));
      if (exists.user.toString() !== req.user.id)
        return next(new AppError("Not authorized to cancel this order", 403));
      return next(
        new AppError(`Cannot cancel order with status: ${exists.status}`, 400)
      );
    }

    res.status(200).json({ success: true, data: order });
  } catch (error) {
    next(error);
  }
};
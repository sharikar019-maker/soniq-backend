import Cart from "../models/Cart.js";
import Product from "../models/Product.js";
import AppError from "../utils/AppError.js";
import mongoose from "mongoose";


const getCartPipeline = (userId) => [
  { $match: { user: userId } },
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
      items: {
        $map: {
          input: "$items",
          as: "item",
          in: {
            _id: "$$item._id",
            quantity: "$$item.quantity",
            price: "$$item.price",
            product: {
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
                  _id: "$$prod._id",
                  title: "$$prod.title",
                  image: "$$prod.image",
                  category: "$$prod.category",
                  price: "$$prod.price",
                },
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
            in: { $multiply: ["$$item.price", "$$item.quantity"] },
          },
        },
      },
    },
  },
  { $project: { productDocs: 0 } },
];


const emptyCart = { items: [], totalPrice: 0 };



export const getCart = async (req, res, next) => {
  try {
    const userId = new mongoose.Types.ObjectId(req.user.id);
    const [cart] = await Cart.aggregate(getCartPipeline(userId));

    res.status(200).json({
      success: true,
      data: cart || emptyCart,
    });
  } catch (error) {
    next(error);
  }
};



export const addToCart = async (req, res, next) => {
  try {
    const { productId } = req.body;
    
    const quantity = parseInt(req.body.quantity) || 1;

    if (quantity < 1)
      return next(new AppError("Quantity must be at least 1", 400));

    if (!mongoose.Types.ObjectId.isValid(productId))
      return next(new AppError("Invalid product ID", 400));

    const product = await Product.findById(productId)
      .select("price title image category")
      .lean();

    if (!product)
      return next(new AppError("Product not found", 404));

    const userId = new mongoose.Types.ObjectId(req.user.id);
    const pid    = new mongoose.Types.ObjectId(productId);

    const existingItem = await Cart.exists({ user: userId, "items.product": pid });

    if (existingItem) {
      
      await Cart.updateOne(
        { user: userId, "items.product": pid },
        { $inc: { "items.$.quantity": quantity } }
      );
    } else {
      
      await Cart.findOneAndUpdate(
        { user: userId },
        {
          $setOnInsert: { user: userId },
          $push: {
            items: { product: pid, quantity, price: product.price },
          },
        },
        { upsert: true, new: true }
      );
    }

    
    const [cart] = await Cart.aggregate(getCartPipeline(userId));

    res.status(200).json({ success: true, data: cart });
  } catch (error) {
    next(error);
  }
};



export const updateCartItem = async (req, res, next) => {
  try {
    const { productId } = req.params;
    const quantity = parseInt(req.body.quantity);

    if (!quantity || quantity < 1)
      return next(new AppError("Quantity must be at least 1", 400));

    if (!mongoose.Types.ObjectId.isValid(productId))
      return next(new AppError("Invalid product ID", 400));

    const userId = new mongoose.Types.ObjectId(req.user.id);
    const pid    = new mongoose.Types.ObjectId(productId);

    const result = await Cart.updateOne(
      { user: userId, "items.product": pid },
      { $set: { "items.$.quantity": quantity } }
    );

    if (result.matchedCount === 0)
      return next(new AppError("Item not found in cart", 404));

   
    const [cart] = await Cart.aggregate(getCartPipeline(userId));

    res.status(200).json({ success: true, data: cart });
  } catch (error) {
    next(error);
  }
};



export const removeFromCart = async (req, res, next) => {
  try {
    const { productId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(productId))
      return next(new AppError("Invalid product ID", 400));

    const userId = new mongoose.Types.ObjectId(req.user.id);
    const pid    = new mongoose.Types.ObjectId(productId);

    
    const result = await Cart.updateOne(
      { user: userId },
      { $pull: { items: { product: pid } } }
    );

    if (result.modifiedCount === 0)
      return next(new AppError("Item not found in cart", 404));

    
    const [cart] = await Cart.aggregate(getCartPipeline(userId));

    res.status(200).json({
      success: true,
      data: cart || emptyCart,
    });
  } catch (error) {
    next(error);
  }
};



export const clearCart = async (req, res, next) => {
  try {
    const userId = new mongoose.Types.ObjectId(req.user.id);

    await Cart.updateOne(
      { user: userId },
      { $set: { items: [], totalPrice: 0 } }
    );

    res.status(200).json({
      success: true,
      message: "Cart cleared",
      data: emptyCart,
    });
  } catch (error) {
    next(error);
  }
};
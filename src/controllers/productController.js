import mongoose from "mongoose";
import Product from "../models/Product.js";
import AppError from "../utils/AppError.js";

const isValidId = (id) => mongoose.Types.ObjectId.isValid(id);


export const getAllProducts = async (req, res, next) => {
  try {
    const products = await Product.find();
    res.status(200).json({
      success: true,
      count: products.length,
      data: products,
    });
  } catch (error) {
    next(error); 
  }
};


export const getProductById = async (req, res, next) => {
  try {
    if (!isValidId(req.params.id)) {
      return next(new AppError("Invalid product ID", 400));
    }

    const product = await Product.findById(req.params.id);
    if (!product) {
      return next(new AppError("Product not found", 404));
    }

    res.status(200).json({ success: true, data: product });
  } catch (error) {
    next(error);
  }
};


export const createProduct = async (req, res, next) => {
  try {
    const product = await Product.create(req.body);
    res.status(201).json({ success: true, data: product });
  } catch (error) {
    next(error);
  }
};


export const updateProduct = async (req, res, next) => {
  try {
    if (!isValidId(req.params.id)) {
      return next(new AppError("Invalid product ID", 400));
    }

    const product = await Product.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    );

    if (!product) {
      return next(new AppError("Product not found", 404));
    }

    res.status(200).json({ success: true, data: product });
  } catch (error) {
    next(error);
  }
};


export const deleteProduct = async (req, res, next) => {
  try {
    if (!isValidId(req.params.id)) {
      return next(new AppError("Invalid product ID", 400));
    }

    const product = await Product.findByIdAndDelete(req.params.id);
    if (!product) {
      return next(new AppError("Product not found", 404));
    }

    res.status(200).json({ success: true, message: "Product deleted successfully" });
  } catch (error) {
    next(error);
  }
};

// ─── POST /api/products/:id/reviews ──────────────────────────────
// @desc  Add review to product
// @access Private
export const addReview = async (req, res, next) => {
  try {
    if (!isValidId(req.params.id)) {
      return next(new AppError("Invalid product ID", 400));
    }

    const { rating, comment } = req.body;

    if (!rating || !comment) {
      return next(new AppError("Rating and comment are required", 400));
    }

    const product = await Product.findById(req.params.id);
    if (!product) {
      return next(new AppError("Product not found", 404));
    }

    const review = {
      name: req.user.name,
      rating: Number(rating),
      comment,
    };

    product.reviews.push(review);
    await product.save();

    res.status(201).json({ success: true, data: product });
  } catch (error) {
    next(error);
  }
};

import mongoose from "mongoose";
import Product from "../models/Product.js";
import AppError from "../utils/AppError.js";

const isValidId = (id) => mongoose.Types.ObjectId.isValid(id);


export const getAllProducts = async (req, res, next) => {
  try {
    const page  = Math.max(parseInt(req.query.page)  || 1, 1);
    const limit = Math.min(parseInt(req.query.limit) || 12, 50);
    const skip  = (page - 1) * limit;

    const filter = {};

    if (req.query.category) {
      filter.category = req.query.category.toLowerCase().trim();
    }

    if (req.query.noiseReduction) {
      filter.noiseReduction = req.query.noiseReduction === "true";
    }

    if (req.query.minPrice || req.query.maxPrice) {
      filter.price = {};
      if (req.query.minPrice) filter.price.$gte = Number(req.query.minPrice);
      if (req.query.maxPrice) filter.price.$lte = Number(req.query.maxPrice);
    }

    if (req.query.minRating) {
      filter.rating = { $gte: Number(req.query.minRating) };
    }

    if (req.query.search) {
      filter.$text = { $search: req.query.search };
    }

    const sortOptions = {
      newest:        { createdAt: -1 },
      oldest:        { createdAt:  1 },
      "price-asc":   { price:      1 },
      "price-desc":  { price:     -1 },
      "rating-desc": { rating:    -1 },
    };
    const sort = sortOptions[req.query.sort] || { createdAt: -1 };

    const [products, total] = await Promise.all([
      Product.find(filter)
        .select("-reviews")
        .sort(sort)
        .skip(skip)
        .limit(limit)
        .lean(),
      Product.countDocuments(filter),
    ]);

    res.status(200).json({
      success: true,
      total,
      currentPage: page,
      totalPages: Math.ceil(total / limit),
      count: products.length,
      data: products,
    });
  } catch (error) {
    next(error);
  }
};


export const getProductById = async (req, res, next) => {
  try {
    if (!isValidId(req.params.id))
      return next(new AppError("Invalid product ID", 400));

    const [product] = await Product.aggregate([
      {
        $match: { _id: new mongoose.Types.ObjectId(req.params.id) },
      },
      {
        $addFields: {
          numReviews: { $size: "$reviews" },
          rating: {
            $cond: {
              if: { $gt: [{ $size: "$reviews" }, 0] },
              then: { $avg: "$reviews.rating" },
              else: 0,
            },
          },
        },
      },
    ]);

    if (!product) return next(new AppError("Product not found", 404));

    res.status(200).json({ success: true, data: product });
  } catch (error) {
    next(error);
  }
};


export const createProduct = async (req, res, next) => {
  try {
    const {
      title, image, price, category,
      noiseReduction, description, technicalSpecs,
    } = req.body;

    const product = await Product.create({
      title, image, price, category,
      noiseReduction, description, technicalSpecs,
    });

    res.status(201).json({ success: true, data: product });
  } catch (error) {
    next(error);
  }
};


export const updateProduct = async (req, res, next) => {
  try {
    if (!isValidId(req.params.id))
      return next(new AppError("Invalid product ID", 400));

    const {
      title, image, price, category,
      noiseReduction, description, technicalSpecs,
    } = req.body;

    const allowed = {
      ...(title          !== undefined && { title }),
      ...(image          !== undefined && { image }),
      ...(price          !== undefined && { price }),
      ...(category       !== undefined && { category }),
      ...(noiseReduction !== undefined && { noiseReduction }),
      ...(description    !== undefined && { description }),
      ...(technicalSpecs !== undefined && { technicalSpecs }),
    };

    const product = await Product.findByIdAndUpdate(
      req.params.id,
      { $set: allowed },
      { new: true, runValidators: true }
    ).lean();

    if (!product) return next(new AppError("Product not found", 404));

    res.status(200).json({ success: true, data: product });
  } catch (error) {
    next(error);
  }
};


export const deleteProduct = async (req, res, next) => {
  try {
    if (!isValidId(req.params.id))
      return next(new AppError("Invalid product ID", 400));

    const product = await Product.findByIdAndDelete(req.params.id).lean();
    if (!product) return next(new AppError("Product not found", 404));

    res.status(200).json({ success: true, message: "Product deleted successfully" });
  } catch (error) {
    next(error);
  }
};


export const addReview = async (req, res, next) => {
  try {
    if (!isValidId(req.params.id))
      return next(new AppError("Invalid product ID", 400));

    
    const { rating: userRating, comment } = req.body;
    if (!userRating || !comment)
      return next(new AppError("Rating and comment are required", 400));

    const productId = new mongoose.Types.ObjectId(req.params.id);
    const userId    = new mongoose.Types.ObjectId(req.user.id);

    
    const alreadyReviewed = await Product.findOne({
      _id: productId,
      "reviews.user": userId,
    }).lean();

    if (alreadyReviewed)
      return next(new AppError("You have already reviewed this product", 400));

    
    await Product.updateOne(
      { _id: productId },
      {
        $push: {
          reviews: {
            user:    userId,
            name:    req.user.name,
            rating:  Number(userRating), 
            comment,
          },
        },
      }
    );

    const fresh = await Product.findById(productId).select("reviews").lean();
    const numReviews = fresh.reviews.length;
    const newRating =
      numReviews === 0
        ? 0
        : Math.round(
            (fresh.reviews.reduce((sum, r) => sum + r.rating, 0) / numReviews) * 10
          ) / 10;

    
    await Product.updateOne(
      { _id: productId },
      { $set: { numReviews, rating: newRating } }
    );

    
    const [product] = await Product.aggregate([
      { $match: { _id: productId } },
      {
        $addFields: {
          numReviews: { $size: "$reviews" },
          rating: {
            $cond: {
              if: { $gt: [{ $size: "$reviews" }, 0] },
              then: { $round: [{ $avg: "$reviews.rating" }, 1] },
              else: 0,
            },
          },
        },
      },
    ]);

    res.status(201).json({ success: true, data: product });
  } catch (error) {
    next(error);
  }
};
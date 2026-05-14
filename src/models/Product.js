
import mongoose from "mongoose";

const reviewSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId, 
      ref: "User",
      required: true,
    },
    name: { type: String, required: true },
    rating: { type: Number, required: true, min: 1, max: 5 },
    comment: { type: String, required: true },
  },
  { timestamps: true }
);

const technicalSpecsSchema = new mongoose.Schema({
  driver:    String,
  frequency: String,
  impedance: String,
  bluetooth: String,
  battery:   String,
});

const productSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, "Product title is required"],
      trim: true,
    },
    image: {
      type: String,
      required: [true, "Product image is required"],
    },
    price: {
      type: Number,
      required: [true, "Product price is required"],
      min: [0, "Price cannot be negative"],
    },
    category: {
      type: String,
      required: [true, "Product category is required"],
      lowercase: true,
      trim: true,
    },
    noiseReduction: { type: Boolean, default: false },
    rating:  { type: Number, default: 0, min: 0, max: 5 },
    numReviews: { type: Number, default: 0 }, 
    description: {
      type: String,
      required: [true, "Product description is required"],
    },
    technicalSpecs: technicalSpecsSchema,
    reviews: [reviewSchema],
  },
  { timestamps: true }
);


productSchema.index({ category: 1 });
productSchema.index({ price: 1 });
productSchema.index({ rating: -1 });
productSchema.index({ createdAt: -1 });
productSchema.index({ title: "text", description: "text" }); 


productSchema.index({ category: 1, price: 1 });

export default mongoose.model("Product", productSchema);
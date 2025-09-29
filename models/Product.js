const mongoose = require("mongoose");

const productSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    description: { type: String, required: true },
    type: { type: String, required: true }, // <-- new field
    features: { type: [String], default: [] },
    originalPrice: { type: Number, required: true },
    currentPrice: { type: Number, required: true },
    discount: { type: Number, default: 0 },
    badge: { type: String, default: "" },
    image: { type: String },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Product", productSchema);

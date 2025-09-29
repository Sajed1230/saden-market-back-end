const express = require("express");
const router = express.Router();
const multer = require("multer");
const { storage } = require("../config/cloudinary");
const upload = multer({ storage });

const Product = require("../models/Product");

// ===== Show Add Product Form =====
router.get("/productForm", (req, res) => {
  res.render("addProduct");
});

// ===== Handle Product Submission =====
router.post("/products", upload.single("image"), async (req, res) => {
  try {
    // Validate type field
    if (!req.body.type) {
      return res.status(400).send("❌ Product type is required");
    }

    const product = new Product({
      name: req.body.name,
      description: req.body.description,
      type: req.body.type, // <-- this is required
      features: req.body.features ? req.body.features.filter(f => f.trim() !== "") : [],
      originalPrice: req.body.originalPrice,
      currentPrice: req.body.currentPrice,
      discount: req.body.discount,
      badge: req.body.badge,
      image: req.file ? req.file.path : null, // Cloudinary URL
    });

    await product.save();
    // res.send("✅ Product saved successfully!");
    res.redirect("/shop/productslist")
  } catch (err) {
    console.error(err);
    res.status(500).send("❌ Error saving product");
  }
});


module.exports = router;

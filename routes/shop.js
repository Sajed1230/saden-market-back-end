const express = require("express");
const router = express.Router();
const Product = require("../models/Product");
const multer = require("multer");
const { storage } = require("../config/cloudinary");

const upload = multer({ storage });

// ===== List all products =====
router.get("/productslist", async (req, res) => {
  try {
    // Fetch all products from MongoDB, latest first
    const products = await Product.find().sort({ createdAt: -1 });

    // Render the EJS page and pass products
    res.render("product-list", { products });
  } catch (err) {
    console.error(err);
    res.status(500).send("❌ Error fetching products");
  }
});
//==============
router.post("/products/delete/:id", async (req, res) => {
  try {
    const productId = req.params.id; 
    console.log("Deleting product:", productId);

    await Product.findByIdAndDelete(productId);

    console.log("Product deleted successfully");
    res.redirect("/shop/productslist");
  } catch (err) {
    console.error("Error deleting product:", err);
    res.status(500).send("Something went wrong!");
  }
});
//======================================


router.get("/products/edit/:id", async (req, res) => {
  try {
    const productId = req.params.id;
    console.log("Editing product:", productId);

    const product = await Product.findById(productId);

    if (!product) {
      return res.status(404).send("Product not found");
    }

    res.render("editProduct", { product });
  } catch (err) {
    console.error("Error fetching product:", err);
    res.status(500).send("Something went wrong!");
  }
});
//=================================
router.post("/products/edit/:id", upload.single("image"), async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) return res.status(404).send("❌ Product not found");

    // Update fields
    product.name = req.body.name;
    product.description = req.body.description;
    product.type = req.body.type;
    product.features = req.body.features ? req.body.features.filter(f => f.trim() !== "") : [];
    product.originalPrice = req.body.originalPrice;
    product.currentPrice = req.body.currentPrice;

    // Calculate discount automatically
    if (product.originalPrice && product.currentPrice && product.originalPrice > product.currentPrice) {
      product.discount = Math.round(((product.originalPrice - product.currentPrice) / product.originalPrice) * 100);
    } else {
      product.discount = 0;
    }

    product.badge = req.body.badge;

    // Update image if new one uploaded
    if (req.file) {
      product.image = req.file.path; // Cloudinary URL
    }

    await product.save();

    res.redirect("/shop/productslist");
  } catch (err) {
    console.error("Error updating product:", err);
    res.status(500).send("❌ Error updating product");
  }
});


module.exports = router;

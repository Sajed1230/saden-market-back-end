const express = require("express");
const router = express.Router();
const { body, validationResult } = require("express-validator");
const argon2 = require("argon2");
const User = require("../models/User");
const Product = require("../models/Product");
const PDFDocument = require("pdfkit");
const nodemailer = require("nodemailer");

//==========================================================
router.post(
  "/login",
  [
    body("email").isEmail().withMessage("Enter a valid email"),
    body("password").notEmpty().withMessage("Password is required"),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const { email, password } = req.body;

    try {
      // ✅ Find user and populate cart
      const user = await User.findOne({ email }).populate("cart.product");

      if (!user) return res.status(400).json({ message: "Invalid credentials" });

      const isMatch = await argon2.verify(user.password, password);
      if (!isMatch) return res.status(400).json({ message: "Invalid credentials" });

      res.json({
        message: "Login successful",
        user: {
          id: user._id,
          firstName: user.firstName,
          lastName: user.lastName,
          email: user.email,
          cart: user.cart, // 
        },
      });
    } catch (err) {
      console.error(err);
      res.status(500).send("Server error");
    }
  }
);

// User signup
router.post(
  "/signup",
  [
    body("firstName").notEmpty().withMessage("First name is required"),
    body("lastName").notEmpty().withMessage("Last name is required"),
    body("email").isEmail().withMessage("Enter a valid email"),
    body("password")
      .isLength({ min: 6 })
      .withMessage("Password must be at least 6 characters"),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty())
      return res.status(400).json({ errors: errors.array() });

    const { firstName, lastName, email, password } = req.body;

    try {
      // Check if user exists
      let user = await User.findOne({ email });
      if (user)
        return res.status(400).json({ message: "User already exists" });

      // Hash password
      const hashedPassword = await argon2.hash(password);

      // Create new user
      user = new User({
        firstName,
        lastName,
        email,
        password: hashedPassword,
        cart: [], // ensure cart is initialized
      });
      await user.save();

      // Respond with user info + cart
      res.status(201).json({
        message: "Signup successful",
        user: {
          id: user._id,
          firstName: user.firstName,
          lastName: user.lastName,
          email: user.email,
          cart: user.cart, // ✅ send cart as well
        },
      });
    } catch (err) {
      console.error(err);
      res.status(500).send("Server error");
    }
  }
);

//=========================================
router.get("/products", async (req, res) => {
  try {
    const products = await Product.find().sort({ createdAt: -1 }); // optional: newest first
    res.json(products);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Error fetching products" });
  }
});


//=============================================
// routes/cart.js (or wherever your route is)
router.post("/add-to-cart", async (req, res) => {
  try {
    const { userId, productId } = req.body;

    if (!userId || !productId) {
      return res.status(400).json({ message: "userId and productId required" });
    }

    const user = await User.findById(userId).populate("cart.product");
    if (!user) return res.status(404).json({ message: "User not found" });

    // Find if product already exists in cart
    const existingItem = user.cart.find(
      (item) => item.product._id.toString() === productId.toString()
    );

    if (existingItem) {
      // Increase quantity
      existingItem.quantity += 1;
    } else {
      // Add new product with quantity 1
      user.cart.push({ product: productId, quantity: 1 });
    }

    await user.save();
    await user.populate("cart.product");

    res.json({ message: "Product added to cart", cart: user.cart });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: err.message });
  }
});

//=================================
// POST /cart/increase
router.post("/cart/increase", async (req, res) => {
  const { userId, productId } = req.body;

  if (!userId || !productId)
    return res.status(400).json({ message: "userId and productId are required" });

  try {
    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ message: "User not found" });

    // Find the cart item
    const cartItem = user.cart.find(
      (item) => item.product.toString() === productId
    );

    if (cartItem) {
      cartItem.quantity = (cartItem.quantity || 1) + 1;
    } else {
      // if product not in cart, add it with quantity 1
      user.cart.push({ product: productId, quantity: 1 });
    }

    await user.save();

    res.status(200).json({ message: "Cart updated successfully", cart: user.cart });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});


// Decrease Quantity
// POST /cart/decrease
router.post("/cart/decrease", async (req, res) => {
  const { userId, productId } = req.body;

  if (!userId || !productId)
    return res.status(400).json({ message: "userId and productId are required" });

  try {
    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ message: "User not found" });

    const cartItem = user.cart.find(
      (item) => item.product.toString() === productId
    );

    if (!cartItem) {
      return res.status(404).json({ message: "Product not in cart" });
    }

    // Decrease quantity but don't go below 1
    cartItem.quantity = Math.max(1, (cartItem.quantity || 1) - 1);

    await user.save();

    res.status(200).json({ message: "Cart updated successfully", cart: user.cart });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});
//===========================================
// POST /cart/clear
router.post("/cart/clear", async (req, res) => {
  const { userId } = req.body;

  if (!userId)
    return res.status(400).json({ message: "userId is required" });

  try {
    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ message: "User not found" });

    user.cart = []; // clear cart
    await user.save();

    res.status(200).json({ message: "Cart cleared successfully" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});
//===========================

router.post("/checkout", async (req, res) => {
  const { userId, name, email, cart, totalPrice, method } = req.body;

  try {
    // ===== Find user and clear cart =====
    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ message: "User not found" });
    user.cart = []; // Empty cart
    await user.save();

    // ===== Create PDF in memory =====
    const doc = new PDFDocument();
    const buffers = [];
    doc.on("data", (chunk) => buffers.push(chunk));
    doc.on("end", () => {
      const pdfData = Buffer.concat(buffers);

      // Respond with PDF to frontend
      res.setHeader("Content-Disposition", `attachment; filename=invoice.pdf`);
      res.setHeader("Content-Type", "application/pdf");
      res.send(pdfData);
    });

    // ===== PDF Content =====
    doc.fontSize(26).fillColor("#3b82f6").text("Saden Store", { align: "center" });
    doc.moveDown();
    doc.fontSize(20).fillColor("#000").text("Invoice / Bill", { align: "center" });
    doc.moveDown();

    doc.fontSize(14).text(`Customer Name: ${name}`);
    doc.text(`Customer Email: ${email}`);
    doc.text(`Payment Method: ${method}`);
    doc.moveDown();

    doc.fontSize(14).text("Items Purchased:");
    cart.forEach((item, index) => {
      doc.text(`${index + 1}. ${item.name} (x${item.quantity}) - $${item.price * item.quantity}`);
    });

    doc.moveDown();
    doc.fontSize(16).fillColor("red").text(`Total: $${totalPrice}`, { align: "right" });

    doc.moveDown(2);
    doc.fontSize(12).fillColor("gray").text("Thank you for shopping with Saden Store!", {
      align: "center",
    });

    doc.end(); // Finish PDF
  } catch (err) {
    console.error("Checkout failed:", err);
    res.status(500).json({ message: "Checkout failed" });
  }
});
//=============================

router.post("/contact", async (req, res) => {
  const { name, email, phone, subject, message } = req.body;

  if (!name || !email || !subject || !message) {
    return res.status(400).json({ message: "Please fill in all required fields." });
  }

  try {
    // ===== Create transporter =====
    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    });

    // ===== Email HTML Template =====
    const htmlContent = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #ddd; border-radius: 10px;">
        <div style="text-align: center; background-color: #3b82f6; color: white; padding: 20px; border-radius: 10px 10px 0 0;">
          <h1 style="margin: 0;">Saden Store</h1>
          <p style="margin: 5px 0 0;">Contact Form Submission</p>
        </div>

        <div style="padding: 20px;">
          <h2 style="color: #1f2937;">Hello Saden Store Team,</h2>
          <p>You have received a new message from your website contact form:</p>

          <table style="width: 100%; border-collapse: collapse;">
            <tr>
              <td style="padding: 8px; font-weight: bold; width: 120px;">Name:</td>
              <td style="padding: 8px;">${name}</td>
            </tr>
            <tr style="background-color: #f9fafb;">
              <td style="padding: 8px; font-weight: bold;">Email:</td>
              <td style="padding: 8px;">${email}</td>
            </tr>
            <tr>
              <td style="padding: 8px; font-weight: bold;">Phone:</td>
              <td style="padding: 8px;">${phone || "N/A"}</td>
            </tr>
            <tr style="background-color: #f9fafb;">
              <td style="padding: 8px; font-weight: bold;">Subject:</td>
              <td style="padding: 8px;">${subject}</td>
            </tr>
            <tr>
              <td style="padding: 8px; font-weight: bold;">Message:</td>
              <td style="padding: 8px;">${message}</td>
            </tr>
          </table>

          <p style="margin-top: 20px;">Please respond to the customer promptly.</p>

          <hr style="border: none; border-top: 1px solid #ddd; margin: 20px 0;" />

          <p style="text-align: center; color: #6b7280;">&copy; ${new Date().getFullYear()} Saden Store. All rights reserved.</p>
        </div>
      </div>
    `;

    // ===== Email options =====
    const mailOptions = {
      from: `"${name}" <${email}>`,
      to: process.env.EMAIL_USER,
      subject: `[Contact Form] ${subject}`,
      html: htmlContent,
    };

    await transporter.sendMail(mailOptions);

    res.status(200).json({ message: "Your message has been sent successfully!" });
  } catch (err) {
    console.error("Contact form error:", err);
    res.status(500).json({ message: "Failed to send your message. Try again later." });
  }
});


//==
module.exports = router;

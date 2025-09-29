// server.js
require('dotenv').config();
const express = require("express");
const mongoose = require("mongoose");
const { body, validationResult } = require("express-validator");
const argon2 = require("argon2");
const User = require("./models/User");
const cors = require("cors");
const app = express();
const UserRouter = require("./routes/user");
const AdminRouter=require('./routes/admin')
const ShopRouter=require('./routes/shop')
const PORT = process.env.PORT || 2000;
const MONGO_URI = process.env.MONGO_URI || "mongodb://127.0.0.1:27017/mydatabase";
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.set("view engine", "ejs");
app.set("views","views"); 


// Connect to MongoDB
mongoose.connect(MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true })
.then(() => console.log("✅ MongoDB connected"))
.catch(err => console.log("❌ MongoDB error:", err));

///////////////////login//////////////////////////////////////////
app.use("/user", UserRouter);//==================================================================================================
//==================================================================================================
//==================================================================================================
//==================================================================================================
app.use('/admin',AdminRouter)
app.use('/shop',ShopRouter)


//==================================================================================================
//==================================================================================================
//==================================================================================================

app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});

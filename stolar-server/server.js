const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const bcrypt = require('bcryptjs'); // For password security
require('dotenv').config();

const User = require('./models/User'); // Import the User Model
const Product = require('./models/Product'); // Import the Product Model

const app = express();

// Middleware
app.use(express.json());
app.use(cors());

// Database Connection
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log("✅ MongoDB Connected: Stolar POS Database"))
  .catch(err => console.log("❌ DB Connection Error:", err));

// --- AUTH ROUTES ---

// 1. SIGNUP ROUTE
app.post('/api/auth/signup', async (req, res) => {
  try {
    const { name, email, password, role } = req.body;

    // Check if user already exists
    const userExists = await User.findOne({ email });
    if (userExists) return res.status(400).json({ message: "User already registered" });

    // Hash the password (encrypt it)
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Save New User
    const newUser = new User({ name, email, password: hashedPassword, role });
    await newUser.save();

    res.status(201).json({ success: true, message: "Account created successfully" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// 2. LOGIN ROUTE (Updated with Security)
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email });
    
    if (!user) return res.status(400).json({ message: "User not found" });

    // Compare the encrypted password
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(400).json({ message: "Invalid credentials" });

    res.json({ 
      success: true, 
      role: user.role, 
      name: user.name 
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// --- PRODUCT ROUTES ---

// 3. ADD/UPDATE STOCK ROUTE
app.post('/api/products/add', async (req, res) => {
  const { name, barcode, category, price, quantity } = req.body;

  try {
    let product = await Product.findOne({ barcode });

    if (product) {
      product.stockQuantity += Number(quantity);
      product.updatedAt = Date.now();
      await product.save();
      return res.json({ success: true, message: "Stock updated", product });
    } else {
      product = new Product({ name, barcode, category, price, stockQuantity: quantity });
      await product.save();
      return res.status(201).json({ success: true, message: "New product registered", product });
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
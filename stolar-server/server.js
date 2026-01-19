const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const bcrypt = require('bcryptjs');
require('dotenv').config();

// Models
const Shop = require('./models/Shop');
const User = require('./models/User');
const Product = require('./models/Product');
const Sale = require('./models/Sale');
const LinkRequest = require('./models/LinkRequest');
const Notification = require('./models/Notification');

const app = express();

// Middleware
app.use(express.json());
app.use(cors());

// Logging Middleware
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  next();
});

// Database Connection
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log("✅ MongoDB Connected: Stolar POS Database"))
  .catch(err => console.log("❌ DB Connection Error:", err));

// --- SHOP RATES & CONFIGURATION ROUTES ---

// 0. GET DEFAULT RATES (Fixes 404 when no shopId provided)
app.get('/api/shops/rates', (req, res) => {
  res.json({ rates: { ZAR: 19.2, ZiG: 26.5 } });
});

// 1. GET CURRENT RATES FOR A SHOP (Fixes 404 GET)
app.get('/api/shops/rates/:shopId', async (req, res) => {
  console.log(`Fetching rates for shop: ${req.params.shopId}`);
  try {
    const shop = await Shop.findById(req.params.shopId);
    if (!shop) return res.status(404).json({ message: "Shop not found" });
    
    // Return saved rates or defaults if none exist
    res.json({ 
      rates: shop.rates || { ZAR: 19.2, ZiG: 26.5 } 
    });
  } catch (err) {
    console.error("Error fetching rates:", err);
    res.status(500).json({ message: "Error fetching rates: " + err.message });
  }
});

// 2. UPDATE SHOP RATES (Fixes 404 POST)
app.post('/api/shops/update-rates', async (req, res) => {
  console.log('Updating rates:', req.body);
  try {
    const { shopId, rates } = req.body;
    const shop = await Shop.findByIdAndUpdate(
      shopId,
      { 
        $set: { 
          "rates.ZAR": Number(rates.ZAR), 
          "rates.ZiG": Number(rates.ZiG),
          "rates.updatedAt": Date.now() 
        } 
      },
      { new: true }
    );

    if (!shop) return res.status(404).json({ message: "Shop not found" });
    res.json({ success: true, rates: shop.rates });
  } catch (err) {
    console.error("Update rates failed:", err);
    res.status(500).json({ message: "Update failed: " + err.message });
  }
});

// --- AUTH ROUTES ---

app.post('/api/auth/signup', async (req, res) => {
  console.log('Signup attempt:', req.body.email);
  try {
    const { name, email, password, role } = req.body;
    const userExists = await User.findOne({ email });
    if (userExists) return res.status(400).json({ message: "User already registered" });

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const newUser = new User({ name, email, password: hashedPassword, role });
    await newUser.save();
    res.status(201).json({ success: true, message: "Account created successfully" });
  } catch (err) {
    console.error("Signup error:", err);
    res.status(500).json({ message: err.message });
  }
});

app.post('/api/auth/login', async (req, res) => {
  console.log('Login attempt:', req.body.email);
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email });
    if (!user) return res.status(400).json({ message: "User not found" });

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(400).json({ message: "Invalid credentials" });

    res.json({ 
      success: true, 
      role: user.role, 
      name: user.name, 
      id: user._id,
      shopId: user.shopId 
    });
  } catch (err) {
    console.error("Login error:", err);
    res.status(500).json({ message: err.message });
  }
});

// --- USER ROUTES ---
app.get('/api/users/:id', async (req, res) => {
  console.log(`Fetching user: ${req.params.id}`);
  try {
    const user = await User.findById(req.params.id).select('-password');
    if (!user) return res.status(404).json({ message: "User not found" });
    res.json(user);
  } catch (err) {
    console.error("Error fetching user:", err);
    res.status(500).json({ message: err.message });
  }
});

// --- SHOP MANAGEMENT ---

app.get('/api/shops', async (req, res) => {
  console.log('Fetching shops with query:', req.query);
  try {
    const { managerId } = req.query;
    const query = managerId ? { manager: managerId } : {};
    const shops = await Shop.find(query);
    res.json(shops);
  } catch (err) {
    console.error("Error fetching shops:", err);
    res.status(500).json({ message: err.message });
  }
});

app.post('/api/shops/register', async (req, res) => {
  console.log('Registering shop:', req.body.name);
  try {
    const { name, location, managerId } = req.body;
    const generatedCode = `STLR-${Math.floor(1000 + Math.random() * 9000)}`;

    const newShop = new Shop({
      name,
      location,
      branchCode: generatedCode,
      manager: managerId,
      rates: { ZAR: 19.2, ZiG: 26.5 } // Initial rates
    });

    await newShop.save();
    res.status(201).json({ success: true, branchCode: generatedCode, shop: newShop });
  } catch (err) {
    console.error("Shop registration error:", err);
    res.status(500).json({ success: false, message: err.message });
  }
});

app.put('/api/shops/:id', async (req, res) => {
  console.log(`Updating shop ${req.params.id}:`, req.body);
  try {
    const { name, location, managerId } = req.body;
    const updateData = { name, location };
    if (managerId) updateData.manager = managerId;

    const shop = await Shop.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true } // Return the updated document
    );

    if (!shop) return res.status(404).json({ message: "Shop not found" });
    res.json({ success: true, shop });
  } catch (err) {
    console.error("Shop update error:", err);
    res.status(500).json({ message: err.message });
  }
});

app.delete('/api/shops/:id', async (req, res) => {
  console.log(`Deleting shop ${req.params.id}`);
  try {
    const shop = await Shop.findByIdAndDelete(req.params.id);
    if (!shop) return res.status(404).json({ message: "Shop not found" });
    res.json({ success: true, message: "Shop deleted" });
  } catch (err) {
    console.error("Shop deletion error:", err);
    res.status(500).json({ message: err.message });
  }
});

// --- PRODUCT & STOCK MANAGEMENT ---

app.get('/api/products', async (req, res) => {
  console.log('Fetching products with query:', req.query);
  try {
    const { shopId } = req.query;
    let query = {};
    if (shopId) query.shopId = shopId;

    const products = await Product.find(query).sort({ updatedAt: -1 });
    res.json(products);
  } catch (err) {
    console.error("Error fetching products:", err);
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/products/:barcode', async (req, res) => {
  console.log(`Fetching product by barcode: ${req.params.barcode}`);
  try {
    const product = await Product.findOne({ barcode: req.params.barcode });
    if (!product) return res.status(404).json({ message: "Product not found" });
    res.json(product);
  } catch (err) {
    console.error("Error fetching product:", err);
    res.status(500).json({ message: err.message });
  }
});

app.post('/api/products/add', async (req, res) => {
  console.log('Adding/Updating product:', req.body.name, req.body.barcode);
  const { name, barcode, category, price, costPrice, quantity, shopId } = req.body; 
  try {
    // Check for product in THIS specific shop
    let product = await Product.findOne({ barcode, shopId });
    const addQty = Number(quantity) || 0;

    if (product) {
      product.stockQuantity = (product.stockQuantity || 0) + addQty;
      product.price = Number(price);
      product.costPrice = Number(costPrice);
      product.shopId = shopId || product.shopId;
      await product.save();
      return res.json({ success: true, message: "Stock updated", product });
    } else {
      const newProduct = new Product({ 
        name, barcode, category, price: Number(price), 
        costPrice: Number(costPrice), stockQuantity: addQty, shopId 
      });
      await newProduct.save();
      return res.status(201).json({ success: true, message: "New product registered", product: newProduct });
    }
  } catch (err) {
    console.error("Product add/update error:", err);
    res.status(500).json({ error: err.message });
  }
});

// --- SALES & CHECKOUT ---

app.get('/api/sales/recent', async (req, res) => {
  console.log('Fetching recent sales:', req.query);
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const sales = await Sale.find()
      .sort({ date: -1 })
      .skip(skip)
      .limit(limit);

    res.json(sales);
  } catch (err) {
    console.error("Error fetching recent sales:", err);
    res.status(500).json({ message: err.message });
  }
});

app.post('/api/sales', async (req, res) => {
  console.log('Processing sale. Items:', req.body.items?.length);
  try {
    const { items, totalUSD, totalPaidLocal, currencyUsed, rateUsed, paymentMethod, date, offlineId } = req.body;

    // Duplicate check for offline syncs
    if (offlineId) {
      const existing = await Sale.findOne({ offlineId });
      if (existing) return res.json({ success: true, message: "Sale already synced" });
    }

    const newSale = new Sale({
      items,
      totalUSD,
      totalPaidLocal,
      currencyUsed,
      rateUsed,
      paymentMethod,
      date,
      offlineId
    });

    await newSale.save();

    // Deduct Stock
    for (const item of items) {
      await Product.findOneAndUpdate(
        { barcode: item.barcode },
        { $inc: { stockQuantity: -item.quantity } }
      );
    }

    res.status(201).json({ success: true, sale: newSale });
  } catch (err) {
    console.error("Sale processing error:", err);
    res.status(500).json({ message: err.message });
  }
});

// --- STAFF LINKING ---

app.get('/api/shops/requests/:id', async (req, res) => {
  console.log(`Fetching requests for: ${req.params.id}`);
  try {
    const identifier = req.params.id;
    const requests = await LinkRequest.find({
      $or: [{ shop: identifier }, { manager: identifier }],
      status: 'pending'
    })
    .populate('cashier', 'name email')
    .populate('shop', 'name location');
    res.json(requests || []);
  } catch (err) {
    console.error("Error fetching requests:", err);
    res.status(500).json([]); 
  }
});

// (Keep your other existing link request routes below...)

const PORT = process.env.PORT || 5000;
app.listen(PORT, '0.0.0.0', () => console.log(`🚀 Server running on port ${PORT}`));
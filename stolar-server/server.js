const dns = require('node:dns');
dns.setServers(['8.8.8.8', '8.8.4.4']); //
const { Paynow } = require('paynow');
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const bcrypt = require('bcryptjs');
require('dotenv').config();

console.log('Paynow INTEGRATION_ID from .env:', process.env.PAYNOW_INTEGRATION_ID);
console.log('Paynow INTEGRATION_KEY from .env:', process.env.PAYNOW_INTEGRATION_KEY);

// Models
const Shop = require('./models/Shop');
const User = require('./models/User');
const Product = require('./models/Product');
const Sale = require('./models/Sale');
const LinkRequest = require('./models/LinkRequest');
const Notification = require('./models/Notification');

const app = express();

// Paynow Configuration
const paynow = new Paynow(process.env.PAYNOW_INTEGRATION_ID, process.env.PAYNOW_INTEGRATION_KEY);
// Set result and return URLs (Replace with your actual frontend/backend URLs)
paynow.resultUrl = 'http://localhost:5000/api/subscription/callback';
paynow.returnUrl = 'http://localhost:5000/payment-success';

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

    // Set 1 Month Free Trial
    const expiryDate = new Date();
    expiryDate.setMonth(expiryDate.getMonth() + 1);

    const newUser = new User({ 
      name, email, password: hashedPassword, role,
      subscriptionStatus: 'active',
      subscriptionExpiry: expiryDate
    });
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

    // Check Subscription Status
    const now = new Date();
    const expiry = user.subscriptionExpiry ? new Date(user.subscriptionExpiry) : new Date();
    // If expiry is in the past, they are expired
    const isExpired = expiry < now;

    res.json({ 
      success: true, 
      role: user.role, 
      name: user.name, 
      id: user._id,
      shopId: user.shopId,
      subscriptionExpired: isExpired,
      subscriptionExpiry: user.subscriptionExpiry
    });
  } catch (err) {
    console.error("Login error:", err);
    res.status(500).json({ message: err.message });
  }
});

app.post('/api/auth/verify-manager', async (req, res) => {
  console.log('Verifying manager password for cashier:', req.body.cashierId);
  try {
    const { cashierId, password } = req.body;
    const cashier = await User.findById(cashierId);
    if (!cashier) return res.status(404).json({ message: "User not found" });

    let manager;
    // If the user is already a manager or admin, verify their own password
    if (cashier.role === 'manager' || cashier.role === 'admin') {
      manager = cashier;
    } else {
      // If cashier, find their shop's manager
      if (!cashier.shopId) return res.status(400).json({ message: "You are not linked to a shop." });
      const shop = await Shop.findById(cashier.shopId);
      if (!shop) return res.status(404).json({ message: "Shop not found" });
      manager = await User.findById(shop.manager);
    }

    if (!manager) return res.status(404).json({ message: "Manager account not found" });

    const isMatch = await bcrypt.compare(password, manager.password);
    if (!isMatch) return res.status(400).json({ message: "Incorrect Password" });

    res.json({ success: true });
  } catch (err) {
    console.error("Password verification error:", err);
    res.status(500).json({ message: "Server error" });
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

app.get('/api/sales', async (req, res) => {
  console.log('Fetching sales history with filters:', req.query);
  try {
    const { shopId, cashierId } = req.query;
    let query = {};
    if (shopId) query.shopId = shopId;
    if (cashierId) query.cashierId = cashierId;

    const sales = await Sale.find(query).sort({ date: -1 });
    res.json(sales);
  } catch (err) {
    console.error("Error fetching all sales:", err);
    res.status(500).json({ message: err.message });
  }
});

app.get('/api/sales/recent', async (req, res) => {
  console.log('Fetching recent sales:', req.query);
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;
    const { refunded, startDate, endDate, shopId } = req.query;

    let query = {};
    if (shopId) query.shopId = shopId;
    if (refunded === 'true') query.refunded = true;
    if (startDate && endDate) {
      query.date = { $gte: startDate, $lte: endDate };
    }

    const sales = await Sale.find(query)
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
    const { items, totalUSD, totalPaidLocal, currencyUsed, rateUsed, paymentMethod, date, offlineId, shopId, cashierId } = req.body;

    // Duplicate check for offline syncs
    if (offlineId) {
      const existing = await Sale.findOne({ offlineId });
      if (existing) return res.json({ success: true, message: "Sale already synced" });
    }

    const newSale = new Sale({
      items,
      // Map totalUSD from req.body to the "total" field your schema requires
      total: totalUSD, 
      totalUSD,
      totalPaidLocal,
      currencyUsed,
      rateUsed,
      paymentMethod,
      date,
      offlineId,
      shopId,
      cashierId
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

app.post('/api/sales/:id/refund', async (req, res) => { 
  console.log(`Processing refund for sale: ${req.params.id}`);
  try {
    const { reason } = req.body;
    const sale = await Sale.findById(req.params.id);
    if (!sale) return res.status(404).json({ message: "Sale not found" });
    if (sale.refunded) return res.status(400).json({ message: "Sale already refunded" });

    // Restore Stock
    for (const item of sale.items) {
      await Product.findOneAndUpdate(
        { barcode: item.barcode },
        { $inc: { stockQuantity: item.quantity } }
      );
    }

    sale.refunded = true;
    if (reason) sale.refundReason = reason;
    await sale.save();

    res.json({ success: true, message: "Refund processed successfully" });
  } catch (err) {
    console.error("Refund error:", err);
    res.status(500).json({ message: err.message });
  }
});

// --- SUBSCRIPTION & PAYMENTS ---

// 1. Initiate Payment (Paynow)
app.post('/api/subscription/pay', async (req, res) => {
  const { email, amount, userId } = req.body; // Amount usually in USD
  console.log(`Initiating payment for ${email}`);
  console.log('Using Paynow INTEGRATION_ID:', process.env.PAYNOW_INTEGRATION_ID);
  console.log('Using Paynow INTEGRATION_KEY:', process.env.PAYNOW_INTEGRATION_KEY);

  try {
    const payment = paynow.createPayment(`Subscription-${userId}-${Date.now()}`, email);
    payment.add('Monthly Subscription', amount || 10); // Default $10 if not sent

    const response = await paynow.send(payment);

    if (response.success) {
      res.json({ 
        success: true, 
        redirectUrl: response.redirectUrl, 
        pollUrl: response.pollUrl 
      });
    } else {
      res.status(400).json({ success: false, message: "Paynow failed to initiate" });
    }
  } catch (err) {
    console.error("Payment init error:", err);
    res.status(500).json({ message: err.message });
  }
});

// 2. Check Payment Status (Frontend polls this)
app.post('/api/subscription/check-status', async (req, res) => {
  const { pollUrl, userId } = req.body;
  try {
    const status = await paynow.pollTransaction(pollUrl);
    console.log("Payment Status:", status.status);

    if (status.status === 'paid' || status.status === 'awaiting delivery') {
      // Extend Subscription by 1 Month
      const user = await User.findById(userId);
      if (!user) return res.status(404).json({ message: "User not found" });

      const currentExpiry = user.subscriptionExpiry && new Date(user.subscriptionExpiry) > new Date() 
        ? new Date(user.subscriptionExpiry) 
        : new Date();
      
      currentExpiry.setMonth(currentExpiry.getMonth() + 1);
      
      user.subscriptionExpiry = currentExpiry;
      user.subscriptionStatus = 'active';
      await user.save();

      return res.json({ success: true, status: 'paid', newExpiry: currentExpiry });
    }

    res.json({ success: true, status: status.status });
  } catch (err) {
    console.error("Poll error:", err);
    res.status(500).json({ message: err.message });
  }
});

// 3. Admin Manual Activation (Cash Payment)
app.post('/api/admin/activate-user', async (req, res) => {
  const { userId, months } = req.body; // months to add
  console.log(`Admin activating user ${userId} for ${months} months`);
  
  try {
    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ message: "User not found" });

    // If currently valid, add to existing expiry. If expired, start from now.
    const currentExpiry = user.subscriptionExpiry && new Date(user.subscriptionExpiry) > new Date() 
        ? new Date(user.subscriptionExpiry) 
        : new Date();

    currentExpiry.setMonth(currentExpiry.getMonth() + (parseInt(months) || 1));
    
    user.subscriptionExpiry = currentExpiry;
    user.subscriptionStatus = 'active';
    await user.save();

    res.json({ success: true, message: "User activated successfully", newExpiry: currentExpiry });
  } catch (err) {
    console.error("Admin activation error:", err);
    res.status(500).json({ message: err.message });
  }
});

// --- TEST ROUTES (FOR DEVELOPMENT) ---

app.post('/api/test/expire-managers', async (req, res) => {
  console.log("TEST: Expiring all managers...");
  try {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    
    const result = await User.updateMany(
      { role: 'manager' },
      { $set: { subscriptionStatus: 'expired', subscriptionExpiry: yesterday } }
    );
    
    res.json({ success: true, message: `Updated ${result.modifiedCount} managers to expired status.` });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

app.post('/api/test/migrate-sales-shopid', async (req, res) => {
  console.log("MIGRATION: Force linking orphaned sales...");
  try {
    const { userId } = req.body;
    
    // If a specific user triggered this, we link orphaned sales to THEIR shop
    if (userId) {
      const user = await User.findById(userId);
      if (!user || !user.shopId) {
        return res.status(400).json({ message: "User not found or not linked to a shop." });
      }

      console.log(`Linking orphaned sales to User: ${user.name}, Shop: ${user.shopId}`);

      // Update ALL sales that have NO shopId
      const result = await Sale.updateMany(
        { 
          $or: [{ shopId: { $exists: false } }, { shopId: null }, { shopId: "" }] 
        },
        { 
          $set: { 
            shopId: user.shopId,
            cashierId: user._id // Also claim ownership so they show in "My Sales"
          } 
        }
      );

      const count = result.modifiedCount || result.nModified || 0;
      console.log(`MIGRATION DONE: Claimed ${count} sales.`);
      return res.json({ success: true, message: `Success! Claimed ${count} old sales.` });
    } 
    
    res.status(400).json({ message: "No userId provided for migration." });
  } catch (err) {
    console.error("Migration error:", err);
    res.status(500).json({ message: err.message });
  }
});

app.get('/api/test/verify-migration', async (req, res) => {
  try {
    const total = await Sale.countDocuments();
    const withShopId = await Sale.countDocuments({ shopId: { $exists: true, $ne: null } });
    const withoutShopId = await Sale.countDocuments({ $or: [{ shopId: { $exists: false } }, { shopId: null }] });
    
    res.json({
      message: "Migration Verification Status",
      totalSales: total,
      migrated: withShopId,
      pending: withoutShopId,
      success: withoutShopId === 0
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
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

// Add this to your server code
app.post('/api/shops/requests', async (req, res) => {
  console.log('New join request:', req.body);
  try {
    const { branchCode, cashierId } = req.body;

    // 1. Find the shop by branch code
    const shop = await Shop.findOne({ branchCode });
    if (!shop) {
      return res.status(404).json({ message: "Invalid branch code. Shop not found." });
    }

    // 2. Check if a pending request already exists
    const existingRequest = await LinkRequest.findOne({ 
      cashier: cashierId, 
      status: 'pending' 
    });
    
    if (existingRequest) {
      return res.status(400).json({ message: "You already have a pending request." });
    }

    // 3. Create the request
    const newRequest = new LinkRequest({
      shop: shop._id,
      cashier: cashierId,
      manager: shop.manager, // The manager associated with that shop
      status: 'pending'
    });

    await newRequest.save();
    res.status(201).json({ success: true, message: "Request sent to manager." });

  } catch (err) {
    console.error("Join request error:", err);
    res.status(500).json({ message: "Server error: " + err.message });
  }
});

// (Keep your other existing link request routes below...)

const PORT = process.env.PORT || 5000;
app.listen(PORT, '0.0.0.0', () => console.log(`🚀 Server running on port ${PORT}`));
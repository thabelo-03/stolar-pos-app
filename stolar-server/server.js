 const dns = require('node:dns');
dns.setServers(['8.8.8.8', '8.8.4.4']); //
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
const ActionLog = require('./models/ActionLog');
const PaymentHistory = require('./models/PaymentHistory');

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
  .then(async () => {
    console.log("✅ MongoDB Connected: Stolar POS Database");
    
    // FIX: Ensure barcode uniqueness is scoped to shopId, not global
    try {
      const db = mongoose.connection.db;
      const products = db.collection('products');
      const indexes = await products.indexes();
      
      // Look for the problematic index: unique on 'barcode' only
      const globalBarcodeIndex = indexes.find(idx => idx.key.barcode === 1 && Object.keys(idx.key).length === 1 && idx.unique === true);

      if (globalBarcodeIndex) {
        console.log("⚠️ Detected global unique index on 'barcode'. Fixing...");
        await products.dropIndex(globalBarcodeIndex.name);
        console.log("✅ Dropped global index. Creating compound index { barcode: 1, shopId: 1 }...");
        await products.createIndex({ barcode: 1, shopId: 1 }, { unique: true });
        console.log("✅ Database indexes updated successfully.");
      }
    } catch (e) {
      console.log("ℹ️ Index check skipped or failed:", e.message);
    }
  })
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

    // Check if user is blocked
    if (user.status === 'blocked') {
      return res.status(403).json({ message: "Your account has been blocked. Please contact the administrator." });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(400).json({ message: "Invalid credentials" });

    // Check Subscription Status
    const now = new Date();
    const expiry = user.subscriptionExpiry ? new Date(user.subscriptionExpiry) : new Date();
    // If expiry is in the past, they are expired
    const isExpired = expiry < now;

    const shopCount = await Shop.countDocuments({ manager: user._id });

    res.json({ 
      success: true, 
      role: user.role, 
      name: user.name, 
      id: user._id,
      shopId: user.shopId,
      subscriptionExpired: isExpired,
      subscriptionExpiry: user.subscriptionExpiry,
      shopCount,
      nextBillingAmount: shopCount >= 2 ? 400 : 150
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

app.get('/api/users', async (req, res) => {
  console.log('Fetching all users for admin');
  try {
    const users = await User.find().select('-password').sort({ createdAt: -1 }).lean();
    
    // Enrich users with shop count for Admin UI flagging
    const usersWithCounts = await Promise.all(users.map(async (user) => {
      const count = await Shop.countDocuments({ manager: user._id });
      return { ...user, shopCount: count };
    }));

    res.json(usersWithCounts);
  } catch (err) {
    console.error("Error fetching users:", err);
    res.status(500).json({ message: err.message });
  }
});

// New endpoint to fetch users who made cash payments
// NOTE: This must be defined BEFORE /api/users/:id to avoid conflict
app.get('/api/users/cash-payers', async (req, res) => {
  console.log('Fetching users who made cash payments');
  try {
    // 1. Find unique managerIds from PaymentHistory where paymentMethod is cash
    const managerIds = await PaymentHistory.find({ paymentMethod: 'cash' }).distinct('managerId');

    // 2. Fetch the corresponding User documents
    const cashPayers = await User.find({ _id: { $in: managerIds } }).select('-password');

    res.json(cashPayers);
  } catch (err) {
    console.error("Error fetching cash payers:", err);
    res.status(500).json({ message: err.message });
  }
});

app.get('/api/users/:id', async (req, res) => {
  console.log(`Fetching user: ${req.params.id}`);
  try {
    const user = await User.findById(req.params.id).select('-password').lean();
    if (!user) return res.status(404).json({ message: "User not found" });
    
    // Calculate Plan Details dynamically
    const shopCount = await Shop.countDocuments({ manager: user._id });
    user.shopCount = shopCount;
    user.nextBillingAmount = shopCount >= 2 ? 400 : 150;
    user.planType = shopCount >= 2 ? 'Premium' : 'Standard';

    res.json(user);
  } catch (err) {
    console.error("Error fetching user:", err);
    res.status(500).json({ message: err.message });
  }
});

// New endpoint to toggle user status (Block/Unblock)
app.patch('/api/users/:id/status', async (req, res) => {
  console.log(`Updating status for user ${req.params.id} to ${req.body.status}`);
  try {
    const { status } = req.body;
    const user = await User.findByIdAndUpdate(req.params.id, { status }, { new: true });
    if (!user) return res.status(404).json({ message: "User not found" });
    res.json({ success: true, user });
  } catch (err) {
    console.error("Status update error:", err);
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

app.get('/api/shops/:id', async (req, res) => {
  console.log(`Fetching shop details: ${req.params.id}`);
  try {
    // Fetch raw shop first to get the manager ID even if user doesn't exist
    let shop = await Shop.findById(req.params.id).lean();
    if (!shop) return res.status(404).json({ message: "Shop not found" });

    // Manually fetch manager details to handle broken references gracefully
    if (shop.manager) {
      const manager = await User.findById(shop.manager).select('name email subscriptionStatus subscriptionExpiry').lean();
      if (manager) {
        shop.manager = manager;
      } else {
        shop.manager = { name: 'Unknown (User Deleted)', email: 'N/A' };
      }
    }

    res.json(shop);
  } catch (err) {
    console.error("Error fetching shop:", err);
    res.status(500).json({ message: err.message });
  }
});

app.post('/api/shops/register', async (req, res) => {
  console.log('Registering shop:', req.body.name);
  try {
    const { name, location, managerId, confirmPremium } = req.body;

    // Premium Plan Check: Warn before adding 2nd shop
    const existingShops = await Shop.countDocuments({ manager: managerId });
    if (existingShops >= 1 && !confirmPremium) {
      return res.status(409).json({ 
        success: false,
        requiresConfirmation: true,
        message: "Adding a second shop upgrades your subscription to the Premium Plan (R400/month). Do you want to proceed?"
      });
    }

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

app.get('/api/logs', async (req, res) => {
  console.log('Fetching action logs:', req.query);
  try {
    const { shopId } = req.query;
    const query = shopId ? { shopId } : {};
    const logs = await ActionLog.find(query).sort({ timestamp: -1 }).limit(50);
    res.json(logs);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

app.get('/api/logs/product/:id', async (req, res) => {
  try {
    const logs = await ActionLog.find({ relatedId: req.params.id })
      .sort({ timestamp: -1 })
      .limit(50);
    res.json(logs);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

app.post('/api/products/:id/restore', async (req, res) => {
  console.log(`Restoring product ${req.params.id} from log ${req.body.logId}`);
  try {
    const { logId, userId } = req.body;
    const log = await ActionLog.findById(logId);
    
    if (!log || !log.previousState) {
      return res.status(400).json({ message: "No restore point found for this action." });
    }

    const { name, price, costPrice, stockQuantity, category, barcode } = log.previousState;
    
    const product = await Product.findByIdAndUpdate(req.params.id, {
      name, price, costPrice, stockQuantity, category, barcode
    }, { new: true });

    // Log the restore action itself
    if (userId) {
      const user = await User.findById(userId);
      await new ActionLog({
        action: 'RESTORE_STOCK',
        details: `Restored to state from ${new Date(log.timestamp).toLocaleString()}`,
        userId,
        userName: user ? user.name : 'Unknown',
        shopId: product.shopId,
        relatedId: product._id
      }).save();
    }

    res.json({ success: true, message: "Product restored successfully", product });
  } catch (err) {
    console.error("Restore error:", err);
    res.status(500).json({ message: err.message });
  }
});

app.post('/api/products/add', async (req, res) => {
  console.log('Adding/Updating product:', req.body.name, req.body.barcode);
  const { name, barcode, category, price, costPrice, quantity, shopId, userId } = req.body; 
  try {
    // Check for product in THIS specific shop
    let product = await Product.findOne({ barcode, shopId });
    const addQty = Number(quantity) || 0;

    if (product) {
      const previousState = product.toObject(); // Capture state before update
      product.stockQuantity = (product.stockQuantity || 0) + addQty;
      
      // Only update price/cost if provided (prevents overwriting with 0/NaN on partial updates)
      if (price !== undefined && price !== null && price !== '') product.price = Number(price);
      if (costPrice !== undefined && costPrice !== null && costPrice !== '') product.costPrice = Number(costPrice);
      
      // Allow updating details
      if (name) product.name = name;
      if (category) product.category = category;

      console.log(`[DEBUG] Updating ${product.name}: Price=${product.price}, Cost=${product.costPrice}`);
      product.shopId = shopId || product.shopId;
      await product.save();

      if (userId) {
        const user = await User.findById(userId);
        await new ActionLog({
          action: 'UPDATE_STOCK',
          details: `Updated ${name}: +${addQty} units`,
          userId,
          userName: user ? user.name : 'Unknown',
          shopId: product.shopId,
          relatedId: product._id,
          previousState
        }).save();
      }

      return res.json({ success: true, message: "Stock updated", product });
    } else {
      const newProduct = new Product({ 
        name, barcode, category, price: Number(price) || 0, 
        costPrice: Number(costPrice) || 0, stockQuantity: addQty, shopId
      });
      console.log(`[DEBUG] Creating ${name}: Price=${newProduct.price}, Cost=${newProduct.costPrice}`);
      await newProduct.save();

      if (userId) {
        const user = await User.findById(userId);
        await new ActionLog({
          action: 'ADD_PRODUCT',
          details: `Added new product: ${name} (${addQty} units)`,
          userId,
          userName: user ? user.name : 'Unknown',
          shopId,
          relatedId: newProduct._id
        }).save();
      }

      return res.status(201).json({ success: true, message: "New product registered", product: newProduct });
    }
  } catch (err) {
    console.error("Product add/update error:", err);
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/products/transfer', async (req, res) => {
  console.log('Transferring stock:', req.body);
  const { sourceShopId, targetShopId, productId, quantity, userId } = req.body;

  try {
    const qty = Number(quantity);
    if (qty <= 0) return res.status(400).json({ message: "Invalid quantity" });

    const sourceProduct = await Product.findOne({ _id: productId, shopId: sourceShopId });
    if (!sourceProduct) return res.status(404).json({ message: "Source product not found" });

    if ((sourceProduct.stockQuantity || 0) < qty) {
      return res.status(400).json({ message: `Insufficient stock. Available: ${sourceProduct.stockQuantity}` });
    }

    // Find or create target product
    let targetProduct = await Product.findOne({ barcode: sourceProduct.barcode, shopId: targetShopId });

    if (targetProduct) {
      targetProduct.stockQuantity = (targetProduct.stockQuantity || 0) + qty;
      // We don't overwrite price/cost to respect target shop's pricing strategies
      await targetProduct.save();
    } else {
      // Create new product in target shop if it doesn't exist
      const productData = sourceProduct.toObject();
      delete productData._id;
      delete productData.createdAt;
      delete productData.updatedAt;
      delete productData.__v;
      
      targetProduct = new Product({
        ...productData,
        shopId: targetShopId,
        stockQuantity: qty
      });
      await targetProduct.save();
    }

    // Deduct from source
    sourceProduct.stockQuantity -= qty;
    await sourceProduct.save();

    // Log action
    if (userId) {
      const user = await User.findById(userId);
      const sourceShop = await Shop.findById(sourceShopId);
      const targetShop = await Shop.findById(targetShopId);
      
      await new ActionLog({
        action: 'TRANSFER_STOCK',
        details: `Transferred ${qty} x ${sourceProduct.name} from ${sourceShop?.name} to ${targetShop?.name}`,
        userId,
        userName: user ? user.name : 'Unknown',
        shopId: sourceShopId,
        relatedId: sourceProduct._id
      }).save();
    }

    res.json({ success: true, message: "Stock transferred successfully" });
  } catch (err) {
    console.error("Transfer error:", err);
    if (err.code === 11000) {
      return res.status(409).json({ message: "System Error: Barcode index conflict. Please restart the server to auto-fix database indexes." });
    }
    res.status(500).json({ message: err.message });
  }
});

app.post('/api/products/batch-update', async (req, res) => {
  console.log('Batch updating products:', req.body.updates?.length);
  const { updates, userId, shopId } = req.body; // updates: [{ id, costPrice }]
  try {
    if (!Array.isArray(updates) || updates.length === 0) {
      return res.status(400).json({ message: "No updates provided" });
    }

    const operations = updates.map(u => ({
      updateOne: {
        filter: { _id: u.id },
        update: { $set: { costPrice: Number(u.costPrice) } }
      }
    }));

    const result = await Product.bulkWrite(operations);
    
    // Log the action
    if (userId) {
      const user = await User.findById(userId);
      await new ActionLog({
        action: 'BULK_UPDATE',
        details: `Bulk updated cost price for ${updates.length} items`,
        userId,
        userName: user ? user.name : 'Unknown',
        shopId: shopId || null
      }).save();
    }

    res.json({ success: true, message: `Updated ${result.modifiedCount} items` });
  } catch (err) {
    console.error("Batch update error:", err);
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/products/:id', async (req, res) => {
  console.log(`Updating product ${req.params.id}:`, req.body);
  try {
    const { name, barcode, category, price, costPrice, quantity, shopId, userId } = req.body;
    
    const updateData = {
      name,
      barcode,
      category,
      price: Number(price),
      costPrice: Number(costPrice),
      stockQuantity: Number(quantity)
    };
    if (shopId) updateData.shopId = shopId;

    // Fetch original first to capture state
    const originalProduct = await Product.findById(req.params.id);
    const previousState = originalProduct ? originalProduct.toObject() : null;

    const product = await Product.findByIdAndUpdate(req.params.id, updateData, { new: true });
    if (!product) return res.status(404).json({ message: "Product not found" });

    // Log action
    if (userId) {
      const user = await User.findById(userId);
      await new ActionLog({
        action: 'UPDATE_STOCK',
        details: `Edited ${name}: Qty ${quantity}, Price $${price}`,
        userId,
        userName: user ? user.name : 'Unknown',
        shopId: product.shopId,
        relatedId: product._id,
        previousState
      }).save();
    }

    res.json({ success: true, product });
  } catch (err) {
    console.error("Product update error:", err);
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/products/:id', async (req, res) => {
  console.log(`Deleting product ${req.params.id}`);
  try {
    const product = await Product.findByIdAndDelete(req.params.id);
    if (!product) return res.status(404).json({ message: "Product not found" });
    res.json({ success: true, message: "Product deleted" });
  } catch (err) {
    console.error("Product deletion error:", err);
    res.status(500).json({ error: err.message });
  }
});

// --- SALES & CHECKOUT ---

app.get('/api/sales/stats', async (req, res) => {
  console.log('Fetching sales stats:', req.query);
  try {
    const { shopId, date } = req.query;
    if (!shopId) return res.status(400).json({ message: "Shop ID required" });

    const targetDate = date ? new Date(date) : new Date();
    const start = new Date(targetDate); start.setHours(0,0,0,0);
    const end = new Date(targetDate); end.setHours(23,59,59,999);

    let matchQuery = {
      date: { $gte: start, $lte: end },
      refunded: { $ne: true }
    };

    if (mongoose.Types.ObjectId.isValid(shopId)) {
      matchQuery.shopId = new mongoose.Types.ObjectId(shopId);
    } else {
      matchQuery.shopId = shopId; // Fallback for string IDs
    }

    const stats = await Sale.aggregate([
      { $match: matchQuery },
      {
        $group: {
          _id: null,
          totalRevenue: { $sum: { $ifNull: ["$totalUSD", "$total"] } },
          totalOrders: { $sum: 1 }
        }
      }
    ]);

    const result = stats.length > 0 ? stats[0] : { totalRevenue: 0, totalOrders: 0 };

    res.json({
      revenue: result.totalRevenue,
      orders: result.totalOrders
    });
  } catch (err) {
    console.error("Stats error:", err);
    res.status(500).json({ message: err.message });
  }
});

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
    const { refunded, startDate, endDate, shopId, cashierId } = req.query;

    let query = {};
    if (shopId) query.shopId = shopId;
    if (cashierId) query.cashierId = cashierId;
    if (refunded === 'true') query.refunded = true;
    if (startDate && endDate) {
      query.date = { $gte: startDate, $lte: endDate };
    }

    const sales = await Sale.find(query)
      .sort({ date: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    console.log(`[DEBUG] Found ${sales.length} sales. Checking for missing costs...`);

    // Optimization: Pre-fetch product costs for items missing costPrice
    const missingCostBarcodes = new Set();
    sales.forEach(s => s.items?.forEach(i => {
      if (i.costPrice === undefined || i.costPrice === null) missingCostBarcodes.add(i.barcode);
    }));

    let productCostMap = {};
    if (missingCostBarcodes.size > 0) {
      const products = await Product.find({ 
        barcode: { $in: Array.from(missingCostBarcodes) } 
      }).select('barcode shopId costPrice').lean();
      
      products.forEach(p => {
        // Create a key combining barcode and shopId to ensure correct cost per shop
        // Ensure shopId is string for consistent keys
        productCostMap[`${p.barcode}_${String(p.shopId)}`] = p.costPrice;
        
        // Fallback: Store by barcode alone (uses the last one found if duplicates exist)
        if (productCostMap[p.barcode] === undefined) {
          productCostMap[p.barcode] = p.costPrice;
        }
      });
    }

    // Attach cashier names and backfill costPrice
    const salesWithNames = await Promise.all(sales.map(async (sale) => {
      // 1. Attach Cashier Name
      if (sale.cashierId) {
        try {
          const cashier = await User.findById(sale.cashierId).select('name');
          sale.cashierName = cashier ? cashier.name : 'Unknown';
        } catch (e) { sale.cashierName = 'Unknown'; }
      }

      // 2. Backfill Cost Price if missing (Fixes 0.00 COGS on profit report)
      if (sale.items && Array.isArray(sale.items)) {
        sale.items.forEach(item => {
          if (!item.costPrice || item.costPrice === 0) {
            const key = `${item.barcode}_${String(sale.shopId)}`;
            // Check specific shop first, fallback to just barcode if needed
            if (productCostMap[key] !== undefined) {
              console.log(`[DEBUG] Backfilling cost for ${item.name}: ${productCostMap[key]}`);
              item.costPrice = productCostMap[key];
            } else if (productCostMap[item.barcode] !== undefined) {
              // Fallback to barcode-only match
              console.log(`[DEBUG] Using fallback cost for ${item.name}: ${productCostMap[item.barcode]}`);
              item.costPrice = productCostMap[item.barcode];
            } else {
              console.log(`[DEBUG] No cost found for ${item.name} (Barcode: ${item.barcode}, Shop: ${sale.shopId})`);
            }
          }
        });
      }

      return sale;
    }));

    res.json(salesWithNames);
  } catch (err) {
    console.error("Error fetching recent sales:", err);
    res.status(500).json({ message: err.message });
  }
});

app.post('/api/sales', async (req, res) => {
  console.log('Processing sale. Items:', req.body.items?.length);
 
  try {
    const { items, totalUSD, totalPaidLocal, currencyUsed, rateUsed, paymentMethod, date, offlineId, shopId, cashierId, tenderedAmount, change } = req.body;

    // Enrich items with costPrice from database if missing (Crucial for Profit/Loss)
    const enrichedItems = await Promise.all(items.map(async (item) => {
      if (item.costPrice === undefined || item.costPrice === null) {
        const product = await Product.findOne({ barcode: item.barcode, shopId });
        if (product) {
          return { ...item, costPrice: product.costPrice };
        }
      }
      return item;
    }));

    // Duplicate check for offline syncs
    if (offlineId) {
      const existing = await Sale.findOne({ offlineId });
      if (existing) return res.json({ success: true, message: "Sale already synced" });
    }

    const newSale = new Sale({
      items: enrichedItems,
      // Map totalUSD from req.body to the "total" field your schema requires
      total: totalUSD, 
      totalUSD,
      totalPaidLocal,
      currencyUsed,
      rateUsed,
      tenderedAmount,
      change,
      paymentMethod,
      date,
      offlineId,
      shopId,
      cashierId,
      userId: cashierId // Map cashierId to userId for Schema validation
    });

    await newSale.save();

    // Deduct Stock
    for (const item of items) {
      await Product.findOneAndUpdate(
        { barcode: item.barcode },
        { $inc: { stockQuantity: -item.quantity } }
      );
    }

    // Notify Manager
    if (shopId) {
      try {
        const shop = await Shop.findById(shopId);
        if (shop && shop.manager) {
          const cashier = await User.findById(cashierId);
          const cashierName = cashier ? cashier.name : 'Cashier';
          
          await new Notification({
            recipient: shop.manager,
            sender: cashierId,
            type: 'system',
            message: `New Sale: $${Number(totalUSD).toFixed(2)} by ${cashierName}`,
            relatedId: newSale._id
          }).save();
        }
      } catch (notifErr) {
        console.error("Notification error:", notifErr);
      }
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

// 3. Admin Manual Activation (Cash Payment)
app.post('/api/admin/activate-user', async (req, res) => {
  const { userId, months, managerName, managerEmail, amount, paymentMethod, isSeed, planType } = req.body; 
  console.log(`Admin activating user ${userId} for ${months} months. Amount: ${amount}`);
  
  try {
    // Self-healing: Check for schema violation using native driver before Mongoose throws
    // This handles cases where shopId is "main_branch" (string) instead of ObjectId
    try {
      if (userId && mongoose.Types.ObjectId.isValid(userId)) {
        const _id = new mongoose.Types.ObjectId(userId);
        const rawUser = await User.collection.findOne({ _id });
        if (rawUser && rawUser.shopId === 'main_branch') {
          console.log(`Auto-fixing invalid shopId for user ${userId}`);
          await User.collection.updateOne({ _id }, { $set: { shopId: null } });
        }
      }
    } catch (preCheckErr) {
      console.warn("Pre-fetch check failed:", preCheckErr.message);
    }

    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ message: "User not found" });

    // Determine Rate: Allow manual override via planType, otherwise auto-detect
    let monthlyRate = 150;
    const shopCount = await Shop.countDocuments({ manager: userId });

    if (planType === 'premium') monthlyRate = 400;
    else if (planType === 'standard') monthlyRate = 150;
    else monthlyRate = shopCount >= 2 ? 400 : 150; // Auto-detect

    const finalPlanType = monthlyRate === 400 ? 'Premium' : 'Standard';

    // If currently valid, add to existing expiry. If expired, start from now.
    const currentExpiry = user.subscriptionExpiry && new Date(user.subscriptionExpiry) > new Date() 
        ? new Date(user.subscriptionExpiry) 
        : new Date();

    currentExpiry.setMonth(currentExpiry.getMonth() + (parseInt(months) || 1));
    
    user.subscriptionExpiry = currentExpiry;
    user.subscriptionStatus = 'active';
    await user.save();

    // --- RECORD PAYMENT HISTORY ---
    let historySaved = false;
    try {
      const historyData = {
        managerId: user._id,
        managerName: managerName || user.name,
        managerEmail: managerEmail || user.email,
        amount: (amount && Number(amount) > 0) ? Number(amount) : ((parseInt(months) || 1) * monthlyRate),
        months: parseInt(months) || 1,
        paymentMethod: paymentMethod || 'cash',
        isSeed: !!isSeed,
        details: `Manual Activation - ${finalPlanType} Plan` // Store plan details in history
      };
      
      console.log("Attempting to save history:", historyData);

      const history = new PaymentHistory(historyData);
      await history.save();
      historySaved = true;
      console.log("✅ Payment history recorded successfully.");
    } catch (histErr) {
      console.error("❌ Failed to save payment history:", histErr);
    }
    // ------------------------------

    res.json({ success: true, message: `User activated on ${finalPlanType} Plan`, newExpiry: currentExpiry, historySaved, planType: finalPlanType });
  } catch (err) {
    console.error("Admin activation error:", err);
    res.status(500).json({ message: err.message });
  }
});

app.get('/api/admin/payment-history', async (req, res) => {
  console.log('🔍 Fetching payment history. Query Params:', req.query);
  try {
    const { startDate, endDate } = req.query;
    let query = {};

    // Only apply date filter if valid dates are provided
    if (startDate && startDate !== 'undefined' || endDate && endDate !== 'undefined') {
      query.date = {};
      if (startDate) query.date.$gte = new Date(startDate);
      if (endDate) query.date.$lte = new Date(endDate);
      console.log('📅 Date filter applied:', query.date);
    }

    // Use .lean() to allow modification of the result objects
    let history = await PaymentHistory.find(query).sort({ date: -1 }).limit(100).lean();
    console.log(`✅ Found ${history.length} payment records.`);
    
    // Manually populate manager details if missing (for older records)
    history = await Promise.all(history.map(async (item) => {
      if (!item.managerName && item.managerId) {
        const user = await User.findById(item.managerId).select('name email');
        if (user) {
          item.managerName = user.name;
          item.managerEmail = user.email;
        }
      }
      return item;
    }));
    
    // Calculate total based on the filter (or all if no filter)
    const agg = await PaymentHistory.aggregate([
      { $match: query },
      { $group: { _id: null, total: { $sum: "$amount" } } }
    ]);
    
    const totalAmount = agg.length ? agg[0].total : 0;

    res.json({ history, totalAmount });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

app.delete('/api/admin/payment-history/:id', async (req, res) => {
  console.log(`Deleting payment history record: ${req.params.id}`);
  try {
    const { reason, adminName } = req.body;
    const payment = await PaymentHistory.findById(req.params.id);
    if (!payment) return res.status(404).json({ message: "Payment record not found" });

    // Log to ActionLog for justification/audit
    await new ActionLog({
      action: 'DELETE_PAYMENT',
      details: `Deleted payment: $${payment.amount} for ${payment.managerName} (${payment.managerEmail}). Reason: ${reason || 'None'}`,
      userName: adminName || 'Admin',
      shopId: null
    }).save();

    await PaymentHistory.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: "Payment deleted and logged." });
  } catch (err) {
    console.error("Delete payment error:", err);
    res.status(500).json({ message: err.message });
  }
});

app.get('/api/admin/payment-history/deleted', async (req, res) => {
  try {
    const logs = await ActionLog.find({ action: 'DELETE_PAYMENT' }).sort({ timestamp: -1 }).limit(50);
    res.json(logs);
  } catch (err) {
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

app.post('/api/test/fix-users', async (req, res) => {
  console.log("Fixing user schema issues...");
  try {
    // Use native MongoDB driver to bypass Mongoose schema validation
    // This removes the invalid "main_branch" string from shopId
    const result = await User.collection.updateMany(
      { shopId: "main_branch" },
      { $set: { shopId: null } }
    );
    res.json({ success: true, message: `Fixed ${result.modifiedCount} users with invalid shopId.` });
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
            shopId: user.shopId.toString(),
            cashierId: user._id.toString() // Ensure stored as String to match Schema
          } 
        }
      );

      // Backfill totalUSD for old sales (using 'total' value)
      try {
        await Sale.updateMany(
          { totalUSD: { $exists: false } },
          [{ $set: { totalUSD: "$total" } }]
        );
      } catch (e) { console.log("Backfill totalUSD skipped:", e.message); }

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

app.post('/api/test/fix-product-costs', async (req, res) => {
  console.log("Backfilling missing cost prices...");
  try {
    const result = await Product.updateMany(
      { costPrice: { $exists: false } },
      { $set: { costPrice: 0 } }
    );
    res.json({ success: true, message: `Updated ${result.modifiedCount} products with default cost price.` });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

app.post('/api/test/backfill-estimated-costs', async (req, res) => {
  console.log("Backfilling 0-cost products with 70% of selling price...");
  try {
    // Find products with costPrice 0 or missing
    const products = await Product.find({ 
      $or: [{ costPrice: { $exists: false } }, { costPrice: 0 }] 
    });

    const operations = products.map(p => {
      // Default to 70% of price
      const estimatedCost = (p.price * 0.7).toFixed(2);
      return {
        updateOne: {
          filter: { _id: p._id },
          update: { $set: { costPrice: Number(estimatedCost) } }
        }
      };
    });

    const result = await Product.bulkWrite(operations);
    res.json({ success: true, message: `Updated ${result.modifiedCount} products with estimated cost (70% of price).` });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// --- STAFF LINKING ---

app.get('/api/shops/requests/:id', async (req, res) => {
  console.log(`Fetching requests for identifier: ${req.params.id}`);
  try {
    const identifier = req.params.id;
    
    // Validate ID format to prevent crashes
    if (!mongoose.Types.ObjectId.isValid(identifier)) {
      return res.status(400).json({ message: "Invalid ID format" });
    }

    const requests = await LinkRequest.find({
      $or: [{ shop: identifier }, { manager: identifier }],
      status: 'pending'
    })
    .populate('cashier', 'name email')
    .populate('shop', 'name location branchCode');
    
    console.log(`Found ${requests.length} pending requests.`);
    res.json(requests || []);
  } catch (err) {
    console.error("Error fetching requests:", err);
    res.status(500).json([]); 
  }
});

// Add this missing route for Cashier UI to check status
app.get('/api/shops/cashier-request/:userId', async (req, res) => {
  try {
    const request = await LinkRequest.findOne({ 
      cashier: req.params.userId, 
      status: 'pending' 
    }).populate('shop', 'name branchCode');
    
    res.json(request); // Returns null if not found, which is valid
  } catch (err) {
    console.error("Error fetching cashier request:", err);
    res.status(500).json({ message: err.message });
  }
});

// Add this to your server code
app.post('/api/shops/request-link', async (req, res) => {
  console.log('New join request:', req.body);
  try {
    const { branchCode, cashierId } = req.body;

    // 1. Find the shop by branch code
    const shop = await Shop.findOne({ branchCode });
    if (!shop) {
      console.log(`❌ Shop lookup failed for code: '${branchCode}'. Ensure prefix is correct (e.g., STLR-).`);
      return res.status(404).json({ message: "Invalid branch code. Shop not found." });
    }

    // Ensure the shop actually has a manager to send the request to
    if (!shop.manager) {
      console.log(`❌ Shop ${shop.name} has no manager assigned.`);
      return res.status(400).json({ message: "This shop has no manager assigned to approve requests." });
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
    console.log(`✅ Request created for Manager: ${shop.manager}`);
    res.status(201).json({ success: true, message: "Request sent to manager." });

  } catch (err) {
    console.error("Join request error:", err);
    res.status(500).json({ message: "Server error: " + err.message });
  }
});

app.put('/api/shops/requests/:id', async (req, res) => {
  console.log(`Updating request ${req.params.id} to ${req.body.status}`);
  try {
    const { status } = req.body;
    const request = await LinkRequest.findById(req.params.id);
    if (!request) return res.status(404).json({ message: "Request not found" });

    request.status = status;
    await request.save();

    if (status === 'approved') {
      // 1. Link User to Shop
      await User.findByIdAndUpdate(request.cashier, { shopId: request.shop });
      
      // 2. Add User to Shop's cashiers list
      await Shop.findByIdAndUpdate(request.shop, { 
        $addToSet: { cashiers: request.cashier } 
      });
    }

    res.json({ success: true });
  } catch (err) {
    console.error("Request update error:", err);
    res.status(500).json({ message: err.message });
  }
});

app.delete('/api/shops/requests/:id', async (req, res) => {
  console.log(`Deleting request ${req.params.id}`);
  try {
    const request = await LinkRequest.findByIdAndDelete(req.params.id);
    if (!request) return res.status(404).json({ message: "Request not found" });
    res.json({ success: true, message: "Request cancelled" });
  } catch (err) {
    console.error("Request deletion error:", err);
    res.status(500).json({ message: err.message });
  }
});

// --- NOTIFICATIONS ---

app.get('/api/notifications/:userId', async (req, res) => {
  try {
    const notifications = await Notification.find({ recipient: req.params.userId })
      .sort({ createdAt: -1 })
      .limit(50);
    res.json(notifications);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

app.put('/api/notifications/:id/read', async (req, res) => {
  try {
    await Notification.findByIdAndUpdate(req.params.id, { isRead: true });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

app.put('/api/notifications/read-all/:userId', async (req, res) => {
  try {
    await Notification.updateMany({ recipient: req.params.userId, isRead: false }, { isRead: true });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

app.delete('/api/notifications/clear-all/:userId', async (req, res) => {
  try {
    await Notification.deleteMany({ recipient: req.params.userId });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// (Keep your other existing link request routes below...)

const PORT = process.env.PORT || 5000;
app.listen(PORT, '0.0.0.0', () => console.log(`🚀 Server running on port ${PORT}`));
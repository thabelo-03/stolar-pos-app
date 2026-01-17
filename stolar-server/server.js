const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const bcrypt = require('bcryptjs'); // For password security
require('dotenv').config();
const Shop = require('./models/Shop');

const User = require('./models/User'); // Import the User Model
const Product = require('./models/Product'); // Import the Product Model
const Sale = require('./models/Sale'); // Import the Sale Model
const LinkRequest = require('./models/LinkRequest'); // Import the LinkRequest Model
const Notification = require('./models/Notification'); // Import Notification Model

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
      name: user.name, 
      id: user._id,
      shopId: user.shopId // Include shopId in the response
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});
// --- ADMIN: GET ALL USERS ---
app.get('/api/users', async (req, res) => {
  try {
    // We find all users but hide their passwords for security
    const users = await User.find({}, '-password').sort({ name: 1 });
    res.json(users);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET USER BY ID
app.get('/api/users/:userId', async (req, res) => {
  try {
    const user = await User.findById(req.params.userId, '-password');
    if (!user) return res.status(404).json({ message: "User not found" });
    res.json(user);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});
app.get('/api/products', async (req, res) => {
  try {
    const products = await Product.find().sort({ updatedAt: -1 });
    res.json(products);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// REGISTER A NEW SHOP
// REGISTER A NEW SHOP (With Auto-Generated Code)
// REGISTER A NEW SHOP
app.post('/api/shops/register', async (req, res) => {
  try {
    const { name, location, managerId } = req.body;
    
    // 1. Generate the Code
    const generatedCode = `STLR-${Math.floor(1000 + Math.random() * 9000)}`;

    // 2. Create Shop
    const newShop = new Shop({
      name,
      location,
      branchCode: generatedCode,
      manager: (managerId && managerId.length === 24) ? managerId : null
    });

    // 3. Save
    await newShop.save();

    // 4. IMPORTANT: Send a clean JSON response
    console.log(`✅ Success: ${name} saved with code ${generatedCode}`);
    
    return res.status(201).json({ 
      success: true, 
      branchCode: generatedCode,
      shop: newShop 
    });

  } catch (err) {
    console.error("❌ Registration Error:", err.message);
    return res.status(500).json({ success: false, message: err.message });
  }
});

// GET ALL SHOPS
app.get('/api/shops', async (req, res) => {
  try {
    const shops = await Shop.find().sort({ createdAt: -1 }); // Get newest first
    res.json(shops);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET SHOP BY MANAGER ID
app.get('/api/shops/manager/:managerId', async (req, res) => {
  try {
    const shop = await Shop.findOne({ manager: req.params.managerId });
    if (!shop) return res.status(404).json({ message: "Shop not found for this manager" });
    res.json(shop);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// --- SHOP LINKING ROUTES ---

// 1. CASHIER: REQUEST TO LINK WITH A SHOP
app.post('/api/shops/request-link', async (req, res) => {
  try {
    const { branchCode, userId } = req.body; // userId is the cashier's ID

    // Find the shop by its unique branch code
    const shop = await Shop.findOne({ branchCode });
    if (!shop) {
      return res.status(404).json({ message: 'Shop with this code not found.' });
    }

    // Check if a request already exists
    const existingRequest = await LinkRequest.findOne({ cashier: userId, shop: shop._id });
    if (existingRequest) {
      return res.status(400).json({ message: 'You have already sent a request to this shop.' });
    }
    
    // Create a new link request
    const newRequest = new LinkRequest({
      cashier: userId,
      shop: shop._id,
      manager: shop.manager, // Add manager to the request
    });
    await newRequest.save();

    // --- NOTIFICATION: Alert the Manager ---
    const cashierUser = await User.findById(userId);
    await Notification.create({
      recipient: shop.manager,
      sender: userId,
      type: 'link_request',
      message: `${cashierUser ? cashierUser.name : 'A cashier'} requested to join ${shop.name}`,
      relatedId: newRequest._id
    });

    res.status(201).json({ success: true, message: 'Link request sent successfully.' });

  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

/*
// 2. MANAGER: GET PENDING REQUESTS FOR THEIR SHOP
app.get('/api/shops/requests', async (req, res) => {
  try {
    const { managerId } = req.query; // Manager's ID from query

    // Find pending requests for this manager and populate cashier and shop info
    const requests = await LinkRequest.find({ manager: managerId, status: 'pending' })
      .populate('cashier', 'name email') // Populate cashier's name and email
      .populate('shop', 'name location'); // Populate shop's name and location

    if (!requests) {
      return res.status(404).json({ message: 'No pending requests found for you.' });
    }

    res.json(requests);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET SINGLE REQUEST BY ID
app.get('/api/shops/requests/:shopIdOrManagerId', async (req, res) => {
  try {
    const { managerId } = req.query;

    const requests = await LinkRequest.find({
      $or: [{ shop: id }, { manager: id }],
      status: 'pending'
    })
      .populate('cashier', 'name email')
      .populate('shop', 'name location');

    // FIX: If no requests are found, return an empty array [] instead of 404
    // if (!requests || requests.length === 0) {
    //   return res.json([]); 
    // }
    // FIX: Always return an array, even if empty
    if (!requests) {
      return res.json([]); 
    }

    res.json(requests);
  } catch (err) {
    // If there's an error, don't just send the error object to the frontend
    res.status(500).json([]); 
  }
});
app.get('/api/shops/requests/:shopIdOrManagerId', async (req, res) => {
  try {
    const requests = await LinkRequest.find({
      $or: [{ shop: id }, { manager: id }],
      status: 'pending'
    })
      .populate('cashier', 'name email')
      .populate('shop', 'name location');

    if (!request) return res.status(404).json({ message: "Request not found" });

    res.json(request);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});
*/
// 3. MANAGER: APPROVE OR REJECT A REQUEST
app.put('/api/shops/requests/:requestId', async (req, res) => {
  try {
    const { requestId } = req.params;
    const { status } = req.body; // Expecting 'approved' or 'rejected'

    const request = await LinkRequest.findById(requestId);
    if (!request) {
      return res.status(404).json({ message: 'Request not found.' });
    }

    if (status === 'approved') {
      request.status = 'approved';

      // 1. Add cashier to the shop's list
      // Ensure your Shop model has a 'cashiers' array field!
      await Shop.findByIdAndUpdate(request.shop, { 
        $addToSet: { cashiers: request.cashier } 
      });
      
      // 2. Assign the shop to the cashier's user profile
      // Ensure your User model has a 'shopId' field!
      await User.findByIdAndUpdate(request.cashier, { 
        shopId: request.shop 
      });

    } else if (status === 'rejected') {
      request.status = 'rejected';
    } else {
      return res.status(400).json({ message: 'Invalid status update.' });
    }

    await request.save();
    res.json({ success: true, message: `Request has been ${status}.` });

  } catch (err) {
    // This log will appear in your VS Code Terminal
    console.error("❌ PUT Request Crash:", err.message); 
    res.status(500).json({ message: "Server error: " + err.message });
  }
});

// REPLACE all /api/shops/requests routes with this:
app.get('/api/shops/requests/:id', async (req, res) => {
  try {
    const identifier = req.params.id;

    // We check if the ID belongs to a Shop OR a Manager
    // This handles both ways your frontend might call it
    const requests = await LinkRequest.find({
      $or: [
        { shop: identifier },
        { manager: identifier }
      ],
      status: 'pending'
    })
    .populate('cashier', 'name email')
    .populate('shop', 'name location');

    // IMPORTANT: Always return an array (even if empty) to prevent frontend .map() errors
    res.json(requests || []);

  } catch (err) {
    console.error("❌ Server Error in Fetch Requests:", err.message);
    res.status(500).json([]); 
  }
});

// --- PRODUCT ROUTES ---

// GET PRODUCT BY BARCODE
app.get('/api/products/:barcode', async (req, res) => {
  try {
    const product = await Product.findOne({ barcode: req.params.barcode });
    if (!product) return res.status(404).json({ message: "Product not found" });
    res.json(product);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// 3. ADD/UPDATE STOCK ROUTE
app.post('/api/products/add', async (req, res) => {
  // 1. Add costPrice to the destructuring
  const { name, barcode, category, price, costPrice, quantity } = req.body; 

  console.log("Received data:", req.body);

  try {
    let product = await Product.findOne({ barcode });
    const addQty = isNaN(Number(quantity)) ? 0 : Number(quantity);

    if (product) {
      product.stockQuantity = (product.stockQuantity || 0) + addQty;
      // 2. Optionally update price/costPrice if they changed
      product.price = Number(price);
      product.costPrice = Number(costPrice); 
      product.updatedAt = Date.now();
      await product.save();
      return res.json({ success: true, message: "Stock updated", product });
    } else {
      product = new Product({ 
        name, 
        barcode, 
        category, 
        price: Number(price), 
        costPrice: Number(costPrice), // 3. Save the cost price for new items
        stockQuantity: addQty 
      });
      await product.save();
      return res.status(201).json({ success: true, message: "New product registered", product });
    }
  } catch (err) {
    console.error("Internal Server Error:", err);
    res.status(500).json({ error: err.message });
  }
});
/*app.post('/api/products/add', async (req, res) => {
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
});*/

// --- SALES ROUTES ---

// 1. RECORD A NEW SALE (CHECKOUT)
app.post('/api/sales', async (req, res) => {
  try {
    const { items, total, paymentMethod, date } = req.body;

    // Create new sale record
    const newSale = new Sale({
      items,
      total,
      paymentMethod,
      date
    });

    await newSale.save();

    // Deduct stock for each item
    for (const item of items) {
      if (item.barcode) {
        const product = await Product.findOne({ barcode: item.barcode });
        if (product) {
          product.stockQuantity = Math.max(0, (product.stockQuantity || 0) - item.quantity);
          await product.save();
        }
      }
    }

    res.status(201).json({ success: true, message: "Sale recorded successfully", sale: newSale });
  } catch (err) {
    console.error("Checkout Error:", err);
    res.status(500).json({ message: err.message });
  }
});

// REFUND A SALE
app.post('/api/sales/:id/refund', async (req, res) => {
  try {
    const sale = await Sale.findById(req.params.id);
    if (!sale) return res.status(404).json({ message: "Sale not found" });
    if (sale.status === 'refunded') return res.status(400).json({ message: "Sale already refunded" });

    // Restore Stock
    for (const item of sale.items) {
      if (item.barcode) {
        const product = await Product.findOne({ barcode: item.barcode });
        if (product) {
          product.stockQuantity = (product.stockQuantity || 0) + item.quantity;
          await product.save();
        }
      }
    }

    sale.status = 'refunded';
    await sale.save();

    res.json({ success: true, message: "Sale refunded successfully", sale });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// 2. GET ALL SALES (For Reports)
app.get('/api/sales', async (req, res) => {
  try {
    const sales = await Sale.find().sort({ date: -1 });
    res.json(sales);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// 3. GET RECENT SALES (Paginated)
app.get('/api/sales/recent', async (req, res) => {
  try {
    const { limit = 10, page = 1 } = req.query;
    const sales = await Sale.find()
      .sort({ date: -1 })
      .limit(Number(limit))
      .skip((Number(page) - 1) * Number(limit));
    
    // Format data for frontend consistency if needed, but sending raw is fine too
    // The frontend will handle the 'items' array
    const formattedSales = sales.map(sale => ({
      id: sale._id,
      time: new Date(sale.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      total: sale.total,
      items: sale.items, // Send the full array
      amount: sale.total,
      status: sale.status
    }));

    res.json(formattedSales);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET SALES SUMMARY FOR A SPECIFIC DATE
app.get('/api/sales/summary/:dateString', async (req, res) => {
  try {
    const { dateString } = req.params;
    const targetDate = new Date(dateString);
    
    // Set up the start and end of the day for the query
    const startDate = new Date(targetDate.setHours(0, 0, 0, 0));
    const endDate = new Date(targetDate.setHours(23, 59, 59, 999));

    const sales = await Sale.find({
      date: {
        $gte: startDate,
        $lte: endDate,
      },
    }).sort({ date: -1 });

    const totalSales = sales.reduce((sum, sale) => sum + sale.total, 0);
    const numberOfTransactions = sales.length;

    res.json({
      totalSales,
      numberOfTransactions,
      transactions: sales.map(sale => ({
        id: sale._id,
        time: new Date(sale.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        amount: sale.total,
        // Flatten items to a string description
        items: sale.items.map(item => `${item.name} (x${item.quantity})`).join(', '),
        status: sale.status
      }))
    });
  } catch (err) {
    console.error("Sales summary error:", err);
    res.status(500).json({ message: err.message });
  }
});

// --- NOTIFICATION ROUTES ---

// GET NOTIFICATIONS FOR A USER
// 1. GET: Fetch notifications for a specific user
app.get('/api/notifications/:userId', async (req, res) => {
  try {
    const notifications = await Notification.find({ recipient: req.params.userId })
      .sort({ createdAt: -1 }) // Newest first
      .limit(20);
    
    // Always return an array to avoid frontend .map() crashes
    res.json(notifications || []);
  } catch (err) {
    console.error("Fetch Notifications Error:", err.message);
    res.status(500).json([]);
  }
});

// 2. PUT: Mark a notification as read
app.put('/api/notifications/:id/read', async (req, res) => {
  try {
    const notification = await Notification.findByIdAndUpdate(
      req.params.id,
      { isRead: true },
      { new: true }
    );
    
    if (!notification) return res.status(404).json({ message: "Notification not found" });
    
    res.json({ success: true, notification });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

/*app.get('/api/notifications/:userId', async (req, res) => {
  try {
    const notifications = await Notification.find({ recipient: req.params.userId })
      .sort({ createdAt: -1 }) // Newest first
      .limit(20);
    res.json(notifications);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// MARK NOTIFICATION AS READ
app.put('/api/notifications/:id/read', async (req, res) => {
  try {
    await Notification.findByIdAndUpdate(req.params.id, { isRead: true });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});*/

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
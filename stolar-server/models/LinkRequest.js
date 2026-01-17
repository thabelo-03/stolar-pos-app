const LinkRequest = require('../models/LinkRequest');
const Shop = require('../models/Shop');
const User = require('../models/User');

// 1. SEND REQUEST (Cashier Side)
exports.requestLink = async (req, res) => {
  try {
    const { branchCode, userId } = req.body;

    // Find the shop and its owner (manager)
    const shop = await Shop.findOne({ branchCode: branchCode.toUpperCase() });
    
    if (!shop) {
      return res.status(404).json({ message: "Invalid Branch Code. Shop not found." });
    }

    // Check if a pending request already exists to prevent duplicates
    const existing = await LinkRequest.findOne({ cashier: userId, shop: shop._id, status: 'pending' });
    if (existing) return res.status(400).json({ message: "Request already pending for this shop." });

    const newRequest = new LinkRequest({
      cashier: userId,
      shop: shop._id,
      manager: shop.manager, // Auto-link to the manager who owns the shop
      status: 'pending'
    });

    await newRequest.save();
    res.status(200).json({ success: true, message: "Request sent successfully!" });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

// 2. APPROVE/REJECT REQUEST (Manager Side)
exports.updateRequestStatus = async (req, res) => {
  try {
    const { requestId } = req.params;
    const { status } = req.body; // 'approved' or 'rejected'

    const request = await LinkRequest.findById(requestId);
    if (!request) return res.status(404).json({ message: "Request not found" });

    request.status = status;
    await request.save();

    // If approved, officially link the cashier to the shop in the User model
    if (status === 'approved') {
      await User.findByIdAndUpdate(request.cashier, { 
        shopId: request.shop,
        role: 'cashier' 
      });
    }

    res.json({ message: `Request ${status} successfully.` });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
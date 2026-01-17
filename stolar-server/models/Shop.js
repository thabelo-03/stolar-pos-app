const express = require('express');
const router = express.Router();
const Shop = require('../models/Shop');
const LinkRequest = require('../models/LinkRequest');

// POST: http://localhost:5000/api/shops/request-link
router.post('/request-link', async (req, res) => {
  try {
    const { branchCode, userId } = req.body;

    // 1. Find the Shop by the code the cashier entered
    // Using .findOne because branchCode is unique in your ShopSchema
    const shop = await Shop.findOne({ branchCode: branchCode.toUpperCase() });

    if (!shop) {
      return res.status(404).json({ 
        success: false, 
        message: "Branch code not found. Please verify the code with your manager." 
      });
    }

    // 2. Build the LinkRequest
    // We pull 'shop._id' and 'shop.manager' directly from the document we just found
    const newRequest = new LinkRequest({
      cashier: userId,      // From the mobile app
      shop: shop._id,       // Found in MongoDB
      manager: shop.manager, // Found in MongoDB (Danger's ID)
      status: 'pending'
    });

    // 3. Save to the LinkRequests collection
    await newRequest.save();

    res.status(200).json({ 
      success: true, 
      message: "Request sent! Danger will approve it in the Operations Hub." 
    });

  } catch (error) {
    console.error("Link Request Error:", error.message);
    // If we hit a 400 here, the console.log above will tell us exactly which field is missing
    res.status(400).json({ 
      success: false, 
      message: "Database validation failed: " + error.message 
    });
  }
});

module.exports = router;
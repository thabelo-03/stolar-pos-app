const express = require('express');
const router = express.Router();
const Shop = require('../models/Shop'); // This points to the model you just updated

// --- GET RATES ---
// This handles: GET http://localhost:5000/api/shops/rates/:shopId
router.get('/rates/:shopId', async (req, res) => {
  try {
    const shop = await Shop.findById(req.params.shopId);
    if (!shop) return res.status(404).json({ message: "Shop not found" });
    
    res.json({ rates: shop.rates });
  } catch (error) {
    res.status(500).json({ message: "Error fetching rates" });
  }
});

// --- UPDATE RATES ---
// This handles: POST http://localhost:5000/api/shops/update-rates
router.post('/update-rates', async (req, res) => {
  const { shopId, rates } = req.body;
  try {
    const shop = await Shop.findByIdAndUpdate(
      shopId,
      { $set: { "rates.ZAR": rates.ZAR, "rates.ZiG": rates.ZiG, "rates.updatedAt": Date.now() } },
      { new: true }
    );
    if (!shop) return res.status(404).json({ message: "Shop not found" });
    
    res.json({ message: "Rates updated!", rates: shop.rates });
  } catch (error) {
    res.status(500).json({ message: "Update failed" });
  }
});

module.exports = router;
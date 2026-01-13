const mongoose = require('mongoose');

const ProductSchema = new mongoose.Schema({
  name: { type: String, required: true },
  barcode: { type: String, required: true, unique: true },
  category: { type: String, required: true }, // e.g., 'Seeds', 'Tools'
  price: { type: Number, required: true },
  stockQuantity: { type: Number, default: 0 },
  minStockLevel: { type: Number, default: 5 }, // For "Stock Low" alerts
  shopId: { type: String, default: 'main_branch' },
  updatedAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Product', ProductSchema);
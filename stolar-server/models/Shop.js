const mongoose = require('mongoose');

const ShopSchema = new mongoose.Schema({
  name: { type: String, required: true },
  location: { type: String, required: true },
  branchCode: { type: String, required: true, unique: true },
  manager: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, // Danger Dumani
  cashiers: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Shop', ShopSchema);
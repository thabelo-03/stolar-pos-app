const mongoose = require('mongoose');

const ActionLogSchema = new mongoose.Schema({
  action: { type: String, required: true },
  details: { type: String, required: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  userName: String,
  shopId: { type: mongoose.Schema.Types.ObjectId, ref: 'Shop' },
  relatedId: { type: mongoose.Schema.Types.ObjectId, index: true }, // Product ID or other related entity
  previousState: { type: mongoose.Schema.Types.Mixed }, // Snapshot of data before change
  timestamp: { type: Date, default: Date.now }
});

module.exports = mongoose.model('ActionLog', ActionLogSchema);
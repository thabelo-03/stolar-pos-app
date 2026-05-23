const mongoose = require('mongoose');

const SaleSchema = new mongoose.Schema({
  items: [
    {
      id: String,
      name: String,
      price: Number,
      quantity: Number,
      barcode: String,
      costPrice: Number
    }
  ],
  total: {
    type: Number,
    required: true
  },
  totalUSD: Number,
  totalPaidLocal: Number,
  currencyUsed: String,
  tenderedAmount: Number,
  change: Number,
  rateUsed: Number,
  paymentMethod: {
    type: String,
    default: 'Cash'
  },
  date: {
    type: Date,
    default: Date.now
  },
  cashierId: { type: String, index: true },
  offlineId: { type: String, index: true },
  refunded: { type: Boolean, default: false },
  refundReason: String,
  status: {
    type: String,
    enum: ['completed', 'refunded'],
    default: 'completed'
  },
  userId: { // Added userId
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true // A sale must be associated with a user
  },
  shopId: { // Added shopId
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Shop',
    required: true // A sale must be associated with a shop
  }
});

module.exports = mongoose.model('Sale', SaleSchema);

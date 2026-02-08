const mongoose = require('mongoose');

const SaleSchema = new mongoose.Schema({
  items: [
    {
      id: String,
      name: String,
      price: Number,
      quantity: Number,
      barcode: String
    }
  ],
  total: {
    type: Number,
    required: true
  },
  totalUSD: Number,
  totalPaidLocal: Number,
  currencyUsed: String,
  rateUsed: Number,
  paymentMethod: {
    type: String,
    default: 'Cash'
  },
  date: {
    type: Date,
    default: Date.now
  },
  shopId: { type: String, index: true },
  cashierId: { type: String, index: true },
  offlineId: { type: String, index: true },
  refunded: { type: Boolean, default: false },
  refundReason: String,
  status: {
    type: String,
    enum: ['completed', 'refunded'],
    default: 'completed'
  }
});

module.exports = mongoose.model('Sale', SaleSchema);

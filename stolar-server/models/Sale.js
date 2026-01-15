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
  paymentMethod: {
    type: String,
    default: 'Cash'
  },
  date: {
    type: Date,
    default: Date.now
  },
  status: {
    type: String,
    enum: ['completed', 'refunded'],
    default: 'completed'
  }
});

module.exports = mongoose.model('Sale', SaleSchema);

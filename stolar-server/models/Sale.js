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

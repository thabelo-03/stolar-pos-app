// c:\TestProject\stolar-pos-app\stolar-server\models\PaymentHistory.js

const mongoose = require('mongoose');

const PaymentHistorySchema = new mongoose.Schema({
  managerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  managerName: { type: String, required: true },
  managerEmail: { type: String, required: true },
  amount: { type: Number, required: true },
  months: { type: Number, required: true },
  paymentMethod: { type: String, default: 'cash' },
  date: { type: Date, default: Date.now },
  isSeed: { type: Boolean, default: false } // To identify test data
});

module.exports = mongoose.model('PaymentHistory', PaymentHistorySchema);

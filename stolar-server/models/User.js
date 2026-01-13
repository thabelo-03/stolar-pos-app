const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  role: { type: String, enum: ['admin', 'manager', 'cashier'], default: 'cashier' },
  shopId: { type: String, default: 'main_branch' },
  isActive: { type: Boolean, default: true }
});

module.exports = mongoose.model('User', UserSchema);
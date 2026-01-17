const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  role: { 
    type: String, 
    enum: ['admin', 'manager', 'cashier'], 
    default: 'cashier' 
  },
  // CHANGED: Linked to the Shop Model via ObjectId
  shopId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Shop',
    default: null // New users start unlinked
  },
  isActive: { type: Boolean, default: true },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('User', UserSchema);
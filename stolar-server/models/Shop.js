const mongoose = require('mongoose');

const ShopSchema = new mongoose.Schema({
  name: { 
    type: String, 
    required: [true, 'Shop name is required'],
    trim: true 
  },
  location: { 
    type: String, 
    required: [true, 'Location is required'] 
  },
  branchCode: { 
    type: String, 
    required: true, 
    unique: true,
    uppercase: true // Ensures STLR-7093 format
  },
  // Danger Dumani's ID goes here
  manager: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User',
    required: [true, 'A shop must have a manager']
  }, 
  cashiers: [{ 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User' 
  }],
  status: {
    type: String,
    enum: ['active', 'inactive'],
    default: 'active'
  },
  createdAt: { 
    type: Date, 
    default: Date.now 
  }
});

module.exports = mongoose.model('Shop', ShopSchema);
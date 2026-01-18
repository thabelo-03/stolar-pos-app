const mongoose = require('mongoose');

const ShopSchema = new mongoose.Schema({
  name: { 
    type: String, 
    required: true,
    trim: true 
  },
  location: { 
    type: String, 
    required: true 
  },
  branchCode: { 
    type: String, 
    required: true, 
    unique: true,
    index: true // Makes searching for shops by code much faster
  },
  manager: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User' 
  },
  cashiers: [{ 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User' 
  }],

  // --- NEW: MULTI-CURRENCY RATES ---
  // These are updated by Danger in the Operation Hub
  rates: {
    ZAR: { 
      type: Number, 
      default: 19.2 
    },
    ZiG: { 
      type: Number, 
      default: 26.5 
    },
    updatedAt: { 
      type: Date, 
      default: Date.now 
    }
  }
}, { 
  timestamps: true // Automatically creates 'createdAt' and 'updatedAt'
});

module.exports = mongoose.model('Shop', ShopSchema);
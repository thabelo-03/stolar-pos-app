const mongoose = require('mongoose');

const ProductSchema = new mongoose.Schema({
  name: { 
    type: String, 
    required: [true, 'Product name is required'], 
    trim: true 
  },
  barcode: { 
    type: String, 
    required: [true, 'Barcode is required'], 
    unique: true 
  },
  category: { 
    type: String, 
    required: true,
    index: true 
  },
  
  // Multi-Currency: Store base price in USD for stability
  price: { 
    type: Number, 
    required: true,
    min: 0 
  },
  currency: { 
    type: String, 
    default: 'USD',
    enum: ['USD', 'ZAR', 'ZiG'] // Restrict to your supported currencies
  },

  // Inventory Management
  stockQuantity: { 
    type: Number, 
    default: 0,
    min: 0 
  },
  minStockLevel: { 
    type: Number, 
    default: 5 
  },
  
  // Location and Audit
  shopId: { 
    type: String, 
    default: 'main_branch',
    index: true 
  },
  branchCode: { 
    type: String, 
    index: true 
  }
}, {
  timestamps: true // Automatically creates createdAt and updatedAt fields
});

// Middleware to update the 'updatedAt' field is no longer needed with { timestamps: true }
// but you can add custom logic here if needed.

module.exports = mongoose.model('Product', ProductSchema);
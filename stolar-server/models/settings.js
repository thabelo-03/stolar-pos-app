const mongoose = require('mongoose');

const SettingsSchema = new mongoose.Schema({
  shopId: { type: String, required: true, unique: true },
  rates: {
    ZAR: { type: Number, default: 19.0 },
    ZiG: { type: Number, default: 25.0 }
  },
  updatedAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Settings', SettingsSchema);
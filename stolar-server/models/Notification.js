const mongoose = require('mongoose');

const NotificationSchema = new mongoose.Schema({
  recipient: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }, // Who gets the alert (Manager)
  sender: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, // Who triggered it (Cashier)
  type: { type: String, enum: ['link_request', 'system'], default: 'system' },
  message: { type: String, required: true },
  relatedId: { type: mongoose.Schema.Types.ObjectId }, // ID of the LinkRequest
  isRead: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Notification', NotificationSchema);

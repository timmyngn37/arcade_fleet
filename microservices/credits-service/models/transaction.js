const mongoose = require('mongoose');

const transactionSchema = new mongoose.Schema(
  {
    transactionId: { type: String, required: true, unique: true },
    playerId: { type: String, default: null }, // null = anonymous coin/card payment, not tied to a profile
    venueId: { type: String, required: true },
    method: { type: String, enum: ['coin', 'card'], required: true },
    amount: { type: Number, required: true }
  },
  { timestamps: true }
);

module.exports = mongoose.model('Transaction', transactionSchema);
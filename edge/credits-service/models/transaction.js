// edge/credits-service/models/transaction.js

const mongoose = require('mongoose');

const transactionSchema = new mongoose.Schema(
  {
    transactionId: { type: String, required: true, unique: true },
    playerId: { type: String, default: null },
    transactionType: { type: String, enum: ['credit', 'debit'], required: true },
    amount: { type: Number, required: true }
  },
  { timestamps: true }
);

module.exports = mongoose.model('Transaction', transactionSchema);
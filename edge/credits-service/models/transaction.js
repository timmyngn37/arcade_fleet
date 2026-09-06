// TODO - stub only. Planned fields per proposal's Data Design:
// playerId, transactionType, amount, timestamp

const mongoose = require('mongoose');

const transactionSchema = new mongoose.Schema(
  {
    transactionId: { type: String, required: true, unique: true },
    playerId: { type: String, required: true },
    transactionType: { type: String, enum: ['credit', 'debit'], required: true },
    amount: { type: Number, required: true }
  },
  { timestamps: true }
);

module.exports = mongoose.model('Transaction', transactionSchema);

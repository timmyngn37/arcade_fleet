const mongoose = require('mongoose');

const duoPairingSchema = new mongoose.Schema(
  {
    pairingId: { type: String, required: true, unique: true },
    cabinet1: { type: String, required: true },
    cabinet2: { type: String, required: true },
    sessionId: { type: String, default: '' }, // filled in by session-service once the duo session is created
    status: { type: String, enum: ['active', 'completed'], default: 'active' }
  },
  { timestamps: true }
);

module.exports = mongoose.model('DuoPairing', duoPairingSchema);

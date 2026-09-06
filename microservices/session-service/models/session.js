const mongoose = require('mongoose');

const cabinetAccuracySchema = new mongoose.Schema(
  {
    cabinetId: { type: String, required: true },
    hits: { type: Number, default: 0 },
    misses: { type: Number, default: 0 },
    accuracy: { type: Number, default: 100 }
  },
  { _id: false }
);

const sessionSchema = new mongoose.Schema(
  {
    sessionId: { type: String, required: true, unique: true },
    playerId: { type: String, default: null }, // null = guest session
    mode: { type: String, enum: ['solo', 'duo'], required: true },
    cabinets: { type: [String], required: true },
    status: { type: String, enum: ['active', 'completed'], default: 'active' },
    accuracyState: { type: [cabinetAccuracySchema], default: [] },
    continuousPlayStartTime: { type: Date, default: Date.now },
    breakSuggested: { type: Boolean, default: false }
  },
  { timestamps: true }
);

module.exports = mongoose.model('Session', sessionSchema);

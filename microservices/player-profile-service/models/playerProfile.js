const mongoose = require('mongoose');

const accessibilitySettingsSchema = new mongoose.Schema(
  {
    touchCalibrationWindowMs: { type: Number, default: 100 },
    hapticRhythmModeEnabled: { type: Boolean, default: false }
  },
  { _id: false }
);

const playerProfileSchema = new mongoose.Schema(
  {
    playerId: { type: String, required: true, unique: true },
    linkedNfcCard: { type: String, required: true, unique: true },
    name: { type: String },
    joiningDate: { type: Date, default: Date.now },
    accessibilitySettings: { type: accessibilitySettingsSchema, default: () => ({}) }
  },
  { timestamps: true }
);

module.exports = mongoose.model('PlayerProfile', playerProfileSchema);

// TODO - stub only. Planned fields per domain model + proposal:
// cabinetId, venueId, status, capabilities (e.g. ["touch","motion","haptic","led"])

const mongoose = require('mongoose');

const cabinetSchema = new mongoose.Schema(
  {
    cabinetId: { type: String, required: true, unique: true },
    venueId: { type: String, required: true },
    status: { type: String, enum: ['online', 'idle', 'faulty', 'offline'], default: 'offline' },
    capabilities: { type: [String], default: ['touch', 'motion', 'haptic', 'led'] }
  },
  { timestamps: true }
);

module.exports = mongoose.model('Cabinet', cabinetSchema);

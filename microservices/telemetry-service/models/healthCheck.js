const mongoose = require('mongoose');

const healthCheckSchema = new mongoose.Schema(
  {
    checkId: { type: String, required: true, unique: true },
    deviceId: { type: String, required: true },
    deviceType: { type: String, required: true },
    status: { type: String, enum: ['ok', 'fault'], required: true },
    detail: { type: mongoose.Schema.Types.Mixed }
  },
  { timestamps: true }
);

module.exports = mongoose.model('HealthCheck', healthCheckSchema);

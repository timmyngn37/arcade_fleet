// TODO - stub only.

const mongoose = require('mongoose');

const venueSchema = new mongoose.Schema(
  {
    venueId: { type: String, required: true, unique: true },
    location: { type: String }
  },
  { timestamps: true }
);

module.exports = mongoose.model('Venue', venueSchema);

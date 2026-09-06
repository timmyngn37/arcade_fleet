const mongoose = require('mongoose');

const leaderboardEntrySchema = new mongoose.Schema(
  {
    entryId: { type: String, required: true, unique: true },
    playerId: { type: String, required: true },
    sessionId: { type: String, required: true },
    venueId: { type: String, required: true },
    score: { type: Number, required: true }
  },
  { timestamps: true }
);

module.exports = mongoose.model('LeaderboardEntry', leaderboardEntrySchema);

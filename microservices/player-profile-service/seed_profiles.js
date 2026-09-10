// microservices/player-profile-service/seed_profiles.js
//
// Run once to create profiles matching the hardcoded knownCards in
// edge/shared-io/nfc_reader.js (card-001, card-002, card-003), so NFC
// scans actually resolve to something instead of always falling through
// to guest. Run with: node seed_profiles.js

const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const mongoose = require('mongoose');
const PlayerProfile = require('./models/playerProfile');

const profiles = [
  { playerId: 'p1', linkedNfcCard: 'card-001', name: 'Timmy' },
  { playerId: 'p2', linkedNfcCard: 'card-002', name: 'David' },
  { playerId: 'p3', linkedNfcCard: 'card-003', name: 'Kent' }
];

async function seed() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Connected to MongoDB');

  for (const data of profiles) {
    const existing = await PlayerProfile.findOne({ linkedNfcCard: data.linkedNfcCard });
    if (existing) {
      console.log(`Profile for ${data.linkedNfcCard} already exists, skipping`);
      continue;
    }

    const profile = new PlayerProfile(data);
    await profile.save();
    console.log(`Created profile for ${data.linkedNfcCard}: playerId ${data.playerId}`);
  }

  await mongoose.connection.close();
}

seed().catch((error) => {
  console.log(`Seed failed: ${error.message}`);
  process.exit(1);
});
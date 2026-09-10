// microservices/session-service/seed_duo_pairing.js
//
// Run once to create a real DuoPairing document, so session-service has
// something real to query instead of relying on hardcoded logic.
// Run with: node seed_duo_pairing.js

const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const mongoose = require('mongoose');
const DuoPairing = require('./models/duoPairing');

async function seed() {
  const uri = process.env.MONGODB_URI;
  await mongoose.connect(uri);
  console.log('Connected to MongoDB');

  const existing = await DuoPairing.findOne({ cabinet1: 'A', cabinet2: 'B', status: 'active' });
  if (existing) {
    console.log('Active pairing already exists:', existing.pairingId);
    await mongoose.connection.close();
    return;
  }

  const pairing = new DuoPairing({
    pairingId: `pairing-A-B-${Date.now()}`,
    cabinet1: 'A',
    cabinet2: 'B',
    sessionId: '', // filled in by session-service once the duo session is created
    status: 'active'
  });

  await pairing.save();
  console.log('Created DuoPairing:', pairing.pairingId);

  await mongoose.connection.close();
}

seed().catch((error) => {
  console.log(`Seed failed: ${error.message}`);
  process.exit(1);
});
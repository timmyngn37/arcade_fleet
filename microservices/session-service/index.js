const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const mqtt = require('mqtt');
const { connectDB } = require('../shared/db');
const Session = require('./models/session');
const DuoPairing = require('./models/duoPairing');

const WELLBEING_THRESHOLD_MINUTES = 45;

async function start() {
  await connectDB();

  const client = mqtt.connect(process.env.MQTT_BROKER_URL || 'mqtt://broker.hivemq.com:1883');

  client.on('connect', () => {
    console.log('Session service connected');
    client.subscribe('venue/+/session/+/event');
    client.subscribe('venue/+/shared-io/nfc/scan');
  });

  client.on('message', async (topic, message) => {
    try {
      const payload = JSON.parse(message.toString());
      const parts = topic.split('/'); // venue/{venueId}/session/{cabinetId}/event

      if (parts[2] === 'session' && parts[4] === 'event') {
        const cabinetId = parts[3];
        await handleGameplayEvent(cabinetId, payload);
      } else if (topic.endsWith('/shared-io/nfc/scan')) {
        await handleNfcScan(payload);
      }
    } catch (error) {
      console.log(`Failed to process message on ${topic}: ${error.message}`);
    }
  });

  client.on('error', (error) => {
    console.log(`MQTT Error: ${error.message}`);
  });
}

// TODO: not yet binding scanned playerId to a session/cabinet.
async function handleNfcScan(scan) {
  console.log(`NFC scan received: ${JSON.stringify(scan)}`);
}

async function handleGameplayEvent(cabinetId, event) {
  // Check whether this cabinet is part of an active duo pairing before
  // deciding what kind of session it belongs to.
  const pairing = await DuoPairing.findOne({
    $or: [{ cabinet1: cabinetId }, { cabinet2: cabinetId }],
    status: 'active'
  });

  const session = pairing
    ? await findOrCreateDuoSession(pairing)
    : await findOrCreateSoloSession(cabinetId);

  updateAccuracyForCabinet(session, cabinetId, event.grade);
  checkWellbeing(session);

  await session.save();
  console.log(`Session ${session.sessionId} (${session.mode}) updated for cabinet ${cabinetId}`);
}

async function findOrCreateDuoSession(pairing) {
  const cabinets = [pairing.cabinet1, pairing.cabinet2];

  let session = await Session.findOne({
    mode: 'duo',
    cabinets: { $all: cabinets, $size: 2 },
    status: 'active'
  });

  if (!session) {
    session = new Session({
      sessionId: `sess-duo-${pairing.pairingId}`,
      playerId: null,
      mode: 'duo',
      cabinets: cabinets,
      accuracyState: cabinets.map((cabinetId) => ({
        cabinetId, hits: 0, misses: 0, accuracy: 100
      }))
    });

    // Link the pairing back to the session it produced, for traceability.
    pairing.sessionId = session.sessionId;
    await pairing.save();
  }

  return session;
}

async function findOrCreateSoloSession(cabinetId) {
  let session = await Session.findOne({
    mode: 'solo',
    cabinets: [cabinetId],
    status: 'active'
  });

  if (!session) {
    session = new Session({
      sessionId: `sess-${cabinetId}-${Date.now()}`,
      playerId: null,
      mode: 'solo',
      cabinets: [cabinetId],
      accuracyState: [{ cabinetId, hits: 0, misses: 0, accuracy: 100 }]
    });
  }

  return session;
}

function updateAccuracyForCabinet(session, cabinetId, grade) {
  // Works the same for solo and duo sessions
  let cabinetStats = session.accuracyState.find((c) => c.cabinetId === cabinetId);

  if (!cabinetStats) {
    // Defensive: shouldn't normally happen, but avoids a crash if
    // a cabinet joins a duo session after it was first created.
    cabinetStats = { cabinetId, hits: 0, misses: 0, accuracy: 100 };
    session.accuracyState.push(cabinetStats);
  }

  if (grade === 'miss') {
    cabinetStats.misses++;
  } else {
    cabinetStats.hits++;
  }

  const totalNotes = cabinetStats.hits + cabinetStats.misses;
  cabinetStats.accuracy = totalNotes > 0
    ? parseFloat(((cabinetStats.hits / totalNotes) * 100).toFixed(2))
    : 100;
}

function checkWellbeing(session) {
  if (session.breakSuggested) return;

  const playedMinutes = (Date.now() - session.continuousPlayStartTime.getTime()) / 60000;

  if (playedMinutes > WELLBEING_THRESHOLD_MINUTES) {
    session.breakSuggested = true;
    console.log(`Wellbeing: suggesting a break for session ${session.sessionId}`);
  }
}

start();
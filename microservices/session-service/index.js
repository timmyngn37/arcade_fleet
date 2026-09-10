const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const mqtt = require('mqtt');
const { connectDB } = require('../shared/db');
const Session = require('./models/session');
const DuoPairing = require('./models/duoPairing');

const WELLBEING_THRESHOLD_MINUTES = 45;
const INACTIVITY_THRESHOLD_MINUTES = 2;
const COMPLETION_CHECK_INTERVAL_MS = 30000;

// Simplification, not the real "cabinet selection" step from the proposal
const PENDING_PLAYER_TTL_MS = 30000;
const pendingPlayerByVenue = {}; // venueId -> { playerId, resolvedAt }

let mqttClient;

async function start() {
  await connectDB();

  mqttClient = mqtt.connect(process.env.MQTT_BROKER_URL || 'mqtt://broker.hivemq.com:1883');

  mqttClient.on('connect', () => {
    console.log('Session service connected');
    mqttClient.subscribe('venue/+/session/+/event');
    mqttClient.subscribe('venue/+/player-profile/resolved');

    setInterval(completeInactiveSessions, COMPLETION_CHECK_INTERVAL_MS);
  });

  mqttClient.on('message', async (topic, message) => {
    try {
      const payload = JSON.parse(message.toString());
      const parts = topic.split('/');

      if (parts[2] === 'session' && parts[4] === 'event') {
        const cabinetId = parts[3];
        await handleGameplayEvent(cabinetId, payload);
      } else if (topic.endsWith('/player-profile/resolved')) {
        const venueId = parts[1];
        handlePlayerResolved(venueId, payload);
      }
    } catch (error) {
      console.log(`Failed to process message on ${topic}: ${error.message}`);
    }
  });

  mqttClient.on('error', (error) => {
    console.log(`MQTT Error: ${error.message}`);
  });
}

function handlePlayerResolved(venueId, resolved) {
  if (!resolved.playerId) {
    console.log(`Guest scan at venue ${venueId} - no pending player to bind`);
    return;
  }

  pendingPlayerByVenue[venueId] = { playerId: resolved.playerId, resolvedAt: Date.now() };
  console.log(`Pending player ${resolved.playerId} registered for venue ${venueId}`);
}

function takePendingPlayerId(venueId) {
  const pending = pendingPlayerByVenue[venueId];
  if (!pending) return null;

  const isExpired = Date.now() - pending.resolvedAt > PENDING_PLAYER_TTL_MS;
  delete pendingPlayerByVenue[venueId]; // single use either way

  return isExpired ? null : pending.playerId;
}

async function handleGameplayEvent(cabinetId, event) {
  const pairing = await DuoPairing.findOne({
    $or: [{ cabinet1: cabinetId }, { cabinet2: cabinetId }],
    status: 'active'
  });

  const session = pairing
    ? await findOrCreateDuoSession(pairing, event.venueId)
    : await findOrCreateSoloSession(cabinetId, event.venueId);

  updateAccuracyForCabinet(session, cabinetId, event.grade);
  checkWellbeing(session);

  await session.save();
  console.log(`Session ${session.sessionId} (${session.mode}, playerId: ${session.playerId}) updated for cabinet ${cabinetId}`);
}

async function findOrCreateDuoSession(pairing, venueId) {
  const cabinets = [pairing.cabinet1, pairing.cabinet2];

  let session = await Session.findOne({
    mode: 'duo',
    cabinets: { $all: cabinets, $size: 2 },
    status: 'active'
  });

  if (!session) {
    session = new Session({
      sessionId: `sess-duo-${pairing.pairingId}`,
      venueId: venueId,
      playerId: takePendingPlayerId(venueId),
      mode: 'duo',
      cabinets: cabinets,
      accuracyState: cabinets.map((cabinetId) => ({
        cabinetId, hits: 0, misses: 0, accuracy: 100
      }))
    });

    pairing.sessionId = session.sessionId;
    await pairing.save();
  }

  return session;
}

async function findOrCreateSoloSession(cabinetId, venueId) {
  let session = await Session.findOne({
    mode: 'solo',
    cabinets: [cabinetId],
    status: 'active'
  });

  if (!session) {
    session = new Session({
      sessionId: `sess-${cabinetId}-${Date.now()}`,
      venueId: venueId,
      playerId: takePendingPlayerId(venueId),
      mode: 'solo',
      cabinets: [cabinetId],
      accuracyState: [{ cabinetId, hits: 0, misses: 0, accuracy: 100 }]
    });
  }

  return session;
}

function updateAccuracyForCabinet(session, cabinetId, grade) {
  let cabinetStats = session.accuracyState.find((c) => c.cabinetId === cabinetId);

  if (!cabinetStats) {
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

async function completeInactiveSessions() {
  const cutoff = new Date(Date.now() - INACTIVITY_THRESHOLD_MINUTES * 60000);

  const staleSessions = await Session.find({
    status: 'active',
    updatedAt: { $lt: cutoff }
  });

  for (const session of staleSessions) {
    session.status = 'completed';
    await session.save();

    publishSessionCompleted(session);
    console.log(`Session ${session.sessionId} marked completed (inactive for ${INACTIVITY_THRESHOLD_MINUTES}+ min)`);
  }
}

function publishSessionCompleted(session) {
  const topic = `venue/${session.venueId}/session/${session.sessionId}/completed`;
  const payload = {
    sessionId: session.sessionId,
    venueId: session.venueId,
    playerId: session.playerId,
    mode: session.mode,
    cabinets: session.cabinets,
    accuracyState: session.accuracyState
  };

  mqttClient.publish(topic, JSON.stringify(payload));
  console.log(`Published to ${topic}`);
}

start();
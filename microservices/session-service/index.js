require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const mqtt = require('mqtt');
const { connectDB } = require('../shared/db');
const Session = require('./models/session');

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

      if (topic.includes('/session/') && topic.endsWith('/event')) {
        const parts = topic.split('/'); // ["venue","venue-01","session","A","event"]
        const cabinetId = parts[3];
        await handleGameplayEvent(cabinetId, payload);
      } else if (topic.includes('/shared-io/nfc/scan')) {
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
  let session = await Session.findOne({ cabinets: cabinetId, status: 'active' });

  if (!session) {
    session = new Session({
      sessionId: `sess-${cabinetId}-${Date.now()}`,
      playerId: null,
      mode: 'solo',
      cabinets: [cabinetId],
      accuracyState: [{ cabinetId, hits: 0, misses: 0, accuracy: 100 }]
    });
  }

  const cabinetStats = session.accuracyState.find((c) => c.cabinetId === cabinetId);

  if (event.grade === 'miss') {
    cabinetStats.misses++;
  } else {
    cabinetStats.hits++;
  }

  const totalNotes = cabinetStats.hits + cabinetStats.misses;
  cabinetStats.accuracy = totalNotes > 0
    ? parseFloat(((cabinetStats.hits / totalNotes) * 100).toFixed(2))
    : 100;

  checkWellbeing(session);

  await session.save();
  console.log(`Session ${session.sessionId} updated: ${JSON.stringify(cabinetStats)}`);
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

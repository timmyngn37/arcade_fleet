const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const mqtt = require('mqtt');
const { connectDB } = require('../shared/db');
const PlayerProfile = require('./models/playerProfile');

// Subscribes directly to NFC scans (rather than being called via HTTP
// from Node-RED) so this service owns its own resolution logic and
// publishes the result as an event - consistent with how every other
// service in this system communicates.

async function start() {
  await connectDB();

  const client = mqtt.connect(process.env.MQTT_BROKER_URL || 'mqtt://broker.hivemq.com:1883');

  client.on('connect', () => {
    console.log('Player profile service connected');
    client.subscribe('venue/+/shared-io/nfc/scan');
  });

  client.on('message', async (topic, message) => {
    try {
      const scan = JSON.parse(message.toString());
      const parts = topic.split('/'); // venue/{venueId}/shared-io/nfc/scan
      const venueId = parts[1];
      await resolveAndPublish(client, venueId, scan);
    } catch (error) {
      console.log(`Failed to process message on ${topic}: ${error.message}`);
    }
  });

  client.on('error', (error) => {
    console.log(`MQTT Error: ${error.message}`);
  });
}

async function resolveAndPublish(client, venueId, scan) {
  let result;

  if (scan.isGuest) {
    result = {
      cardId: scan.cardId,
      playerId: null,
      accessibilitySettings: defaultAccessibilitySettings()
    };
  } else {
    const profile = await PlayerProfile.findOne({ linkedNfcCard: scan.cardId });

    result = profile
      ? {
          cardId: scan.cardId,
          playerId: profile.playerId,
          accessibilitySettings: profile.accessibilitySettings
        }
      : {
          // Unrecognised card (not seeded) - treat the same as guest.
          cardId: scan.cardId,
          playerId: null,
          accessibilitySettings: defaultAccessibilitySettings()
        };
  }

  const topic = `venue/${venueId}/player-profile/resolved`;
  client.publish(topic, JSON.stringify(result));
  console.log(`Published to ${topic}: ${JSON.stringify(result)}`);
}

function defaultAccessibilitySettings() {
  return { touchCalibrationWindowMs: 100, hapticRhythmModeEnabled: false };
}

start();
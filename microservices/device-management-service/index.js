const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const mqtt = require('mqtt');
const { connectDB } = require('../shared/db');
const Cabinet = require('./models/cabinet');

async function start() {
  await connectDB();

  const client = mqtt.connect(process.env.MQTT_BROKER_URL || 'mqtt://broker.hivemq.com:1883');

  client.on('connect', () => {
    console.log('Device management service connected');
    client.subscribe('venue/+/device/+/status');
  });

  client.on('message', async (topic, message) => {
    try {
      const parts = topic.split('/'); // venue/{venueId}/device/{cabinetId}/status
      const venueId = parts[1];
      const cabinetId = parts[3];
      const payload = JSON.parse(message.toString());

      await Cabinet.findOneAndUpdate(
        { cabinetId, venueId },
        { cabinetId, venueId, status: payload.status, capabilities: payload.capabilities },
        { upsert: true, new: true }
      );

      console.log(`Cabinet ${cabinetId} at ${venueId} registered/updated: ${payload.status}`);
    } catch (error) {
      console.log(`Failed to process message on ${topic}: ${error.message}`);
    }
  });

  client.on('error', (error) => {
    console.log(`MQTT Error: ${error.message}`);
  });
}

start();
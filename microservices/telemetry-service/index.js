require('dotenv').config();
const mqtt = require('mqtt');
const { connectDB } = require('../shared/db');
const HealthCheck = require('./models/healthCheck');

async function start() {
  await connectDB();

  const client = mqtt.connect(process.env.MQTT_BROKER_URL || 'mqtt://broker.hivemq.com:1883');

  client.on('connect', () => {
    console.log('Telemetry service connected');
    client.subscribe('venue/+/device/+/health');
  });

  client.on('message', async (topic, message) => {
    try {
      const payload = JSON.parse(message.toString());
      await saveHealthCheck(payload);
    } catch (error) {
      console.log(`Failed to process message on ${topic}: ${error.message}`);
    }
  });

  client.on('error', (error) => {
    console.log(`MQTT Error: ${error.message}`);
  });
}

async function saveHealthCheck(payload) {
  const healthCheck = new HealthCheck({
    checkId: `check-${payload.deviceId}-${payload.timestamp}`,
    deviceId: payload.deviceId,
    deviceType: payload.deviceType,
    status: payload.status,
    detail: { currentSpeed: payload.currentSpeed }
  });

  await healthCheck.save();
  console.log(`Saved health check for ${payload.deviceId}: ${payload.status}`);
}

start();

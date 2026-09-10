const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const mqtt = require('mqtt');
const { connectDB } = require('../shared/db');
const Transaction = require('./models/transaction');

async function start() {
  await connectDB();

  const client = mqtt.connect(process.env.MQTT_BROKER_URL || 'mqtt://broker.hivemq.com:1883');

  client.on('connect', () => {
    console.log('Credits service connected');
    client.subscribe('venue/+/shared-io/credit/transaction');
  });

  client.on('message', async (topic, message) => {
    try {
      const parts = topic.split('/'); // venue/{venueId}/shared-io/credit/transaction
      const venueId = parts[1];
      const payload = JSON.parse(message.toString());

      // TODO: coin/card hardware doesn't currently report a cardId, so
      // there's no way to attribute this to a playerId yet. Recorded as
      // an anonymous transaction for now - matches how a real coin slot
      // works unless a card is tapped first.
      const transaction = new Transaction({
        transactionId: `txn-${venueId}-${payload.timestamp}`,
        playerId: null,
        venueId: venueId,
        method: payload.method,
        amount: payload.amount
      });

      await transaction.save();
      console.log(`Transaction recorded: ${payload.method} $${payload.amount} at ${venueId}`);
    } catch (error) {
      console.log(`Failed to process message on ${topic}: ${error.message}`);
    }
  });

  client.on('error', (error) => {
    console.log(`MQTT Error: ${error.message}`);
  });
}

start();
// edge/credits-service/index.js

const mqtt = require('mqtt');
const config = require('../shared-io/config');

const client = mqtt.connect(config.mqttBrokerUrl);

client.on('connect', () => {
  console.log('Edge Credits Service connected to MQTT broker');
});

function handleCreditInserted(cabinetId, amount, paymentMethod = 'coin') {
  const payload = {
    cabinetId,
    amount,
    method: paymentMethod,
    timestamp: Date.now()
  };

  const topic = `venue/${config.venueId}/shared-io/credit/transaction`;
  client.publish(topic, JSON.stringify(payload));
}

module.exports = { handleCreditInserted };
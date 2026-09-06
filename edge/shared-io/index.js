// edge/shared-io/index.js
//
// Entry point for the shared NFC/coin-card/buttons cluster. Run with:
//   node index.js
//
// There's no per-device grouping here since these three inputs are independent of each other and of any one
// cabinet. Each just fires occasionally and publishes on its own topic.

const mqtt = require('mqtt');
const config = require('./config');
const { generateNfcScan } = require('./nfc_reader');
const { generateCreditTransaction } = require('./coin_card_reader');
const { generateButtonPress } = require('./setting_button');

const client = mqtt.connect(config.mqttBrokerUrl);

client.on('connect', () => {
    console.log('Shared-IO node connected');

    scheduleNfcScans();
    scheduleCreditTransactions();
    scheduleButtonPresses();
});

client.on('error', (error) => {
    console.log(`MQTT Error: ${error.message}`);
});

function scheduleNfcScans() {
    const delay = Math.floor(Math.random() * 8000) + 4000; // every 4-12s
    setTimeout(() => {
        publish(config.topics.nfcScan, generateNfcScan());
        scheduleNfcScans();
    }, delay);
}

function scheduleCreditTransactions() {
    const delay = Math.floor(Math.random() * 10000) + 5000; // every 5-15s
    setTimeout(() => {
        publish(config.topics.creditTransaction, generateCreditTransaction());
        scheduleCreditTransactions();
    }, delay);
}

function scheduleButtonPresses() {
    const delay = Math.floor(Math.random() * 15000) + 10000; // every 10-25s
    setTimeout(() => {
        publish(config.topics.buttonPress, generateButtonPress());
        scheduleButtonPresses();
    }, delay);
}

function publish(topic, event) {
    const payload = {
        venueId: config.venueId,
        ...event
    };
    const message = JSON.stringify(payload);
    client.publish(topic, message);
    console.log(`Published to ${topic}: ${message}`);
}
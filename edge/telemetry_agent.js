// edge/telemetry_agent.js
//
// The only file that bridges "silent" local devices (comfort fan, and
// anything similar added later) to the cloud. It imports device modules
// directly - same process, no network - then publishes what it finds
// over MQTT. The devices themselves never import mqtt or know this
// file exists.
//
// Run with: node telemetry_agent.js

require('dotenv').config();
const mqtt = require('mqtt');
const { getFanStatus } = require('./fan/actuators/fan_motor');

const mqttBrokerUrl = process.env.MQTT_BROKER_URL || 'mqtt://broker.hivemq.com:1883';
const venueId = process.env.VENUE_ID || 'venue-01';
const REPORT_INTERVAL_MS = 30000;

const client = mqtt.connect(mqttBrokerUrl);

client.on('connect', () => {
    console.log('Telemetry agent connected');
    scheduleReports();
});

client.on('error', (error) => {
    console.log(`MQTT Error: ${error.message}`);
});

function scheduleReports() {
    setInterval(reportFanHealth, REPORT_INTERVAL_MS);
}

function reportFanHealth() {
    // Direct function call - no MQTT between telemetry_agent and the fan.
    const fanStatus = getFanStatus();

    const payload = {
        deviceId: 'fan-01',
        deviceType: 'comfort-fan',
        status: fanStatus.status,
        currentSpeed: fanStatus.currentSpeed,
        timestamp: Date.now()
    };

    const topic = `venue/${venueId}/device/fan-01/health`;
    const message = JSON.stringify(payload);

    client.publish(topic, message);
    console.log(`Published to ${topic}: ${message}`);
}
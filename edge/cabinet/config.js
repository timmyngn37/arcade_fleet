// edge/cabinet/config.js

require('dotenv').config();

const cabinetId = process.env.CABINET_ID || 'A';
const venueId = process.env.VENUE_ID || 'venue-01';
const mqttBrokerUrl = process.env.MQTT_BROKER_URL || 'mqtt://broker.hivemq.com:1883';

module.exports = {
    cabinetId,
    venueId,
    mqttBrokerUrl,
    topics: {
        touchInput: `venue/${venueId}/cabinet/${cabinetId}/input/touch`,
        motionInput: `venue/${venueId}/cabinet/${cabinetId}/input/motion`,
        actuatorCommand: `venue/${venueId}/cabinet/${cabinetId}/actuator/cmd`,
        healthCheck: `venue/${venueId}/cabinet/${cabinetId}/health`
    }
};
// edge/shared-io/config.js
//

require('dotenv').config();

const venueId = process.env.VENUE_ID || 'venue-01';
const mqttBrokerUrl = process.env.MQTT_BROKER_URL || 'mqtt://broker.hivemq.com:1883';

module.exports = {
    venueId,
    mqttBrokerUrl,
    topics: {
        nfcScan: `venue/${venueId}/shared-io/nfc/scan`,
        creditTransaction: `venue/${venueId}/shared-io/credit/transaction`,
        buttonPress: `venue/${venueId}/shared-io/buttons/press`
    }
};
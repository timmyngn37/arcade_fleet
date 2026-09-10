// edge/cabinet/index.js
//
// Entry point for one cabinet. Run with:
//   CABINET_ID=A node index.js
//   CABINET_ID=B node index.js
//
// This is the only file in the cabinet node that knows about MQTT.
// Sensors and actuators are pure modules - this file is the wiring.

const mqtt = require('mqtt');
const config = require('./config');

const { generateTouchEvent } = require('./sensors/touch');
const { generateMotionEvent } = require('./sensors/motion');
const { triggerHaptic } = require('./actuators/screen');
const { setLedState } = require('./actuators/led');

const client = mqtt.connect(config.mqttBrokerUrl);

let noteId = 0;

client.on('connect', () => {
    console.log(`Cabinet ${config.cabinetId} connected`);
    setLedState('idle');

    // Announce this cabinet is online, for device-management-service to
    // pick up - separate concern from gameplay/actuator topics.
    client.publish(
        `venue/${config.venueId}/device/${config.cabinetId}/status`,
        JSON.stringify({ status: 'online', capabilities: ['touch', 'motion', 'haptic', 'led'] })
    );

    client.subscribe(config.topics.actuatorCommand);
    scheduleNextInputEvent();
});

client.on('message', (topic, message) => {
    if (topic === config.topics.actuatorCommand) handleActuatorCommand(message);
});

client.on('error', (error) => {
    console.log(`MQTT Error: ${error.message}`);
});

function scheduleNextInputEvent() {
    const delay = Math.floor(Math.random() * 600) + 300;
    setTimeout(() => {
        publishNextInputEvent();
        scheduleNextInputEvent();
    }, delay);
}

function publishNextInputEvent() {
    noteId++;

    const isMotion = Math.random() < 0.3;

    if (isMotion) {
        const event = generateMotionEvent(noteId);
        publish(config.topics.motionInput, event);
    } else {
        const event = generateTouchEvent(noteId);
        publish(config.topics.touchInput, event);
    }
}

function publish(topic, event) {
    const payload = {
        cabinetId: config.cabinetId,
        venueId: config.venueId,
        ...event
    };
    const message = JSON.stringify(payload);
    client.publish(topic, message);
    console.log(`Published to ${topic}: ${message}`);
}

function handleActuatorCommand(message) {
    let command;
    try {
        command = JSON.parse(message.toString());
    } catch (error) {
        console.log(`Ignoring malformed actuator command: ${error.message}`);
        return;
    }

    if (command.actuator === 'haptic') {
        triggerHaptic(command.intensity);
    } else if (command.actuator === 'led') {
        setLedState(command.state);
    } else {
        console.log(`Unknown actuator command: ${JSON.stringify(command)}`);
    }
}
// edge/comfort-fan/actuators/fan_motor.js

let currentSpeed = 'off';

// Simulates an occasional hardware fault, just so the health check
// has something other than 'ok' to report sometimes.
let isFaulty = false;

function setFanSpeed(speed) {
    if (isFaulty) {
        console.log('[FAN] Ignoring command - fan is currently faulty');
        return;
    }
    if (speed !== currentSpeed) {
        currentSpeed = speed;
        console.log(`[FAN] Speed changed to: ${speed}`);
    }
}

function simulateRandomFault() {
    // Small chance of flipping fault state each time this is called,
    // just to give the health check something to detect.
    if (Math.random() < 0.05) {
        isFaulty = !isFaulty;
        console.log(`[FAN] Fault state changed to: ${isFaulty}`);
    }
}

function getFanStatus() {
    simulateRandomFault();
    return {
        status: isFaulty ? 'fault' : 'ok',
        currentSpeed: currentSpeed
    };
}

module.exports = { setFanSpeed, getFanStatus };
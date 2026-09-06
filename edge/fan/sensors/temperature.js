// edge/fan/sensors/temperature.js

function readTemperature() {
    return parseFloat((22 + Math.random() * 10).toFixed(1));
}

module.exports = { readTemperature };
// edge/fan/sensors/humidity.js

function readHumidity() {
    return parseFloat((40 + Math.random() * 30).toFixed(1));
}

module.exports = { readHumidity };
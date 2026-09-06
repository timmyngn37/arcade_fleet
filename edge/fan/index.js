// edge/fan/index.js

const { readTemperature } = require('./sensors/temperature');
const { readHumidity } = require('./sensors/humidity');
const { setFanSpeed } = require('./actuators/fan_motor');

function evaluateComfort() {
    const temp = readTemperature();
    const humidity = readHumidity();

    console.log(`Ambient reading -> temp: ${temp}°C, humidity: ${humidity}%`);

    if (temp > 29) setFanSpeed('high');
    else if (temp > 25) setFanSpeed('medium');
    else setFanSpeed('off');
}

setInterval(evaluateComfort, 5000);
console.log('Comfort fan running (local only, no MQTT)');
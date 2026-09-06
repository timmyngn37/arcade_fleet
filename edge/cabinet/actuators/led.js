// edge/cabinet/actuators/led.js

function setLedState(state) {
  console.log(`[LED] State changed to: ${state}`);
}
 
module.exports = { setLedState };
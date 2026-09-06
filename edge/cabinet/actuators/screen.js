// edge/cabinet/actuators/screen.js

function triggerHaptic(intensity) {
  console.log(`[HAPTIC] Firing at intensity: ${intensity}`);
}
 
module.exports = { triggerHaptic };
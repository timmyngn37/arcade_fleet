// edge/cabinet/sensors/motion.js

function generateMotionEvent(noteId) {
  const gestures = ['push', 'raise'];
  const gesture = gestures[Math.floor(Math.random() * gestures.length)];

  return {
    type: 'motion',
    noteId: noteId,
    gesture: gesture,
    direction: Math.random() < 0.5 ? 'left' : 'right',
    amplitude: Number.parseFloat((Math.random() * 10).toFixed(2)),
    speed: Number.parseFloat((Math.random() * 5).toFixed(2)),
    timestamp: Date.now()
  };
}

module.exports = { generateMotionEvent };
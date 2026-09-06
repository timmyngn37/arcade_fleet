// edge/cabinet/sensors/touch.js

function generateTouchEvent(noteId) {
  const idealTimestamp = Date.now();
  const timingErrorMs = Math.floor(Math.random() * 200) - 100;
  const actualTimestamp = idealTimestamp + timingErrorMs;
 
  return {
    type: 'touch',
    noteId: noteId,
    idealTimestamp: idealTimestamp,
    actualTimestamp: actualTimestamp
  };
}
 
module.exports = { generateTouchEvent };
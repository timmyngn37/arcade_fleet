// edge/shared-io/nfc_reader.js

// Simulates NFC scans for known cards and a guest card.
// Each scan generates a random card ID from the known list or a guest card.
const knownCards = ['card-001', 'card-002', 'card-003', 'guest'];

function generateNfcScan() {
  const cardId = knownCards[Math.floor(Math.random() * knownCards.length)];

  return {
    type: 'nfcScan',
    cardId: cardId,
    isGuest: cardId === 'guest',
    timestamp: Date.now()
  };
}

module.exports = { generateNfcScan };
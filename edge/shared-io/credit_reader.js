// edge/shared-io/credit_reader.js

function generateCreditTransaction() {
    const methods = ['coin', 'card'];
    const method = methods[Math.floor(Math.random() * methods.length)];

    return {
        type: 'creditTransaction',
        method: method,
        amount: method === 'coin' ? 1 : parseFloat((Math.random() * 5 + 1).toFixed(2)),
        timestamp: Date.now()
    };
}

module.exports = { generateCreditTransaction };
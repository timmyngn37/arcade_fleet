// edge/shared-io/buttons.js

function generateButtonPress() {
    const buttons = ['calibrate', 'menu', 'confirm'];
    const button = buttons[Math.floor(Math.random() * buttons.length)];

    return {
        type: 'buttonPress',
        button: button,
        timestamp: Date.now()
    };
}

module.exports = { generateButtonPress };
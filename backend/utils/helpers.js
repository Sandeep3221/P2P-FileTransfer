const crypto = require('crypto');

function generateTransferId() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = '';
    for (let i = 0; i < 10; i++) {
        const randomByte = crypto.randomBytes(1)[0];
        result += chars[randomByte % chars.length];
    }
    return result;
}

function generateToken() {
    return crypto.randomBytes(16).toString('hex'); // 32 chars long
}

module.exports = {
    generateTransferId,
    generateToken
};

const { handleMessage } = require('./handler');
const { removePeer } = require('./state');

function setupWebSocket(wss) {
    wss.on('connection', (ws, req) => {
        let malformedCount = 0;

        ws.on('error', (err) => {
            console.error('[WS ERROR]', err.message);
        });

        // Per-connection fixed-window rate limiting (30 messages per minute)
        let messageCount = 0;
        let windowStart = Date.now();

        ws.on('message', (message, isBinary) => {
            if (isBinary) {
                ws.close(1003, 'Binary data not supported');
                return;
            }

            // Rate limiting check
            const now = Date.now();
            if (now - windowStart > 60000) {
                messageCount = 0;
                windowStart = now;
            }
            messageCount++;
            
            if (messageCount > 30) {
                malformedCount++;
                if (malformedCount >= 3) {
                    ws.close(1008, 'Rate limit exceeded repeatedly');
                }
                return;
            }

            // Parse and handle
            try {
                // Ensure payload size is within bounds
                if (message.length > 64 * 1024) {
                    throw new Error('Payload too large');
                }

                const data = JSON.parse(message);
                const updatedPeerId = handleMessage(ws, data, ws.peerId || null);
                if (updatedPeerId) {
                    ws.peerId = updatedPeerId;
                }
            } catch (err) {
                malformedCount++;
                if (malformedCount >= 3) {
                    ws.close(1008, 'Too many malformed messages');
                } else {
                    if (ws.readyState === 1) {
                        ws.send(JSON.stringify({
                            version: '1',
                            type: 'error',
                            code: 'BAD_REQUEST',
                            message: 'Malformed message'
                        }));
                    }
                }
            }
        });

        ws.on('close', () => {
            if (ws.peerId) {
                removePeer(ws.peerId);
            }
        });
    });
}

module.exports = setupWebSocket;

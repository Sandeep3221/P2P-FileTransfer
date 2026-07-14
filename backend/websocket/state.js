const peers = new Map(); // peerId -> { ws, role, transferId }
const sessions = new Map(); // transferId -> { token, senderId, receiverId }

function getPeer(peerId) {
    return peers.get(peerId);
}

function setPeer(peerId, data) {
    peers.set(peerId, data);
}

function removePeer(peerId) {
    const peer = peers.get(peerId);
    if (!peer) return;

    const { transferId, role } = peer;
    peers.delete(peerId);

    if (transferId) {
        const session = sessions.get(transferId);
        if (session) {
            // Notify the other peer
            let otherPeerId = null;
            if (role === 'sender') {
                otherPeerId = session.receiverId;
                sessions.delete(transferId); // Session dies if sender leaves
            } else if (role === 'receiver') {
                otherPeerId = session.senderId;
                session.receiverId = null; // Sender stays, receiver removed
            }

            if (otherPeerId) {
                const otherPeer = peers.get(otherPeerId);
                if (otherPeer && otherPeer.ws.readyState === 1 /* OPEN */) {
                    otherPeer.ws.send(JSON.stringify({
                        version: '1',
                        type: 'peer-disconnected',
                        peerId,
                        role
                    }));
                }
            }
        }
    }
}

function getSession(transferId) {
    return sessions.get(transferId);
}

function createSessionData(transferId, token, senderId) {
    const session = {
        transferId,
        token,
        senderId,
        receiverId: null
    };
    sessions.set(transferId, session);
    return session;
}

module.exports = {
    getPeer,
    setPeer,
    removePeer,
    getSession,
    createSessionData
};

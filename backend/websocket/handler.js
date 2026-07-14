const { v4: uuidv4 } = require('uuid');
const { getPeer, setPeer, removePeer, getSession, createSessionData } = require('./state');
const { generateTransferId, generateToken } = require('../utils/helpers');

function send(ws, obj) {
    if (ws.readyState === 1) {
        ws.send(JSON.stringify(obj));
    }
}

function sendError(ws, code, message) {
    send(ws, {
        version: '1',
        type: 'error',
        code,
        message
    });
}

function handleMessage(ws, data, currentPeerId) {
    if (data.version !== '1') {
        sendError(ws, 'UNSUPPORTED_VERSION', 'Only version 1 is supported');
        return currentPeerId;
    }

    switch (data.type) {
        case 'register':
            return handleRegister(ws, data);
        
        case 'create-session':
            handleCreateSession(ws, currentPeerId);
            break;
            
        case 'join-session':
            handleJoinSession(ws, data, currentPeerId);
            break;
            
        case 'approve-join':
            handleApproveJoin(ws, data, currentPeerId);
            break;

        case 'offer':
        case 'answer':
        case 'ice-candidate':
            handleSignaling(ws, data, currentPeerId);
            break;
            
        case 'heartbeat':
            send(ws, { version: '1', type: 'heartbeat-ack' });
            break;
            
        case 'disconnect':
            if (currentPeerId) {
                removePeer(currentPeerId);
            }
            break;
            
        default:
            sendError(ws, 'UNKNOWN_TYPE', 'Unknown message type');
    }

    return currentPeerId;
}

function handleRegister(ws, data) {
    const peerId = uuidv4();
    setPeer(peerId, { ws, role: data.role || 'receiver', transferId: null });
    send(ws, {
        version: '1',
        type: 'registered',
        peerId
    });
    return peerId;
}

function handleCreateSession(ws, peerId) {
    if (!peerId) {
        peerId = handleRegister(ws, { role: 'sender' });
        ws.peerId = peerId;
    }
    const peer = getPeer(peerId);
    if (!peer) return;

    if (peer.role !== 'sender') {
        sendError(ws, 'FORBIDDEN', 'Only sender can create a session');
        return;
    }

    const transferId = generateTransferId();
    const token = generateToken();
    
    createSessionData(transferId, token, peerId);
    peer.transferId = transferId;
    
    send(ws, {
        version: '1',
        type: 'session-created',
        transferId,
        token
    });
}

function handleJoinSession(ws, data, peerId) {
    if (!peerId) {
        peerId = handleRegister(ws, { role: 'receiver' });
        ws.peerId = peerId;
    }
    const peer = getPeer(peerId);
    if (!peer) return;
    
    const { transferId } = data;
    const session = getSession(transferId);
    if (!session) {
        sendError(ws, 'NOT_FOUND', 'Session not found');
        return;
    }
    
    if (session.receiverId) {
        sendError(ws, 'FULL', 'Session already has a receiver');
        return;
    }
    
    // Notify sender of join request
    const sender = getPeer(session.senderId);
    if (sender && sender.ws) {
        send(sender.ws, {
            version: '1',
            type: 'join-request',
            receiverId: peerId
        });
    } else {
        sendError(ws, 'SENDER_OFFLINE', 'Sender is offline');
    }
}

function handleApproveJoin(ws, data, peerId) {
    const { transferId, token, receiverId } = data;
    
    if (!peerId) {
        sendError(ws, 'UNAUTHORIZED', 'Not registered');
        return;
    }
    
    const session = getSession(transferId);
    if (!session || session.senderId !== peerId) {
        sendError(ws, 'UNAUTHORIZED', 'Not authorized to approve for this session');
        return;
    }
    
    if (session.token !== token) {
        sendError(ws, 'UNAUTHORIZED', 'Invalid token');
        return;
    }
    
    const receiver = getPeer(receiverId);
    if (!receiver) {
        sendError(ws, 'NOT_FOUND', 'Receiver not found');
        return;
    }
    
    session.receiverId = receiverId;
    receiver.transferId = transferId;
    
    // Notify receiver
    send(receiver.ws, {
        version: '1',
        type: 'session-joined',
        transferId
    });
    
    // Notify sender that peer joined
    send(ws, {
        version: '1',
        type: 'peer-joined',
        peerId: receiverId,
        role: receiver.role
    });
}

function handleSignaling(ws, data, peerId) {
    if (!peerId) {
        // Silently ignore to prevent frontend crashes on delayed ICE candidates after reconnect
        return;
    }
    
    const peer = getPeer(peerId);
    if (!peer || !peer.transferId) {
        sendError(ws, 'UNAUTHORIZED', 'Not part of a session');
        return;
    }
    
    const session = getSession(peer.transferId);
    if (!session) {
        sendError(ws, 'NOT_FOUND', 'Session not found');
        return;
    }
    
    const isSender = session.senderId === peerId;
    const targetId = isSender ? session.receiverId : session.senderId;
    
    if (!targetId) {
        sendError(ws, 'NOT_FOUND', 'Target peer not found in session');
        return;
    }
    
    const targetPeer = getPeer(targetId);
    if (!targetPeer || !targetPeer.ws) {
        sendError(ws, 'TARGET_OFFLINE', 'Target peer is offline');
        return;
    }
    
    const response = { version: '1' };
    
    if (data.type === 'offer') {
        response.type = 'relay-offer';
        response.sdp = data.sdp;
    } else if (data.type === 'answer') {
        response.type = 'relay-answer';
        response.sdp = data.sdp;
    } else if (data.type === 'ice-candidate') {
        response.type = 'relay-ice-candidate';
        response.candidate = data.candidate;
        response.sdpMid = data.sdpMid;
        response.sdpMLineIndex = data.sdpMLineIndex;
    }
    
    send(targetPeer.ws, response);
}

module.exports = {
    handleMessage
};

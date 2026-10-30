const roomStore = require('../services/roomStore');

/**
 * Socket.IO Handler for SweetPlay
 * Manages:
 * 1. Campus Impostor and Voice Room lobbies (join, seat assignments, ready states, host controls).
 * 2. In-room temporary group chat with 500-char limits, trimming, and rate limiting.
 * 3. Audio-only WebRTC signaling (mesh topology) with strict room boundary validation.
 */
module.exports = function registerLobbyHandler(io) {
  io.on('connection', (socket) => {
    // -------------------------------------------------------------------------
    // 1. Lobby Management (Create, Join, Ready, Start, Reset, Leave)
    // -------------------------------------------------------------------------

    // Create Room Event
    socket.on('lobby:create', ({ nickname, mode, customCode, type = 'game', name }, callback) => {
      try {
        const room = roomStore.createRoom({
          code: customCode,
          mode,
          type,
          name,
          hostSocketId: socket.id,
          nickname
        });

        // Join Socket.IO room channel
        socket.join(room.code);

        const response = {
          success: true,
          roomCode: room.code,
          room,
          myPlayer: room.players[0]
        };

        if (typeof callback === 'function') callback(response);
        socket.emit('lobby:joined', response);
        io.to(room.code).emit('lobby:update', { room });
      } catch (err) {
        const errorResponse = { success: false, message: err.message };
        if (typeof callback === 'function') callback(errorResponse);
        socket.emit('lobby:error', errorResponse);
      }
    });

    // Join Room Event
    socket.on('lobby:join', ({ roomCode, nickname }, callback) => {
      try {
        const cleanCode = roomStore.normalizeCode(roomCode);
        const { room, player } = roomStore.joinRoom({
          code: cleanCode,
          socketId: socket.id,
          nickname
        });

        // Join Socket.IO room channel
        socket.join(room.code);

        const response = {
          success: true,
          roomCode: room.code,
          room,
          myPlayer: player
        };

        if (typeof callback === 'function') callback(response);
        socket.emit('lobby:joined', response);

        // Broadcast updated state to all connected clients in the room
        io.to(room.code).emit('lobby:update', { room });

        // Send join toast to others
        socket.to(room.code).emit('lobby:toast', {
          message: `${player.nickname} joined Seat ${player.seatNumber}!`,
          icon: '👋'
        });
      } catch (err) {
        const errorResponse = { success: false, message: err.message };
        if (typeof callback === 'function') callback(errorResponse);
        socket.emit('lobby:error', errorResponse);
      }
    });

    // Toggle Ready Event (Campus Impostor)
    socket.on('lobby:toggle_ready', ({ roomCode }, callback) => {
      try {
        const cleanCode = roomStore.normalizeCode(roomCode);
        const { room, player } = roomStore.toggleReady({
          code: cleanCode,
          socketId: socket.id
        });

        const statusMsg = player.isReady ? 'Ready' : 'Waiting';
        io.to(room.code).emit('lobby:update', { room });
        io.to(room.code).emit('lobby:toast', {
          message: `${player.nickname} is now ${statusMsg}!`,
          icon: player.isReady ? '✓' : '⏳'
        });

        if (typeof callback === 'function') callback({ success: true, isReady: player.isReady });
      } catch (err) {
        if (typeof callback === 'function') callback({ success: false, message: err.message });
        socket.emit('lobby:error', { success: false, message: err.message });
      }
    });

    // Host Start Game Event (Campus Impostor)
    socket.on('lobby:start_game', ({ roomCode }, callback) => {
      try {
        const cleanCode = roomStore.normalizeCode(roomCode);
        const room = roomStore.startGame(cleanCode, socket.id);

        io.to(room.code).emit('lobby:update', { room });
        io.to(room.code).emit('lobby:started', {
          message: 'Lobby ready! All 3+ players ready. (Game round logic will be added in a future phase).',
          room
        });

        if (typeof callback === 'function') callback({ success: true });
      } catch (err) {
        if (typeof callback === 'function') callback({ success: false, message: err.message });
        socket.emit('lobby:error', { success: false, message: err.message });
      }
    });

    // Host Reset Lobby Event (Campus Impostor)
    socket.on('lobby:reset_lobby', ({ roomCode }, callback) => {
      try {
        const cleanCode = roomStore.normalizeCode(roomCode);
        const room = roomStore.resetLobby(cleanCode, socket.id);

        io.to(room.code).emit('lobby:update', { room });
        io.to(room.code).emit('lobby:toast', {
          message: 'Host reset the lobby to waiting state.',
          icon: '🔄'
        });

        if (typeof callback === 'function') callback({ success: true });
      } catch (err) {
        if (typeof callback === 'function') callback({ success: false, message: err.message });
        socket.emit('lobby:error', { success: false, message: err.message });
      }
    });

    // Leave Room Event
    socket.on('lobby:leave', ({ roomCode }) => {
      const result = roomStore.removePlayer(socket.id);
      if (result) {
        socket.leave(result.roomCode);

        // If player was in voice, notify other peers to tear down connection
        if (result.wasInVoice) {
          socket.to(result.roomCode).emit('voice:peer_left', { peerId: socket.id });
        }

        if (!result.roomDeleted) {
          io.to(result.roomCode).emit('lobby:update', { room: result.room });
          io.to(result.roomCode).emit('lobby:toast', {
            message: `${result.leftPlayer.nickname} left the room.`,
            icon: '🚪'
          });
          if (result.newHost) {
            io.to(result.roomCode).emit('lobby:toast', {
              message: `${result.newHost.nickname} is now the Host!`,
              icon: '👑'
            });
          }
        }
      }
    });

    // -------------------------------------------------------------------------
    // 2. Room Group Chat (In-Memory, Membership Validation, Rate Limits)
    // -------------------------------------------------------------------------

    // Send Chat Message
    socket.on('chat:send', ({ roomCode, text }, callback) => {
      try {
        const cleanCode = roomStore.normalizeCode(roomCode);
        const { room, message } = roomStore.addChatMessage({
          roomCode: cleanCode,
          socketId: socket.id,
          text
        });

        // Broadcast to all members in this room (including sender)
        io.to(room.code).emit('chat:message', message);

        if (typeof callback === 'function') callback({ success: true, message });
      } catch (err) {
        const errorMsg = err.message || 'Failed to send message.';
        if (typeof callback === 'function') callback({ success: false, message: errorMsg });
        socket.emit('chat:error', { message: errorMsg });
      }
    });

    // Get Chat History
    socket.on('chat:history', ({ roomCode }, callback) => {
      try {
        const cleanCode = roomStore.normalizeCode(roomCode);
        const room = roomStore.getRoom(cleanCode);
        if (!room) {
          if (typeof callback === 'function') callback({ success: false, message: 'Room not found.' });
          return;
        }

        const player = room.players.find((p) => p.id === socket.id);
        if (!player) {
          if (typeof callback === 'function') callback({ success: false, message: 'Not a room member.' });
          return;
        }

        const messages = roomStore.getRecentMessages(cleanCode);
        if (typeof callback === 'function') callback({ success: true, messages });
      } catch (err) {
        if (typeof callback === 'function') callback({ success: false, message: err.message });
      }
    });

    // -------------------------------------------------------------------------
    // 3. Audio-Only WebRTC Signaling (Socket.IO for Signaling Only)
    // -------------------------------------------------------------------------

    // Join Voice in Room
    socket.on('voice:join', ({ roomCode, isMuted = true }, callback) => {
      try {
        const cleanCode = roomStore.normalizeCode(roomCode);
        const { room, player } = roomStore.setVoiceState({
          roomCode: cleanCode,
          socketId: socket.id,
          inVoice: true,
          isMuted: isMuted !== false
        });

        // Get all existing peers who are already in voice in this room
        const existingPeers = roomStore.getVoicePeers(cleanCode, socket.id);

        // Notify existing voice members about this new peer
        socket.to(cleanCode).emit('voice:peer_joined', {
          peerId: socket.id,
          nickname: player.nickname,
          seatNumber: player.seatNumber,
          avatar: player.avatar,
          isMuted: player.isMuted
        });

        // Broadcast room state update so seat cards show voice/mic badges
        io.to(cleanCode).emit('lobby:update', { room });

        if (typeof callback === 'function') {
          callback({
            success: true,
            myPeerId: socket.id,
            isMuted: player.isMuted,
            existingPeers
          });
        }
      } catch (err) {
        if (typeof callback === 'function') callback({ success: false, message: err.message });
        socket.emit('voice:error', { message: err.message });
      }
    });

    // Update Voice State (Mic Mute / Speaker Deafen)
    socket.on('voice:state', ({ roomCode, isMuted, isDeafened }, callback) => {
      try {
        const cleanCode = roomStore.normalizeCode(roomCode);
        const { room, player } = roomStore.setVoiceState({
          roomCode: cleanCode,
          socketId: socket.id,
          isMuted,
          isDeafened
        });

        // Broadcast mute state change to everyone in the room
        io.to(cleanCode).emit('voice:state_change', {
          peerId: socket.id,
          isMuted: player.isMuted,
          isDeafened: player.isDeafened
        });

        // Update room seat cards
        io.to(cleanCode).emit('lobby:update', { room });

        if (typeof callback === 'function') callback({ success: true, player });
      } catch (err) {
        if (typeof callback === 'function') callback({ success: false, message: err.message });
      }
    });

    // WebRTC Peer-to-Peer Signaling (Offer, Answer, ICE Candidate)
    // CRITICAL: Strictly validate that both sender and targetPeerId belong to the SAME room!
    socket.on('voice:signal', ({ roomCode, targetPeerId, signal }) => {
      try {
        const cleanCode = roomStore.normalizeCode(roomCode);
        const senderRoom = roomStore.getRoomBySocket(socket.id);
        const targetRoom = roomStore.getRoomBySocket(targetPeerId);

        // Security validation: Both sockets must be in the specified room
        if (!senderRoom || !targetRoom) return;
        if (senderRoom.code !== cleanCode || targetRoom.code !== cleanCode) {
          console.warn(`[Security] Blocked unauthorized cross-room voice signal from ${socket.id} to ${targetPeerId}`);
          return;
        }

        // Forward signaling payload strictly to the target peer
        io.to(targetPeerId).emit('voice:signal', {
          fromPeerId: socket.id,
          signal
        });
      } catch (err) {
        console.error('Error in voice:signal handler:', err);
      }
    });

    // Leave Voice
    socket.on('voice:leave', ({ roomCode }, callback) => {
      try {
        const cleanCode = roomStore.normalizeCode(roomCode);
        const { room } = roomStore.setVoiceState({
          roomCode: cleanCode,
          socketId: socket.id,
          inVoice: false
        });

        // Notify other peers in this room to close RTCPeerConnection and audio element
        socket.to(cleanCode).emit('voice:peer_left', { peerId: socket.id });

        // Update seat badges
        io.to(cleanCode).emit('lobby:update', { room });

        if (typeof callback === 'function') callback({ success: true });
      } catch (err) {
        if (typeof callback === 'function') callback({ success: false, message: err.message });
      }
    });

    // -------------------------------------------------------------------------
    // 4. Disconnection Cleanup
    // -------------------------------------------------------------------------
    socket.on('disconnect', () => {
      const result = roomStore.removePlayer(socket.id);
      if (result) {
        // If player was in voice, notify other peers to remove audio connection
        if (result.wasInVoice) {
          io.to(result.roomCode).emit('voice:peer_left', { peerId: socket.id });
        }

        if (!result.roomDeleted) {
          io.to(result.roomCode).emit('lobby:update', { room: result.room });
          io.to(result.roomCode).emit('lobby:toast', {
            message: `${result.leftPlayer.nickname} disconnected.`,
            icon: '⚠️'
          });
          if (result.newHost) {
            io.to(result.roomCode).emit('lobby:toast', {
              message: `${result.newHost.nickname} is now the Host!`,
              icon: '👑'
            });
          }
        }
      }
    });
  });
};

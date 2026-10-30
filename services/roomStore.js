/**
 * In-Memory Room Store for SweetPlay
 * Supports Campus Impostor game lobbies and Campus Voice Rooms.
 * 
 * Features:
 * - Temporary in-memory state (resets on server restart).
 * - 1 to 6 player seat assignments.
 * - Group chat with server-side validation, 500-char limits, and rate limiting.
 * - Voice state synchronization for WebRTC audio.
 */

class RoomStore {
  constructor() {
    // Map<roomCode, RoomObject>
    this.rooms = new Map();
    // Map<socketId, roomCode>
    this.socketToRoom = new Map();
    // Map<socketId, number[]>: sliding window of message timestamps for rate limiting
    this.chatRateLimits = new Map();

    // Pre-assigned campus avatars for seats 1-6
    this.seatAvatars = ['👨‍💻', '👩‍🔬', '🧑‍💼', '👩‍🎨', '🧑‍🏫', '🎓'];
    this.seatTags = ['CS \'25', 'Bio \'26', 'Econ \'24', 'Arch \'25', 'Math \'27', 'Campus Guest'];
  }

  /**
   * Generate an accessible, memorable campus room code
   * e.g. QUAD-104, LOUNGE-312, DORM-58, VOICE-819
   */
  generateRoomCode(preferredPrefix = null) {
    const defaultPrefixes = ['QUAD', 'DORM', 'CAMPUS', 'LOUNGE', 'SPY', 'VOICE'];
    const prefix = preferredPrefix ? preferredPrefix.toUpperCase() : defaultPrefixes[Math.floor(Math.random() * defaultPrefixes.length)];
    let code = `${prefix}-${Math.floor(100 + Math.random() * 900)}`;
    while (this.rooms.has(code)) {
      code = `${prefix}-${Math.floor(100 + Math.random() * 900)}`;
    }
    return code;
  }

  /**
   * Normalize room code (trim, uppercase)
   */
  normalizeCode(code) {
    if (!code) return '';
    return String(code).trim().toUpperCase();
  }

  /**
   * Create a new room with host
   */
  createRoom({ code, mode, type = 'game', name, hostSocketId, nickname }) {
    const isVoiceRoom = type === 'voice';
    const defaultPrefix = isVoiceRoom ? 'LOUNGE' : 'QUAD';
    const cleanCode = this.normalizeCode(code) || this.generateRoomCode(defaultPrefix);
    const cleanNick = String(nickname || 'Host').trim().slice(0, 20) || 'Host';

    if (this.rooms.has(cleanCode)) {
      throw new Error(`Room code "${cleanCode}" already exists. Please choose another code or join it.`);
    }

    let roomMode = 'Campus Impostor';
    let modeId = 'campus-impostor';
    let roomName = name ? String(name).trim().slice(0, 40) : `Campus Quad Lounge ${cleanCode}`;
    let status = 'waiting';
    let minPlayers = 3;

    if (isVoiceRoom) {
      roomMode = 'Voice Lounge';
      modeId = 'voice-lounge';
      roomName = name ? String(name).trim().slice(0, 40) : `${cleanNick}'s Voice Lounge ${cleanCode}`;
      status = 'active'; // Voice rooms are active immediately
      minPlayers = 1;
    } else if (mode === 'wordless-impostor') {
      roomMode = 'Wordless Impostor';
      modeId = 'wordless-impostor';
      roomName = name ? String(name).trim().slice(0, 40) : `Campus Quad Lounge ${cleanCode}`;
    }

    const room = {
      code: cleanCode,
      name: roomName,
      type: isVoiceRoom ? 'voice' : 'game',
      mode: roomMode,
      modeId,
      hostSocketId,
      hostName: cleanNick,
      status, // 'waiting' | 'ready' for games; 'active' for voice rooms
      createdAt: Date.now(),
      minPlayers,
      maxPlayers: 6,
      messages: [], // In-memory temporary chat messages
      players: [
        {
          id: hostSocketId,
          nickname: cleanNick,
          seatNumber: 1,
          isHost: true,
          isReady: isVoiceRoom ? true : false,
          avatar: this.seatAvatars[0],
          majorTag: this.seatTags[0],
          inVoice: false,
          isMuted: true,
          isDeafened: false
        }
      ]
    };

    this.rooms.set(cleanCode, room);
    this.socketToRoom.set(hostSocketId, cleanCode);
    return room;
  }

  /**
   * Get room by code
   */
  getRoom(code) {
    const cleanCode = this.normalizeCode(code);
    return this.rooms.get(cleanCode) || null;
  }

  /**
   * Get room by socket ID
   */
  getRoomBySocket(socketId) {
    const code = this.socketToRoom.get(socketId);
    if (!code) return null;
    return this.rooms.get(code) || null;
  }

  /**
   * List active rooms (optionally filtered by type: 'voice' | 'game' | null)
   */
  listRooms(filterType = null) {
    const list = [];
    for (const room of this.rooms.values()) {
      if (!filterType || room.type === filterType) {
        list.push({
          code: room.code,
          name: room.name,
          type: room.type,
          mode: room.mode,
          modeId: room.modeId,
          hostName: room.hostName,
          status: room.status,
          playerCount: room.players.length,
          voiceCount: room.players.filter((p) => p.inVoice).length,
          maxPlayers: room.maxPlayers,
          createdAt: room.createdAt
        });
      }
    }
    // Return newest first
    return list.sort((a, b) => b.createdAt - a.createdAt);
  }

  /**
   * Join an existing room
   */
  joinRoom({ code, socketId, nickname }) {
    const cleanCode = this.normalizeCode(code);
    const room = this.rooms.get(cleanCode);

    if (!room) {
      throw new Error(`Room "${cleanCode}" does not exist. Check the room code or create a new room.`);
    }

    if (room.type === 'game' && room.status === 'ready') {
      throw new Error(`Room "${cleanCode}" has already started.`);
    }

    if (room.players.length >= room.maxPlayers) {
      throw new Error(`Room "${cleanCode}" is full (maximum ${room.maxPlayers} players).`);
    }

    // Check if socket already in room
    const existingPlayer = room.players.find((p) => p.id === socketId);
    if (existingPlayer) {
      existingPlayer.nickname = String(nickname || existingPlayer.nickname).trim().slice(0, 20);
      return { room, player: existingPlayer };
    }

    // Clean nickname
    const cleanNick = String(nickname || `Student ${room.players.length + 1}`).trim().slice(0, 20);

    // Find lowest available seat number (1-6)
    const takenSeats = new Set(room.players.map((p) => p.seatNumber));
    let seatNumber = 1;
    for (let i = 1; i <= room.maxPlayers; i++) {
      if (!takenSeats.has(i)) {
        seatNumber = i;
        break;
      }
    }

    const player = {
      id: socketId,
      nickname: cleanNick,
      seatNumber,
      isHost: room.players.length === 0,
      isReady: room.type === 'voice' ? true : false,
      avatar: this.seatAvatars[seatNumber - 1] || '🎓',
      majorTag: this.seatTags[seatNumber - 1] || 'Campus Student',
      inVoice: false,
      isMuted: true,
      isDeafened: false
    };

    room.players.push(player);
    // Sort players by seat number
    room.players.sort((a, b) => a.seatNumber - b.seatNumber);

    this.socketToRoom.set(socketId, cleanCode);
    return { room, player };
  }

  /**
   * Add a chat message to a room with rate limiting and 500-char max
   */
  addChatMessage({ roomCode, socketId, text }) {
    const cleanCode = this.normalizeCode(roomCode);
    const room = this.rooms.get(cleanCode);

    if (!room) {
      throw new Error('Room not found.');
    }

    const player = room.players.find((p) => p.id === socketId);
    if (!player) {
      throw new Error('You must be a member of the room to send messages.');
    }

    const rawText = String(text || '').trim();
    if (!rawText) {
      throw new Error('Message cannot be empty.');
    }

    // Limit to 500 characters
    const cleanText = rawText.slice(0, 500);

    // Rate limiting: max 5 messages per 3 seconds, min 350ms between messages
    const now = Date.now();
    const timestamps = this.chatRateLimits.get(socketId) || [];
    // Keep only timestamps within last 3000ms
    const recent = timestamps.filter((t) => now - t < 3000);

    if (recent.length >= 5) {
      throw new Error('Rate limit reached: You are sending messages too fast. Please wait a moment.');
    }

    if (recent.length > 0 && now - recent[recent.length - 1] < 350) {
      throw new Error('Please wait a moment before sending another message.');
    }

    recent.push(now);
    this.chatRateLimits.set(socketId, recent);

    const message = {
      id: `msg-${now}-${Math.random().toString(36).substring(2, 7)}`,
      roomCode: cleanCode,
      senderId: socketId,
      senderName: player.nickname,
      senderSeat: player.seatNumber,
      avatar: player.avatar,
      text: cleanText,
      timestamp: now,
      timeFormatted: new Date(now).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
    };

    if (!room.messages) room.messages = [];
    room.messages.push(message);

    // Keep temporary buffer capped at last 100 messages
    if (room.messages.length > 100) {
      room.messages.splice(0, room.messages.length - 100);
    }

    return { room, message };
  }

  /**
   * Get recent messages for a room
   */
  getRecentMessages(roomCode) {
    const cleanCode = this.normalizeCode(roomCode);
    const room = this.rooms.get(cleanCode);
    if (!room || !room.messages) return [];
    return [...room.messages];
  }

  /**
   * Update a player's voice state (inVoice, isMuted, isDeafened)
   */
  setVoiceState({ roomCode, socketId, inVoice, isMuted, isDeafened }) {
    const cleanCode = this.normalizeCode(roomCode);
    const room = this.rooms.get(cleanCode);
    if (!room) throw new Error('Room not found.');

    const player = room.players.find((p) => p.id === socketId);
    if (!player) throw new Error('Player not in room.');

    if (typeof inVoice === 'boolean') player.inVoice = inVoice;
    if (typeof isMuted === 'boolean') player.isMuted = isMuted;
    if (typeof isDeafened === 'boolean') player.isDeafened = isDeafened;

    return { room, player };
  }

  /**
   * Get all other peers in the room who are currently in voice
   */
  getVoicePeers(roomCode, excludeSocketId = null) {
    const cleanCode = this.normalizeCode(roomCode);
    const room = this.rooms.get(cleanCode);
    if (!room) return [];

    return room.players
      .filter((p) => p.inVoice && p.id !== excludeSocketId)
      .map((p) => ({
        peerId: p.id,
        nickname: p.nickname,
        seatNumber: p.seatNumber,
        avatar: p.avatar,
        isMuted: p.isMuted,
        isDeafened: p.isDeafened
      }));
  }

  /**
   * Toggle player ready status (Campus Impostor)
   */
  toggleReady({ code, socketId }) {
    const cleanCode = this.normalizeCode(code);
    const room = this.rooms.get(cleanCode);
    if (!room) throw new Error('Room not found.');

    const player = room.players.find((p) => p.id === socketId);
    if (!player) throw new Error('Player not in this room.');

    player.isReady = !player.isReady;
    return { room, player };
  }

  /**
   * Check if host can start the room (Campus Impostor)
   */
  canStartGame(code, socketId) {
    const cleanCode = this.normalizeCode(code);
    const room = this.rooms.get(cleanCode);
    if (!room) return { canStart: false, reason: 'Room not found.' };

    if (room.hostSocketId !== socketId) {
      return { canStart: false, reason: 'Only the room creator (host) can start the match.' };
    }

    if (room.players.length < room.minPlayers) {
      return {
        canStart: false,
        reason: `Need at least ${room.minPlayers} players to start (currently ${room.players.length}/${room.maxPlayers}).`
      };
    }

    const readyCount = room.players.filter((p) => p.isReady).length;
    if (readyCount < room.minPlayers) {
      return {
        canStart: false,
        reason: `At least ${room.minPlayers} players must be Ready (currently ${readyCount}/${room.players.length} ready).`
      };
    }

    return { canStart: true, readyCount, totalPlayers: room.players.length };
  }

  /**
   * Start the lobby (Campus Impostor)
   */
  startGame(code, socketId) {
    const check = this.canStartGame(code, socketId);
    if (!check.canStart) {
      throw new Error(check.reason);
    }

    const cleanCode = this.normalizeCode(code);
    const room = this.rooms.get(cleanCode);
    room.status = 'ready';
    return room;
  }

  /**
   * Reset room back to waiting
   */
  resetLobby(code, socketId) {
    const cleanCode = this.normalizeCode(code);
    const room = this.rooms.get(cleanCode);
    if (!room) throw new Error('Room not found.');
    if (room.hostSocketId !== socketId) throw new Error('Only the host can reset the lobby.');

    room.status = 'waiting';
    room.players.forEach((p) => {
      p.isReady = false;
    });
    return room;
  }

  /**
   * Remove a player when they leave or disconnect
   */
  removePlayer(socketId) {
    const roomCode = this.socketToRoom.get(socketId);
    if (!roomCode) return null;

    this.socketToRoom.delete(socketId);
    this.chatRateLimits.delete(socketId);

    const room = this.rooms.get(roomCode);
    if (!room) return null;

    const playerIndex = room.players.findIndex((p) => p.id === socketId);
    if (playerIndex === -1) return null;

    const [removedPlayer] = room.players.splice(playerIndex, 1);
    const wasInVoice = removedPlayer.inVoice;

    // If room is now empty, delete it
    if (room.players.length === 0) {
      this.rooms.delete(roomCode);
      return { roomCode, roomDeleted: true, leftPlayer: removedPlayer, wasInVoice };
    }

    // If host left, transfer host to next player (seat 1 or first remaining)
    let newHost = null;
    if (room.hostSocketId === socketId) {
      room.players[0].isHost = true;
      room.hostSocketId = room.players[0].id;
      room.hostName = room.players[0].nickname;
      newHost = room.players[0];
    }

    return {
      roomCode,
      room,
      roomDeleted: false,
      leftPlayer: removedPlayer,
      newHost,
      wasInVoice
    };
  }

  /**
   * Clean up all rooms (for tests or maintenance)
   */
  clear() {
    this.rooms.clear();
    this.socketToRoom.clear();
    this.chatRateLimits.clear();
  }
}

// Export singleton instance
module.exports = new RoomStore();

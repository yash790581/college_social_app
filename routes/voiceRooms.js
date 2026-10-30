const express = require('express');
const router = express.Router();
const roomStore = require('../services/roomStore');
const { getIceServers } = require('../config/webrtc');

/**
 * GET /voice-rooms
 * Render Campus Voice Rooms Directory & Room Creation Hub
 */
router.get('/', (req, res) => {
  const activeRooms = roomStore.listRooms('voice');

  const pageData = {
    title: 'Voice Rooms | Campus Audio Lounges | SweetPlay',
    activeNav: 'rooms',
    brandName: 'SweetPlay',
    tagline: 'Play with your campus. Meet players beyond it when you choose.',
    prototypeBadge: 'Voice & Chat',
    prototypeNotice: 'Drop into a casual campus voice room or host your own. In-memory temporary audio prototype.',
    activeRooms,
    roomActions: {
      createLabel: 'Create Voice Room',
      createDesc: 'Host an audio lounge with up to 6 seats',
      joinLabel: 'Join with Code',
      joinDesc: 'Enter a classmate’s voice room code'
    },
    suggestedThemes: [
      { id: 'study', title: 'Quad Study Table', icon: '📚', tag: 'Study & Lo-Fi' },
      { id: 'hangout', title: 'Campus Quad Chat', icon: '☕', tag: 'Casual Hangout' },
      { id: 'gaming', title: 'Campus Gaming Squad', icon: '🎮', tag: 'Gaming Audio' },
      { id: 'project', title: 'Dorm Collab & Projects', icon: '💻', tag: 'Team Collab' }
    ]
  };

  res.render('voice-rooms', pageData);
});

/**
 * GET /voice-rooms/room/:roomCode
 * Render a specific voice room stage with 6 seats, audio controls, and shared chat
 */
router.get('/room/:roomCode', (req, res) => {
  const rawCode = req.params.roomCode;
  const cleanCode = roomStore.normalizeCode(rawCode);
  const room = roomStore.getRoom(cleanCode);

  const pageData = {
    title: `Voice Room ${cleanCode} | SweetPlay`,
    activeNav: 'rooms',
    brandName: 'SweetPlay',
    tagline: 'Play with your campus. Meet players beyond it when you choose.',
    prototypeBadge: 'Voice & Chat',
    prototypeNotice: 'Audio-only room with real-time text chat. Microphones join muted by default.',
    roomCode: cleanCode,
    roomName: room ? room.name : `Campus Voice Lounge ${cleanCode}`,
    roomType: 'voice',
    roomExists: !!room,
    maxPlayers: 6
  };

  res.render('voice-room', pageData);
});

module.exports = router;

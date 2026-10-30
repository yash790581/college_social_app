const express = require('express');
const router = express.Router();
const roomStore = require('../services/roomStore');

/**
 * GET /campus-impostor
 * Render Campus Impostor Mode Selection & Room Hub
 */
router.get('/', (req, res) => {
  const pageData = {
    title: 'Campus Impostor | Mode Selection & Lobby Hub | SweetPlay',
    activeNav: 'games',
    brandName: 'SweetPlay',
    tagline: 'Play with your campus. Meet players beyond it when you choose.',
    prototypeBadge: 'Real-Time Lobby',
    prototypeNotice: 'Pick a mode, create a room, or join a classmate with a room code.',
    gameTitle: 'Campus Impostor',
    gameSubtitle: 'A quick campus social deduction game. Share clues, read the room, and see who is bluffing.',
    modes: [
      {
        id: 'campus-impostor',
        name: 'Campus Impostor',
        tag: 'CLASSIC',
        badge: 'For the whole group',
        icon: '🕵️',
        summary: 'Read the room',
        description: 'Share clues, listen closely, and decide together who is bluffing.',
        playersLabel: '3–6 Players Real-Time',
        modeId: 'campus-impostor'
      },
      {
        id: 'wordless-impostor',
        name: 'Wordless Impostor',
        tag: 'CHALLENGE',
        badge: 'A little trickier',
        icon: '🤐',
        summary: 'A trickier bluffing round',
        description: 'One role starts with less information. Can the rest of the table spot the bluff?',
        playersLabel: '3–6 Players Real-Time',
        modeId: 'wordless-impostor'
      }
    ],
    roomActions: {
      createLabel: 'Create a room',
      createDesc: 'Start a room and invite your group',
      searchLabel: 'Join a room',
      searchDesc: 'Enter a classmate’s room code'
    }
  };

  res.render('impostor-modes', pageData);
});

/**
 * GET /campus-impostor/room/:roomCode
 * Render real-time waiting lobby for a specific room
 */
router.get('/room/:roomCode', (req, res) => {
  const rawCode = req.params.roomCode;
  const cleanCode = roomStore.normalizeCode(rawCode);
  const room = roomStore.getRoom(cleanCode);

  const modeParam = req.query.mode || (room ? room.modeId : 'campus-impostor');
  const activeModeName = room ? room.mode : (modeParam === 'wordless-impostor' ? 'Wordless Impostor' : 'Campus Impostor');

  const pageData = {
    title: `Lobby ${cleanCode} | Campus Impostor | SweetPlay`,
    activeNav: 'games',
    brandName: 'SweetPlay',
    tagline: 'Play with your campus. Meet players beyond it when you choose.',
    prototypeBadge: 'Real-Time Lobby',
    prototypeNotice: 'Invite your group with the room code. Room activity is a prototype and resets when the server restarts.',
    roomCode: cleanCode,
    roomName: room ? room.name : `Campus Quad Lounge ${cleanCode}`,
    selectedMode: activeModeName,
    modeId: modeParam,
    roomExists: !!room,
    minPlayers: 3,
    maxPlayers: 6
  };

  res.render('impostor-lobby', pageData);
});

/**
 * GET /campus-impostor/lobby
 * Backwards-compatible route: redirects to /room/:code or default QUAD-104
 */
router.get('/lobby', (req, res) => {
  const roomCode = req.query.room || 'QUAD-104';
  const modeParam = req.query.mode ? `?mode=${encodeURIComponent(req.query.mode)}` : '';
  res.redirect(`/campus-impostor/room/${encodeURIComponent(roomCode)}${modeParam}`);
});

module.exports = router;

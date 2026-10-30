const express = require('express');
const path = require('path');
const dotenv = require('dotenv');

// Load environment variables if available
dotenv.config();

const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);
const PORT = process.env.PORT || 3000;

// Register Socket.IO lobby handler
const registerLobbyHandler = require('./socket/lobbyHandler');
registerLobbyHandler(io);

// View engine setup (EJS)
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Serve static assets from public directory
app.use(express.static(path.join(__dirname, 'public')));

// Middleware for parsing requests
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// Routes
const indexRouter = require('./routes/index');
const impostorRouter = require('./routes/impostor');
const voiceRoomsRouter = require('./routes/voiceRooms');
const { getIceServers } = require('./config/webrtc');

app.use('/', indexRouter);
app.use('/campus-impostor', impostorRouter);
app.get('/impostor', (req, res) => res.redirect('/campus-impostor'));
app.use('/voice-rooms', voiceRoomsRouter);
app.get('/rooms', (req, res) => res.redirect('/voice-rooms'));

// WebRTC ICE servers configuration endpoint
app.get('/api/ice-servers', (req, res) => {
  res.json({
    success: true,
    iceServers: getIceServers()
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).render('404', {
    title: '404 - Page Not Found | SweetPlay',
    brandName: 'SweetPlay'
  });
});

// Start server
server.listen(PORT, () => {
  console.log(`🎮 SweetPlay Prototype Server running at http://localhost:${PORT}`);
});

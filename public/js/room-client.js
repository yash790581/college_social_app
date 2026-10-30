/**
 * SweetPlay - Real-Time Room Chat & Audio Client Module
 * Provides reusable components for:
 * 1. SweetPlayChat: In-room group chat with safe textContent rendering, 500-char limits, and rate-limit handling.
 * 2. SweetPlayVoice: Audio-only WebRTC client with Socket.IO signaling, mute/unmute, speaker deafen, and error handling.
 */

(function (window) {
  'use strict';

  /* ==========================================================================
     1. SweetPlayChat: Room Group Chat Component
     ========================================================================== */
  class SweetPlayChat {
    constructor(options = {}) {
      this.socket = options.socket;
      this.roomCode = options.roomCode;
      this.onToast = options.onToast || function () {};

      // DOM Elements
      this.container = options.container || document.getElementById(options.containerId || 'roomChatPanel');
      this.messagesList = options.messagesList || document.getElementById(options.messagesListId || 'chatMessagesList');
      this.inputForm = options.inputForm || document.getElementById(options.inputFormId || 'chatInputForm');
      this.textInput = options.textInput || document.getElementById(options.textInputId || 'chatTextInput');
      this.sendBtn = options.sendBtn || document.getElementById(options.sendBtnId || 'btnSendChatMessage');
      this.charCounter = options.charCounter || document.getElementById(options.charCounterId || 'chatCharCounter');
      this.errorAlert = options.errorAlert || document.getElementById(options.errorAlertId || 'chatErrorAlert');
      this.errorText = options.errorText || document.getElementById(options.errorTextId || 'chatErrorText');

      this.isBound = false;
      this.maxChars = 500;
    }

    init(socket, roomCode) {
      if (socket) this.socket = socket;
      if (roomCode) this.roomCode = roomCode;

      if (!this.socket || !this.roomCode) return;

      this.bindSocketEvents();
      this.bindDomEvents();

      // Request chat history for this room
      this.socket.emit('chat:history', { roomCode: this.roomCode }, (res) => {
        if (res && res.success && Array.isArray(res.messages)) {
          if (this.messagesList) this.messagesList.innerHTML = '';
          res.messages.forEach((msg) => this.renderMessage(msg));
        }
      });
    }

    bindSocketEvents() {
      if (this.isBound || !this.socket) return;
      this.isBound = true;

      // New chat message received
      this.socket.on('chat:message', (message) => {
        this.renderMessage(message);
      });

      // Chat error (e.g. rate limit, length)
      this.socket.on('chat:error', (data) => {
        this.showError(data.message || 'Chat error occurred.');
      });
    }

    bindDomEvents() {
      if (this.textInput) {
        // Character counter and input validation
        this.textInput.addEventListener('input', () => {
          const len = this.textInput.value.length;
          if (this.charCounter) {
            this.charCounter.textContent = `${len}/${this.maxChars}`;
            if (len >= 450) {
              this.charCounter.classList.add('char-warning');
            } else {
              this.charCounter.classList.remove('char-warning');
            }
          }
          this.hideError();
        });

        // Enter key to send (Shift+Enter for newline if multiline, but we use single line input)
        this.textInput.addEventListener('keydown', (e) => {
          if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            this.handleSend();
          }
        });
      }

      if (this.inputForm) {
        this.inputForm.addEventListener('submit', (e) => {
          e.preventDefault();
          this.handleSend();
        });
      }

      if (this.sendBtn) {
        this.sendBtn.addEventListener('click', (e) => {
          e.preventDefault();
          this.handleSend();
        });
      }
    }

    handleSend() {
      if (!this.textInput || !this.socket) return;

      const raw = this.textInput.value;
      const trimmed = raw.trim();

      if (!trimmed) {
        this.textInput.focus();
        return;
      }

      if (trimmed.length > this.maxChars) {
        this.showError(`Message exceeds ${this.maxChars} characters.`);
        return;
      }

      const cleanText = trimmed.slice(0, this.maxChars);

      // Disable send button momentarily
      if (this.sendBtn) this.sendBtn.disabled = true;

      this.socket.emit('chat:send', {
        roomCode: this.roomCode,
        text: cleanText
      }, (res) => {
        if (this.sendBtn) this.sendBtn.disabled = false;

        if (res && !res.success) {
          this.showError(res.message || 'Could not send message.');
        } else {
          this.textInput.value = '';
          if (this.charCounter) this.charCounter.textContent = `0/${this.maxChars}`;
          this.hideError();
          this.textInput.focus();
        }
      });
    }

    /**
     * Render message using safe DOM textContent methods to prevent XSS.
     * Absolutely NO innerHTML interpolation for user input.
     */
    renderMessage(msg) {
      if (!this.messagesList || !msg) return;

      const isSelf = this.socket && msg.senderId === this.socket.id;

      const msgEl = document.createElement('div');
      msgEl.className = `chat-bubble ${isSelf ? 'chat-bubble-self' : 'chat-bubble-peer'}`;
      msgEl.id = `msg-${msg.id || Date.now()}`;

      // Meta header (Avatar, Nickname, Seat, Timestamp)
      const metaEl = document.createElement('div');
      metaEl.className = 'chat-bubble-meta';

      const authorWrap = document.createElement('span');
      authorWrap.className = 'chat-author-wrap';

      const avatarSpan = document.createElement('span');
      avatarSpan.className = 'chat-author-avatar';
      avatarSpan.textContent = msg.avatar || '👤';

      const nameSpan = document.createElement('strong');
      nameSpan.className = 'chat-author-name';
      nameSpan.textContent = msg.senderName || 'Student';

      authorWrap.appendChild(avatarSpan);
      authorWrap.appendChild(nameSpan);

      if (msg.senderSeat) {
        const seatPill = document.createElement('span');
        seatPill.className = 'chat-seat-pill';
        seatPill.textContent = `Seat ${msg.senderSeat}`;
        authorWrap.appendChild(seatPill);
      }

      if (isSelf) {
        const youPill = document.createElement('span');
        youPill.className = 'chat-you-pill';
        youPill.textContent = 'You';
        authorWrap.appendChild(youPill);
      }

      const timeSpan = document.createElement('span');
      timeSpan.className = 'chat-msg-time';
      timeSpan.textContent = msg.timeFormatted || new Date(msg.timestamp || Date.now()).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });

      metaEl.appendChild(authorWrap);
      metaEl.appendChild(timeSpan);

      // Body (CRITICAL: textContent only)
      const bodyEl = document.createElement('div');
      bodyEl.className = 'chat-bubble-text';
      bodyEl.textContent = msg.text; // Safe textContent insertion

      msgEl.appendChild(metaEl);
      msgEl.appendChild(bodyEl);

      this.messagesList.appendChild(msgEl);

      // Auto-scroll to latest message
      this.messagesList.scrollTop = this.messagesList.scrollHeight;
    }

    showError(message) {
      if (this.errorText) this.errorText.textContent = message;
      if (this.errorAlert) this.errorAlert.hidden = false;
      if (this.onToast) this.onToast(message, '⚠️');
    }

    hideError() {
      if (this.errorAlert) this.errorAlert.hidden = true;
    }

    setConnected(isConnected) {
      if (this.textInput) {
        this.textInput.disabled = !isConnected;
        this.textInput.placeholder = isConnected ? 'Type a message to the room...' : 'Reconnecting to room chat...';
      }
      if (this.sendBtn) this.sendBtn.disabled = !isConnected;
    }
  }


  /* ==========================================================================
     2. SweetPlayVoice: Audio-Only WebRTC Voice Client
     ========================================================================== */
  class SweetPlayVoice {
    constructor(options = {}) {
      this.socket = options.socket;
      this.roomCode = options.roomCode;
      this.onToast = options.onToast || function () {};
      this.onVoiceStateChange = options.onVoiceStateChange || function () {};

      // Voice Controls UI
      this.joinVoiceBtn = options.joinVoiceBtn || document.getElementById(options.joinVoiceBtnId || 'btnJoinVoice');
      this.micToggleBtn = options.micToggleBtn || document.getElementById(options.micToggleBtnId || 'btnToggleMic');
      this.speakerToggleBtn = options.speakerToggleBtn || document.getElementById(options.speakerToggleBtnId || 'btnToggleSpeaker');
      this.leaveVoiceBtn = options.leaveVoiceBtn || document.getElementById(options.leaveVoiceBtnId || 'btnLeaveVoice');
      this.voiceStatusBadge = options.voiceStatusBadge || document.getElementById(options.voiceStatusBadgeId || 'voiceStatusBadge');
      this.voiceStatusText = options.voiceStatusText || document.getElementById(options.voiceStatusTextId || 'voiceStatusText');
      this.voiceNoticeBox = options.voiceNoticeBox || document.getElementById(options.voiceNoticeBoxId || 'voiceNoticeBox');
      this.voiceNoticeText = options.voiceNoticeText || document.getElementById(options.voiceNoticeTextId || 'voiceNoticeText');

      // Audio Elements container
      this.audioContainer = document.getElementById('remoteAudioContainer');
      if (!this.audioContainer) {
        this.audioContainer = document.createElement('div');
        this.audioContainer.id = 'remoteAudioContainer';
        this.audioContainer.style.display = 'none';
        document.body.appendChild(this.audioContainer);
      }

      // WebRTC State
      this.localStream = null;
      this.isMuted = true; // MUST JOIN MUTED BY DEFAULT
      this.isSpeakerDeafened = false;
      this.isInVoice = false;
      this.connectionState = 'disconnected'; // 'disconnected' | 'requesting' | 'connecting' | 'connected' | 'reconnecting' | 'error'

      // Map<peerId, { pc: RTCPeerConnection, audioEl: HTMLAudioElement, pendingCandidates: RTCIceCandidate[] }>
      this.peers = new Map();

      // Fallback STUN configuration
      this.iceServers = [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' }
      ];

      this.isBound = false;
      this.loadIceConfiguration();
    }

    async loadIceConfiguration() {
      try {
        const res = await fetch('/api/ice-servers');
        if (res.ok) {
          const data = await res.json();
          if (data.iceServers && Array.isArray(data.iceServers) && data.iceServers.length > 0) {
            this.iceServers = data.iceServers;
          }
        }
      } catch (e) {
        // Fallback to default STUN
      }
    }

    init(socket, roomCode) {
      if (socket) this.socket = socket;
      if (roomCode) this.roomCode = roomCode;

      if (!this.socket || !this.roomCode) return;

      this.bindSocketEvents();
      this.bindDomEvents();
      this.updateUiState();
    }

    bindSocketEvents() {
      if (this.isBound || !this.socket) return;
      this.isBound = true;

      // Another peer joined voice
      this.socket.on('voice:peer_joined', (data) => {
        if (!this.isInVoice) return;
        this.onToast(`${data.nickname || 'Classmate'} joined the voice call.`, '🎙️');
        // The newly joined peer will initiate connection to existing peers
        this.updateUiState();
      });

      // Peer signaling payload (Offer, Answer, ICE candidate)
      this.socket.on('voice:signal', async ({ fromPeerId, signal }) => {
        if (!this.isInVoice) return;
        await this.handleIncomingSignal(fromPeerId, signal);
      });

      // Peer changed mute / deafen state
      this.socket.on('voice:state_change', (data) => {
        if (this.onVoiceStateChange) {
          this.onVoiceStateChange(data);
        }
      });

      // Peer left voice
      this.socket.on('voice:peer_left', ({ peerId }) => {
        this.cleanupPeer(peerId);
        this.updateUiState();
      });

      // Socket reconnection
      this.socket.on('connect', () => {
        if (this.isInVoice) {
          this.setConnectionState('reconnecting', 'Re-establishing voice signaling...');
          this.socket.emit('voice:join', { roomCode: this.roomCode, isMuted: this.isMuted }, (res) => {
            if (res && res.success) {
              this.setConnectionState('connected', 'Connected to Voice');
              // Reconnect existing peers
              if (Array.isArray(res.existingPeers)) {
                res.existingPeers.forEach((p) => this.initiatePeerConnection(p.peerId));
              }
            }
          });
        }
      });

      this.socket.on('disconnect', () => {
        if (this.isInVoice) {
          this.setConnectionState('reconnecting', 'Lost signaling connection. Waiting for reconnect...');
        }
      });
    }

    bindDomEvents() {
      // Join Voice Button
      if (this.joinVoiceBtn) {
        this.joinVoiceBtn.addEventListener('click', (e) => {
          e.preventDefault();
          this.joinVoice();
        });
      }

      // Microphone Mute / Unmute Toggle
      if (this.micToggleBtn) {
        this.micToggleBtn.addEventListener('click', (e) => {
          e.preventDefault();
          this.toggleMic();
        });
      }

      // Speaker Mute / Unmute (Deafen) Toggle
      if (this.speakerToggleBtn) {
        this.speakerToggleBtn.addEventListener('click', (e) => {
          e.preventDefault();
          this.toggleSpeaker();
        });
      }

      // Leave Voice Button
      if (this.leaveVoiceBtn) {
        this.leaveVoiceBtn.addEventListener('click', (e) => {
          e.preventDefault();
          this.leaveVoice();
        });
      }
    }

    /**
     * Join voice call: Requests microphone permission ONLY on user click.
     * NEVER requests camera access (audio: true, video: false).
     * Automatically joins muted by default.
     */
    async joinVoice() {
      if (this.isInVoice) return;

      // 1. Check browser WebRTC support
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia || typeof RTCPeerConnection === 'undefined') {
        this.showNotice('Unsupported Browser: WebRTC audio is not supported in this browser. Please use Chrome, Edge, Safari, or Firefox.', 'error');
        return;
      }

      this.setConnectionState('requesting', 'Requesting microphone permission...');

      try {
        // AUDIO-ONLY constraint. Video is NEVER requested!
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true
          },
          video: false
        });

        this.localStream = stream;

        // JOIN MUTED BY DEFAULT (disable all audio tracks)
        this.localStream.getAudioTracks().forEach((track) => {
          track.enabled = false;
        });
        this.isMuted = true;

        this.isInVoice = true;
        this.setConnectionState('connecting', 'Connecting to room audio...');

        // Notify server that user is joining voice with muted state
        this.socket.emit('voice:join', {
          roomCode: this.roomCode,
          isMuted: true
        }, (res) => {
          if (!res || !res.success) {
            this.showNotice(res ? res.message : 'Failed to join voice channel.', 'error');
            this.leaveVoice();
            return;
          }

          this.setConnectionState('connected', 'Connected to Voice');
          this.showNotice('Connected to voice. You joined muted. Click "Turn on mic" whenever you wish to speak.', 'info');

          // Initiate WebRTC peer connections with all existing voice peers in the room
          const existingPeers = res.existingPeers || [];
          existingPeers.forEach((peer) => {
            this.initiatePeerConnection(peer.peerId);
          });

          this.updateUiState();
        });
      } catch (err) {
        console.error('Microphone access error:', err);
        this.isInVoice = false;

        let friendlyError = 'Could not access microphone.';
        if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
          friendlyError = 'Microphone permission was denied. Please allow microphone access in your browser address bar/settings to use voice rooms.';
        } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
          friendlyError = 'No microphone found. Please connect a microphone or headset and try again.';
        } else if (err.name === 'NotReadableError' || err.name === 'TrackStartError') {
          friendlyError = 'Microphone is currently in use by another application or operating system service.';
        }

        this.setConnectionState('error', friendlyError);
        this.showNotice(friendlyError, 'error');
        this.updateUiState();
      }
    }

    /**
     * Create RTCPeerConnection for a remote peer and initiate Offer
     */
    async initiatePeerConnection(targetPeerId) {
      if (!this.localStream) return;

      const pc = this.createPeerConnection(targetPeerId);

      try {
        const offer = await pc.createOffer({
          offerToReceiveAudio: true,
          offerToReceiveVideo: false
        });

        await pc.setLocalDescription(offer);

        this.socket.emit('voice:signal', {
          roomCode: this.roomCode,
          targetPeerId,
          signal: {
            type: 'offer',
            sdp: pc.localDescription
          }
        });
      } catch (err) {
        console.error(`Error creating offer for peer ${targetPeerId}:`, err);
      }
    }

    /**
     * Create and configure RTCPeerConnection instance for a peer
     */
    createPeerConnection(peerId) {
      if (this.peers.has(peerId)) {
        return this.peers.get(peerId).pc;
      }

      const pc = new RTCPeerConnection({
        iceServers: this.iceServers
      });

      // Create remote audio element
      const audioEl = document.createElement('audio');
      audioEl.id = `remoteAudio_${peerId}`;
      audioEl.autoplay = true;
      audioEl.playsInline = true;
      audioEl.muted = this.isSpeakerDeafened;
      this.audioContainer.appendChild(audioEl);

      const peerData = {
        pc,
        audioEl,
        pendingCandidates: []
      };

      this.peers.set(peerId, peerData);

      // Add local audio tracks to the peer connection
      if (this.localStream) {
        this.localStream.getAudioTracks().forEach((track) => {
          pc.addTrack(track, this.localStream);
        });
      }

      // Handle ICE Candidates
      pc.onicecandidate = (event) => {
        if (event.candidate) {
          this.socket.emit('voice:signal', {
            roomCode: this.roomCode,
            targetPeerId: peerId,
            signal: {
              type: 'candidate',
              candidate: event.candidate
            }
          });
        }
      };

      // Handle remote incoming audio track
      pc.ontrack = (event) => {
        if (event.streams && event.streams[0]) {
          audioEl.srcObject = event.streams[0];
          // Try to play (handles browser autoplay policy)
          audioEl.play().catch((playErr) => {
            console.warn(`Autoplay audio for peer ${peerId} requires user interaction:`, playErr);
          });
        }
      };

      // Monitor ICE connection state
      pc.oniceconnectionstatechange = () => {
        if (pc.iceConnectionState === 'disconnected' || pc.iceConnectionState === 'failed') {
          // Attempt ICE restart or notify
        }
      };

      return pc;
    }

    /**
     * Handle incoming WebRTC signaling messages from room peers
     */
    async handleIncomingSignal(fromPeerId, signal) {
      if (!signal) return;

      let peerData = this.peers.get(fromPeerId);

      if (signal.type === 'offer') {
        const pc = this.createPeerConnection(fromPeerId);
        peerData = this.peers.get(fromPeerId);

        try {
          await pc.setRemoteDescription(new RTCSessionDescription(signal.sdp));

          // Drain queued ICE candidates
          if (peerData.pendingCandidates && peerData.pendingCandidates.length > 0) {
            for (const cand of peerData.pendingCandidates) {
              await pc.addIceCandidate(new RTCIceCandidate(cand)).catch(() => {});
            }
            peerData.pendingCandidates = [];
          }

          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);

          this.socket.emit('voice:signal', {
            roomCode: this.roomCode,
            targetPeerId: fromPeerId,
            signal: {
              type: 'answer',
              sdp: pc.localDescription
            }
          });
        } catch (err) {
          console.error(`Error handling offer from ${fromPeerId}:`, err);
        }
      } else if (signal.type === 'answer') {
        if (!peerData) return;
        try {
          await peerData.pc.setRemoteDescription(new RTCSessionDescription(signal.sdp));

          // Drain queued ICE candidates
          if (peerData.pendingCandidates && peerData.pendingCandidates.length > 0) {
            for (const cand of peerData.pendingCandidates) {
              await peerData.pc.addIceCandidate(new RTCIceCandidate(cand)).catch(() => {});
            }
            peerData.pendingCandidates = [];
          }
        } catch (err) {
          console.error(`Error setting remote answer from ${fromPeerId}:`, err);
        }
      } else if (signal.type === 'candidate' && signal.candidate) {
        if (peerData && peerData.pc.remoteDescription && peerData.pc.remoteDescription.type) {
          await peerData.pc.addIceCandidate(new RTCIceCandidate(signal.candidate)).catch((err) => {
            console.warn('Error adding ICE candidate:', err);
          });
        } else if (peerData) {
          peerData.pendingCandidates.push(signal.candidate);
        }
      }
    }

    /**
     * Toggle Local Microphone Mute / Unmute
     */
    toggleMic() {
      if (!this.isInVoice || !this.localStream) {
        this.showNotice('Join voice first to turn on your microphone.', 'info');
        return;
      }

      this.isMuted = !this.isMuted;

      // Enable/disable the local tracks
      this.localStream.getAudioTracks().forEach((track) => {
        track.enabled = !this.isMuted;
      });

      // Broadcast mute state change to other room members
      this.socket.emit('voice:state', {
        roomCode: this.roomCode,
        isMuted: this.isMuted,
        isDeafened: this.isSpeakerDeafened
      });

      this.updateUiState();
      this.onToast(this.isMuted ? 'Microphone muted.' : 'Microphone unmuted (live).', this.isMuted ? '🔇' : '🎙️');
    }

    /**
     * Toggle Speaker Mute (Deafen)
     */
    toggleSpeaker() {
      if (!this.isInVoice) {
        this.showNotice('Join voice first to manage speaker settings.', 'info');
        return;
      }

      this.isSpeakerDeafened = !this.isSpeakerDeafened;

      // Mute / unmute all remote audio elements
      this.peers.forEach((peer) => {
        if (peer.audioEl) {
          peer.audioEl.muted = this.isSpeakerDeafened;
        }
      });

      this.socket.emit('voice:state', {
        roomCode: this.roomCode,
        isMuted: this.isMuted,
        isDeafened: this.isSpeakerDeafened
      });

      this.updateUiState();
      this.onToast(this.isSpeakerDeafened ? 'Speaker muted (deafened).' : 'Speaker active.', this.isSpeakerDeafened ? '🔈' : '🔊');
    }

    /**
     * Clean up a single remote peer connection
     */
    cleanupPeer(peerId) {
      if (this.peers.has(peerId)) {
        const peer = this.peers.get(peerId);
        try {
          peer.pc.close();
        } catch (e) {}
        if (peer.audioEl) {
          peer.audioEl.srcObject = null;
          peer.audioEl.remove();
        }
        this.peers.delete(peerId);
      }
    }

    /**
     * Leave voice call and release microphone track
     */
    leaveVoice() {
      if (!this.isInVoice && !this.localStream) return;

      // Stop and release microphone tracks
      if (this.localStream) {
        this.localStream.getTracks().forEach((track) => {
          track.stop();
        });
        this.localStream = null;
      }

      // Close all peer connections
      this.peers.forEach((peer) => {
        try {
          peer.pc.close();
        } catch (e) {}
        if (peer.audioEl) {
          peer.audioEl.srcObject = null;
          peer.audioEl.remove();
        }
      });
      this.peers.clear();

      this.isInVoice = false;
      this.isMuted = true;
      this.isSpeakerDeafened = false;

      // Notify server
      if (this.socket) {
        this.socket.emit('voice:leave', { roomCode: this.roomCode });
      }

      this.setConnectionState('disconnected', 'Not connected to voice');
      this.updateUiState();
      this.showNotice('Left voice channel.', 'info');
    }

    setConnectionState(state, text) {
      this.connectionState = state;
      if (this.voiceStatusText) this.voiceStatusText.textContent = text;
      this.updateUiState();
    }

    updateUiState() {
      // Join Voice Button vs Active Voice Dock
      if (this.joinVoiceBtn) {
        this.joinVoiceBtn.hidden = this.isInVoice;
      }

      const activeGroup = document.getElementById('activeVoiceControls');
      if (activeGroup) {
        activeGroup.hidden = !this.isInVoice;
      }

      // Mic Button styling & label
      if (this.micToggleBtn) {
        if (this.isMuted) {
          this.micToggleBtn.className = 'btn-voice-ctrl btn-mic-muted';
          this.micToggleBtn.innerHTML = '<span class="ctrl-icon">🔇</span><span>Turn on mic</span>';
          this.micToggleBtn.title = 'Microphone is currently muted. Click to speak.';
        } else {
          this.micToggleBtn.className = 'btn-voice-ctrl btn-mic-live';
          this.micToggleBtn.innerHTML = '<span class="ctrl-icon">🎙️</span><span>Mute mic</span>';
          this.micToggleBtn.title = 'Microphone is live. Click to mute.';
        }
      }

      // Speaker Button styling & label
      if (this.speakerToggleBtn) {
        if (this.isSpeakerDeafened) {
          this.speakerToggleBtn.className = 'btn-voice-ctrl btn-speaker-deafened';
          this.speakerToggleBtn.innerHTML = '<span class="ctrl-icon">🔈</span><span>Deafened</span>';
          this.speakerToggleBtn.title = 'Speaker is muted. Click to hear others.';
        } else {
          this.speakerToggleBtn.className = 'btn-voice-ctrl btn-speaker-active';
          this.speakerToggleBtn.innerHTML = '<span class="ctrl-icon">🔊</span><span>Speaker</span>';
          this.speakerToggleBtn.title = 'Speaker is active. Click to deafen.';
        }
      }

      // Status Badge
      if (this.voiceStatusBadge) {
        if (!this.isInVoice) {
          this.voiceStatusBadge.className = 'badge-voice-status status-idle';
          this.voiceStatusBadge.textContent = 'Voice: Idle';
        } else if (this.connectionState === 'connecting' || this.connectionState === 'requesting') {
          this.voiceStatusBadge.className = 'badge-voice-status status-connecting';
          this.voiceStatusBadge.textContent = 'Voice: Connecting...';
        } else if (this.connectionState === 'reconnecting') {
          this.voiceStatusBadge.className = 'badge-voice-status status-connecting';
          this.voiceStatusBadge.textContent = 'Voice: Reconnecting...';
        } else if (this.isMuted) {
          this.voiceStatusBadge.className = 'badge-voice-status status-muted';
          this.voiceStatusBadge.textContent = `🎙️ In Voice (${this.peers.size + 1}) • Mic Muted`;
        } else {
          this.voiceStatusBadge.className = 'badge-voice-status status-live';
          this.voiceStatusBadge.textContent = `🟢 In Voice (${this.peers.size + 1}) • Mic Live`;
        }
      }
    }

    showNotice(message, type = 'info') {
      if (this.voiceNoticeText) this.voiceNoticeText.textContent = message;
      if (this.voiceNoticeBox) {
        this.voiceNoticeBox.className = `voice-notice-box notice-${type}`;
        this.voiceNoticeBox.hidden = false;
        setTimeout(() => {
          if (this.voiceNoticeBox && type !== 'error') this.voiceNoticeBox.hidden = true;
        }, 6000);
      }
    }
  }

  // Export classes globally
  window.SweetPlayChat = SweetPlayChat;
  window.SweetPlayVoice = SweetPlayVoice;

})(window);

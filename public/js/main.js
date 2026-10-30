/**
 * SweetPlay - College Social Gaming Platform
 * Client-Side Application Script
 * 
 * Includes:
 * 1. Homepage matchmaking option selectors and simulation dialog.
 * 2. Campus Impostor Mode Selector (Create / Join room modals).
 * 3. Real-Time Waiting Lobby (Socket.IO):
 *    - Synchronizes player seats (1–6), avatars, and tags.
 *    - Synchronizes player ready states across all connected browsers.
 *    - Host controls (start only when >= 3 players are ready).
 *    - Simple "Lobby ready" state banner.
 *    - Disconnect, leave, full room, and invalid code error handling.
 */

document.addEventListener('DOMContentLoaded', () => {
  /* ==========================================================================
     1. Shared Toast Notification System
     ========================================================================== */
  let toastTimer = null;
  const toastEl = document.getElementById('prototypeToast');
  const toastMsg = document.getElementById('toastMessage');
  const toastIco = document.getElementById('toastIcon');

  function showToast(message, icon = '💡') {
    if (!toastEl) return;
    if (toastMsg) toastMsg.textContent = message;
    if (toastIco) toastIco.textContent = icon;

    toastEl.hidden = false;
    void toastEl.offsetWidth; // trigger reflow
    toastEl.classList.add('show');

    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      toastEl.classList.remove('show');
      setTimeout(() => {
        toastEl.hidden = true;
      }, 250);
    }, 3200);
  }

  /* ==========================================================================
     2. Generic Modal Controller Helper
     ========================================================================== */
  function setupModal(modalId, triggerBtnId, closeBtnId, dismissBtnId) {
    const modal = document.getElementById(modalId);
    const trigger = document.getElementById(triggerBtnId);
    const closeBtn = document.getElementById(closeBtnId);
    const dismissBtn = document.getElementById(dismissBtnId);

    if (!modal) return null;

    function open() {
      modal.hidden = false;
      requestAnimationFrame(() => {
        modal.classList.add('open');
        closeBtn?.focus();
      });
    }

    function close() {
      modal.classList.remove('open');
      setTimeout(() => {
        modal.hidden = true;
        trigger?.focus();
      }, 250);
    }

    if (trigger) {
      trigger.addEventListener('click', (e) => {
        e.preventDefault();
        open();
      });
    }

    if (closeBtn) closeBtn.addEventListener('click', close);
    if (dismissBtn) dismissBtn.addEventListener('click', close);

    modal.addEventListener('click', (e) => {
      if (e.target === modal) close();
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && !modal.hidden) close();
    });

    return { open, close };
  }

  /* ==========================================================================
     3. Homepage Matchmaking Prototype Modal (Preserved)
     ========================================================================== */
  const modeCards = document.querySelectorAll('.mode-card');
  const findGameBtn = document.getElementById('findGameBtn');
  const homepageModal = document.getElementById('prototypeModal');
  const homeCloseBtn = document.getElementById('modalCloseBtn');
  const homeDismissBtn = document.getElementById('modalDismissBtn');
  const selectedModeText = document.getElementById('selectedModeText');
  const modalExplanation = document.getElementById('modalExplanation');

  let currentSelectedCampusMode = 'my-campus';

  function selectCampusMode(modeId) {
    currentSelectedCampusMode = modeId;
    modeCards.forEach((card) => {
      const isCurrent = card.getAttribute('data-mode') === modeId;
      if (isCurrent) {
        card.classList.add('active');
        card.setAttribute('aria-checked', 'true');
      } else {
        card.classList.remove('active');
        card.setAttribute('aria-checked', 'false');
      }
    });
  }

  modeCards.forEach((card) => {
    const modeId = card.getAttribute('data-mode');
    card.addEventListener('click', () => selectCampusMode(modeId));
    card.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        selectCampusMode(modeId);
      }
    });
  });

  if (homepageModal) {
    function openHomeModal() {
      const isMyCampus = currentSelectedCampusMode === 'my-campus';
      if (selectedModeText) {
        selectedModeText.textContent = isMyCampus ? 'My campus' : 'Any campus';
      }
      if (modalExplanation) {
        if (isMyCampus) {
          modalExplanation.textContent = 'Demo notice: You selected "My campus". In a future release, this mode will require a college email or another approved verification method (verification is not implemented in this prototype).';
        } else {
          modalExplanation.textContent = 'Demo notice: You selected "Any campus". In a future release, this mode can include students from other colleges (verification is not implemented in this prototype).';
        }
      }
      homepageModal.hidden = false;
      requestAnimationFrame(() => {
        homepageModal.classList.add('open');
        homeCloseBtn?.focus();
      });
    }

    function closeHomeModal() {
      homepageModal.classList.remove('open');
      setTimeout(() => {
        homepageModal.hidden = true;
        findGameBtn?.focus();
      }, 250);
    }

    if (findGameBtn) {
      findGameBtn.addEventListener('click', (e) => {
        e.preventDefault();
        openHomeModal();
      });
    }

    if (homeCloseBtn) homeCloseBtn.addEventListener('click', closeHomeModal);
    if (homeDismissBtn) homeDismissBtn.addEventListener('click', closeHomeModal);

    homepageModal.addEventListener('click', (event) => {
      if (event.target === homepageModal) closeHomeModal();
    });

    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && !homepageModal.hidden) {
        closeHomeModal();
      }
    });
  }

  /* ==========================================================================
     4. Campus Impostor Mode Selector Hub (Create & Join Modals)
     ========================================================================== */
  const createRoomModalCtrl = setupModal('createRoomModal', 'btnOpenCreateRoomModal', 'createRoomCloseBtn', 'createRoomDismissBtn');
  const joinRoomModalCtrl = setupModal('joinRoomModal', 'btnOpenJoinRoomModal', 'joinRoomCloseBtn', 'joinRoomDismissBtn');

  // Mode Card "Create Mode" Buttons
  const openCreateBtns = document.querySelectorAll('.btn-open-create-modal');
  const createModeSelect = document.getElementById('createModeSelect');
  openCreateBtns.forEach((btn) => {
    btn.addEventListener('click', () => {
      const modeId = btn.getAttribute('data-mode-id');
      if (createModeSelect && modeId) {
        createModeSelect.value = modeId;
      }
      createRoomModalCtrl?.open();
    });
  });

  // Handle Create Room Form Submit
  const createRoomForm = document.getElementById('createRoomForm');
  const createNicknameInput = document.getElementById('createNickname');
  const createCustomCodeInput = document.getElementById('createCustomCode');

  if (createRoomForm && createNicknameInput) {
    // Pre-fill nickname from sessionStorage if available
    const savedNick = sessionStorage.getItem('sweetplay_nickname');
    if (savedNick) createNicknameInput.value = savedNick;

    createRoomForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const nick = createNicknameInput.value.trim();
      if (!nick) return;

      const mode = createModeSelect ? createModeSelect.value : 'campus-impostor';
      const customCode = createCustomCodeInput ? createCustomCodeInput.value.trim().toUpperCase() : '';

      sessionStorage.setItem('sweetplay_nickname', nick);
      sessionStorage.setItem('sweetplay_mode', mode);
      sessionStorage.setItem('sweetplay_action', 'create');

      // Generate a clean target code if not provided
      const targetCode = customCode || `QUAD-${Math.floor(100 + Math.random() * 900)}`;
      window.location.href = `/campus-impostor/room/${encodeURIComponent(targetCode)}?mode=${encodeURIComponent(mode)}`;
    });
  }

  // Handle Join Room Form Submit
  const joinRoomForm = document.getElementById('joinRoomForm');
  const joinRoomCodeInput = document.getElementById('joinRoomCode');
  const joinNicknameInput = document.getElementById('joinNickname');

  if (joinRoomForm && joinRoomCodeInput && joinNicknameInput) {
    const savedNick = sessionStorage.getItem('sweetplay_nickname');
    if (savedNick) joinNicknameInput.value = savedNick;

    joinRoomForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const code = joinRoomCodeInput.value.trim().toUpperCase();
      const nick = joinNicknameInput.value.trim();
      if (!code || !nick) return;

      sessionStorage.setItem('sweetplay_nickname', nick);
      sessionStorage.setItem('sweetplay_action', 'join');

      window.location.href = `/campus-impostor/room/${encodeURIComponent(code)}`;
    });
  }

  /* ==========================================================================
     4b. Voice Rooms Directory Hub (Create & Join Modals)
     ========================================================================== */
  const createVoiceModalCtrl = setupModal('createVoiceModal', 'btnOpenCreateVoiceModal', 'createVoiceCloseBtn', 'createVoiceDismissBtn');
  const joinVoiceModalCtrl = setupModal('joinVoiceModal', 'btnOpenJoinVoiceModal', 'joinVoiceCloseBtn', 'joinVoiceDismissBtn');

  const btnEmptyCreateVoice = document.getElementById('btnEmptyCreateVoice');
  if (btnEmptyCreateVoice && createVoiceModalCtrl) {
    btnEmptyCreateVoice.addEventListener('click', () => {
      createVoiceModalCtrl.open();
    });
  }

  // Theme cards pre-fill and trigger modal
  const themeCards = document.querySelectorAll('.theme-card');
  const voiceRoomNameInput = document.getElementById('voiceRoomNameInput');
  themeCards.forEach((card) => {
    card.addEventListener('click', () => {
      const title = card.getAttribute('data-theme-title');
      if (voiceRoomNameInput && title) {
        voiceRoomNameInput.value = title;
      }
      createVoiceModalCtrl?.open();
    });
  });

  // Handle Create Voice Room Form Submit
  const createVoiceRoomForm = document.getElementById('createVoiceRoomForm');
  const voiceHostNickname = document.getElementById('voiceHostNickname');
  const voiceCustomCode = document.getElementById('voiceCustomCode');

  if (createVoiceRoomForm && voiceHostNickname) {
    const savedNick = sessionStorage.getItem('sweetplay_nickname');
    if (savedNick) voiceHostNickname.value = savedNick;

    createVoiceRoomForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const nick = voiceHostNickname.value.trim();
      const rName = voiceRoomNameInput ? voiceRoomNameInput.value.trim() : 'Campus Voice Lounge';
      const cCode = voiceCustomCode ? voiceCustomCode.value.trim().toUpperCase() : '';

      if (!nick) return;

      sessionStorage.setItem('sweetplay_nickname', nick);
      sessionStorage.setItem('sweetplay_room_name', rName);
      sessionStorage.setItem('sweetplay_room_type', 'voice');
      sessionStorage.setItem('sweetplay_action', 'create');

      const targetCode = cCode || `LOUNGE-${Math.floor(100 + Math.random() * 900)}`;
      window.location.href = `/voice-rooms/room/${encodeURIComponent(targetCode)}`;
    });
  }

  // Handle Join Voice Room Form Submit
  const joinVoiceRoomForm = document.getElementById('joinVoiceRoomForm');
  const joinVoiceCodeInput = document.getElementById('joinVoiceCodeInput');
  const joinVoiceNicknameInput = document.getElementById('joinVoiceNicknameInput');

  if (joinVoiceRoomForm && joinVoiceCodeInput && joinVoiceNicknameInput) {
    const savedNick = sessionStorage.getItem('sweetplay_nickname');
    if (savedNick) joinVoiceNicknameInput.value = savedNick;

    joinVoiceRoomForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const code = joinVoiceCodeInput.value.trim().toUpperCase();
      const nick = joinVoiceNicknameInput.value.trim();
      if (!code || !nick) return;

      sessionStorage.setItem('sweetplay_nickname', nick);
      sessionStorage.setItem('sweetplay_action', 'join');
      sessionStorage.setItem('sweetplay_room_type', 'voice');

      window.location.href = `/voice-rooms/room/${encodeURIComponent(code)}`;
    });
  }

  /* ==========================================================================
     5. Real-Time Room Stage Client (Campus Impostor & Voice Rooms)
     ========================================================================== */
  const roomStageContainer = document.getElementById('lobbyMainContainer') || document.getElementById('voiceRoomMainContainer');

  if (roomStageContainer && typeof io !== 'undefined') {
    const isVoiceRoomPage = !document.getElementById('lobbyMainContainer') && !!document.getElementById('voiceRoomMainContainer');
    const initialRoomCode = roomStageContainer.getAttribute('data-room-code') || (isVoiceRoomPage ? 'LOUNGE-104' : 'QUAD-104');
    const initialModeId = roomStageContainer.getAttribute('data-mode-id') || (isVoiceRoomPage ? 'voice-lounge' : 'campus-impostor');

    // UI Elements
    const displayRoomCode = document.getElementById('displayRoomCode');
    const noticeRoomCode = document.getElementById('noticeRoomCode');
    const roomDisplayName = document.getElementById('roomDisplayName');
    const lobbyModeBadge = document.getElementById('lobbyModeBadge');
    const connectedCountBadge = document.getElementById('connectedCountBadge');
    const readyCountBadge = document.getElementById('readyCountBadge');
    const connectionStatusBadge = document.getElementById('connectionStatusBadge');

    const btnToggleReady = document.getElementById('btnToggleReady');
    const readyBtnIcon = document.getElementById('readyBtnIcon');
    const readyBtnText = document.getElementById('readyBtnText');
    const readyActionHint = document.getElementById('readyActionHint');

    const hostControlsWrapper = document.getElementById('hostControlsWrapper');
    const btnHostStart = document.getElementById('btnHostStart');
    const hostStartBtnText = document.getElementById('hostStartBtnText');
    const hostStartHint = document.getElementById('hostStartHint');

    const nonHostStatusWrapper = document.getElementById('nonHostStatusWrapper');
    const nonHostWaitText = document.getElementById('nonHostWaitText');

    const lobbyStartedBanner = document.getElementById('lobbyStartedBanner');
    const lobbyStartedMessage = document.getElementById('lobbyStartedMessage');
    const hostResetArea = document.getElementById('hostResetArea');
    const btnResetLobby = document.getElementById('btnResetLobby');
    const lobbyControlsBox = document.getElementById('lobbyControlsBox');

    const btnCopyRoomCode = document.getElementById('btnCopyRoomCode');
    const btnCopyRoomLink = document.getElementById('btnCopyRoomLink');
    const btnShareInvite = document.getElementById('btnShareInvite');
    const btnLeaveLobby = document.getElementById('btnLeaveLobby');

    // Modals
    const nicknameModal = document.getElementById('nicknameModal');
    const nicknameForm = document.getElementById('nicknameForm');
    const promptNicknameInput = document.getElementById('promptNicknameInput');
    const promptRoomCode = document.getElementById('promptRoomCode');

    const roomErrorModal = document.getElementById('roomErrorModal');
    const roomErrorMessage = document.getElementById('roomErrorMessage');
    const roomErrorDetail = document.getElementById('roomErrorDetail');

    setupModal('rulesModal', 'btnRulesHelp', 'rulesModalCloseBtn', 'rulesModalDismissBtn');

    // Pre-assigned seat fallbacks
    const seatAvatars = ['👨‍💻', '👩‍🔬', '🧑‍💼', '👩‍🎨', '🧑‍🏫', '🎓'];
    const seatTags = ['CS \'25', 'Bio \'26', 'Econ \'24', 'Arch \'25', 'Math \'27', 'Campus Guest'];

    let socket = null;
    let currentRoom = null;
    let myPlayer = null;
    let isCurrentHost = false;

    // Chat and Voice components
    let chatComponent = null;
    let voiceComponent = null;

    /**
     * Copy text to clipboard with user feedback
     */
    function copyToClipboard(text, successMsg) {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(() => {
          showToast(successMsg, '📋');
        }).catch(() => {
          showToast(`Room code: ${text}`, '📋');
        });
      } else {
        showToast(`Room code: ${text}`, '📋');
      }
    }

    if (btnCopyRoomCode) {
      btnCopyRoomCode.addEventListener('click', () => {
        copyToClipboard(currentRoom ? currentRoom.code : initialRoomCode, 'Room code copied to clipboard!');
      });
    }

    if (btnCopyRoomLink) {
      btnCopyRoomLink.addEventListener('click', () => {
        copyToClipboard(window.location.href, 'Room link copied to clipboard!');
      });
    }

    if (btnShareInvite) {
      btnShareInvite.addEventListener('click', () => {
        copyToClipboard(window.location.href, 'Invite link copied! Share with your classmate.');
      });
    }

    /**
     * Render the 6-seat quad grid based on real-time room data
     */
    function renderRoom(room) {
      currentRoom = room;
      const players = room.players || [];
      const totalPlayers = players.length;
      const readyPlayers = players.filter((p) => p.isReady).length;

      // Update room header meta
      if (displayRoomCode) displayRoomCode.textContent = room.code;
      if (noticeRoomCode) noticeRoomCode.textContent = room.code;
      if (promptRoomCode) promptRoomCode.textContent = room.code;
      if (roomDisplayName) roomDisplayName.textContent = room.name || (isVoiceRoomPage ? `Campus Voice Lounge ${room.code}` : `Campus Quad Lounge ${room.code}`);
      if (lobbyModeBadge) lobbyModeBadge.textContent = room.mode;

      if (connectedCountBadge) {
        connectedCountBadge.textContent = `${totalPlayers}/6 ${isVoiceRoomPage ? 'Seated' : 'Players'}`;
      }

      if (readyCountBadge) {
        readyCountBadge.textContent = `${readyPlayers}/${totalPlayers} Ready`;
        if (readyPlayers >= 3) {
          readyCountBadge.style.background = 'rgba(16, 185, 129, 0.25)';
          readyCountBadge.style.borderColor = 'rgba(16, 185, 129, 0.6)';
        } else {
          readyCountBadge.style.background = '';
          readyCountBadge.style.borderColor = '';
        }
      }

      // Check if current user is host
      isCurrentHost = (socket && room.hostSocketId === socket.id);
      myPlayer = players.find((p) => socket && p.id === socket.id) || myPlayer;

      // Render each seat slot 1 through 6
      for (let s = 1; s <= 6; s++) {
        const seatSlot = document.getElementById(`seat-slot-${s}`);
        const statusBadge = document.getElementById(`seat-status-${s}`);
        const nameEl = document.getElementById(`seat-name-${s}`);
        const tagEl = document.getElementById(`seat-tag-${s}`);
        const labelEl = document.getElementById(`seat-label-${s}`);
        const voiceWrap = document.getElementById(`seat-voice-wrap-${s}`);

        if (!seatSlot) continue;

        const player = players.find((p) => p.seatNumber === s);

        if (player) {
          // Occupied Seat
          const isMe = socket && player.id === socket.id;
          seatSlot.className = `seat-card ${isMe ? 'user-seat' : 'demo-seat'} ${player.isReady ? 'seat-ready' : 'seat-unready'}`;
          seatSlot.setAttribute('data-ready', player.isReady ? 'true' : 'false');
          seatSlot.setAttribute('data-socket-id', player.id);

          // Ready / Status indicator
          if (statusBadge) {
            if (room.type === 'voice') {
              statusBadge.className = 'ready-indicator-badge status-ready';
              statusBadge.textContent = 'Active';
            } else {
              statusBadge.className = `ready-indicator-badge ${player.isReady ? 'status-ready' : 'status-waiting'}`;
              statusBadge.innerHTML = player.isReady ? '<span class="check-icon">✓</span> Ready' : '<span class="wait-icon">⏳</span> Waiting';
            }
          }

          // Avatar
          const avatarRing = seatSlot.querySelector('.avatar-ring');
          const avatarEmoji = seatSlot.querySelector('.avatar-emoji');
          if (avatarRing) avatarRing.className = 'avatar-ring';
          if (avatarEmoji) {
            avatarEmoji.textContent = player.avatar || seatAvatars[s - 1] || '🎓';
            avatarEmoji.style.filter = '';
            avatarEmoji.style.opacity = '1';
          }

          // Name and badges
          if (nameEl) {
            let badgesHtml = '';
            if (player.isHost) {
              badgesHtml += ' <span class="host-pill" title="Room Host">👑 Host</span>';
            }
            if (isMe) {
              badgesHtml += ' <span class="you-pill">You</span>';
            }
            nameEl.innerHTML = `${player.nickname}${badgesHtml}`;
          }

          if (tagEl) tagEl.textContent = player.majorTag || seatTags[s - 1] || 'Campus Student';

          // Live Voice Status Badge on Seat Card
          if (voiceWrap) {
            if (player.inVoice) {
              if (player.isMuted) {
                voiceWrap.innerHTML = '<span class="seat-voice-tag voice-muted">🔇 Mic Muted</span>';
              } else {
                voiceWrap.innerHTML = '<span class="seat-voice-tag voice-live">🎙️ Mic Live</span>';
              }
            } else {
              voiceWrap.innerHTML = '';
            }
          }

          if (labelEl) {
            if (room.type === 'voice') {
              labelEl.textContent = player.inVoice ? 'In Voice Audio' : 'In Lounge';
            } else {
              labelEl.textContent = player.isReady ? 'Ready to Play' : 'Waiting for Ready';
            }
          }
        } else {
          // Empty Seat
          seatSlot.className = 'seat-card empty-seat';
          seatSlot.setAttribute('data-ready', 'false');
          seatSlot.removeAttribute('data-socket-id');

          if (statusBadge) {
            statusBadge.className = 'ready-indicator-badge status-empty';
            statusBadge.textContent = 'Empty';
          }

          const avatarRing = seatSlot.querySelector('.avatar-ring');
          const avatarEmoji = seatSlot.querySelector('.avatar-emoji');
          if (avatarRing) avatarRing.className = 'avatar-ring avatar-empty';
          if (avatarEmoji) {
            avatarEmoji.textContent = '👤';
            avatarEmoji.style.filter = 'grayscale(1)';
            avatarEmoji.style.opacity = '0.35';
          }

          if (nameEl) nameEl.textContent = 'Open Seat';
          if (tagEl) tagEl.textContent = 'Waiting for classmate...';
          if (labelEl) labelEl.textContent = 'Available';
          if (voiceWrap) voiceWrap.innerHTML = '';
        }
      }

      // Update Local Player "Get Ready" Button (Campus Impostor only)
      if (myPlayer && btnToggleReady) {
        if (myPlayer.isReady) {
          btnToggleReady.classList.add('is-ready');
          btnToggleReady.setAttribute('aria-pressed', 'true');
          btnToggleReady.setAttribute('data-ready', 'true');
          if (readyBtnIcon) readyBtnIcon.textContent = '✓';
          if (readyBtnText) readyBtnText.textContent = 'Ready! (Click to cancel)';
          if (readyActionHint) readyActionHint.textContent = 'You are ready. Waiting for all players...';
        } else {
          btnToggleReady.classList.remove('is-ready');
          btnToggleReady.setAttribute('aria-pressed', 'false');
          btnToggleReady.setAttribute('data-ready', 'false');
          if (readyBtnIcon) readyBtnIcon.textContent = '⚡';
          if (readyBtnText) readyBtnText.textContent = 'Get Ready';
          if (readyActionHint) readyActionHint.textContent = 'Click to toggle ready status. Minimum 3 ready players required to start.';
        }
      }

      // Update Host Controls vs Non-Host Wait Info (Campus Impostor only)
      if (!isVoiceRoomPage) {
        const canStart = isCurrentHost && totalPlayers >= 3 && readyPlayers >= 3;

        if (isCurrentHost) {
          if (hostControlsWrapper) hostControlsWrapper.hidden = false;
          if (nonHostStatusWrapper) nonHostStatusWrapper.hidden = true;

          if (btnHostStart) {
            if (canStart) {
              btnHostStart.disabled = false;
              btnHostStart.classList.remove('disabled');
              if (hostStartBtnText) hostStartBtnText.textContent = `🚀 Start Game (${readyPlayers} Players Ready)`;
              if (hostStartHint) hostStartHint.textContent = 'All conditions met! Host can start the lobby now.';
            } else {
              btnHostStart.disabled = true;
              btnHostStart.classList.add('disabled');
              if (totalPlayers < 3) {
                if (hostStartBtnText) hostStartBtnText.textContent = `Need ${3 - totalPlayers} More Player${3 - totalPlayers === 1 ? '' : 's'}`;
                if (hostStartHint) hostStartHint.textContent = `At least 3 players must join before the host can start (currently ${totalPlayers}/6).`;
              } else {
                if (hostStartBtnText) hostStartBtnText.textContent = `Need ${3 - readyPlayers} More Ready`;
                if (hostStartHint) hostStartHint.textContent = `At least 3 players must click "Get Ready" (currently ${readyPlayers}/${totalPlayers} ready).`;
              }
            }
          }
        } else {
          if (hostControlsWrapper) hostControlsWrapper.hidden = true;
          if (nonHostStatusWrapper) nonHostStatusWrapper.hidden = false;

          if (nonHostWaitText) {
            const hostPlayer = players.find((p) => p.isHost);
            const hostNameStr = hostPlayer ? hostPlayer.nickname : 'the Host';
            if (canStart) {
              nonHostWaitText.innerHTML = `🟢 <strong>${hostNameStr}</strong> can start the match at any moment!`;
            } else if (totalPlayers < 3) {
              nonHostWaitText.textContent = `Waiting for classmates to join (currently ${totalPlayers}/6 players, need 3).`;
            } else {
              nonHostWaitText.textContent = `Waiting for players to ready up (currently ${readyPlayers}/${totalPlayers} ready, need 3).`;
            }
          }
        }

        // Check if room has transitioned to "ready" (Game started banner)
        if (room.status === 'ready') {
          if (lobbyStartedBanner) lobbyStartedBanner.hidden = false;
          if (lobbyControlsBox) lobbyControlsBox.style.display = 'none';
          if (hostResetArea) hostResetArea.hidden = !isCurrentHost;
        } else {
          if (lobbyStartedBanner) lobbyStartedBanner.hidden = true;
          if (lobbyControlsBox) lobbyControlsBox.style.display = '';
          if (hostResetArea) hostResetArea.hidden = true;
        }
      }
    }

    /**
     * Connect to Socket.IO and Join / Create room
     */
    function initSocketConnection(roomCode, nickname) {
      if (socket) return;

      socket = io();

      socket.on('connect', () => {
        if (connectionStatusBadge) {
          connectionStatusBadge.textContent = '🟢 Connected';
          connectionStatusBadge.style.color = '#a7f3d0';
        }

        // Initialize Chat Component
        if (typeof SweetPlayChat !== 'undefined' && !chatComponent) {
          chatComponent = new SweetPlayChat({
            socket,
            roomCode,
            onToast: showToast
          });
          chatComponent.init(socket, roomCode);
        } else if (chatComponent) {
          chatComponent.setConnected(true);
        }

        // Initialize Voice Component
        if (typeof SweetPlayVoice !== 'undefined' && !voiceComponent) {
          voiceComponent = new SweetPlayVoice({
            socket,
            roomCode,
            onToast: showToast,
            onVoiceStateChange: (stateData) => {
              if (currentRoom) {
                const targetPlayer = currentRoom.players.find((p) => p.id === stateData.peerId);
                if (targetPlayer) {
                  targetPlayer.isMuted = stateData.isMuted;
                  renderRoom(currentRoom);
                }
              }
            }
          });
          voiceComponent.init(socket, roomCode);
        }

        const action = sessionStorage.getItem('sweetplay_action');
        const mode = sessionStorage.getItem('sweetplay_mode') || initialModeId;
        const roomType = sessionStorage.getItem('sweetplay_room_type') || (isVoiceRoomPage ? 'voice' : 'game');
        const customRoomName = sessionStorage.getItem('sweetplay_room_name');

        if (action === 'create') {
          sessionStorage.removeItem('sweetplay_action');
          sessionStorage.removeItem('sweetplay_room_name');

          socket.emit('lobby:create', {
            nickname,
            mode,
            type: roomType,
            name: customRoomName,
            customCode: roomCode
          }, (res) => {
            if (!res.success) {
              // If creation failed because code exists, fallback to joining it
              socket.emit('lobby:join', { roomCode, nickname });
            }
          });
        } else {
          socket.emit('lobby:join', { roomCode, nickname });
        }
      });

      socket.on('disconnect', () => {
        if (connectionStatusBadge) {
          connectionStatusBadge.textContent = '🔴 Disconnected';
          connectionStatusBadge.style.color = '#fca5a5';
        }
        if (chatComponent) chatComponent.setConnected(false);
        showToast('Lost connection to server. Reconnecting...', '⚠️');
      });

      socket.on('lobby:joined', (data) => {
        if (data.success && data.room) {
          renderRoom(data.room);
          showToast(`Joined ${data.room.name}!`, isVoiceRoomPage ? '🎙️' : '🎓');
        }
      });

      socket.on('lobby:update', (data) => {
        if (data.room) {
          renderRoom(data.room);
        }
      });

      socket.on('lobby:started', (data) => {
        if (data.room) {
          renderRoom(data.room);
        }
        showToast('🎉 Lobby Ready! Host has started the lobby.', '🎉');
      });

      socket.on('lobby:toast', (data) => {
        if (data.message) {
          showToast(data.message, data.icon || '💬');
        }
      });

      socket.on('lobby:error', (data) => {
        if (roomErrorModal) {
          if (roomErrorMessage) roomErrorMessage.textContent = data.message || 'Unable to join room.';
          if (roomErrorDetail) roomErrorDetail.textContent = data.detail || 'Check room code or host a new room.';
          roomErrorModal.hidden = false;
          requestAnimationFrame(() => roomErrorModal.classList.add('open'));
        } else {
          showToast(data.message || 'Error occurred', '⚠️');
        }
      });
    }

    // Toggle Ready Button Listener (Campus Impostor)
    if (btnToggleReady) {
      btnToggleReady.addEventListener('click', () => {
        if (!socket || !currentRoom) return;
        socket.emit('lobby:toggle_ready', { roomCode: currentRoom.code });
      });
    }

    // Host Start Button Listener (Campus Impostor)
    if (btnHostStart) {
      btnHostStart.addEventListener('click', () => {
        if (!socket || !currentRoom || !isCurrentHost) return;
        socket.emit('lobby:start_game', { roomCode: currentRoom.code });
      });
    }

    // Host Reset Lobby Listener (Campus Impostor)
    if (btnResetLobby) {
      btnResetLobby.addEventListener('click', () => {
        if (!socket || !currentRoom || !isCurrentHost) return;
        socket.emit('lobby:reset_lobby', { roomCode: currentRoom.code });
      });
    }

    // Leave Room Button Listener
    if (btnLeaveLobby) {
      btnLeaveLobby.addEventListener('click', (e) => {
        e.preventDefault();
        if (voiceComponent) {
          voiceComponent.leaveVoice();
        }
        if (socket && currentRoom) {
          socket.emit('lobby:leave', { roomCode: currentRoom.code });
        }
        window.location.href = isVoiceRoomPage ? '/voice-rooms' : '/campus-impostor';
      });
    }

    // Check if user has a nickname set in sessionStorage
    const storedNickname = sessionStorage.getItem('sweetplay_nickname');

    if (storedNickname) {
      initSocketConnection(initialRoomCode, storedNickname);
    } else {
      // Prompt user for nickname via modal
      if (nicknameModal) {
        nicknameModal.hidden = false;
        requestAnimationFrame(() => {
          nicknameModal.classList.add('open');
          promptNicknameInput?.focus();
        });

        if (nicknameForm && promptNicknameInput) {
          nicknameForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const enteredNick = promptNicknameInput.value.trim();
            if (!enteredNick) return;

            sessionStorage.setItem('sweetplay_nickname', enteredNick);
            nicknameModal.classList.remove('open');
            setTimeout(() => {
              nicknameModal.hidden = true;
            }, 250);

            initSocketConnection(initialRoomCode, enteredNick);
          });
        }
      }
    }
  }
});


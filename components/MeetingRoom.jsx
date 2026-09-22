'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { useSocket } from '@/hooks/useSocket';
import { useWebRTC } from '@/hooks/useWebRTC';
import VideoGrid from './VideoGrid';
import ControlBar from './ControlBar';
import ChatPanel from './ChatPanel';
import ParticipantPanel from './ParticipantPanel';

export default function MeetingRoom({ roomId }) {
  const router = useRouter();
  const { socket, isConnected, emit, on, off } = useSocket();

  // ── Local media ───────────────────────────────────────────
  const [localStream, setLocalStream] = useState(null);
  const [screenStream, setScreenStream] = useState(null);
  const [audioOn, setAudioOn] = useState(true);
  const [videoOn, setVideoOn] = useState(true);
  const [screenSharing, setScreenSharing] = useState(false);

  // ── User / room state ─────────────────────────────────────
  const [localUser, setLocalUser] = useState(null);
  const [participants, setParticipants] = useState({}); // id -> { id, name, isHost, audioOn, videoOn }
  const [isHost, setIsHost] = useState(false);
  const joinedSocketId = useRef(null);

  // ── UI state ───────────────────────────────────────────────
  const [chatOpen, setChatOpen] = useState(false);
  const [participantsOpen, setParticipantsOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [toasts, setToasts] = useState([]);
  const [time, setTime] = useState('');
  const [copied, setCopied] = useState(false);

  // ── WebRTC ────────────────────────────────────────────────
  const { remoteStreams, createPeer, destroyAll } = useWebRTC({
    socket,
    roomId,
    localStream,
  });

  // ── Clock ────────────────────────────────────────────────
  useEffect(() => {
    const tick = () =>
      setTime(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  // ── Toast ─────────────────────────────────────────────────
  const showToast = useCallback((msg, type = 'info') => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    setToasts((prev) => [...prev, { id, msg, type }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 3500);
  }, []);

  // ── Get local media ───────────────────────────────────────
  useEffect(() => {
    let stream;
    const init = async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        setLocalStream(stream);
      } catch (err) {
        console.error('Media error:', err);
        showToast('Could not access camera/mic. Check permissions.', 'danger');
        try {
          stream = await navigator.mediaDevices.getUserMedia({ audio: true });
          setLocalStream(stream);
        } catch {
          setLocalStream(false);
        }
      }
    };
    init();
    return () => {
      stream?.getTracks?.().forEach((t) => t.stop());
    };
  }, [showToast]);

  // ── Session (NextAuth JWT) ────────────────────────────────
  const { data: session } = useSession();

  // ── Join room once socket + stream are ready ──────────────
  useEffect(() => {
    if (!isConnected || !socket || !socket.id || localStream === null) return;
    if (joinedSocketId.current === socket.id) return;

    // Use verified session name; fall back to sessionStorage during dev reloads
    const userName = session?.user?.name || sessionStorage.getItem('userName') || 'Guest';
    // isHost hint from sessionStorage — server enforces the real rule (first joiner)
    const hostFlag = sessionStorage.getItem('isHost') === 'true';
    setIsHost(hostFlag);

    const me = { id: socket.id, name: userName, isHost: hostFlag, audioOn: true, videoOn: true };
    setLocalUser(me);

    emit('join-room', { roomId, userName, isHost: hostFlag });
    joinedSocketId.current = socket.id;
  }, [isConnected, socket, roomId, emit, localStream, session]);

  // ── Socket event handlers ─────────────────────────────────
  useEffect(() => {
    if (!socket) return;

    // Existing participants when we join
    const handleRoomParticipants = (others) => {
      const map = {};
      others.forEach((p) => {
        map[p.id] = p;
        // Initiate peer connections as the newcomer
        createPeer(p.id, true);
      });
      setParticipants(map);
    };

    // A new user joined after us
    const handleUserJoined = (participant) => {
      setParticipants((prev) => ({ ...prev, [participant.id]: participant }));
      showToast(`${participant.name} joined`, 'success');
      // They will send us an offer (they're the initiator)
    };

    // A user left
    const handleUserLeft = ({ id }) => {
      setParticipants((prev) => {
        const next = { ...prev };
        const name = next[id]?.name;
        delete next[id];
        if (name) showToast(`${name} left`, 'info');
        return next;
      });
    };

    // Remote audio/video state changes
    const handleAudioToggle = ({ id, audioOn }) => {
      setParticipants((prev) =>
        prev[id] ? { ...prev, [id]: { ...prev[id], audioOn } } : prev
      );
    };

    const handleVideoToggle = ({ id, videoOn }) => {
      setParticipants((prev) =>
        prev[id] ? { ...prev, [id]: { ...prev[id], videoOn } } : prev
      );
    };

    // New chat message
    const handleNewMessage = (msg) => {
      setMessages((prev) => [...prev, msg]);
    };

    // Host forced mute
    const handleForceMute = () => {
      setAudioOn(false);
      if (localStream && typeof localStream === 'object') {
        localStream.getAudioTracks?.().forEach((t) => (t.enabled = false));
      }
      showToast('You were muted by the host', 'info');
    };

    // Kicked
    const handleKicked = () => {
      showToast('You were removed from the meeting', 'danger');
      setTimeout(() => router.push('/'), 1500);
    };

    socket.on('room-participants', handleRoomParticipants);
    socket.on('user-joined', handleUserJoined);
    socket.on('user-left', handleUserLeft);
    socket.on('participant-audio-toggle', handleAudioToggle);
    socket.on('participant-video-toggle', handleVideoToggle);
    socket.on('new-message', handleNewMessage);
    socket.on('force-mute', handleForceMute);
    socket.on('kicked', handleKicked);

    return () => {
      socket.off('room-participants', handleRoomParticipants);
      socket.off('user-joined', handleUserJoined);
      socket.off('user-left', handleUserLeft);
      socket.off('participant-audio-toggle', handleAudioToggle);
      socket.off('participant-video-toggle', handleVideoToggle);
      socket.off('new-message', handleNewMessage);
      socket.off('force-mute', handleForceMute);
      socket.off('kicked', handleKicked);
    };
  }, [socket, createPeer, showToast, router, localStream]);

  // ── Controls ───────────────────────────────────────────────
  const handleToggleAudio = useCallback(() => {
    const next = !audioOn;
    setAudioOn(next);
    if (localStream && typeof localStream === 'object') {
      localStream.getAudioTracks?.().forEach((t) => (t.enabled = next));
    }
    emit('toggle-audio', { roomId, audioOn: next });
  }, [audioOn, localStream, emit, roomId]);

  const handleToggleVideo = useCallback(() => {
    const next = !videoOn;
    setVideoOn(next);
    if (localStream && typeof localStream === 'object') {
      localStream.getVideoTracks?.().forEach((t) => (t.enabled = next));
    }
    emit('toggle-video', { roomId, videoOn: next });
  }, [videoOn, localStream, emit, roomId]);

  const handleToggleScreen = useCallback(async () => {
    if (screenSharing) {
      screenStream?.getTracks().forEach((t) => t.stop());
      setScreenStream(null);
      setScreenSharing(false);
      // Restore camera
      try {
        const cam = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        setLocalStream(cam);
      } catch {}
    } else {
      try {
        const screen = await navigator.mediaDevices.getDisplayMedia({ video: true });
        screen.getVideoTracks()[0].onended = () => {
          setScreenSharing(false);
          setScreenStream(null);
          // Restore camera when screen share ends via browser UI
          navigator.mediaDevices.getUserMedia({ video: true, audio: true })
            .then((cam) => setLocalStream(cam))
            .catch(() => {});
        };
        setScreenStream(screen);
        // Preserve audio tracks so microphone doesn't drop during screen sharing
        const audioTracks = localStream && typeof localStream === 'object' ? localStream.getAudioTracks() : [];
        const combined = new MediaStream([...screen.getVideoTracks(), ...audioTracks]);
        setLocalStream(combined);
        setScreenSharing(true);
      } catch (err) {
        showToast('Screen sharing cancelled', 'info');
      }
    }
  }, [screenSharing, screenStream, localStream, showToast]);

  const handleSendMessage = useCallback(
    (text) => {
      emit('send-message', { roomId, message: text });
    },
    [emit, roomId]
  );

  const handleMuteParticipant = useCallback(
    (targetId) => {
      emit('mute-participant', { roomId, targetId });
    },
    [emit, roomId]
  );

  const handleKickParticipant = useCallback(
    (targetId) => {
      emit('kick-participant', { roomId, targetId });
    },
    [emit, roomId]
  );

  const handleLeave = useCallback(() => {
    destroyAll();
    localStream?.getTracks().forEach((t) => t.stop());
    screenStream?.getTracks().forEach((t) => t.stop());
    router.push('/');
  }, [destroyAll, localStream, screenStream, router]);

  const handleCopyCode = useCallback(() => {
    navigator.clipboard.writeText(roomId).then(() => {
      setCopied(true);
      showToast('Meeting code copied!', 'success');
      setTimeout(() => setCopied(false), 2000);
    });
  }, [roomId, showToast]);

  const participantCount = 1 + Object.keys(participants).length;

  return (
    <div className="room-layout">
      {/* Header */}
      <header className="room-header">
        <div className="room-header-left">
          <span className="room-logo">OmniMeet</span>
          <button className="meeting-code-badge" onClick={handleCopyCode} id="copy-code-btn">
            🔗 {roomId}
            <span style={{ opacity: 0.7, fontSize: '0.7rem' }}>{copied ? '✓ Copied!' : 'Click to copy'}</span>
          </button>
        </div>
        <span className="room-time">{time}</span>
      </header>

      {/* Main area */}
      <div className="room-main">
        <VideoGrid
          localStream={localStream}
          localUser={{ ...localUser, audioOn, videoOn }}
          remoteStreams={remoteStreams}
          participants={participants}
        />

        {/* Side panels */}
        {chatOpen && (
          <ChatPanel
            messages={messages}
            onSend={handleSendMessage}
            onClose={() => setChatOpen(false)}
            currentUserId={socket?.id}
          />
        )}

        {participantsOpen && (
          <ParticipantPanel
            participants={participants}
            localUser={{ ...localUser, audioOn, videoOn }}
            isHost={isHost}
            onMute={handleMuteParticipant}
            onKick={handleKickParticipant}
            onClose={() => setParticipantsOpen(false)}
          />
        )}
      </div>

      {/* Control bar */}
      <ControlBar
        audioOn={audioOn}
        videoOn={videoOn}
        screenSharing={screenSharing}
        chatOpen={chatOpen}
        participantsOpen={participantsOpen}
        onToggleAudio={handleToggleAudio}
        onToggleVideo={handleToggleVideo}
        onToggleScreen={handleToggleScreen}
        onToggleChat={() => setChatOpen((v) => !v)}
        onToggleParticipants={() => setParticipantsOpen((v) => !v)}
        onLeave={handleLeave}
        participantCount={participantCount}
      />

      {/* Toast notifications — aria-live for screen readers */}
      <div className="toast-container" aria-live="polite" aria-atomic="false">
        {toasts.map((t) => (
          <div key={t.id} className={`toast ${t.type}`} role="alert">
            {t.type === 'success' ? '✓' : t.type === 'danger' ? '⚠' : 'ℹ'} {t.msg}
          </div>
        ))}
      </div>
    </div>
  );
}
